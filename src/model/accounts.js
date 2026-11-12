/**
 * What the screens say of a settled offer (ADR-0032): one month's calendar figures, and where the offer stands today.
 * Built from `settle` and the record; nothing is calculated again. Amounts are gross, as `settle` has them. No DOM.
 */

import { cents, sum } from '../ledger.js';
import { parseDate } from '../offer.js';
import { countsOf, defaultMarks, marksOf } from './record.js';
import { ITEMS, settle } from './settle.js';

const DAY_MS = 864e5;
const daysBetween = (from, to) => Math.round((+parseDate(to) - +parseDate(from)) / DAY_MS);

/** The span of a settled month, as the record's helpers take it. */
export const spanOf = (row) => ({ key: row.month, from: row.from, to: row.to });

/**
 * One month for its calendar: the marks as shown, their counts, the money of the month and, when the jornadas differ
 * from the offer's, what that is worth. Counts decide: a libranza moved to another day is not a difference.
 * @param {{ id?: string, terms: object, mine: object }} offer
 * @param {import('./settle.js').OfferRecord} record
 * @param {string} key «2026-06»
 * @param {string} today ISO date
 * @param {{ cfg: object, offers?: object[] }} ctx
 */
export function monthAccounts(offer, record, key, today, ctx) {
  const row = settle(offer, record, today, ctx).rows.find((x) => x.month === key);
  if (!row) return null;
  const span = spanOf(row);
  const marks = marksOf(offer, record, span);
  const counts = countsOf(marks);
  const offerCounts = countsOf(defaultMarks(offer, span));
  const jornadas = counts.work - offerCounts.work;
  let delta = null;
  if (!row.closed && jornadas !== 0) {
    // Against the offer's days written out, not its averages: one jornada less is worth one jornada
    const asOffer = {
      ...record,
      months: {
        ...record.months,
        [key]: { closed: false, days: Object.fromEntries(defaultMarks(offer, span).map((m) => [m.day, m.kind])) },
      },
    };
    const base = settle(offer, asOffer, today, ctx).rows.find((x) => x.month === key);
    delta = cents(row.due - base.due);
  }
  return { row, span, marks, counts, jornadas, delta };
}

/** Salary and overnight bonus of a row, the two that fall due at the month's end. */
const monthlyDue = (row) => sum([row.items.salary.due, row.items.overnight.due]);

/**
 * Where an offer stands, from `settle`'s result.
 * - `accrued` and `received` (the payments' gross equivalent) and `balance` between them, over the months that have ended
 *   (`through`: the whole offer once it is over).
 * - `running`: the current month so far, and `vacation`: what the vacation comes to; both aside, not yet payable.
 * - `unclosed`: the months a shepherd has not closed, among those that have ended.
 * - `deadlines`: each month with something owed and when its claim lapses.
 * @param {ReturnType<typeof settle>} settled
 * @param {string} today ISO date
 * @param {'underway' | 'finished'} phase
 * @param {number} paymentCount payments in the record: with none, nothing is owed that the shepherd has not said
 */
export function standingOf(settled, today, phase, paymentCount) {
  const { rows, totals } = settled;
  const finished = phase === 'finished';
  const ended = finished ? rows : rows.filter((row) => row.to < today);
  const current = finished ? undefined : rows.find((row) => row.from <= today && today <= row.to);
  const received = cents(totals.received + totals.unassigned);
  const accrued = finished ? totals.due : sum(ended.map(monthlyDue));
  const elapsed = current ? (daysBetween(current.from, today) + 1) / (daysBetween(current.from, current.to) + 1) : 0;
  return {
    hasPayments: paymentCount > 0,
    ended,
    accrued,
    received,
    /** Accrued minus received: negative when more was paid than is due so far. */
    balance: cents(accrued - received),
    cash: totals.cash,
    running: current ? { month: current.month, amount: cents(monthlyDue(current) * elapsed) } : null,
    vacation: finished ? 0 : sum(rows.map((row) => row.items.vacation.due)),
    unclosed: ended.filter((row) => !row.closed),
    /** What is owed per item at the end, with whether the minimum is why the amount is what it is. */
    items: ITEMS.map((item) => ({
      item,
      owed: totals.items[item].owed,
      due: totals.items[item].due,
      byMinimum: totals.items[item].shortfall > 0,
    })),
    owed: totals.owed,
    belowMinimumOnPayroll: totals.belowMinimumOnPayroll,
    deadlines: rows
      .filter((row) => row.owed > 0 && row.deadline)
      .map((row) => ({
        month: row.month,
        owed: row.owed,
        deadline: row.deadline,
        lapsed: row.lapsed,
        daysLeft: daysBetween(today, row.deadline),
      })),
  };
}
