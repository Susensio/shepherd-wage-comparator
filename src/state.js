/** The app's state: offers, the active one, settings and preferences, and saving them in the browser. */

import { calc } from './model/calc.js';
import { DEF_CFG, makeOffer } from './offer.js';
import { ingestSaved } from './saved.js';
import { UNITS } from './units.js';

/** Storage keys. Changing one abandons what was saved under it; `offers` was renamed for the terms/mine shape (ADR-0007). */
export const KEY = {
  backup: 'cj.copia',
  backupNotice: 'cj.copiaAviso',
  offers: 'cj.ofertas2',
  active: 'cj.active',
  cfg: 'cj.cfg',
  cmpUnit: 'cj.unidadCmp',
  tab: 'cj.tab',
  folds: 'cj.secs',
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
  /** Comparar shows the figures of the terms alone (not saved: a way of looking). */
  termsOnly: false,
  /**
   * Other shepherds' shared offers (ADR-0006). Never saved and never mixed into `offers`. `available`: signed in with
   * sharing on; `include`: ranked in Comparar; `viewId`: the one open read-only.
   */
  others: {
    available: false,
    include: false,
    status: /** @type {'idle' | 'loading' | 'ready' | 'error'} */ ('idle'),
    items: /** @type {{ o: any, sharer: any }[]} */ ([]),
    viewId: /** @type {string | null} */ (null),
  },
  /** Named collapsibles (data-fold) and whether they are open. */
  folds: /** @type {Record<string, boolean>} */ ({}),
};

/** The offer being shown and edited. The form edits it directly and it is saved on every change. */
export const active = () => state.offers.find((o) => o.id === state.activeId);
/** Your offers, without the first-run placeholder. */
export const myOffers = () => state.offers.filter((o) => o.id !== state.placeholderId);
/** Every figure of an offer, with your settings and your other offers. */
export const calcOffer = (o) => calc(o, { cfg: state.config, offers: myOffers() });

/** Called after every save of offers or settings (the account sync listens). */
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
/** @param {string} tab */
export function saveTab(tab) {
  store.set(KEY.tab, tab);
}
export function saveCmpUnit() {
  store.set(KEY.cmpUnit, state.cmpUnit);
}

/** Reads everything saved in this browser. */
export function load() {
  const savedOffers = store.get(KEY.offers, null);
  const firstRun = !Array.isArray(savedOffers);
  const { cfg: config, offers: ingested } = ingestSaved(
    { offers: firstRun ? [] : savedOffers, cfg: store.get(KEY.cfg, null) },
    { fallbackCfg: DEF_CFG },
  );
  const offers = ingested.length ? ingested : [makeOffer()];

  let activeId = store.get(KEY.active, null) || offers[0].id;
  if (!offers.some((x) => x.id === activeId)) activeId = offers[0].id;
  const unit = store.get(KEY.cmpUnit, 'hour');

  Object.assign(state, {
    offers,
    activeId,
    firstRun,
    placeholderId: firstRun ? offers[0].id : null,
    config,
    cmpUnit: UNITS[unit] ? unit : 'hour',
    folds: { time: true, payroll: true, breakdown: true, ...store.get(KEY.folds, {}) },
  });
}
