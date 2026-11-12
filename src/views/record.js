/** What the record says about a job under way or finished (ADR-0032): «Hasta hoy», «Cuentas», «Cobros» and the «Registro» fold. */

import { html, nothing } from 'lit-html';
import { fDate, joinAnd } from '../format.js';
import { fSumE } from '../ledger.js';
import { parseDate } from '../offer.js';
import { ITEM_TEXT, monthName } from '../text.js';
import { calendarView } from './calendar.js';
import { COPY_ICON, row } from './parts.js';

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

/** «Cobros»: what was received, the last two and the button for a new one. */
function cobrosView({ today, payments, fresh }) {
  const latest = payments.slice(0, 2);
  return html`<div class="block cobros">
    <div class="bh"><h2>Cobros</h2><span class="n">${money(netTotal(payments))}</span></div>
    ${
      latest.length
        ? html`<div class="pay">${latest.map((p) => paymentRow(p, today, { fresh: p.id === fresh }))}</div>
          <p class="hint">Cantidades netas: lo que llegó, sin retenciones.</p>`
        : html`<p class="hint">Todavía no hay ningún cobro apuntado.</p>`
    }
    ${payments.length > 2 ? html`<button type="button" class="linkbtn lk" data-action="openRecord">Ver los ${payments.length} cobros</button>` : nothing}
    <button type="button" class="pri addbtn" data-action="openPaySheet">+ Apuntar cobro</button>
  </div>`;
}

/** The «Registro» fold: every cobro by month, newest first, and how many months are closed. */
function recordFold({ today, payments, ask, closedMonths }) {
  /** @type {Map<string, typeof payments>} */
  const byMonth = new Map();
  for (const p of payments) byMonth.set(p.date.slice(0, 7), [...(byMonth.get(p.date.slice(0, 7)) ?? []), p]);
  const asking = ask?.type === 'payment' ? ask.id : null;
  return html`<details class="plg" data-fold="record"><summary>Registro<span class="stat dt">${closedMonths === 1 ? '1 mes cerrado' : `${closedMonths} meses cerrados`} · ${payments.length === 1 ? '1 cobro' : `${payments.length} cobros`}</span></summary>
    ${
      payments.length
        ? html`<div class="pay">${[...byMonth].map(
            ([month, list]) =>
              html`<div class="ph"><span>${capital(monthName(month))} ${month.slice(0, 4)}</span><span>${money(netTotal(list))}</span></div>${list.map((p) => paymentRow(p, today, { remove: { asking: p.id === asking } }))}`,
          )}</div>`
        : html`<p class="hint">Sin cobros apuntados.</p>`
    }
  </details>`;
}

