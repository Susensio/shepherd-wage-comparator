/** Startup. */

import {
  closeTemplates,
  openTemplates,
  paintAll,
  paintCompare,
  restoreStaticFolds,
  scrollChipsNextPaint,
  select,
  showTab,
  templatesOpen,
} from './app.js';
import { setUpEvents } from './events.js';
import { defaultVacation } from './offer.js';
import { active, calcOffer, KEY, load, state, store } from './state.js';
import { cardText, claimText } from './text.js';
import { setUpAccountSection } from './ui/account-section.js';
import { setUpTooltips } from './ui/tooltips.js';
import { fillForm } from './views/form.js';
import { fillLawFigures } from './views/law-figures.js';
import { fillSettings } from './views/settings.js';

load();
for (const o of state.offers) defaultVacation(o.terms);
fillLawFigures();
restoreStaticFolds();
setUpEvents();
setUpTooltips();
showTab(store.get(KEY.tab, 'offers'));
scrollChipsNextPaint();
fillForm(active());
fillSettings();
paintAll();
if (state.firstRun) openTemplates();

// Hidden, and no request, while storage/account-config.js has no project.
setUpAccountSection({
  onOthers: paintCompare,
  onReplaced() {
    if (templatesOpen()) closeTemplates();
    for (const o of state.offers) defaultVacation(o.terms);
    fillSettings();
    scrollChipsNextPaint();
    select(state.activeId);
  },
}).catch(console.error);

/** For tests and the console: the state and a few ways in. Not used by the page. */
window.app = { state, active, calcOffer, select, showTab, closeTemplates, cardText, claimText };
