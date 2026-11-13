/** What the record says about a job under way or finished (ADR-0032): «Hasta hoy», «Cuentas» and «Cobros». */

import { html, nothing } from 'lit-html';
import { fDate } from '../format.js';
import { fSumE } from '../ledger.js';
import { parseDate } from '../offer.js';
import { monthName, monthShort } from '../text.js';
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

/** The three figures of the job, in net: Corresponde, Cobrado (of it, in hand) and Falta. */
function tiles(s) {
  return html`<div class="sofar">
    <div><span>Corresponde</span><b>${money(s.corresponde)}</b></div>
    <div><span>Cobrado</span><b>${money(s.cobrado)}</b>${s.cobradoEnMano > 0 ? html`<small>de ello, en mano ${money(s.cobradoEnMano)}</small>` : nothing}</div>
    <div class="f"><span>Falta</span><b>${s.hasPayments ? money(s.falta) : '—'}</b></div>
  </div>`;
}

/** What the figures leave to say: nothing cobrado yet, cash agreed and not cobrado, more cobrado than calculated. */
function notes(s, { over }) {
  return html`${!s.hasPayments ? html`<p class="hint">Aún no hay cobros apuntados: apunta lo cobrado para ver lo que falta.</p>` : nothing}
    ${s.hasPayments && s.enManoAgreed > 0 && s.cobradoEnMano === 0 ? html`<p class="hint">Sin cobros en mano apuntados: se pactaron ${money(s.enManoAgreed)} en mano.</p>` : nothing}
    ${s.sobra >= 1 ? html`<p class="hint">Se cobró ${money(s.sobra)} más de lo calculado${over}: las retenciones reales de la nómina suelen diferir de las simuladas.</p>` : nothing}`;
}

const MONTH_STATE = { closed: '✔ cerrado', due: 'por cerrar', now: 'en curso', later: 'por venir' };

/** The months of the job in a strip; the one tapped opens below. */
function strip(c) {
  return html`<div class="strip" role="group" aria-label="Meses del trabajo">${c.strip.map(
    (m) =>
      html`<button type="button" class=${`${m.state === 'closed' ? 'closed' : ''} ${m.state === 'due' ? 'due' : ''} ${m.state === 'later' ? 'later' : ''}`} data-action="selectMonth" data-key=${m.month} aria-current=${String(m.selected)} ?disabled=${m.state === 'later'}>${capital(monthShort(m.month))}<small>${MONTH_STATE[m.state]}</small></button>`,
  )}</div>`;
}

/** «Registro»: the months strip, «Hasta hoy» in net, the month open below with its calendar, and the cobros. */
function registro(c) {
  const { standing: s, today } = c;
  const aside = [
    s.running ? `${monthName(s.running.month)} hasta hoy ${money(s.running.amount)}` : '',
    s.vacation > 0 ? `vacaciones ${money(s.vacation)}, al acabar` : '',
  ].filter(Boolean);
  return html`<h2 class="mode">Registro<small>Lo que pasa, mes a mes.</small></h2>
    ${strip(c)}
    ${c.nudge ? html`<div class="nudge"><span>${capital(monthName(c.nudge.month))}, por cerrar.</span><button type="button" class="linkbtn" data-action="selectMonth" data-key=${c.nudge.month}>Abrir</button></div>` : nothing}
    <div class="block">
      <div class="bh"><h3>Hasta hoy, ${fWhen(today, today)}</h3></div>
      ${tiles(s)}
      ${NET_HINT}
      ${notes(s, { over: ' hasta hoy' })}
      ${aside.length ? html`<p class="hint">Aparte, aún sin pagar: ${aside.join(' · ')}.</p>` : nothing}
    </div>
    ${calendarView(c.calendar)}
    ${cobrosView(c)}`;
}

/**
 * What corresponds, less what was received, is what is owed (Cuentas, until its redesign).
 */
function ledger(s, { owing }) {
  const lines = [...ledgerLines(s.lines), row('= Corresponde', money(s.corresponde))];
  if (!s.hasPayments) return html`<div class="rows">${lines}</div>`;
  return html`<div class="rows">${lines}${row('− Cobrado', money(Math.min(s.cobrado, s.corresponde)))}${row(`= ${owing}`, money(s.falta), { valueCls: 'bad' })}</div>`;
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
    ${ledger(s, { owing: 'Debe el ganadero' })}
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
  return c.phase === 'finished' ? html`${cuentas(c)}${cobrosView(c)}${calendarView(c.calendar)}` : registro(c);
}
