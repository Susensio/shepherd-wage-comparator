/** Phase of an offer, from its dates (ADR-0032): never a mode the shepherd picks. */

import { endOf, isoOf } from '../offer.js';

/**
 * @param {{terms: object}} offer
 * @param {string} today ISO date, «2026-11-12»
 * @returns {'offerOnly' | 'undecided' | 'underway' | 'finished'} an offer without a known end stays underway
 */
export function phaseOf(offer, today) {
  const { terms } = offer;
  if (terms.offerOnly) return 'offerOnly';
  if (!terms.start || terms.start > today) return 'undecided';
  const end = endOf(terms);
  if (end && isoOf(end) < today) return 'finished';
  return 'underway';
}
