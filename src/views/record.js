/** What the record says about a job under way or finished (ADR-0032): «Hasta hoy», «Cuentas» and «Cobros». */

import { html, nothing } from 'lit-html';
import { fAbout, fDate, fDaysSpoken, fE, fN, joinAnd } from '../format.js';
import { LAW } from '../law.js';
import { fSumE } from '../ledger.js';
import { parseDate } from '../offer.js';
import { noContractHow, noContractMinimum } from '../rights.js';
import { monthName, monthShort } from '../text.js';
import { calendarView } from './calendar.js';
import { claimView, lapsedLine, underwayTalk } from './claim.js';
import { ledgerLines, row } from './parts.js';
import { endLine, endQuestion, recallQuestion, startQuestion } from './transitions.js';

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

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const WAY = { payroll: 'Nómina', cash: 'En mano' };

/** One cobro as a flat row. `remove`: its «Quitar» button, with the second tap that confirms. */
function paymentRow(p, today, { fresh = false, remove = null, late = false } = {}) {
  return html`<div class=${fresh ? 'pr fresh' : 'pr'}><span class="d">${fWhen(p.date, today)}</span><span><span class=${p.via === 'cash' ? 'via cash' : 'via'}>${WAY[p.via]}</span>${p.approx ? html`<small>cifra aproximada</small>` : nothing}${p.note ? html`<small>${p.note}</small>` : nothing}${late ? html`<small>Cobro apuntado el ${fWhen(p.date, today)}, después de dar los cobros por completos.</small>` : nothing}</span><span class="a">${p.approx ? '≈ ' : ''}${money(p.amount)}</span>${
    remove
      ? html`<span class="rowbtns"><button type="button" class="linkbtn rm" data-action="editPayment" data-id=${p.id}>Editar</button><button type="button" class="linkbtn rm" data-action=${remove.asking ? 'removePayment' : 'removePaymentAsk'} data-id=${p.id}>${remove.asking ? '¿Quitar?' : 'Quitar'}</button></span>`
      : nothing
  }</div>`;
}

/** «Cobros»: everything received, each cobro removable, and the button for a new one. Month headers only when it spans several. */
function cobrosView({ today, payments, fresh, ask, record, phase, cards }) {
  // One filled button on the screen: the one that asks for the first cobro, unless a question of the job is open
  const primary = !cards && (phase === 'underway' || !payments.length);
  const asking = ask?.type === 'payment' ? ask.id : null;
  /** @type {Map<string, typeof payments>} */
  const byMonth = new Map();
  for (const p of payments) byMonth.set(p.date.slice(0, 7), [...(byMonth.get(p.date.slice(0, 7)) ?? []), p]);
  // A cobro dated after the day the cobros were given as complete was added after it
  const row = (p) =>
    paymentRow(p, today, {
      fresh: p.id === fresh,
      remove: { asking: p.id === asking },
      late: Boolean(record.complete && p.date > record.complete.date),
    });
  return html`<div class="block cobros">
    <div class="bh"><h3>Cobros</h3><span class="n">${payments.some((p) => p.approx) ? '≈ ' : ''}${money(netTotal(payments))}</span></div>
    ${
      !payments.length
        ? nothing
        : byMonth.size > 1
          ? html`<div class="pay">${[...byMonth].map(
              ([month, list]) =>
                html`<div class="ph"><span>${capital(monthName(month))} ${month.slice(0, 4)}</span><span>${list.some((p) => p.approx) ? '≈ ' : ''}${money(netTotal(list))}</span></div>${list.map(row)}`,
            )}</div>`
          : html`<div class="pay">${payments.map(row)}</div>`
    }
    ${payments.length || phase === 'finished' ? nothing : html`<p class="hint">Aún no hay cobros apuntados. Apunta lo cobrado para ver lo que falta.</p>`}
    <button type="button" class=${primary ? 'pri addbtn' : 'addbtn'} data-action="openPaySheet">${payments.length ? '+ Otro cobro' : 'Apuntar un cobro'}</button>
    ${payments.length || phase === 'underway' ? nothing : html`<p class="hint">Otra cantidad: se apunta cada cobro. <button type="button" class="linkbtn tapfull" data-action="paidClear">Cambiar</button></p>`}
  </div>`;
}

