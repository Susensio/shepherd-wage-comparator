/**
 * What the «Expediente» holds (ADR-0034), worked out from the record: the calendar of each month, the cobros, and what
 * corresponds, was cobrado and is missing, in net and in gross, adding up to the Cuentas tiles. No DOM.
 */

import { spreadTo, sum } from '../ledger.js';
import { spanOf } from './accounts.js';
import { marksOf } from './record.js';
import { ITEMS, netOfRow } from './settle.js';

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
  // Net, in whole euros as the tiles show them: Corresponde and Falta are spread over the months to add up to the
  // figures of the tiles, and what was received is what is left of each month, so every row and column adds up
  const dueTotal = Math.round(standing.corresponde);
  const owedTotal = Math.round(standing.falta);
  const due = spreadTo(
    rows.map((row) => netOfRow(row, 'due', netFactor)),
    dueTotal,
    1,
  );
  const owed = spreadTo(
    rows.map((row) => netOfRow(row, 'owed', netFactor)),
    owedTotal,
    1,
  );
  const months = rows.map((row, i) => ({
    month: row.month,
    closed: row.closed,
    closedAt: record.months?.[row.month]?.closedAt ?? null,
    marks: marksOf(o, record, spanOf(row), { from: row.jobFrom, to: row.jobTo }),
    net: { due: due[i], received: due[i] - owed[i], owed: owed[i] },
    gross: { due: row.due, received: row.received, owed: row.owed },
  }));
  return {
    job: settled.job,
    months,
    totals: {
      net: {
        due: dueTotal,
        received: dueTotal - owedTotal,
        owed: owedTotal,
        /** Cobrado beyond what corresponds, whole: rows show only what covers it. */
        extra: Math.round(standing.sobra),
      },
      gross: { due: settled.totals.due, received: settled.totals.received, owed: settled.totals.owed },
    },
    /** Corresponde by item in net (with «En negro» as its own), adding up to the tile. */
    lines: standing.lines.map((l, i) => ({
      ...l,
      due: spreadTo(
        standing.lines.map((x) => x.due),
        dueTotal,
        1,
      )[i],
    })),
    /** The items in gross, as `settle` has them. */
    items: ITEMS.map((item) => ({ item, ...pick(settled.totals.items[item]) })),
    payments: [...(record.payments ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    unclosed: rows.filter((row) => !row.closed).map((row) => row.month),
    cash: sum((record.payments ?? []).filter((p) => p.via === 'cash').map((p) => p.amount)),
  };
}

const pick = (/** @type {Record<string, number>} */ x) => ({ due: x.due, received: x.received, owed: x.owed });
