/*
 * Every legal and tax figure the page relies on, with where it comes from.
 * The rest of the code reads it from here; nothing else should hard-code a legal figure.
 *
 * Each year: add the new minimum wage to MIN_WAGE (with its IRPF deduction, if any), check the Social Security rates,
 * the unemployment limits and the IRPF scale, and run the tests. The Leyes tab is filled in from here.
 */

import { HOLIDAY_DATA } from './law-territorial.js';

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
  ssOrder: {
    cite: 'Orden PJC/297/2026',
    title: 'Orden PJC/297/2026, cotización a la Seguridad Social en 2026',
    url: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-7296',
  },
  granada: {
    cite: 'Convenio de Granada',
    title: 'Convenio Colectivo del Sector del Campo de Granada 2023–2025 (BOP Granada nº 229, 1 de diciembre de 2023)',
    // Read in a CCOO summary of the agreement, not in the BOP itself (31 October 2026)
    url: 'https://ccoo.app/convenio/convenio-colectivo-campo-de-granada/',
  },
  huescaAgreement: {
    cite: 'Convenio colectivo del sector agrícola de la provincia de Huesca',
    title:
      'Convenio colectivo del sector agrícola de la provincia de Huesca 2022–2025 (BOPH nº 131, 9 de julio de 2024)',
    // kb/manifest.json, BOPH-2024-131-convenio-agricola-2022-2025; applies provisionally past 2025 (art. 5)
    url: 'https://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?CMD=VEROBJ&MLKOB=1342050573232',
  },
  smiDeduction2026: {
    cite: 'Hacienda',
    title: 'Deducción de IRPF para quien cobra el SMI',
    url: 'https://www.hacienda.gob.es/es-ES/Prensa/Noticias/Paginas/2026/20260217-NP-CM-SMI-DEDUCCION-2026.aspx',
  },
  sepe: { cite: 'SEPE', title: 'SEPE: prestación por desempleo', url: 'https://www.sepe.es' },
  lgss: {
    cite: 'LGSS',
    title: 'Ley General de la Seguridad Social',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11724',
  },
  modules: {
    cite: 'Orden HAC/1425/2025',
    title: 'Orden HAC/1425/2025, estimación objetiva (módulos) del IRPF para 2026',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2025-25272',
  },
  vatLaw: {
    cite: 'Ley del IVA',
    title: 'Ley 37/1992, del Impuesto sobre el Valor Añadido',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740',
  },
  lrjs: {
    cite: 'LRJS',
    title: 'Ley 36/2011, reguladora de la jurisdicción social',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2011-15936',
  },
  aragonConciliation: {
    cite: 'Gobierno de Aragón',
    title: 'Conciliación laboral preceptiva, previa a la jurisdicción social (Gobierno de Aragón)',
    // TODO: replace with the knowledge base's record (ADR-0033) once it holds the mediation offices per province
    url: 'https://www.aragon.es/tramitador/-/tramite/conciliaciones/laboral-preceptiva-previa-a-la-jurisdiccion-social',
  },
  itss: {
    cite: 'Inspección de Trabajo',
    title: 'Buzón de la Inspección de Trabajo y Seguridad Social',
    url: 'https://oeitss.mites.gob.es/buzonitss/',
  },
  fogasa: {
    cite: 'FOGASA',
    title: 'FOGASA, Fondo de Garantía Salarial',
    // Not reachable from the build environment (14 November 2026): the Ministry's page of the fund, to check by hand
    url: 'https://www.mites.gob.es/fogasa/',
  },
  importass: {
    cite: 'Seguridad Social',
    title: 'Informe de vida laboral (Importass, Seguridad Social)',
    url: 'https://portal.seg-social.gob.es/wps/portal/importass/importass/Categorias/Vida+laboral+e+informes+de+cotizacion/Informe+de+tu+vida+laboral/',
  },
};
/** Link to an article of a source: ET, RD 1561/1995 and LRJS have one anchor per article («#a37»). */
export const articleUrl = (source, art) =>
  SOURCES[source].url + (['et', 'rd1561', 'lrjs'].includes(source) ? `#a${String(art).split('.')[0]}` : '');

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
    note: 'livestock: only the half day of the weekly rest can accumulate, over up to this many weeks; the full day stays weekly (or two days per 14, ET 37.1)',
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
  dismissalDays: {
    value: 20,
    source: 'et',
    art: '59.3',
    note: 'working days to act against a dismissal (caducity); «Los días serán hábiles». LRJS art. 103.1 adds that Saturdays, Sundays and holidays of the court do not count',
  },
  conciliationResumeDays: {
    value: 15,
    source: 'lrjs',
    art: '65.1',
    note: 'working days after filing the conciliation without it being held, after which the count of the caducity resumes',
  },
  conciliationEndDays: {
    value: 30,
    note: 'Aragón: after 30 days without the conciliation being held, the procedure is over (Gobierno de Aragón, conciliation page, SOURCES.aragonConciliation)',
  },
  annualHours: {
    // TODO: Huesca's agreement (art. 25) gives 1,760: kb/tables/agreement_terms.csv, row prov:22 annual_hours, `checked`; switch Huesca to it once the owner verifies the row
    value: 1826,
    source: 'granada',
    art: '5',
    note: 'provincial reference, not a national figure: the Granada farm agreement (BOP Granada nº 229, 1 Dec 2023, valid 2023-2025, expired) sets 1,826 hours a year, 160 a month, 40 a week; other provinces differ (Huesca about 1,760); turns the annual minimum wage into an hourly one',
  },
  casualMaxDays: {
    value: 120,
    note: 'temporary contracts this long or shorter use the casual-worker daily minimum (each year’s minimum-wage decree)',
  },
  extraPaysPerYear: { value: 2, source: 'et', art: '31', note: 'two extra payments a year, one at Christmas' },
  paymentsPerYear: { value: 14, source: 'et', art: '31', note: '12 monthly payments plus the two extra pays' },
  payrollMonthDays: { value: 30, note: 'a payroll month counts 30 days, as payslips and the unemployment benefit do' },
  smiDaysPerYear: {
    value: 14 * 30,
    note: 'paymentsPerYear payments of payrollMonthDays days: daily minimum wage = annual / 420',
  },
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

