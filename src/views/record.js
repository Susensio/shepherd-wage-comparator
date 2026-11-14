/** What the record says about a job under way or finished (ADR-0032): «Hasta hoy», «Cuentas» and «Cobros». */

import { html, nothing } from 'lit-html';
import { fDate, fDaysSpoken } from '../format.js';
import { LAW } from '../law.js';
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

/** «Cobros»: everything received, each cobro removable, and the button for a new one. Month headers only when it spans several. */
function cobrosView({ today, payments, fresh, ask }) {
  const asking = ask?.type === 'payment' ? ask.id : null;
  /** @type {Map<string, typeof payments>} */
  const byMonth = new Map();
  for (const p of payments) byMonth.set(p.date.slice(0, 7), [...(byMonth.get(p.date.slice(0, 7)) ?? []), p]);
  const row = (p) => paymentRow(p, today, { fresh: p.id === fresh, remove: { asking: p.id === asking } });
  return html`<div class="block cobros">
    <div class="bh"><h2>Cobros</h2><span class="n">${money(netTotal(payments))}</span></div>
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
    ${s.hasPayments && s.enManoAgreed > 0 && s.cobradoEnMano === 0 ? html`<p class="hint">Sin cobros en mano apuntados. Pactado en mano: ${money(s.enManoAgreed)}.</p>` : nothing}
    ${s.sobra >= 1 ? html`<p class="hint">Cobrado ${money(s.sobra)} por encima de lo calculado${over}. Las retenciones reales de la nómina suelen diferir de las simuladas.</p>` : nothing}`;
}

const MONTH_STATE = { closed: '✔ cerrado', due: 'por cerrar', now: 'en curso', later: 'por venir', add: 'añadir' };

