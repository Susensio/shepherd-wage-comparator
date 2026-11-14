/** What the record says about a job under way or finished (ADR-0032): «Hasta hoy», «Cuentas» and «Cobros». */

import { html, nothing } from 'lit-html';
import { fDate, fDaysSpoken, fE, fN, joinAnd } from '../format.js';
import { LAW } from '../law.js';
import { fSumE } from '../ledger.js';
import { parseDate } from '../offer.js';
import { monthName, monthShort } from '../text.js';
import { calendarView } from './calendar.js';
import { claimView, closingHints } from './claim.js';
import { ledgerLines, row } from './parts.js';
import { endLine, endQuestion, startQuestion } from './transitions.js';

/** @typedef {import('../ui/record.js').RecordContext} RecordContext */

const capital = (text) => text[0].toUpperCase() + text.slice(1);
const money = fSumE;
/** Whole euros: headlines, tiles and sentences; cents only in the ledgers, where the sums have to add up. */
const whole = (amount) => fE(amount, 0);
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

/** «Cobros»: everything received, each cobro removable, and the button for a new one. Month headers only when it spans several. */
function cobrosView({ today, payments, fresh, ask, nothingPaid }) {
  const asking = ask?.type === 'payment' ? ask.id : null;
  /** @type {Map<string, typeof payments>} */
  const byMonth = new Map();
  for (const p of payments) byMonth.set(p.date.slice(0, 7), [...(byMonth.get(p.date.slice(0, 7)) ?? []), p]);
  const row = (p) => paymentRow(p, today, { fresh: p.id === fresh, remove: { asking: p.id === asking } });
  return html`<div class="block cobros">
    <div class="bh"><h3>Cobros</h3><span class="n">${money(netTotal(payments))}</span></div>
    ${
      !payments.length
        ? html`<p class="hint">Todavía no hay ningún cobro apuntado.</p>`
        : byMonth.size > 1
          ? html`<div class="pay">${[...byMonth].map(
              ([month, list]) =>
                html`<div class="ph"><span>${capital(monthName(month))} ${month.slice(0, 4)}</span><span>${money(netTotal(list))}</span></div>${list.map(row)}`,
            )}</div>`
          : html`<div class="pay">${payments.map(row)}</div>`
    }
    <button type="button" class="pri addbtn" data-action="openPaySheet">+ Apuntar cobro</button>
    ${
      !payments.length
        ? nothingPaid
          ? html`<p class="hint">Se apuntó que no se cobró nada. <button type="button" class="linkbtn" data-action="nothingPaid" data-off>Quitar</button></p>`
          : html`<button type="button" class="linkbtn" data-action="nothingPaid">No se cobró nada</button>`
        : nothing
    }
  </div>`;
}

/** «Apuntes»: dated notes for the Expediente; today's date goes on each. */
function apuntesView(c) {
  const notes = c.record.evidence ?? [];
  return html`<div class="block apuntes">
    <div class="bh"><h3>Apuntes</h3></div>
    ${notes.length ? html`<div class="pay">${notes.map((n, i) => html`<div class="pr"><span class="d">${fWhen(n.date, c.today)}</span><span>${n.text}</span><span></span><button type="button" class="linkbtn rm" data-action="removeNote" data-index=${i}>Quitar</button></div>`)}</div>` : html`<p class="hint">Lo que pasa y conviene recordar: lo que dijo el ganadero, una promesa de pago.</p>`}
    <label class="fld">Nuevo apunte<input type="text" id="noteText" autocomplete="off" /></label>
    <button type="button" class="sm" data-action="addNote">Añadir apunte</button>
  </div>`;
}

const LABEL = { salary: 'salario mínimo', overnight: 'plus de pernocta (convenio)', vacation: 'vacaciones' };
const SHORT_LINE = {
  salary: (amount) => `El salario no llega al mínimo: faltan ${amount}`,
  overnight: (amount) => `El plus de pernocta (convenio) no se paga: corresponden ${amount} más`,
  vacation: (amount) => `Las vacaciones no se pagan aparte: corresponden ${amount} más`,
};
/**
 * Said only where an item falls short of the minimum. The sentence comparing totals only where the minimum as a whole is
 * above the pay agreed; otherwise each item that falls short, so a minimum is never printed below the pay as if it exceeded it.
 */
