/** Day counting on ISO dates and «2026-10» month keys: the one place for it. */

import { DAY_MS, parseDate } from '../offer.js';

/** Whole days from one ISO date to another, negative when the second is earlier. */
export const daysBetween = (from, to) => Math.round((+parseDate(to) - +parseDate(from)) / DAY_MS);

/** Days of a calendar month, from its year and month (1 to 12). */
export const monthDays = (year, month) => new Date(year, month, 0).getDate();

const pad2 = (n) => String(n).padStart(2, '0');

/** The span of a whole calendar month «2026-10», as the record's helpers take it. */
export function monthSpan(key) {
  const [y, m] = key.split('-').map(Number);
  return { key, from: `${key}-01`, to: `${key}-${pad2(monthDays(y, m))}` };
}
