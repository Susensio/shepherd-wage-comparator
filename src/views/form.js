/**
 * The offer form. Its markup is static, in index.html; this fills its fields from the offer, shows the fields that
 * apply and writes the hints and summaries that depend on the figures.
 */

import { html, render } from 'lit-html';
import { fCount, fE, fEntered, fInputValue, fN, isWorthCounting, joinAnd, num } from '../format.js';
import { LAW } from '../law.js';
import { actualYear, contractOf, endOf, foodPerDay, isoOf, mealsGiven, overlapsOf, sideOf } from '../offer.js';
import { answersOf, askExtraPays, isAnswerable, isCasual, vacationPayable } from '../pay-answers.js';
import { placeOfTerms } from '../places.js';
import { areaLine, summaries, VACATION_SAYS } from '../text.js';
import { $, $$ } from '../ui/dom.js';

/** When each block of the form shows: the data-show attribute in the HTML. */
const SHOW = {
  withDuration: (o) => o.terms.durationUnit !== 'unknown',
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
    if (!el.name || el.dataset.answer) continue; // «Lo que te pagan» is read from the terms by paintAnswers
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
        ? 'No se pudo cargar la lista de pueblos. Se guarda lo que escribas.'
        : '',
  );
}

const UNIT_PER = { day: 'al día', month: 'al mes', total: 'en total' };

/** Under the vacation options: why one is missing, or has to change, when it may be paid instead; or the automatic choice. */
function vacationHint(o, r) {
  if (!vacationPayable(o.terms, r.time)) return '';
  const why = isCasual(o.terms, r.time)
    ? `En un contrato temporal de hasta ${LAW.casualMaxDays} días no da tiempo a librarlas`
    : 'En un contrato de un mes o menos no da tiempo a librarlas';
  if (o.terms.vacation === 'taken')
    return `${why}: cambia a «Me las pagan aparte, al acabar» o «Van dentro de lo que me pagan».`;
  if (o.terms.vacationAuto && o.terms.vacation === 'paidAtEnd')
    return 'Marcado de forma automática: en un contrato de un mes o menos no da tiempo a disfrutarlas y lo normal es que te las paguen aparte al acabar. Cámbialo si no es así.';
  return `${why}: se pagan al acabar o van dentro.`;
}

/** An amount typed in the form, as an input shows it. */
const inputValue = (value) => (value === '' || value == null ? '' : fInputValue(num(value), 0, 2));

/** The offer told back as answered. The figures are the model's, rounded as the result shows them. */
function payTold(o, r, a) {
  const amount = num(a.amount);
  if (!(amount > 0)) return html`Responde abajo y aquí se resume la oferta.`;
  const per = UNIT_PER[a.unit];
  /** @type {(string | import('lit-html').TemplateResult)[]} */
  const parts = [html`Te pagan <b>${fEntered(amount)} ${per}</b>`];
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
  if (r.split?.shortfall) return 'Lo que va en nómina supera lo que te pagan: no queda nada en negro.';
  return r.split?.cash > 0.5 ? `Unos ${fE(r.split.cash)} ${per} van en negro.` : 'Nada en negro.';
}

/** «Lo que te pagan»: the answers read from the terms, and what is told from them. Inputs being typed in are not touched. */
function paintAnswers(o, r) {
  const a = answersOf(o.terms);
  const set = (selector, value) => {
    const el = /** @type {HTMLInputElement} */ ($(selector));
    if (document.activeElement !== el) el.value = value;
  };
  for (const el of /** @type {HTMLInputElement[]} */ ($$('#f input[data-answer]')))
    if (el.type === 'radio') el.checked = el.value === a[el.dataset.answer];
  // The contract radios have no «none»: leaving «Nada, sin contrato» has to uncheck and check them
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
        ? ' (la mínima de los eventuales agrarios)'
        : '';
  const rates = `${fN(r.pay.rates.workerPct, 2)}\u00a0% de Seguridad Social y ${fN(r.pay.irpfPct * 100, 1)}\u00a0% de IRPF${withholding}`;
  const refund = r.pay.irpf - r.pay.irpfYear;
  return [
    o.terms.payType === 'net'
      ? `Unos ${fE(r.pay.entered.gross)} brutos${per}: ${rates}.`
      : `Unos ${fE(r.pay.entered.net)} netos${per}: ${rates}.`,
    isWorthCounting(refund) ? ` En la renta te devolverían unos ${fE(refund)} (no contado).` : '',
    o.terms.payUnit === 'day' ? ' El jornal en nómina cubre también vacaciones y festivos librados.' : '',
    o.terms.payUnit === 'total' && o.terms.vacation === 'paidAtEnd'
      ? ' Pon lo que cobraste sin las vacaciones: las vacaciones pagadas se suman aparte.'
      : '',
  ].join('');
}

