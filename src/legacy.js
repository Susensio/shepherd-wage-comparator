/**
 * Data saved by older versions. Everything read from the browser, the Claude account or a backup goes through here,
 * so old offers keep working: first the Spanish names used until October 2026, then older formats.
 */

import { num } from './format.js';
import { DEF_OFFER, MEALS } from './offer.js';

/** Spanish-era names (until October 2026) → today's. */
export const SPANISH = {
  offerFields: {
    nombre: 'name',
    meses: 'duration',
    durUnidad: 'durationUnit',
    horasDia: 'hoursPerDay',
    libranzas: 'daysOff',
    libUnidad: 'daysOffUnit',
    festivos: 'holidays',
    aTipo: 'payType',
    aCantidad: 'payAmount',
    aUnidad: 'payUnit',
    extras: 'extraPays',
    vacaciones: 'vacation',
    bCantidad: 'cashAmount',
    bUnidad: 'cashUnit',
    contrato: 'contract',
    pernocta: 'overnight',
    casa: 'housing',
    casaValor: 'rentValue',
    comDes: 'mealBreakfast',
    comAlm: 'mealSnack',
    comMed: 'mealLunch',
    comCen: 'mealDinner',
    coche: 'car',
    vuelta: 'commute',
    bajadas: 'tripsHome',
    kmCasa: 'kmHome',
    kmTrabajoDia: 'kmWorkPerDay',
    kmPagado: 'kmRate',
    gastos: 'expenses',
    irpfModo: 'irpfMode',
    inicio: 'start',
    anio: 'year',
    soloOferta: 'offerOnly',
    bModo: 'cashMode',
    nomMin: 'payrollMin',
    totCantidad: 'totalAmount',
    totUnidad: 'totalUnit',
    vacAuto: 'vacationAuto',
    vacBruto: 'vacationGross',
    diasSemana: 'legacyDaysPerWeek',
    viajesSemana: 'legacyTripsPerWeek',
    especie: 'legacyInKind',
    comida: 'food',
    bloque: 'block',
    vecesMes: 'legacyTimesPerMonth',
    comidaValor: 'legacyMealValue',
    reparto: 'legacySplit',
    consumo: 'fuelUse',
    precioL: 'fuelPrice',
    desgaste: 'wear',
    diasVacAnio: 'vacationDaysPerYear',
    comDesP: 'mealBreakfastP',
    comAlmP: 'mealSnackP',
    comMedP: 'mealLunchP',
    comCenP: 'mealDinnerP',
  },
  offerValues: {
    durationUnit: { meses: 'months', dias: 'days', nose: 'unknown' },
    daysOffUnit: { semana: 'week', mes: 'month' },
    holidays: { si: 'yes' },
    overnight: { si: 'yes' },
    housing: { si: 'yes' },
    food: { si: 'yes', parcial: 'partial' },
    payType: { bruto: 'gross', neto: 'net' },
    payUnit: { dia: 'day', mes: 'month', anio: 'year' },
    cashUnit: { dia: 'day', mes: 'month' },
    totalUnit: { dia: 'day', mes: 'month' },
    extraPays: { incluidas: 'included', aparte: 'separate' },
    vacation: { incluidas: 'included', disfruto: 'taken', finiquito: 'paidAtEnd' },
    contract: { temporal: 'temporary', fijodisc: 'seasonal', fijo: 'permanent', ninguno: 'none' },
    car: { propio: 'own', empresa_todo: 'noCar', empresa_trabajo: 'legacyCompanyCar' },
    commute: { diario: 'daily', vivo: 'liveIn', libranza: 'legacyOnDaysOff', nunca: 'legacyNever' },
    cashMode: { pongo: 'amount' },
  },
  cfgFields: {
    paro: 'unemployment',
    otros: 'others',
    esp: 'inKind',
    horasAnuales: 'annualHours',
    pernoctaPct: 'overnightPct',
    casaValor: 'rentValue',
    comDesP: 'mealBreakfastP',
    comAlmP: 'mealSnackP',
    comMedP: 'mealLunchP',
    comCenP: 'mealDinnerP',
    consumo: 'fuelUse',
    precioL: 'fuelPrice',
    desgaste: 'wear',
    diasVacAnio: 'vacationDaysPerYear',
  },
  folds: {
    desglose2: 'breakdown2',
    roja: 'owed',
    'ley-jorn': 'law-days',
    'ley-horas': 'law-hours',
    coste: 'cost',
    leyes: 'laws',
    cuentas: 'workings',
    nominas: 'payslips',
    tiempo: 'time',
    nomina: 'payroll',
    casa: 'housing',
    coche: 'car',
    otros: 'others',
    desglose: 'breakdown',
  },
  tabs: { ofertas: 'offers', comparar: 'compare', leyes: 'laws', ajustes: 'settings' },
  units: { hora: 'hour', dia: 'day', mes: 'month' },
};

