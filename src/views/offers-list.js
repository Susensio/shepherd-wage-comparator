/** Your offers as cards, and the templates to start a new one. */

import { html, nothing } from 'lit-html';
import { datesText, isComplete, TEMPLATES } from '../offer.js';
import { herdText } from '../text.js';
import { fUnit, inUnit, offerUnit, UNITS } from '../units.js';

/** The «⋯» of a card (the ficha's is in index.html). */
const DOTS = html`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;

/** Your offers in order: latest start first; those without a date at the end, in the order you made them. */
const sorted = (items) => [...items].sort((a, b) => (b.o.terms.start || '').localeCompare(a.o.terms.start || ''));

/**
 * One card per offer, short: its name, what it earns in its unit, and when and what herd. The facts that tell offers
 * apart (hours, en negro, what is owed) are in Comparar and the ficha. An offer not worked (marked «solo oferta», or
 * without a start date) is muted with a dashed edge, as in Comparar; one with data missing says so instead of a figure.
 * @param {{ o: any, r: any }[]} items your offers with their figures
 * @param {string} activeId the offer shown on the ficha, marked on wide screens where the list stays beside it
 */
export const offersListView = (items, activeId) =>
  sorted(items).map(({ o, r }) => {
    const unit = offerUnit(r);
    const complete = isComplete(o.terms);
    const worked = !!o.terms.start && !o.mine.offerOnly;
    const detail = [datesText(o.terms), herdText(o.terms)].filter(Boolean).join(' · ');
    return html`<div class="ocwrap"><button type="button" class=${worked ? 'ocard' : 'ocard offer-only'} aria-current=${o.id === activeId ? 'true' : nothing} data-action="openOffer" data-id=${o.id}>
      <span class="oc-top"><b class="oc-name">${o.mine.name || 'Sin nombre'}</b>${
        complete
          ? html`<span class="oc-fig">${fUnit(inUnit(r.earnings.total, r, unit), unit)}${UNITS[unit].suffix}</span>`
          : ''
      }</span>
      <span class="oc-detail">${detail}${detail && !worked ? ' · ' : ''}${worked ? '' : html`<span class="offer-only-tag">solo oferta</span>`}${
        complete ? '' : html`${detail || !worked ? ' · ' : ''}<span class="warn">Faltan datos</span>`
      }</span>
    </button><button type="button" class="omenu" data-action="offerMenu" data-id=${o.id} aria-label="Más acciones" aria-haspopup="menu" aria-expanded="false" aria-controls="offerMenu">${DOTS}</button></div>`;
  });

/** @param {string | null} chosen the template picked, if any */
export const templatesView = (chosen = null) =>
  html`${TEMPLATES.map(
    (t) =>
      html`<button type="button" class="tcard" data-action="template" data-template=${t.id} aria-pressed=${String(t.id === chosen)}><b>${t.title}</b><span>${t.text}</span><span class="tk">${t.sets}</span></button>`,
  )}<button type="button" class="tcard blank" data-action="template" data-template="blank" aria-pressed=${String(chosen === 'blank')}><b>Empezar en blanco</b><span>Todo lo pones tú.</span></button>`;

/** Three grey cards where the offers will be, while the account they come from connects. */
export const skeletonCardsView = () =>
  [0, 1, 2].map(
    () => html`<div class="ocard skeleton" aria-hidden="true">
      <span class="oc-top"><span class="skel-bar name"></span><span class="skel-bar fig"></span></span>
      <span class="skel-bar line"></span><span class="skel-bar line short"></span>
    </div>`,
  );