const minimumLine = (m) => {
  if (!m) return nothing;
  if (!m.exceeds)
    return html`<p class="hint">${m.short.map((x) => SHORT_LINE[x.key](`${fN(x.amount, 2)} €/${m.unit} netos`)).join('. ')}.</p>`;
  return html`<p class="hint">El mínimo exigible supera lo pactado: ${m.components.map((x) => `${LABEL[x.key]} ${fN(x.amount, 2)} €`).join(' + ')}${m.components.length > 1 ? ` = ${fN(m.total, 2)} €/${m.unit} netos` : `/${m.unit} netos`}; pactado: ${fN(m.agreed, 2)} €/${m.unit}.</p>`;
};

const NET_HINT = html`<p class="hint">Cantidades netas: lo que llega, sin retenciones.</p>`;

/** The three figures of the job, in net: Corresponde, Cobrado (of it, in hand) and Falta. */
function tiles(s) {
  return html`<div class="sofar">
    <div><span>Corresponde</span><b>${whole(s.corresponde)}</b></div>
    <div><span>Cobrado</span><b>${whole(s.cobrado)}</b>${s.cobradoEnMano > 0 ? html`<small>de ello, en mano ${whole(s.cobradoEnMano)}</small>` : nothing}</div>
    <div class="f"><span>Falta</span><b>${s.hasPayments ? whole(s.falta) : '—'}</b></div>
  </div>`;
}

/** What the figures leave to say: nothing cobrado yet, cash agreed and not cobrado, more cobrado than calculated. */
function notes(s, { over, saidNoCobros = false }) {
  return html`${!s.hasPayments && !saidNoCobros ? html`<p class="hint">Aún no hay cobros apuntados: apunta lo cobrado para ver lo que falta.</p>` : nothing}
    ${s.hasPayments && s.enManoAgreed > 0 && s.cobradoEnMano === 0 ? html`<p class="hint">Sin cobros en mano apuntados. Pactado en mano: ${whole(s.enManoAgreed)}.</p>` : nothing}
    ${s.sobra >= 1 ? html`<p class="hint">Cobrado ${whole(s.sobra)} por encima de lo calculado${over}. Las retenciones reales de la nómina suelen diferir de las simuladas.</p>` : nothing}`;
}

const MONTH_STATE = { closed: '✔ cerrado', due: 'por cerrar', now: 'en curso', later: 'por venir', add: 'añadir' };

/** The months of the job in a strip; the one tapped opens below. */
function strip(c) {
  return html`<div class="monthstrip" role="group" aria-label="Meses del trabajo">${c.strip.map(
    (m) =>
      html`<button type="button" class=${`${m.state === 'closed' ? 'closed' : ''} ${m.state === 'due' ? 'due' : ''} ${m.state === 'later' ? 'later' : ''} ${m.state === 'add' ? 'add' : ''}`} data-action="selectMonth" data-key=${m.month} aria-current=${String(m.selected)} ?disabled=${m.state === 'later'}>${m.state === 'add' ? '+ ' : ''}${capital(monthShort(m.month))}<small>${MONTH_STATE[m.state]}</small></button>`,
  )}</div>`;
}

/** The months that wait to be closed, all named up to three, else counted. */
const nudgeText = (months) =>
  months.length === 1
    ? `${capital(monthName(months[0]))}, por cerrar.`
    : months.length <= 3
      ? `${capital(joinAnd(months.map(monthName)))}, por cerrar.`
      : `${months.length} meses por cerrar.`;

/** «Registro»: the months strip, «Hasta hoy» in net, the month open below with its calendar, and the cobros. */
function registro(c) {
  const { standing: s, today } = c;
  return html`<h2 class="mode">Registro<small>Lo que pasa, mes a mes.</small></h2>
    ${strip(c)}
    ${c.nudge ? html`<div class="nudge"><span>${nudgeText(c.nudge.months)}</span><button type="button" class="linkbtn" data-action="selectMonth" data-key=${c.nudge.months[0]}>Abrir${c.nudge.months.length > 1 ? ` ${monthName(c.nudge.months[0])}` : ''}</button></div>` : nothing}
    <div class="block">
      <div class="bh"><h3>Hasta hoy, ${fWhen(today, today)}</h3></div>
      ${tiles(s)}
      ${NET_HINT}
      ${notes(s, { over: ' hasta hoy' })}
      ${minimumLine(c.minimum)}
      ${s.running ? html`<p class="hint">${capital(monthName(s.running.month))}, el mes en curso, se cuenta hasta hoy.</p>` : nothing}
    </div>
    ${calendarView(c.calendar)}
    ${cobrosView(c)}
    ${apuntesView(c)}`;
}

