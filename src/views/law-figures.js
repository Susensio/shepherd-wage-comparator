/**
 * The figures inside the static text (the Leyes page and some form hints) come from law.js: each
 * <span data-law="key"> gets LAW_FIGURES[key], and each <a data-source="et" data-art="38"> its link.
 */

import { html, render } from 'lit-html';
import { fN, joinAnd } from '../format.js';
import { agreementOf, annualHoursOf, articleUrl, LAW, MIN_WAGE, overnightOf, SOURCES, ssOf } from '../law.js';

const decimals = (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? 0 : 2);
const fPct = (x) => fN(x, decimals(x));
/** Euros with a plain space, as in the surrounding text. */
const eur = (x, d = 0) => `${fN(x, d)} €`;
const link = (url, text) => html`<a href=${url} target="_blank" rel="noopener">${text}</a>`;
const wages = Object.entries(MIN_WAGE);
const latest = wages.at(-1)[1];
// The page's reading of the two minimums of a job without a contract (ADR-0037, kb/reports/minimum-wage/es-2026.md):
// the decree gives no divisor. The per-jornada figure behaves as the daily minimum × the paid days a year (365 less the
// vacation, plus the two extra pays) over the jornadas worked.
const paidDays = 365 - LAW.vacationDaysPerYear + LAW.extraPaysPerYear * LAW.payrollMonthDays;
const casualJornadas = Math.round(((latest.annual / LAW.smiDaysPerYear) * paidDays) / latest.casual);
const casualWithVacation =
  latest.casual + (LAW.vacationDaysPerYear * (latest.annual / LAW.smiDaysPerYear)) / casualJornadas;
// A fijo's jornadas a year: from 250 (day and a half of rest, holidays and vacation off) to 270 (fewer rest days counted)
const FIJO_JORNADAS = { few: 250, many: 270 };
const gapPct = (jornadas) => ((latest.annual / jornadas / casualWithVacation - 1) * 100).toFixed(0);
/** A list joined with commas and «y», as a template (for links). */
const joinAndHtml = (items) => items.map((item, i) => html`${i ? (i === items.length - 1 ? ' y ' : ', ') : ''}${item}`);

const SS_TEMPORARY = ssOf('temporary');
const SS_INDEFINITE = ssOf('permanent');

