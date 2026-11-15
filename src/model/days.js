/** Day counting on ISO dates and «2026-10» month keys: the one place for it. */

import { DAY_MS, daysInclusive, parseDate } from '../offer.js';

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

const KINDS = ['work', 'off', 'sick'];

/**
 * The days a month's record says, in either encoding: per day (`days`, keyed «05») or counted (`count`, ADR-0035).
 * Only days inside `from`..`to` (the job's part of the month) count. A counted month accounts for all of them: what the
 * count leaves out is `off`, and `work` cannot pass the days there are. `touched` is how many days the record decides.
 * @param {{ days?: Record<string, string>, count?: { work?: number, off?: number, sick?: number } } | undefined} entry
 * @param {Date} from
 * @param {Date} to
 * @returns {{ counts: { work: number, off: number, sick: number }, touched: number, counted: boolean }}
 */
export function monthFacts(entry, from, to) {
  const counts = { work: 0, off: 0, sick: 0 };
  if (entry?.count) {
    const span = Math.max(0, daysInclusive(from, to));
    counts.work = Math.min(span, entry.count.work ?? 0);
    counts.sick = Math.min(span - counts.work, entry.count.sick ?? 0);
    counts.off = span - counts.work - counts.sick;
    return { counts, touched: span, counted: true };
  }
  let touched = 0;
  for (const [day, kind] of Object.entries(entry?.days || {})) {
    const date = new Date(from.getFullYear(), from.getMonth(), Number(day));
    if (!KINDS.includes(kind) || date < from || date > to) continue;
    counts[kind]++;
    touched++;
  }
  return { counts, touched, counted: false };
}

/**
 * A job-wide total of days worked spread over the months of the job in proportion to the days each has, whole days, the
 * remainders going to the months with the largest ones; a month never gets more days than it has, and a total above
 * all the days is cut to them. This is how a total entered for the job becomes month counts (ADR-0035).
 * @param {number} total days worked, a whole number from 0
 * @param {{ key: string, days: number }[]} months the days of the job in each month
 * @returns {Record<string, number>} days worked by month key, adding up to the total (cut to the days there are)
 */
export function spreadTotal(total, months) {
  const available = months.reduce((t, m) => t + m.days, 0);
  const goal = Math.max(0, Math.min(Math.round(total), available));
  const shares = months.map((m) => ({ key: m.key, days: m.days, exact: available ? (goal * m.days) / available : 0 }));
  const given = Object.fromEntries(shares.map((x) => [x.key, Math.floor(x.exact)]));
  let left = goal - Object.values(given).reduce((t, n) => t + n, 0);
  const byRemainder = [...shares].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)));
  for (const x of byRemainder) {
    if (left <= 0) break;
    if (given[x.key] >= x.days) continue;
    given[x.key]++;
    left--;
  }
  return given;
}