/** «Hasta hoy»: accrued minus received is what the ganadero owes, the current month and the vacation aside. */
function hastaHoy(c) {
  const { standing: s, today, payments } = c;
  const months = joinAnd(s.ended.map((r) => monthName(r.month)));
  const owing = s.balance >= 0;
  const label = !s.hasPayments
    ? 'Hasta hoy · devengado'
    : owing
      ? `Hasta hoy, ${fWhen(today, today)} · debe el ganadero`
      : 'Hasta hoy · cobrado por adelantado';
  const sub = !s.hasPayments
    ? 'Aún no hay cobros apuntados: apunta lo cobrado para ver lo que falta.'
    : s.ended.length
      ? owing
        ? `Debe el ganadero, de ${months}.`
        : 'Se ha cobrado más de lo devengado hasta ahora.'
      : 'Todavía no ha acabado ningún mes.';
  const unclosed = s.unclosed.length ? joinAnd(s.unclosed.map((r) => monthName(r.month))) : '';
  return html`<div class="tag"><span class="lbl">${label}</span><span class="big">${money(s.hasPayments ? Math.abs(s.balance) : s.accrued)}</span><span class="sub">${sub}</span></div>
    <div class="block">
      <div class="rows">
        ${
          s.hasPayments
            ? balanceRows(s, {
                owing: 'Debe el ganadero',
                ahead: 'Cobrado por adelantado',
                accruedSub: s.ended.length ? `${months}: salario y plus de pernocta` : 'ningún mes acabado',
              })
            : row('Devengado', money(s.accrued), {
                sub: s.ended.length ? `${months}: salario y plus de pernocta` : 'ningún mes acabado',
              })
        }
      </div>
      ${s.hasPayments ? html`<p class="hint">Cantidades brutas. Lo cobrado llegó neto (${money(netTotal(payments))}): aquí se cuenta lo que equivale en bruto.</p>` : nothing}
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

/** Accrued minus received as a ledger that adds up whichever is greater: the greater first, the other taken off. */
function balanceRows(s, { owing, ahead, accruedSub }) {
  const accrued = row(s.balance >= 0 ? 'Devengado' : '− Devengado', money(s.accrued), { sub: accruedSub });
  const received = row(s.balance >= 0 ? '− Cobrado' : 'Cobrado', money(s.received), { sub: 'lo cobrado, en bruto' });
  return s.balance >= 0
    ? [accrued, received, row(`= ${owing}`, money(s.balance))]
    : [received, accrued, row(`= ${ahead}`, money(-s.balance))];
}

/** The reason an owed item is what it is. */
const why = (byMinimum) => (byMinimum ? html`<b>El mínimo legal</b>: lo pactado no llegaba` : html`<b>Lo pactado</b>`);

/** «Cuentas»: what the ganadero owes once the job is over, by item and reason, with the cash apart and the deadlines. */
function cuentas(c) {
  const { standing: s, today, payments, datesLabel } = c;
  const unclosed = s.unclosed;
  const tag = html`<div class="tag"><span class="lbl">${s.hasPayments ? 'Cuentas · debe el ganadero' : 'Cuentas · devengado'}</span><span class="big">${money(s.hasPayments ? s.owed : s.accrued)}</span><span class="sub">${
    !s.hasPayments
      ? 'Aún no hay cobros apuntados: apunta lo cobrado para ver lo que falta.'
      : unclosed.length
        ? `Con ${unclosed.length} ${unclosed.length === 1 ? 'mes según la oferta' : 'meses según la oferta'}: ${unclosed.length === 1 ? 'repásalo y ciérralo' : 'repásalos y ciérralos'} para que la cifra quede firme.`
        : 'Todos los meses están cerrados.'
  }</span></div>`;
  const toClose = unclosed.length
    ? html`<div class="block"><div class="bh"><h3>Meses por cerrar</h3><span class="hint">${unclosed.length}</span></div>
        <div class="tocl">${unclosed.map((r) => html`<div><span><b>${capital(monthName(r.month))}</b><small>según la oferta</small></span><span class="n">${money(r.due)}</span></div>`)}</div>
        <button type="button" class="pri addbtn" data-action="reviewStart">Repasar los meses</button></div>`
    : nothing;
  if (!s.hasPayments)
    return html`${tag}${toClose}<div class="block"><div class="rows">${row('Devengado', money(s.accrued), { sub: datesLabel })}</div></div>`;
  const shown = s.items.filter((x) => x.due > 0);
  return html`${tag}${toClose}
    <div class="block">
      <div class="bh"><h3>Lo que debe el ganadero</h3><button type="button" class="copybtn" data-action="copyRecordClaim" aria-label="Copiar texto de la reclamación" title="Copiar texto de la reclamación">${COPY_ICON}</button></div>
      <p class="hint copy-msg" role="status"></p>
      <div class="rows">
        ${shown.map((x, i) => row(`${i ? '+ ' : ''}${ITEM_TEXT[x.item]}`, money(x.owed), { sub: why(x.byMinimum), valueCls: 'bad' }))}
        ${row('= Total', money(s.owed), { valueCls: 'bad' })}
      </div>
      <div class="rows">
        ${balanceRows(s, { owing: 'Debe el ganadero', ahead: 'Cobrado de más', accruedSub: datesLabel })}
        ${s.cash > 0 ? row('De lo cobrado, en mano', money(s.cash), { cls: 'sub', sub: 'neto, tal cual se entregó: en negro, no cotiza' }) : nothing}
      </div>
      <p class="hint">Cantidades brutas. Lo cobrado llegó neto (${money(netTotal(payments))}): aquí se cuenta lo que equivale en bruto.</p>
      ${s.cash > 0 && s.belowMinimumOnPayroll > 0 ? html`<p class="hint">Lo declarado en nómina queda ${money(s.belowMinimumOnPayroll)} por debajo del mínimo legal: lo cobrado en mano cubre lo debido, pero no cotiza.</p>` : nothing}
    </div>
    ${
      s.deadlines.length
        ? html`<div class="block"><div class="bh"><h3>Plazo para reclamar</h3><span class="hint">un año por pago</span></div>
        <div class="rows">${s.deadlines.map((d, i) =>
          row(`${i ? '+ ' : ''}${capital(monthName(d.month))}`, money(d.owed), {
            sub: html`<span class=${d.lapsed || d.daysLeft < 120 ? 'due-by near' : 'due-by'}>${d.lapsed ? `plazo vencido el ${fWhen(d.deadline, today)}` : `hasta el ${fWhen(d.deadline, today)} · quedan ${d.daysLeft} ${d.daysLeft === 1 ? 'día' : 'días'}`}</span>`,
          }),
        )}${s.deadlines.length > 1 ? row('= Total', money(s.deadlines.reduce((t, d) => t + d.owed, 0))) : nothing}</div>
        <p class="hint">Se cuenta desde el último día de cada mes; las vacaciones, desde el final del contrato (ET art. 59.2).</p></div>`
        : nothing
    }`;
}

/**
 * The top of the ficha of a job under way or finished: the block of its phase, then «Cobros», the calendar and the
 * «Registro» fold. During «Repasar los meses» it is the review alone.
 * @param {RecordContext} c
 */
export function recordView(c) {
  if (c.review) return calendarView(c.review);
  return html`${c.phase === 'finished' ? cuentas(c) : hastaHoy(c)}
    ${cobrosView(c)}
    ${calendarView(c.calendar)}
    ${recordFold(c)}`;
}
