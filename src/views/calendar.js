/** The calendar of a month (ADR-0032): its days as shown, the counts, the money of the month and the button that closes it. */

import { html, nothing } from 'lit-html';
import { cents, fSumE, sum } from '../ledger.js';
import { monthName } from '../text.js';
import { row } from './parts.js';

/** @typedef {import('../ui/record.js').CalendarContext} CalendarContext */
/** @typedef {import('../ui/record.js').ReviewDone} ReviewDone */

const capital = (text) => text[0].toUpperCase() + text.slice(1);
const KIND_TEXT = { work: 'jornada', off: 'libre', sick: 'de baja' };
const LOCK = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const stateOf = (closed) =>
  closed ? html`<span class="state closed">${LOCK} Cerrado</span>` : html`<span class="state">Según la oferta</span>`;

/** The days, in weeks that start on Monday. A day outside the offer's dates is not tappable. */
function grid(cal) {
  const { acc } = cal;
  const closed = acc.row.closed;
  const [y, m] = acc.row.month.split('-').map(Number);
  const first = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const inSpan = new Map(acc.marks.map((mark) => [mark.day, mark]));
  const days = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(html`<span class="day pad"></span>`);
  for (let d = 1; d <= days; d++) {
    const day = String(d).padStart(2, '0');
    const mark = inSpan.get(day);
    if (!mark) {
      cells.push(html`<span class="day out" aria-hidden="true">${d}</span>`);
      continue;
    }
    const label = `${d} de ${monthName(acc.row.month)}: ${KIND_TEXT[mark.kind]}`;
    cells.push(
      closed
        ? html`<button type="button" class=${`day ${mark.kind}`} aria-disabled="true" tabindex="-1" aria-label=${label}>${d}<small>${mark.kind === 'work' ? '' : KIND_TEXT[mark.kind].replace('de ', '')}</small></button>`
        : html`<button type="button" class=${`day ${mark.kind}`} data-action="toggleDay" data-key=${acc.row.month} data-day=${day} aria-label=${label}>${d}<small>${mark.kind === 'work' ? '' : KIND_TEXT[mark.kind].replace('de ', '')}</small></button>`,
    );
  }
  return html`<div class="wd" aria-hidden="true"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div><div class="grid">${cells}</div>`;
}

/** The money of the month, from what is on the calendar; one line more when the jornadas differ from the offer. */
function money(cal) {
  const { acc } = cal;
  const { items } = acc.row;
  const { jornadas } = acc;
  // In net, like every figure of the ficha; the total is the sum of the rows as shown
  const net = (gross) => cents(gross * cal.netFactor) + 0;
  const [salary, overnight, vacation] = [items.salary.due, items.overnight.due, items.vacation.due].map(net);
  const delta = acc.delta === null ? null : net(acc.delta);
  return html`<div class="rows">
    ${row('Salario', fSumE(salary))}
    ${overnight > 0 ? row('+ Plus de pernocta', fSumE(overnight)) : nothing}
    ${vacation > 0 ? row('+ Vacaciones', fSumE(vacation), { sub: 'según la oferta: se pagan al acabar' }) : nothing}
    ${row('= Corresponde', fSumE(sum([salary, overnight, vacation])), { sub: acc.row.closed ? nothing : 'estimado' })}
    ${delta === null ? nothing : row(`${plural(Math.abs(jornadas), 'jornada', 'jornadas')} ${jornadas > 0 ? 'más' : 'menos'} que la oferta`, `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${fSumE(Math.abs(delta))}`, { cls: 'sub' })}
  </div>`;
}