/** The text (or template, for links) of each figure. */
const LAW_FIGURES = {
  weeklyHours: fN(LAW.weeklyHours),
  extraWeekHours: fN(LAW.maxWeekHours - LAW.weeklyHours),
  maxDayHours: fN(LAW.maxDayHours),
  restBetweenDays: fN(LAW.restBetweenDays),
  restPeriodWeeks: fN(LAW.restPeriodWeeks),
  holidaysPerYear: fN(LAW.holidaysPerYear),
  vacationDaysPerYear: fN(LAW.vacationDaysPerYear),
  vacationPerMonth: fN(LAW.vacationDaysPerYear / 12, 1),
  severanceDaysPerYear: fN(LAW.severanceDaysPerYear),
  claimYears: fN(LAW.claimYears),
  dismissalDays: fN(LAW.dismissalDays),
  overnightHuescaPct: fN(overnightOf('HU')?.pct ?? 0),
  annualHours: fN(LAW.annualHours),
  annualHoursHuesca: fN(annualHoursOf('HU').hours),
  annualHoursHuescaArt: annualHoursOf('HU').cite?.label.split(', ').at(-1) ?? '',
  casualMaxDays: fN(LAW.casualMaxDays),
  // The two minimums of a job without a contract (ADR-0037), of the latest year the page has
  noContractPerJornadaDays: fN(LAW.noContractPerJornadaDays),
  casualJornadas: fN(casualJornadas),
  casualWithVacation: eur(casualWithVacation, 2),
  fijoGapFrom: gapPct(FIJO_JORNADAS.many),
  fijoGapTo: gapPct(FIJO_JORNADAS.few),
  restAccumulateDays: fN(LAW.restAccumulateDays),
  overtimeHuescaPct: fN(agreementOf('HU', 'overtime_premium_pct')?.value ?? 0),
  workDaysWeek: fN(7 - LAW.weeklyRest, 1),
  normalWorkday: fN(LAW.weeklyHours / (7 - LAW.weeklyRest), 1),
  // «en 2024, 15.876 € brutos al año (1.134 € en 14 pagas); en 2025, 16.576 € (1.184 €)…»
  smiByYear: wages
    .map(
      ([y, m], i) =>
        `en ${y}, ${eur(m.annual)}${i ? '' : ' brutos al año'} (${eur(m.annual / LAW.paymentsPerYear)}${i ? '' : ` en ${LAW.paymentsPerYear} pagas`})`,
    )
    .join('; '),
  smiCasualByYear: joinAnd(wages.map(([, m]) => eur(m.casual, 2))),
  smiDecrees: joinAndHtml(wages.map(([, m]) => link(m.url, m.decree.replace(/^RD /, '')))),
  smiDecreesLong: joinAndHtml(wages.map(([, m]) => link(m.url, m.decree))),
  // «en 2025, hasta 340 €, que desaparece en 18.276 €; …; en 2024 no había»
  smiDeductionByYear: [
    ...wages
      .filter(([, m]) => m.ded)
      .map(
        ([y, { ded }]) =>
          `en ${y}, hasta ${eur(ded.max, decimals(ded.max))}, que desaparece en ${eur(ded.from + ded.max / ded.taper)}`,
      ),
    ...wages.filter(([, m]) => !m.ded).map(([y]) => `en ${y} no había`),
  ].join('; '),
  ssWorkerTemporary: fPct(SS_TEMPORARY.workerPct),
  ssWorkerIndefinite: fPct(SS_INDEFINITE.workerPct),
  ssEmployerTemporary: fPct(SS_TEMPORARY.employerPct),
  ssEmployerIndefinite: fPct(SS_INDEFINITE.employerPct),
  ...Object.fromEntries(SS_TEMPORARY.worker.map(([, p], i) => [`ssWorker${i}`, fN(p, 2)])),
  ...Object.fromEntries(SS_TEMPORARY.employer.map(([, p], i) => [`ssEmployer${i}`, fN(p, 2)])),
  ssWorkerUnemploymentIndefinite: fN(SS_INDEFINITE.worker[1][1], 2),
  ssEmployerUnemploymentIndefinite: fN(SS_INDEFINITE.employer[1][1], 2),
  irpfWithholding: fN(LAW.irpf.withholding),
  irpfExpenses: fN(LAW.irpf.expenses),
  benefitDays: fN(LAW.unemployment.minDaysContributed / LAW.unemployment.contribPerDay),
  minDaysContributed: fN(LAW.unemployment.minDaysContributed),
  windowYears: fN(LAW.unemployment.windowYears),
  benefitPct1: fN(LAW.unemployment.pct1 * 100),
  benefitPct2: fN(LAW.unemployment.pct2 * 100),
  benefitDays70: fN(LAW.unemployment.days70),
  benefitMin: fN(LAW.unemployment.minMonth),
  benefitMax: fN(LAW.unemployment.maxMonth),
  retaPct: fPct(LAW.selfEmployed.rates.reduce((sum, [, pct]) => sum + pct, 0)),
  retaMinQuota: eur((LAW.selfEmployed.tramos[0][1] * LAW.selfEmployed.rates.reduce((s, [, p]) => s + p, 0)) / 100),
  retaMinBase: eur(LAW.selfEmployed.tramos[0][1], 2),
  retaMaxBase: eur(LAW.selfEmployed.tramos.at(-1)[2], 2),
  moduleIndex: fN(LAW.selfEmployed.moduleIndex, 2),
  moduleReductionPct: fN(LAW.selfEmployed.moduleReductionPct),
  genericExpensesPct: fN(LAW.selfEmployed.genericExpensesPct),
  selfEmployedVatPct: fN(LAW.selfEmployed.vatPct),
  selfEmployedWithholdingPct: fN(LAW.selfEmployed.withholdingPct),
};

/** Fills every legal figure and source link under `root`. An unknown key is a bug: it throws. */
export function fillLawFigures(root = document) {
  for (const el of /** @type {HTMLElement[]} */ ([...root.querySelectorAll('[data-law]')])) {
    const value = LAW_FIGURES[el.dataset.law];
    if (value === undefined) throw new Error(`Unknown legal figure: ${el.dataset.law}`);
    if (typeof value === 'string') el.textContent = value;
    else render(value, el);
  }
  for (const a of /** @type {HTMLAnchorElement[]} */ ([...root.querySelectorAll('a[data-source]')])) {
    const href = a.dataset.art ? articleUrl(a.dataset.source, a.dataset.art) : SOURCES[a.dataset.source].url;
    // A source with no link yet stays plain text
    if (href) a.href = href;
    else a.removeAttribute('data-source');
  }
}
