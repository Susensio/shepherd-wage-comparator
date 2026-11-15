/**
 * «Pedir lo que falta» (ADR-0034): the block of Cuentas that leads from asking the ganadero, which is what most shepherds
 * do: «Hablar con el ganadero», the one line with the deadline, and the button to «Vía legal». Everything legal is the
 * page of its own, `legalPageView`: the deadlines, the formal written petition, the union, the papeleta, the
 * Inspección, the court, FOGASA and what to do on leaving the job. A dismissal keeps its date as one short line.
 */

import { html, nothing } from 'lit-html';
import { fDate, fE } from '../format.js';
import { citeOf, LAW, SOURCES } from '../law.js';
import { parseDate } from '../offer.js';
import { monthName } from '../text.js';
import { COPY_ICON, row } from './parts.js';

/** @typedef {NonNullable<import('../ui/record.js').RecordContext['claim']>} ClaimContext */

const fIso = (iso) => fDate(parseDate(iso));
const capital = (text) => text[0].toUpperCase() + text.slice(1);
const days = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;
const link = (source, text = SOURCES[source].title) =>
  html`<a href=${SOURCES[source].url} target="_blank" rel="noopener">${text}</a>`;
const cite = (source, art) => {
  const c = citeOf(source, art);
  return html`<a href=${c.url} target="_blank" rel="noopener">${c.label}</a>`;
};

/** «Hecho» in one tap, with the date taken from today; once marked, its date and a way to undo it. */
function doneRow(step, { button = 'Hecho', done = 'Hecho' } = {}) {
  return step.done
    ? html`<p class="hint donemark"><span>${done} el ${fIso(step.done.done)}</span> <button type="button" class="linkbtn" data-action="unmarkStep" data-step=${step.id}>Quitar</button></p>${
        step.id === 'talk'
          ? html`<label class="fld promise">Prometió pagar el <small>(si se dijo una fecha)</small><input type="date" data-promise .value=${step.done.promise ?? ''} min=${step.done.done} /></label>`
          : nothing
      }`
    : html`<button type="button" class="sm donebtn" data-action="markStep" data-step=${step.id}>${button}</button>`;
}

/** A step as a fold; `open` only the two that are the common way. */
function stepFold(step, title, body, { open = false, mark = true } = {}) {
  // A step done folds itself away; its summary line says so
  return html`<details class="plg step" ?open=${open && !step.done} data-step=${step.id}><summary>${title}${step.done ? html`<span class="stat dt ok">hecho</span>` : nothing}</summary>
    <div class="stepbody">${body}${mark ? doneRow(step) : nothing}</div></details>`;
}

/** A text to read, copy and share. */
function textCard(kind, text, canShare) {
  return html`<div class="textcard"><pre class="claim-text" tabindex="0">${text}</pre>
    <div class="actions"><button type="button" class="pri sm" data-action="copyClaimText" data-kind=${kind}>${COPY_ICON} Copiar</button>${canShare ? html`<button type="button" class="sm" data-action="shareClaimText" data-kind=${kind}>Compartir</button>` : nothing}</div>
    <p class="hint copy-msg" role="status"></p></div>`;
}

const DAY_MS = 864e5;
const daysUntil = (today, iso) => Math.round((+parseDate(iso) - +parseDate(today)) / DAY_MS);

/** The dismissal in Cuentas: its date as one short line, and the way to «Vía legal». */
function dismissalLine(step) {
  const date = fIso(/** @type {string} */ (step.deadline));
  return html`<div class="dismissal ${step.lapsed || step.done ? '' : 'warn'}">
    <p>${step.lapsed ? html`Despido: el plazo de ${LAW.dismissalDays} días hábiles ya pasó (como muy tarde, el ${date}).` : html`Despido: hasta el <b>${date}</b> como muy tarde (quedan ${days(/** @type {number} */ (step.daysLeft))}).`} ${LEGAL_BUTTON}</p></div>`;
}

