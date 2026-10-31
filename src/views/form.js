/**
 * The offer form. Its markup is static, in index.html; this fills its fields from the offer, shows the fields that
 * apply and writes the hints and summaries that depend on the figures.
 */

import { html, render } from 'lit-html';
import { fCount, fE, fInputValue, fN, isWorthCounting, joinAnd, num } from '../format.js';
import { LAW } from '../law.js';
import {
  actualYear,
  contractOf,
  endOf,
  foodPerDay,
  fromTotal,
  isoOf,
  mealsGiven,
  overlapsOf,
  sideOf,
} from '../offer.js';
import { placeOfTerms } from '../places.js';
import { areaLine, fSplit, summaries } from '../text.js';
import { $, $$ } from '../ui/dom.js';
import { fadeIn } from '../ui/motion.js';

/** When each block of the form shows: the data-show attribute in the HTML. */
const SHOW = {
  withDuration: (o) => o.terms.durationUnit !== 'unknown',
  withDate: (o) => !!o.terms.start,
  hasExtraPays: (o) => !o.terms.payrollMin && !['year', 'total'].includes(o.terms.payUnit),
  fixedPayroll: (o) => !o.terms.payrollMin,
  cashByTotal: (o) => fromTotal(o.terms),
  cashByAmount: (o) => !fromTotal(o.terms),
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
  noContract: (o) => o.terms.contract === 'none',
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
    if (!el.name) continue;
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

/** Shows only the fields that apply. With `animate`, those that appear fade in (only when you touch the form). */
function applyShow(o, animate) {
  for (const el of /** @type {HTMLElement[]} */ ($$('[data-show]'))) {
    const visible = !!SHOW[el.dataset.show](o);
    const appears = el.hidden && visible;
    el.hidden = !visible;
    if (appears && animate) fadeIn(el);
  }
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

/** The hint under the pay: the other side of what you entered (gross or net), the rates and the refund. */
function payHint(o, r) {
  if (o.terms.payrollMin && o.terms.contract !== 'none') {
    const monthly = r.min.salary / r.time.months;
    return `En nómina, el mínimo${r.min.casual ? ` de temporero (el contrato dura ${LAW.casualMaxDays} días o menos)` : ''}: unos ${fE(monthly)} brutos al mes, ${fE(monthly * r.netFactor)} netos.`;
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

/** With an agreed total: how the cash part comes out of it, over the whole contract (vacation is paid once). */
function cashHint(r) {
  const split = r.split;
  if (!split) return '';
  if (!(split.agreed > 0)) return 'Lo de en negro es lo que queda del total pactado tras la nómina y las vacaciones.';
  const times = split.unit === 'day' ? r.time.daysWorked : split.unit === 'month' ? r.time.months : 1;
  const all = (x) => fE(x * times);
  if (split.shortfall)
    return `El total pactado no llega ni a la nómina (${all(split.included ? split.net : split.payrollNet)} netos): no queda nada en negro.`;
  const vacation = split.vacationNet > 0.5;
  return `${all(split.agreed)} pactados − ${all(split.payrollNet)} de nómina${vacation && split.included ? ` − ${all(split.vacationNet)} de vacaciones` : ''} = ${fE(split.cashTotal)} en negro${split.unit !== 'total' && !r.time.noDuration ? ` (${fSplit(split.cash, split.unit)})` : ''}.${vacation && !split.included ? ` Las vacaciones (${all(split.vacationNet)}), aparte.` : ''} Todo en neto.`;
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
 * @param {boolean} animate fade in the fields that appear
 * @param {{ index: import('../places.js').PlacesIndex | null, status: string }} places the place list, to name the municipality
 */
export function paintForm(o, r, offers, animate, places) {
  const cfg = r.cfg;
  applyShow(o, animate);
  text(
    '#vacationHint',
    o.terms.vacationAuto && o.terms.vacation === 'paidAtEnd'
      ? 'Marcado de forma automática: en un contrato de menos de un mes no da tiempo a disfrutarlas y lo normal es que te las paguen aparte al acabar. Cámbialo si no es así.'
      : '',
  );
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
  text('#cashAuto', cashHint(r));
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
}
