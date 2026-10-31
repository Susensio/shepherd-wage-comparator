/** Time: how long the contract is, which days and hours you work, and which of them are extra. */

import { clamp, num } from '../format.js';
import { LAW } from '../law.js';
import { DAYS_PER_MONTH, endOf, parseDate } from '../offer.js';

/** Days in a normal working week: the week minus the legal weekly rest (5.5). */
export const WORK_DAYS_WEEK = 7 - LAW.weeklyRest;
/** The normal workday: 40 h over 5.5 days (7.27 h). */
export const NORMAL_WORKDAY = LAW.weeklyHours / WORK_DAYS_WEEK;

/** Payroll months of a contract of `days` calendar days from `start`: whole calendar months and the rest at 1/30. */
export function payrollMonths(start, days) {
  const after = new Date(start);
  after.setDate(after.getDate() + Math.round(days)); // the day after the last one
  const monthsLater = (n) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + n);
    return d;
  };
  let n = 0;
  while (monthsLater(n + 1) <= after) n++;
  return n + Math.min(30, Math.round((+after - +monthsLater(n)) / 864e5)) / 30;
}

/**
 * When each payment stops being claimable: `{ from, until }`, the first payment's and the last's, or null without dates.
 * Each payment is claimable `LAW.claimYears` after it was due; the first falls at the end of the first month.
 * @param {object} terms the offer's terms
 */
export function claimDeadlines(terms) {
  const end = endOf(terms);
  if (!terms.start || !end) return null;
  const start = parseDate(terms.start);
  const last = new Date(end);
  const firstPay = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  if (firstPay > last) firstPay.setTime(last.getTime());
  const yearsLater = (d) => {
    const x = new Date(d);
    x.setFullYear(x.getFullYear() + LAW.claimYears);
    return x;
  };
  return { from: yearsLater(firstPay), until: yearsLater(last) };
}

/**
 * Duration, days worked and off, hours.
 * @param {object} terms the offer's terms
 */
export function schedule(terms) {
  const noDuration = terms.durationUnit === 'unknown';
  const days = terms.durationUnit === 'days' ? Math.max(0, num(terms.duration)) : 0;
  // In days and with a start date, months are counted as on the payslip: whole calendar months and the days left over
  // at 1/30 of a month (21 jun – 30 sep: 3 months and 10 days = 3.33). Without a date, with an average month.
  const months = noDuration
    ? 1
    : terms.durationUnit === 'days'
      ? terms.start && days > 0
        ? payrollMonths(parseDate(terms.start), days)
        : days / DAYS_PER_MONTH
      : Math.max(0, num(terms.duration));
  const natDays = terms.durationUnit === 'days' && !noDuration ? days : months * DAYS_PER_MONTH;
  const hoursPerDay = Math.max(0, num(terms.hoursPerDay));
  // Vacation: 2.5 days per month, rounded to whole days, as on payslips (8.33 → 8)
  const vacationDays = Math.round((num(LAW.vacationDaysPerYear) * months) / 12);
  const vacationTaken = terms.vacation === 'taken' ? vacationDays : 0;
  // Share of days you work. «En total»: days off over the whole contract, vacation aside
  const off = Math.max(0, num(terms.daysOff));
  const unit = noDuration && terms.daysOffUnit === 'total' ? 'month' : terms.daysOffUnit;
  const daysLeft = Math.max(0, natDays - vacationTaken);
  const workFrac =
    unit === 'week'
      ? clamp((7 - off) / 7, 0, 1)
      : unit === 'total'
        ? daysLeft > 0
          ? clamp((daysLeft - off) / daysLeft, 0, 1)
          : 0
        : clamp((DAYS_PER_MONTH - off) / DAYS_PER_MONTH, 0, 1);
  // Public holidays taken off, on top of the days off
  const holidaysOff = terms.holidays === 'yes' ? (LAW.holidaysPerYear * months) / 12 : 0;
  // Whole days when there is a duration: days off per month are an average, but nobody works half a day (91.9 → 92)
  const daysExact = Math.max(0, (natDays - vacationTaken - holidaysOff) * workFrac);
  const daysWorked = noDuration ? daysExact : Math.round(daysExact);
  const daysOffTotal = Math.max(0, (natDays - vacationTaken) * (1 - workFrac));
  const perMonth = (x) => (months > 0 ? x / months : 0);
  return {
    noDuration,
    months,
    natDays,
    hoursPerDay,
    workFrac,
    vacationDays,
    vacationTaken,
    daysWorked,
    daysOffTotal,
    daysOffMonth: perMonth(daysOffTotal),
    workedPerMonth: perMonth(daysWorked),
    freeDays: Math.max(0, natDays - daysWorked),
    hoursPerWeek: workFrac * 7 * hoursPerDay,
    hours: daysWorked * hoursPerDay,
  };
}