/** The dismissal in «Vía legal»: the deadline in full, what to do and the finiquito. */
function dismissalBlock(step) {
  const left = step.lapsed
    ? html`El plazo de ${days(LAW.dismissalDays)} hábiles ya pasó (como muy tarde, el ${fIso(/** @type {string} */ (step.deadline))}).`
    : html`Para actuar contra el despido hay hasta el <b>${fIso(/** @type {string} */ (step.deadline))}</b> como muy tarde: quedan ${days(/** @type {number} */ (step.daysLeft))}.`;
  return html`<section class="block"><div class="bh"><h2>Despido</h2></div><div class="dismissal ${step.lapsed || step.done ? '' : 'warn'}">
    <p>${left} Son ${LAW.dismissalDays} días hábiles desde el día siguiente (${cite('et', '59.3')}); aquí se cuentan de lunes a viernes, contando los festivos como días hábiles, y el plazo real puede acabar más tarde.</p>
    <p><b>Presenta la papeleta de conciliación por despido antes de esa fecha; un sindicato puede ayudar.</b> Suspende el plazo (${cite('lrjs', '65.1')}).</p>
    <p>Si se ofrece un finiquito, fírmalo como «recibí» o «no conforme», nunca como «recibí y conforme».</p>
    ${doneRow(step, { button: 'Papeleta presentada', done: 'Papeleta presentada' })}</div></section>`;
}

/** The button to the page of the legal path. */
const LEGAL_BUTTON = html`<button type="button" class="linkbtn tapfull" data-action="openLegal">Vía legal</button>`;

/** The party fields of the request, typed here and used by the papeleta and the dossier. */
function partiesFields(c) {
  const field = (key, label, value, autocomplete) =>
    html`<label class="fld">${label}<input type="text" data-party=${key} .value=${value ?? ''} autocomplete=${autocomplete} /></label>`;
  return html`<div class="parties">${field('employerName', 'Nombre del ganadero', c.parties.employerName, 'off')}${field('employerId', 'NIF o CIF del ganadero (opcional)', c.parties.employerId, 'off')}${field('workerName', 'Nombre del pastor', c.parties.workerName, 'name')}</div>`;
}

/** One field of the papeleta, with its copy button. */
const fieldRow = (f) =>
  html`<div class="pfield"><span class="pl">${f.label}</span><span class="pv">${f.value || '—'}</span><button type="button" class="copybtn" data-action="copyField" data-field=${f.id} aria-label=${`Copiar ${f.label}`} ?disabled=${!f.value}>${COPY_ICON}</button></div>`;

const GROUP_TITLE = { general: 'Las partes', dismissal: 'Despido', amounts: 'Cantidades' };

/** The fields in the sets the papeleta has: the parties, the dismissal and the amounts. */
const fieldSets = (fields) =>
  ['general', 'dismissal', 'amounts'].map((group) => {
    const list = fields.filter((f) => f.group === group);
    return list.length
      ? html`<h4 class="pgroup">${GROUP_TITLE[group]}</h4><div class="pfields">${list.map(fieldRow)}</div>`
      : nothing;
  });

/** The papeleta: what it is, the fields prefilled, and where it is filed. */
function conciliationBody(c) {
  const office = c.office;
  return html`<p>Es un paso previo obligatorio para ir al juzgado (${cite('lrjs', '63')}). Presentarla interrumpe la prescripción y suspende la caducidad (${cite('lrjs', '65.1')}), y la asistencia a la cita es obligatoria (${cite('lrjs', '66')}). Si pasan ${LAW.conciliationResumeDays} días hábiles sin celebrarse, solo se reanuda la caducidad (la del despido, si lo hay); la prescripción de las cantidades sigue interrumpida.</p>
    <p class="hint">Lleva: el DNI, el nombre y el NIF o CIF del ganadero, el contrato y las nóminas si los hay, y el Expediente.</p>
    ${fieldSets(c.fields)}
    ${
      office
        ? html`<p>En Aragón se presenta en línea (con DNIe, certificado o Cl@ve) o con el impreso en papel, y el acto se celebra en la ${office.name}: ${office.address}, tel. ${office.phone}. Pasados ${LAW.conciliationEndDays} días sin celebrarse, el trámite se da por terminado. ${link('aragonConciliation', 'Procedimiento en aragon.es')}.</p>`
        : html`<p>Se presenta ante el servicio de mediación de la comunidad donde se trabajó.</p>`
    }`;
}

/** What is said once, as general information: money agreed en negro is salary too. */
const cashNote = html`<section class="block"><div class="bh"><h2>Dinero pactado en negro</h2></div>
  <p>El dinero pactado en negro también es salario y se puede reclamar si el acuerdo se puede probar: mensajes, testigos, pagos anteriores. En una reclamación legal las cantidades son brutas. Conviene consultarlo con un sindicato.</p></section>`;