/** «Detalle de lo que corresponde»: the lines that add up to Corresponde, in a closed fold. */
const howItAdds = (s) =>
  html`<details class="plg" data-fold="how"><summary>Detalle de lo que corresponde</summary><div class="rows">${ledgerLines(s.lines)}${row('= Corresponde', money(s.corresponde))}</div></details>`;

/** The yellow block: what the ganadero owes, the three figures, and the one action while months are not closed. */
function result(c) {
  const { standing: s } = c;
  const open = s.unclosed.length;
  return html`<div class="block result">
    <div class="tag"><span class="lbl">${s.hasPayments ? 'Debe el ganadero' : 'Corresponde'}</span><span class="big">${whole(s.hasPayments ? s.falta : s.corresponde)}</span><span class="sub">${
      !s.hasPayments
        ? 'Aún no hay cobros apuntados: apunta lo cobrado para ver lo que falta.'
        : open
          ? `${open} ${open === 1 ? 'mes' : 'meses'} según la oferta: la cifra no es firme hasta cerrarlos.`
          : 'Todos los meses están cerrados.'
    }</span></div>
    ${tiles(s)}
    ${NET_HINT}
    ${notes(s, { over: '', saidNoCobros: true })}
    ${open ? html`<button type="button" class="pri addbtn" data-action="reviewStart">Revisar los meses</button>` : nothing}
  </div>`;
}

/** «Balance del trabajo»: what the job left besides the tiles, from «Final de campaña» without its simulator; what still follows the offer says so. */
function balanceBlock(c) {
  const { balance: b, standing: s } = c;
  const vacation = Math.round(b.contribVacationDays);
  return html`<div class="block"><div class="bh"><h2>Balance del trabajo</h2></div>
    ${minimumLine(c.minimum)}
    <div class="rows">
      ${row('Jornadas', String(b.worked), { sub: b.firm ? 'de los meses cerrados' : `${b.workedClosed} en meses cerrados; el resto, según la oferta` })}
      ${b.contribDays > 0 ? row('Días cotizados', String(Math.round(b.contribDays)), { sub: `según la oferta (la nómina real no se apunta)${vacation >= 1 ? `; incluye ${vacation} ${vacation === 1 ? 'día' : 'días'} de vacaciones pagadas` : ''}` }) : nothing}
      ${b.paroDays >= 1 ? row('Paro', `unos ${Math.round(b.paroDays)} días`, { sub: `unos ${whole(b.paroEuros)}, según la oferta; se cobran más adelante` }) : nothing}
    </div>
    ${howItAdds(s)}
  </div>`;
}

/** «Registro del trabajo»: the months and the cobros, open only while something remains to record. */
function registroFold(c) {
  const { standing: s } = c;
  const months = c.strip.filter((m) => m.state !== 'add');
  const open = s.unclosed.length > 0 || c.payments.length === 0;
  const closed = months.length - s.unclosed.length;
  return html`<details class="plg" data-autofold="registro" ?open=${open}><summary>Registro del trabajo<span class="stat dt">${s.unclosed.length ? `${s.unclosed.length} sin cerrar` : closed === 1 ? '1 mes cerrado' : `${closed} meses cerrados`} · ${c.payments.length === 1 ? '1 cobro' : `${c.payments.length} cobros`}</span></summary>
    <div class="tocl">${months.map((m) => html`<button type="button" class="monthrow" data-action="reviewStart" data-key=${m.month}><span><b>${capital(monthName(m.month))}</b> <small>${m.state === 'closed' ? 'cerrado' : 'según la oferta'}</small></span><span aria-hidden="true">›</span></button>`)}</div>
    ${c.addable ? html`<button type="button" class="linkbtn addmonth" data-action="reviewStart" data-key=${c.addable}>+ Añadir ${monthName(c.addable)}</button>` : nothing}
    ${cobrosView(c)}
    ${apuntesView(c)}
  </details>`;
}

const FACT_TEXT = {
  noContract: [
    'Sin contrato',
    'No hay alta en la Seguridad Social: ni cotización, ni paro, ni derechos de un contrato.',
  ],
  cash: (amount) => ['Parte en negro', `Se pactan ${whole(amount)} netos en negro: no cotizan.`],
};

/**
 * «¿Se cumplió la ley?»: facts only. The facts of the terms are always shown (no contract, cash agreed); the rest and the
 * days worked judge closed months alone; the minimum on payroll and the plus de pernocta wait until every cobro is known.
 */
