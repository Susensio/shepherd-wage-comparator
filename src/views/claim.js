/**
 * «Pedir lo que falta» (ADR-0034): the block of Cuentas that leads from asking the ganadero, which is what most shepherds
 * do, to the legal path, closed below. Two steps are open: «Hablar con el ganadero» and «Petición de pago». The formal
 * steps are one closed fold, «Si no paga: la vía legal». A dismissal keeps its short deadline as one plain line above.
 */

import { html, nothing } from 'lit-html';
import { fDate } from '../format.js';
import { citeOf, LAW, SOURCES } from '../law.js';
import { fSumE } from '../ledger.js';
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

/** The dismissal: a short block above everything, because its deadline is short: the date, what to do and the finiquito. */
function dismissalLine(step) {
  const left = step.lapsed
    ? html`El plazo de ${days(LAW.dismissalDays)} hábiles ya pasó (como muy tarde, el ${fIso(/** @type {string} */ (step.deadline))}).`
    : html`Para actuar contra el despido hay hasta el <b>${fIso(/** @type {string} */ (step.deadline))}</b> como muy tarde: quedan ${days(/** @type {number} */ (step.daysLeft))}.`;
  return html`<div class="dismissal ${step.lapsed || step.done ? '' : 'warn'}">
    <p>${left} Son ${LAW.dismissalDays} días hábiles desde el día siguiente (${cite('et', '59.3')}); aquí se cuentan de lunes a viernes, contando los festivos como días hábiles, y el plazo real puede acabar un poco después.</p>
    <p><b>Presenta la papeleta de conciliación por despido antes de esa fecha; un sindicato puede ayudar.</b> Suspende el plazo (${cite('lrjs', '65.1')}). <button type="button" class="linkbtn tapfull" data-action="goPapeleta">Ver la papeleta y la oficina</button></p>
    <p>Si ofrecen un finiquito, fírmalo como «recibí» o «no conforme», nunca como «recibí y conforme».</p>
    ${doneRow(step, { button: 'Papeleta presentada', done: 'Papeleta presentada' })}</div>`;
}

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
  return html`<p>Es un paso previo obligatorio para ir al juzgado (${cite('lrjs', '63')}). Presentarla interrumpe la prescripción y suspende la caducidad (${cite('lrjs', '65.1')}), y a la cita hay que ir (${cite('lrjs', '66')}). Si pasan ${LAW.conciliationResumeDays} días hábiles sin celebrarse, el plazo sigue contando.</p>
    <p class="hint">Lleva: el DNI, el nombre y el NIF o CIF del ganadero, el contrato y las nóminas si los hay, y el Expediente.</p>
    ${fieldSets(c.fields)}
    ${
      office
        ? html`<p>En Aragón se presenta en línea (con DNIe, certificado o Cl@ve) o con el impreso en papel, y el acto se celebra en la ${office.name}: ${office.address}, tel. ${office.phone}. Pasados ${LAW.conciliationEndDays} días sin celebrarse, el trámite se da por terminado. ${link('aragonConciliation', 'Procedimiento en aragon.es')}.</p>`
        : html`<p>Se presenta ante el servicio de mediación de la comunidad donde se trabajó.</p>`
    }`;
}

