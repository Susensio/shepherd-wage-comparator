/** Your offers as cards, and the templates to start a new one. */

import { html, nothing } from 'lit-html';
import { fE, fN, isWorthCounting } from '../format.js';
import { datesText, isComplete, TEMPLATES } from '../offer.js';
import { H_MAX, H_ORDINARY } from '../rights.js';
import { herdText } from '../text.js';
import { fUnit, inUnit, isUnderAMonth, offerUnit, UNITS } from '../units.js';

/** Your offers in order: latest start first; those without a date at the end, in the order you made them. */
const sorted = (items) => [...items].sort((a, b) => (b.o.terms.start || '').localeCompare(a.o.terms.start || ''));

/**
 * The facts that tell offers apart, each coloured by how it stands: hours a week, the share en negro, what is owed.
 * Not «no cumple»: almost no offer complies, so it would say the same on every card (the ficha has the detail).
 */
function factsOf(r) {
  const hours = r.time.hoursPerWeek;
  const debt = r.debt.owed * r.netFactor;
  return [
    { text: `${fN(hours)}\u00a0h/sem`, status: hours <= H_ORDINARY ? '' : hours <= H_MAX ? 'warn' : 'bad' },
    r.noContract
      ? { text: 'sin contrato', status: 'bad' }
      : r.cash.total <= 0.5
        ? { text: 'todo en nómina', status: 'ok' }
        : { text: `${fN(r.cash.share * 100)}\u00a0% en negro`, status: 'warn' },
    isWorthCounting(debt) && {
      text: `te deben ${isUnderAMonth(r) ? `${fE(debt)} en total` : `${fE(inUnit(debt, r, 'month'))} al mes`}`,
      status: 'bad',
    },
  ].filter(Boolean);
}

/**
 * One card per offer: its name, what it earns in its unit, when and what herd, and the facts that tell it apart. An
 * offer with data missing says so instead.
 * @param {{ o: any, r: any }[]} items your offers with their figures
 * @param {string} activeId the offer shown on the ficha, marked on wide screens where the list stays beside it
 */
export const offersListView = (items, activeId) =>
  sorted(items).map(({ o, r }) => {
    const unit = offerUnit(r);
    const complete = isComplete(o.terms);
    const facts = complete ? factsOf(r) : [{ status: 'warn', text: 'Faltan datos' }];
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
      <span class="oc-facts">${facts.map((f) => html`<span class=${f.status}>${f.text}</span>`)}</span>
    </button>`;
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