/** What to do on leaving the job: the finiquito and the vida laboral. */
const closingBlock = html`<section class="block"><div class="bh"><h2>Al acabar el trabajo</h2></div>
  <p>Si el ganadero ofrece un finiquito que no coincide con estas cuentas, fírmalo como «recibí» o «no conforme», nunca como «recibí y conforme». Se puede pedir que esté presente un representante de los trabajadores en la firma (${cite('et', '49.2')}).</p>
  <p>Pide tu ${link('importass', 'vida laboral')} para comprobar que figuran los días cotizados.</p></section>`;

/** The deadlines: one year for each payment, and the months one by one. */
function deadlinesBlock(c) {
  const { ladder } = c;
  const by = ladder.by;
  const nearest = c.nearest;
  return html`<section class="block"><div class="bh"><h2>Plazos</h2></div>
    <p>${
      ladder.lapsedAll
        ? html`El plazo de un año ya pasó para todo lo que falta (${cite('et', '59.2')}). Un sindicato puede decir si queda alguna vía.`
        : html`Cada pago se puede reclamar durante ${LAW.claimYears === 1 ? 'un año' : `${LAW.claimYears} años`} desde que era debido (${cite('et', '59.2')}); lo del final del contrato, como las vacaciones, se cuenta desde que acaba. El más cercano: lo de ${nearest ? monthName(nearest.month) : ''}, hasta el <b>${fIso(/** @type {string} */ (by))}</b>${nearest && !nearest.lapsed ? ` · quedan ${days(nearest.daysLeft)}` : ''}.`
    }</p>
    ${
      c.deadlines.length
        ? html`<details class="plg" data-fold="deadlines"><summary>Plazos por mes</summary><div class="rows">${c.deadlines.map((d) => row(capital(monthName(d.month)), fE(d.owedWhole, 0), { sub: html`<span class=${d.lapsed ? 'due-by near' : 'due-by'}>${d.lapsed ? `plazo vencido el ${fIso(d.deadline)}` : `hasta el ${fIso(d.deadline)} · quedan ${days(d.daysLeft)}`}</span>` }))}</div>
          <p class="hint">Se cuenta un año desde el último día de cada mes. Los cobros se asignan al mes más antiguo solo para fechar la reclamación.</p></details>`
        : nothing
    }</section>`;
}

const DISCLAIMER =
  'Información general, un cálculo y una guía: no es asesoramiento legal. Antes de firmar nada o de presentar la papeleta, consulta con un sindicato o un graduado social.';

/**
 * «Vía legal»: the page of its own with everything legal of the job: the deadlines, the formal petition, the union, the
 * papeleta, the Inspección, the court, FOGASA, the finiquito and what money agreed en negro means.
 * @param {ClaimContext} c
 */
export function legalPageView(c) {
  const { ladder } = c;
  const step = (id) => /** @type {import('../model/claim.js').Step} */ (ladder.steps.find((s) => s.id === id));
  const owed = Boolean(step('request'));
  const dismissal = step('dismissal');
  return html`<div class="dossier-doc legal-doc">
    <h1>Vía legal</h1>
    <p class="hint disclaimer">${DISCLAIMER}</p>
    ${dismissal ? dismissalBlock(dismissal) : nothing}
    ${owed ? deadlinesBlock(c) : nothing}
    ${
      owed
        ? html`<section class="block"><div class="bh"><h2>Petición formal de pago</h2></div>${stepFold(
            step('request'),
            'Carta de petición',
            html`<p>Por escrito y con fecha, para que quede constancia. Guarda la prueba del envío: la captura del mensaje, el correo o el burofax.</p>
            ${partiesFields(c)}
            <label class="fld">Pagar antes del<input type="date" data-pay-by .value=${c.payBy} min=${c.today} /></label>
            ${textCard('request', c.request, c.canShare)}`,
            { open: true },
          )}</section>`
        : nothing
    }
    <section class="block"><div class="bh"><h2>Pasos</h2></div>
      ${stepFold(step('union'), 'Sindicato', html`<p>CCOO, UGT y otros sindicatos asesoran y acompañan, también para valorar estas cuentas antes de seguir. Lleva el Expediente y, si los hay, el contrato, las nóminas y los justificantes de los cobros.</p>`)}
      ${stepFold(step('conciliation'), 'Papeleta de conciliación', conciliationBody(c), { open: Boolean(dismissal) && !step('conciliation').done })}
      ${
        owed
          ? html`${stepFold(step('inspection'), 'Inspección de Trabajo', html`<p>Se le puede contar lo ocurrido por su ${link('itss', 'buzón')}: es información, no una denuncia, y no detiene ningún plazo. Estos son los hechos, sin cantidades.</p>${textCard('inspection', c.inspection, c.canShare)}`)}
      ${stepFold(step('court'), 'Juzgado de lo Social', html`<p>${step('court').ready ? 'Si la conciliación acaba sin acuerdo, la demanda va al juzgado de lo social.' : 'Después de la conciliación, si acaba sin acuerdo.'} Lleva el acta de la conciliación.</p>`)}
      ${stepFold(step('fogasa'), 'FOGASA', html`<p>Si el ganadero no puede pagar, el Fondo de Garantía Salarial puede abonar parte de lo debido en determinados casos. Las condiciones están en su ${link('fogasa', 'página')}.</p>`)}`
          : nothing
      }
    </section>
    ${c.cash ? cashNote : nothing}
    ${closingBlock}
    <button type="button" class="sm" data-action="openDossier">Ver el expediente</button>
  </div>`;
}

