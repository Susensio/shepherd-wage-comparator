/** The list of offers: the active one, the first-visit placeholder, and saving them. Callers ask for transitions; none sets these fields itself. */

import { makeOffer } from './offer.js';
import { ingestSaved } from './saved.js';
import { KEY, notifySaved, offersOf, state, store } from './state.js';

/**
 * @param {object} deps
 * @param {typeof state} deps.state
 * @param {{ get(key: string, fallback: any): any, set(key: string, value: any): void }} deps.store
 * @param {() => void} [deps.notify] called after every save of offers (the account sync listens)
 */
export function createOffers({ state, store, notify = () => {} }) {
  let persistRequested = false;

  /** Writes the offers and the active id, and tells the listeners. */
  function save() {
    store.set(KEY.offers, state.offers);
    store.set(KEY.active, state.activeId);
    notify();
    // Ask the browser not to delete them when short of space
    if (!persistRequested && !state.placeholderId) {
      persistRequested = true;
      globalThis.navigator?.storage?.persist?.().catch(() => {});
    }
  }

  /** Reads the saved offers (after `state.config`). Nothing saved is a first visit: a placeholder, replaced by the template picked. */
  function start() {
    const saved = store.get(KEY.offers, null);
    const firstRun = !Array.isArray(saved);
    const { offers: ingested } = ingestSaved(
      { offers: firstRun ? [] : saved, cfg: state.config },
      { fallbackCfg: state.config },
    );
    const list = ingested.length ? ingested : [makeOffer()];
    let activeId = store.get(KEY.active, null) || list[0].id;
    if (!list.some((o) => o.id === activeId)) activeId = list[0].id;
    Object.assign(state, { offers: list, activeId, firstRun, placeholderId: firstRun ? list[0].id : null });
  }

  /** Shows an offer. */
  function select(id) {
    state.activeId = id;
    save();
  }

  /** Adds an offer, after `after` if given, else at the end, and shows it. */
  function add(offer, { after = null } = {}) {
    if (after) state.offers.splice(state.offers.indexOf(after) + 1, 0, offer);
    else state.offers.push(offer);
    select(offer.id);
  }

  /** The template picked: it replaces the placeholder, if any. */
  function chooseTemplate(offer) {
    state.offers = myOffers();
    state.placeholderId = null;
    add(offer);
  }

  /** The placeholder stays as the only offer, now a real one (the templates were cancelled). */
  function keepPlaceholder() {
    state.placeholderId = null;
    save();
  }

  /**
   * Deletes an offer and shows its neighbour. Deleting the last one goes back to a first visit: the placeholder is
   * not kept in storage, so a reload starts with the templates. Returns whether it did.
   */
  function remove(offer) {
    const at = state.offers.indexOf(offer);
    state.offers.splice(at, 1);
    const emptied = !state.offers.length;
    if (emptied) {
      const blank = makeOffer();
      state.offers.push(blank);
      state.placeholderId = blank.id;
    }
    select(state.offers[emptied ? 0 : Math.max(0, at - 1)].id);
    // After the save, which the account sync needs to see the deletion
    if (emptied) store.set(KEY.offers, null);
    return emptied;
  }

  /** Adds the offers of a backup, dropping the placeholder. Returns whether there was one. */
  function addImported(fresh) {
    const hadPlaceholder = !!state.placeholderId;
    state.offers = [...myOffers(), ...fresh];
    state.placeholderId = null;
    select(state.offers.some((o) => o.id === state.activeId) ? state.activeId : state.offers[0].id);
    return hadPlaceholder;
  }

  /** The account's offers become the list; an empty account is a first visit. Does not save: the account does. */
  function replaceFromAccount(list) {
    const empty = !list.length;
    state.offers = empty ? [makeOffer()] : list;
    if (!state.offers.some((o) => o.id === state.activeId)) state.activeId = state.offers[0].id;
    state.placeholderId = empty ? state.offers[0].id : null;
    state.firstRun = empty;
  }

  /** Signed out: a first visit, so the next user does not inherit these offers. Does not save. */
  function clearForSignOut() {
    const placeholder = makeOffer();
    Object.assign(state, {
      offers: [placeholder],
      activeId: placeholder.id,
      placeholderId: placeholder.id,
      firstRun: true,
    });
  }

  /** Gives an offer a new id, keeping it the active one if it was. */
  function remapId(offer, newId) {
    if (state.activeId === offer.id) state.activeId = newId;
    offer.id = newId;
  }

  const myOffers = () => offersOf(state);

  return {
    save,
    start,
    select,
    add,
    chooseTemplate,
    keepPlaceholder,
    remove,
    addImported,
    replaceFromAccount,
    clearForSignOut,
    remapId,
    mine: myOffers,
  };
}

export const offers = createOffers({ state, store, notify: notifySaved });