function lawBlock(c) {
  const { law } = c;
  const weeks = LAW.restPeriodWeeks;
  const mark = (kind, title, text) =>
    html`<div><span class=${`m ${kind}`}>${{ ok: '✔', bad: '✘', warn: '?' }[kind]}</span><span><b>${title}</b><small>${text}</small></span></div>`;
  const facts = law.facts.map((f) =>
    mark('bad', ...(f.id === 'cash' ? FACT_TEXT.cash(f.amount) : FACT_TEXT.noContract)),
  );
  const range = (f) => `${fWhen(f.from, c.today)}–${fWhen(f.to, c.today)}: ${f.off} de ${f.due}`;
  const closedMonths = law.months.closed > 0;
  const rest = !law.rest.periods
    ? mark('warn', 'Descanso semanal', `Aún no hay un periodo de ${weeks} semanas entero en meses cerrados.`)
    : law.rest.fails.length
      ? mark(
          'bad',
          'Descanso semanal',
          `Días libres insuficientes en ${law.rest.fails.length} de ${law.rest.periods} periodos de ${weeks} semanas: ${law.rest.fails.slice(0, 2).map(range).join('; ')}${law.rest.fails.length > 2 ? ` y ${law.rest.fails.length - 2} más` : ''}.`,
        )
      : mark(
          'ok',
          'Descanso semanal',
          `Se libra al menos ${fDaysSpoken(LAW.weeklyRest)} por semana en todos los periodos de ${weeks} semanas.`,
        );
  const extra = Math.round(law.days.extra);
  const days =
    extra >= 1
      ? mark(
          'bad',
          'Jornadas de más',
          `${law.days.worked} jornadas; corresponden unas ${Math.round(law.days.due)} con descanso, festivos y vacaciones: unas ${extra} de más.`,
        )
      : mark(
          'ok',
          'Jornadas de más',
          `${law.days.worked} jornadas, dentro de las unas ${Math.round(law.days.due)} que corresponden.`,
        );
  const wait = mark(
    'warn',
    law.overnight.applicable ? 'Salario mínimo en nómina y plus de pernocta' : 'Salario mínimo en nómina',
    'Se comprobará cuando estén apuntados todos los cobros.',
  );
  return html`<div class="block"><div class="bh"><h2>¿Se cumplió la ley?</h2></div>
    ${closedMonths ? html`<p class="hint">Según el registro, sobre ${law.months.closed} de ${law.months.total} ${law.months.total === 1 ? 'mes cerrado' : 'meses cerrados'}.</p>` : nothing}
    <div class="lawcheck">${facts}${closedMonths ? html`${rest}${days}` : nothing}${wait}</div>
    ${closedMonths ? html`<p class="hint">No se puede comprobar con lo apuntado: festivos trabajados.</p>` : html`<p class="hint">Cierra los meses para comprobar el descanso semanal y las jornadas.</p>`}
  </div>`;
}

/** «Cuentas»: the result first, the chores last. The offer's own analysis, for reference, is the fold the ficha adds after it. */
function cuentas(c) {
  const settled = c.standing.hasPayments && c.standing.falta === 0;
  return html`<h2 class="mode small">Cuentas${settled ? html`<small>Cuentas saldadas</small>` : nothing}</h2>
    ${result(c)}
    ${endQuestion(c.cards, c.today, false)}
    ${balanceBlock(c)}
    ${lawBlock(c)}
    ${claimView(c.claim)}
    ${closingHints()}
    ${registroFold(c)}`;
}

/** «Trabajo real»: only where the days marked make the work run otherwise than the offer's dates say. */
function realPeriod(c) {
  const { job } = c;
  if (!job.differs) return nothing;
  const date = (iso) => fDate(parseDate(iso));
  const said = job.from === job.offerFrom ? date(job.offerTo) : `del ${date(job.offerFrom)} al ${date(job.offerTo)}`;
  return html`<p class="real">Trabajo real: del ${date(job.from)} al ${date(job.to)} (oferta: ${said}).</p>`;
}

/**
 * The top of the ficha of a job under way or finished: the block of its phase, then «Cobros» and the calendar.
 * During «Repasar los meses» it is the review alone.
 * @param {RecordContext} c
 */
export function recordView(c) {
  if (c.review) return calendarView(c.review);
  return html`${startQuestion(c.cards, c.today)}${endQuestion(c.cards, c.today, true)}${endLine(c.record)}${realPeriod(c)}${c.phase === 'finished' ? cuentas(c) : registro(c)}`;
}
