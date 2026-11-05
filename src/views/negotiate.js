/** «Para negociar»: what the ganadero saves at the shepherd's expense, both sides of each lever, and what the shepherd costs. */

import { html, nothing } from 'lit-html';
import { capitalize, fE, fN } from '../format.js';
import { LAW } from '../law.js';
import { finiquitoOf, leversOf, unitPhrase } from '../text.js';
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
  return html`<p class="lev-t">El ganadero se ahorra unos <b>${fE(total)}</b> ${over} a costa del pastor${money.unit !== 'total' && !r.time.noDuration ? html` <span>(${money.figure(total)} ${unitPhrase(money.unit, r)})</span>` : nothing}.</p>
    <div class="levers">${levers.map(
      (lever) => html`<div class="lever" data-lever=${lever.id}>
        <p class="lever-t">${lever.title}</p>
        <dl class="sides">
          <dt>El ganadero se ahorra</dt><dd><b>${fE(lever.employer)}</b>${lever.estimate ? html` <small>estimado</small>` : nothing}</dd>
          <dt>Para el pastor</dt><dd>${lever.shepherd}</dd>
        </dl>
        <button type="button" class="linkbtn" data-action="copyProposal" data-lever=${lever.id}>Copiar para hablarlo</button>
        <p class="hint copy-msg" aria-live="polite"></p>
      </div>`,
    )}</div>`;
}

/** The finiquito, item by item, and its message to confirm with the ganadero. */
function finiquitoView(o, r) {
  const finiquito = finiquitoOf(o, r);
  if (!finiquito) return nothing;
  return html`<div class="finiquito">
    <p class="lever-t">El finiquito</p>
    <dl class="sides">${finiquito.items.map(([label, text]) => html`<dt>${label}</dt><dd>${capitalize(text)}</dd>`)}</dl>
    <button type="button" class="linkbtn" data-action="copyFiniquito">Copiar para confirmarlo</button>
    <p class="hint copy-msg" aria-live="polite"></p>
  </div>`;
}

/** «Para negociar». */
export function negotiationSection(o, r, money) {
  // Its levers are labour law's (minimum, en negro, overtime): none applies to an invoice
  if (r.employer.cost <= 0 || r.selfEmployed) return nothing;
  return html`<section class="employer" id="secEmployer" aria-label="Para negociar"><h3 class="q">Para negociar</h3>${finiquitoView(o, r)}${leversView(r, money)}${costDetails(o, r)}</section>`;
}
