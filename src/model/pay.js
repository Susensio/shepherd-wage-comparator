/** Money: the payroll, the legal minimum, how an agreed total is split, and the car. */

import { num } from '../format.js';
import { LAW } from '../law.js';
import { DAYS_PER_MONTH, fromTotal } from '../offer.js';
import { bisect, irpfAdded } from './tax.js';

/**
 * The legal minimum, counted by months (what the paperwork shows): salary (the casual-worker daily minimum for short
 * temporary contracts), overnight bonus and the vacation you do not take.
 * @param {object} o the offer
 * @param {object} ctx `{cfg, wage}`: settings and the minimum wage of the offer's year
 * @param {ReturnType<import('./time.js').schedule>} time
 */
export function legalMinimum(o, { cfg, wage }, time) {
  const { noDuration, months, hoursPerDay, workFrac, natDays, vacationDays, daysWorked } = time;
  const partTime = Math.min(1, (workFrac * 7 * hoursPerDay) / LAW.weeklyHours);
  const casual = !noDuration && o.contract === 'temporary' && natDays <= LAW.casualMaxDays;
  const salary = casual
    ? wage.casual * daysWorked * Math.min(1, hoursPerDay / LAW.workdayHours)
    : ((wage.annual * months) / 12) * partTime;
  const vacation = casual || o.vacation !== 'taken' ? vacationDays * (wage.annual / LAW.smiDaysPerYear) * partTime : 0;
  const overnightRate = o.overnight === 'yes' ? cfg.overnightPct / 100 : 0;
  const overnight = overnightRate * salary;
  return {
    casual,
    salary,
    overnight,
    vacation,
    total: salary + overnight + vacation,
    overnightRate,
    hourly: wage.annual / cfg.annualHours,
  };
}

/**
 * The payroll: gross (if you are told the net, the gross that gives it), Social Security and IRPF.
 * @param {object} o the offer
 * @param {object} ctx `{cfg, wage, irpfShares}`
 * @param {ReturnType<import('./time.js').schedule>} time
 */
