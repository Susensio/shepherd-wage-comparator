/** An offer as people enter it: its fields, defaults, templates, dates and what is still missing. */

import { fDate, joinAnd, num } from './format.js';

/** Calendar days in an average month. */
export const DAYS_PER_MONTH = 365 / 12;

/**
 * What the employer offers: the only part of an offer that is ever shared. What you are told in the offer (duration,
 * hours, days off, pay) starts empty.
 */
export const DEF_TERMS = {
  start: '',
  year: '',
  duration: '',
  durationUnit: 'months', // months · days · unknown
  hoursPerDay: '',
  daysOff: '',
  daysOffUnit: 'month', // week · month · total
  holidays: 'no', // yes: public holidays are taken off too
  contract: 'temporary', // temporary · seasonal · permanent · none
  payrollMin: false, // the payroll is the minimum wage
  payType: 'net', // net · gross
  payAmount: '',
  payUnit: 'month', // day · month · year · total
  extraPays: 'included', // included · separate
  vacation: 'included', // included · taken · paidAtEnd
  cashMode: 'amount', // amount · total (cash = agreed total − payroll)
  cashAmount: '',
  cashUnit: 'month', // day · month · total
  totalAmount: '',
  totalUnit: 'month', // day · month · total
  overnight: 'no',
  housing: 'no',
  mealBreakfast: false,
  mealSnack: false,
  mealLunch: false,
  mealDinner: false,
  kmRate: '',
  municipality: '', // INE code of the municipality (places list)
  province: '', // province code (places list)
  sheep: '', // head counts, each optional
  goats: '',
  cattle: '',
};

/** Version of the offer shape written to the account; shared rows are read by other users' pages (ADR-0006). */
export const SCHEMA_VERSION = 2;

/** Your own figures for an offer, never shared. Your meal prices, car and rent are in the settings. */
export const DEF_MINE = {
  name: '',
  offerOnly: false, // just an offer, not worked
  place: '', // the village as you wrote or picked it; the codes in `terms` are the shared part
  rentValue: '', // empty: the one in the settings
  car: 'own', // own · noCar
  commute: 'daily', // daily · liveIn
  tripsHome: '',
  kmHome: '',
  kmWorkPerDay: '',
  expenses: '',
  irpfMode: 'auto', // auto · manual
  irpfManual: 2,
};

/** Own figures that cost nothing: no car (so no trips, km or fuel), no expenses, automatic IRPF. */
const NEUTRAL_MINE = { ...DEF_MINE, car: 'noCar', commute: 'liveIn' };

/** The offer judged on its terms alone: the same terms with neutral own figures. Works from `{ id, terms }`. Keeps the name and whether it was worked. */
export const termsOnly = (offer) => ({
  ...offer,
  mine: { ...NEUTRAL_MINE, name: offer.mine?.name ?? '', offerOnly: offer.mine?.offerOnly ?? false },
});

/** The side of an offer a field lives on: `offer.mine` or `offer.terms`. */
export const sideOf = (offer, field) => (field in DEF_MINE ? offer.mine : offer.terms);

/** Your own figures, the same for every offer («Tus datos»). */
const YOUR_DATA = {
  rentValue: 350,
  mealBreakfastP: 2,
  mealSnackP: 3,
  mealLunchP: 4,
  mealDinnerP: 4,
  fuelUse: 7,
  fuelPrice: 1.89, // diesel, Spain, week of 26 October 2026 (EU Weekly Oil Bulletin)
  wear: 0.06,
};

/** Your figures and the two counting choices («Tus datos», «Cómo se cuenta»). Law figures are not here: see law.js. */
export const DEF_CFG = {
  unemployment: true, // count the unemployment benefit you generate as money
  inKind: true, // count housing and food as money
  others: 0, // other gross pay in the year, for IRPF
  ...YOUR_DATA,
};

const CONTRACTS = {
  temporary: { stat: 'Temporal', phrase: 'temporal', pill: 'Contrato temporal' },
  seasonal: { stat: 'Fijo discontinuo', phrase: 'fijo discontinuo', pill: 'Fijo discontinuo' },
  permanent: { stat: 'Fijo', phrase: 'fijo', pill: 'Contrato fijo' },
  none: { stat: 'Sin contrato', phrase: 'sin contrato ni alta', pill: 'Sin contrato' },
};
export const contractOf = (terms) => CONTRACTS[terms.contract] || CONTRACTS.temporary;

