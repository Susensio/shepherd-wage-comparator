/**
 * The two questions the ficha asks at the turns of a job (ADR-0034): «¿Empezó el trabajo el <fecha>?» and
 * «¿Cómo acabó?». Cards above the phase block; nothing is asked twice once answered.
 */

import { html, nothing } from 'lit-html';
import { fDate } from '../format.js';
import { parseDate } from '../offer.js';

/** @typedef {NonNullable<import('../ui/record.js').RecordContext['cards']>} Cards */

const fIso = (iso) => fDate(parseDate(iso));

/** How a job can have ended, as the buttons say it; `agreed` and `later` are only asked of a job that finished. */
const ENDS = /** @type {const} */ ([
  ['agreed', 'Al final pactado'],
  ['dismissed', 'Lo despidió el ganadero o lo acabó antes'],
  ['quit', 'Se dejó'],
  ['sick', 'Baja médica o accidente'],
]);

/** The words of each way, for the line that remembers the answer. */
export const END_TEXT = {
  agreed: 'al final pactado',
  dismissed: 'lo despidió el ganadero o lo acabó antes',
  quit: 'se dejó',
  sick: 'baja médica o accidente',
};

/** @param {Cards['start']} start */
function startCard(start, today) {
  if (!start) return nothing;
  return html`<div class="tcard-q" role="group" aria-label="¿Empezó el trabajo?">
    <h3>¿Empezó el trabajo el ${fIso(start.date)}?</h3>
    ${
      start.other
        ? html`<label class="fld">Otra fecha<input type="date" id="startOther" .value=${start.date} max=${today} /></label>
          <div class="actions"><button type="button" class="pri sm" data-action="saveStart">Guardar</button><button type="button" class="sm" data-action="startOtherCancel">Cancelar</button></div>`
        : html`<div class="actions"><button type="button" class="pri sm" data-action="confirmStart">Sí</button><button type="button" class="sm" data-action="startOther">Otra fecha</button><button type="button" class="sm" data-action="notTaken">No se cogió: solo oferta</button></div>`
    }
  </div>`;
}

/** @param {Cards['end']} end */
function endCard(end, today) {
  if (!end) return nothing;
  if (end.how)
    return html`<div class="tcard-q" role="group" aria-label="¿Cómo acabó?">
      <h3>¿Qué día acabó? <small>${END_TEXT[end.how]}</small></h3>
      <label class="fld">Fecha<input type="date" id="endDate" .value=${end.date} max=${today} /></label>
      <div class="actions"><button type="button" class="pri sm" data-action="saveEnd" data-how=${end.how}>Guardar</button><button type="button" class="sm" data-action="endCancel">Cancelar</button></div>
    </div>`;
  const ways = ENDS.filter(([how]) => !end.early || how !== 'agreed');
  return html`<div class="tcard-q" role="group" aria-label="¿Cómo acabó?">
    <h3>¿Cómo acabó?</h3>
    <div class="choices">${ways.map(([how, text]) => html`<button type="button" class="sm" data-action="pickEnd" data-how=${how}>${text}</button>`)}${
      end.early ? nothing : html`<button type="button" class="sm" data-action="endLonger">Sigue, se alargó</button>`
    }</div>
    ${end.early ? html`<div class="actions"><button type="button" class="linkbtn" data-action="endCancel">Cancelar</button></div>` : nothing}
  </div>`;
}

/** The question of how it began, at the top of the ficha. */
export const startQuestion = (/** @type {Cards | null} */ cards, today) => startCard(cards?.start ?? null, today);

/**
 * The question of how it ended. Asked by hand it goes at the top; asked of a finished job on its own it waits under the
 * yellow block, so the result stays on the first screen (`atTop` says which).
 */
export const endQuestion = (/** @type {Cards | null} */ cards, today, /** @type {boolean} */ atTop) =>
  cards?.end && cards.end.early === atTop ? endCard(cards.end, today) : nothing;

/** «Acabó el 6 nov 2026: lo despidió…» with a way to change it, once the end was said. */
export function endLine(record) {
  if (!record?.end) return nothing;
  return html`<p class="real">Acabó el ${fIso(record.end.date)}: ${END_TEXT[record.end.how]}. <button type="button" class="linkbtn" data-action="endedEarly">Cambiar</button></p>`;
}
