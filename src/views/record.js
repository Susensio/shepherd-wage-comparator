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

const MONTH_STATE = { closed: '✔ cerrado', due: 'por cerrar', now: 'en curso', later: 'por venir', add: 'añadir' };

/** The months of the job in a strip; the one tapped opens below. */
function strip(c) {
  return html`<div class="strip" role="group" aria-label="Meses del trabajo">${c.strip.map(
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

/** «Cómo sale lo que corresponde»: the lines that add up to Corresponde, in a closed fold. */
const howItAdds = (s) =>
  html`<details class="plg" data-fold="how"><summary>Cómo sale lo que corresponde</summary><div class="rows">${ledgerLines(s.lines)}${row('= Corresponde', money(s.corresponde))}</div></details>`;

/** The months of a job that is over, each one opening its calendar; the ones not closed first in the flow. */
function monthsToRecord(c) {
  const months = c.strip.filter((m) => m.state !== 'add');
  const open = months.filter((m) => m.state !== 'closed');
  return html`<div class=${open.length ? 'step' : 'step done'}><span class="num">${open.length ? '1' : '✔'}</span><div class="sb">
    <h3>Registrar lo que falta</h3>
    <p class="hint">${open.length ? `${open.length === 1 ? 'Queda 1 mes sin cerrar' : `Quedan ${open.length} meses sin cerrar`}. Cada uno se abre con su calendario.` : 'Todos los meses cerrados: días confirmados.'}</p>
    <div class="tocl">${months.map((m) => html`<div><span><b>${capital(monthName(m.month))}</b> <small>${m.state === 'closed' ? 'cerrado' : 'según la oferta'}</small></span><button type="button" class="linkbtn" data-action="reviewStart" data-key=${m.month}>${m.state === 'closed' ? 'Ver' : 'Abrir'}</button></div>`)}</div>
    ${c.addable ? html`<button type="button" class="linkbtn addmonth" data-action="reviewStart" data-key=${c.addable}>+ Añadir ${monthName(c.addable)}</button>` : nothing}
    ${open.length ? html`<button type="button" class="pri addbtn" data-action="reviewStart">Repasar los meses</button>` : nothing}
    ${cobrosView(c)}
  </div></div>`;
}

/** How much is owed: the headline, Corresponde, Cobrado and Falta in net, and how Corresponde comes out. */
function howMuch(c) {
  const { standing: s } = c;
  const open = s.unclosed.length;
  return html`<div class="step"><span class="num">2</span><div class="sb">
    <h3>Cuánto se debe</h3>
    <div class="tag"><span class="lbl">${s.hasPayments ? 'Debe el ganadero' : 'Corresponde'}</span><span class="big">${money(s.hasPayments ? s.falta : s.corresponde)}</span><span class="sub">${
      !s.hasPayments
        ? 'Aún no hay cobros apuntados: apunta lo cobrado para ver lo que falta.'
        : open
          ? `${open} ${open === 1 ? 'mes' : 'meses'} según la oferta: repasa y cierra para fijar la cifra.`
          : 'Todos los meses están cerrados.'
    }</span></div>
    ${tiles(s)}
    ${NET_HINT}
    ${notes(s, { over: '' })}
    ${s.cobradoEnMano > 0 && s.belowMinimumOnPayroll > 0 ? html`<p class="hint">La nómina declarada queda ${money(s.belowMinimumOnPayroll)} bajo el mínimo legal; lo cobrado en mano no cotiza.</p>` : nothing}
    ${howItAdds(s)}
  </div></div>`;
}

/** The claim: the text to copy, the nearest deadline, and the deadline of each month in a closed fold. */
function claim(c) {
  const { standing: s, today } = c;
  const near = s.nearest;
  const by = (d) =>
    d.lapsed
      ? `plazo vencido el ${fWhen(d.deadline, today)}`
      : `hasta el ${fWhen(d.deadline, today)} · quedan ${d.daysLeft} ${d.daysLeft === 1 ? 'día' : 'días'}`;
  return html`<div class="step"><span class="num">3</span><div class="sb block">
    <div class="bh"><h3>Reclamar</h3>${s.hasPayments && s.falta > 0 ? html`<button type="button" class="copybtn" data-action="copyRecordClaim" aria-label="Copiar texto de la reclamación" title="Copiar texto de la reclamación">${COPY_ICON}</button>` : nothing}</div>
    <p class="hint copy-msg" role="status"></p>
    ${
      near
        ? html`<p class=${near.lapsed || near.daysLeft < 120 ? 'due-line near' : 'due-line'}>Plazo más cercano: lo de ${monthName(near.month)}, ${by(near)}.</p>`
        : html`<p class="hint">${s.hasPayments ? 'No falta nada por reclamar.' : 'Apunta lo cobrado para saber qué reclamar.'}</p>`
    }
    ${
      s.deadlines.length
        ? html`<details class="plg" data-fold="deadlines"><summary>Plazos por mes</summary><div class="rows">${s.deadlines.map((d) => row(capital(monthName(d.month)), money(d.owed), { sub: html`<span class=${d.lapsed || d.daysLeft < 120 ? 'due-by near' : 'due-by'}>${by(d)}</span>` }))}</div>
          <p class="hint">Se cuenta un año desde el último día de cada mes; las vacaciones, desde el final del contrato (ET art. 59.2). Los cobros se asignan al mes más antiguo solo para fechar la reclamación.</p></details>`
        : nothing
    }
  </div></div>`;
}

/** «¿Se cumplió la ley?»: rows built from the record, and one line for what it cannot support. */
function lawBlock(c) {
  const { law } = c;
  const weeks = LAW.restPeriodWeeks;
  const mark = (kind, title, text) =>
    html`<div><span class=${`m ${kind}`}>${{ ok: '✔', bad: '✘', warn: '?' }[kind]}</span><span><b>${title}</b><small>${text}</small></span></div>`;
  const range = (f) => `${fWhen(f.from, c.today)}–${fWhen(f.to, c.today)}: ${f.off} de ${f.due}`;
  const rest = law.rest.fails.length
    ? mark(
        'bad',
        'Descanso semanal',
        `Faltan días libres en ${law.rest.fails.length} de ${law.rest.periods} periodos de ${weeks} semanas: ${law.rest.fails.slice(0, 2).map(range).join('; ')}${law.rest.fails.length > 2 ? ` y ${law.rest.fails.length - 2} más` : ''}.`,
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
  const o = law.overnight;
  const overnight = !o.applicable
    ? nothing
    : !o.known
      ? mark('warn', 'Plus de pernocta', 'No se puede comprobar: no hay cobros apuntados.')
      : o.missing >= 1
        ? mark(
            'bad',
            'Plus de pernocta',
            `Lo cobrado no llega a cubrirlo: faltan ${money(o.missing)} de ${money(o.due)} (el ${LAW.overnightPct} % del salario, netos).`,
          )
        : mark('ok', 'Plus de pernocta', 'Cubierto con lo cobrado.');
  return html`<div class="block"><div class="bh"><h2>¿Se cumplió la ley?</h2></div>
    <p class="hint">Con lo que pasó: los días del registro y lo cobrado.</p>
    <div class="law">${rest}${days}${overnight}</div>
    <p class="hint">No se puede comprobar con lo apuntado: festivos trabajados (falta la lista de festivos del lugar) y salario mínimo (falta el bruto de la nómina).</p>
  </div>`;
}

/** «Cuentas»: regularizing a job that is over, in three steps, and whether the law was kept. */
function cuentas(c) {
  return html`<h2 class="mode">Cuentas<small>Regularizar: lo que corresponde frente a lo cobrado.</small></h2>
    <div class="spine">${monthsToRecord(c)}${howMuch(c)}${claim(c)}</div>
    ${lawBlock(c)}`;
}

/** «Trabajo real»: only where the days marked make the work run otherwise than the offer's dates say. */
function realPeriod(c) {
  const { job } = c;
  if (!job.differs) return nothing;
  const date = (iso) => fDate(parseDate(iso));
  const said = job.from === job.offerFrom ? date(job.offerTo) : `del ${date(job.offerFrom)} al ${date(job.offerTo)}`;
  return html`<p class="real">Trabajo real: del ${date(job.from)} al ${date(job.to)} (la oferta decía ${said}).</p>`;
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
