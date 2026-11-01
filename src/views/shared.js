/** Another shepherd's shared offer, read-only: who shared it, its conditions and its terms-only figures. */

import { html, nothing } from 'lit-html';
import { contractOf } from '../offer.js';
import { herdText, summaries, whereText } from '../text.js';
import { resultView } from './result.js';

/** Only plain addresses and numbers become links: the data is another user's. */
const EMAIL = /^[^\s@?&#]+@[^\s@?&#]+$/;
const phoneHref = (phone) => `tel:${phone.replace(/[^\d+]/g, '')}`;

const contact = (sharer) => {
  const email = sharer.email?.trim();
  const phone = sharer.phone?.trim();
  if (!email && !phone) return html`<p class="hint">No ha dejado datos de contacto.</p>`;
  return html`<ul class="contact">${
    email ? html`<li>${EMAIL.test(email) ? html`<a href=${`mailto:${email}`}>${email}</a>` : email}</li>` : nothing
  }${phone ? html`<li><a href=${phoneHref(phone)}>${phone}</a></li>` : nothing}</ul>`;
};

/**
 * @param {{ o: any, r: any, sharer: any, label: string }} item the offer with its terms-only figures and its name for display
 * @param {import('../places.js').PlacesIndex | null} places to name the municipality and province, once loaded
 */
export function sharedView({ o, r, sharer, label }, places) {
  const s = summaries(o, r, null, true);
  const conditions = [
    ['Dónde', whereText(o.terms, places)], // never the village: it is not theirs to share
    ['Ganado', herdText(o.terms)],
    ['Tiempo', s.time],
    ['Nómina', s.payroll],
    ['En negro', s.b],
    ['Casa y comida', s.housing],
    ['Contrato', contractOf(o.terms).stat],
  ].filter(([, v]) => v);
  return html`<button type="button" class="back" data-action="closeShared"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Volver a Comparar</button>
    <h3 class="q">Oferta de ${label}</h3>
    <p class="hint">Solo se ven las condiciones de la oferta, sin desplazamientos ni gastos.</p>
    <h4 class="sub">Quién la comparte</h4>
    ${contact(sharer)}
    <h4 class="sub">Condiciones</h4>
    <dl class="editinfo readonly">${conditions.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>
    <div id="sharedResult" class="result">${resultView(o, r, { readOnly: true })}</div>`;
}
