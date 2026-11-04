/**
 * The offer form, one section per step. Its markup is static, in index.html; this fills its fields from the offer,
 * shows the fields that apply and writes the hints that depend on the figures.
 */

import { html, render } from 'lit-html';
import { $, $$ } from '../dom.js';
import { fCount, fE, fEntered, fInputValue, fN, isWorthCounting, joinAnd, num } from '../format.js';
import { LAW } from '../law.js';
import { actualYear, contractOf, endOf, foodPerDay, isoOf, mealsGiven, missing, overlapsOf, sideOf } from '../offer.js';
import { answersOf, askExtraPays, isAnswerable, isCasual, vacationPayable } from '../pay-answers.js';
import { placeOfTerms } from '../places.js';
import { areaLine, VACATION_SAYS } from '../text.js';

/** When each block of the form shows: the data-show attribute in the HTML. */
const SHOW = {
  withDuration: (o) => o.terms.durationUnit !== 'unknown',
  hasStart: (o) => !!o.terms.start,
  hasEnd: (o) => !!endOf(o.terms),
  payPart: (o) => answersOf(o.terms).payroll === 'part',
  payLegacy: (o) => !isAnswerable(o.terms),
  hasExtraPays: (o) => askExtraPays(o.terms),
  // «Las libro» makes no sense when the vacation may be paid instead; one already saved with it keeps showing, with a hint
  vacationTaken: (o, r) => !vacationPayable(o.terms, r.time) || o.terms.vacation === 'taken',
  overnight: (o) => o.terms.overnight === 'yes',
  showRent: (o) => o.terms.housing === 'yes',
  showMeals: (o) => mealsGiven(o.terms).length > 0,
  mealBreakfast: (o) => !!o.terms.mealBreakfast,
  mealSnack: (o) => !!o.terms.mealSnack,
  mealLunch: (o) => !!o.terms.mealLunch,
  mealDinner: (o) => !!o.terms.mealDinner,
  trips: (o) => o.mine.car !== 'noCar',
  tripsHome: (o) => o.mine.car !== 'noCar' && o.mine.commute === 'liveIn',
  ownCar: (o) => o.mine.car === 'own',
  noCar: (o) => o.mine.car === 'noCar',
  kmRate: (o) => o.mine.car === 'own' && num(o.mine.kmWorkPerDay) > 0,
  irpfManual: (o) => o.mine.irpfMode === 'manual',
  withContract: (o) => o.terms.contract !== 'none',
};

/** Under a required question, while it is empty: what cannot be done without it. */
const REQUIRED_TEXT = {
  duration: 'Si no se sabe, marca «No se sabe».',
  hoursPerDay: 'Sin las horas no se puede calcular cuánto se gana.',
  pay: 'Sin el pago no se puede calcular cuánto se gana.',
  payrollPart: 'Sin la parte en nómina no se puede calcular cuánto va en negro.',
  vacation: 'Sin esto no se puede comprobar si se pagan las vacaciones.',
};
/** The `missing()` ids that share another's line. */
const REQUIRED_LINE = { agreedTotal: 'pay', cashInHand: 'pay' };

export const form = () => /** @type {HTMLFormElement} */ ($('#f'));

/** The end date is always start + duration, never saved, so the two cannot disagree. Not while you type in it. */
export function paintEnd(terms) {
  const end = /** @type {HTMLInputElement} */ ($('#end'));
  if (end && document.activeElement !== end) end.value = isoOf(endOf(terms));
}

/** Puts the offer's values in the form. */
export function fillForm(o) {
  paintEnd(o.terms);
  /** @type {HTMLInputElement} */ ($('#place')).value = o.mine.place;
  for (const el of /** @type {HTMLInputElement[]} */ ([...form().elements])) {
    if (!el.name || el.dataset.answer) continue; // «Pago» is read from the terms by paintAnswers
    const side = sideOf(o, el.name);
    if (el.type === 'radio') el.checked = String(side[el.name]) === el.value;
    else if (el.type === 'date') el.value = side[el.name] || '';
    else if (el.type === 'checkbox') el.checked = !!side[el.name];
    else if (el.type === 'text')
      el.value =
        el.name === 'name' ? side.name || '' : side[el.name] === '' ? '' : fInputValue(num(side[el.name]), 0, 2);
  }
}

/** The vacation radios, after the vacation was set for you. */
export function fillVacation(o) {
  for (const el of /** @type {HTMLInputElement[]} */ ($$('#f input[name=vacation]')))
    el.checked = el.value === o.terms.vacation;
}

/** Shows only the fields that apply. Returns those that appeared, for the caller to animate. */
function applyShow(o, r) {
  const appeared = [];
  for (const el of /** @type {HTMLElement[]} */ ($$('[data-show]'))) {
    const visible = !!SHOW[el.dataset.show](o, r);
    if (el.hidden && visible) appeared.push(el);
    el.hidden = !visible;
  }
  return appeared;
}

const text = (selector, value) => {
  $(selector).textContent = value;
};

/**
 * What is said under «Pueblo»: the municipality and province picked, and how the list is doing.
 * @param {object} o
 * @param {{ index: import('../places.js').PlacesIndex | null, status: string }} places
 */
