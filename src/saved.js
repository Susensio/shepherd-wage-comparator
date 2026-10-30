/** Everything read from the browser or a backup goes through here, completed with today's defaults. */

import { DEF_CFG, DEF_MINE, DEF_TERMS } from './offer.js';

/** A saved offer, complete. */
export const normalizeOffer = (saved) => ({
  ...saved,
  terms: { ...DEF_TERMS, ...saved.terms },
  mine: { ...DEF_MINE, ...saved.mine },
});

/** The offer shape since ADR-0007; earlier flat offers have no `terms` and are not converted (ADR-0005). */
const isCurrentShape = (saved) => saved && typeof saved.terms === 'object' && saved.terms !== null;

/**
 * `{ offers, cfg }` from a saved bundle (browser, backup or account), completed with defaults.
 * `fallbackCfg` (the caller's current settings) is the base when the bundle has none. The input is not touched.
 * Offers in the old flat shape are left out.
 */
export function ingestSaved(data, { fallbackCfg }) {
  return {
    offers: (data.offers ?? []).filter(isCurrentShape).map(normalizeOffer),
    cfg: data.cfg ? { ...DEF_CFG, ...data.cfg } : { ...fallbackCfg },
  };
}
