/** Money: the payroll, the legal minimum, how an agreed total is split, and the car. */

import { num } from '../format.js';
import { LAW, ssOf } from '../law.js';
import { DAYS_PER_MONTH, fromTotal } from '../offer.js';
import { bisect, irpfAdded } from './tax.js';

/**
 * The legal minimum, counted by months (what the paperwork shows): salary (the casual-worker daily minimum for short
 * temporary contracts), overnight bonus and the vacation you do not take.
 * @param {object} terms the offer's terms
 * @param {object} ctx `{wage}`: the minimum wage of the offer's year
 * @param {ReturnType<import('./time.js').schedule>} time
 */
export function legalMinimum(terms, { wage }, time) {
  const { noDuration, months, hoursPerDay, workFrac, natDays, vacationDays, daysWorked } = time;
  const partTime = Math.min(1, (workFrac * 7 * hoursPerDay) / LAW.weeklyHours);
  const casual = !noDuration && terms.contract === 'temporary' && natDays <= LAW.casualMaxDays;
  const salary = casual
    ? wage.casual * daysWorked * Math.min(1, hoursPerDay / LAW.workdayHours)
    : ((wage.annual * months) / 12) * partTime;
  const vacation =
    casual || terms.vacation !== 'taken' ? vacationDays * (wage.annual / LAW.smiDaysPerYear) * partTime : 0;
  const overnightRate = terms.overnight === 'yes' ? LAW.overnightPct / 100 : 0;
  const overnight = overnightRate * salary;
  return {
    casual,
    salary,
    overnight,
    vacation,
    total: salary + overnight + vacation,
    overnightRate,
    hourly: wage.annual / LAW.annualHours,
  };
}

/**
 * The payroll: gross (if you are told the net, the gross that gives it), Social Security and IRPF.
 * @param {object} terms the offer's terms
 * @param {object} mine the offer's own figures (IRPF choice)
 * @param {object} ctx `{cfg, wage, irpfShares}`
 * @param {ReturnType<import('./time.js').schedule>} time
 */
export function payroll(terms, mine, { cfg, wage, irpfShares }, time) {
  const amount = num(terms.payAmount);
  // «Total»: on payroll over the whole contract (without a duration, one month). Per day: the daily wage is also paid on
  // the vacation and public holidays you take off (paid days, ET art. 37.2 and 38); in cash, only the days you work.
  const monthly =
    terms.payUnit === 'day'
      ? amount * DAYS_PER_MONTH * time.workFrac
      : terms.payUnit === 'month'
        ? amount
        : terms.payUnit === 'total'
          ? time.noDuration
            ? amount
            : time.months > 0
              ? amount / time.months
              : 0
          : amount / 12;
  // Per day: the daily wage for each paid day. With a date, months are counted as on the payslip and do not have
  // 30.4 days: multiplying by months would inflate or shrink the pay.
  let base = terms.payUnit === 'day' ? amount * time.workFrac * time.natDays : monthly * time.months;
  let extraPays =
    terms.extraPays === 'separate' && !['year', 'total'].includes(terms.payUnit) ? (monthly * 2 * time.months) / 12 : 0;
  // A vacation day: the month's salary divided by 30, as payslips do; never below a day at the minimum wage, which
  // would invent a debt (it is the page's estimate, not your data)
  const partTime = Math.min(1, (time.workFrac * 7 * time.hoursPerDay) / LAW.weeklyHours);
  const vacationDay = Math.max(monthly / 30, (wage.annual / LAW.smiDaysPerYear) * partTime);
  // vacationGross: with «the minimum on payroll», the legal-minimum vacation
  let vacationPay =
    terms.vacation === 'paidAtEnd'
      ? terms.vacationGross != null
        ? terms.vacationGross
        : time.vacationDays * vacationDay
      : 0;
  // «Included in the daily wage»: the agreed pay already contains the vacation. It is split into salary and vacation
  // (a vacation day, as above, from the salary left); the total does not change.
  if (terms.vacation === 'included' && base > 0 && time.months > 0) {
    const day = 1 / 30;
    const monthlyLeft = base / (time.months + time.vacationDays * day);
    vacationPay = time.vacationDays * monthlyLeft * day;
    base = monthlyLeft * time.months;
  }
  // IRPF withheld: yours if you set it; otherwise what matches your yearly income, and at least the minimum for casual
  // farm workers in temporary contracts. The net is what reaches your account. What the tax return settles is apart.
  const rates = ssOf(terms.contract);
  const manual = mine.irpfMode === 'manual';
  const irpfYearOf = (gross) =>
    manual ? (gross * num(mine.irpfManual)) / 100 : irpfAdded(gross, cfg, irpfShares, rates.workerPct);
  const withholdingOf = (gross) =>
    manual
      ? irpfYearOf(gross)
      : Math.max(irpfYearOf(gross), terms.contract === 'temporary' ? (gross * LAW.irpf.withholding) / 100 : 0);
  const netOf = (gross) => gross - (gross * rates.workerPct) / 100 - withholdingOf(gross);
  let gross = base + extraPays + vacationPay;
  let ratio = 1;
  if (terms.payType === 'net' && gross > 0) {
    const net = gross;
    gross = bisect(netOf, net, net, net * 3, 60);
    ratio = gross / net;
    base *= ratio;
    extraPays *= ratio;
    vacationPay *= ratio;
  }
  const ss = (gross * rates.workerPct) / 100;
  const irpf = withholdingOf(gross);
  const net = gross - ss - irpf;
  const netFactor = gross > 0 ? net / gross : 0;
  return {
    base,
    extraPays,
    vacationPay,
    salary: base + extraPays,
    gross,
    ss,
    rates,
    irpf,
    irpfPct: gross > 0 ? irpf / gross : 0,
    irpfYear: irpfYearOf(gross),
    net,
    netFactor,
    netOf,
    /** The amount as entered, in gross and in net. */
    entered: { gross: amount * ratio, net: amount * ratio * netFactor },
  };
}