/**
 * Social Security in the Sistema Especial para Trabajadores por Cuenta Ajena Agrarios, % of the base, 2026.
 * Source: Orden PJC/297/2026 (BOE-A-2026-7296), https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-7296
 * Group 1 pays 23.60 employer contingencias comunes (art. 14.3.a); the shepherd is in groups 2-11, so 21.20.
 * AT/EP is employer-only, from the premium tariff (DA 61ª LGSS); the livestock heading is not verified against
 * the 2026 tariff (a secondary source gives 2.60 for CNAE 01), so 3.3 stays.
 * Unemployment depends on the contract: see UNEMPLOYMENT_RATES.
 */
/** @type {{worker: [string, number][], employer: [string, number][]}} */
const SS_COMMON = {
  worker: [
    ['Contingencias comunes', 4.7], // art. 14.3.a
    ['Formación profesional', 0.03], // art. 34.3
    ['MEI', 0.15], // art. 16
  ],
  employer: [
    ['Contingencias comunes', 21.2], // art. 14.3.a
    ['Accidentes de trabajo', 3.3], // DA 61ª, not verified (see above)
    ['Formación profesional', 0.15], // art. 34.3
    ['Fogasa', 0.1], // art. 34.2
    ['MEI', 0.75], // art. 16
  ],
};

/**
 * Unemployment, [worker, employer] %, Orden PJC/297/2026. Art. 34.1.a: indefinite and fijo discontinuo;
 * art. 34.1.b: eventual (temporary). Art. 34.1 also gives 7.05 for «contratos de duración determinada»: which of
 * the two applies to a given temporary contract needs the owner's check; 34.1.b is used.
 */
const UNEMPLOYMENT_RATES = {
  indefinite: [1.55, 5.5],
  temporary: [1.6, 6.7],
};
const UNEMPLOYMENT_OF = {
  permanent: UNEMPLOYMENT_RATES.indefinite,
  seasonal: UNEMPLOYMENT_RATES.indefinite,
  temporary: UNEMPLOYMENT_RATES.temporary,
  // Without a contract, what the most common contract in shepherding would pay: fijo discontinuo (owner, 1 November 2026)
  none: UNEMPLOYMENT_RATES.indefinite,
};

const ssTotal = (items) => Math.round(items.reduce((s, [, p]) => s + p, 0) * 100) / 100;

/**
 * The contributions of a contract: items and totals, % of the gross. Without a contract (`none`) it is what a
 * fijo discontinuo, the most common contract in shepherding, would pay, which is what the model compares the cash
 * against.
 * @param {string} [contract] `terms.contract`
 */
