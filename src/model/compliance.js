/**
 * Whether the law was kept, from what the record holds and not from what the offer promised (ADR-0032): the weekly
 * rest from the days marked off, the days worked against those due, and the overnight bonus against what was cobrado.
 * Only the model's own definitions and `law.js` figures. What the record cannot support is said, not guessed. No DOM.
 */

import { LAW } from '../law.js';
import { cents } from '../ledger.js';
import { spanOf } from './accounts.js';
import { marksOf } from './record.js';

/** What the record cannot say: festivos need a list of holidays per municipality and year; the minimum wage needs the payslip's gross, which is not recorded. */
export const CANNOT_CHECK = /** @type {const} */ (['festivos', 'salarioMinimo']);

/**
 * @param {{ terms: object }} offer
 * @param {import('./settle.js').OfferRecord} record
 * @param {ReturnType<typeof import('./settle.js').settle>} settled
 * @param {{ extra: { due: number }, min: { overnight: number }, netFactor: number }} r the offer's figures
 * @param {number} cobros how many cobros the record holds: without any, nothing can be said of what was paid
 */
export function lawFromRecord(offer, record, settled, r, cobros) {
  const days = settled.rows.flatMap((row) => marksOf(offer, record, spanOf(row)));

  // Rest: at least LAW.weeklyRest days a week, which can be grouped over LAW.restPeriodWeeks weeks
  const length = LAW.restPeriodWeeks * 7;
  /** @type {{ from: string, to: string, off: number, due: number }[]} */
  const fails = [];
  let periods = 0;
  for (let i = 0; i < days.length; i += length) {
    const part = days.slice(i, i + length);
    const off = part.filter((x) => x.kind === 'off').length;
    const due = Math.ceil((LAW.weeklyRest * part.length) / 7);
    periods++;
    if (off < due) fails.push({ from: part[0].date, to: part.at(-1).date, off, due });
  }

  // Days worked against those due once rest, holidays and vacation taken are off: the model's `extra.due`
  const worked = days.filter((x) => x.kind === 'work').length;
  const due = r.extra.due;
  const extra = Math.max(0, worked - due);

  // The overnight bonus: due by the offer's agreement or the law, and covered by what arrived or not
  const overnight = settled.totals.items.overnight;
  const applicable = r.min.overnight > 0;
  return {
    rest: { periods, fails },
    days: { worked, due, extra },
    overnight: {
      applicable,
      /** Without cobros nothing is known of what was paid. */
      known: cobros > 0,
      /** What the bonus comes to, and what of it was not covered, in net. */
      due: cents(overnight.due * r.netFactor),
      missing: cents(overnight.owed * r.netFactor),
    },
  };
}
