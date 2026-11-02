/**
 * «Lo que te pagan»: the pay questions of the offer form as a view over `terms`. Nothing here is saved on its own:
 * `answersOf` reads the answers out of the fields and `writeAnswers` puts them back (mapping in docs/model.md).
 * Offers saved in a shape the questions cannot say are converted by `toAnswerable`, keeping their figures.
 */

import { num } from './format.js';
import { LAW } from './law.js';
import { calc } from './model/calc.js';
import { schedule } from './model/time.js';
import { DAYS_PER_MONTH, DEF_TERMS } from './offer.js';

/**
 * @typedef {object} Answers
 * @property {'all' | 'min' | 'part' | 'none'} payroll how much goes on the payslip
 * @property {number | string} amount everything together, in `unit` (what reaches the shepherd)
 * @property {'day' | 'month' | 'total'} unit
 * @property {number | string} part with «part»: what goes on the payslip, in `unit`
 * @property {'net' | 'gross'} partType with «part»: whether `part` is net or gross
 */

/** The answers an offer's terms give. For a shape the questions cannot say (`isAnswerable`), the nearest reading. */
export function answersOf(t) {
  const none = { part: '', partType: 'net' };
  if (t.contract === 'none') return { ...none, payroll: 'none', amount: t.cashAmount, unit: t.cashUnit };
  if (t.payrollMin) return { ...none, payroll: 'min', amount: t.totalAmount, unit: t.totalUnit };
  if (t.cashMode === 'total')
    return { payroll: 'part', amount: t.totalAmount, unit: t.totalUnit, part: t.payAmount, partType: t.payType };
  return { ...none, payroll: 'all', amount: t.payAmount, unit: t.payUnit };
}

/** Puts the answers in the terms, each path with its own fields and the others cleared of what would add to it. */
export function writeAnswers(t, { payroll, amount, unit, part, partType }) {
  if (payroll === 'none') {
    Object.assign(t, { contract: 'none', payrollMin: false, cashMode: 'amount', cashAmount: amount, cashUnit: unit });
    return;
  }
  if (t.contract === 'none') t.contract = DEF_TERMS.contract;
  if (payroll === 'min')
    Object.assign(t, { payrollMin: true, cashMode: 'total', totalAmount: amount, totalUnit: unit });
  else if (payroll === 'part')
    Object.assign(t, {
      payrollMin: false,
      cashMode: 'total',
      totalAmount: amount,
      totalUnit: unit,
      payAmount: part,
      payType: partType,
      payUnit: unit,
    });
  else
    Object.assign(t, {
      payrollMin: false,
      cashMode: 'amount',
      cashAmount: '',
      payType: 'net',
      payAmount: amount,
      payUnit: unit,
    });
}

/** «En total» needs a duration to be a total of something. */
const unitFits = (unit, terms) =>
  ['day', 'month'].includes(unit) || (unit === 'total' && terms.durationUnit !== 'unknown');

/** Whether the terms are one of the shapes `writeAnswers` makes (fields the shape does not use may hold anything). */
export function isAnswerable(t) {
  if (t.contract === 'none') return unitFits(t.cashUnit, t);
  if (t.payrollMin) return t.cashMode === 'total' && unitFits(t.totalUnit, t);
  if (t.cashMode === 'total') return t.payUnit === t.totalUnit && unitFits(t.payUnit, t);
  return t.payType === 'net' && !(num(t.cashAmount) > 0) && unitFits(t.payUnit, t);
}

/** Days the contract lasts, 0 if not known. */
const contractDays = (t) =>
  t.durationUnit === 'unknown' ? 0 : t.durationUnit === 'days' ? num(t.duration) : num(t.duration) * DAYS_PER_MONTH;

/** A contract of `LAW.casualMaxDays` days or less: vacation cannot be taken (the minimum per day excludes it). */
export const isCasualLength = (t) => contractDays(t) > 0 && contractDays(t) <= LAW.casualMaxDays;