function paintPlace(o, { index, status }) {
  const found = index && placeOfTerms(index, o.terms);
  $('#placePicked').hidden = !found?.municipality;
  text('#placePickedText', found?.municipality ? areaLine(found) : '');
  text(
    '#placeHint',
    status === 'loading'
      ? 'Cargando pueblos…'
      : status === 'error'
        ? 'No se pudo cargar la lista de pueblos. Se guarda lo que se escriba.'
        : '',
  );
}

const UNIT_PER = { day: 'al día', month: 'al mes', total: 'en total' };

/** Under the vacation options: why one is missing, or has to change, when it may be paid instead; or the automatic choice. */
function vacationHint(o, r) {
  if (!vacationPayable(o.terms, r.time)) return '';
  const why = isCasual(o.terms, r.time)
    ? `En contratos temporales de hasta ${LAW.casualMaxDays} días no se libran`
    : 'En contratos de un mes o menos no se libran';
  if (o.terms.vacation === 'taken') return `${why}: elige otra opción.`;
  if (o.terms.vacationAuto && o.terms.vacation === 'paidAtEnd')
    return 'Puesto por defecto: en contratos de un mes o menos lo normal es cobrarlas al acabar.';
  return `${why}.`;
}

/** An amount typed in the form, as an input shows it. */
const inputValue = (value) => (value === '' || value == null ? '' : fInputValue(num(value), 0, 2));

/** The offer told back as answered. The figures are the model's, rounded as the result shows them. */
function payTold(o, r, a) {
  const amount = num(a.amount);
  if (!(amount > 0)) return html`Responde abajo y aquí se resume la oferta.`;
  const per = UNIT_PER[a.unit];
  /** @type {(string | import('lit-html').TemplateResult)[]} */
  const parts = [html`Pago <b>${fEntered(amount)} ${per}</b>`];
  if (a.payroll === 'none') parts.push('todo en negro, sin contrato');
  else {
    if (a.payroll === 'all') parts.push('todo en nómina');
    else if (a.payroll === 'min') parts.push('el salario mínimo en nómina');
    else if (num(a.part) > 0)
      parts.push(`${fEntered(num(a.part))} ${a.partType === 'gross' ? 'brutos ' : ''}${per} en nómina`);
    else parts.push('una parte en nómina');
    if (r.split?.cash > 0.5 && (a.payroll === 'min' || num(a.part) > 0))
      parts.push(`unos ${fE(r.split.cash)} en negro`);
    parts.push(`contrato ${contractOf(o.terms).phrase}`);
    if (askExtraPays(o.terms) && o.terms.extraPays === 'separate') parts.push('dos pagas extra aparte');
    parts.push(VACATION_SAYS[o.terms.vacation] || 'vacaciones sin poner');
  }
  return html`${parts.map((p, i) => html`${i ? ' · ' : ''}${p}`)}.`;
}

/** What goes en negro, said under the question about the payslip; null while there is nothing to say. */
function cashLine(r, a) {
  const amount = num(a.amount);
  if (!(amount > 0) || a.payroll === 'all' || (a.payroll === 'part' && !(num(a.part) > 0))) return null;
  const per = UNIT_PER[a.unit];
  if (a.payroll === 'none') return `Todo en negro: ${fEntered(amount)} ${per}.`;
  if (r.split?.shortfall) return 'Lo que va en nómina supera el pago: no queda nada en negro.';
  return r.split?.cash > 0.5 ? `Unos ${fE(r.split.cash)} ${per} van en negro.` : 'Nada en negro.';
}

/** «Pago»: the answers read from the terms, and what is told from them. Inputs being typed in are not touched. */
function paintAnswers(o, r) {
  const a = answersOf(o.terms);
  const set = (selector, value) => {
    const el = /** @type {HTMLInputElement} */ ($(selector));
    if (document.activeElement !== el) el.value = value;
  };
  for (const el of /** @type {HTMLInputElement[]} */ ($$('#f input[data-answer]')))
    if (el.type === 'radio') el.checked = el.value === a[el.dataset.answer];
  // The contract radios have no «none»: leaving «Sin contrato» has to uncheck and check them
  for (const el of /** @type {HTMLInputElement[]} */ ($$('#f input[name=contract]')))
    el.checked = el.value === o.terms.contract;
  set('#payTotal', inputValue(a.amount));
  set('#payPart', inputValue(a.part));
  text('#payPartPer', UNIT_PER[a.unit]);
  render(payTold(o, r, a), $('#payTold'));
  const line = cashLine(r, a);
  $('#payCash').hidden = line === null;
  text('#payCash', line ?? '');
}

