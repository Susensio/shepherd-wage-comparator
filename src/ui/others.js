/** Other shepherds' shared offers in Comparar (ADR-0006): when they can be read, fetching them, and the section's stage. */

import { ingestShared } from '../saved.js';
import { state } from '../state.js';
import { tabInView } from './navigation.js';

/** @type {any} */
let account = null;
/** Called when what other shepherds' offers show changes: availability, loading, result. */
let onChange = () => {};
let loadSeq = 0;

/**
 * @param {() => void} notify called whenever the others' state changes
 */
export function setUpOthers(notify) {
  onChange = notify;
}

/** The connected account the others are read through. */
export function useAccount(opened) {
  account = opened;
}

/** Fetches the others' offers into `state.others` (memory only); the latest request wins. */
export async function loadOthers() {
  if (!account || !state.others.available) return;
  const seq = ++loadSeq;
  state.others.status = 'loading';
  onChange();
  let status = /** @type {'ready' | 'error'} */ ('ready');
  let items = [];
  try {
    items = (await account.sharedOffers()).map(ingestShared).filter(Boolean);
  } catch (error) {
    console.error(error);
    status = 'error';
  }
  if (seq !== loadSeq || !state.others.available) return;
  state.others.status = status;
  if (status === 'ready') {
    state.others.items = items;
    if (!items.some((x) => x.o.id === state.others.viewId)) state.others.viewId = null;
  }
  onChange();
}

/**
 * Other shepherds' offers can be read only when signed in with sharing on (ADR-0006).
 * @param {{ user: any, profile: any, pending: any[] }} view
 */
export function syncAvailability(view) {
  const available = !!(view.user && view.profile?.sharing && !view.pending.length);
  if (available === state.others.available) return;
  state.others.available = available;
  if (!available) {
    Object.assign(state.others, { include: false, status: 'idle', items: [], viewId: null });
  } else state.others.include = true; // sharing means seeing the others, until hidden with the checkbox
  onChange();
  if (available && tabInView('compare')) loadOthers(); // else showTab loads on arrival
}

/**
 * Comparar's section, from the account: nothing until the saved session has been looked at, or while uploads wait.
 * @param {{ enabled: boolean, started: boolean, pending: any[], user: any, profile: any, othersMessage: string, othersDeclined: boolean }} view
 * @returns {import('../views/others.js').OthersSection | null}
 */
export function othersSection(view) {
  if (!view.enabled || !view.started || view.pending.length) return null;
  const message = view.othersMessage;
  if (!view.user) return { stage: 'guest', message, noPhone: false };
  if (!view.profile) return null;
  if (view.profile.sharing) return { stage: 'sharing', message, noPhone: !view.profile.phone };
  return { stage: view.othersDeclined ? 'declined' : 'ask', message, noPhone: false };
}
