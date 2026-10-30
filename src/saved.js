/** Everything read from the browser or a backup goes through here, completed with today's defaults. */

import { DEF_CFG, DEF_OFFER } from './offer.js';

/** A saved offer, complete. */
export const normalizeOffer = (saved) => ({ ...DEF_OFFER, ...saved });

/**
 * `{ offers, cfg }` from a saved bundle (browser, backup or account), completed with defaults.
 * `fallbackCfg` (the caller's current settings) is the base when the bundle has none. The input is not touched.
 */
export function ingestSaved(data, { fallbackCfg }) {
  return {
    offers: (data.offers ?? []).map(normalizeOffer),
    cfg: data.cfg ? { ...DEF_CFG, ...data.cfg } : { ...fallbackCfg },
  };
}
