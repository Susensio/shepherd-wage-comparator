/**
 * The controller: paints every view from the state, and the things the page does that more than one event needs
 * (opening an offer, what the tabs, pages, ficha and entry paint).
 */

import { render } from 'lit-html';
import { $ } from './dom.js';
import { calcTermsOnly } from './model/calc.js';
import { phaseOf } from './model/phase.js';
import { defaultVacation, missing, todayISO, workedOffers } from './offer.js';
import { offers } from './offers.js';
import { active, calcOffer, myOffers, state } from './state.js';
import { FIELD_OF_MISSING, STEP_OF_MISSING } from './steps.js';
import { placesIfLoaded, placesStatus, preloadPlaces } from './storage/places.js';
import { PHASE_TEXT, sharedLabels } from './text.js';
import { loadOthers, paintAccountStatus } from './ui/account-section.js';
import { chosenTemplate, currentStep, dismiss, isAskingMissing, paintEntry } from './ui/entry.js';
import { restoreFolds } from './ui/folds.js';
import { fadeIn } from './ui/motion.js';
import { entryOpen, onNavigate, openFicha } from './ui/navigation.js';
import { cardRecord, dismissReview, forgetRecordUi, recordContext } from './ui/record.js';
import { scrollToTop } from './ui/scroller.js';
import { paintBackup } from './ui/settings-page.js';
import { compareView, trendView, yearlyView } from './views/compare.js';
import { fichaView } from './views/ficha.js';
import { fillForm, paintForm } from './views/form.js';
import { offersListView, skeletonCardsView, templatesView } from './views/offers-list.js';
import { sharedView } from './views/shared.js';

/** What the page remembers while open, not saved. */
const ui = {
  /** A saved session is connecting and the browser has no offers of its own: skeleton cards instead of the list. */
  loadingAccount: false,
};

/** Takes effect at the next paint. */
export const setLoadingAccount = (/** @type {boolean} */ loading) => {
  ui.loadingAccount = loading;
};

/* --- Painting --- */

/** Marks in the step opened because something is missing in it what is missing there. */
function markMissing() {
  const o = active();
  const step = currentStep().id;
  const shortfall = isAskingMissing() ? missing(o.terms).filter((id) => STEP_OF_MISSING[id] === step) : [];
  // Several things can point at one field (the pay questions have a single amount)
  for (const selector of new Set(Object.values(FIELD_OF_MISSING)))
    $(selector)
      .closest('.fld')
      .classList.toggle(
        'missing',
        shortfall.some((what) => FIELD_OF_MISSING[what] === selector),
      );
}

/** Your offers with their figures: full, or from their terms alone when that is on. */
const compared = () =>
  myOffers().map((o) => ({ o, r: state.termsOnly ? calcTermsOnly(o, { cfg: state.config }) : calcOffer(o) }));

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

/** Comparar: your offers only. */
export function paintCompare() {
  const own = compared();
  const { picker, body, more } = compareView({
    scope: 'compare',
    everything: own,
    unit: state.cmpUnit,
    termsOnly: state.termsOnly,
    others: state.others,
    pairing: state.pairing,
    showOfferOnly: state.showOfferOnly,
    moneyOnly: state.moneyOnly,
  });
  render(picker, $('#cmpView'));
  render(body, $('#cmpBlk'));
  render(more, $('#cmpMore'));
  restoreFolds($('#cmpBlk'));
  restoreFolds($('#cmpMore'));
  paintTimeline(own);
}

/**
 * Otros pastores: your offers and other shepherds' ranked together on terms alone, so like is compared with like
 * (ADR-0013). Only while sharing makes them readable.
 */
export function paintOthers() {
  const { available } = state.others;
  for (const id of ['#othersView', '#othersRank', '#othersMore']) $(id).hidden = !available;
  const others = available ? comparedOthers() : [];
  if (available) {
    for (const { o } of state.others.items) needPlacesFor(o);
    const own = myOffers().map((o) => ({ o, r: calcTermsOnly(o, { cfg: state.config }) }));
    const { picker, body, more } = compareView({
      scope: 'others',
      everything: [...own, ...others],
      unit: state.cmpUnit,
      termsOnly: true,
      others: state.others,
      pairing: state.pairing,
      showOfferOnly: state.showOfferOnly,
      moneyOnly: state.moneyOnly,
    });
    render(picker, $('#othersView'));
    render(body, $('#othersRank'));
    render(more, $('#othersMore'));
  } else for (const id of ['#othersView', '#othersRank', '#othersMore']) render('', $(id)); // nothing of theirs is left in the page
  restoreFolds($('#othersRank'));
  restoreFolds($('#othersMore'));
  paintShared(others);
}

