/**
 * The «Expediente» (ADR-0034): one printable page that gathers what the record holds about a job: the parties, the
 * conditions, the calendar of each month, the cobros, what corresponds, was cobrado and is missing, the deadlines, what
 * the record cannot prove, the steps done and the disclaimer. It prints in black and white on A4 (`@media print`);
 * the browser saves it as a PDF.
 */

import { html, nothing } from 'lit-html';
import { jobDates } from '../claim-text.js';
import { fDate, fE } from '../format.js';
import { fSumE } from '../ledger.js';
import { monthDays } from '../model/days.js';
import { parseDate } from '../offer.js';
import { ITEM_TEXT, monthName, summaries } from '../text.js';
import { END_TEXT } from './transitions.js';

/** @typedef {NonNullable<ReturnType<typeof import('../ui/record.js').dossierContext>>} DossierContext */

const fIso = (iso) => fDate(parseDate(iso));
const capital = (text) => text[0].toUpperCase() + text.slice(1);
const whole = (x) => fE(x, 0);
const WAY = { payroll: 'Nómina', cash: 'En mano' };
const LETTER = { work: 'J', off: 'L', sick: 'B' };
const STEP_TITLE = {
  dismissal: 'Despido: se actuó',
  talk: 'Hablar con el ganadero',
  request: 'Petición de pago',
  union: 'Sindicato',
  conciliation: 'Papeleta de conciliación',
  inspection: 'Inspección de Trabajo',
  court: 'Juzgado de lo Social',
  fogasa: 'FOGASA',
};

/** One month, black and white: weeks from Monday, J jornada, L libre, B baja, a dot outside the job. */
function monthGrid(m) {
  const [y, mo] = m.month.split('-').map(Number);
  const lead = (new Date(y, mo - 1, 1).getDay() + 6) % 7;
  const days = monthDays(y, mo);
  const byDay = new Map(m.marks.map((x) => [x.day, x]));
  const cells = [...Array.from({ length: lead }, () => html`<span class="dd pad"></span>`)];
  for (let d = 1; d <= days; d++) {
    const mark = byDay.get(String(d).padStart(2, '0'));
    const letter = !mark || mark.outside ? '·' : LETTER[mark.kind];
    cells.push(html`<span class="dd"><small>${d}</small><b>${letter}</b></span>`);
  }
  const work = m.marks.filter((x) => !x.outside && x.kind === 'work').length;
  const off = m.marks.filter((x) => !x.outside && x.kind === 'off').length;
  const sick = m.marks.filter((x) => !x.outside && x.kind === 'sick').length;
  return html`<div class="dmonth"><h4>${capital(monthName(m.month))} ${y} <small>${m.closed ? `cerrado${m.closedAt ? ` el ${fIso(m.closedAt)}` : ''}` : 'sin cerrar: según lo pactado'}</small></h4>
    <div class="dgrid"><span class="dw">L</span><span class="dw">M</span><span class="dw">X</span><span class="dw">J</span><span class="dw">V</span><span class="dw">S</span><span class="dw">D</span>${cells}</div>
    <p class="dcount">${work} ${work === 1 ? 'jornada' : 'jornadas'} · ${off} ${off === 1 ? 'libre' : 'libres'}${sick ? ` · ${sick} de baja` : ''}</p></div>`;
}

const money = (x) => fSumE(x);

/** The three columns of a table of what corresponds, in cents (gross) or whole euros (net, as the tiles). */
const figures = (f, show = money) => html`<td>${show(f.due)}</td><td>${show(f.received)}</td><td>${show(f.owed)}</td>`;
const HEAD = html`<tr><th></th><th>Corresponde</th><th>Cobrado</th><th>Falta</th></tr>`;

/**
 * @param {DossierContext | null} d
 * @param {any} o
 * @param {any} r
 * @param {import('../places.js').PlacesIndex | null} places
 */
