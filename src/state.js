/** The app's state: offers, the active one, settings and preferences, and saving them in the browser. */

import { extractYourData, ingestSaved, normalizeOffer, offerFromSpanish, renameKeys, SPANISH } from './legacy.js';
import { calc } from './model/calc.js';
import { DEF_CFG, makeOffer, YOUR_DATA } from './offer.js';
import { UNITS } from './units.js';

/** Storage keys. Do not change them: saved data would be lost. */
export const KEY = {
  backup: 'cj.copia',
  backupNotice: 'cj.copiaAviso',
  offers: 'cj.ofertas',
  active: 'cj.active',
  cfg: 'cj.cfg',
  cmpUnit: 'cj.unidadCmp',
  tab: 'cj.tab',
  ts: 'cj.ts',
  uploaded: 'cj.enCuenta',
  folds: 'cj.secs',
  legacyFolds: 'cj.plegados',
  legacyDraft: 'cj.draft',
};

/** localStorage, as JSON; it can be missing or full, so every access may fail quietly. */
export const store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

export const state = {
  /** @type {object[]} */
  offers: [],
  activeId: '',
  /** On first run, a placeholder offer is replaced by the template you pick. */
  placeholderId: /** @type {string | null} */ (null),
  firstRun: false,
  config: { ...DEF_CFG },
  /** The Comparar unit: per hour is the fairest between different workdays. */
  cmpUnit: 'hour',
  /** Named collapsibles (data-fold) and whether they are open. */
  folds: /** @type {Record<string, boolean>} */ ({}),
  /** Whether your offers are being saved to your Claude account, and if not, why. Not saved. */
  inCloud: false,
  cloudReason: '',
};

/** The offer being shown and edited. The form edits it directly and it is saved on every change. */
export const active = () => state.offers.find((o) => o.id === state.activeId);
/** Your offers, without the first-run placeholder. */
export const myOffers = () => state.offers.filter((o) => o.id !== state.placeholderId);
/** Every figure of an offer, with your settings and your other offers. */
export const calcOffer = (o) => calc(o, { cfg: state.config, offers: myOffers() });

/** Called after every save (the Claude account sync listens). */
const listeners = new Set();
export const onSave = (fn) => listeners.add(fn);
const saved = () => {
  for (const fn of listeners) fn();
};

let persistRequested = false;
export function saveOffers() {
  store.set(KEY.offers, state.offers);
  store.set(KEY.active, state.activeId);
  saved();
  // Ask the browser not to delete them when short of space
  if (!persistRequested && !state.placeholderId) {
    persistRequested = true;
    navigator.storage?.persist?.().catch(() => {});
  }
}
export function saveConfig() {
  store.set(KEY.cfg, state.config);
  saved();
}
export function saveFolds() {
  store.set(KEY.folds, state.folds);
}

/** Reads everything saved in this browser, converting older formats. */
export function load() {
  const savedOffers = store.get(KEY.offers, null);
  const firstRun = !Array.isArray(savedOffers);
  const ingested = ingestSaved(
    { offers: firstRun ? [] : savedOffers, cfg: store.get(KEY.cfg, null) },
    { fallbackCfg: DEF_CFG },
  );
  const config = ingested.cfg;
  let offers = ingested.offers;
  const migrate = !firstRun && ingested.migrated;
  // Older versions kept the offer being edited apart
  const draft = offerFromSpanish(store.get(KEY.legacyDraft, null));
  if (draft?.id && offers.some((x) => x.id === draft.id))
    offers = offers.map((x) =>
      x.id === draft.id ? { ...extractYourData([normalizeOffer(draft)], config, false, YOUR_DATA)[0], cmp: x.cmp } : x,
    );
  if (!offers.length) offers = [makeOffer()];

  let activeId = store.get(KEY.active, null) || draft?.id || offers[0].id;
  if (!offers.some((x) => x.id === activeId)) activeId = offers[0].id;
  const unit = store.get(KEY.cmpUnit, 'hour');
  const folds = { time: true, payroll: true, breakdown: true };

  Object.assign(state, {
    offers,
    activeId,
    firstRun,
    placeholderId: firstRun ? offers[0].id : null,
    config,
    cmpUnit: UNITS[SPANISH.units[unit] ?? unit] ? (SPANISH.units[unit] ?? unit) : 'hour',
    folds: {
      ...folds,
      ...renameKeys(store.get(KEY.legacyFolds, {}), SPANISH.folds),
      ...renameKeys(store.get(KEY.folds, {}), SPANISH.folds),
    },
  });
  if (draft) {
    store.set(KEY.legacyDraft, null);
    saveOffers();
  }
  if (migrate) {
    saveConfig();
    saveOffers();
  }
}

/** The saved tab, in today's names. */
export const savedTab = () => {
  const tab = store.get(KEY.tab, 'offers');
  return SPANISH.tabs[tab] ?? tab;
};
