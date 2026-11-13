/**
 * The guided entry: one step at a time, in order for a new offer (a template first), or a single step opened from the
 * ficha to change it, where «Cancelar» puts the offer back as it was. What is typed in a step is read into the offer
 * by `events.js`; a new offer is saved on every change, a changed step only on «Guardar» (`offers.hold`). This moves
 * between steps and says where the reader is.
 */

import { $, $$ } from '../dom.js';
import { makeOffer, missing, TEMPLATES } from '../offer.js';
import { offers } from '../offers.js';
import { active, state } from '../state.js';
import { STEP_OF_MISSING, STEPS } from '../steps.js';
import { preloadPlaces } from '../storage/places.js';
import { fUnit, inUnit, offerUnit } from '../units.js';
import { closeEntry, entryOpen, entryToFicha, openEntry } from './navigation.js';
import { scrollToTop } from './scroller.js';

const entry = {
  /** Index in `STEPS` of the step shown. */
  step: 0,
  /** One step opened from the ficha, instead of the whole entry. */
  editing: false,
  /** The offer as it was when the step was opened, for «Cancelar». */
  snapshot: /** @type {any} */ (null),
  /** The offer made from the template picked in this entry. */
  createdId: /** @type {string | null} */ (null),
  template: /** @type {string | null} */ (null),
  /** The step was opened because something is missing in it: the fields are marked. */
  asked: false,
  /** The first-visit welcome was left for the templates. Without it, a first visit shows the welcome. */
  started: false,
  /** …by its button, so that going back returns to it. */
  welcomed: false,
  /** The new offer as it was when its template was picked, to tell whether anything was typed since. */
  picked: '',
  /** The template tapped once while something typed would be lost: a second tap confirms. */
  armed: /** @type {string | null} */ (null),
};

/** @type {{ paint: () => void, select: (id: string) => void, showSelected: () => void }} */
const callbacks = { paint: () => {}, select: () => {}, showSelected: () => {} };
/** @param {typeof callbacks} given `paint` repaints everything; `select` shows an offer; `showSelected` the one an `offers` transition just selected and saved */
export function setUpEntry(given) {
  Object.assign(callbacks, given);
}

/** A first visit that has not left the welcome yet. */
const isWelcoming = () => !!state.placeholderId && entry.step === 0 && !entry.editing && !entry.started;

export const currentStep = () => STEPS[entry.step];
export const chosenTemplate = () => entry.template;
/** Whether the fields missing in the step shown are marked. */
export const isAskingMissing = () => entryOpen() && entry.editing && entry.asked;

function show(index) {
  entry.step = index;
  entry.armed = null;
  if (STEPS[index].id === 'offer') preloadPlaces();
  callbacks.paint();
  scrollToTop(0, 'instant');
  $(isWelcoming() ? '#welcomeTitle' : '#entryTitle').focus({ preventScroll: true });
}

/** A new offer: from the templates. `inPlaceOfFicha`: the ficha's offer was just deleted. */
export function startEntry(inPlaceOfFicha = false) {
  Object.assign(entry, {
    editing: false,
    snapshot: null,
    createdId: null,
    template: null,
    asked: false,
    picked: '',
    armed: null,
  });
  openEntry(inPlaceOfFicha);
  show(0);
}

/** One step of the active offer, to change it. `asked`: because something is missing in it. */
export function editStep(id, asked = false) {
  Object.assign(entry, { editing: true, snapshot: structuredClone(active()), asked });
  offers.hold();
  openEntry();
  show(STEPS.findIndex((step) => step.id === id));
}

/** A new offer's name, not repeating one you have (but its own, if it is replaced). */
function uniqueName(base, ignoring) {
  const others = state.offers.filter((o) => o.id !== ignoring);
  let name = base;
  for (let i = 2; others.some((o) => o.mine.name === name); i++) name = `${base} ${i}`;
  return name;
}

