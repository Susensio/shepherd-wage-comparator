/**
 * calc(): every figure of an offer, grouped by subject. Money is in € over the whole contract, gross, unless the name
 * says otherwise. No DOM here.
 */

import { num } from '../format.js';
import { LAW, minWageOf } from '../law.js';
import {
  actualYear,
  DAYS_PER_MONTH,
  endOf,
  foodPerDay,
  isComplete,
  rentPerMonth,
  spanOf,
  vacationPaid,
  workedOffers,
} from '../offer.js';
import { effectiveOffer, legalMinimum, payroll, travel } from './pay.js';
import { bisect, unemploymentBenefit } from './tax.js';
import { extraDaysRounded, extraTime, hoursWeek, overtimePerWeek, schedule } from './time.js';

/** Which share of an offer falls in each year, by days: {2025: 0.4, 2026: 0.6}. Without dates, all in its year. */
export function yearShares(o) {
  if (!o.start || !endOf(o)) return { [actualYear(o)]: 1 };
  const [start, end] = spanOf(o);
  const days = (+end - +start) / 864e5 + 1;
  const shares = {};
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    const from = Math.max(+start, +new Date(y, 0, 1));
    const to = Math.min(+end, +new Date(y, 11, 31));
    if (to >= from) shares[y] = ((to - from) / 864e5 + 1) / days;
  }
  return shares;
}

/**
 * For IRPF: for each year the offer touches, its share of the gross and what your other worked offers earn on payroll
 * that year (also split by days). The others are calculated on their own, to avoid going round in circles.
 */
function othersInYear(o, { cfg, offers }) {
  const shares = yearShares(o);
  const others = o.start
    ? workedOffers(offers)
        .filter((p) => p.id !== o.id && isComplete(p))
        .map((p) => ({ gross: calc(p, { cfg, offers, alone: true }).pay.gross, shares: yearShares(p) }))
    : [];
  const years = Object.keys(shares);
  const perYear = Object.entries(shares).map(([year, share]) => ({
    share,
    deduction: minWageOf(Number(year)).ded,
    others: others.reduce((sum, p) => sum + p.gross * (p.shares[year] || 0), 0),
  }));
  return {
    shares: perYear,
    gross: perYear.reduce((sum, y) => sum + y.others, 0),
    count: others.filter((p) => p.gross > 0.5 && years.some((y) => p.shares[y])).length,
    years,
  };
}

// Rounding slack: a cash share this close to 1 is shown and treated as all cash
const ALL_CASH_SHARE = 0.995;

/**
 * Every figure of an offer.
 * @param {object} offer as entered
 * @param {{cfg: object, offers?: object[], alone?: boolean}} ctx settings; your other offers (for IRPF) unless `alone`
 */
