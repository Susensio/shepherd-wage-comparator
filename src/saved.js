/** Everything read from the browser or a backup goes through here, completed with today's defaults. */

import { DEF_CFG, DEF_MINE, DEF_TERMS, defaultVacation } from './offer.js';

/**
 * A saved offer, complete. `offerOnly` describes the shepherd, not the job (it was a term until 30 October 2026): a
 * saved `terms.offerOnly` moves to `mine`, unless `mine` has its own.
 */
export const normalizeOffer = (saved) => {
  const { offerOnly, ...terms } = saved.terms ?? {};
  return {
    ...saved,
    terms: { ...DEF_TERMS, ...terms },
    mine: { ...DEF_MINE, ...(offerOnly === undefined ? {} : { offerOnly }), ...saved.mine },
  };
};

/** The offer shape since ADR-0007. */
const isCurrentShape = (saved) => saved && typeof saved.terms === 'object' && saved.terms !== null;

/**
 * An offer saved before ADR-0007, with every field at the top level, split into terms and own figures. Kept for
 * backups made before 30 October 2026. Keys that are in neither DEF_MINE nor DEF_TERMS are legacy and dropped
 * (`vacationAuto` is a flag set at runtime, so it stays); `offerOnly` goes to `terms` here and `normalizeOffer` moves it.
 */
const TERM_KEYS = new Set([...Object.keys(DEF_TERMS), 'offerOnly', 'vacationAuto']);

function fromFlat(saved) {
  const { id, cmp, ...fields } = saved;
  const terms = {};
  const mine = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key in DEF_MINE) mine[key] = value;
    else if (TERM_KEYS.has(key)) terms[key] = value;
  }
  return { id, cmp, terms, mine };
}

/** An offer in either shape, or null if it is not one. */
const toCurrentShape = (saved) => {
  if (isCurrentShape(saved)) return saved;
  return saved && typeof saved === 'object' && typeof saved.id === 'string' ? fromFlat(saved) : null;
};

/** Settings that were once editable and are now read from law.js. Saved values are dropped so they are not re-saved. */
const FORMER_LAW_KEYS = ['ssPct', 'ssEmp', 'annualHours', 'overnightPct', 'vacationDaysPerYear'];

const withoutLawFigures = (cfg) =>
  Object.fromEntries(Object.entries(cfg).filter(([key]) => !FORMER_LAW_KEYS.includes(key)));

/**
 * `{ offers, cfg }` from a saved bundle (browser, backup or account), completed with defaults.
 * `fallbackCfg` (the caller's current settings) is the base when the bundle has none. Former law figures in `cfg` are dropped. The input is not touched.
 * Offers in the old flat shape are converted.
 */
export function ingestSaved(data, { fallbackCfg }) {
  return {
    offers: (data.offers ?? []).map(toCurrentShape).filter(Boolean).map(normalizeOffer),
    cfg: data.cfg ? { ...DEF_CFG, ...withoutLawFigures(data.cfg) } : { ...fallbackCfg },
  };
}

/**
 * Another shepherd's shared offer as `{ o, sharer }`, or null if it has no terms. Missing fields take today's defaults
 * and unknown ones (a newer `schema_version`) are carried but never read. It has no `mine`: the only own figure is the
 * name, which is the sharer's, since the terms have none. Never saved.
 */
export function ingestShared({ offer, sharer }) {
  if (typeof offer?.terms !== 'object' || offer.terms === null) return null;
  // Never read `offerOnly` from a shared row: it is the sharer's own, and old rows still carry it.
  const { offerOnly: _ignored, ...terms } = offer.terms;
  const o = normalizeOffer({ id: offer.id, terms, mine: { name: sharer?.name || 'Otro pastor' } });
  defaultVacation(o.terms);
  return { o, sharer: sharer ?? {} };
}
