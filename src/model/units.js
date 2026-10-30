/** Units money is shown in, and the parts of what you earn. */

import { fE } from '../format.js';

/** The Comparar units: how a contract figure is divided and with how many decimals it is shown. */
export const UNITS = {
  hour: {
    key: 'perHour',
    pick: 'hora',
    label: 'por hora',
    short: 'por hora',
    suffix: '/hora',
    decimals: 2,
    per: (r) => r.time.hours,
  },
  day: {
    key: 'perDay',
    pick: 'día',
    label: 'por día trabajado',
    short: 'por día',
    suffix: '/día',
    decimals: 0,
    per: (r) => r.time.daysWorked,
  },
  month: {
    key: 'perMonth',
    pick: 'mes',
    label: 'al mes',
    short: 'al mes',
    suffix: '/mes',
    decimals: 0,
    per: (r) => r.time.months,
  },
  total: {
    key: 'total',
    pick: 'total',
    label: 'en total',
    short: 'en total',
    suffix: ' en total',
    decimals: 0,
    per: () => 1,
  },
};
export const UNIT_ORDER = Object.keys(UNITS);
/** How the unit of an amount is written: «60 €/día», «1.200 €/mes», «4.000 € en total». */
export const UNIT_TEXT = { hour: '€/h', day: '€/día', month: '€/mes', year: '€/año', total: '€ en total' };

/** A whole-contract figure in a unit. */
export const inUnit = (x, r, unit) => {
  const per = UNITS[unit].per(r);
  return per > 0 ? x / per : 0;
};
/** Formatted in the unit's decimals. */
export const fUnit = (x, unit) => fE(x, UNITS[unit].decimals || undefined);

/** For contracts shorter than a month, «per month» is an extrapolation. */
export const isUnderAMonth = (r) => !r.time.noDuration && r.time.months < 0.97;
/** Each offer is shown in one unit: per month, or per day for contracts shorter than a month. */
export const offerUnit = (r) => (isUnderAMonth(r) ? 'day' : 'month');

/**
 * Parts of what you earn, in the order of the bar, the legend and the breakdown. `money`: money that reaches you.
 * Payroll joins salary and extra payments; paid vacation goes apart.
 */
export const PARTS = [
  { key: 'payroll', color: '--c-pay', label: 'Nómina', value: (p) => p.base + p.extraPays, money: true },
  { key: 'b', color: '--c-cash', label: 'Negro', value: (p) => p.b, money: true },
  { key: 'km', color: '--c-km', label: 'Km', value: (p) => p.km, money: true },
  { key: 'vacationPay', color: '--c-vac', label: 'Vacaciones', value: (p) => p.vacationPay, money: true },
  { key: 'severance', color: '--c-sev', label: 'Indemnización', value: (p) => p.severance },
  { key: 'housing', color: '--c-housing', label: 'Casa', value: (p) => p.housing },
  { key: 'food', color: '--c-food', label: 'Comida', value: (p) => p.food },
  { key: 'unemployment', color: '--c-unemp', label: 'Paro', value: (p) => p.unemployment },
];
/** Everything you earn before expenses. */
export const incomeOf = (r) => PARTS.reduce((sum, part) => sum + part.value(r.earnings.parts), 0);

/**
 * How an offer's money is written in a unit:
 * inUnit(x) the figure · net(x) a gross figure, net · netAll(x) net over the whole contract.
 */
export function moneyIn(r, unit) {
  const factor = r.netFactor;
  const figure = (x) => fUnit(inUnit(x, r, unit), unit);
  return {
    unit,
    figure,
    net: (x) => figure(x * factor),
    netAll: (x, decimals = 0) => fE(x * factor, decimals),
    factor,
  };
}
