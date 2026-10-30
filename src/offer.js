/** An offer as people enter it: its fields, defaults, templates, dates and what is still missing. */

import { fDate, joinAnd, num } from './format.js';
import { LAW, SOCIAL_SECURITY, ssTotal } from './law.js';

/** Calendar days in an average month. */
export const DAYS_PER_MONTH = 365 / 12;

/**
 * A new offer. What you are told in the offer (duration, hours, days off, pay) starts empty;
 * your own figures (meal prices, car, rent) are in the settings.
 */
export const DEF_OFFER = {
  name: '',
  start: '',
  year: '',
  duration: '',
  durationUnit: 'months', // months · days · unknown
  offerOnly: false, // just an offer, not worked
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
  rentValue: '', // empty: the one in the settings
  mealBreakfast: false,
  mealSnack: false,
  mealLunch: false,
  mealDinner: false,
  car: 'own', // own · noCar
  commute: 'daily', // daily · liveIn
  tripsHome: '',
  kmHome: '',
  kmWorkPerDay: '',
  kmRate: '',
  expenses: '',
  irpfMode: 'auto', // auto · manual
  irpfManual: 2,
};

/** Your own figures, the same for every offer («Tus datos»). */
export const YOUR_DATA = {
  rentValue: 350,
  mealBreakfastP: 2,
  mealSnackP: 3,
  mealLunchP: 4,
  mealDinnerP: 4,
  fuelUse: 7,
  fuelPrice: 1.45,
  wear: 0.06,
  vacationDaysPerYear: LAW.vacationDaysPerYear,
};

/** Your figures and the calculation assumptions («Supuestos del cálculo»). */
export const DEF_CFG = {
  unemployment: true, // count the unemployment benefit you generate as money
  inKind: true, // count housing and food as money
  others: 0, // other gross pay in the year, for IRPF
  ssPct: ssTotal(SOCIAL_SECURITY.worker),
  ssEmp: ssTotal(SOCIAL_SECURITY.employer),
  annualHours: 1826, // yearly working hours, to turn the annual minimum wage into an hourly one
  overnightPct: LAW.overnightPct,
  ...YOUR_DATA,
};

export const CONTRACTS = {
  temporary: { stat: 'Temporal', phrase: 'temporal', pill: 'Contrato temporal' },
  seasonal: { stat: 'Fijo discontinuo', phrase: 'fijo discontinuo', pill: 'Fijo discontinuo' },
  permanent: { stat: 'Fijo', phrase: 'fijo', pill: 'Contrato fijo' },
  none: { stat: 'Sin contrato', phrase: 'sin contrato ni alta', pill: 'Sin contrato' },
};
export const contractOf = (o) => CONTRACTS[o.contract] || CONTRACTS.temporary;

/** Templates to start an offer: what they set and how they are described. */
export const TEMPLATES = [
  {
    id: 'summer',
    title: 'Puerto',
    text: 'Verano en el monte. Duermes en la borda; bajas cuando libras.',
    sets: 'Fijo discontinuo · duermes en borda · vives allí',
    values: { contract: 'seasonal', durationUnit: 'months', overnight: 'yes', housing: 'no', commute: 'liveIn' },
  },
  {
    id: 'season',
    title: 'Temporada con casa',
    text: 'Invernada u otra zona: varios meses con casa y libranzas.',
    sets: 'Temporal · con casa · vives allí',
    values: { contract: 'temporary', durationUnit: 'months', overnight: 'no', housing: 'yes', commute: 'liveIn' },
  },
  {
    id: 'harvest',
    title: 'Campaña o jornales',
    text: 'Unos días o semanas a jornal: esquileo, partos, días sueltos.',
    sets: 'Temporal · por días · cobras por día, neto · vuelves cada día',
    values: { contract: 'temporary', durationUnit: 'days', payType: 'net', payUnit: 'day', commute: 'daily' },
  },
  {
    id: 'permanent',
    title: 'Fijo todo el año',
    text: 'Contrato anual en una explotación. Vuelves a casa cada día.',
    sets: 'Fijo · 12 meses · cobras al mes · vuelves cada día',
    values: { contract: 'permanent', durationUnit: 'months', duration: 12, payUnit: 'month', commute: 'daily' },
  },
];

