/** «Trabajo ya hecho»: a finished job entered on one screen; only the dates are required (ADR-0035). */

import { html, nothing } from 'lit-html';

/** One cobro of «Otra cantidad»: its amount, date (the last day by default) and whether it is approximate. */
const cobroRow = (
  { id, amount, date, via, approx },
  _index,
  { length },
) => html`<div class="past-cobro" data-cobro=${id}>
  <label class="fld">Cantidad<span class="amount"><input type="text" class="n pastAmount" inputmode="decimal" autocomplete="off" placeholder="0" .value=${amount}><span>€</span></span></label>
  <label class="fld">Fecha<input type="date" class="pastWhen" .value=${date}></label>
  <label class="fld">Forma de pago<select class="pastVia"><option value="payroll" ?selected=${via !== 'cash'}>Nómina</option><option value="cash" ?selected=${via === 'cash'}>En mano</option></select></label>
  <label class="check"><input type="checkbox" class="pastApprox" .checked=${approx}> Es una cifra aproximada</label>
  ${length > 1 ? html`<button type="button" class="linkbtn" data-action="pastRemoveCobro" data-id=${id}>Quitar</button>` : nothing}
</div>`;

const HOW = [
  ['all', 'Lo pactado'],
  ['part', 'Otra cantidad'],
  ['none', 'Nada'],
];

const EXPECT = [
  ['yes', 'Sí, quedó en pagarlo'],
  ['no', 'No'],
];

/**
 * @param {{ error: string, how: string, min: boolean, expect: string, rows: { id: string, amount: string, date: string, via: string, approx: boolean }[] }} state `expect`: the answer to «¿Se espera algún pago más?» ('', `yes` or `no`); `error`: what is wrong with what was typed, or ''; `how`:
 * the answer to «¿Se cobró este trabajo?» ('' while unanswered); `min`: the pay agreed is the minimum wage; `rows`: the cobros listed under «Otra cantidad»
 */
export function pastJobView({ error, how, expect, min, rows }) {
  return html`<form class="dossier-doc past-doc" id="pastForm" novalidate>
    <h1>Trabajo ya hecho</h1>
    <p class="hint">Se apunta lo que se recuerde: solo hacen falta las fechas.</p>
    <label class="fld">Nombre (opcional)<input type="text" id="pastName" autocomplete="off" placeholder="Por ejemplo: Verano en Yebra"></label>
    <div class="past-dates">
      <label class="fld">Primer día<input type="date" id="pastStart" required></label>
      <label class="fld">Último día<input type="date" id="pastEnd" required></label>
    </div>
    <section class="block">
      <div class="bh"><h2>Lo pactado</h2></div>
      <p class="hint">Si se recuerdan las condiciones y no hay más datos, se da por cobrado lo pactado.</p>
      <label class="fld">Pago<span class="amount"><input type="text" class="n" id="pastPay" inputmode="decimal" autocomplete="off" placeholder="0" ?disabled=${min}><span>€</span></span></label>
      <label class="check"><input type="checkbox" id="pastMin" data-action="pastMin" ?checked=${min}> El pago es el salario mínimo</label>
      <div class="past-dates">
        <label class="fld">Cada<select id="pastUnit" ?disabled=${min}><option value="month">mes</option><option value="day">día</option><option value="total">en total</option></select></label>
        <label class="fld">Es<select id="pastType" ?disabled=${min}><option value="net">neto</option><option value="gross">bruto</option></select></label>
      </div>
    </section>
    <section class="block">
      <div class="bh"><h2>Lo que pasó</h2></div>
      <p class="hint">Si se recuerda lo que pasó de verdad, vale más que lo pactado.</p>
      <label class="fld">Días trabajados en total<input type="text" class="n" id="pastDays" inputmode="numeric" autocomplete="off" placeholder="0"></label>
      <div class="fld" role="radiogroup" aria-label="¿Se cobró este trabajo?">
        <span class="ask">¿Se cobró este trabajo?</span>
        <div class="seg">${HOW.map(([value, label]) => html`<label><input type="radio" name="pastHow" value=${value} data-action="pastHow" ?checked=${how === value}>${label}</label>`)}</div>
      </div>
      ${
        how === 'part'
          ? html`<div class="past-cobros">
        ${rows.map(cobroRow)}
        <button type="button" class="sm" data-action="pastAddCobro">+ Otro cobro</button>
        <small class="hint">Neto: lo que llegó, sin retenciones. Sin fecha, se toma el último día.</small>
      </div>`
          : nothing
      }
    </section>
    ${
      how === 'part' || how === 'none'
        ? html`<section class="block">
      <div class="fld" role="radiogroup" aria-label="¿Se espera algún pago más?">
        <span class="ask">¿Se espera algún pago más?</span>
        <div class="seg">${EXPECT.map(([value, label]) => html`<label><input type="radio" name="pastExpect" value=${value} data-action="pastExpect" ?checked=${expect === value}>${label}</label>`)}</div>
      </div>
      ${expect === 'yes' ? html`<label class="fld">¿Para cuándo? (opcional)<input type="date" id="pastExpectBy"></label>` : nothing}
      <p class="hint">Solo cuenta si queda algo por cobrar. Sin responder, el trabajo queda «Por confirmar».</p>
    </section>`
        : nothing
    }
    ${error ? html`<p class="hint bad" role="alert">${error}</p>` : nothing}
    <button type="button" class="pri" data-action="savePastJob">Guardar el trabajo</button>
  </form>`;
}