/** What is said of an answer to «¿Se cobró este trabajo?» that takes the place of the cobros. */
const PAID_LINE = { asAgreed: 'Se cobró todo lo pactado.', none: 'No se cobró nada.' };

/** What the law adds to the pay agreed, as the items say it. */
const LEGAL_ITEM = {
  salary: 'Salario hasta el mínimo legal',
  overnight: 'Plus de pernocta (convenio)',
  vacation: 'Vacaciones',
  severance: 'Indemnización por fin de contrato',
};

/**
 * The answer «Lo pactado» or «Nada» in place of the cobros: one line with its «Cambiar». Under «Lo pactado», what the
 * law adds that the agreement did not promise, item by item, with the way to say it was paid too.
 * @param {RecordContext} c
 */
function paidLine(c) {
  if (!c.paid || c.payments.length) return nothing;
  const items = c.paid === 'asAgreed' ? c.standing.legalItems : [];
  return html`<p class="hint paidline">${PAID_LINE[c.paid]} <button type="button" class="linkbtn tapfull" data-action="paidClear">Cambiar</button></p>
    ${
      items.length
        ? html`<div class="legal-items"><p class="hint">Falta lo que la ley exige y no se pactó:</p>
          <ul>${items.map((x) => html`<li>${LEGAL_ITEM[x.key]}: <b>${whole(x.amount)}</b></li>`)}</ul>
          <button type="button" class="sm" data-action="alsoPaid">También se cobró</button>
          <p class="hint">Si en la nómina vino también esto, se apunta como un cobro del último día.</p></div>`
        : nothing
    }`;
}

/**
 * «¿Se cobró este trabajo?»: asked of a job finished with no cobro recorded and nothing said. «No se cobró nada» asks
 * first, since it turns everything that corresponds into a debt.
 * @param {RecordContext} c
 */
