/*
 * Every legal and tax figure the page relies on, with where it comes from.
 * The rest of the code reads it from here; nothing else should hard-code a legal figure.
 *
 * Each year: add the new minimum wage to MIN_WAGE (with its IRPF deduction, if any), check the Social Security rates,
 * the unemployment limits and the IRPF scale, and run the tests. The Leyes tab is filled in from here.
 */

/** Where the rules come from. `cite` is how the page names the source next to a figure. */
export const SOURCES = {
  et: {
    cite: 'Estatuto',
    title: 'Estatuto de los Trabajadores',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430',
  },
  rd1561: {
    cite: 'RD 1561/1995',
    title: 'Real Decreto 1561/1995, jornadas especiales',
    url: 'https://www.boe.es/eli/es/rd/1995/09/21/1561/con',
  },
  agreement: {
    cite: 'Convenio',
    title: 'Convenio del campo de Huesca 2015–2017',
    url: 'https://ugt-fica.org/images/Convenios/campo/convenio_campo_huesca_2015_2017.pdf',
  },
  smiDeduction2026: {
    cite: 'Hacienda',
    title: 'Deducción de IRPF para quien cobra el SMI',
    url: 'https://www.hacienda.gob.es/es-ES/Prensa/Noticias/Paginas/2026/20260217-NP-CM-SMI-DEDUCCION-2026.aspx',
  },
  sepe: { cite: 'SEPE', title: 'SEPE: prestación por desempleo', url: 'https://www.sepe.es' },
};
/** Link to an article of a source: ET and RD 1561/1995 have one anchor per article («#a37»). */
export const articleUrl = (source, art) =>
  SOURCES[source].url + (source === 'et' || source === 'rd1561' ? `#a${String(art).split('.')[0]}` : '');

/**
 * Fixed rules: {value, source, art}. Figures without a source are the page's own conventions, explained in `note`.
 */
export const RULES = {
  weeklyHours: { value: 40, source: 'et', art: '34.1', note: 'ordinary hours per week' },
  workdayMaxHours: { value: 9, source: 'et', art: '34.3', note: 'ordinary hours per day at most' },
  workdayHours: { value: 8, note: 'hours of an ordinary workday: the casual-worker daily minimum is for a full day' },
  maxWeekHours: { value: 60, source: 'rd1561', art: '5', note: 'livestock: 40 h plus up to 20 h' },
  maxDayHours: { value: 12, source: 'rd1561', art: '5', note: 'livestock: effective hours per day' },
  restBetweenDays: { value: 10, source: 'rd1561', art: '5', note: 'livestock: hours of rest between workdays' },
  weeklyRest: { value: 1.5, source: 'et', art: '37.1', note: 'rest days per week' },
  restPeriodWeeks: {
    value: 4,
    source: 'rd1561',
    art: '5',
    note: 'livestock: weekly rest can be grouped over this many weeks',
  },
  holidaysPerYear: {
    value: 14,
    source: 'et',
    art: '37.2',
    note: 'public holidays per year (national, regional and local)',
  },
  vacationDaysPerYear: { value: 30, source: 'et', art: '38', note: 'calendar days of paid vacation per year' },
  severanceDaysPerYear: {
    value: 12,
    source: 'et',
    art: '49.1.c',
    note: 'severance at the end of a temporary contract, days of salary per year',
  },
  dismissalDaysPerYear: {
    value: 33,
    source: 'et',
    art: '56',
    note: 'unfair dismissal of a permanent worker, days of salary per year',
  },
  claimYears: { value: 1, source: 'et', art: '59.2', note: 'each payment can be claimed for a year after it was due' },
  overnightPct: { value: 25, source: 'agreement', art: '29', note: 'bonus for sleeping out when herding, % of salary' },
  casualMaxDays: {
    value: 120,
    note: 'temporary contracts this long or shorter use the casual-worker daily minimum (each year’s minimum-wage decree)',
  },
  smiDaysPerYear: { value: 420, note: '14 payments of 30 days: daily minimum wage = annual / 420' },
};

