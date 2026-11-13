/** What the record says about a job under way or finished (ADR-0032): «Hasta hoy», «Cuentas» and «Cobros». */

import { html, nothing } from 'lit-html';
import { fDate, joinAnd } from '../format.js';
import { fSumE } from '../ledger.js';
import { parseDate } from '../offer.js';
import { monthName } from '../text.js';
import { calendarView } from './calendar.js';
import { COPY_ICON, ledgerLines, row } from './parts.js';

/** @typedef {import('../ui/record.js').RecordContext} RecordContext */

const capital = (text) => text[0].toUpperCase() + text.slice(1);
const money = fSumE;
/** «5 jul», or «5 jul 2025» in another year than today's. */
const fWhen = (iso, today) => {
  const date = parseDate(iso);
  return fDate(date, date.getFullYear() !== parseDate(today).getFullYear());
};
const netTotal = (payments) => payments.reduce((total, p) => total + p.amount, 0);

const WAY = { payroll: 'Nómina', cash: 'En mano' };

/** One cobro as a flat row. `remove`: its «Quitar» button, with the second tap that confirms. */
function paymentRow(p, today, { fresh = false, remove = null } = {}) {
  return html`<div class=${fresh ? 'pr fresh' : 'pr'}><span class="d">${fWhen(p.date, today)}</span><span><span class=${p.via === 'cash' ? 'via cash' : 'via'}>${WAY[p.via]}</span>${p.note ? html`<small>${p.note}</small>` : nothing}</span><span class="a">${money(p.amount)}</span>${
    remove
      ? html`<button type="button" class="linkbtn rm" data-action=${remove.asking ? 'removePayment' : 'removePaymentAsk'} data-id=${p.id}>${remove.asking ? '¿Quitar?' : 'Quitar'}</button>`
      : nothing
  }</div>`;
}

/** «Cobros»: what was received, the last two (or every one, each removable) and the button for a new one. */
function cobrosView({ today, payments, fresh, showAll, ask }) {
  const asking = ask?.type === 'payment' ? ask.id : null;
  /** @type {Map<string, typeof payments>} */
  const byMonth = new Map();
  for (const p of payments) byMonth.set(p.date.slice(0, 7), [...(byMonth.get(p.date.slice(0, 7)) ?? []), p]);
  return html`<div class="block cobros">
    <div class="bh"><h2>Cobros</h2><span class="n">${money(netTotal(payments))}</span></div>
    ${
      !payments.length
        ? html`<p class="hint">Todavía no hay ningún cobro apuntado.</p>`
        : showAll
          ? html`<div class="pay">${[...byMonth].map(
              ([month, list]) =>
                html`<div class="ph"><span>${capital(monthName(month))} ${month.slice(0, 4)}</span><span>${money(netTotal(list))}</span></div>${list.map((p) => paymentRow(p, today, { fresh: p.id === fresh, remove: { asking: p.id === asking } }))}`,
            )}</div>`
          : html`<div class="pay">${payments.slice(0, 2).map((p) => paymentRow(p, today, { fresh: p.id === fresh }))}</div>`
    }
    ${payments.length ? html`<button type="button" class="linkbtn lk" data-action="toggleCobros" aria-expanded=${String(showAll)}>${showAll ? 'Ver solo los últimos' : 'Ver todos los cobros'}</button>` : nothing}
    <button type="button" class="pri addbtn" data-action="openPaySheet">+ Apuntar cobro</button>
  </div>`;
}

const NET_HINT = html`<p class="hint">Cantidades netas: lo que llega, sin retenciones.</p>`;

/** «Hasta hoy»: accrued minus received is what the ganadero owes, the current month and the vacation aside. */
function hastaHoy(c) {
  const { standing: s, today } = c;
  const months = joinAnd(s.ended.map((r) => monthName(r.month)));
  const owing = s.falta - s.sobra >= 0;
  const label = !s.hasPayments
    ? 'Hasta hoy · corresponde'
    : owing
      ? `Hasta hoy, ${fWhen(today, today)} · debe el ganadero`
      : 'Hasta hoy · cobrado por adelantado';
  const sub = !s.hasPayments
    ? 'Aún no hay cobros apuntados: apunta lo cobrado para ver lo que falta.'
    : s.ended.length
      ? owing
        ? `Debe el ganadero, de ${months}.`
        : 'Se ha cobrado más de lo que corresponde hasta ahora.'
      : 'Todavía no ha acabado ningún mes.';
  const unclosed = s.unclosed.length ? joinAnd(s.unclosed.map((r) => monthName(r.month))) : '';
  return html`<div class="tag"><span class="lbl">${label}</span><span class="big">${money(s.hasPayments ? Math.abs(s.falta - s.sobra) : s.corresponde)}</span><span class="sub">${sub}</span></div>
    <div class="block">
      ${ledger(s, { owing: 'Debe el ganadero', ahead: 'Cobrado por adelantado' })}
      ${NET_HINT}
      ${unclosed ? html`<p class="hint">Según la oferta, sin cerrar: ${unclosed}. Ciérralos en el calendario cuando estén revisados.</p>` : nothing}
      ${
        s.running || s.vacation > 0
          ? html`<div class="rows">
          ${row('Aparte, aún sin pagar', '', { cls: 'hd' })}
          ${s.running ? row(`${capital(monthName(s.running.month))}, hasta hoy`, money(s.running.amount), { sub: 'se paga al acabar el mes' }) : nothing}
          ${s.vacation > 0 ? row('Vacaciones', money(s.vacation), { sub: 'se pagan al acabar' }) : nothing}
        </div>`
          : nothing
      }
    </div>`;
}