/** The extra pays can be apart: with a payslip, and a monthly amount (a daily one only if it already says so). */
export const askExtraPays = (t) => {
  const { payroll, unit } = answersOf(t);
  return (
    (payroll === 'all' || payroll === 'part') && (unit === 'month' || (unit === 'day' && t.extraPays === 'separate'))
  );
};

/* --- Converting old shapes --- */

/** The figures a conversion must not change. */
const figures = (r) => [
  r.earnings.total,
  r.earnings.received,
  r.pay.gross,
  r.pay.net,
  r.cash.total,
  r.debt.total,
  r.debt.salary,
  r.debt.vacation,
  r.debt.owed,
];
const sameFigures = (a, b) => a.every((x, i) => Math.abs(x - b[i]) <= 0.01);
const round4 = (x) => Math.round(x * 1e4) / 1e4;

/** Units the questions have: a yearly amount per month; «total» without a duration is a month (the model counts one). */
function withUnitsFitted(t) {
  const noDuration = t.durationUnit === 'unknown';
  const fit = (unit) => (unit === 'total' && noDuration ? 'month' : unit);
  const x = { ...t, payUnit: fit(t.payUnit), totalUnit: fit(t.totalUnit), cashUnit: fit(t.cashUnit) };
  if (x.payUnit === 'year') {
    x.payUnit = 'month';
    x.payAmount = t.payAmount === '' ? '' : num(t.payAmount) / 12;
    x.extraPays = 'included'; // a yearly amount never had extra pays
  }
  return x;
}

/**
 * A payslip amount and an en negro amount become «a part» of a total: the total is what the payslip gives net plus the
 * en negro money, as the model works them out, in the unit of the payslip. The model gives the payslip net per unit.
 */
function withTotal(t, offer, ctx, cashTotal) {
  const unit = t.payrollMin ? (['day', 'month'].includes(t.cashUnit) ? t.cashUnit : 'month') : t.payUnit;
  const probe = { ...t, cashMode: 'total', cashAmount: '', totalUnit: unit, totalAmount: 0, payUnit: unit };
  const { split } = calc({ ...offer, terms: probe }, ctx);
  const time = schedule(probe);
  const per = unit === 'day' ? time.daysWorked : unit === 'month' ? time.months : 1;
  if (!split || !(per > 0)) return null;
  const onPayroll = split.included ? split.net : split.payrollNet;
  return { ...probe, totalAmount: round4(onPayroll + cashTotal / per) };
}

/** A gross payslip with no en negro money, said as the net it gives. */
function withNetPayroll(t, r, unit) {
  if (t.payrollMin || t.payType !== 'gross' || num(t.cashAmount) > 0 || t.payUnit !== unit) return null;
  return { ...t, payType: 'net', payAmount: r.pay.entered.net };
}

/**
 * Brings the offer's terms into a shape the questions can say, if they are not and the figures stay the same within a
 * cent. Returns whether it changed them; an offer no conversion can keep is left as it is.
 * @param {object} offer `{ id, terms, mine }`; its terms are changed
 * @param {{cfg: object, offers: object[]}} ctx as for `calc`
 */
export function toAnswerable(offer, ctx) {
  const { terms } = offer;
  if (isAnswerable(terms)) return false;
  const r = calc(offer, ctx);
  const before = figures(r);
  const fitted = withUnitsFitted(terms);
  const candidates = [
    () => fitted,
    () => (terms.contract === 'none' ? null : withTotal(fitted, offer, ctx, r.cash.total)),
    () => withNetPayroll(fitted, r, terms.payUnit),
  ];
  for (const candidate of candidates) {
    const trial = candidate();
    if (!trial || !isAnswerable(trial)) continue;
    if (!sameFigures(before, figures(calc({ ...offer, terms: trial }, ctx)))) continue;
    Object.assign(terms, trial);
    return true;
  }
  return false;
}
