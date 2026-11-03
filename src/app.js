/**
 * The controller: paints every view from the state, and the things the page does that more than one event needs
 * (opening an offer, what the tabs, pages, ficha and entry paint).
 */

import { render } from 'lit-html';
import { $ } from './dom.js';
import { joinAnd } from './format.js';
import { calcTermsOnly } from './model/calc.js';
import { defaultVacation, missing, workedOffers } from './offer.js';
import { offers } from './offers.js';
import { active, calcOffer, myOffers, state } from './state.js';
import { STEP_OF_MISSING } from './steps.js';
import { placesIfLoaded, placesStatus, preloadPlaces } from './storage/places.js';
import { MISSING_TEXT, sharedLabels } from './text.js';
import { loadOthers, paintAccountStatus } from './ui/account-section.js';
import { chosenTemplate, currentStep, dismiss, isAskingMissing, paintEntry } from './ui/entry.js';
import { restoreFolds } from './ui/folds.js';
import { fadeIn } from './ui/motion.js';
import { entryOpen, onNavigate, openFicha } from './ui/navigation.js';
import { scrollToTop } from './ui/scroller.js';
import { paintBackup } from './ui/settings-page.js';
import { compareView, trendView, yearlyView } from './views/compare.js';
import { fichaView } from './views/ficha.js';
import { fillForm, fillVacation, paintForm } from './views/form.js';
import { offersListView, skeletonCardsView, templatesView } from './views/offers-list.js';
import { sharedView } from './views/shared.js';

/** What the page remembers while open, not saved. */
const ui = {
  /** A saved session is connecting and the browser has no offers of its own: skeleton cards instead of the list. */
  loadingAccount: false,
  /** Fade in the form fields that appear: only after you touch the form, not when switching offers or starting. */
  animateFields: false,
};

/** Takes effect at the next paint. */
export const setLoadingAccount = (/** @type {boolean} */ loading) => {
  ui.loadingAccount = loading;
};

export const animateNextPaint = () => {
  ui.animateFields = true;
};

/* --- Painting --- */

/** The form field where each thing `missing()` reports goes. */
const MISSING_FIELD = {
  agreedTotal: '#payTotal',
  duration: '#duration',
  hoursPerDay: '#hoursPerDay',
  pay: '#payTotal',
  cashInHand: '#payTotal',
  payrollPart: '#payPart',
  vacation: 'input[name=vacation]',
};

/** Marks in the step opened because something is missing in it what is missing there. */
function markMissing() {
  const o = active();
  const step = currentStep().id;
  const shortfall = isAskingMissing() ? missing(o.terms).filter((id) => STEP_OF_MISSING[id] === step) : [];
  // Several things can point at one field (the pay questions have a single amount)
  for (const selector of new Set(Object.values(MISSING_FIELD)))
    $(selector)
      .closest('.fld')
      .classList.toggle(
        'missing',
        shortfall.some((what) => MISSING_FIELD[what] === selector),
      );
  $('#goMsg').textContent = shortfall.length ? `Falta ${joinAnd(shortfall.map((id) => MISSING_TEXT[id]))}.` : '';
}

/** Other shepherds' offers are ranked (and your own with them) on terms alone, so like is compared with like. */
const includesOthers = () => state.others.available && state.others.include;
const termsOnlyNow = () => state.termsOnly || includesOthers();

/** Your offers with their figures: full, or from their terms alone when that is on. */
const compared = () =>
  myOffers().map((o) => ({ o, r: termsOnlyNow() ? calcTermsOnly(o, { cfg: state.config }) : calcOffer(o) }));

/**
 * Other shepherds' offers with their terms-only figures and the label that tells same-named ones apart. One that
 * cannot be calculated is left out, not fatal.
 */
function comparedOthers() {
  const labels = sharedLabels(state.others.items, placesIfLoaded());
  return state.others.items.flatMap(({ o, sharer }) => {
    try {
      const { name, detail } = labels.get(o.id);
      return [
        { o, sharer, label: detail ? `${name} · ${detail}` : name, detail, r: calcTermsOnly(o, { cfg: state.config }) },
      ];
    } catch (error) {
      console.error(error);
      return [];
    }
  });
}

/** The place list as the views take it: what is in, and how the load is going. */
const placesNow = () => ({ index: placesIfLoaded(), status: placesStatus() });

/** An offer that names a municipality needs the list to say where it is: fetched in the background if not yet. */
const needPlacesFor = (o) => {
  if (o.terms.municipality && !placesIfLoaded()) preloadPlaces();
};

