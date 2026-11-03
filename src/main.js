/** Startup. */

import { commit, paintAll, paintCompare, restoreStaticFolds, select, setLoadingAccount } from './app.js';
import { setUpEvents } from './events.js';
import { defaultVacation } from './offer.js';
import { offers } from './offers.js';
import { active, calcOffer, KEY, load, state, store } from './state.js';
import { cardText, claimText } from './text.js';
import { accountLoader, accountState, setUpAccountSection } from './ui/account-section.js';
import { setUpEntry, startEntry } from './ui/entry.js';
import {
  openAccountPage,
  openFicha,
  openSettingsPage,
  resetHistory,
  resetViews,
  returnAfterSignIn,
  showTab,
} from './ui/navigation.js';
import { setUpPlaceField } from './ui/place-field.js';
import { setUpPullRefresh } from './ui/pull-refresh.js';
import { setUpTooltips } from './ui/tooltips.js';
import { fillForm } from './views/form.js';
import { fillLawFigures } from './views/law-figures.js';
import { fillSettings } from './views/settings.js';

// Before the first paint: the bundle is 218 KB and the account cannot connect without it
accountLoader.preload();
load();
offers.start();
for (const o of state.offers) defaultVacation(o.terms);
fillLawFigures();
restoreStaticFolds();
resetHistory();
setUpEntry({ paint: paintAll, select });
setUpEvents();
setUpTooltips();
setUpPullRefresh();
setUpPlaceField({ commit, paint: paintAll });
showTab(store.get(KEY.tab, 'offers'));
fillForm(active());
fillSettings(state.config);
// A saved session with no offers cached here (signed out earlier, new device): its offers are on their way, so
// neither an empty list nor the first-visit templates until the account answers
let loadingAccount = state.firstRun && accountLoader.returningUser();
setLoadingAccount(loadingAccount);
paintAll();
if (state.firstRun && !loadingAccount) startEntry();

accountState.subscribe((event, detail) => {
  const answered = event === 'replaced' || (event === 'account' && accountState.status() !== 'connecting');
  if (loadingAccount && answered) {
    loadingAccount = false;
    setLoadingAccount(false);
    // Replaced: handled below. A failed connect falls back to a first visit, as it did before the wait.
    if (event !== 'replaced') {
      paintAll();
      if (state.placeholderId) startEntry();
    }
  }
  if (event === 'others') paintCompare();
  if (event === 'signedIn') returnAfterSignIn();
  if (event !== 'replaced') return;
  // The offers were replaced: what was open may be gone. An empty account starts like a first visit, with the templates.
  // The offer shown surviving keeps its ficha or step open.
  if (!detail?.activeKept) resetViews();
  for (const o of state.offers) defaultVacation(o.terms);
  fillSettings(state.config);
  select(state.activeId);
  if (state.placeholderId) startEntry();
});
// Hidden, and no request, while storage/account-config.js has no project.
setUpAccountSection().catch(console.error);

/** For tests and the console: the state and a few ways in. Not used by the page. */
window.app = {
  state,
  active,
  calcOffer,
  select,
  showTab: (tab) => {
    resetViews();
    showTab(tab);
  },
  closeEntry: resetViews,
  openAccountPage,
  openSettingsPage,
  openFicha,
  cardText,
  claimText,
};
