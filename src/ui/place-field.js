/** The «Pueblo» field: a combobox over the place list. Typing suggests; picking fills the municipality and province. */

import { html, render } from 'lit-html';
import { searchPlaces } from '../places.js';
import { active } from '../state.js';
import { loadPlaces, onPlacesChange, placesIfLoaded } from '../storage/places.js';
import { areaLine } from '../text.js';
import { $ } from './dom.js';

/** @type {import('../places.js').Place[]} */
let suggestions = [];
let highlighted = -1;
/** @type {() => void} */
let commit = () => {};

const input = () => /** @type {HTMLInputElement} */ ($('#place'));
const optionId = (i) => `placeOption${i}`;

function paintList() {
  const open = suggestions.length > 0;
  render(
    suggestions.map(
      (place, i) =>
        html`<li role="option" id=${optionId(i)} data-index=${i} aria-selected=${String(i === highlighted)}><b>${place.name}</b><span>${areaLine(place)}</span></li>`,
    ),
    $('#placeList'),
  );
  $('#placeList').hidden = !open;
  input().setAttribute('aria-expanded', String(open));
  if (highlighted >= 0) input().setAttribute('aria-activedescendant', optionId(highlighted));
  else input().removeAttribute('aria-activedescendant');
  $('#placeList').querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' });
}

function suggest() {
  const index = placesIfLoaded();
  suggestions = index ? searchPlaces(index, input().value) : [];
  highlighted = -1;
  paintList();
}

function close() {
  suggestions = [];
  highlighted = -1;
  paintList();
}

function pick(i) {
  const place = suggestions[i];
  const o = active();
  o.mine.place = place.name;
  o.terms.municipality = place.municipalityCode;
  o.terms.province = place.provinceCode;
  input().value = place.name;
  close();
  commit();
}

/** Typing replaces what was picked: the codes go, the text stays as yours. */
function onInput() {
  const o = active();
  o.mine.place = input().value;
  o.terms.municipality = '';
  o.terms.province = '';
  suggest();
  commit();
}

function onKeyDown(e) {
  const count = suggestions.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!count) suggest();
    if (!suggestions.length) return;
    e.preventDefault();
    const step = e.key === 'ArrowDown' ? 1 : -1;
    highlighted = (highlighted + step + suggestions.length) % suggestions.length;
    paintList();
  } else if (e.key === 'Enter' && count) {
    e.preventDefault();
    if (highlighted >= 0) pick(highlighted);
  } else if (e.key === 'Escape' && count) {
    e.preventDefault();
    close();
  }
}

/** «Cambiar»: the codes go, the village stays selected to type over. */
export function changePlace() {
  const o = active();
  o.terms.municipality = '';
  o.terms.province = '';
  commit();
  input().focus();
  input().select();
  suggest();
}

/**
 * @param {{ commit: () => void, paint: () => void }} callbacks `commit` saves and repaints after an edit; `paint`
 *   only repaints, when the list arrives.
 */
export function setUpPlaceField(callbacks) {
  commit = callbacks.commit;
  const field = input();
  field.addEventListener('input', onInput);
  field.addEventListener('keydown', onKeyDown);
  field.addEventListener('focus', () => {
    // Where the list is held back (data saving), the field asks for it
    loadPlaces().catch(console.warn);
    suggest();
  });
  field.addEventListener('focusout', close);
  const list = $('#placeList');
  // The tap must not take focus from the field, or the list would close before the click
  list.addEventListener('mousedown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const option = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest('[data-index]'));
    if (option) pick(Number(option.dataset.index));
  });
  onPlacesChange(() => {
    callbacks.paint();
    if (document.activeElement === field) suggest();
  });
}
