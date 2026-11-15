/**
 * What happened in a job, each part defaulting to what was agreed (ADR-0035): the dates, the days of each month and,
 * once «Sí, todo» is answered, the money. One job has two sides, `terms` (agreed) and `mine.record` (happened); the
 * three ways to enter it all come out here: an offer that was worked and recorded, a past job known only by its
 * conditions, and a past job known only by what happened, with thin terms. No DOM.
 */

import { cents, sum } from '../ledger.js';
import { endOf, isoOf } from '../offer.js';
import { standingOf } from './accounts.js';
import { jobEnd, phaseOf } from './phase.js';
import { settle } from './settle.js';

/** @typedef {import('./settle.js').OfferRecord} OfferRecord */

/**
 * @param {{ terms: object, mine: { record: OfferRecord } }} offer
 * @param {string} today ISO date
 * @param {ReturnType<typeof import('./calc.js').calc>} r the offer's figures
 * @param {ReturnType<typeof settle>} [settled] the offer settled with its record, when the caller has it already
 * @returns {null | {
 *   phase: 'underway' | 'finished',
 *   settled: ReturnType<typeof settle>,
 *   standing: ReturnType<typeof standingOf>,
 *   dates: { from: string, to: string, fromSource: 'recorded' | 'agreed', toSource: 'recorded' | 'agreed' },
 *   days: { work: number, sick: number, source: 'agreed' | 'recorded' | 'mixed', months: { month: string, work: number, kept: 'days' | 'count' | 'agreed' }[] },
 *   money: { basis: 'asAgreed' | 'none' | 'cobros' | 'unknown', approx: boolean, due: number, received: number, missing: number, missingByMinimumOnly: boolean },
 * }} null for a job that cannot have happened yet: only an offer, or not started. `dates` and the money are in `settled`'s
 * terms: `due` (Corresponde), `received` (Cobrado) and `missing` (Falta) are net. `days.work` is what was worked: the days
 * recorded plus the offer's pattern for those not. With `basis` `unknown` nothing says what was received: `received` is 0
 * and `missing` all that is due, to be asked, not claimed. `missingByMinimumOnly`: under `asAgreed`, Falta is only what the
 * law's minimum adds to what was agreed.
 */
export function happenedOf(offer, today, r, settled = settle(offer, offer.mine.record, today, r)) {
  const record = offer.mine.record;
  const phase = phaseOf(offer, today, record);
  if (phase !== 'underway' && phase !== 'finished') return null;
  const standing = standingOf(settled, today, phase, record.payments, r.netFactor, record.paid);

  const offerEnd = endOf(/** @type {any} */ (offer.terms));
  const toAgreed = !record.end && jobEnd(offer, record) === (offerEnd ? isoOf(offerEnd) : '');
  /** @returns {'days' | 'count' | 'agreed'} */
  const kept = (month) => {
    const entry = record.months?.[month];
    if (entry?.count) return 'count';
    return Object.keys(entry?.days ?? {}).length ? 'days' : 'agreed';
  };
  const months = settled.rows.map((row) => ({ month: row.month, work: row.worked, kept: kept(row.month) }));
  const recorded = months.filter((m) => m.kept !== 'agreed').length;

  const basis = record.paid ?? (record.payments?.length ? 'cobros' : 'unknown');
  return {
    phase,
    settled,
    standing,
    dates: {
      from: settled.job.from,
      to: settled.job.to,
      fromSource: record.started ? 'recorded' : 'agreed',
      toSource: toAgreed ? 'agreed' : 'recorded',
    },
    days: {
      work: sum(months.map((m) => m.work)),
      sick: sum(settled.rows.map((row) => row.facts.sick)),
      source: recorded === 0 ? 'agreed' : recorded === months.length ? 'recorded' : 'mixed',
      months,
    },
    money: {
      basis,
      approx: basis === 'cobros' && record.payments.some((p) => p.approx),
      due: standing.corresponde,
      received: standing.cobrado,
      missing: standing.falta,
      missingByMinimumOnly: basis === 'asAgreed',
    },
  };
}

/**
 * The figures Comparar ranks (`earnings` as `calc` has them, net), and which kind they are. A job worked, finished and
 * with its record closed (`record.complete`) gives real figures: the money received, over the days worked, the months the
 * job lasted and the hours of those days; what is not money that reaches the shepherd (housing, meals, expenses, the
 * severance) stays as agreed. Any other job gives the agreed figures, `real: false`.
 * @param {{ terms: object, mine: { record: OfferRecord } }} offer
 * @param {string} today
 * @param {ReturnType<typeof import('./calc.js').calc>} r
 * @param {ReturnType<typeof happenedOf>} [happened] when the caller has it already
 * @returns {{ real: boolean, earnings: { total: number, perHour: number, perDay: number, perMonth: number }, time: { daysWorked: number, months: number, hours: number } }}
 */
export function actualFigures(offer, today, r, happened = happenedOf(offer, today, r)) {
  const agreed = {
    real: false,
    earnings: {
      total: r.earnings.total,
      perHour: r.earnings.perHour,
      perDay: r.earnings.perDay,
      perMonth: r.earnings.perMonth,
    },
    time: { daysWorked: r.time.daysWorked, months: r.time.months, hours: r.time.hours },
  };
  if (!happened || happened.phase !== 'finished' || !offer.mine.record.complete) return agreed;
  const daysWorked = happened.days.work;
  const months = sum(happened.settled.rows.map((row) => row.fullShare));
  const hours = daysWorked * (r.time.hoursPerDay || 0);
  const total = cents(happened.money.received + (r.earnings.total - r.earnings.received));
  return {
    real: true,
    earnings: {
      total,
      perHour: hours > 0 ? total / hours : 0,
      perDay: daysWorked > 0 ? total / daysWorked : 0,
      perMonth: months > 0 ? total / months : 0,
    },
    time: { daysWorked, months, hours },
  };
}
