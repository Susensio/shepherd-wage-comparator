/**
 * The controller: paints every view from the state, and the things the page does that more than one event needs
 * (choosing an offer, the templates panel, «Hecho», the tabs).
 */

import { render } from 'lit-html';
import { joinAnd } from './format.js';
import { defaultVacation, missing } from './offer.js';
import { active, calcOffer, myOffers, saveOffers, saveTab, state } from './state.js';
import { MISSING_TEXT } from './text.js';
import { $, $$ } from './ui/dom.js';
import { restoreFolds } from './ui/folds.js';
import { cancelScroll, openEditor, scrollToElement, setNavHeight, toggleFold } from './ui/motion.js';
import { compareView, trendView, yearlyView } from './views/compare.js';
import { fillForm, fillVacation, paintForm } from './views/form.js';
import { chipsView, templatesView } from './views/offers-bar.js';
import { resultView } from './views/result.js';
import { paintBackup } from './views/settings.js';

/** What the page remembers while open, not saved. */
const ui = {
  /** Fade in the form fields that appear: only after you touch the form, not when switching offers or starting. */
  animateFields: false,
  /** Bring the active chip into view on the next paint. */
  scrollChips: false,
  /** The offer where you pressed «Hecho» with data missing: the missing fields are marked until you fill them in. */
  askedToSee: /** @type {string | null} */ (null),
};

export const animateNextPaint = () => {
  ui.animateFields = true;
};
export const scrollChipsNextPaint = () => {
  ui.scrollChips = true;
};

/* --- The offers bar --- */

/** Fades the chips' edge on the side where there are more, to show they scroll; up to 28 px as you scroll. */
export function chipEdges() {
  const chips = $('#chips');
  const max = Math.max(0, chips.scrollWidth - chips.clientWidth);
  chips.style.setProperty('--fade-l', `${Math.min(28, chips.scrollLeft)}px`);
  chips.style.setProperty('--fade-r', `${Math.min(28, max - chips.scrollLeft)}px`);
}

function paintChips() {
  const chips = $('#chips');
  const keep = chips.scrollLeft;
  render(chipsView(myOffers(), state.activeId), chips);
  const first = !!state.placeholderId;
  $('nav.offers').hidden = first;
  $('#welcome').hidden = !first;
  $('#intro').hidden = first;
  chips.scrollLeft = keep;
  chipEdges();
  const current = $('#chips [aria-current="true"]');
  if (current && ui.scrollChips) {
    const left = current.offsetLeft - chips.offsetLeft;
    if (left < chips.scrollLeft || left + current.offsetWidth > chips.scrollLeft + chips.clientWidth)
      chips.scrollLeft = Math.max(0, left - 16);
    ui.scrollChips = false;
  }
}

/* --- Painting --- */

/** The form field where each thing `missing()` reports goes. */
const MISSING_FIELD = {
  agreedTotal: '#totalAmount',
  duration: '#duration',
  hoursPerDay: '#hoursPerDay',
  pay: '#payAmount',
  cashInHand: '#cashAmount',
  vacation: 'input[name=vacation]',
};

/** Marks in the form what is missing to see the result, once you have asked to see it. */
export function markMissing() {
  const o = active();
  const shortfall = ui.askedToSee === o.id ? missing(o.terms) : [];
  for (const [what, selector] of Object.entries(MISSING_FIELD))
    $(selector).closest('.fld').classList.toggle('missing', shortfall.includes(what));
  $('#goMsg').textContent = shortfall.length ? `Falta ${joinAnd(shortfall.map((id) => MISSING_TEXT[id]))}.` : '';
}

function paintCompare() {
  const all = myOffers().map((o) => ({ o, r: calcOffer(o) }));
  const { picker, body } = compareView(all, state.cmpUnit);
  render(picker, $('#cmpView'));
  render(body, $('#cmpBlk'));
  restoreFolds($('#cmpBlk'));
  paintTimeline(all);
}

/** «Cuándo»: what you are paid over time and each year's summary. Only with dated offers. */
function paintTimeline(all = myOffers().map((o) => ({ o, r: calcOffer(o) }))) {
  const dated = all.some(({ o }) => o.terms.start);
  $('#tlBlk').hidden = !dated;
  render(dated ? trendView(all, state.cmpUnit, $('#cmpBlk').clientWidth) : '', $('#trend'));
  render(dated ? yearlyView(all) : '', $('#yearly'));
}