/**
 * The offer as it is calculated.
 * · «Usar el salario mínimo»: the payroll is the applicable minimum wage, with the vacation you do not take paid at the minimum.
 * · «Total pactado»: the cash part is the agreed total (payroll, vacation and cash together) minus what reaches you on
 *   payroll, net. If the total does not even reach that, nothing is left in cash. `split` explains that subtraction.
 * @returns {{terms: object, split: object | null}}
 */
export function effectiveOffer(terms, mine, ctx, schedule) {
  if (terms.contract === 'none' || (!terms.payrollMin && !fromTotal(terms))) return { terms, split: null };
  const time = schedule(terms);
  const min = legalMinimum(terms, ctx, time);
  let x = terms;
  // Legally, vacation «included in the agreed pay» shows on the payslip as a separate item
  const included = terms.vacation === 'included';
  if (fromTotal(terms) && included) x = { ...x, vacation: 'paidAtEnd' };
  if (terms.payrollMin)
    x = {
      ...x,
      vacation: x.vacation === 'included' ? 'paidAtEnd' : x.vacation,
      payType: 'gross',
      payAmount: min.salary,
      payUnit: 'total',
      extraPays: 'included',
      vacationGross: min.vacation,
    };
  if (!fromTotal(terms)) return { terms: x, split: null };
  const pay = payroll(x, mine, ctx, time);
  const vacationNet = pay.vacationPay * pay.netFactor;
  const payrollNet = pay.net - vacationNet;
  const agreed = num(terms.totalAmount);
  const unit = terms.totalUnit;
  const agreedTotal = unit === 'day' ? agreed * time.daysWorked : unit === 'month' ? agreed * time.months : agreed;
  // Vacation paid apart is extra money and not taken from the total; included, it is (and the cash part drops)
  const fromAgreed = included ? pay.net : payrollNet;
  const cash = Math.max(0, agreedTotal - fromAgreed);
  const per = unit === 'day' ? time.daysWorked : unit === 'month' ? time.months : 1;
  const perUnit = (v) => (per > 0 ? v / per : 0);
  return {
    terms: { ...x, cashAmount: cash, cashUnit: 'total' },
    split: {
      unit,
      agreed,
      included,
      shortfall: agreed > 0 && agreedTotal < fromAgreed - 0.5,
      net: perUnit(pay.net),
      payrollNet: perUnit(payrollNet),
      vacationNet: perUnit(vacationNet),
      cash: perUnit(cash),
      cashTotal: cash,
    },
  };
}

/** The car: trips, km and their cost, and the km the employer pays. */
export function travel(terms, mine, time, cfg) {
  // Work trips only: every day, or up at the start and down at the end if you live there, plus the trips home
  const trips = mine.car === 'noCar' ? 0 : mine.commute === 'daily' ? time.daysWorked : 0;
  const tripsTotal =
    trips +
    (mine.car !== 'noCar' && mine.commute !== 'daily'
      ? (time.noDuration ? 0 : 1) + num(mine.tripsHome) * time.months
      : 0);
  const kmTrips = num(mine.kmHome) * 2 * tripsTotal;
  const kmWork = mine.car === 'own' ? num(mine.kmWorkPerDay) * time.daysWorked : 0;
  const costPerKm = (num(cfg.fuelUse) / 100) * num(cfg.fuelPrice) + num(cfg.wear);
  return { trips, km: kmTrips + kmWork, cost: (kmTrips + kmWork) * costPerKm, kmPaid: kmWork * num(terms.kmRate) };
}
