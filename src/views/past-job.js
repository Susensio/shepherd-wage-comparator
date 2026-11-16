/** «Trabajo ya hecho»: a finished job entered on one screen; only the dates are required (ADR-0035). */

import { html, nothing } from 'lit-html';

/** @param {string} error what is wrong with what was typed, or '' */
export function pastJobView(error) {
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
      <label class="fld">Pago<span class="amount"><input type="text" class="n" id="pastPay" inputmode="decimal" autocomplete="off" placeholder="0"><span>€</span></span></label>
      <div class="past-dates">
        <label class="fld">Cada<select id="pastUnit"><option value="month">mes</option><option value="day">día</option><option value="total">en total</option></select></label>
        <label class="fld">Es<select id="pastType"><option value="net">neto</option><option value="gross">bruto</option></select></label>
      </div>
    </section>
    <section class="block">
      <div class="bh"><h2>Lo que pasó</h2></div>
      <p class="hint">Si se recuerda lo que pasó de verdad, vale más que lo pactado.</p>
      <label class="fld">Días trabajados en total<input type="text" class="n" id="pastDays" inputmode="numeric" autocomplete="off" placeholder="0"></label>
      <label class="fld">Total cobrado<span class="amount"><input type="text" class="n" id="pastPaid" inputmode="decimal" autocomplete="off" placeholder="0"><span>€</span></span><small class="hint">Neto: lo que llegó, sin retenciones.</small></label>
      <label class="check"><input type="checkbox" id="pastApprox"> Es una cifra aproximada</label>
    </section>
    ${error ? html`<p class="hint bad" role="alert">${error}</p>` : nothing}
    <button type="button" class="pri" data-action="savePastJob">Guardar el trabajo</button>
  </form>`;
}