export function payroll(o, { cfg, wage, irpfShares }, time) {
  const amount = num(o.payAmount);
  // «Total»: on payroll over the whole contract (without a duration, one month). Per day: the daily wage is also paid on
  // the vacation and public holidays you take off (paid days, ET art. 37.2 and 38); in cash, only the days you work.
  const monthly =
    o.payUnit === 'day'
      ? amount * DAYS_PER_MONTH * time.workFrac
      : o.payUnit === 'month'
        ? amount
        : o.payUnit === 'total'
          ? time.noDuration
            ? amount
            : time.months > 0
              ? amount / time.months
              : 0
          : amount / 12;
  // Per day: the daily wage for each paid day. With a date, months are counted as on the payslip and do not have
  // 30.4 days: multiplying by months would inflate or shrink the pay.
  let base = o.payUnit === 'day' ? amount * time.workFrac * time.natDays : monthly * time.months;
  let extraPays =
    o.extraPays === 'separate' && !['year', 'total'].includes(o.payUnit) ? (monthly * 2 * time.months) / 12 : 0;
  // A vacation day: the month's salary divided by 30, as payslips do; never below a day at the minimum wage, which
  // would invent a debt (it is the page's estimate, not your data)
  const partTime = Math.min(1, (time.workFrac * 7 * time.hoursPerDay) / LAW.weeklyHours);
  const vacationDay = Math.max(monthly / 30, (wage.annual / LAW.smiDaysPerYear) * partTime);
  // vacationGross: with «the minimum on payroll», the legal-minimum vacation
  let vacationPay =
    o.vacation === 'paidAtEnd' ? (o.vacationGross != null ? o.vacationGross : time.vacationDays * vacationDay) : 0;
  // «Included in the daily wage»: the agreed pay already contains the vacation. It is split into salary and vacation
  // (a vacation day, as above, from the salary left); the total does not change.
  if (o.vacation === 'included' && base > 0 && time.months > 0) {
    const day = 1 / 30;
    const monthlyLeft = base / (time.months + time.vacationDays * day);
    vacationPay = time.vacationDays * monthlyLeft * day;
    base = monthlyLeft * time.months;
  }
  // IRPF withheld: yours if you set it; otherwise what matches your yearly income, and at least the minimum for casual
  // farm workers in temporary contracts. The net is what reaches your account. What the tax return settles is apart.
  const manual = o.irpfMode === 'manual';
  const irpfYearOf = (gross) => (manual ? (gross * num(o.irpfManual)) / 100 : irpfAdded(gross, cfg, irpfShares));
  const withholdingOf = (gross) =>
    manual
      ? irpfYearOf(gross)
      : Math.max(irpfYearOf(gross), o.contract === 'temporary' ? (gross * LAW.irpf.withholding) / 100 : 0);
  const netOf = (gross) => gross - (gross * cfg.ssPct) / 100 - withholdingOf(gross);
  let gross = base + extraPays + vacationPay;
  let ratio = 1;
  if (o.payType === 'net' && gross > 0) {
    const net = gross;
    gross = bisect(netOf, net, net, net * 3, 60);
    ratio = gross / net;
    base *= ratio;
    extraPays *= ratio;
    vacationPay *= ratio;
  }
  const ss = (gross * cfg.ssPct) / 100;
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
 * @returns {{offer: object, split: object | null}}
 */
export function effectiveOffer(o, ctx, schedule) {
  if (o.contract === 'none' || (!o.payrollMin && !fromTotal(o))) return { offer: o, split: null };
  const time = schedule(o, ctx.cfg);
  const min = legalMinimum(o, ctx, time);
  let x = o;
  // Legally, vacation «included in the agreed pay» shows on the payslip as a separate item
  const included = o.vacation === 'included';
  if (fromTotal(o) && included) x = { ...x, vacation: 'paidAtEnd' };
  if (o.payrollMin)
    x = {
      ...x,
      vacation: x.vacation === 'included' ? 'paidAtEnd' : x.vacation,
      payType: 'gross',
      payAmount: min.salary,
      payUnit: 'total',
      extraPays: 'included',
      vacationGross: min.vacation,
    };
  if (!fromTotal(o)) return { offer: x, split: null };
  const pay = payroll(x, ctx, time);
  const vacationNet = pay.vacationPay * pay.netFactor;
  const payrollNet = pay.net - vacationNet;
  const agreed = num(o.totalAmount);
  const unit = o.totalUnit;
  const agreedTotal = unit === 'day' ? agreed * time.daysWorked : unit === 'month' ? agreed * time.months : agreed;
  // Vacation paid apart is extra money and not taken from the total; included, it is (and the cash part drops)
  const fromAgreed = included ? pay.net : payrollNet;
  const cash = Math.max(0, agreedTotal - fromAgreed);
  const per = unit === 'day' ? time.daysWorked : unit === 'month' ? time.months : 1;
  const perUnit = (v) => (per > 0 ? v / per : 0);
  return {
    offer: { ...x, cashAmount: cash, cashUnit: 'total' },
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
export function travel(o, time, cfg) {
  // Work trips only: every day, or up at the start and down at the end if you live there, plus the trips home
  const trips = o.car === 'noCar' ? 0 : o.commute === 'daily' ? time.daysWorked : 0;
  const tripsTotal =
    trips +
    (o.car !== 'noCar' && o.commute !== 'daily' ? (time.noDuration ? 0 : 1) + num(o.tripsHome) * time.months : 0);
  const kmTrips = num(o.kmHome) * 2 * tripsTotal;
  const kmWork = o.car === 'own' ? num(o.kmWorkPerDay) * time.daysWorked : 0;
  const costPerKm = (num(cfg.fuelUse) / 100) * num(cfg.fuelPrice) + num(cfg.wear);
  return { trips, km: kmTrips + kmWork, cost: (kmTrips + kmWork) * costPerKm, kmPaid: kmWork * num(o.kmRate) };
}