/** The legal path, closed: the one-year deadline, then the formal steps. */
function legalFold(c) {
  const { ladder } = c;
  const step = (id) => ladder.steps.find((s) => s.id === id);
  if (!step('union')) return nothing;
  const owed = Boolean(step('request'));
  const by = ladder.by;
  const nearest = c.nearest;
  const deadline = !owed
    ? nothing
    : ladder.lapsedAll
      ? html`El plazo de un año ya pasó para todo lo que falta (${cite('et', '59.2')}). Un sindicato puede decir si queda alguna vía.`
      : html`Cada pago se puede reclamar durante ${LAW.claimYears === 1 ? 'un año' : `${LAW.claimYears} años`} desde que era debido (${cite('et', '59.2')}). El más cercano: lo de ${nearest ? monthName(nearest.month) : ''}, hasta el <b>${fIso(/** @type {string} */ (by))}</b>${nearest && !nearest.lapsed ? ` · quedan ${days(nearest.daysLeft)}` : ''}.`;
  const court = /** @type {import('../model/claim.js').Step} */ (step('court'));
  return html`<details class="plg legalpath" data-fold="ask-legal"><summary>Si no paga: la vía legal</summary>
    <div class="stepbody">
      ${owed ? html`<p class="due-line">${deadline}</p>` : nothing}
      ${
        owed && c.deadlines.length
          ? html`<details class="plg" data-fold="deadlines"><summary>Plazos por mes</summary><div class="rows">${c.deadlines.map((d) => row(capital(monthName(d.month)), fSumE(d.owed), { sub: html`<span class=${d.lapsed ? 'due-by near' : 'due-by'}>${d.lapsed ? `plazo vencido el ${fIso(d.deadline)}` : `hasta el ${fIso(d.deadline)} · quedan ${days(d.daysLeft)}`}</span>` }))}</div>
            <p class="hint">Se cuenta un año desde el último día de cada mes; las vacaciones, desde el final del contrato. Los cobros se asignan al mes más antiguo solo para fechar la reclamación.</p></details>`
          : nothing
      }
      ${stepFold(/** @type {import('../model/claim.js').Step} */ (step('union')), 'Sindicato', html`<p>CCOO, UGT y otros sindicatos asesoran y acompañan, también para valorar estas cuentas antes de seguir. Lleva el Expediente y, si los hay, el contrato, las nóminas y los justificantes de los cobros.</p>`)}
      ${stepFold(/** @type {import('../model/claim.js').Step} */ (step('conciliation')), 'Papeleta de conciliación', conciliationBody(c))}
      ${
        owed
          ? html`${stepFold(/** @type {import('../model/claim.js').Step} */ (step('inspection')), 'Inspección de Trabajo', html`<p>Se le puede contar lo ocurrido por su ${link('itss', 'buzón')}: es información, no una denuncia, y no detiene ningún plazo. Estos son los hechos, sin cantidades.</p>${textCard('inspection', c.inspection, c.canShare)}`)}
      ${stepFold(court, 'Juzgado de lo Social', html`<p>${court.ready ? 'Si la conciliación acaba sin acuerdo, la demanda va al juzgado de lo social.' : 'Después de la conciliación, si acaba sin acuerdo.'} Lleva el acta de la conciliación.</p>`)}
      ${stepFold(/** @type {import('../model/claim.js').Step} */ (step('fogasa')), 'FOGASA', html`<p>Si el ganadero no puede pagar, el Fondo de Garantía Salarial puede abonar parte de lo debido en determinados casos. Las condiciones están en su ${link('fogasa', 'página')}.</p>`)}`
          : nothing
      }
    </div></details>`;
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
    html`<p>Lo más rápido suele ser hablarlo. Este resumen dice lo que corresponde hasta hoy, lo cobrado y lo que falta, en neto, mes a mes.</p>${textCard('summary', talk.summary, talk.canShare)}`,
  )}</div>`;
}

const DISCLAIMER =
  'Esto es un cálculo y una guía, no asesoramiento legal. Antes de firmar nada o de presentar la papeleta, consulta con un sindicato o un graduado social.';

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
  const request = step('request');
  return html`<div class="block ask">
    <div class="bh"><h2>Pedir lo que falta</h2></div>
    ${dismissal ? dismissalLine(dismissal) : nothing}
    ${
      talk && c.hasPayments
        ? stepFold(
            talk,
            'Hablar con el ganadero',
            html`<p>Lo más rápido suele ser hablarlo. Este resumen dice lo que corresponde, lo cobrado y lo que falta, en neto, mes a mes.</p>${textCard('summary', c.summary, c.canShare)}`,
            { open: true },
          )
        : talk
          ? stepFold(
              talk,
              'Hablar con el ganadero',
              html`<p>Lo más rápido suele ser hablarlo. Con los cobros apuntados, aquí aparece un resumen para llevar.</p>`,
              { open: true, mark: false },
            )
          : nothing
    }
    ${
      request
        ? stepFold(
            request,
            'Petición de pago',
            html`<p>Por escrito y con fecha, para que quede constancia. Guarda la prueba del envío: la captura del mensaje, el correo o el burofax.</p>
          ${partiesFields(c)}
          <label class="fld">Pagar antes del<input type="date" data-pay-by .value=${c.payBy} min=${c.today} /></label>
          ${textCard('request', c.request, c.canShare)}`,
            { open: true },
          )
        : nothing
    }
    ${legalFold(c)}
    ${
      c.guest
        ? html`<p class="hint">Estos datos solo están en este navegador, que puede borrarlos. <button type="button" class="linkbtn tapfull" data-action="openSettingsPage">Guarda una copia en Ajustes</button>.</p>`
        : nothing
    }
    <button type="button" class="sm" data-action="openDossier">Ver el expediente</button>
    <p class="hint disclaimer">${DISCLAIMER}</p>
  </div>`;
}

/** What to do on leaving the job, whatever is owed: the finiquito, the vida laboral and the paro. A closed fold. */
export const closingHints =
  () => html`<details class="plg" data-fold="closing"><summary>Al acabar: finiquito, vida laboral y paro</summary>
  <div class="stepbody">
    <p>Si el ganadero ofrece un finiquito que no coincide con estas cuentas, fírmalo como «recibí» o «no conforme», nunca como «recibí y conforme». Se puede pedir que esté presente un representante de los trabajadores en la firma (${cite('et', '49.2')}).</p>
    <p>Pide tu ${link('importass', 'vida laboral')} para comprobar que figuran los días cotizados.</p>
    <p>Para pedir el paro hace falta el certificado de empresa, que entrega el ganadero.</p>
  </div></details>`;
