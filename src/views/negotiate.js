/** «Para negociar»: what the ganadero saves at the shepherd's expense, both sides of each lever, and what the shepherd costs. */

const COPY_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>`;

import { html, nothing } from 'lit-html';
import { fE, fN } from '../format.js';
import { LAW } from '../law.js';
import { leversOf, unitPhrase } from '../text.js';
import { columns, row } from './parts.js';

/** What you cost the employer, per day and per month (or over the whole contract). Every row adds up. */
function costDetails(o, r) {
  const cols = columns(r);
  const vacation = r.pay.vacationPay > 0.5 ? r.pay.vacationPay : 0;
  const { housing, food } = r.inKind;
  const inKindLabel = housing > 0.5 && food > 0.5 ? 'Casa y comida' : housing > 0.5 ? 'Casa' : 'Comida';
  const items = [
    r.pay.gross - vacation > 0.5 && ['Nómina bruta', r.pay.gross - vacation, vacation ? 'sin las vacaciones' : ''],
    vacation && [
      'Vacaciones',
      vacation,
      o.terms.vacation === 'included'
        ? 'la parte del jornal que son vacaciones'
        : 'las que no se libran, pagadas al acabar',
    ],
    r.employer.ss > 0.5 && [
      'Seguridad Social que paga el ganadero',
      r.employer.ss,
      `aprox. ${fN(r.pay.rates.employerPct, 1)} % del bruto`,
    ],
    r.cash.total > 0 && [r.noContract ? 'En negro, sin contrato' : 'En negro', r.cash.total, ''],
    r.car.kmPaid > 0.5 && ['Kilometraje que paga', r.car.kmPaid, ''],
    r.employer.severance > 0.5 && [
      'Indemnización por fin de contrato',
      r.employer.severance,
      `${LAW.severanceDaysPerYear} días por año trabajado`,
    ],
  ].filter(Boolean);
  const parts = items.map(([, value]) => value);
  const inKind = r.inKind.total > 0.5;
  return html`<details class="plg" data-fold="cost"><summary>Cuánto cuesta al ganadero</summary><p class="hint">Por día trabajado y ${cols.other === 'month' ? 'al mes' : 'en todo el contrato'}.</p>
  <div class="rows">
    ${row('', cols.header, { cls: 'hd' })}
    ${items.map(([label, value, sub], i) => row(`${i ? '+ ' : ''}${label}`, cols.value(value), { sub }))}
    ${
      inKind
        ? html`${row('= Dinero que pone', cols.sum(parts), { cls: 'strong' })}${row(`+ ${inKindLabel}`, cols.value(r.inKind.total), { sub: 'lo que vale, no lo que le cuesta' })}`
        : nothing
    }
    ${row('= Le cuesta en total', cols.sum(inKind ? [...parts, r.inKind.total] : parts), { cls: 'tot' })}
  </div>
  </details>`;
}

/**
 * What the ganadero saves at the shepherd's expense, lever by lever, with both sides and a neutral text to send:
 * figures put on the table, not claims.
 */
function leversView(r, money) {
  const levers = leversOf(r);
  if (!levers.length)
    return html`<div class="savings neutral"><p class="savings-t">No se ahorra nada a costa del pastor</p><p>Todo va en nómina, cotizando, y llega al mínimo.</p></div>`;
  const total = levers.reduce((sum, lever) => sum + lever.employer, 0);
  const over = r.time.noDuration ? 'al mes' : 'en todo el contrato';
  return html`<div class="levers">${levers.map(
    (lever) => html`<div class="lever" data-lever=${lever.id}>
        <p class="lever-t">${lever.title}</p>
        <button type="button" class="copybtn" data-action="copyProposal" data-lever=${lever.id} aria-label="Copiar texto para hablarlo con el ganadero" title="Copiar texto para hablarlo con el ganadero">${COPY_ICON}</button>
        <p class="hint copy-msg" aria-live="polite"></p>
        <dl class="sides">
          <dt>El ganadero se ahorra</dt><dd class="save"><b>${fE(lever.employer)}</b>${lever.estimate ? html` <small>estimado</small>` : nothing}</dd>
          <dt>Para el pastor</dt><dd>${lever.shepherd.map(([label, text]) => html`<span class="cost"><small>${label}</small> ${text}</span>`)}</dd>
        </dl>
      </div>`,
  )}</div>
    <p class="lev-t">En total, el ganadero se ahorra unos <b>${fE(total)}</b> ${over} a costa del pastor${money.unit !== 'total' && !r.time.noDuration ? html` <span>(${money.figure(total)} ${unitPhrase(money.unit, r)})</span>` : nothing}.</p>`;
}

/** «Para negociar». */
export function negotiationSection(o, r, money) {
  // Its levers are labour law's (minimum, en negro, overtime): none applies to an invoice
  if (r.employer.cost <= 0 || r.selfEmployed) return nothing;
  return html`<section class="employer" id="secEmployer" aria-label="Para negociar"><h3 class="q">Para negociar</h3>${leversView(r, money)}${costDetails(o, r)}</section>`;
}
