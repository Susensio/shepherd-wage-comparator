/** Phase of an offer, from its dates and what was worked (ADR-0032): never a mode the shepherd picks. */

import { endOf, isoOf, spanOf } from '../offer.js';
import { lastWorkedDay } from './record.js';

/** A job that was or is being worked: dated and not «just an offer» (ADR-0028). */
export const isWorked = (offer) => Boolean(offer.terms.start) && !offer.terms.offerOnly;

/** Offers that count as work done or to do. */
export const workedOffers = (offers) => offers.filter(isWorked);

/** Other worked offers whose dates overlap this one. */
export function overlapsOf(offer, offers) {
  if (!isWorked(offer)) return [];
  const [start, end] = spanOf(offer.terms);
  return workedOffers(offers).filter((p) => {
    if (p.id === offer.id) return false;
    const [b, e] = spanOf(p.terms);
    return b <= end && e >= start;
  });
}

/** The job's first day: the offer's start (ISO), or ''. */
export const jobStart = (offer) => offer.terms.start || '';

/** Whether the shepherd recorded anything of what happened: a day, a cobro, or «no se cobró nada». */
export const hasFacts = (record) =>
  Boolean(record) &&
  (record.payments?.length > 0 || Object.keys(record.months ?? {}).length > 0 || Boolean(record.paid));

/**
 * The one end of the job, for the phase and for `settle`: the end the shepherd said, else the offer's, or the last day
 * marked as worked when that is later. An end after the offer's extends the job; one before it cuts it. Without a
 * known end, none.
 * @param {{terms: object}} offer
 * @param {import('./settle.js').OfferRecord} [record]
 * @returns {string} an ISO date, or ''
 */
export function jobEnd(offer, record) {
  const end = endOf(offer.terms);
  const base = record?.end?.date || (end ? isoOf(end) : '');
  if (!base) return '';
  const last = lastWorkedDay(record);
  return last > base ? last : base;
}

/**
 * @param {{terms: object}} offer
 * @param {string} today ISO date, «2026-11-12»
 * @param {import('./settle.js').OfferRecord} [record] what was worked: a day marked after the offer's end extends the job
 * @returns {'offerOnly' | 'undecided' | 'underway' | 'finished'} an offer without a known end stays underway
 */
export function phaseOf(offer, today, record) {
  const { terms } = offer;
  if (terms.offerOnly) return 'offerOnly';
  if (!terms.start || terms.start > today) return 'undecided';
  const end = jobEnd(offer, record);
  if (end && end < today) return 'finished';
  return 'underway';
}