/** The hint under the pay: the other side of what you entered (gross or net), the rates and the refund. */
function payHint(o, r) {
  if (o.terms.contract === 'none') return '';
  if (o.terms.payrollMin) {
    return `En nómina, unos ${fE((r.min.salary / r.time.months) * r.netFactor)} netos al mes.`;
  }
  if (!(num(o.terms.payAmount) > 0)) return '';
  const per = { day: '/día trabajado', month: '/mes', year: '/año', total: ' en total' }[o.terms.payUnit];
  const withholding =
    o.mine.irpfMode === 'manual'
      ? ''
      : o.terms.contract === 'temporary' && r.pay.irpfPct * 100 < LAW.irpf.withholding + 0.05
        ? ', la mínima de los eventuales agrarios'
        : '';
  const rates = `${fN(r.pay.rates.workerPct, 2)}\u00a0% de Seguridad Social, ${fN(r.pay.irpfPct * 100, 1)}\u00a0% de IRPF${withholding}`;
  const refund = r.pay.irpf - r.pay.irpfYear;
  return [
    o.terms.payType === 'net'
      ? `Unos ${fE(r.pay.entered.gross)} brutos${per} (${rates}).`
      : `Unos ${fE(r.pay.entered.net)} netos${per} (${rates}).`,
    isWorthCounting(refund) ? ` En la renta se devolverían unos ${fE(refund)} (no contado).` : '',
    o.terms.payUnit === 'total' && o.terms.vacation === 'paidAtEnd'
      ? ' Pon el total sin las vacaciones, que se suman aparte.'
      : '',
  ].join('');
}

function daysOffHint(o, r) {
  const t = r.time;
  if (t.months <= 0) return '';
  const hours = `Unas ${fN(t.hoursPerWeek)}\u00a0h a la semana.`;
  if (o.terms.daysOffUnit === 'total' && !t.noDuration) {
    const more = [o.terms.holidays === 'yes' && 'los festivos', t.vacationTaken > 0 && 'las vacaciones']
      .filter(Boolean)
      .map((x, i) => `${i ? ' y ' : ', más '}${x}`)
      .join('');
    return `En todo el contrato, unos ${fN(t.daysWorked)} días de trabajo y ${fCount(t.daysOffTotal)} libres${more}. ${hours}`;
  }
  return `Al mes, unos ${fN(t.workedPerMonth)} días de trabajo y ${fCount(t.daysOffMonth)} libres${o.terms.holidays === 'yes' ? ', más los festivos' : ''}. ${hours}`;
}

function carHint(o, r) {
  if (o.mine.car === 'noCar') return 'No se cuentan gasolina ni desgaste.';
  if (!(r.car.km > 0)) return '';
  return `Unos ${fN(r.time.months > 0 ? r.car.km / r.time.months : 0)}\u00a0km al mes en coche propio. Consumo y gasolina, en «Datos comunes».`;
}

/** Only what the dates leave out; the minimum wage itself is in the Leyes tab. */
function yearHint(o, r) {
  const year = actualYear(o.terms);
  return year !== r.year ? `Aún no está el salario mínimo de ${year}: se usa el de ${r.year}.` : '';
}

/**
 * What changes in the form on every recalculation: the fields shown and the hints.
 * @param {object} o the active offer
 * @param {object} r its figures
 * @param {object[]} offers your offers, to warn about overlapping dates
 * @param {{ index: import('../places.js').PlacesIndex | null, status: string }} places the place list, to name the municipality
 * @returns {HTMLElement[]} the fields that appeared
 */
export function paintForm(o, r, offers, places) {
  const cfg = r.cfg;
  const appeared = applyShow(o, r);
  // Without a start date an offer is never counted as worked (`workedOffers`): the box says so instead of hiding it
  const offerOnly = /** @type {HTMLInputElement} */ ($('#f [name=offerOnly]'));
  const noDate = !o.terms.start;
  offerOnly.disabled = noDate;
  offerOnly.checked = noDate || !!o.mine.offerOnly;
  text('#offerOnlyHint', noDate ? `Sin fecha: cuenta como solo oferta, de ${actualYear(o.terms)}.` : '');
  text('#vacationHint', vacationHint(o, r));
  paintPlace(o, places);
  const lines = missing(o.terms).map((id) => REQUIRED_LINE[id] ?? id);
  for (const line of $$('[data-required]'))
    line.textContent = lines.includes(line.dataset.required) ? REQUIRED_TEXT[line.dataset.required] : '';
  text('#payHint', payHint(o, r));
  paintAnswers(o, r);
  const food = foodPerDay(o.terms, cfg);
  text(
    '#mealsHint',
    mealsGiven(o.terms).length
      ? `Se ahorra ${fE(food, food % 1 ? 2 : 0)} por día trabajado (precios en «Datos comunes»).`
      : '',
  );
  /** @type {HTMLInputElement} */ ($('#rentValue')).placeholder = fInputValue(num(cfg.rentValue), 0);
  text('#rentHint', `Vacío: ${fE(num(cfg.rentValue))}, el de «Datos comunes». Pon 0 si sigue pagándose la casa.`);
  text('#yearHint', yearHint(o, r));
  const overlaps = overlapsOf(o, offers);
  text(
    '#overlapHint',
    overlaps.length
      ? `Coincide en fechas con ${joinAnd(overlaps.map((p) => `«${p.mine.name}»`))}. Si no se trabajó, marca «Solo oferta» en este paso.`
      : '',
  );
  text('#daysOffHint', daysOffHint(o, r));
  text('#carHint', carHint(o, r));
  return appeared;
}
