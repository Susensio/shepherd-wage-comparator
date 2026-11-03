/** The ficha of an offer: its result, its conditions one row per step, and the analysis under them. */

import { html, nothing } from 'lit-html';
import { joinAnd } from '../format.js';
import { missing } from '../offer.js';
import { CONDITION_STEPS, STEP_OF_MISSING } from '../steps.js';
import { MISSING_TEXT, summaries } from '../text.js';
import { resultParts } from './result.js';

const CHEVRON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>`;

/** What is missing in each step, as the sentence says it: `{ pay: 'lo que te pagan' }`. */
export function missingBySteps(terms) {
  /** @type {Record<string, string[]>} */
  const byStep = {};
  for (const id of missing(terms)) {
    const step = STEP_OF_MISSING[id];
    byStep[step] ??= [];
    if (!byStep[step].includes(MISSING_TEXT[id])) byStep[step].push(MISSING_TEXT[id]);
  }
  return Object.fromEntries(Object.entries(byStep).map(([step, texts]) => [step, joinAnd(texts)]));
}

/**
 * @param {object} o
 * @param {object} r its figures
 * @param {import('../places.js').PlacesIndex | null} places to name the municipality and province
 */
export function fichaView(o, r, places) {
  const { head, analysis } = resultParts(o, r);
  const lines = summaries(o, r, places);
  const lacking = missingBySteps(o.terms);
  return html`${head}
    <section class="conditions" aria-labelledby="conditionsTitle">
      <div class="sechead"><h2 id="conditionsTitle">Condiciones</h2><span class="hint">Toca para cambiar</span></div>
      <div class="crows">${CONDITION_STEPS.map(
        (step) =>
          html`<button type="button" class=${lacking[step.id] ? 'crow missing' : 'crow'} data-action="editStep" data-step=${step.id}>
            <span class="ck">${step.label}</span>
            <span class="cv">${lines[step.summary]}${lacking[step.id] ? html` <b class="miss">Falta ${lacking[step.id]}</b>` : nothing}</span>${CHEVRON}
          </button>`,
      )}</div>
    </section>
    ${analysis ? html`<h2 class="analysis-title">Análisis</h2>${analysis}` : nothing}`;
}