export const renameKeys = (obj, map) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [map[k] ?? k, v]));

/** An offer with Spanish field names and values, in today's names. Others are returned as they are. */
export function offerFromSpanish(o) {
  if (!o || !('nombre' in o || 'durUnidad' in o || 'horasDia' in o)) return o;
  const x = renameKeys(o, SPANISH.offerFields);
  for (const [field, values] of Object.entries(SPANISH.offerValues))
    if (x[field] in values) x[field] = values[x[field]];
  return x;
}

/** Settings with Spanish names, in today's names. */
export const cfgFromSpanish = (cfg) =>
  cfg && ('consumo' in cfg || 'esp' in cfg || 'horasAnuales' in cfg) ? renameKeys(cfg, SPANISH.cfgFields) : cfg;

/** A saved bundle (`{ofertas, cfg}` or `{offers, cfg}`: backups and the account document), in today's names. */
export const bundleFromSpanish = (d) =>
  !d || typeof d !== 'object' ? d : { ...d, offers: d.offers ?? d.ofertas, cfg: cfgFromSpanish(d.cfg) };

/** A saved offer, complete and in today's format. */
export function normalizeOffer(saved) {
  const o = offerFromSpanish(saved);
  const x = { ...DEF_OFFER, ...o };
  if (o?.daysOff === undefined && o?.legacyDaysPerWeek !== undefined) {
    x.daysOff = Math.max(0, 7 - Number(o.legacyDaysPerWeek));
    x.daysOffUnit = 'week';
  }
  if (o?.commute === undefined && o?.legacyTripsPerWeek !== undefined) x.commute = 'liveIn';
  // trips home on days off used to be counted here as well
  if (['legacyOnDaysOff', 'manual', 'legacyNever'].includes(x.commute)) x.commute = 'liveIn';
  // a company car for work used to be an option
  if (x.car === 'legacyCompanyCar') Object.assign(x, { car: 'own', kmWorkPerDay: '', kmRate: '' });
  if (o?.legacyInKind && o.housing === undefined) Object.assign(x, { housing: 'yes', rentValue: o.legacyInKind });
  // meals used to be no / some (the midday one) / all
  if (o?.mealBreakfast === undefined && o?.food !== undefined) {
    x.mealBreakfast = x.mealSnack = x.mealDinner = o.food === 'yes';
    x.mealLunch = o.food === 'yes' || o.food === 'partial';
  }
  // all three meals of the old list are now all four
  if (o?.mealSnack === undefined && o?.mealBreakfast && o?.mealLunch && o?.mealDinner) x.mealSnack = true;
  // one price for the whole day, split like the defaults, in round euros (they then move to the settings)
  if (o?.legacyMealValue !== undefined && o?.mealBreakfastP === undefined) {
    const total = MEALS.reduce((sum, [, , price]) => sum + price, 0);
    for (const [field, , price] of MEALS)
      x[`${field}P`] = Math.max(1, Math.round((num(o.legacyMealValue) * price) / total));
  }
  // «the minimum on payroll and the rest in cash» used to be one checkbox
  if (o?.legacySplit) Object.assign(x, { cashMode: 'total', payrollMin: true });
  for (const k of [
    'legacySplit',
    'legacyDaysPerWeek',
    'legacyTripsPerWeek',
    'legacyInKind',
    'food',
    'block',
    'legacyTimesPerMonth',
    'legacyMealValue',
  ])
    delete x[k];
  return x;
}

/**
 * Meal, car, rent and vacation-day prices used to be stored in each offer. Now they are in the settings:
 * the most common value among the offers is taken, and rent stays in an offer only if it differs.
 */
export function extractYourData(offers, cfg, migrate, yourData) {
  const mostCommon = (values) => {
    const counts = new Map();
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  if (migrate)
    for (const k in yourData) {
      const withHousing = k === 'rentValue' ? offers.filter((o) => o.housing === 'yes') : offers;
      const values = (withHousing.length ? withHousing : offers)
        .map((o) => o[k])
        .filter((v) => v !== undefined && v !== '' && !Number.isNaN(num(v)))
        .map(num);
      if (values.length) cfg[k] = mostCommon(values);
    }
  for (const o of offers) {
    for (const k in yourData) if (k !== 'rentValue') delete o[k];
    if (o.rentValue !== '' && (o.housing !== 'yes' || num(o.rentValue) === num(cfg.rentValue))) o.rentValue = '';
  }
  return offers;
}