/** The months of the job in a strip; the one tapped opens below. */
function strip(c) {
  return html`<div class="monthstrip" role="group" aria-label="Meses del trabajo">${c.strip.map(
    (m) =>
      html`<button type="button" class=${`${m.state === 'closed' ? 'closed' : ''} ${m.state === 'due' ? 'due' : ''} ${m.state === 'later' ? 'later' : ''} ${m.state === 'add' ? 'add' : ''}`} data-action="selectMonth" data-key=${m.month} aria-current=${String(m.selected)} ?disabled=${m.state === 'later'}>${m.state === 'add' ? '+ ' : ''}${capital(monthShort(m.month))}<small>${MONTH_STATE[m.state]}</small></button>`,
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

/** «Detalle de lo que corresponde»: the lines that add up to Corresponde, in a closed fold. */
const howItAdds = (s) =>
  html`<details class="plg" data-fold="how"><summary>Detalle de lo que corresponde</summary><div class="rows">${ledgerLines(s.lines)}${row('= Corresponde', money(s.corresponde))}</div></details>`;

/** The yellow block: what the ganadero owes, the three figures, and the one action while months are not closed. */
function result(c) {
  const { standing: s } = c;
  const open = s.unclosed.length;
  const minimum = c.law.minimum;
  return html`<div class="block result">
    <div class="tag"><span class="lbl">${s.hasPayments ? 'Debe el ganadero' : 'Corresponde'}</span><span class="big">${money(s.hasPayments ? s.falta : s.corresponde)}</span><span class="sub">${
      !s.hasPayments
        ? 'Aún no hay cobros apuntados: apunta lo cobrado para ver lo que falta.'
        : open
          ? `${open} ${open === 1 ? 'mes' : 'meses'} según la oferta: la cifra no es firme hasta cerrarlos.`
          : 'Todos los meses están cerrados.'
    }</span></div>
    ${tiles(s)}
    ${NET_HINT}
    ${notes(s, { over: '' })}
    ${minimum.known && minimum.short >= 1 ? html`<p class="hint">La nómina declarada está ${money(minimum.short)} por debajo del mínimo legal; lo cobrado en mano no cotiza.</p>` : nothing}
    ${open ? html`<button type="button" class="pri addbtn" data-action="reviewStart">Revisar los meses</button>` : nothing}
  </div>`;
}

/** «Balance del trabajo»: what it came to, from «Final de campaña» without its simulator; what still follows the offer says so. */
function balanceBlock(c) {
  const { balance: b, standing: s } = c;
  const cashLine = s.lines.find((x) => x.key === 'cash');
  const unsure = b.firm ? '' : 'estimado: hay meses según la oferta';
  return html`<div class="block"><div class="bh"><h2>Balance del trabajo</h2></div>
    <div class="rows">
      ${row('Corresponde en total', money(b.corresponde), { sub: [unsure || 'con todos los meses cerrados', cashLine && cashLine.due > 0 ? `de ello, en negro ${money(cashLine.due)}` : ''].filter(Boolean).join(' · ') })}
      ${row('Cobrado', money(b.cobrado), { sub: `en nómina ${money(b.cobradoNomina)} · en mano ${money(b.cobradoMano)}` })}
      ${row('Jornadas', String(b.worked), { sub: b.firm ? 'de los meses cerrados' : `${b.workedClosed} en meses cerrados; el resto, según la oferta` })}
      ${b.contribDays > 0 ? row('Días cotizados', String(Math.round(b.contribDays)), { sub: 'según la oferta (la nómina real no se apunta)' }) : nothing}
      ${b.paroDays >= 1 ? row('Paro', `unos ${Math.round(b.paroDays)} días`, { sub: `unos ${money(b.paroEuros)}, según la oferta; se cobran más adelante` }) : nothing}
    </div>
    ${howItAdds(s)}
  </div>`;
}

/** The claim: the text to copy, the nearest deadline, and the deadline of each month in a closed fold. Only while something is missing. */
function claim(c) {
  const { standing: s, today } = c;
  if (!s.hasPayments || s.falta <= 0) return nothing;
  const near = s.nearest;
  const by = (d) =>
    d.lapsed
      ? `plazo vencido el ${fWhen(d.deadline, today)}`
      : `hasta el ${fWhen(d.deadline, today)} · quedan ${d.daysLeft} ${d.daysLeft === 1 ? 'día' : 'días'}`;
  return html`<div class="block">
    <div class="bh"><h2>Reclamar</h2><button type="button" class="copybtn" data-action="copyRecordClaim" aria-label="Copiar texto de la reclamación" title="Copiar texto de la reclamación">${COPY_ICON}</button></div>
    <p class="hint copy-msg" role="status"></p>
    ${near ? html`<p class=${near.lapsed || near.daysLeft < 120 ? 'due-line near' : 'due-line'}>Plazo más cercano: lo de ${monthName(near.month)}, ${by(near)}.</p>` : nothing}
    ${
      s.deadlines.length
        ? html`<details class="plg" data-fold="deadlines"><summary>Plazos por mes</summary><div class="rows">${s.deadlines.map((d) => row(capital(monthName(d.month)), money(d.owed), { sub: html`<span class=${d.lapsed || d.daysLeft < 120 ? 'due-by near' : 'due-by'}>${by(d)}</span>` }))}</div>
          <p class="hint">Se cuenta un año desde el último día de cada mes; las vacaciones, desde el final del contrato (ET art. 59.2). Los cobros se asignan al mes más antiguo solo para fechar la reclamación.</p></details>`
        : nothing
    }
  </div>`;
}

/** «Registro del trabajo»: the months and the cobros, open only while something remains to record. */
function registroFold(c) {
  const { standing: s } = c;
  const months = c.strip.filter((m) => m.state !== 'add');
  const open = s.unclosed.length > 0 || c.payments.length === 0;
  return html`<details class="plg" data-autofold="registro" ?open=${open}><summary>Registro del trabajo<span class="stat dt">${s.unclosed.length ? `${s.unclosed.length} sin cerrar` : 'meses cerrados'} · ${c.payments.length === 1 ? '1 cobro' : `${c.payments.length} cobros`}</span></summary>
    <div class="tocl">${months.map((m) => html`<button type="button" class="monthrow" data-action="reviewStart" data-key=${m.month}><span><b>${capital(monthName(m.month))}</b> <small>${m.state === 'closed' ? 'cerrado' : 'según la oferta'}</small></span><span aria-hidden="true">›</span></button>`)}</div>
    ${c.addable ? html`<button type="button" class="linkbtn addmonth" data-action="reviewStart" data-key=${c.addable}>+ Añadir ${monthName(c.addable)}</button>` : nothing}
    ${cobrosView(c)}
  </details>`;
}

/** «¿Se cumplió la ley?»: facts only, from the record; what is not settled yet says when it will be. */
function lawBlock(c) {
  const { law } = c;
  const weeks = LAW.restPeriodWeeks;
  const mark = (kind, title, text) =>
    html`<div><span class=${`m ${kind}`}>${{ ok: '✔', bad: '✘', warn: '?' }[kind]}</span><span><b>${title}</b><small>${text}</small></span></div>`;
  if (law.months.closed === 0)
    return html`<div class="block"><div class="bh"><h2>¿Se cumplió la ley?</h2></div><p class="hint">Cierra los meses para comprobarlo.</p></div>`;
  const range = (f) => `${fWhen(f.from, c.today)}–${fWhen(f.to, c.today)}: ${f.off} de ${f.due}`;
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
          `${law.days.worked} jornadas; corresponden unas ${Math.round(law.days.due)} con descanso, festivos y vacaciones: unas ${extra} de más (estimado).`,
        )
      : mark(
          'ok',
          'Jornadas de más',
          `${law.days.worked} jornadas, dentro de las unas ${Math.round(law.days.due)} que corresponden (estimado).`,
        );
  const later = law.allClosed
    ? 'Apunta la nómina cobrada para comprobarlo.'
    : 'Se comprobará al cerrar todos los meses.';
  const o = law.overnight;
  const overnight = !o.applicable
    ? nothing
    : !o.known
      ? mark('warn', 'Plus de pernocta', later)
      : o.missing >= 1
        ? mark(
            'bad',
            'Plus de pernocta',
            `Lo cobrado no lo cubre: faltan ${money(o.missing)} de ${money(o.due)} (el ${LAW.overnightPct} % del salario, netos).`,
          )
        : mark('ok', 'Plus de pernocta', 'Cubierto con lo cobrado.');
  const m = law.minimum;
  const minimum = !m.known
    ? mark('warn', 'Salario mínimo en nómina', later)
    : m.short >= 1
      ? mark(
          'bad',
          'Salario mínimo en nómina',
          `Cobrado en nómina: ${money(m.payroll)} netos. Mínimo equivalente: unos ${money(m.minimumNet)} netos; la diferencia supera lo que explican las retenciones.`,
        )
      : mark(
          'ok',
          'Salario mínimo en nómina',
          'Lo cobrado en nómina cubre el mínimo, en neto y con margen para las retenciones.',
        );
  return html`<div class="block"><div class="bh"><h2>¿Se cumplió la ley?</h2></div>
    <p class="hint">Según el registro, sobre ${law.months.closed} de ${law.months.total} ${law.months.total === 1 ? 'mes cerrado' : 'meses cerrados'}.</p>
    <div class="lawcheck">${rest}${days}${overnight}${minimum}</div>
    <p class="hint">No se puede comprobar con lo apuntado: festivos trabajados ni el mínimo contra la nómina real.</p>
  </div>`;
}

/** «Cuentas»: the result first, the chores last. The offer's own analysis, for reference, is the fold the ficha adds after it. */
function cuentas(c) {
  return html`<h2 class="mode small">Cuentas</h2>
    ${result(c)}
    ${balanceBlock(c)}
    ${lawBlock(c)}
    ${claim(c)}
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
  return html`${realPeriod(c)}${c.phase === 'finished' ? cuentas(c) : registro(c)}`;
}