/**
 * «Hablar con el ganadero» under «Hasta hoy», for a job under way with months already unpaid: a closed fold with the
 * same summary.
 * @param {{ step: import('../model/claim.js').Step, summary: string, canShare: boolean } | null} talk
 */
export function underwayTalk(talk) {
  if (!talk) return nothing;
  return html`<div class="block ask">${stepFold(
    talk.step,
    'Hablar con el ganadero',
    html`<p>Se puede empezar hablando con el ganadero. Este resumen dice las jornadas y los libres de cada mes, lo que corresponde hasta hoy, lo cobrado y lo que falta, en neto.</p>${textCard('summary', talk.summary, talk.canShare)}`,
  )}</div>`;
}

/**
 * Under the yellow block of Cuentas, where every month of what is owed is past its deadline: when the last one passed.
 * @param {ClaimContext | null} c
 */
export function lapsedLine(c) {
  if (!c?.ladder.lapsedAll) return nothing;
  const last = c.deadlines.reduce((a, d) => (d.deadline > a ? d.deadline : a), '');
  return html`<p class="due-line">Plazo para reclamar: pasó el <b>${fIso(last)}</b>.</p>`;
}

/** The one line with the deadline, in Cuentas: the nearest of what is owed, and the way to «Vía legal». */
function deadlineLine(c, withButton) {
  const { ladder } = c;
  // Every month past its deadline: nothing legal to push, only an informal request (the line is `lapsedLine`)
  if (!ladder.steps.some((s) => s.id === 'request') || ladder.lapsedAll) return nothing;
  const text = html`Plazo para reclamar: hasta el <b>${fIso(/** @type {string} */ (ladder.by))}</b> (quedan ${days(daysUntil(c.today, /** @type {string} */ (ladder.by)))}).`;
  return html`<p class="due-line">${text} ${withButton ? LEGAL_BUTTON : nothing}</p>`;
}

/**
 * The block, or nothing where nothing is owed and nobody was dismissed.
 * @param {ClaimContext | null} c
 */
export function claimView(c) {
  if (!c || c.ladder.mode === 'settled') return nothing;
  const { ladder } = c;
  const step = (id) => ladder.steps.find((s) => s.id === id);
  const dismissal = step('dismissal');
  const talk = step('talk');
  return html`<div class="block ask">
    <div class="bh"><h2>Pedir lo que falta</h2></div>
    ${dismissal ? dismissalLine(dismissal) : nothing}
    ${
      talk && c.hasPayments
        ? stepFold(
            talk,
            'Hablar con el ganadero',
            html`<p>Se puede empezar hablando con el ganadero. Este resumen dice las jornadas y los libres de cada mes, lo que corresponde, lo cobrado y lo que falta, en neto.</p>${textCard('summary', c.summary, c.canShare)}`,
            { open: true },
          )
        : talk
          ? stepFold(
              talk,
              'Hablar con el ganadero',
              html`<p>Se puede empezar hablando con el ganadero. Con los cobros apuntados, aquí aparece un resumen para usar en la conversación.</p>`,
              { open: true, mark: false },
            )
          : nothing
    }
    ${deadlineLine(c, !dismissal)}
    ${c.guest ? html`<p class="hint">Estos datos solo están en este navegador, que puede borrarlos. <button type="button" class="linkbtn tapfull" data-action="openSettingsPage">Guarda una copia en Ajustes</button>.</p>` : nothing}
  </div>`;
}