/** Templates to start an offer: the terms and own figures they set, and how they are described. */
export const TEMPLATES = [
  {
    id: 'summer',
    title: 'Puerto',
    text: 'Verano en el monte. Duermes en la borda; bajas cuando libras.',
    sets: 'Fijo discontinuo · duermes en borda · vives allí',
    terms: { contract: 'seasonal', durationUnit: 'months', overnight: 'yes', housing: 'no' },
    mine: { commute: 'liveIn' },
  },
  {
    id: 'season',
    title: 'Temporada con casa',
    text: 'Invernada u otra zona: varios meses con casa y libranzas.',
    sets: 'Temporal · con casa · vives allí',
    terms: { contract: 'temporary', durationUnit: 'months', overnight: 'no', housing: 'yes' },
    mine: { commute: 'liveIn' },
  },
  {
    id: 'harvest',
    title: 'Campaña o jornales',
    text: 'Unos días o semanas a jornal: esquileo, partos, días sueltos.',
    sets: 'Temporal · por días · cobras por día, neto · vuelves cada día',
    terms: { contract: 'temporary', durationUnit: 'days', payType: 'net', payUnit: 'day' },
    mine: { commute: 'daily' },
  },
  {
    id: 'permanent',
    title: 'Fijo todo el año',
    text: 'Contrato anual en una explotación. Vuelves a casa cada día.',
    sets: 'Fijo · 12 meses · cobras al mes · vuelves cada día',
    terms: { contract: 'permanent', durationUnit: 'months', duration: 12, payUnit: 'month' },
    mine: { commute: 'daily' },
  },
];

export const newId = () => crypto.randomUUID();
/** A new offer: defaults, completed with the given terms and own figures. `cmp` is whether Comparar includes it. */
export const makeOffer = (terms = {}, mine = {}) => ({
  id: newId(),
  terms: { ...DEF_TERMS, ...terms },
  mine: { ...DEF_MINE, name: 'Oferta 1', ...mine },
  cmp: true,
});

/** The herd, one head count per species: [terms field, one, many]. */
export const HERD = [
  ['sheep', 'oveja', 'ovejas'],
  ['goats', 'cabra', 'cabras'],
  ['cattle', 'vaca', 'vacas'],
];

/* --- Meals and housing --- */

/**
 * Meals you may be given: [field, name, default price (€)]. Prices are in the settings, under field + «P».
 * @type {[string, string, number][]}
 */
const MEALS = [
  ['mealBreakfast', 'desayuno', 2],
  ['mealSnack', 'almuerzo', 3],
  ['mealLunch', 'comida', 4],
  ['mealDinner', 'cena', 4],
];
export const mealsGiven = (terms) => MEALS.filter(([field]) => terms[field]);
/** What you save per day on food: the prices of the meals you are given. */
export const foodPerDay = (terms, cfg) => mealsGiven(terms).reduce((sum, [field]) => sum + num(cfg[`${field}P`]), 0);
/** Rent you save with housing: the one in the settings, unless the offer sets another for its area. */
export const rentPerMonth = (mine, cfg) =>
  mine.rentValue === '' || mine.rentValue == null ? num(cfg.rentValue) : num(mine.rentValue);
export const mealsList = (terms) => {
  const names = mealsGiven(terms).map(([, name]) => name);
  return names.length === MEALS.length ? 'todas las comidas' : joinAnd(names);
};

/* --- Questions about an offer --- */

/** The cash part is worked out from the agreed total (only with a contract). */
export const fromTotal = (terms) => terms.cashMode === 'total' && terms.contract !== 'none';
/** Vacation you do not take and are paid for, at the end or inside the daily wage. */
export const vacationPaid = (terms) => terms.vacation === 'paidAtEnd' || terms.vacation === 'included';
/** A month or less: there is no time to take vacation, it is normally paid in the final settlement. */
export const isShortContract = (terms) =>
  terms.durationUnit === 'days'
    ? num(terms.duration) > 0 && num(terms.duration) <= 31
    : terms.durationUnit === 'months' && num(terms.duration) > 0 && num(terms.duration) <= 1;

