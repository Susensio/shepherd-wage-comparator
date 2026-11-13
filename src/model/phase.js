/** Phase of an offer, from its dates and what was worked (ADR-0032): never a mode the shepherd picks. */

import { endOf, isoOf } from '../offer.js';
import { lastWorkedDay } from './record.js';

/**
 * The end that counts: the later of the offer's end and the last day marked as worked, so a job stretched past its end
 * goes on. Without a known end, none.
 * @param {{terms: object}} offer
 * @param {import('./settle.js').OfferRecord} [record]
 * @returns {string} an ISO date, or ''
 */
export function effectiveEnd(offer, record) {
  const end = endOf(offer.terms);
  if (!end) return '';
  const last = lastWorkedDay(record);
  return last > isoOf(end) ? last : isoOf(end);
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
  const end = effectiveEnd(offer, record);
  if (end && end < today) return 'finished';
  return 'underway';
}
