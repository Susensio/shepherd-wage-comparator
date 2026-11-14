/**
 * What the «Expediente» holds (ADR-0034), worked out from the record: the calendar of each month, the cobros, and what
 * corresponds, was cobrado and is missing, in net and in gross, adding up to the Cuentas tiles. No DOM.
 */

import { cents, spreadTo, sum } from '../ledger.js';
import { spanOf } from './accounts.js';
import { marksOf } from './record.js';
import { ITEMS } from './settle.js';

/**
 * @param {object} c
 * @param {any} c.o
 * @param {number} c.netFactor
 * @param {ReturnType<typeof import('./settle.js').settle>} c.settled
 * @param {ReturnType<typeof import('./accounts.js').standingOf>} c.standing
 * @param {import('./settle.js').OfferRecord} c.record
 */
export function dossierOf({ o, netFactor, settled, standing, record }) {
  const rows = settled.rows.filter((row) => row.days > 0);
  // Net per month: what was received and what is missing are spread to the totals under the tiles, and Corresponde is
  // their sum, so every row and every column adds up (a month never shows less than nothing received)
  const covered = cents(standing.corresponde - standing.falta);
  const received = spreadTo(
    rows.map((row) => row.received * netFactor),
    covered,
  );
  const owed = spreadTo(
    rows.map((row) => row.owed * netFactor),
    standing.falta,
  );
  const months = rows.map((row, i) => ({
    month: row.month,
    closed: row.closed,
    closedAt: record.months?.[row.month]?.closedAt ?? null,
    marks: marksOf(o, record, spanOf(row), { from: row.jobFrom, to: row.jobTo }),
    net: { due: cents(received[i] + owed[i]), received: received[i], owed: owed[i] },
    gross: { due: row.due, received: row.received, owed: row.owed },
  }));
  return {
    months,
    totals: {
      net: {
        due: standing.corresponde,
        received: standing.cobrado,
        owed: standing.falta,
        /** Cobrado beyond what corresponds: rows show only what covers it. */
        extra: standing.sobra,
      },
      gross: { due: settled.totals.due, received: settled.totals.received, owed: settled.totals.owed },
    },
    /** Corresponde by item in net (with «En negro» as its own), adding up to the tile. */
    lines: standing.lines,
    /** The items in gross, as `settle` has them. */
    items: ITEMS.map((item) => ({ item, ...pick(settled.totals.items[item]) })),
    payments: [...(record.payments ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    unclosed: rows.filter((row) => !row.closed).map((row) => row.month),
    cash: sum((record.payments ?? []).filter((p) => p.via === 'cash').map((p) => p.amount)),
  };
}

const pick = (/** @type {Record<string, number>} */ x) => ({ due: x.due, received: x.received, owed: x.owed });
