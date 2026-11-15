/** Your offers as cards, and the templates to start a new one. */

import { html, nothing } from 'lit-html';
import { fCount, fDate, fE } from '../format.js';
import { yearMoney, yearShares } from '../model/calc.js';
import { isWorked, workedOffers } from '../model/phase.js';
import { datesText, isComplete, missing, parseDate, TEMPLATES, todayISO } from '../offer.js';
import { herdText, PHASE_TEXT } from '../text.js';
import { fUnit, inUnit, offerUnit, UNITS } from '../units.js';

/** The «⋯» of a card (the ficha's is in index.html). */
const DOTS = html`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;

/** Offers without a start date, or starting in the future: not decided yet, so they come first. */
const UNDECIDED = 'undecided';

/** Whether an offer starts after today (ISO dates compare as text). */
const startsLater = (o) => !!o.terms.start && o.terms.start > todayISO();

/** The year an offer starts in, or `UNDECIDED`. */
const groupOf = (o) => (!o.terms.start || startsLater(o) ? UNDECIDED : o.terms.start.slice(0, 4));

/**
 * What was worked each year: how many offers, the cobros recorded, what the offers say they pay and the days contributed. Each contract is split by
 * days between the years it touches; offers of solo oferta, incomplete ones and those without a duration are left out.
 * @param {{ o: any, r: any }[]} items
 * @returns {Record<string, { jobs: number, recorded: number, projected: number, contrib: number }>}
 */
function yearTotals(items) {
  const worked = new Set(workedOffers(items.map((x) => x.o)));
  const parts = {};
  for (const { o, r } of items) {
    if (!worked.has(o) || startsLater(o) || !isComplete(o.terms) || o.terms.durationUnit === 'unknown') continue;
    for (const [year, share] of Object.entries(yearShares(o.terms)))
      parts[year] = [...(parts[year] || []), { o, r, share }];
  }
  return Object.fromEntries(
    Object.entries(parts).map(([year, list]) => {
      const contrib = list.reduce((total, { r, share }) => total + r.unemployment.contribDays * share, 0);
      return [year, { jobs: list.length, ...yearMoney(list, year), contrib }];
    }),
  );
}

/** «2026 · 3 trabajadas · 900 € cobrados · 14.200 € según las ofertas · 180 días cotizados» */
function yearHeading(year, totals) {
  const { jobs = 0, recorded = 0, projected = 0, contrib = 0 } = totals ?? {};
  const days = fCount(contrib);
  const parts = [
    jobs === 0 ? 'ninguna trabajada' : jobs === 1 ? '1 trabajada' : `${jobs} trabajadas`,
    recorded >= 0.5 && `${fE(recorded)} cobrados`,
    jobs > 0 && projected >= 0.5 && `${fE(projected)} según las ofertas`,
    jobs > 0 && contrib >= 0.5 && `${days} ${days === '1' ? 'día cotizado' : 'días cotizados'}`,
  ].filter(Boolean);
  return html`<h3 class="year-head"><b>${year}</b> · ${parts.join(' · ')}</h3>`;
}

/**
 * One card per offer, short: its name, what it earns in its unit, and when and what herd. The facts that tell offers
 * apart (hours, en negro, what is owed) are in Comparar and the ficha. An offer not worked (marked «solo oferta», or
 * without a start date) is muted with a dashed edge, as in Comparar; one with data missing says so instead of a figure.
 * Cards go by start date, the latest first, under a header per year with that year's figures; those without a start
 * date, or starting later than today, go first, under «Por decidir» (ADR-0030), the soonest first and the undated last.
 * @param {{ o: any, r: any, record?: ReturnType<typeof import('../model/job-view.js').cardOf> }[]} items your offers with their figures and, for a job worked, its phase and what is owed
 * @param {string} activeId the offer shown on the ficha, marked on wide screens where the list stays beside it
 */
export function offersListView(items, activeId) {
  const totals = yearTotals(items);
  const groups = new Map([[UNDECIDED, []]]);
  // A year only a contract from the year before reaches has its header too, with no cards
  for (const year of Object.keys(totals)) groups.set(year, []);
  for (const x of items) {
    groups.set(groupOf(x.o), [...(groups.get(groupOf(x.o)) ?? []), x]);
  }
  const years = [...groups.keys()]
    .filter((key) => key !== UNDECIDED)
    .sort()
    .reverse();
  const order = (group) => [...group].sort((a, b) => (b.o.terms.start || '').localeCompare(a.o.terms.start || ''));
  const undecided = groups
    .get(UNDECIDED)
    .sort((a, b) => (a.o.terms.start || '9').localeCompare(b.o.terms.start || '9'));
  return html`${undecided.length ? html`<h3 class="year-head"><b>Por decidir</b></h3>${undecided.map((x) => card(x, activeId))}` : nothing}${years.map(
    (year) => html`${yearHeading(year, totals[year])}${order(groups.get(year)).map((x) => card(x, activeId))}`,
  )}${years.length ? html`<p class="hint">Cada año cuenta sin las de solo oferta. Si un contrato pasa de un año a otro, se reparte por días.</p>` : nothing}`;
}

/** «· plazo pasado» or «· hasta el 31 mar 2027»: when what is owed can still be claimed. */
function claimNote(claim) {
  if (!claim) return nothing;
  if (claim.lapsed) return ' · plazo pasado';
  return claim.by ? ` · hasta el ${fDate(parseDate(claim.by))}` : nothing;
}

/** The status line of a job worked: red where the ganadero owes, amber where something remains to record. */
function statusLine(status) {
  if (!status) return nothing;
  return html`<span class=${status.tone ? `oc-status ${status.tone}` : 'oc-status'}>${status.text}${status.owed ? html` <b>${fE(status.owed, 0)}</b>` : nothing}${claimNote(status.claim)}</span>`;
}

/**
 * One offer's card with its «⋯» menu.
 * @param {{ o: any, r: any, record?: ReturnType<typeof import('../model/job-view.js').cardOf> }} item
 * @param {string} activeId
 */
function card({ o, r, record }, activeId) {
  const unit = offerUnit(r, o.terms);
  const complete = isComplete(o.terms);
  const lacking = missing(o.terms).length > 0; // a job that began with no pay told is not «incomplete»: its record speaks
  const worked = isWorked(o);
  const detail = [datesText(o.terms), herdText(o.terms)].filter(Boolean).join(' · ');
  return html`<div class="ocwrap"><button type="button" class=${[worked ? 'ocard' : 'ocard offer-only', record?.status?.tone && `st-${record.status.tone}`].filter(Boolean).join(' ')} aria-current=${o.id === activeId ? 'true' : nothing} data-action="openOffer" data-id=${o.id}>
    <span class="oc-top"><b class="oc-name">${o.mine.name || 'Sin nombre'}</b>${
      complete
        ? html`<span class="oc-fig">${fUnit(inUnit(r.earnings.total, r, unit), unit)}${UNITS[unit].suffix}</span>`
        : ''
    }</span>
    <span class="oc-detail">${record?.phase ? html`<span class="phase" data-phase=${record.pill ?? record.phase}>${PHASE_TEXT[record.pill ?? record.phase]}</span> ` : nothing}${detail}${detail && !worked ? ' · ' : ''}${worked ? '' : html`<span class="offer-only-tag">solo oferta</span>`}${
      lacking ? html`${detail || !worked ? ' · ' : ''}<span class="warn">Faltan datos</span>` : ''
    }</span>${statusLine(record?.status)}
  </button><button type="button" class="omenu" data-action="offerMenu" data-id=${o.id} aria-label="Más acciones" aria-haspopup="menu" aria-expanded="false" aria-controls="offerMenu">${DOTS}</button></div>`;
}

/** @param {string | null} chosen the template picked, if any */
export const templatesView = (chosen = null) =>
  html`${TEMPLATES.map(
    (t) =>
      html`<button type="button" class="tcard" data-action="template" data-template=${t.id} aria-pressed=${String(t.id === chosen)}><b>${t.title}</b><span>${t.text}</span><span class="tk">${t.sets}</span></button>`,
  )}<button type="button" class="tcard blank" data-action="template" data-template="blank" aria-pressed=${String(chosen === 'blank')}><b>Empezar en blanco</b><span>Todo se pone a mano.</span></button>`;

/** Three grey cards where the offers will be, while the account they come from connects. */
export const skeletonCardsView = () =>
  [0, 1, 2].map(
    () => html`<div class="ocard skeleton" aria-hidden="true">
      <span class="oc-top"><span class="skel-bar name"></span><span class="skel-bar fig"></span></span>
      <span class="skel-bar line"></span><span class="skel-bar line short"></span>
    </div>`,
  );
