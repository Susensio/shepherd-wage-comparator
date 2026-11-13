/**
 * What the screens say of a settled offer (ADR-0032): one month's calendar figures, and where the offer stands today.
 * Built from `settle` and the record; nothing is calculated again. Amounts are gross, as `settle` has them. No DOM.
 */

import { cents, sum } from '../ledger.js';
import { parseDate } from '../offer.js';
import { countsOf, defaultMarks, marksOf } from './record.js';
import { ITEMS, settle } from './settle.js';

const DAY_MS = 864e5;

/**
 * The lines of a ledger, in net: each item's due taken times `netFactor`, and the cash agreed (as handed) taken out of
 * them, salary first, to be a line of its own, «En negro». The lines add up to what the items do.
 * @param {{ item: 'salary' | 'overnight' | 'vacation', due: number, byMinimum?: boolean }[]} grossItems dues in gross
 * @param {number} cash agreed cash, net as handed
 * @param {number} netFactor
 * @returns {{ key: 'salary' | 'overnight' | 'vacation' | 'cash', due: number, byMinimum: boolean }[]}
 */
export function linesOf(grossItems, cash, netFactor) {
  let left = cash;
  const lines = grossItems.map((x) => {
    const net = cents(x.due * netFactor) + 0; // + 0: no -0
    const take = Math.min(left, net);
    left = cents(left - take);
    return { key: x.item, due: cents(net - take), byMinimum: Boolean(x.byMinimum) };
  });
  return [...lines, { key: /** @type {const} */ ('cash'), due: cents(cash - left), byMinimum: false }];
}
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
 * @param {number} netFactor `r.netFactor`: `lines`, `due` and `delta` are in net
 */
export function monthAccounts(offer, record, key, today, ctx, netFactor) {
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
    delta = cents(row.due - base.due) + 0; // + 0: no -0
  }
  const lines = linesOf(
    ITEMS.map((item) => ({ item, due: row.items[item].due })),
    row.agreedCash,
    netFactor,
  );
  return {
    row,
    span,
    marks,
    counts,
    jornadas,
    /** In net: salary, overnight bonus, vacation and «En negro» (the cash agreed), adding up to `due`. */
    lines,
    due: sum(lines.map((x) => x.due)),
    delta: delta === null ? null : cents(delta * netFactor) + 0,
  };
}

/** Salary and overnight bonus of a row, the two that fall due at the month's end. */
const monthlyDue = (row) => sum([row.items.salary.due, row.items.overnight.due]);

/**
 * Where an offer stands, in net: the owner thinks in what reaches the shepherd, so what `settle` has gross is taken
 * times `netFactor`, the factor it uses to gross the cobros up, and the cobros are as they arrived.
 * - `accrued`, `received` and `balance` between them, over the months that have ended (the whole offer once over).
 * - `running`: the current month so far, and `vacation`: what it comes to; both aside, not yet payable.
 * - `lines`: the accrued as ledger lines (salary, overnight bonus, vacation once over, «En negro»), with whether the
 *   minimum is why a line is what it is.
 * - `months`: each month with its state, what it is owed and when its claim lapses.
 * - `unclosed`: the months not closed, among those that have ended.
 * @param {ReturnType<typeof settle>} settled
 * @param {string} today ISO date
 * @param {'underway' | 'finished'} phase
 * @param {import('./settle.js').Payment[]} payments with none, nothing is owed that the shepherd has not said
 * @param {number} netFactor `r.netFactor`
 */
export function standingOf(settled, today, phase, payments, netFactor) {
  const { rows, totals } = settled;
  const net = (gross) => cents(gross * netFactor) + 0; // + 0: no -0
  const finished = phase === 'finished';
  const ended = finished ? rows : rows.filter((row) => row.to < today);
  const current = finished ? undefined : rows.find((row) => row.from <= today && today <= row.to);
  // What has fallen due: every item once over; salary and overnight bonus of the months ended before (the vacation is aside)
  const dueItems = (finished ? ITEMS : ITEMS.filter((item) => item !== 'vacation')).map((item) => ({
    item,
    due: sum(ended.map((row) => row.items[item].due)),
    byMinimum: totals.items[item].shortfall > 0,
  }));
  const lines = linesOf(dueItems, sum(ended.map((row) => row.agreedCash)), netFactor);
  const accrued = sum(lines.map((x) => x.due));
  const received = sum(payments.map((p) => p.amount));
  const elapsed = current ? (daysBetween(current.from, today) + 1) / (daysBetween(current.from, current.to) + 1) : 0;
  return {
    hasPayments: payments.length > 0,
    ended,
    accrued,
    received,
    /** Accrued minus received: negative when more was paid than is due so far. */
    balance: cents(accrued - received),
    cash: totals.cash,
    running: current ? { month: current.month, amount: net(monthlyDue(current) * elapsed) } : null,
    vacation: finished ? 0 : net(sum(rows.map((row) => row.items.vacation.due))),
    lines,
    unclosed: ended.filter((row) => !row.closed),
    belowMinimumOnPayroll: net(totals.belowMinimumOnPayroll),
    months: ended.map((row) => ({
      month: row.month,
      closed: row.closed,
      due: net(row.due),
      owed: net(row.owed),
      deadline: row.deadline,
      lapsed: row.lapsed,
      daysLeft: row.deadline ? daysBetween(today, row.deadline) : null,
    })),
  };
}