/** Repaints everything from the state. */
export function paintAll() {
  setTimeout(setNavHeight);
  const o = active();
  const r = calcOffer(o);
  paintChips();
  paintForm(o, r, myOffers(), ui.animateFields);
  ui.animateFields = false;
  markMissing();
  render(resultView(o, r), $('#result'));
  restoreFolds($('#result'));
  paintCompare();
  paintBackup();
}

/** Saves the offers and repaints. */
export function commit() {
  saveOffers();
  paintAll();
}

/** Shows an offer: in the form and in the result. */
export function select(id) {
  state.activeId = id;
  const o = active();
  defaultVacation(o.terms);
  saveOffers();
  fillForm(o);
  paintAll();
}

/* --- Templates --- */

/** While you pick a template, the offer and the rest are hidden (body.choosing, in the CSS). */
function setFocusMode(on) {
  document.body.classList.toggle('choosing', on);
  $('#btnAdd').textContent = on ? '× Cancelar' : '+ Nueva';
}

export const templatesOpen = () => !$('#tplPanel').hidden;

export function openTemplates() {
  render(templatesView(), $('#tplGrid'));
  $('#tplPanel').hidden = false;
  setFocusMode(true);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (!state.placeholderId) $('#tplGrid button')?.focus({ preventScroll: true });
}

export function closeTemplates() {
  $('#tplPanel').hidden = true;
  setFocusMode(false);
  if (state.placeholderId) {
    state.placeholderId = null;
    saveOffers();
    openEditor(true);
    paintChips();
  }
}

/* --- «Hecho» --- */

/**
 * «Hecho». If something is missing it takes you there and stays open; if not, it folds the form and scrolls to the
 * result. From the top (the form's own title), the fold is animated first and then it scrolls; done together, the
 * target moves meanwhile and it overshoots.
 */
export function done(fromTop) {
  const o = active();
  const shortfall = missing(o.terms);
  const results = $('#results');
  if (!shortfall.length) {
    ui.askedToSee = null;
    $('#goMsg').textContent = '';
    /** @type {HTMLElement | null} */ (document.activeElement)?.blur?.();
    if (fromTop) {
      const folding = toggleFold(/** @type {HTMLDetailsElement} */ ($('#editWrap')), false);
      (folding ? folding.finished : Promise.resolve()).catch(() => {}).then(() => scrollToElement(results));
      return;
    }
    // Folding the form makes the result jump up: compensate so it stays put, then scroll to it
    cancelScroll();
    const before = results.getBoundingClientRect().top;
    openEditor(false);
    window.scrollTo({ top: Math.max(0, scrollY + results.getBoundingClientRect().top - before), behavior: 'instant' });
    scrollToElement(results);
    return;
  }
  ui.askedToSee = o.id;
  markMissing();
  const field = $(MISSING_FIELD[shortfall[0]]);
  const section = /** @type {HTMLDetailsElement | null} */ (field.closest('details.sec'));
  if (section) section.open = true;
  scrollToElement(field.closest('.fld'), 'center');
  field.focus({ preventScroll: true });
}

/* --- Tabs --- */

const TABS = ['offers', 'compare', 'laws', 'settings'];

/** Shows a tab. With `scrollUp`, if the page is further down, it goes back up to the tabs. */
export function showTab(tab, scrollUp) {
  const shown = TABS.includes(tab) ? tab : 'offers';
  for (const t of TABS) {
    $(`[data-panel=${t}]`).hidden = t !== shown;
    $(`.tabs [data-tab=${t}]`).setAttribute('aria-selected', String(t === shown));
  }
  saveTab(shown);
  if (shown === 'settings') paintBackup();
  if (shown === 'compare') paintTimeline(); // the trend fits the width, which is only known once shown
  if (shown === 'offers') {
    ui.scrollChips = true;
    paintChips();
  }
  const tabs = $('.tabs');
  if (scrollUp && tabs.getBoundingClientRect().top < 0) window.scrollTo({ top: tabs.offsetTop });
}

/** Opens the named collapsibles of the static page as you left them. */
export const restoreStaticFolds = () => restoreFolds(document);

/** The fields of «Datos de la oferta» that open with a new offer. */
export const openFirstSections = () => {
  for (const d of /** @type {HTMLDetailsElement[]} */ ($$('[data-fold=time],[data-fold=payroll]'))) d.open = true;
};

export { fillVacation };