/** For short contracts with nothing said about vacation, it is set to «paid at the end»; undone if it stops being short. */
export function defaultVacation(terms) {
  if (terms.contract === 'none') return false;
  if (!terms.vacation && isShortContract(terms)) {
    terms.vacation = 'paidAtEnd';
    terms.vacationAuto = true;
    return true;
  }
  if (terms.vacationAuto && !isShortContract(terms)) {
    terms.vacation = '';
    delete terms.vacationAuto;
    return true;
  }
  return false;
}

/** Ids of what is still missing to give figures. */
export function missing(terms) {
  const noContract = terms.contract === 'none';
  const pay = noContract
    ? !(num(terms.cashAmount) > 0) && 'cashInHand'
    : fromTotal(terms)
      ? !(num(terms.totalAmount) > 0) && 'agreedTotal'
      : !(terms.payrollMin || num(terms.payAmount) > 0 || num(terms.cashAmount) > 0) && 'pay';
  return [
    terms.durationUnit !== 'unknown' && !(num(terms.duration) > 0) && 'duration',
    !(num(terms.hoursPerDay) > 0) && 'hoursPerDay',
    pay,
    !noContract && !terms.vacation && 'vacation',
  ].filter(Boolean);
}

/** Nothing is missing to give figures. */
export const isComplete = (terms) => missing(terms).length === 0;

/* --- Dates --- */

/** «2026-06-21» → a local date. */
export const parseDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
/** A date as a date input wants it: «2026-06-21». */
export const isoOf = (date) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    : '';

/** The year an offer starts: that of its start date; without a date, the one it had set or the current one. */
export const actualYear = (terms) =>
  Number(terms.start ? terms.start.slice(0, 4) : terms.year || new Date().getFullYear());

/** Last day of the contract: the start plus the duration. null without a date or a duration. */
export function endOf(terms) {
  if (!terms.start || terms.durationUnit === 'unknown' || !(num(terms.duration) > 0)) return null;
  const end = parseDate(terms.start);
  const n = num(terms.duration);
  if (terms.durationUnit === 'days') {
    end.setDate(end.getDate() + Math.round(n) - 1);
    return end;
  }
  // Date to date; if that day does not exist in the target month (31 January + 1 month), the last day of the month
  const whole = Math.floor(n);
  const day = end.getDate();
  const rest = Math.round((n - whole) * DAYS_PER_MONTH);
  end.setDate(1);
  end.setMonth(end.getMonth() + whole);
  const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  if (day > lastDay) {
    end.setDate(lastDay);
    if (rest) end.setDate(end.getDate() + rest);
  } else {
    end.setDate(day);
    end.setDate(end.getDate() + rest - 1);
  }
  return end;
}

/** What an offer takes up in the calendar: [start, end]. Without a duration, only the first day. */
export const spanOf = (terms) => {
  const start = parseDate(terms.start);
  return [start, endOf(terms) || start];
};

/** «1–30 nov 2025», «15 jun – 30 sep 2026», «desde el 1 jun 2026». '' without a date. */
export function datesText(terms) {
  if (!terms.start) return '';
  const start = parseDate(terms.start);
  const end = endOf(terms);
  if (!end) return `desde el ${fDate(start)}`;
  if (start.getFullYear() !== end.getFullYear()) return `${fDate(start)} – ${fDate(end)}`;
  if (start.getMonth() === end.getMonth()) return `${start.getDate()}–${fDate(end)}`;
  return `${fDate(start, false)} – ${fDate(end)}`;
}

/** Offers that count as work done or to do: dated and not «just an offer». */
export const workedOffers = (offers) => offers.filter((o) => o.terms.start && !o.mine.offerOnly);

/** Other worked offers whose dates overlap this one. */
export function overlapsOf(offer, offers) {
  if (!offer.terms.start || offer.mine.offerOnly) return [];
  const [start, end] = spanOf(offer.terms);
  return workedOffers(offers).filter((p) => {
    if (p.id === offer.id) return false;
    const [b, e] = spanOf(p.terms);
    return b <= end && e >= start;
  });
}
