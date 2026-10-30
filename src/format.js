/** Numbers and words the Spanish way: reading what people type, and writing figures, dates and lists. */

/** Euros of slack under which an amount does not count (rounding noise). */
export const WORTH_COUNTING_ABOVE = 1;
/** An amount big enough to show and add up. */
export const isWorthCounting = (euros) => euros > WORTH_COUNTING_ABOVE;

/**
 * Reads a number written the Spanish way: «1.200», «1.200,50», «1,5», «60 €». Anything else is 0.
 * @param {unknown} value
 */
export function num(value) {
  if (typeof value === 'number') return value;
  let s = String(value ?? '')
    .trim()
    .replace(/\s|€|%/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export const clamp = (x, min, max) => Math.min(max, Math.max(min, x));

/** es-ES does not group 4-digit numbers by default («1234»): grouping is forced so every figure reads alike. */
const formatter = (minDigits, maxDigits = minDigits, grouping = true) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
    useGrouping: grouping ? 'always' : false,
  });

/** «1.234», «7,5». */
export const fN = (x, decimals = 0) => formatter(decimals).format(x);

/** Decimals of a euro figure: the ones asked for or, otherwise, two below 10 € (3,40 €) and none above. */
export const euroDecimals = (x, decimals) =>
  decimals !== undefined ? decimals : Math.abs(x) > 0.004 && Math.abs(x) < 9.995 ? 2 : 0;

/** «1.234 €», «3,40 €», with a non-breaking space. */
export const fE = (x, decimals) => `${fN(x, euroDecimals(x, decimals))}\u00a0€`;

/** For inputs: «1234,5», without thousands separator. */
export const fInputValue = (x, minDigits, maxDigits = minDigits) => formatter(minDigits, maxDigits, false).format(x);

/** A figure as it was typed, with up to two decimals: «7,5» h, «4» days off, «78,75» €/día. */
export const fTyped = (value) => formatter(0, 2).format(num(value));

/** A count of days or hours: one decimal only if it is small and not round. «4,3» días, «13» días. */
export const fCount = (x) => fN(x, x < 10 && Math.abs(x - Math.round(x)) >= 0.05 ? 1 : 0);

/** One decimal only when needed: «8 h», «7,3 h». */
export const f1 = (x) => fN(x, Math.abs(x - Math.round(x)) >= 0.05 ? 1 : 0);

/** «1 día», «2,5 días». */
export const fDays = (x) => `${fCount(x)} ${fCount(x) === '1' ? 'día' : 'días'}`;

/** «21 jun 2026», or «21 jun» without the year. */
export const fDate = (date, withYear = true) =>
  date
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
    .replace(/\./g, '');

/** «a, b y c». */
export const joinAnd = (items) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : items[0] || '';

export const capitalize = (text) => text[0].toUpperCase() + text.slice(1);

/** «sin pagar» → «Sin pagar»; and the other way round. */
export const lowerFirst = (text) => text[0].toLowerCase() + text.slice(1);