/** The read-only view of the shared offer opened, in place of the Otros pastores tab's content. `others`: `comparedOthers()`. */
function paintShared(others) {
  const open = state.others.available && state.others.viewId !== null;
  const shown = open ? others.find((x) => x.o.id === state.others.viewId) : undefined;
  $('#othersMain').hidden = !!shown;
  $('#sharedBlk').hidden = !shown;
  if (shown) needPlacesFor(shown.o);
  render(shown ? sharedView(shown, placesIfLoaded()) : '', $('#sharedBlk'));
  restoreFolds($('#sharedBlk'));
}

/** Opens (or closes, with null) another shepherd's offer. */
export function viewShared(id) {
  state.others.viewId = id;
  paintShared(comparedOthers());
  scrollToTop(0);
}

/** «Cuándo»: what you are paid over time and each year's summary. Only with worked offers (dated, not «solo oferta»). */
function paintTimeline(all = compared()) {
  const dated = workedOffers(all.map((x) => x.o)).length > 0;
  $('#tlBlk').hidden = !dated;
  render(dated ? trendView(all, state.cmpUnit, $('#cmpBlk').clientWidth) : '', $('#trend'));
  render(dated ? yearlyView(all) : '', $('#yearly'));
}

/**
 * Repaints everything from the state. `animate`: fade in the form fields that appear, only after the form was
 * touched, not when switching offers or starting.
 */
export function paintAll({ animate = false } = {}) {
  const o = active();
  const r = calcOffer(o);
  needPlacesFor(o);
  const loading = ui.loadingAccount;
  render(
    loading
      ? skeletonCardsView()
      : offersListView(
          myOffers().map((x) => ({ o: x, r: calcOffer(x), record: cardRecord(x) })),
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
  const phase = phaseOf(o, todayISO());
  $('#fichaPhase').hidden = !(phase in PHASE_TEXT);
  $('#fichaPhase').textContent = PHASE_TEXT[phase] ?? '';
  $('#fichaPhase').dataset.phase = phase;
  render(fichaView(o, r, placesIfLoaded(), recordContext(o)), $('#result'));
  restoreFolds($('#result'));
  const appeared = paintForm(o, r, myOffers(), placesNow());
  if (animate) for (const el of appeared) fadeIn(el);
  render(templatesView(chosenTemplate()), $('#tplGrid'));
  if (entryOpen()) paintEntry(o, r);
  markMissing();
  paintCompare();
  paintOthers();
  paintBackup();
  paintAccountStatus();
}

/** Saves the offers and repaints; `animate` as in `paintAll`. */
export function commit({ animate = false } = {}) {
  offers.save();
  paintAll({ animate });
}

/** Makes an offer the active one, in the form and in the ficha. */
export function select(id) {
  forgetRecordUi(id);
  defaultVacation(state.offers.find((o) => o.id === id).terms);
  offers.select(id);
  show();
}

/**
 * Shows the active offer after an `offers` transition that already selected and saved it (adding, choosing a template,
 * importing): saves again only if the vacation default changed it.
 */
export function showSelected() {
  if (defaultVacation(active().terms)) offers.save();
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
    if (tab === 'compare') paintTimeline(); // the trend fits the width, which is only known once shown
    if (tab === 'others') loadOthers(); // refetched on each visit, not on every repaint
  },
  pageOpened(fromPrompt) {
    paintBackup();
    paintAccountStatus({ chooser: fromPrompt });
  },
  viewChanged: () => paintAll(),
  entryDismissed: dismiss,
  reviewDismissed: () => {
    dismissReview();
    paintAll();
  },
});

/** Opens the named collapsibles of the static page as you left them. */
export const restoreStaticFolds = () => restoreFolds(document);
