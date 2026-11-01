/** «Para negociar»: what the employer saves at your expense, and what you cost them. */

import { html, nothing } from 'lit-html';
import { capitalize, fE, fN, isWorthCounting } from '../format.js';
import { LAW } from '../law.js';
import { minimumShortText, unitPhrase } from '../text.js';
import { columns, row, two } from './parts.js';

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
        : 'las que no libras, pagadas al acabar',
    ],
    r.employer.ss > 0.5 && [
      'Seguridad Social que paga la empresa',
      r.employer.ss,
      `aprox. ${fN(r.pay.rates.employerPct, 1)} % del bruto`,
    ],
    r.cash.total > 0 && [r.noContract ? 'En negro, sin contrato' : 'En negro', r.cash.total, ''],
    r.car.kmPaid > 0.5 && ['Kilometraje que te paga', r.car.kmPaid, ''],
    r.employer.severance > 0.5 && [
      'Indemnización por fin de contrato',
      r.employer.severance,
      `${LAW.severanceDaysPerYear} días por año trabajado`,
    ],
  ].filter(Boolean);
  const parts = items.map(([, value]) => value);
  const inKind = r.inKind.total > 0.5;
  return html`<details class="plg" data-fold="cost"><summary>Cuánto le cuestas</summary><p class="hint">Por día trabajado y ${cols.other === 'month' ? 'al mes' : 'en todo el contrato'}.</p>
  <div class="rows">
    ${row('', cols.header, { cls: 'hd' })}
    ${items.map(([label, value, sub], i) => row(`${i ? '+ ' : ''}${label}`, cols.value(value), { sub }))}
    ${
      inKind
        ? html`${row('= Dinero que pone', cols.sum(parts), { cls: 'strong' })}${row(`+ ${inKindLabel}`, cols.value(r.inKind.total), { sub: 'lo que vale, no lo que le cuesta' })}`
        : nothing
    }
    ${row('= Le cuestas', cols.sum(inKind ? [...parts, r.inKind.total] : parts), { cls: 'tot' })}
  </div>
  </details>`;
}

/** What the employer saves at your expense, item by item: their margin to pay you more. */
function savingsView(r, money) {
  const s = r.savings;
  if (!isWorthCounting(s.total))
    return html`<div class="savings neutral"><p class="savings-t">No se ahorra nada a tu costa</p><p>Todo va en nómina, cotizando, y llega al mínimo.</p></div>`;
  const items = [
    [s.cash, r.noContract ? 'Por no hacerte contrato' : 'Por pagarte en negro'],
    [s.minimum, capitalize(minimumShortText(r))],
    [s.days, 'Por las jornadas de más'],
    [s.overtime, 'Por las horas extra', true],
  ].filter(([value]) => isWorthCounting(value));
  // Two columns, in the offer's unit and over the whole contract; one if it is already the total or has no duration
  const both = !(r.time.noDuration || money.unit === 'total');
  const per = unitPhrase(money.unit, r);
  const cell = (x) => (both ? two(money.figure(x), fE(x)) : money.figure(x));
  return html`<div class="savings levers"><p class="lev-t">El ganadero se ahorra a tu costa${both ? '' : html` <span>${per}</span>`}</p>
    <div class="rows sv-rows">${both ? row('', two(capitalize(per), 'En total'), { cls: 'hd' }) : nothing}${items.map(
      ([value, label, estimate]) =>
        row(label, cell(value), { sub: estimate ? 'estimado' : '', cls: estimate ? 'est' : '' }),
    )}</div></div>`;
}

/** «Para negociar». */
export function negotiationSection(o, r, money) {
  if (r.employer.cost <= 0) return nothing;
  return html`<section class="employer" id="secEmployer" aria-label="Para negociar"><h3 class="q">Para negociar</h3>${savingsView(r, money)}${costDetails(o, r)}</section>`;
}
