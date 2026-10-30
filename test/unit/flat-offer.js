// Test helper: an offer written as one flat object of fields, split into terms and mine like the real thing.

import { DEF_MINE } from '../../src/offer.js';
import { normalizeOffer } from '../../src/saved.js';

/** `{ id, terms, mine }` from flat fields; the ones in DEF_MINE go to `mine`, the rest to `terms`. */
export function offerOf({ id, ...fields }) {
  const terms = {};
  const mine = {};
  for (const [field, value] of Object.entries(fields)) (field in DEF_MINE ? mine : terms)[field] = value;
  return normalizeOffer({ id, terms, mine });
}
