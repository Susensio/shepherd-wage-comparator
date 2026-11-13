/** The ficha of an offer: its conditions first, one row that opens one row per step, then its result and the analysis. */

import { html, nothing } from 'lit-html';
import { joinAnd } from '../format.js';
import { missing } from '../offer.js';
import { CONDITION_STEPS, STEP_OF_MISSING } from '../steps.js';
import { MISSING_TEXT, summaries } from '../text.js';
import { recordView } from './record.js';
import { resultParts } from './result.js';

const CHEVRON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>`;

/** What is missing in each step, as the sentence says it: `{ pay: 'lo que se paga' }`. */
function missingBySteps(terms) {
  /** @type {Record<string, string[]>} */
  const byStep = {};
  for (const id of missing(terms)) {
    const step = STEP_OF_MISSING[id];
    byStep[step] ??= [];
    if (!byStep[step].includes(MISSING_TEXT[id])) byStep[step].push(MISSING_TEXT[id]);
  }
  return Object.fromEntries(Object.entries(byStep).map(([step, texts]) => [step, joinAnd(texts)]));
}

/** The conditions in one line: when, pay and hours. It is cut short by the width, not here. */
const oneLine = (lines) => [lines.when, lines.pay, lines.workday].filter(Boolean).join(' · ');

/** What was worked out before the job, closed under the record of a job under way. */
const closedAnalysis = (sections) =>
  html`<details class="plg" data-fold="analysis"><summary>Análisis de la oferta</summary>${sections.breakdown}${sections.legal}${sections.negotiation}${sections.seasonEnd}${sections.workings}</details>`;

/**
 * @param {object} o
 * @param {object} r its figures
 * @param {import('../places.js').PlacesIndex | null} places to name the municipality and province
 * @param {import('../ui/record.js').RecordContext | null} record what happened, for a job under way or finished; its block takes the place of the headline
 */
export function fichaView(o, r, places, record = null) {
  const { head, analysis, sections } = resultParts(o, r);
  const lines = summaries(o, r, places);
  const lacking = missingBySteps(o.terms);
  const keys = Object.keys(lacking);
  if (record?.review) return recordView(record);
  return html`<details class="conditions" data-fold="conditions">
      <summary><span class="cinfo"><b>Condiciones</b><span class=${keys.length ? 'cs missing' : 'cs'}>${keys.length ? `Falta ${joinAnd(Object.values(lacking))}` : oneLine(lines)}</span></span></summary>
      <div class="crows">${CONDITION_STEPS.map(
        (step) =>
          html`<button type="button" class=${lacking[step.id] ? 'crow missing' : 'crow'} data-action="editStep" data-step=${step.id}>
            <span class="ck">${step.label}</span>
            <span class="cv">${step.summary
              .map((key) => lines[key])
              .filter(Boolean)
              .join(
                ' · ',
              )}${lacking[step.id] ? html` <b class="miss">Falta ${lacking[step.id]}</b>` : nothing}</span>${CHEVRON}
          </button>`,
      )}</div>
    </details>
    ${record ? recordView(record) : head}
    ${record?.phase === 'finished' ? nothing : record && sections ? closedAnalysis(sections) : analysis ? html`<h2 class="analysis-title">Análisis</h2>${analysis}` : nothing}`;
}
