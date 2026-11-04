/**
 * The guided entry: one step at a time, in order for a new offer (a template first), or a single step opened from the
 * ficha to change it, where «Cancelar» puts the offer back as it was. What is typed in a step is read into the offer
 * by `events.js` and saved on every change; this only moves between steps and says where the reader is.
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
};

/** @type {{ paint: () => void, select: (id: string) => void }} */
const callbacks = { paint: () => {}, select: () => {} };
/** @param {typeof callbacks} given `paint` repaints everything; `select` shows an offer */
export function setUpEntry(given) {
  Object.assign(callbacks, given);
}

export const currentStep = () => STEPS[entry.step];
export const chosenTemplate = () => entry.template;
/** Whether the fields missing in the step shown are marked. */
export const isAskingMissing = () => entryOpen() && entry.editing && entry.asked;

function show(index) {
  entry.step = index;
  if (STEPS[index].id === 'offer') preloadPlaces();
  callbacks.paint();
  scrollToTop(0, 'instant');
  $('#entryTitle').focus({ preventScroll: true });
}

/** A new offer: from the templates. */
export function startEntry() {
  Object.assign(entry, { editing: false, snapshot: null, createdId: null, template: null, asked: false });
  openEntry();
  show(0);
}

/** One step of the active offer, to change it. `asked`: because something is missing in it. */
export function editStep(id, asked = false) {
  Object.assign(entry, { editing: true, snapshot: structuredClone(active()), asked });
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
  const fresh = makeOffer(template?.terms, {
    ...template?.mine,
    name: uniqueName(template?.title || 'Oferta', old?.id),
  });
  if (old) Object.assign(old, { terms: fresh.terms, mine: fresh.mine });
  else offers.chooseTemplate(fresh);
  entry.createdId = old?.id ?? fresh.id;
  entry.template = id;
  callbacks.select(entry.createdId);
  show(1);
}

/** Back, «Cerrar» or «Cancelar»: a step goes back as it was; a new offer stays as it is (a first visit keeps its blank one). */
export function dismiss() {
  if (entry.editing) {
    const o = active();
    if (entry.snapshot && o) Object.assign(o, structuredClone(entry.snapshot));
    offers.save();
  } else if (state.placeholderId) offers.keepPlaceholder();
  entry.snapshot = null;
}

export function close() {
  dismiss();
  closeEntry();
  callbacks.paint();
}

/** «Guardar»: the step was saved as it was typed; only the entry closes. */
export function save() {
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

/** The arrow: the step before, or out of the entry. */
export function back() {
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
  $('#entryTitle').textContent = step.title;
  $('#entryCounter').textContent = edit ? 'Cambiar' : `Paso ${index + 1} de ${STEPS.length}`;
  $('#entryClose').textContent = edit ? 'Cancelar' : 'Cerrar';
  $('#entryBack').setAttribute('aria-label', edit ? 'Cancelar' : index === 0 ? 'Cerrar' : 'Paso anterior');
  /** @type {HTMLElement} */ ($('#entryBar').parentElement).hidden = edit;
  $('#entryBar').style.width = `${Math.round(((index + 1) / STEPS.length) * 100)}%`;
  $('#entryNext').hidden = pending;
  $('#entryNext').textContent = edit ? 'Guardar' : index === STEPS.length - 1 ? 'Ver la ficha' : 'Siguiente';
  $('.strip').hidden = pending;
  const unit = offerUnit(r);
  $('#stripLabel').textContent = `Ganas ${unit === 'day' ? 'al día' : 'al mes'}, por ahora`;
  $('#stripFigure').textContent = missing(o.terms).length ? '—' : fUnit(inUnit(r.earnings.total, r, unit), unit);
  const welcome = !!state.placeholderId && index === 0 && !edit;
  $('#welcome').hidden = !welcome;
  document.body.classList.toggle('welcome', welcome);
}