export function paidQuestion(c) {
  if (c.ask?.type === 'paidNone')
    return html`<div class="tcard-q" role="group" aria-label="¿Se cobró este trabajo?">
      <h3>¿No se cobró nada?</h3>
      <p class="hint">Falta pasa a ser todo lo que corresponde: ${whole(c.standing.corresponde)}.</p>
      <div class="actions"><button type="button" class="pri sm" data-action="paidNone">Sí, nada</button><button type="button" class="sm" data-action="paidNoneCancel">Volver</button></div>
    </div>`;
  return html`<div class="tcard-q" role="group" aria-label="¿Se cobró este trabajo?">
    <h3>¿Se cobró este trabajo?</h3>
    <p class="hint">«Otra cantidad»: más o menos de lo pactado, en uno o varios cobros.</p>
    <div class="choices"><button type="button" data-action="paidAll">Lo pactado</button><button type="button" data-action="paidSome">Otra cantidad</button><button type="button" data-action="paidNoneAsk">Nada</button></div>
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
  const per = m.unit === 'total' ? ' en total' : `/${m.unit}`;
  const netos = m.noContract ? '' : ' netos';
  if (!m.exceeds)
    return html`<p class="hint">${m.short.map((x) => SHORT_LINE[x.key](`${fN(x.amount, 2)} €${per}${netos}`)).join('. ')}.</p>`;
  return html`<p class="hint">El mínimo exigible supera lo pactado: ${m.components.map((x) => `${LABEL[x.key]} ${fN(x.amount, 2)} €`).join(' + ')}${m.components.length > 1 ? ` = ${fN(m.total, 2)} €${per}${netos}` : `${per}${netos}`}; pactado: ${fN(m.agreed, 2)} €${per}.</p>`;
};

/** Said once, next to the title of Registro and Cuentas: every amount on them is net; not on a job without a contract, where there is nothing to deduct. */
const net = (c) => (c.noContract ? nothing : html` <span class="net">en neto</span>`);

/** The three figures of the job, in net: Corresponde, Cobrado (of it, in hand) and Falta; `withoutFalta` where the headline above already says it. */
function tiles(c, { withoutFalta = false } = {}) {
  const s = c.standing;
  // Cobrado and Falta follow the cobros: one told as approximate makes both approximate
  const about = c.approx ? '≈ ' : '';
  // The split only where the money came by both ways; one way alone is the figure itself
  const bothWays = s.cobradoEnMano > 0 && s.cobrado - s.cobradoEnMano >= 0.5;
  return html`<div class=${withoutFalta ? 'sofar two' : 'sofar'}>
    <div><span>Corresponde</span><b>${c.noPay ? '—' : whole(s.corresponde)}</b></div>
    <div><span>Cobrado</span><b>${about}${whole(s.cobrado)}</b>${bothWays ? html`<small>de ello, en mano ${whole(s.cobradoEnMano)}</small>` : nothing}</div>
    ${withoutFalta ? nothing : html`<div class=${s.hasPayments && s.falta === 0 ? 'f ok' : 'f'}><span>Falta</span><b>${s.hasPayments && !c.noPay ? about + whole(s.falta) : '—'}</b></div>`}
  </div>`;
}

/** What the figures leave to say: nothing cobrado yet, cash agreed and not cobrado, more cobrado than calculated. */
function notes(c, { over }) {
  const s = c.standing;
  return html`${paidLine(c)}
    ${c.payments.length && s.falta > 0 && s.enManoAgreed > 0 && s.cobradoEnMano === 0 ? html`<p class="hint">Sin cobros en mano apuntados. Pactado en mano: ${whole(s.enManoAgreed)}.</p>` : nothing}
    ${c.approx && s.hasPayments ? html`<p class="hint">${c.noPay ? 'Hay cobros apuntados como aproximados: Cobrado lo es también (≈).' : 'Hay cobros apuntados como aproximados: Cobrado y Falta lo son también (≈).'}</p>` : nothing}
    ${s.sobra >= 1 && !c.noPay ? html`<p class="hint">Se cobraron ${whole(s.sobra)} más de lo que corresponde${over}: puede ser un plus que no se pactó (transporte, dietas) o una retención menor que la calculada.</p>` : nothing}`;
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

const CHEVRON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>`;

/** What the row «Días» says: the months closed, and those still to close. */
function daysSummary(c) {
  const open = c.standing.unclosed.length;
  const closed = c.strip.filter((m) => m.state === 'closed').length;
  const current = c.strip.filter((m) => m.state === 'now').length;
  return [
    closed && (closed === 1 ? '1 mes cerrado' : `${closed} meses cerrados`),
    open && (open === 1 ? '1 mes por cerrar' : `${open} meses por cerrar`),
    current && (current === 1 ? '1 mes en curso' : `${current} meses en curso`),
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * «Días: como lo pactado · Cerrar los meses»: the months that have ended and are not closed, each with its counts as the
 * calendar shows it, and one button that closes them all as shown (a month is never closed blind, ADR-0032). Changing a
 * day stays in the calendar.
 * @param {RecordContext} c
 */
function closeAllBlock(c) {
  if (!c.closeAll.length) return nothing;
  const touched = c.closeAll.some((m) => m.kept);
  return html`<div class="closeall" role="group" aria-label="Cerrar los meses">
    <p class="ck">Días: ${touched ? 'como en el calendario' : 'como lo pactado'}</p>
    <ul class="closeall-months">${c.closeAll.map((m) => html`<li><b>${capital(monthName(m.month))}</b> <span>${plural(m.work, 'jornada', 'jornadas')} · ${plural(m.off, 'libre', 'libres')}</span></li>`)}</ul>
    <button type="button" class="sm" data-action="closeAllMonths">Cerrar los meses</button>
  </div>`;
}

/** The row of the ficha that opens the page of the days, and the way to go through the months not closed. */
const daysRow = (c) =>
  html`${closeAllBlock(c)}<button type="button" class="registro-link" data-action="openRegistro"><span class="ck">Días</span><span class="cv">${daysSummary(c)}</span>${CHEVRON}</button>${reviewLink(c.standing.unclosed.length)}`;

/**
 * A job under way: «Hasta hoy» in net, what waits to be closed, the questions of its turns, and the way to the Registro.
 * @param {RecordContext} c
 * @param {import('lit-html').TemplateResult} questions the questions at the turns of the job, which go first while it is not known to have started
 */
function registro(c, questions) {
  const { today } = c;
  const notStarted = Boolean(c.cards?.start);
  return html`${notStarted ? questions : nothing}<h2 class="mode">Hasta hoy${net(c)}<small>Lo que va del trabajo.</small></h2>
    <div class="block">
      <div class="bh"><h3>Hasta hoy, ${fWhen(today, today)}</h3></div>
      ${tiles(c)}
      ${notes(c, { over: ' hasta hoy' })}
      ${minimumLine(c.minimum)}
    </div>
    ${c.nudge ? html`<div class="nudge"><span>${nudgeText(c.nudge.months)}</span><button type="button" class="linkbtn" data-action="openRegistro" data-key=${c.nudge.months[0]}>Abrir${c.nudge.months.length > 1 ? ` ${monthName(c.nudge.months[0])}` : ''}</button></div>` : nothing}
    ${notStarted ? nothing : questions}
    ${showCobros(c) ? cobrosView(c) : nothing}
    ${daysRow(c)}
    ${underwayTalk(c.talk)}`;
}

/** «Cobros»: drawn once there is a cobro; before, only where the shepherd is recording them (or the job is going on). «Lo pactado» and «Nada» speak in one line instead. */
const showCobros = (c) => c.payments.length > 0 || (!c.paid && (c.phase === 'underway' || c.recording));

/** «Detalle de lo que corresponde»: the lines that add up to Corresponde, in a closed fold. */
const howItAdds = (s) =>
  html`<details class="plg" data-fold="how"><summary>Detalle de lo que corresponde</summary><div class="rows">${ledgerLines(s.lines)}${row('= Corresponde', money(s.corresponde))}</div></details>`;

/** The way to go through the months not closed, one by one. */
const reviewLink = (open) =>
  open
    ? html`<button type="button" class="linkbtn tapfull" data-action="reviewStart">Revisar los meses</button>`
    : nothing;

/**
 * «¿Se espera algún pago más?»: asked under the cobros of a job finished with Falta above 0 until the shepherd answers.
 * «Sí, quedó en pagarlo» (`record.expecting`) asks for the day, which may be left out; «No» is `record.complete`. Once
 * answered, one line with «Cambiar»: the answer, or that the day promised passed.
 * @param {RecordContext} c
 */
function expectationView(c) {
  const { standing: s, record } = c;
  if (c.phase !== 'finished' || !(s.falta > 0) || !(c.payments.length || c.paid)) return nothing;
  if (!record.complete && !record.expecting)
    return html`<div class="tcard-q" role="group" aria-label="¿Se espera algún pago más?">
      <h3>¿Se espera algún pago más?</h3>
      <div class="choices"><button type="button" class="sm" data-action="expectYes" aria-pressed=${String(c.expectOpen)}>Sí, quedó en pagarlo</button><button type="button" class="sm" data-action="expectNo">No</button></div>
      ${
        c.expectOpen
          ? html`<label class="fld">¿Para cuándo?<input type="date" data-expect-by min=${c.today}></label>
            <button type="button" class="sm" data-action="expectNoDate">Sin fecha</button>`
          : nothing
      }
    </div>`;
  const by = record.expecting?.by;
  const line = record.complete
    ? 'No se espera más pago.'
    : c.money === 'owed'
      ? `Quedó en pagar el ${fWhen(/** @type {string} */ (by), c.today)} y no ha llegado.`
      : by
        ? `Se espera un pago para el ${fWhen(by, c.today)}.`
        : 'Se espera un pago.';
  return html`<p class="expect-line">${line} <button type="button" class="linkbtn tapfull" data-action="expectChange">Cambiar</button></p>`;
}

/** The headline of Falta by where the money stands: never «Debe» while it is not known that nothing more is expected. */
const HEAD = { owed: 'Debe', expecting: 'Esperando cobro', unconfirmed: 'Falta', settled: 'Falta' };

/** What is cobrado reaches the pay agreed (or is taken as agreed) and still falls short of what the law requires. */
const belowLegalMinimum = (c) => {
  const s = c.standing;
  return s.hasPayments && s.falta > 0 && !c.noPay && c.paid !== 'none' && s.cobrado >= s.agreed;
};

/** The yellow block: what the ganadero owes, the three figures, and the way to close the record. */
function result(c) {
  const { standing: s } = c;
  const open = s.unclosed.length;
  // Everything cobrado: calm, neutral, nothing to ask for
  const settled = s.hasPayments && s.falta === 0 && !c.noPay;
  const told = c.noPay && s.hasPayments;
  const belowMinimum = belowLegalMinimum(c);
  const sub = told
    ? 'No se apuntó lo pactado: no hay con qué comparar lo cobrado.'
    : settled
      ? s.sobra >= 1
        ? `Cobrado de más: ${c.approx ? '≈ ' : ''}${whole(s.sobra)}`
        : 'Lo cobrado cubre lo que corresponde.'
      : belowMinimum
        ? c.paid
          ? ''
          : s.cobrado > s.agreed
            ? 'Se cobró más de lo pactado, pero menos de lo que exige la ley.'
            : 'Se cobró lo pactado, pero menos de lo que exige la ley.'
        : !s.hasPayments
          ? ''
          : c.complete
            ? ''
            : open
              ? `${open} ${open === 1 ? 'mes' : 'meses'} según la oferta: la cifra no es firme hasta cerrarlos.`
              : '';
  // The headline says Falta, or Corresponde where nothing is recorded: the tiles do not repeat it
  const debt = s.hasPayments && !settled && !told;
  return html`<div class="block result">
    ${s.hasPayments ? html`<div class=${settled ? 'tag saldadas' : c.money === 'owed' && !told ? 'tag owed' : 'tag'}><span class="lbl">${told ? 'Cobrado' : settled ? 'Saldado' : belowMinimum ? (s.legalItems.every((x) => x.key === 'severance') ? 'Indemnización por fin de contrato' : 'Falta hasta el mínimo legal') : HEAD[c.money]}</span>${settled ? nothing : html`<span class="tag-row"><span class="big">${c.approx ? '≈ ' : ''}${whole(told ? s.cobrado : s.falta)}</span></span>`}${sub ? html`<span class="sub">${sub}</span>` : nothing}</div>` : nothing}
    ${belowMinimum ? minimumLine(c.minimum) : nothing}
    ${tiles(c, { withoutFalta: debt })}
    ${notes(c, { over: '' })}
  </div>${lapsedLine(c.claim)}`;
}

/** «Balance del trabajo»: what the job left besides the tiles, from «Final de campaña» without its simulator; what still follows the offer says so. */
function balanceBlock(c) {
  const { balance: b, standing: s } = c;
  const vacation = Math.round(b.contribVacationDays);
  return html`<div class="block"><div class="bh"><h2>Balance del trabajo</h2></div>
    ${belowLegalMinimum(c) ? nothing : minimumLine(c.minimum)}
    <div class="rows">
      ${row('Jornadas', String(b.worked), { sub: b.firm ? 'de los meses cerrados' : `${b.workedClosed} en meses cerrados; el resto, según la oferta` })}
      ${b.contribDays > 0 ? row('Días cotizados', String(Math.round(b.contribDays)), { sub: `según la oferta (la nómina real no se apunta)${vacation >= 1 ? `; incluye ${vacation} ${vacation === 1 ? 'día' : 'días'} de vacaciones pagadas` : ''}` }) : nothing}
      ${b.paroDays >= 1 ? row('Paro', `${Math.round(b.paroDays)} días · ${whole(b.paroEuros)}`, { sub: 'según la oferta; se cobran más adelante' }) : nothing}
    </div>
    ${howItAdds(s)}
  </div>`;
}

/** One month of the registro as a row that opens its calendar right below it; one at a time, no jump. */
const monthRow = (key, opened, label, calendar, cls = 'monthrow') =>
  html`<button type="button" class=${cls} data-action="toggleMonth" data-key=${key} aria-expanded=${String(opened)}>${label}<span class="chev" aria-hidden="true"></span></button>${opened ? html`<div class="monthbody">${calendarView(calendar)}</div>` : nothing}`;

/** The months of a job finished, each opening its calendar in place, and the one that can be added. */
function monthsList(c) {
  const months = c.strip.filter((m) => m.state !== 'add');
  // The calendar of a finished job is only there while a month is open
  const shown = c.calendar?.acc.row.month ?? null;
  return html`<div class="tocl">${months.map((m) => monthRow(m.month, shown === m.month, html`<span><b>${capital(monthName(m.month))}</b> <small>${{ closed: 'cerrado', now: 'en curso' }[m.state] ?? 'según la oferta'}</small></span>`, c.calendar))}</div>
    ${c.addable ? monthRow(c.addable, shown === c.addable, html`<span>+ Añadir ${monthName(c.addable)}</span>`, c.calendar, 'linkbtn addmonth') : nothing}`;
}

/**
 * The Registro as a page of its own: the months (a strip and the calendar of the one picked while the
 * job goes on, a list that opens one calendar while it is over), the cobros and the notes.
 * @param {RecordContext} c
 * @param {string} name the job's name
 */
export function registroPageView(c, name) {
  return html`<div class="dossier-doc registro-doc">
    <h1>Días trabajados</h1>
    <p class="hint">${name}</p>
    ${c.phase === 'underway' ? html`${strip(c)}${calendarView(c.calendar)}` : monthsList(c)}
    ${apuntesView(c)}
  </div>`;
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
    f.id === 'minimum'
      ? mark(f.covered ? 'ok' : 'bad', 'Salario mínimo', noContractMinimum(f))
      : mark('bad', ...(f.id === 'cash' ? FACT_TEXT.cash(f.amount) : FACT_TEXT.noContract)),
  );
  const minimumFact = law.facts.find((f) => f.id === 'minimum');
  const howMinimum = minimumFact
    ? html`<details class="plg" data-fold="minimum-how"><summary>Cómo se calcula</summary><p class="hint">${noContractHow(minimumFact)}</p></details>`
    : nothing;
  const range = (f) =>
    `${fWhen(f.from, c.today)}–${fWhen(f.to, c.today)}: ${
      f.off < f.due
        ? `${f.off} libres de ${f.due}; faltan ${f.due - f.off}`
        : `${f.off} libres, pero sin un día entero libre cada semana`
    }`;
  const closedMonths = law.months.closed > 0;
  const counted = law.rest.counted;
  const countedText = `No se puede juzgar en ${plural(counted, 'mes apuntado', 'meses apuntados')} por totales: no se sabe qué días se libraron.`;
  const rest = law.rest.unknown
    ? nothing
    : counted && !law.rest.periods
      ? mark('warn', 'Descanso semanal', countedText)
      : !law.rest.periods
        ? mark('warn', 'Descanso semanal', `Aún no hay un periodo de ${weeks} semanas entero en meses cerrados.`)
        : law.rest.fails.length
          ? mark(
              'bad',
              'Descanso semanal',
              `Días libres insuficientes en ${law.rest.fails.length} de ${law.rest.periods} periodos de ${weeks} semanas: ${law.rest.fails.slice(0, 2).map(range).join('; ')}${law.rest.fails.length > 2 ? ` y ${law.rest.fails.length - 2} más` : ''}.${counted ? ` ${countedText}` : ''}`,
            )
          : mark(
              'ok',
              'Descanso semanal',
              `Se libra un día entero por semana (o dos cada 14 días) y ${fDaysSpoken(LAW.weeklyRest)} por semana de media en todos los periodos de ${weeks} semanas.${counted ? ` ${countedText}` : ''}`,
            );
  const extra = Math.round(law.days.extra);
  const days = law.rest.unknown
    ? nothing
    : extra >= 1
      ? mark(
          'bad',
          'Jornadas de más',
          `${law.days.worked} jornadas; con descanso, festivos y vacaciones corresponden ${fAbout(Math.round(law.days.due), 'jornada', 'jornadas')}: ${fAbout(extra, 'jornada', 'jornadas')} de más.`,
        )
      : mark(
          'ok',
          'Jornadas de más',
          `${law.days.worked} jornadas, dentro de ${fAbout(Math.round(law.days.due), 'jornada', 'jornadas')} que ${Math.round(law.days.due) === 1 ? 'corresponde' : 'corresponden'}.`,
        );
  // Only where the place has verified holidays for every closed month's year; nothing otherwise
  const fests = law.holidays;
  const missingLocal = fests.local ? '' : ' Faltan los festivos locales del municipio, que no constan.';
  const festivos = !fests.known
    ? nothing
    : fests.worked.length
      ? mark(
          'warn',
          'Festivos trabajados',
          `${plural(fests.worked.length, 'festivo trabajado', 'festivos trabajados')} en meses cerrados: ${fests.worked.map((x) => fWhen(x.date, c.today)).join(', ')}. Los festivos son retribuidos y no recuperables (Estatuto, art. 37.2): trabajar uno se paga aparte o se compensa con descanso.${fests.agreement ? ` El convenio regula el recargo de las horas extra en festivo (${fests.agreement.cite}).` : ''}${missingLocal}`,
        )
      : mark('ok', 'Festivos trabajados', `Ningún festivo trabajado en los meses cerrados.${missingLocal}`);
  // The minimum on payroll and the plus de pernocta need every cobro: they are judged once the record is closed
  const minimum = law.minimum;
  const payrollRows = !c.complete
    ? nothing
    : html`${
        minimum.applicable
          ? minimum.short >= 1
            ? mark(
                'bad',
                'Salario mínimo en nómina',
                `En nómina se cobraron ${whole(minimum.payroll)} netos y el mínimo son ${whole(minimum.minimumNet)}: faltan unos ${whole(minimum.short)}.`,
              )
            : mark(
                'ok',
                'Salario mínimo en nómina',
                `En nómina se cobraron ${whole(minimum.payroll)} netos, sobre el mínimo de ${whole(minimum.minimumNet)}.`,
              )
          : nothing
      }${
        law.overnight.applicable
          ? law.overnight.missing >= 1
            ? mark(
                'bad',
                'Plus de pernocta',
                `Del plus del convenio (${whole(law.overnight.due)} netos) no se cubrieron ${whole(law.overnight.missing)}.`,
              )
            : mark('ok', 'Plus de pernocta', 'El plus del convenio está cubierto.')
          : nothing
      }`;
  const later = [
    minimum.applicable && 'el salario mínimo en nómina',
    law.overnight.applicable && 'el plus de pernocta',
  ].filter(Boolean);
  return html`<div class="block"><div class="bh"><h2>¿Se cumplió la ley?</h2></div>
    ${closedMonths ? html`<p class="hint">Según el registro, sobre ${law.months.closed} de ${law.months.total} ${law.months.total === 1 ? 'mes cerrado' : 'meses cerrados'}.</p>` : nothing}
    <div class="lawcheck">${facts}${howMinimum}${closedMonths ? html`${rest}${days}${festivos}` : nothing}${payrollRows}</div>
    ${!closedMonths ? html`<p class="hint">Cierra los meses para comprobar el descanso semanal y las jornadas.</p>` : nothing}
    ${!c.complete && later.length ? html`<p class="hint">Con todos los cobros apuntados y los meses cerrados se comprueba también ${joinAnd(later)}.</p>` : nothing}
  </div>`;
}

/**
 * «Cuentas»: the result first, then the questions and the cobros, the chores last. The offer's own analysis, for
 * reference, is the fold the ficha adds after it.
 * @param {RecordContext} c
 * @param {import('lit-html').TemplateResult} questions how it ended and the real period, which come right after the result
 */
function cuentas(c, questions) {
  const unanswered = !c.payments.length && !c.paid && (!c.recording || c.ask?.type === 'paidNone');
  return html`<h2 class="mode small">Cuentas${net(c)}</h2>
    ${result(c)}
    ${questions}
    ${unanswered ? paidQuestion(c) : nothing}
    ${expectationView(c)}
    ${showCobros(c) ? cobrosView(c) : nothing}
    ${daysRow(c)}
    ${balanceBlock(c)}
    ${lawBlock(c)}
    ${claimView(c.claim, c.money)}`;
}

/** «Trabajo real»: only where the days marked make the work run otherwise than the offer's dates say. */
export function realPeriod(c) {
  const { job } = c;
  if (!job.differs) return nothing;
  const date = (iso) => fDate(parseDate(iso));
  const said = job.from === job.offerFrom ? date(job.offerTo) : `del ${date(job.offerFrom)} al ${date(job.offerTo)}`;
  return html`<p class="real">Trabajo real: del ${date(job.from)} al ${date(job.to)} (oferta: ${said}).</p>`;
}

/**
 * The top of the ficha of a job under way or finished: the block of its phase with its result, then the questions, «Cobros» and the days.
 * During «Repasar los meses» it is the review alone.
 * @param {RecordContext} c
 */
export function recordView(c) {
  if (c.review) return calendarView(c.review);
  const questions = html`${startQuestion(c.cards, c.today)}${recallQuestion(c.cards, c.today)}${endQuestion(c.cards, c.today)}${endLine(c.record, c.cards?.endDefault)}${realPeriod(c)}`;
  return c.phase === 'finished' ? cuentas(c, questions) : registro(c, questions);
}