/**
 * Extra time, with the two rules of the law: at least a day and a half of rest a week (plus public holidays), and 40 h
 * of work a week, spread over those 5.5 days.
 * · Due workdays: the contract's days without the weekly rest, the public holidays or the vacation you take.
 *   Vacation you do not take is due: you work those days, and the vacation money is separate.
 * · Extra days: the days you work above that, each worth a normal workday.
 * · Overtime: what goes over the normal workday, on every day you work (extra days included).
 * Each extra hour counts once: in an extra day or as overtime.
 * @param {ReturnType<typeof schedule>} time
 */
export function extraTime(time) {
  const { months, hoursPerDay, daysWorked, hours } = time;
  const holidays = (LAW.holidaysPerYear * months) / 12;
  const days = Math.max(0, time.natDays - time.vacationTaken);
  const due = Math.max(0, (days * WORK_DAYS_WEEK) / 7 - holidays);
  // Days worked per week, rounded («5 días», not «4,99»), so the bar and the total match
  const daysWeek = days > 0 ? Math.round((daysWorked / (days / 7)) * 10) / 10 : 0;
  // The normal workday: the 40 h over the days you work a week, at least 5.5 (7.3 h) and at most 9 h (ET art. 34.3).
  // With more than a day and a half off, your normal days are longer.
  const workday =
    Math.min(
      hoursPerDay,
      LAW.workdayMaxHours,
      LAW.weeklyHours / (daysWeek > 0 ? Math.min(WORK_DAYS_WEEK, daysWeek) : WORK_DAYS_WEEK),
    ) || NORMAL_WORKDAY;
  const extraDays = Math.max(0, daysWorked - due);
  const overtime = daysWorked * Math.max(0, hoursPerDay - workday);
  const extraHours = extraDays * workday + overtime;
  return {
    due,
    holidays,
    days: extraDays,
    overtime,
    hours: extraHours,
    normalHours: Math.max(0, hours - extraHours),
    workday,
    workDaysWeek: daysWeek || WORK_DAYS_WEEK,
    hoursPerDay,
  };
}

/** The normal workday in a typical week: 40 h over the working days you work (at most 5.5), up to 9 h. */
export const weekWorkday = (extra) =>
  Math.min(
    extra.hoursPerDay,
    LAW.workdayMaxHours,
    LAW.weeklyHours / Math.min(WORK_DAYS_WEEK, extra.workDaysWeek || WORK_DAYS_WEEK),
  );

/** Overtime per week: what goes over the normal workday, on every day you work. */
export const overtimePerWeek = (extra) => extra.workDaysWeek * Math.max(0, extra.hoursPerDay - weekWorkday(extra));

/**
 * A working week in hours: the normal ones (up to 40), the workday of the rest days you work, and what goes beyond.
 * `over` is everything above 40.
 */
export function hoursWeek(extra) {
  const hoursPerDay = extra.hoursPerDay || 0;
  const days = extra.workDaysWeek || 0;
  const workday = weekWorkday(extra);
  const total = days * hoursPerDay;
  const normal = Math.min(days, WORK_DAYS_WEEK) * workday;
  const restDays = Math.max(0, days - WORK_DAYS_WEEK) * workday;
  const beyond = Math.max(0, total - normal - restDays);
  return { days, hoursPerDay, total, normal, restDays, beyond, over: restDays + beyond };
}

/** Days worked, due workdays and extra days, rounded so the subtraction adds up on screen. */
export function extraDaysRounded(time, extra) {
  const k = time.daysWorked < 10 ? 10 : 1;
  const round = (x) => Math.round(x * k) / k;
  const worked = round(time.daysWorked);
  const due = round(extra.due);
  return { worked, due, extra: Math.max(0, round(worked - due)) };
}