function actions(cal) {
  const { acc } = cal;
  const name = monthName(acc.row.month);
  const key = acc.row.month;
  if (acc.row.closed)
    return cal.asking
      ? html`<div class="confirm"><span>¿Reabrir ${name}? Los días se podrán cambiar otra vez; los cambios de la oferta siguen sin tocarlos.</span><div class="btns"><button type="button" data-action="reopenYes" data-key=${key}>Reabrir</button><button type="button" data-action="reopenNo">Cancelar</button></div></div>`
      : html`<div class="calact"><span class="hint">Cerrado: no cambia aunque cambie la oferta.</span><button type="button" class="linkbtn" data-action="reopenAsk" data-key=${key}>Reabrir</button></div>`;
  if (!cal.canClose) return html`<p class="hint">Se podrá cerrar cuando acabe el mes.</p>`;
  if (cal.mode === 'review')
    return html`<div class="calact"><button type="button" class="pri" data-action="reviewClose" data-key=${key}>Cerrar ${name}</button><button type="button" data-action="reviewSkip">Saltar</button></div><p class="hint">Saltar lo deja según la oferta.</p>`;
  return html`<div class="calact"><button type="button" class="pri" data-action="closeMonth" data-key=${key}>Cerrar ${name}</button></div>`;
}

function month(cal) {
  const { acc } = cal;
  const [y] = acc.row.month.split('-');
  const title = html`<h3>${capital(monthName(acc.row.month))} ${y}</h3>`;
  const head =
    cal.mode === 'review'
      ? html`<div class="calh solo"><span class="t">${title}${stateOf(acc.row.closed)}</span></div>`
      : html`<div class="calh"><button type="button" class="nav" data-action="calendarMonth" data-step="-1" ?disabled=${cal.index <= 0} aria-label="Mes anterior">‹</button><span class="t">${title}${stateOf(acc.row.closed)}</span><button type="button" class="nav" data-action="calendarMonth" data-step="1" ?disabled=${cal.index >= cal.count - 1} aria-label="Mes siguiente">›</button></div>`;
  const { counts } = acc;
  return html`<div class=${acc.row.closed ? 'cal closed' : 'cal'}>
    ${head}
    ${grid(cal)}
    <div class="counts"><span><i class="work"></i>${plural(counts.work, 'jornada', 'jornadas')}</span><span><i></i>${plural(counts.off, 'libranza', 'libranzas')}</span>${counts.sick ? html`<span><i class="sick"></i>${counts.sick} de baja</span>` : nothing}</div>
    ${money(cal)}
    ${actions(cal)}
  </div>`;
}

/** The end of «Repasar los meses»: how many were closed and which stay as the offer has them. */
/** @param {ReviewDone} cal */
function reviewDone(cal) {
  const left = cal.left.map(monthName);
  return html`<div class="appbar-review"><button type="button" class="linkbtn" data-action="reviewEnd">‹ Repasar los meses</button></div>
    <div class="confirm"><b>Repaso hecho</b><span>${plural(cal.closed, 'mes cerrado', 'meses cerrados')}.${left.length ? ` Siguen según la oferta: ${left.join(', ')}.` : ''}</span><button type="button" class="pri addbtn" data-action="reviewEnd">Volver a las cuentas</button></div>`;
}

/**
 * The month on its calendar: a fold of the ficha, or alone as a step of «Repasar los meses».
 * @param {CalendarContext | ReviewDone | null} cal
 */
export function calendarView(cal) {
  if (!cal) return nothing;
  if ('done' in cal) return reviewDone(cal);
  if (cal.mode === 'review')
    return html`<div class="appbar-review"><button type="button" class="linkbtn" data-action="reviewEnd">‹ Repasar los meses</button></div>
      <div class="review-progress"><span><b>${capital(monthName(cal.acc.row.month))}</b>, ${cal.index + 1} de ${cal.count}</span><span class="bar"><i style=${`width:${((cal.index + 1) / cal.count) * 100}%`}></i></span></div>
      ${month(cal)}`;
  return html`<details class="plg" data-fold="days"><summary>Días<span class="stat dt">${monthName(cal.acc.row.month)} · ${cal.acc.row.closed ? 'cerrado' : 'según la oferta'}</span></summary>${month(cal)}</details>`;
}
