/**
 * Ledgers: rows rounded as they are shown, and the «=» row as the sum of those, so every column adds up on screen.
 * No DOM; views only format what comes out of here.
 */

import { fE, num } from './format.js';

/** An amount rounded to cents. */
export const cents = (x) => Math.round(x * 100) / 100;

/** Sum of rounded rows: `plus` minus `minus`, rounded to cents. */
export const sum = (plus, minus = []) =>
  cents(plus.reduce((total, x) => total + x, 0) - minus.reduce((total, x) => total + x, 0));

/** A euro figure as it is written: the amount that is read, so sums of what is shown add up. */
export const shownEuros = (x) => num(fE(x));

/** `first` minus the others, each as it is shown. */
export const shownDiff = (first, ...others) => sum([shownEuros(first)], others.map(shownEuros));

/** A sum of shown figures: cents appear only if one of the figures had them. */
export const fSumE = (total) => {
  const rounded = cents(total);
  return fE(rounded, Number.isInteger(rounded) ? undefined : 2);
};

/**
 * How days are rounded in a ledger of `basis` days: to tenths below 10, whole above. `half` is the smallest figure
 * that does not show as 0.
 */
export function dayRounder(basis) {
  const k = basis < 10 ? 10 : 1;
  return { round: (x) => Math.round(x * k) / k, half: 0.5 / k };
}

/** Days worked, due workdays and extra days, rounded so the subtraction adds up on screen. */
export function extraDaysRounded(time, extra) {
  const { round } = dayRounder(time.daysWorked);
  const worked = round(time.daysWorked);
  const due = round(extra.due);
  return { worked, due, extra: Math.max(0, round(worked - due)) };
}
