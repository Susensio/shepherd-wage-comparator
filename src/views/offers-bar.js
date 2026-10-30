/** The offers bar (a chip per offer) and the templates to start a new one. */

import { html, nothing } from 'lit-html';
import { missing, TEMPLATES } from '../offer.js';

/** Your offers in order: latest start first; those without a date at the end, in the order you made them. */
const sorted = (offers) => [...offers].sort((a, b) => (b.start || '').localeCompare(a.start || ''));

export const chipsView = (offers, activeId) =>
  sorted(offers).map((o) => {
    const incomplete = missing(o).length > 0;
    return html`<button type="button" class=${incomplete ? 'chip incomplete' : 'chip'} data-action="choose" data-id=${o.id} aria-current=${String(o.id === activeId)} title=${incomplete ? 'Le faltan datos' : nothing}>
    <span class="cn">${o.name || 'Sin nombre'}</span></button>`;
  });

export const templatesView = () =>
  html`${TEMPLATES.map(
    (t) =>
      html`<button type="button" class="tcard" data-action="template" data-template=${t.id}><b>${t.title}</b><span>${t.text}</span><span class="tk">${t.sets}</span></button>`,
  )}<button type="button" class="tcard blank" data-action="template" data-template="blank"><b>En blanco</b><span>Todo vacío, para rellenarlo tú.</span></button>`;
