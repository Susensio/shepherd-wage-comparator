/** The app's state: settings and preferences, saving them in the browser, and the fields `offers.js` owns. */

import { calc } from './model/calc.js';
import { DEF_CFG } from './offer.js';
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
  /** The Comparar unit: per day by default, the way offers are usually told; per hour is fairer between workdays. */
  cmpUnit: 'day',
  /** Comparar shows the figures of the terms alone (not saved: a way of looking). */
  termsOnly: false,
  /** Comparar ranks your offers that were only offers (not worked) too; on by default (not saved: a way of looking). */
  showOfferOnly: true,
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
  /** «Comparar dos»: whether it is on and which offers are picked (not saved: every visit starts without it). */
  pairing: { on: false, ids: /** @type {string[]} */ ([]) },
  /** Named collapsibles (data-fold) and whether they are open. */
  folds: /** @type {Record<string, boolean>} */ ({}),
};

/** The offer being shown and edited. The form edits it directly and it is saved on every change. */
export const active = () => state.offers.find((o) => o.id === state.activeId);
/** Your offers, without the first-run placeholder. */
export const offersOf = (s) => s.offers.filter((o) => o.id !== s.placeholderId);
export const myOffers = () => offersOf(state);
/** Every figure of an offer, with your settings and your other offers. */
export const calcOffer = (o) => calc(o, { cfg: state.config, offers: myOffers() });

/** Called after every save of offers or settings (the account sync listens). */
const listeners = new Set();
export const onSave = (fn) => listeners.add(fn);
export const notifySaved = () => {
  for (const fn of listeners) fn();
};

export function saveConfig() {
  store.set(KEY.cfg, state.config);
  notifySaved();
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

/** Reads the settings and preferences saved in this browser; the offers are `offers.start()`. */
export function load() {
  const { cfg: config } = ingestSaved({ offers: [], cfg: store.get(KEY.cfg, null) }, { fallbackCfg: DEF_CFG });
  const unit = store.get(KEY.cmpUnit, 'day');
  Object.assign(state, {
    config,
    cmpUnit: UNITS[unit] ? unit : 'day',
    folds: { breakdown: true, ...store.get(KEY.folds, {}) },
  });
}