export function calc(offer, { cfg, offers = [], alone = false }) {
  const wage = minWageOf(actualYear(offer));
  const others = alone
    ? { shares: [{ share: 1, others: 0, deduction: wage.ded }], gross: 0, count: 0, years: [String(wage.year)] }
    : othersInYear(offer, { cfg, offers });
  const ctx = { cfg, wage, irpfShares: others.shares };

  // Without a contract there is no payroll and no paid vacation: everything is cash, against a temporary contract's minimum
  const { offer: effective, split } = effectiveOffer(offer, ctx, schedule);
  const noContract = effective.contract === 'none';
  const o = noContract
    ? { ...effective, payAmount: 0, vacation: 'included', extraPays: 'included', contract: 'temporary' }
    : effective;

  const time = schedule(o, cfg);
  const pay = payroll(o, ctx, time);
  const car = travel(o, time, cfg);
  const min = legalMinimum(o, ctx, time);
  const { months, natDays, daysWorked, hours, noDuration } = time;

  // Cash, housing and food, expenses
  const cashAmount = num(o.cashAmount);
  const cash =
    o.cashUnit === 'month' ? cashAmount * months : o.cashUnit === 'day' ? cashAmount * daysWorked : cashAmount;
  const housing = cfg.inKind && o.housing === 'yes' ? rentPerMonth(o, cfg) * months : 0;
  const food = cfg.inKind ? foodPerDay(o, cfg) * daysWorked : 0;
  const otherExpenses = num(o.expenses) * months;

  // Unemployment benefit you generate; and the gross that would bring the cash part net, on payroll
  const contribDays = pay.gross > 0 ? natDays + (vacationPaid(o) ? time.vacationDays : 0) : 0;
  const benefit = unemploymentBenefit(pay.gross, contribDays);
  const netPayroll = pay.netOf(pay.gross);
  const cashGrossEq = cash > 0 ? bisect((x) => pay.netOf(pay.gross + x) - netPayroll, cash, cash, cash * 3, 50) : 0;

  const employerRate = 1 + cfg.ssEmp / 100;
  const salaryPerDay = natDays > 0 ? pay.salary / natDays : 0;
  const severance =
    !noDuration && o.contract === 'temporary' ? (salaryPerDay * LAW.severanceDaysPerYear * natDays) / 365 : 0;

  // What you earn: the unemployment benefit counts as your money (it can be switched off): it is what cash does not give
  const parts = {
    base: pay.base * pay.netFactor,
    extraPays: pay.extraPays * pay.netFactor,
    vacationPay: pay.vacationPay * pay.netFactor,
    b: cash,
    housing,
    food,
    km: car.kmPaid,
    severance,
    unemployment: cfg.unemployment !== false ? benefit.euros : 0,
  };
  const total = Object.values(parts).reduce((sum, x) => sum + x, 0) - (car.cost + otherExpenses);
  const perMonth = (x) => (months > 0 ? x / months : 0);

  // What you are owed, counted by months: what is missing in each item separately (a surplus in one does not cover another)
  let debtSalary = Math.max(0, min.salary + min.overnight - pay.salary);
  let debtVacation = o.vacation === 'taken' ? 0 : Math.max(0, min.vacation - pay.vacationPay);
  let minNetNoContract = 0;
  if (noContract) {
    // What you are paid in cash against the minimum wage with bonus, through the same net↔gross factor as the rest
    const factor = pay.netFactor > 0 ? pay.netFactor : 1 - cfg.ssPct / 100;
    const minSalary = min.salary + min.overnight;
    minNetNoContract = minSalary * factor;
    debtSalary = Math.max(0, minSalary - cash / factor);
    debtVacation = min.vacation;
  }
  const debtTotal = debtSalary + debtVacation;
  const coveredByCash = cash > 0 ? cashGrossEq : 0;
  const salaryPart = noContract ? Math.max(0, debtSalary - min.overnight) : Math.max(0, min.salary - pay.salary);

  // Extra days and overtime: what you are paid above the legal minimum (payroll and cash) covers the extra days first
  // (each a workday at the minimum wage) and whatever is left, the overtime (each an hour at the minimum wage).
  // Casual workers are paid the minimum per day worked, so only the due days count against it.
  const extra = extraTime(time);
  const normalShare = min.casual && daysWorked > 0 ? Math.min(1, extra.due / daysWorked) : 1;
  const normalPay = (min.salary + min.overnight) * normalShare + min.vacation;
  const dayValue = min.hourly * extra.workday * (1 + min.overnightRate);
  const paidAbove = pay.gross > 0 || noContract ? Math.max(0, pay.gross - normalPay + coveredByCash) : 0;
  const daysValue = extra.days >= 0.5 ? extra.days * dayValue : 0;
  const overtimeValue = extra.overtime * min.hourly;
  const daysUnpaid = Math.max(0, daysValue - paidAbove);
  const overtimeUnpaid = Math.max(0, overtimeValue - Math.max(0, paidAbove - daysValue));

  // What the employer saves at your expense, with their Social Security: their margin to negotiate
  const owed = noContract ? debtTotal : Math.max(0, debtTotal - coveredByCash);
  const cashSavings = cashGrossEq * employerRate - cash;
  const savings = {
    /** contributions on the cash part (on everything, without a contract) */
    cash: cashSavings > 1 ? cashSavings : 0,
    /** what is missing from the minimum and cash does not cover */
    minimum: owed > 1 ? owed * employerRate : 0,
    days: daysValue > 0 && daysUnpaid > 1 ? daysUnpaid * employerRate : 0,
    overtime: overtimeValue > 0 && overtimeUnpaid > 1 ? overtimeUnpaid * employerRate : 0,
  };
  savings.total = savings.cash + savings.minimum + savings.days + savings.overtime;

  const cashShare = pay.net + cash > 0 ? cash / (pay.net + cash) : 0;
  const allCash = cashShare >= ALL_CASH_SHARE;
  const restLegal = ((natDays - time.vacationTaken) * LAW.weeklyRest) / 7;
  const debtParts = { salary: salaryPart, overnight: Math.max(0, debtSalary - salaryPart), vacation: debtVacation };
  const perWeek = overtimePerWeek(extra);

  return {
    cfg,
    year: wage.year,
    wage,
    noContract,
    split,
    others,
    time,
    pay,
    /** gross → net for this offer's figures (without payroll, the worker's Social Security alone) */
    netFactor: pay.netFactor > 0 ? pay.netFactor : 1 - cfg.ssPct / 100,
    cash: { total: cash, share: cashShare, allCash, grossEq: cashGrossEq },
    inKind: { housing, food, total: housing + food },
    car,
    expenses: { car: car.cost, other: otherExpenses, total: car.cost + otherExpenses },
    earnings: {
      parts,
      total,
      perHour: hours > 0 ? total / hours : 0,
      perDay: daysWorked > 0 ? total / daysWorked : 0,
      perMonth: perMonth(total),
      /** money that reaches you: payroll, vacation, cash and km */
      received: parts.base + parts.extraPays + parts.vacationPay + parts.b + parts.km,
    },
    unemployment: {
      contribDays,
      days: benefit.days,
      euros: benefit.euros,
      /** without a contract: the benefit the cash would have generated */
      lost: noContract ? unemploymentBenefit(coveredByCash, noDuration ? DAYS_PER_MONTH : natDays) : null,
    },
    employer: {
      ss: (pay.gross * cfg.ssEmp) / 100,
      severance,
      cost: pay.gross * employerRate + cash + housing + food + car.kmPaid + severance,
    },
    min,
    debt: { salary: debtSalary, vacation: debtVacation, total: debtTotal, parts: debtParts, owed, minNetNoContract },
    rest: { legal: restLegal, short: Math.max(0, restLegal - time.daysOffTotal) },
    extra: {
      ...extra,
      dayValue,
      daysValue,
      daysUnpaid,
      overtimeValue,
      overtimeUnpaid,
      /** unpaid extra days, as days */
      daysUnpaidCount: dayValue > 0 ? daysUnpaid / dayValue : 0,
      overtimePerWeek: perWeek,
      overtimeUnpaidPerWeek: overtimeValue > 0 ? (perWeek * overtimeUnpaid) / overtimeValue : 0,
      over40PerWeek: hoursWeek(extra).over,
    },
    /** days worked, due and extra, rounded so the subtraction adds up on screen */
    extraDays: extraDaysRounded(time, extra),
    savings,
    stamp: noContract
      ? { code: 'noContract' }
      : allCash
        ? { code: 'allCash' }
        : debtParts.salary > 1
          ? { code: 'belowMinimum' }
          : debtParts.overnight > 1
            ? { code: 'noOvernight' }
            : null,
  };
}