function daysOffHint(o, r) {
  const t = r.time;
  if (t.months <= 0) return '';
  const hours = `Son unas ${fN(t.hoursPerWeek)}\u00a0h a la semana.`;
  if (o.terms.daysOffUnit === 'total' && !t.noDuration) {
    const more = [o.terms.holidays === 'yes' && 'los festivos', t.vacationTaken > 0 && 'las vacaciones']
      .filter(Boolean)
      .map((x, i) => `${i ? ' y ' : ', más '}${x}`)
      .join('');
    return `En todo el contrato trabajas unos ${fN(t.daysWorked)} días y libras ${fCount(t.daysOffTotal)}${more}. ${hours}`;
  }
  return `Trabajas unos ${fN(t.workedPerMonth)} días al mes y libras ${fCount(t.daysOffMonth)}${o.terms.holidays === 'yes' ? ', más los festivos' : ''}. ${hours}`;
}

function carHint(o, r) {
  if (o.mine.car === 'noCar') return 'Sin coche propio: no se cuentan gasolina ni desgaste.';
  if (!(r.car.km > 0)) return '';
  const trips = {
    daily: 'ida y vuelta cada día trabajado',
    liveIn: `al empezar y al acabar${num(o.mine.tripsHome) > 0 ? ', y cuando bajas a casa' : ''}`,
  }[o.mine.commute];
  return `Con tu coche: unos ${fN(r.time.months > 0 ? r.car.km / r.time.months : 0)}\u00a0km al mes (${trips}${o.mine.car === 'own' && num(o.mine.kmWorkPerDay) > 0 ? ', más lo que mueves trabajando' : ''}). Consumo y gasolina, en «Tus datos».`;
}

function yearHint(o, r) {
  const year = actualYear(o.terms);
  const w = r.wage;
  return `${o.terms.start ? '' : `Sin fecha, se toma ${year}. `}${year !== r.year ? `El salario mínimo de ${year} aún no está incluido: se usa el de ${r.year}. ` : ''}Salario mínimo de ${r.year}: ${fE(w.annual)} al año (${fE(w.annual / 14)} en 14 pagas), o ${fE(w.casual, 2)} por jornada en temporales de ${LAW.casualMaxDays} días o menos (${w.decree}).`;
}

/**
 * What changes in the form on every recalculation: the fields shown, the summaries and the hints.
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
  text(
    '#offerOnlyHint',
    noDate ? 'Sin fecha de inicio cuenta como solo oferta. Para contarla como trabajada, pon cuándo empezó.' : '',
  );
  text('#vacationHint', vacationHint(o, r));
  const s = summaries(o, r, places.index);
  render(
    [
      ['Dónde', s.where],
      ['Ganado', s.herd],
      ['Tiempo', s.time],
      ['Nómina', s.payroll],
      ['En negro', s.b],
      ['Casa y comida', s.housing],
      ['Coche', s.car],
      ['Contrato', contractOf(o.terms).stat],
    ]
      .filter(([, v]) => v)
      .map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`),
    $('#editInfo'),
  );
  for (const [k, v] of Object.entries(s)) {
    const el = $(`#sum-${k}`);
    if (el) el.textContent = v;
  }
  paintPlace(o, places);
  text('#payHint', payHint(o, r));
  paintAnswers(o, r);
  const food = foodPerDay(o.terms, cfg);
  text(
    '#mealsHint',
    mealsGiven(o.terms).length
      ? `Te ahorras ${fE(food, food % 1 ? 2 : 0)} por día trabajado. Los precios, en «Tus datos».`
      : '',
  );
  /** @type {HTMLInputElement} */ ($('#rentValue')).placeholder = fInputValue(num(cfg.rentValue), 0);
  text(
    '#rentHint',
    `Vacío: ${fE(num(cfg.rentValue))}, el de «Tus datos». Pon otro si aquí el alquiler es más caro o más barato, y 0 si sigues pagando tu casa mientras tanto.`,
  );
  text('#yearHint', yearHint(o, r));
  const overlaps = overlapsOf(o, offers);
  text(
    '#overlapHint',
    overlaps.length
      ? `Coincide en fechas con ${joinAnd(overlaps.map((p) => `«${p.mine.name}»`))}. Si una solo era una oferta que no trabajaste, márcalo en ella: así no se suman las dos en el año ni en el IRPF.`
      : '',
  );
  text('#daysOffHint', daysOffHint(o, r));
  text('#carHint', carHint(o, r));
  return appeared;
}