export const newId = () => `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const makeOffer = (values = {}) => ({ ...DEF_OFFER, id: newId(), name: 'Oferta 1', cmp: true, ...values });

/* --- Meals and housing --- */

/**
 * Meals you may be given: [field, name, default price (€)]. Prices are in the settings, under field + «P».
 * @type {[string, string, number][]}
 */
export const MEALS = [
  ['mealBreakfast', 'desayuno', 2],
  ['mealSnack', 'almuerzo', 3],
  ['mealLunch', 'comida', 4],
  ['mealDinner', 'cena', 4],
];
export const mealsGiven = (o) => MEALS.filter(([field]) => o[field]);
/** What you save per day on food: the prices of the meals you are given. */
export const foodPerDay = (o, cfg) => mealsGiven(o).reduce((sum, [field]) => sum + num(cfg[`${field}P`]), 0);
/** Rent you save with housing: the one in the settings, unless the offer sets another for its area. */
export const rentPerMonth = (o, cfg) =>
  o.rentValue === '' || o.rentValue == null ? num(cfg.rentValue) : num(o.rentValue);
export const mealsList = (o) => {
  const names = mealsGiven(o).map(([, name]) => name);
  return names.length === MEALS.length ? 'todas las comidas' : joinAnd(names);
};

/* --- Questions about an offer --- */

/** The cash part is worked out from the agreed total (only with a contract). */
export const fromTotal = (o) => o.cashMode === 'total' && o.contract !== 'none';
/** Vacation you do not take and are paid for, at the end or inside the daily wage. */
export const vacationPaid = (o) => o.vacation === 'paidAtEnd' || o.vacation === 'included';
/** A month or less: there is no time to take vacation, it is normally paid in the final settlement. */
export const isShortContract = (o) =>
  o.durationUnit === 'days'
    ? num(o.duration) > 0 && num(o.duration) <= 31
    : o.durationUnit === 'months' && num(o.duration) > 0 && num(o.duration) <= 1;

/** For short contracts with nothing said about vacation, it is set to «paid at the end»; undone if it stops being short. */
export function defaultVacation(o) {
  if (o.contract === 'none') return false;
  if (!o.vacation && isShortContract(o)) {
    o.vacation = 'paidAtEnd';
    o.vacationAuto = true;
    return true;
  }
  if (o.vacationAuto && !isShortContract(o)) {
    o.vacation = '';
    delete o.vacationAuto;
    return true;
  }
  return false;
}

/** Ids of what is still missing to give figures. */
export function missing(o) {
  const noContract = o.contract === 'none';
  const pay = noContract
    ? !(num(o.cashAmount) > 0) && 'cashInHand'
    : fromTotal(o)
      ? !(num(o.totalAmount) > 0) && 'agreedTotal'
      : !(o.payrollMin || num(o.payAmount) > 0 || num(o.cashAmount) > 0) && 'pay';
  return [
    o.durationUnit !== 'unknown' && !(num(o.duration) > 0) && 'duration',
    !(num(o.hoursPerDay) > 0) && 'hoursPerDay',
    pay,
    !noContract && !o.vacation && 'vacation',
  ].filter(Boolean);
}

/** Nothing is missing to give figures. */
export const isComplete = (o) => missing(o).length === 0;

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
export const actualYear = (o) => Number(o.start ? o.start.slice(0, 4) : o.year || new Date().getFullYear());

/** Last day of the contract: the start plus the duration. null without a date or a duration. */
export function endOf(o) {
  if (!o.start || o.durationUnit === 'unknown' || !(num(o.duration) > 0)) return null;
  const end = parseDate(o.start);
  const n = num(o.duration);
  if (o.durationUnit === 'days') {
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
export const spanOf = (o) => {
  const start = parseDate(o.start);
  return [start, endOf(o) || start];
};

/** «1–30 nov 2025», «15 jun – 30 sep 2026», «desde el 1 jun 2026». '' without a date. */
export function datesText(o) {
  if (!o.start) return '';
  const start = parseDate(o.start);
  const end = endOf(o);
  if (!end) return `desde el ${fDate(start)}`;
  if (start.getFullYear() !== end.getFullYear()) return `${fDate(start)} – ${fDate(end)}`;
  if (start.getMonth() === end.getMonth()) return `${start.getDate()}–${fDate(end)}`;
  return `${fDate(start, false)} – ${fDate(end)}`;
}

/** Offers that count as work done or to do: dated and not «just an offer». */
export const workedOffers = (offers) => offers.filter((o) => o.start && !o.offerOnly);

/** Other worked offers whose dates overlap this one. */
export function overlapsOf(o, offers) {
  if (!o.start || o.offerOnly) return [];
  const [start, end] = spanOf(o);
  return workedOffers(offers).filter((p) => {
    if (p.id === o.id) return false;
    const [b, e] = spanOf(p);
    return b <= end && e >= start;
  });
}