export function dossierView(d, o, r, places) {
  if (!d) return nothing;
  const lines = summaries(o, r, places);
  const { record, parties, ladder, data } = d;
  const net = data.totals.net;
  const gross = data.totals.gross;
  return html`<article class="dossier-doc">
    <header class="dhead"><h1>Expediente</h1><p>${o.mine.name || 'Sin nombre'} · ${fIso(d.today)}</p></header>

    <section><h2>Partes</h2>
      <p><b>Ganadero:</b> ${parties.employerName || '—'}${parties.employerId ? ` (${parties.employerId})` : ''}</p>
      <p><b>Pastor:</b> ${parties.workerName || '—'}</p>
      ${parties.employerName ? nothing : html`<p class="hint noprint">Los nombres se escriben en «Petición de pago».</p>`}
    </section>

    <section><h2>Condiciones</h2>
      <ul class="dlist">${[jobDates(data.job) || lines.when, lines.pay, lines.workday, lines.housing.split(' · ').map(capital).join(' · '), o.terms.place || o.terms.municipality ? lines.place : ''].filter(Boolean).map((x) => html`<li>${x}</li>`)}</ul>
      ${record.end ? html`<p>Acabó el ${fIso(record.end.date)}: ${END_TEXT[record.end.how]}.</p>` : nothing}
    </section>

    <section><h2>Calendario</h2>
      <p class="hint">J: jornada · L: libre · B: baja · ·: fuera del trabajo. Un mes sin cerrar muestra lo pactado, no lo trabajado.</p>
      <div class="dmonths">${data.months.map(monthGrid)}</div>
    </section>

    <section><h2>Cobros</h2>
      ${
        data.payments.length
          ? html`<table class="dtable"><tr><th>Fecha</th><th>Forma</th><th>Nota</th><th>Cantidad</th></tr>${data.payments.map((p) => html`<tr><td>${fIso(p.date)}</td><td>${WAY[p.via]}</td><td>${p.note ?? ''}</td><td>${money(p.amount)}</td></tr>`)}<tr class="dtot"><td colspan="3">Total cobrado, neto</td><td>${money(net.received)}</td></tr></table>`
          : html`<p>${record.nothingPaid ? 'No se cobró nada.' : 'No hay cobros apuntados.'}</p>`
      }
    </section>

    <section class="dsum"><h2>Cuentas</h2>
      <div class="sofar dtiles">
        <div><span>Corresponde</span><b>${whole(net.due)}</b></div>
        <div><span>Cobrado</span><b>${whole(net.received)}</b></div>
        <div><span>Falta</span><b>${whole(net.owed)}</b></div>
      </div>
      <h3>En neto, por meses</h3>
      <table class="dtable">${HEAD}${data.months.map((m) => html`<tr><th>${capital(monthName(m.month))}</th>${figures(m.net, whole)}</tr>`)}
        ${net.extra >= 1 ? html`<tr><th>Cobrado por encima de lo calculado</th><td></td><td>${whole(net.extra)}</td><td></td></tr>` : nothing}
        <tr class="dtot"><th>Total</th><td>${whole(net.due)}</td><td>${whole(net.received)}</td><td>${whole(net.owed)}</td></tr></table>
      <h3>En neto, lo que corresponde por conceptos</h3>
      <table class="dtable">${data.lines.map((l) => html`<tr><th>${ITEM_TEXT[l.key]}</th><td>${whole(l.due)}</td></tr>`)}<tr class="dtot"><th>Corresponde</th><td>${whole(net.due)}</td></tr></table>
      <h3>En bruto, por meses</h3>
      <table class="dtable">${HEAD}${data.months.map((m) => html`<tr><th>${capital(monthName(m.month))}</th>${figures(m.gross)}</tr>`)}
        <tr class="dtot"><th>Total</th><td>${money(gross.due)}</td><td>${money(gross.received)}</td><td>${money(gross.owed)}</td></tr></table>
      <h3>En bruto, por conceptos</h3>
      <table class="dtable">${HEAD}${data.items.map((x) => html`<tr><th>${ITEM_TEXT[x.item]}</th>${figures(x)}</tr>`)}
        <tr class="dtot"><th>Total</th><td>${money(gross.due)}</td><td>${money(gross.received)}</td><td>${money(gross.owed)}</td></tr></table>
      <p class="hint">Neto: lo que llega. Bruto: antes de retenciones; es la cantidad que se reclama. Los cobros se asignan al mes más antiguo.</p>
    </section>

    <section><h2>Plazos</h2>
      <ul class="dlist">
        ${ladder.steps.filter((s) => s.id === 'dismissal').map((s) => html`<li>Despido: como muy tarde el ${fIso(/** @type {string} */ (s.deadline))} (20 días hábiles, de lunes a viernes, contando los festivos como días hábiles).</li>`)}
        ${d.deadlines.map((x) => html`<li>${capital(monthName(x.month))}, ${whole(x.owedWhole)} netos: ${x.lapsed ? `plazo vencido el ${fIso(x.deadline)}` : `hasta el ${fIso(x.deadline)}`}</li>`)}
        ${ladder.steps.some((s) => s.id === 'dismissal') || d.deadlines.length ? nothing : html`<li>No hay plazos abiertos.</li>`}
      </ul>
    </section>

    <section><h2>Lo que el registro no puede probar</h2>
      <ul class="dlist">
        <li>Es un apunte del pastor: no lo firma el ganadero.</li>
        ${data.unclosed.length ? html`<li>Meses sin cerrar, con las jornadas pactadas y no las trabajadas: ${data.unclosed.map((m) => monthName(m)).join(', ')}.</li>` : nothing}
        ${data.cash > 0 ? html`<li>Cobros en mano, sin nómina ni justificante: ${money(data.cash)}.</li>` : nothing}
        <li>El registro cuenta jornadas, no horas.</li>
      </ul>
      ${record.evidence?.length ? html`<h3>Apuntes</h3><ul class="dlist">${record.evidence.map((n) => html`<li>${fIso(n.date)}: ${n.text}</li>`)}</ul>` : nothing}
    </section>

    <section><h2>Pasos hechos</h2>
      ${
        d.steps.length
          ? html`<ul class="dlist">${d.steps.map((s) => html`<li>${STEP_TITLE[s.id] ?? s.id}: ${fIso(s.done)}${s.note ? ` (${s.note})` : ''}</li>`)}</ul>`
          : html`<p>Ninguno todavía.</p>`
      }
    </section>

    <footer class="ddisclaimer">Esto es un cálculo y una guía, no asesoramiento legal. Antes de firmar nada o de presentar la papeleta, consulta con un sindicato o un graduado social.</footer>
  </article>`;
}
