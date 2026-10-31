/**
 * «Final de campaña», only for dated offers you have worked: what you were paid in all, on payroll and in cash, what you
 * worked and what you generated; and, folded, a payslip simulator month by month.
 */

import { html, nothing } from 'lit-html';
import { clamp, fCount, fDate, fE, fN } from '../format.js';
import { LAW } from '../law.js';
import { monthlyPayslips } from '../model/payslips.js';
import { endOf, parseDate } from '../offer.js';
import { figureCard } from './parts.js';

/** The month shown in each offer's payslip simulator, by offer id. Not saved. */
const shownMonth = {};

/** Moves an offer's simulator `step` months. */
export function stepPayslipMonth(offerId, step) {
  shownMonth[offerId] = (shownMonth[offerId] ?? Number.POSITIVE_INFINITY) + step;
}

const monthName = (date) => {
  const text = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
  return text[0].toUpperCase() + text.slice(1);
};
const e2 = (x) => fN(x, 2);
const pct = (x) => `${fN(x, 2)}\u00a0%`;

/**
 * Every payslip goes in the same table and only the chosen month's rows show: the others are collapsed
 * (visibility: collapse) but still count towards the column widths, so they stay put from one month to the next.
 */
function payslipTables(r, months, shown) {
  const workerRates = r.pay.rates.worker;
  const employerRates = r.pay.rates.employer;
  const vacationDay = r.time.vacationDays > 0 ? r.pay.vacationPay / r.time.vacationDays : 0;
  const cls = (m, extra = '') => [m === shown ? '' : 'collapsed', extra].filter(Boolean).join(' ') || nothing;
  const line = (m, concept, detail, credit, debit) =>
    html`<tr class=${cls(m)}><th>${concept}</th><td class="det">${detail || ''}</td><td>${credit != null ? e2(credit) : ''}</td><td>${debit != null ? e2(debit) : ''}</td></tr>`;
  return html`<div class="tablew paper"><table class="table ps-t">
      <thead><tr><th>Concepto</th><th class="det">Detalle</th><th>Abonos</th><th>Deducciones</th></tr></thead>
      <tbody>${months.map(
        (x, m) => html`
        ${line(m, 'Salario', x.share < 1 ? `${x.days} días` : 'mes entero', x.salary, null)}
        ${
          x.vacation > 0.5
            ? line(
                m,
                'Vacaciones',
                x.vacation >= r.pay.vacationPay - 0.5
                  ? `${fCount(r.time.vacationDays)} días a ${e2(vacationDay)}`
                  : 'parte del mes',
                x.vacation,
                null,
              )
            : nothing
        }
        <tr class=${cls(m, 'base')}><th>Base de cotización</th><td class="det">${e2(x.gross)}</td><td></td><td></td></tr>
        ${workerRates.map(([concept, p]) => line(m, concept, pct(p), null, (x.gross * p) / 100))}
        ${line(m, 'IRPF', pct(r.pay.irpfPct * 100), null, x.irpf)}
        ${x.severance > 0.5 ? line(m, 'Indemnización', `${LAW.severanceDaysPerYear} días por año`, x.severance, null) : nothing}`,
      )}
      </tbody>
      <tfoot>${months.map(
        (
          x,
          m,
        ) => html`<tr class=${cls(m, 'tt')}><th>Totales</th><td></td><td>${e2(x.gross + x.severance)}</td><td>${e2(x.contrib + x.irpf)}</td></tr>
        <tr class=${cls(m, 'net')}><th colspan="3">Neto a percibir</th><td>${e2(x.net)}</td></tr>`,
      )}</tfoot></table>
      <table class="table ps-t ps-emp"><thead><tr><th>Aportación de la empresa</th><th class="det">Tipo</th><th>Importe</th></tr></thead>
      <tbody>${months.map((x, m) =>
        employerRates.map(
          ([concept, p]) =>
            html`<tr class=${cls(m)}><th>${concept}</th><td class="det">${pct(p)}</td><td>${e2((x.gross * p) / 100)}</td></tr>`,
        ),
      )}</tbody>
      <tfoot>${months.map((x, m) => html`<tr class=${cls(m)}><th colspan="2">Total empresa</th><td>${e2(x.employer)}</td></tr>`)}</tfoot></table></div>`;
}

/** The simulator: pick a month and its payslip shows, like a real one. */
function simulator(o, r, months) {
  if (!months.length) return nothing;
  const shown = clamp(shownMonth[o.id] ?? months.length - 1, 0, months.length - 1);
  shownMonth[o.id] = shown;
  const x = months[shown];
  const nav = html`<div class="ps-nav"><button type="button" class="sm" data-action="payslipMonth" data-offer=${o.id} data-step="-1" ?disabled=${shown <= 0} aria-label="Mes anterior">‹</button>
    <span>${monthName(x.month)}${x.share < 1 ? html` <small>(${x.days} días)</small>` : nothing} <small>· ${shown + 1} de ${months.length}</small></span>
    <button type="button" class="sm" data-action="payslipMonth" data-offer=${o.id} data-step="1" ?disabled=${shown >= months.length - 1} aria-label="Mes siguiente">›</button></div>`;
  return html`<details class="plg" data-fold="payslips"><summary>Simulador de nóminas<span class="stat dt">${months.length} ${months.length === 1 ? 'nómina' : 'nóminas'}</span></summary>${nav}${payslipTables(r, months, shown)}
    <p class="hint">Es una estimación para comparar con tus nóminas: la real puede llevar bonificaciones, otros redondeos u otra base de cotización.</p></details>`;
}

/** «Final de campaña». */
export function seasonEndSection(o, r) {
  const end = endOf(o.terms);
  if (!o.terms.start || o.mine.offerOnly || r.time.noDuration || !end) return nothing;
  const months = monthlyPayslips(o.terms, r);
  const payroll = months.reduce((sum, x) => sum + x.net, 0);
  const cash = r.cash.total;
  const total = payroll + cash;
  const cashShare = total > 0 ? cash / total : 0;
  const facts = [
    `${fN(r.time.daysWorked)} días trabajados (${fN(r.time.hours)}\u00a0h)`,
    r.car.km > 0.5 && `${fN(r.car.km)} km, unos ${fE(r.car.cost)} de coche`,
    r.unemployment.contribDays > 0 &&
      `${fN(r.unemployment.contribDays)} días cotizados, unos ${fN(r.unemployment.days)} de paro`,
  ]
    .filter(Boolean)
    .join(' · ');
  return html`<section class="season-end" id="secSeason" aria-label="Final de campaña"><h3 class="q">Final de campaña</h3>
    <div class="received">${figureCard(fE(total), 'Total cobrado', `del ${fDate(parseDate(o.terms.start))} al ${fDate(end)}`, '')}${
      cash > 0.5 && payroll > 0.5
        ? html`<div class="rc-bar" aria-hidden="true"><i style="flex:${1 - cashShare}"></i><i class="b" style="flex:${cashShare}"></i></div>`
        : nothing
    }<div class="rc-legend">${
      !r.noContract
        ? html`<span><i class="sw" style="background:var(--c-pay)"></i>En nómina</span><b>${fE(payroll)}</b>`
        : nothing
    }${
      cash > 0.5
        ? html`<span><i class="sw" style="background:var(--c-cash)"></i>En negro${payroll > 0.5 ? html` <small>${fN(cashShare * 100)}\u00a0%</small>` : nothing}</span><b>${fE(cash)}</b>`
        : nothing
    }</div><p class="hint">${facts}.</p></div>
    ${simulator(o, r, months)}
  </section>`;
}