/** The template picked starts the offer (or restarts it, if one was made already in this entry); on to the next step. */
export function pickTemplate(id) {
  const template = TEMPLATES.find((t) => t.id === id);
  const old = state.offers.find((o) => o.id === entry.createdId);
  // Another template replaces what was typed: the first tap only warns
  if (old && entry.armed !== id && JSON.stringify({ terms: old.terms, mine: old.mine }) !== entry.picked) {
    entry.armed = id;
    return callbacks.paint();
  }
  entry.armed = null;
  const fresh = makeOffer(template?.terms, {
    ...template?.mine,
    name: uniqueName(template?.title || 'Oferta', old?.id),
  });
  entry.createdId = old?.id ?? fresh.id;
  entry.template = id;
  if (old) {
    Object.assign(old, { terms: fresh.terms, mine: fresh.mine });
    callbacks.select(old.id);
  } else {
    offers.chooseTemplate(fresh);
    callbacks.showSelected();
  }
  const made = state.offers.find((o) => o.id === entry.createdId);
  entry.picked = JSON.stringify({ terms: made?.terms, mine: made?.mine });
  show(1);
}

/** Back, «Cerrar» or «Cancelar»: a step goes back as it was; a new offer stays as it is (a first visit keeps its blank one). */
export function dismiss() {
  if (entry.editing) {
    const o = active();
    if (entry.snapshot && o) Object.assign(o, structuredClone(entry.snapshot));
    offers.release(false);
  } else if (state.placeholderId) offers.keepPlaceholder();
  entry.snapshot = null;
}

export function close() {
  dismiss();
  closeEntry();
  callbacks.paint();
}

/** «Guardar»: the step changed is saved now, and the entry closes. */
export function save() {
  offers.release(true);
  entry.snapshot = null;
  closeEntry();
  callbacks.paint();
}

/** «Siguiente»: to the next step, or on the last one, to the ficha. */
export function next() {
  if (entry.editing) return save();
  if (entry.step < STEPS.length - 1) return show(entry.step + 1);
  entryToFicha();
  callbacks.paint();
}

/** «Empezar»: from the welcome to the templates. */
export function leaveWelcome() {
  Object.assign(entry, { started: true, welcomed: true });
  show(0);
}

/** The arrow: the step before, back to the welcome, or out of the entry. */
export function back() {
  if (entry.welcomed && !entry.editing && entry.step === 0) {
    Object.assign(entry, { started: false, welcomed: false });
    return show(0);
  }
  if (entry.editing || entry.step === 0) return close();
  show(entry.step - 1);
}

/** The step where the first thing missing goes. */
export const stepOfMissing = (terms) => STEP_OF_MISSING[missing(terms)[0]];

/** What the entry shows: the step, the progress and the earnings so far. `r`: the active offer's figures. */
export function paintEntry(o, r) {
  const index = entry.step;
  const step = STEPS[index];
  const edit = entry.editing;
  const pending = index === 0 && !entry.createdId && !edit;
  for (const section of $$('#entry .step')) section.hidden = section.dataset.step !== step.id;
  const welcoming = isWelcoming();
  $('#entry').classList.toggle('welcoming', welcoming);
  $('#entryTitle').textContent = step.title;
  $('#entryCounter').textContent = edit ? 'Cambiar' : `Paso ${index + 1} de ${STEPS.length}`;
  $('#entryClose').textContent = edit ? 'Cancelar' : 'Cerrar';
  $('#entryBack').setAttribute('aria-label', edit ? 'Cancelar' : index === 0 ? 'Cerrar' : 'Paso anterior');
  /** @type {HTMLElement} */ ($('#entryBar').parentElement).hidden = edit;
  $('#entryBar').style.width = `${Math.round(((index + 1) / STEPS.length) * 100)}%`;
  $('#entryNext').hidden = pending;
  $('#entryNext').textContent = edit ? 'Guardar' : index === STEPS.length - 1 ? 'Ver la ficha' : 'Siguiente';
  $('.strip').hidden = pending;
  const unit = offerUnit(r, o.terms);
  $('#stripLabel').textContent = `Se gana ${unit === 'day' ? 'al día' : 'al mes'}, por ahora`;
  $('#stripFigure').textContent = missing(o.terms).length
    ? 'sin calcular'
    : fUnit(inUnit(r.earnings.total, r, unit), unit);
  $('#tplWarn').hidden = !entry.armed;
  $('#welcome').hidden = !welcoming;
  document.body.classList.toggle('welcome', !!state.placeholderId && index === 0 && !edit);
}

/** Every offer was replaced (the account's): a step held open is abandoned, nothing of it is saved. */
export function abandonEntry() {
  if (entry.editing) offers.release(false);
  entry.snapshot = null;
}