export const ssOf = (contract) => {
  const [workerUnemployment, employerUnemployment] = UNEMPLOYMENT_OF[contract] || UNEMPLOYMENT_RATES.temporary;
  const worker = [...SS_COMMON.worker];
  worker.splice(1, 0, ['Desempleo', workerUnemployment]);
  const employer = [...SS_COMMON.employer];
  employer.splice(1, 0, ['Desempleo', employerUnemployment]);
  return { worker, employer, workerPct: ssTotal(worker), employerPct: ssTotal(employer) };
};

/** Unemployment benefit (SEPE): no children; monthly limits in € before the benefit's own contribution. */
const UNEMPLOYMENT = {
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

/**
 * Self-employed (autónomo) in 2026, for a shepherd who herds someone else's livestock and invoices for it.
 * Read in the BOE on 5 November 2026; the tables checked against the Orden's own text.
 */
const SELF_EMPLOYED = {
  /**
   * RETA bases by tramo of net income per month (Orden PJC/297/2026 art. 18.1): [up to €/month, minimum base,
   * maximum base]. The first three are the reduced table, the rest the general one. The quota is taken at the
   * tramo's minimum base, the usual choice.
   */
  tramos: [
    [670, 653.59, 718.94],
    [900, 718.95, 900],
    [1166.7, 849.67, 1166.7],
    [1300, 950.98, 1300],
    [1500, 960.78, 1500],
    [1700, 960.78, 1700],
    [1850, 1143.79, 1850],
    [2030, 1209.15, 2030],
    [2330, 1274.51, 2330],
    [2760, 1356.21, 2760],
    [3190, 1437.91, 3190],
    [3620, 1519.61, 3620],
    [4050, 1601.31, 4050],
    [6000, 1732.03, 5101.2],
    [Infinity, 1928.1, 5101.2],
  ],
  // RETA rates, % of the base: Orden PJC/297/2026 art. 18.2 (comunes, profesionales, equidad) and 37.5.a, 37.6
  rates: /** @type {[string, number][]} */ ([
    ['Contingencias comunes', 28.3],
    ['Contingencias profesionales', 1.3],
    ['MEI', 0.9],
    ['Cese de actividad', 0.9],
    ['Formación profesional', 0.1],
  ]),
  // The tramo's income: the módulos «rendimiento neto previo minorado» less 7 % generic expenses, spread over the
  // months registered (LGSS art. 308.1.c, rules 1ª to 3ª)
  genericExpensesPct: 7,
  // Módulos 2026 (Orden HAC/1425/2025): «servicios de cría, guarda y engorde de ganado», index 0,37 on the income
  // (Anexo I; 0,56 is «otros trabajos y servicios accesorios», not this one); the general 5 % reduction (DA 1ª)
  moduleIndex: 0.37,
  moduleReductionPct: 5,
  // IVA on herding for a livestock holder: 10 % (Ley 37/1992 art. 91.Uno.2.3º, «cría, guarda y engorde de animales»).
  // Not confirmed by a ruling for a provider who is not a holder himself; outside the farming special regime (art. 124)
  vatPct: 10,
  // IRPF withheld on invoices for livestock activities: 2 % (RD 439/2007 art. 95.6). The tax is the year's, not this
  withholdingPct: 2,
};

/** IRPF (Ley 35/2006): general scale (state and regional together), no children. */
export const IRPF = {
  expenses: 2000, // art. 19.2.f
  otherIncomeForReduction: 6500, // art. 20: the earned-income reduction only without other income over this
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
/** @type {{[K in keyof typeof RULES]: number} & {unemployment: typeof UNEMPLOYMENT, irpf: typeof IRPF, selfEmployed: typeof SELF_EMPLOYED}} */
export const LAW = {
  .../** @type {any} */ (Object.fromEntries(Object.entries(RULES).map(([k, r]) => [k, r.value]))),
  unemployment: UNEMPLOYMENT,
  irpf: IRPF,
  selfEmployed: SELF_EMPLOYED,
};
/**
 * The overnight bonus (plus de pernocta) of the collective agreements known per province: what a shepherd who must
 * sleep away from home to watch the flock gets on top of the agreement's salary. Spain has no general rule for it, so
 * where no agreement is known for the province the page counts and claims nothing (ADR-0033, owner's rule).
 * Keyed by the province code of the places list (`terms.province`).
 * The base is the minimum wage: where an agreement's salary is below it the agreement is out of date and the minimum
 * wage governs (owner's rule, 15 November 2026; the provisional 2025 pastor salary equals the 2025 minimum wage).
 * @type {Record<string, { pct: number, cite: string, url: string }>}
 */
const OVERNIGHT_BY_PROVINCE = {
  HU: {
    pct: 25,
    cite: `${SOURCES.huescaAgreement.cite}, art. 28`,
    url: SOURCES.huescaAgreement.url,
  },
};
/** The overnight bonus an agreement gives in a province: `{ pct, cite, url }`, or null where none is known. */
export const overnightOf = (province) => OVERNIGHT_BY_PROVINCE[province ?? ''] ?? null;

/**
 * Collective agreements that regulate working a public holiday, by province code of the places list: the article to
 * cite. No figure: the premium of the kb row (kb/tables/agreement_terms.csv, overtime_holiday_premium_pct) reaches the
 * page once the owner verifies it. Elsewhere none is known.
 * @type {Record<string, { cite: string, url: string }>}
 */
const HOLIDAY_WORK_BY_PROVINCE = {
  HU: { cite: `${SOURCES.huescaAgreement.cite}, art. 35`, url: SOURCES.huescaAgreement.url },
};
/** The agreement article on working a holiday in a province: `{ cite, url }`, or null where none is known. */
export const holidayWorkOf = (province) => HOLIDAY_WORK_BY_PROVINCE[province ?? ''] ?? null;

/**
 * The offices where the prior conciliation is held, by province code of the places list: only Aragón's three, from the
 * Gobierno de Aragón's procedure page (SOURCES.aragonConciliation). Elsewhere none is known and the page says «el
 * servicio de mediación de la comunidad» without an address.
 * @type {Record<string, { name: string, address: string, phone: string }>}
 */
const CONCILIATION_OFFICES = {
  HU: {
    name: 'Subdirección Provincial de Trabajo de Huesca',
    address: 'C/ Ricardo del Arco, 6, 2ª planta',
    phone: '974 293 017',
  },
  Z: {
    name: 'Subdirección Provincial de Trabajo de Zaragoza',
    address: 'Pº Fernando el Católico, 63-65',
    phone: '976 715 946',
  },
  TE: {
    name: 'Subdirección Provincial de Trabajo de Teruel',
    address: 'C/ San Francisco, 1, 1ª planta',
    phone: '978 641 182',
  },
};
/** The conciliation office of a province: `{ name, address, phone }`, or null where none is known. */
export const conciliationOffice = (province) => CONCILIATION_OFFICES[province ?? ''] ?? null;

/** «Estatuto, art. 38» and its link. */
export const citeOf = (source, art) => ({
  url: articleUrl(source, art),
  label: `${SOURCES[source].cite}, art. ${art}`,
});

/** The minimum-wage years in the table, as numbers. */
const WAGE_YEARS = Object.keys(MIN_WAGE).map(Number);
/** The minimum wage of a year: its own, or the closest year in the table. */
export const minWageOf = (year) => {
  const y = Math.min(WAGE_YEARS.at(-1), Math.max(WAGE_YEARS[0], year));
  return { year: y, ...MIN_WAGE[y] };
};

/**
 * The public holidays of a year at a place, from the verified rows of the knowledge base (kb/tables, ADR-0033):
 * the national and regional days of the province's community, plus the municipality's two local days where it has
 * them. `local` says whether the local days are in `days`; `known` is false (and `days` empty) when the province or
 * the year has no verified data. `cite` names the source: `{ id, label, url }`.
 * @param {{ municipality?: string | null, province?: string | null, year: number }} place `municipality` is the INE code
 * @returns {{ days: { date: string, name: string, scope: string, cite: { id: string, label: string, url: string | null } }[], local: boolean, known: boolean }}
 */
export const holidaysOf = ({ municipality, province, year }) => {
  const community = HOLIDAY_DATA.provinces[province ?? ''];
  const regional = HOLIDAY_DATA.regional[community]?.[year];
  if (!regional) return { days: [], local: false, known: false };
  const local = HOLIDAY_DATA.local[municipality ?? '']?.[year] ?? [];
  const days = [...regional, ...local].sort((a, b) => a.date.localeCompare(b.date));
  return { days, local: local.length > 0, known: true };
};
