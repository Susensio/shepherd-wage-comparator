/**
 * The two questions the ficha asks at the turns of a job (ADR-0034): «¿Empezó el trabajo el <fecha>?» and
 * «¿Cómo acabó?». Cards above the phase block; nothing is asked twice once answered.
 */

import { html, nothing } from 'lit-html';
import { fDate } from '../format.js';
import { parseDate } from '../offer.js';

/** @typedef {NonNullable<import('../ui/record.js').RecordContext['cards']>} Cards */

const fIso = (iso) => fDate(parseDate(iso));

/** How a job can have ended, as the buttons say it; the first is only asked of a job that finished on its own. */
const ENDS = /** @type {const} */ ([
  ['dismissed', 'Despido, o el ganadero lo acabó antes'],
  ['quit', 'Lo dejó el pastor o la pastora'],
]);

/** The words of each way, for the line that remembers the answer. */
export const END_TEXT = {
  agreed: 'al final pactado',
  dismissed: 'despido, o el ganadero lo acabó antes',
  quit: 'lo dejó el pastor o la pastora',
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

/** An error line, said once under the date. */
const problem = (error) => (error ? html`<p class="hint bad" role="alert">${error}</p>` : nothing);

/** The date of an answer: empty, required, between the job's start and today. */
const dateField = (id, label, min, max) =>
  html`<label class="fld">${label}<input type="date" id=${id} min=${min} max=${max} required /></label>`;

/** @param {Cards['end']} end */
function endCard(end, today) {
  if (!end) return nothing;
  if (end.how === 'sick')
    return html`<div class="tcard-q" role="group" aria-label="¿Cómo acabó?">
      <h3>¿Desde qué día está de baja? <small>Baja médica o accidente: el trabajo no acaba, el contrato queda suspendido.</small></h3>
      ${dateField('endDate', 'Desde el', end.min, today)}${problem(end.error)}
      <div class="actions"><button type="button" class="pri sm" data-action="saveSick">Guardar</button><button type="button" class="sm" data-action="endCancel">Cancelar</button></div>
    </div>`;
  if (end.how)
    return html`<div class="tcard-q" role="group" aria-label="¿Cómo acabó?">
      <h3>¿Qué día acabó? <small>${END_TEXT[end.how]}</small></h3>
      ${dateField('endDate', 'Fecha', end.min, today)}${problem(end.error)}
      <div class="actions"><button type="button" class="pri sm" data-action="saveEnd" data-how=${end.how}>Guardar</button><button type="button" class="sm" data-action="endCancel">Cancelar</button></div>
    </div>`;
  return html`<div class="tcard-q" role="group" aria-label="¿Cómo acabó?">
    <h3>¿Cómo acabó?</h3>
    <div class="choices">${end.early ? nothing : html`<button type="button" class="sm" data-action="pickEnd" data-how="agreed">${end.seasonal ? 'Fin de campaña' : 'Al final pactado'}</button>`}${ENDS.map(([how, text]) => html`<button type="button" class="sm" data-action="pickEnd" data-how=${how}>${text}</button>`)}<button type="button" class="sm" data-action="pickEnd" data-how="sick">Baja médica o accidente</button>${
      end.early ? nothing : html`<button type="button" class="sm" data-action="endLonger">Sigue, se alargó</button>`
    }</div>
    ${end.early ? html`<div class="actions"><button type="button" class="linkbtn" data-action="endCancel">Cancelar</button></div>` : nothing}
  </div>`;
}

/** @param {Cards['recall']} recall */
function recallCard(recall, today) {
  if (!recall) return nothing;
  return html`<div class="tcard-q" role="group" aria-label="¿Se llamó para la campaña?">
    <h3>¿Se llamó para la campaña de ${recall.year}?${recall.no ? '' : html`<small>En un fijo discontinuo, no llamar al pastor es un despido.</small>`}</h3>
    ${
      recall.no
        ? html`${dateField('recallDate', '¿Desde qué día se supo que no se llamaba?', recall.min, today)}${problem(recall.error)}
          <div class="actions"><button type="button" class="pri sm" data-action="recallNoSave">Guardar</button><button type="button" class="sm" data-action="recallNoCancel">Cancelar</button></div>`
        : html`<div class="actions"><button type="button" class="pri sm" data-action="recallYes">Sí</button><button type="button" class="sm" data-action="recallNo">No</button></div>`
    }
  </div>`;
}

/** The question of how it began, at the top of the ficha. */
export const startQuestion = (/** @type {Cards | null} */ cards, today) => startCard(cards?.start ?? null, today);

/** The question of how it ended, first on the ficha of a job finished: answered, it is one line (`endLine`). */
export const endQuestion = (/** @type {Cards | null} */ cards, today) =>
  cards?.end ? endCard(cards.end, today) : nothing;

/** «¿Se llamó para la campaña de <año>?», of a fijo discontinuo, at the top. */
export const recallQuestion = (/** @type {Cards | null} */ cards, today) => recallCard(cards?.recall ?? null, today);

/** «Acabó el 6 nov 2026: …» with a way to change it, or the sick leave, once said. */
export function endLine(record) {
  const out = [];
  if (record?.end)
    out.push(
      html`<p class="real">Acabó el ${fIso(record.end.date)}: ${END_TEXT[record.end.how]}. <button type="button" class="linkbtn tapfull" data-action="endedEarly">Cambiar</button></p>`,
    );
  if (record?.sick && !record.sick.to)
    out.push(
      html`<p class="real">De baja desde el ${fIso(record.sick.from)}. <button type="button" class="linkbtn tapfull" data-action="sickBack">Volver al trabajo</button> Si el ganadero despide durante la baja, se contesta como «Despido»: se apunta en «Acabó antes».</p>`,
    );
  else if (record?.sick)
    out.push(
      html`<p class="real">De baja del ${fIso(record.sick.from)} al ${fIso(record.sick.to ?? record.sick.from)}.</p>`,
    );
  return html`${out}`;
}
