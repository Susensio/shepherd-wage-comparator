/** Everything read from the browser or a backup goes through here, completed with today's defaults. */

import { DEF_CFG, DEF_MINE, DEF_TERMS, defaultVacation } from './offer.js';

/** A saved offer, complete. */
export const normalizeOffer = (saved) => ({
  ...saved,
  terms: { ...DEF_TERMS, ...saved.terms },
  mine: { ...DEF_MINE, ...saved.mine },
});

/** The offer shape since ADR-0007. */
const isCurrentShape = (saved) => saved && typeof saved.terms === 'object' && saved.terms !== null;

/**
 * An offer saved before ADR-0007, with every field at the top level, split into terms and own figures. Kept for
 * backups made before 30 October 2026: every field survived the split, it only moved.
 */
function fromFlat(saved) {
  const { id, cmp, ...fields } = saved;
  const terms = {};
  const mine = {};
  for (const [key, value] of Object.entries(fields)) (key in DEF_MINE ? mine : terms)[key] = value;
  return { id, cmp, terms, mine };
}

/** An offer in either shape, or null if it is not one. */
const toCurrentShape = (saved) => {
  if (isCurrentShape(saved)) return saved;
  return saved && typeof saved === 'object' && typeof saved.id === 'string' ? fromFlat(saved) : null;
};

/**
 * `{ offers, cfg }` from a saved bundle (browser, backup or account), completed with defaults.
 * `fallbackCfg` (the caller's current settings) is the base when the bundle has none. The input is not touched.
 * Offers in the old flat shape are converted.
 */
export function ingestSaved(data, { fallbackCfg }) {
  return {
    offers: (data.offers ?? []).map(toCurrentShape).filter(Boolean).map(normalizeOffer),
    cfg: data.cfg ? { ...DEF_CFG, ...data.cfg } : { ...fallbackCfg },
  };
}

/**
 * Another shepherd's shared offer as `{ o, sharer }`, or null if it has no terms. Missing fields take today's defaults
 * and unknown ones (a newer `schema_version`) are carried but never read. It has no `mine`: the only own figure is the
 * name, which is the sharer's, since the terms have none. Never saved.
 */
export function ingestShared({ offer, sharer }) {
  if (typeof offer?.terms !== 'object' || offer.terms === null) return null;
  const o = normalizeOffer({ id: offer.id, terms: offer.terms, mine: { name: sharer?.name || 'Otro pastor' } });
  defaultVacation(o.terms);
  return { o, sharer: sharer ?? {} };
}
