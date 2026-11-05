/**
 * calc(): every figure of an offer, grouped by subject. Money is in € over the whole contract, gross, unless the name
 * says otherwise. No DOM here.
 */

import { isWorthCounting, num } from '../format.js';
import { LAW, minWageOf } from '../law.js';
import { extraDaysRounded } from '../ledger.js';
import {
  actualYear,
  DAYS_PER_MONTH,
  daysInclusive,
  endOf,
  foodPerDay,
  isComplete,
  rentPerMonth,
  spanOf,
  termsOnly,
  vacationPaid,
  workedOffers,
} from '../offer.js';
import { effectiveOffer, legalMinimum, payroll, travel } from './pay.js';
import { selfEmployed } from './self-employed.js';
import { bisect, unemploymentBenefit } from './tax.js';
import { extraTime, hoursWeek, overtimePerWeek, schedule } from './time.js';

/** Which share of an offer falls in each year, by days: {2025: 0.4, 2026: 0.6}. Without dates, all in its year. */
export function yearShares(terms) {
  if (!terms.start || !endOf(terms)) return { [actualYear(terms)]: 1 };
  const [start, end] = spanOf(terms);
  const days = daysInclusive(start, end);
  const shares = {};
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    const from = Math.max(+start, +new Date(y, 0, 1));
    const to = Math.min(+end, +new Date(y, 11, 31));
    if (to >= from) shares[y] = daysInclusive(from, to) / days;
  }
  return shares;
}

/**
 * For IRPF: for each year the offer touches, its share of the gross and what your other worked offers earn on payroll
 * that year (also split by days). The others are calculated on their own, to avoid going round in circles.
 */
