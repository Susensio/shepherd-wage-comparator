/**
 * The saved format: its version, the upgraders between versions, and the one way in for everything read from the
 * browser, a backup, the account or another shepherd (docs/model.md, «Saved format»).
 */

import { DEF_CFG, DEF_MINE, DEF_TERMS, defaultVacation, emptyRecord, newId } from './offer.js';
import { toAnswerable } from './pay-answers.js';

/**
 * Version of the format written to the account and to backups; other users' pages read shared rows (ADR-0006).
 * Raise it only with a database migration that rewrites the rows and an `upgrade` entry for the old version.
 */
export const SCHEMA_VERSION = 5;

/**
 * Version of this page's code, compared with the database's `min_page_version`: raise it by hand when a change makes
 * older pages unsafe to write (a new `SCHEMA_VERSION`, a changed meaning of a field), and raise the database's in the
 * same release.
 */
export const PAGE_VERSION = 4;

/** Keys that are in neither DEF_MINE nor DEF_TERMS are legacy and dropped (`vacationAuto` is a flag set at runtime, so it stays). */
const TERM_KEYS = new Set([...Object.keys(DEF_TERMS), 'vacationAuto']);
/** Own figures of version 1 that are terms from version 3 on: `fromFlat` must still sort them. */
const FORMER_MINE_KEYS = new Set(['offerOnly', 'place']);
const MINE_KEYS = new Set(Object.keys(DEF_MINE));
const CFG_KEYS = new Set(Object.keys(DEF_CFG));

const isCurrentShape = (saved) => typeof saved.terms === 'object' && saved.terms !== null;

/** An offer with every field at the top level, split into terms and own figures; one already split is returned as it is. */
function fromFlat(saved) {
  if (isCurrentShape(saved)) return saved;
  const { id, cmp, ...fields } = saved;
  const terms = {};
  const mine = {};
  for (const [key, value] of Object.entries(fields)) {
    if (MINE_KEYS.has(key) || FORMER_MINE_KEYS.has(key)) mine[key] = value;
    else if (TERM_KEYS.has(key)) terms[key] = value;
  }
  return { id, cmp, terms, mine };
}

/**
 * Settings that were once editable and are now read from law.js, and `unemployment` (removed by ADR-0022). Saved values
 * are dropped so they are not re-saved.
 */
const FORMER_LAW_KEYS = ['ssPct', 'ssEmp', 'annualHours', 'overnightPct', 'vacationDaysPerYear', 'unemployment'];

const withoutLawFigures = (cfg) =>
  Object.fromEntries(Object.entries(cfg).filter(([key]) => !FORMER_LAW_KEYS.includes(key)));

/**
 * `upgrade[n]` turns version n into n + 1; `offer` and `cfg` are each optional. Versions:
 * 1: offers with every field at the top level (before ADR-0007; backups made before 30 October 2026); settings that
 *    may hold figures that now come from law.js.
 * 2: offers as `{ id, cmp, terms, mine }`; settings without those figures. `offerOnly` and the village (`place`) in
 *    `mine`; `offerOnly` moved there from `terms` on 30 October 2026 (ADR-0017) without a version bump, so it may be
 *    in either, and `mine`'s wins.
 * 3: `offerOnly` and `place` in `terms`, shared (ADR-0028). The migration of 4 November 2026 rewrote every account row.
 * 4: `contract: 'selfEmployed'` and `terms.vatIncluded` (ADR-0029). Nothing saved changes shape: the default fills
 *    `vatIncluded`, so the upgrader is the identity; the version keeps pages that do not know the contract from writing.
 * 5: `mine.record`, what happened (days by month, payments received; ADR-0032). The migration of 12 November 2026 gave
 *    every account row an empty one.
 */
export const upgrade = {
  1: { offer: fromFlat, cfg: withoutLawFigures },
  2: { offer: ownToTerms },
  3: { offer: (offer) => offer },
  4: { offer: withRecord },
};

/** Version 2 to 3: `offerOnly` and `place` move from `mine` to `terms` (ADR-0028). */
function ownToTerms(offer) {
  const { offerOnly, place, ...mine } = offer.mine ?? {};
  const terms = { ...offer.terms };
  if (offerOnly !== undefined) terms.offerOnly = offerOnly;
  if (place !== undefined) terms.place = place;
  return { ...offer, terms, mine };
}

/** Version 4 to 5: an empty `record` in `mine` where there is none; nothing else is touched. */
function withRecord(offer) {
  const mine = offer.mine ?? {};
  return { ...offer, mine: { ...mine, record: mine.record ?? emptyRecord() } };
}

const DAY_KINDS = new Set(['work', 'off', 'sick']);
const PAYMENT_WAYS = new Set(['payroll', 'cash']);
const isObject = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * A saved record, clean: a day whose kind is unknown, a payment with a non-finite amount or an unknown way, and months
 * that are not `YYYY-MM` are dropped; a payment without an id gets one. Anything else is not the page's to judge.
 * Always a new object, never the input's or the default.
 */