/**
 * Minimum wage per year: annual (14 payments, 40 h a week) and per workday for temporary contracts of `casualMaxDays` or fewer.
 * ded: IRPF deduction for wages near the minimum wage (up to `max` €, reduced by `taper` € per euro above `from`).
 */
export const MIN_WAGE = {
  2024: {
    annual: 15876,
    casual: 53.71,
    decree: 'RD 145/2024',
    url: 'https://www.mites.gob.es/fogasa/impresos/RD_SMI_2024.pdf',
    ded: null,
  },
  2025: {
    annual: 16576,
    casual: 56.08,
    decree: 'RD 87/2025',
    url: 'https://www.mites.gob.es/fogasa/impresos/RD_SMI_2025.pdf',
    ded: { max: 340, from: 16576, taper: 0.2 },
  },
  2026: {
    annual: 17094,
    casual: 57.82,
    decree: 'RD 126/2026',
    url: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-3815',
    ded: { max: 590.89, from: 17094, taper: 0.2 },
  },
};

/** Social Security in the agricultural scheme, % of the gross: what the worker and the employer pay, item by item. */
export const SOCIAL_SECURITY = {
  worker: [
    ['Contingencias comunes', 4.7],
    ['Desempleo', 1.58],
    ['MEI', 0.15],
  ],
  employer: [
    ['Contingencias comunes', 21.2],
    ['Desempleo', 5.5],
    ['Accidentes de trabajo', 3.3],
    ['Formación profesional', 0.15],
    ['Fogasa', 0.1],
  ],
};
export const ssTotal = (items) => Math.round(items.reduce((s, [, p]) => s + p, 0) * 100) / 100;

/** Unemployment benefit (SEPE): no children; monthly limits in € before the benefit's own contribution. */
export const UNEMPLOYMENT = {
  contribPerDay: 3, // days contributed per day of benefit (360 → 120)
  minDaysContributed: 360, // needed to get any benefit…
  windowYears: 6, // …within this many years
  days70: 180,
  pct1: 0.7,
  pct2: 0.6, // 70 % of the base the first 180 days, 60 % after
  minMonth: 560,
  maxMonth: 1225,
  contribRate: 0.047, // what the benefit itself pays to Social Security
};

/** IRPF (Ley 35/2006): general scale (state and regional together), no children. */
export const IRPF = {
  expenses: 2000, // art. 19.2.f
  personalAllowance: 5550, // art. 57
  withholding: 2, // minimum withholding for casual farm workers, % (RIRPF art. 86.2)
  scale: [
    [12450, 0.19],
    [20200, 0.24],
    [35200, 0.3],
    [60000, 0.37],
    [300000, 0.45],
    [Infinity, 0.47],
  ],
  // earned-income reduction (art. 20): full up to `fullTo`, then two linear sections
  workReduction: {
    full: 7302,
    fullTo: 14852,
    midTo: 17673.52,
    midSlope: 1.75,
    lowFrom: 2364.34,
    lowTo: 19747.5,
    lowSlope: 1.14,
  },
};

/** The figures in the shape the model reads them. */
/** @type {{[K in keyof typeof RULES]: number} & {unemployment: typeof UNEMPLOYMENT, irpf: typeof IRPF}} */
export const LAW = {
  .../** @type {any} */ (Object.fromEntries(Object.entries(RULES).map(([k, r]) => [k, r.value]))),
  unemployment: UNEMPLOYMENT,
  irpf: IRPF,
};
/** «Estatuto, art. 38» and its link. */
export const citeOf = (source, art) => ({
  url: articleUrl(source, art),
  label: `${SOURCES[source].cite}, art. ${art}`,
});

/** The minimum-wage years in the table, as numbers. */
export const WAGE_YEARS = Object.keys(MIN_WAGE).map(Number);
/** The minimum wage of a year: its own, or the closest year in the table. */
export const minWageOf = (year) => {
  const y = Math.min(WAGE_YEARS.at(-1), Math.max(WAGE_YEARS[0], year));
  return { year: y, ...MIN_WAGE[y] };
};
