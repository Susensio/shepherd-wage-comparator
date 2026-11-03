/** Your offers as cards, and the templates to start a new one. */

import { html, nothing } from 'lit-html';
import { datesText, isComplete, TEMPLATES } from '../offer.js';
import { herdText, legalLine } from '../text.js';
import { fUnit, inUnit, offerUnit, UNITS } from '../units.js';

/** Your offers in order: latest start first; those without a date at the end, in the order you made them. */
const sorted = (items) => [...items].sort((a, b) => (b.o.terms.start || '').localeCompare(a.o.terms.start || ''));

/**
 * One card per offer: its name, what it earns in its unit, when and what herd, and one line on the law. An offer
 * with data missing says so instead of a figure.
 * @param {{ o: any, r: any }[]} items your offers with their figures
 * @param {string} activeId the offer shown on the ficha, marked on wide screens where the list stays beside it
 */
export const offersListView = (items, activeId) =>
  sorted(items).map(({ o, r }) => {
    const unit = offerUnit(r);
    const complete = isComplete(o.terms);
    const flag = !complete ? { status: 'warn', text: 'Faltan datos' } : legalLine(o, r);
    const detail = [datesText(o.terms), herdText(o.terms), o.mine.offerOnly && 'solo oferta']
      .filter(Boolean)
      .join(' · ');
    return html`<button type="button" class="ocard" aria-current=${o.id === activeId ? 'true' : nothing} data-action="openOffer" data-id=${o.id}>
      <span class="oc-top"><b class="oc-name">${o.mine.name || 'Sin nombre'}</b>${
        !complete
          ? ''
          : html`<span class="oc-fig">${fUnit(inUnit(r.earnings.total, r, unit), unit)}${UNITS[unit].suffix}</span>`
      }</span>
      ${detail ? html`<span class="oc-detail">${detail}</span>` : ''}
      ${flag ? html`<span class=${`oc-flag ${flag.status}`}>${flag.text}</span>` : ''}
    </button>`;
  });

/** @param {string | null} chosen the template picked, if any */
export const templatesView = (chosen = null) =>
  html`${TEMPLATES.map(
    (t) =>
      html`<button type="button" class="tcard" data-action="template" data-template=${t.id} aria-pressed=${String(t.id === chosen)}><b>${t.title}</b><span>${t.text}</span><span class="tk">${t.sets}</span></button>`,
  )}<button type="button" class="tcard blank" data-action="template" data-template="blank" aria-pressed=${String(chosen === 'blank')}><b>Empezar en blanco</b><span>Todo lo pones tú.</span></button>`;