/**
 * What corresponds, less what was received, is what is owed: the lines that add up to what corresponds, then the
 * subtraction. What arrived beyond what corresponds is one row more, outside the sum, and only when there is any.
 */
function ledger(s, { owing, ahead }) {
  const lines = [...ledgerLines(s.lines), row('= Corresponde', money(s.corresponde))];
  if (!s.hasPayments) return html`<div class="rows">${lines}</div>`;
  const over = s.falta - s.sobra < 0;
  return html`<div class="rows">${lines}${row('− Cobrado', money(over ? s.corresponde : s.cobrado))}${row(`= ${owing}`, money(over ? 0 : s.falta - s.sobra), { valueCls: over ? undefined : 'bad' })}${over ? row(ahead, money(-(s.falta - s.sobra)), { cls: 'sub' }) : nothing}</div>`;
}

/** One line per month: its state, what is owed of it and when its claim lapses. */
function monthRow(m, today, hasPayments) {
  const state = m.closed ? 'cerrado' : 'según la oferta';
  const owing = hasPayments && m.owed > 0;
  const by = !owing
    ? ''
    : m.lapsed
      ? `plazo vencido el ${fWhen(m.deadline, today)}`
      : `hasta el ${fWhen(m.deadline, today)} · quedan ${m.daysLeft} ${m.daysLeft === 1 ? 'día' : 'días'}`;
  const near = owing && (m.lapsed || m.daysLeft < 120);
  return html`<div><span><b>${capital(monthName(m.month))}</b> <small>${state}</small>${owing ? html`<small class=${near ? 'due-by near' : 'due-by'}>${by}</small>` : nothing}</span><span class="n">${money(hasPayments ? m.owed : m.due)}</span></div>`;
}

/** «Cuentas»: what the ganadero owes once the job is over, by month with its deadline, and by item. */
function cuentas(c) {
  const { standing: s, today } = c;
  const open = s.unclosed.length;
  const tag = html`<div class="tag"><span class="lbl">${s.hasPayments ? 'Cuentas · debe el ganadero' : 'Cuentas · corresponde'}</span><span class="big">${money(s.hasPayments ? Math.max(0, s.falta - s.sobra) : s.corresponde)}</span><span class="sub">${
    !s.hasPayments
      ? 'Aún no hay cobros apuntados: apunta lo cobrado para ver lo que falta.'
      : open
        ? `${open} ${open === 1 ? 'mes' : 'meses'} según la oferta: repasa y cierra para fijar la cifra.`
        : 'Todos los meses están cerrados.'
  }</span></div>`;
  const months = html`<div class="block"><div class="bh"><h3>Meses</h3><span class="hint">${s.hasPayments ? 'lo que se debe de cada uno' : 'lo que corresponde'}</span></div>
    <div class="tocl">${s.months.map((m) => monthRow(m, today, s.hasPayments))}</div>
    ${open ? html`<button type="button" class="pri addbtn" data-action="reviewStart">Repasar los meses</button>` : nothing}
    ${s.hasPayments ? html`<p class="hint">El plazo cuenta desde el último día de cada mes; las vacaciones, desde el final del contrato (ET art. 59.2).</p>` : nothing}
  </div>`;
  const accounts = html`<div class="block">
    <div class="bh"><h3>Por conceptos</h3>${s.hasPayments ? html`<button type="button" class="copybtn" data-action="copyRecordClaim" aria-label="Copiar texto de la reclamación" title="Copiar texto de la reclamación">${COPY_ICON}</button>` : nothing}</div>
    <p class="hint copy-msg" role="status"></p>
    ${ledger(s, { owing: 'Debe el ganadero', ahead: 'Cobrado de más' })}
    ${s.cobradoEnMano > 0 ? html`<div class="rows">${row('De lo cobrado, en mano (en negro)', money(s.cobradoEnMano), { cls: 'sub', sub: nothing })}</div>` : nothing}
    ${NET_HINT}
    ${s.cobradoEnMano > 0 && s.belowMinimumOnPayroll > 0 ? html`<p class="hint">La nómina declarada queda ${money(s.belowMinimumOnPayroll)} bajo el mínimo legal; lo cobrado en mano no cotiza.</p>` : nothing}
  </div>`;
  return html`${tag}${months}${accounts}`;
}

/**
 * The top of the ficha of a job under way or finished: the block of its phase, then «Cobros» and the calendar.
 * During «Repasar los meses» it is the review alone.
 * @param {RecordContext} c
 */
export function recordView(c) {
  if (c.review) return calendarView(c.review);
  return html`${c.phase === 'finished' ? cuentas(c) : hastaHoy(c)}
    ${cobrosView(c)}
    ${calendarView(c.calendar)}`;
}