export function normalizeRecord(saved) {
  const record = emptyRecord();
  if (!isObject(saved)) return record;
  for (const [key, month] of Object.entries(isObject(saved.months) ? saved.months : {})) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key) || !isObject(month)) continue;
    const days = Object.fromEntries(
      Object.entries(isObject(month.days) ? month.days : {}).filter(
        ([day, kind]) => /^(0[1-9]|[12]\d|3[01])$/.test(day) && DAY_KINDS.has(kind),
      ),
    );
    record.months[key] = { closed: month.closed === true, days };
  }
  for (const p of Array.isArray(saved.payments) ? saved.payments : []) {
    if (!isObject(p) || !PAYMENT_WAYS.has(p.via) || typeof p.amount !== 'number' || !Number.isFinite(p.amount))
      continue;
    if (typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) continue;
    const payment = {
      id: typeof p.id === 'string' && p.id ? p.id : newId(),
      date: p.date,
      amount: p.amount,
      via: p.via,
    };
    if (typeof p.note === 'string' && p.note) payment.note = p.note;
    record.payments.push(payment);
  }
  return record;
}

const pick = (object, keys) => Object.fromEntries(Object.entries(object ?? {}).filter(([key]) => keys.has(key)));

/**
 * A saved offer, complete. Fields the page does not know are kept, so a write does not lose what a newer page added
 * without raising the version.
 */
export const normalizeOffer = (saved) => ({
  ...saved,
  terms: { ...DEF_TERMS, ...saved.terms },
  mine: { ...DEF_MINE, ...saved.mine, record: normalizeRecord(saved.mine?.record) },
});

/**
 * What version a saved offer is in: its own stamp (account rows have one), else its bundle's (backups), else what its
 * shape says, since browser copies were never stamped.
 */
function offerVersion(row, bundleVersion) {
  if (Number.isInteger(row.schema_version)) return row.schema_version;
  if (Number.isInteger(bundleVersion)) return bundleVersion;
  // Read as 2 even when written as 3: the 2-to-3 upgrade leaves an offer already in version 3 as it is
  return isCurrentShape(row) ? 2 : 1;
}

/**
 * One saved offer through the chain to today's shape, or null if it is not an offer. From a newer version it is read
 * without the fields this page does not know, and keeps that version in `schema_version`: such an offer is never
 * written back (the account skips it), because a write would cut what the newer page put there.
 */
function upgradeOffer(row, bundleVersion) {
  if (!row || typeof row !== 'object' || typeof row.id !== 'string') return null;
  const version = offerVersion(row, bundleVersion);
  if (version > SCHEMA_VERSION) {
    const known = { id: row.id, cmp: row.cmp, terms: pick(row.terms, TERM_KEYS), mine: pick(row.mine, MINE_KEYS) };
    return { ...normalizeOffer(known), schema_version: version };
  }
  let offer = row;
  for (let v = version; v < SCHEMA_VERSION; v++) if (upgrade[v]?.offer) offer = upgrade[v].offer(offer);
  const { schema_version: _stamp, ...current } = offer;
  return normalizeOffer(current);
}

/** Settings through the chain; those of a newer version are read without the keys this page does not know. */
function upgradeCfg(cfg, version) {
  if (version > SCHEMA_VERSION) return { ...DEF_CFG, ...pick(cfg, CFG_KEYS) };
  let upgraded = cfg;
  for (let v = version; v < SCHEMA_VERSION; v++) if (upgrade[v]?.cfg) upgraded = upgrade[v].cfg(upgraded);
  return { ...DEF_CFG, ...upgraded };
}

/**
 * `{ offers, cfg }` from a saved bundle (browser, backup or account), completed with defaults.
 * `fallbackCfg` (the caller's current settings) is the base when the bundle has none. The input is not touched.
 * Offers and settings go through the upgrade chain; then pay shapes the form's questions cannot say are converted,
 * once, here: the figures are worked out with these settings and the other offers.
 * @param {{ offers?: any[], cfg?: any, schema_version?: number }} data `schema_version`: of a backup; without one, each offer's own stamp or shape tells
 * @param {{ fallbackCfg: any }} options
 */
export function ingestSaved(data, { fallbackCfg }) {
  const offers = (data.offers ?? []).map((row) => upgradeOffer(row, data.schema_version)).filter(Boolean);
  // Settings have no stamp in the account: the oldest version is assumed, and the steps can run on newer data.
  const cfg = data.cfg ? upgradeCfg(data.cfg, data.schema_version ?? 1) : { ...fallbackCfg };
  for (const offer of offers) toAnswerable(offer, { cfg, offers });
  return { offers, cfg };
}

/**
 * Another shepherd's shared offer as `{ o, sharer }`, or null if it has no terms. Missing fields take today's defaults
 * and unknown ones (a newer `schema_version`) are dropped. It has no `mine`: the only own figure is the
 * name, which is the sharer's, since the terms have none. Never saved.
 */
export function ingestShared({ offer, sharer }) {
  if (typeof offer?.terms !== 'object' || offer.terms === null) return null;
  const upgraded = upgradeOffer({ id: offer.id, schema_version: offer.schema_version, terms: offer.terms, mine: {} });
  if (!upgraded) return null;
  const { schema_version: _newer, ...o } = upgraded;
  o.mine = { ...DEF_MINE, name: sharer?.name || 'Otro pastor', record: emptyRecord() };
  defaultVacation(o.terms);
  return { o, sharer: sharer ?? {} };
}