export function paintCompare() {
  const own = compared();
  if (includesOthers()) for (const { o } of state.others.items) needPlacesFor(o);
  const others = includesOthers() ? comparedOthers() : null;
  const all = others ? [...own, ...others] : own;
  const { picker, body, more } = compareView(
    all,
    state.cmpUnit,
    termsOnlyNow(),
    state.others,
    state.pairing,
    state.showOfferOnly,
    state.moneyOnly,
  );
  render(picker, $('#cmpView'));
  render(body, $('#cmpBlk'));
  render(more, $('#cmpMore'));
  restoreFolds($('#cmpBlk'));
  restoreFolds($('#cmpMore'));
  paintTimeline(own);
  paintShared(others);
}

/** The read-only view of the shared offer opened, in place of the Comparar tab's content. `others`: `comparedOthers()` if the caller has it. */
function paintShared(others = null) {
  const open = state.others.available && state.others.viewId !== null;
  const shown = open ? (others ?? comparedOthers()).find((x) => x.o.id === state.others.viewId) : undefined;
  $('#cmpMain').hidden = !!shown;
  $('#sharedBlk').hidden = !shown;
  if (shown) needPlacesFor(shown.o);
  render(shown ? sharedView(shown, placesIfLoaded()) : '', $('#sharedBlk'));
  restoreFolds($('#sharedBlk'));
}

/** Opens (or closes, with null) another shepherd's offer. */
export function viewShared(id) {
  state.others.viewId = id;
  paintShared();
  scrollToTop(0);
}

/** «Cuándo»: what you are paid over time and each year's summary. Only with worked offers (dated, not «solo oferta»). */
function paintTimeline(all = compared()) {
  const dated = workedOffers(all.map((x) => x.o)).length > 0;
  $('#tlBlk').hidden = !dated;
  render(dated ? trendView(all, state.cmpUnit, $('#cmpBlk').clientWidth) : '', $('#trend'));
  render(dated ? yearlyView(all) : '', $('#yearly'));
}

/** Repaints everything from the state. */
export function paintAll() {
  const o = active();
  const r = calcOffer(o);
  needPlacesFor(o);
  const loading = ui.loadingAccount;
  render(
    loading
      ? skeletonCardsView()
      : offersListView(
          myOffers().map((x) => ({ o: x, r: calcOffer(x) })),
          o.id,
        ),
    $('#cards'),
  );
  $('#offersList').setAttribute('aria-busy', String(loading));
  $('#listLoading').hidden = !loading;
  $('#btnAdd').hidden = loading;
  document.body.classList.toggle('loading-account', loading);
  $('#fichaName').textContent = o.mine.name || 'Sin nombre';
  $('#fichaMenu').dataset.id = o.id;
  render(fichaView(o, r, placesIfLoaded()), $('#result'));
  restoreFolds($('#result'));
  const appeared = paintForm(o, r, myOffers(), placesNow());
  if (ui.animateFields) for (const el of appeared) fadeIn(el);
  ui.animateFields = false;
  render(templatesView(chosenTemplate()), $('#tplGrid'));
  if (entryOpen()) paintEntry(o, r);
  markMissing();
  paintCompare();
  paintBackup();
  paintAccountStatus();
}

/** Saves the offers and repaints. */
export function commit() {
  offers.save();
  paintAll();
}

/** Makes an offer the active one, in the form and in the ficha. */
export function select(id) {
  defaultVacation(state.offers.find((o) => o.id === id).terms);
  offers.select(id);
  show();
}

/** Paints the active offer, in the form and in the ficha, without saving. */
export function show() {
  fillForm(active());
  paintAll();
}

/** Opens an offer's ficha. */
export function openOffer(id) {
  select(id);
  openFicha();
}

/* --- Tabs --- */

onNavigate({
  tabShown(tab) {
    paintAccountStatus();
    if (tab === 'compare') {
      paintTimeline(); // the trend fits the width, which is only known once shown
      if (includesOthers()) loadOthers(); // refetched on each visit, not on every repaint
    }
  },
  pageOpened(fromPrompt) {
    paintBackup();
    paintAccountStatus({ chooser: fromPrompt });
  },
  viewChanged: () => paintAll(),
  entryDismissed: dismiss,
});

/** Opens the named collapsibles of the static page as you left them. */
export const restoreStaticFolds = () => restoreFolds(document);

export { fillVacation };
