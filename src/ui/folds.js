/** Named collapsibles (data-fold): which ones you left open. The views are repainted on every change and reopen them. */

import { saveFolds, state } from '../state.js';

/** Remembers whether a named collapsible is open. */
export function saveFold(details) {
  const name = details.dataset.fold;
  if (!name) return;
  state.folds[name] = details.open;
  saveFolds();
}

/** Opens or closes the named collapsibles under `root` as you left them. */
export function restoreFolds(root) {
  for (const details of root.querySelectorAll('[data-fold]')) details.open = !!state.folds[details.dataset.fold];
}