function othersInYear(offer, { cfg, offers }) {
  const shares = yearShares(offer.terms);
  const others = offer.terms.start
    ? workedOffers(offers)
        .filter((p) => p.id !== offer.id && isComplete(p.terms))
        .map((p) => ({ gross: calc(p, { cfg, offers, alone: true }).pay.gross, shares: yearShares(p.terms) }))
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
  const { mine } = offer;
  const wage = minWageOf(actualYear(offer.terms));
  const others = alone
    ? { shares: [{ share: 1, others: 0, deduction: wage.ded }], gross: 0, count: 0, years: [String(wage.year)] }
    : othersInYear(offer, { cfg, offers });
  const ctx = { cfg, wage, irpfShares: others.shares };

  // Without a contract there is no payroll and no paid vacation: everything is cash, against a temporary contract's minimum.
  // Self-employed, neither: the invoice is apart (`selfEmployed`), and labour law's debts do not apply (ADR-0029).
  const { terms: effective, split } = effectiveOffer(offer.terms, mine, ctx, schedule);
  const noContract = effective.contract === 'none';
  const isSelfEmployed = effective.contract === 'selfEmployed';
  const t =
    noContract || isSelfEmployed
      ? {
          ...effective,
          payAmount: 0,
          ...(isSelfEmployed ? { cashAmount: 0 } : {}),
          vacation: 'included',
          extraPays: 'included',
          contract: 'temporary',
        }
      : effective;

  const time = schedule(t);
  const se = isSelfEmployed ? selfEmployed(effective, time, ctx) : null;
  const pay = payroll(t, mine, ctx, time);
  const car = travel(t, mine, time, cfg);
  const min = legalMinimum(t, ctx, time);
  const { months, natDays, daysWorked, hours, noDuration } = time;

  // Cash, housing and food, expenses
  const cashAmount = num(t.cashAmount);
  const cash =
    t.cashUnit === 'month' ? cashAmount * months : t.cashUnit === 'day' ? cashAmount * daysWorked : cashAmount;
  const housing = cfg.inKind && t.housing === 'yes' ? rentPerMonth(mine, cfg) * months : 0;
  const food = cfg.inKind ? foodPerDay(t, cfg) * daysWorked : 0;
  const otherExpenses = num(mine.expenses) * months;

  // Unemployment benefit you generate; and the gross that would bring the cash part net, on payroll
  const contribDays = pay.gross > 0 ? natDays + (vacationPaid(t) ? time.vacationDays : 0) : 0;
  const benefit = unemploymentBenefit(pay.gross, contribDays);
  const netPayroll = pay.netOf(pay.gross);
  const cashGrossEq = cash > 0 ? bisect((x) => pay.netOf(pay.gross + x) - netPayroll, cash, cash, cash * 3, 50) : 0;

  // The benefit that payroll plus the cash's gross equivalent would give, minus the one generated (zero at the maximum)
  const lostDays = contribDays > 0 ? contribDays : noDuration ? DAYS_PER_MONTH : natDays;
  const withCash = unemploymentBenefit(pay.gross + cashGrossEq, lostDays);
  const lostBenefit = {
    days: Math.max(0, withCash.days - benefit.days),
    euros: Math.max(0, withCash.euros - benefit.euros),
  };

  const employerRate = 1 + pay.rates.employerPct / 100;
  const salaryPerDay = natDays > 0 ? pay.salary / natDays : 0;
  const severance =
    !noDuration && t.contract === 'temporary' ? (salaryPerDay * LAW.severanceDaysPerYear * natDays) / 365 : 0;

  // What you earn: money only. The unemployment benefit you generate is apart (`unemployment`), ADR-0022
  const parts = {
    base: pay.base * pay.netFactor,
    extraPays: pay.extraPays * pay.netFactor,
    vacationPay: pay.vacationPay * pay.netFactor,
    b: cash,
    housing,
    food,
    km: car.kmPaid,
    severance,
    invoice: se ? se.invoiced : 0,
  };
  const deductions = se ? se.quota + se.irpf : 0;
  const total = Object.values(parts).reduce((sum, x) => sum + x, 0) - (car.cost + otherExpenses + deductions);
  const perMonth = (x) => (months > 0 ? x / months : 0);

  // What you are owed, counted by months: what is missing in each item separately (a surplus in one does not cover another)
  let debtSalary = se ? 0 : Math.max(0, min.salary + min.overnight - pay.salary);
  let debtVacation = se || t.vacation === 'taken' ? 0 : Math.max(0, min.vacation - pay.vacationPay);
  let minNetNoContract = 0;
  if (noContract) {
    // What you are paid in cash against the minimum wage with bonus, through the same net↔gross factor as the rest
    const factor = pay.netFactor > 0 ? pay.netFactor : 1 - pay.rates.workerPct / 100;
    const minSalary = min.salary + min.overnight;
    minNetNoContract = minSalary * factor;
    debtSalary = Math.max(0, minSalary - cash / factor);
    debtVacation = min.vacation;
  }
  const debtTotal = debtSalary + debtVacation;
  const coveredByCash = cash > 0 ? cashGrossEq : 0;
  const salaryPart = se
    ? 0
    : noContract
      ? Math.max(0, debtSalary - min.overnight)
      : Math.max(0, min.salary - pay.salary);

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
  // Self-employed: no workdays or overtime are owed; labour law does not apply as such (the warning says why)
  const daysUnpaid = se ? 0 : Math.max(0, daysValue - paidAbove);
  const overtimeUnpaid = se ? 0 : Math.max(0, overtimeValue - Math.max(0, paidAbove - daysValue));

  // What the employer saves at your expense, with their Social Security: their margin to negotiate
  const owed = noContract ? debtTotal : Math.max(0, debtTotal - coveredByCash);
  const cashSavings = cashGrossEq * employerRate - cash;
  const savings = {
    /** contributions on the cash part (on everything, without a contract) */
    cash: isWorthCounting(cashSavings) ? cashSavings : 0,
    /** what is missing from the minimum and cash does not cover */
    minimum: isWorthCounting(owed) ? owed * employerRate : 0,
    days: daysValue > 0 && isWorthCounting(daysUnpaid) ? daysUnpaid * employerRate : 0,
    overtime: overtimeValue > 0 && isWorthCounting(overtimeUnpaid) ? overtimeUnpaid * employerRate : 0,
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
    netFactor: pay.netFactor > 0 ? pay.netFactor : 1 - pay.rates.workerPct / 100,
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
      /** money that reaches you: payroll, vacation, cash, km and what is invoiced */
      received: parts.base + parts.extraPays + parts.vacationPay + parts.b + parts.km + parts.invoice,
    },
    unemployment: {
      contribDays,
      days: benefit.days,
      euros: benefit.euros,
      /** what money paid en negro does not generate: the benefit payroll plus its gross equivalent would give, less this one */
      lost: lostBenefit,
    },
    employer: {
      ss: (pay.gross * pay.rates.employerPct) / 100,
      severance,
      cost: pay.gross * employerRate + cash + housing + food + car.kmPaid + severance + (se ? se.invoiced : 0),
    },
    /** self-employed (autónomo): the invoice, IVA, the RETA quota and IRPF; null on a payroll or without contract */
    selfEmployed: se,
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
    stamp: se
      ? { code: 'selfEmployed' }
      : noContract
        ? { code: 'noContract' }
        : allCash
          ? { code: 'allCash' }
          : isWorthCounting(debtParts.salary)
            ? { code: 'belowMinimum' }
            : isWorthCounting(debtParts.overnight)
              ? { code: 'noOvernight' }
              : null,
  };
}

/**
 * The figures of an offer from its terms alone: neutral own figures, and IRPF as if nothing else was earned that year
 * (no other offers, `others` 0). The rest of the settings (what housing and meals are worth, Social Security,
 * unemployment) are kept: they value the terms, they do not describe the worker's life.
 * @param {object} offer at least `{ id, terms }`
 * @param {{cfg: object}} ctx
 */
export const calcTermsOnly = (offer, { cfg }) => calc(termsOnly(offer), { cfg: { ...cfg, others: 0 }, alone: true });
