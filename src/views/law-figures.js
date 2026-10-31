/**
 * The figures inside the static text (the Leyes tab and some form hints) come from law.js: each
 * <span data-law="key"> gets LAW_FIGURES[key], and each <a data-source="et" data-art="38"> its link.
 */

import { html, render } from 'lit-html';
import { fN, joinAnd } from '../format.js';
import { articleUrl, LAW, MIN_WAGE, SOCIAL_SECURITY, SOURCES, ssTotal } from '../law.js';

const decimals = (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? 0 : 2);
const fPct = (x) => fN(x, decimals(x));
/** Euros with a plain space, as in the surrounding text. */
const eur = (x, d = 0) => `${fN(x, d)} €`;
const link = (url, text) => html`<a href=${url} target="_blank" rel="noopener">${text}</a>`;
const wages = Object.entries(MIN_WAGE);
/** A list joined with commas and «y», as a template (for links). */
const joinAndHtml = (items) => items.map((item, i) => html`${i ? (i === items.length - 1 ? ' y ' : ', ') : ''}${item}`);

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
  overnightPct: fN(LAW.overnightPct),
  annualHours: fN(LAW.annualHours),
  casualMaxDays: fN(LAW.casualMaxDays),
  workDaysWeek: fN(7 - LAW.weeklyRest, 1),
  normalWorkday: fN(LAW.weeklyHours / (7 - LAW.weeklyRest), 1),
  // «en 2024, 15.876 € brutos al año (1.134 € en 14 pagas); en 2025, 16.576 € (1.184 €)…»
  smiByYear: wages
    .map(
      ([y, m], i) =>
        `en ${y}, ${eur(m.annual)}${i ? '' : ' brutos al año'} (${eur(m.annual / 14)}${i ? '' : ' en 14 pagas'})`,
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
  ssWorker: fPct(ssTotal(SOCIAL_SECURITY.worker)),
  ssEmployer: fPct(ssTotal(SOCIAL_SECURITY.employer)),
  ...Object.fromEntries(SOCIAL_SECURITY.worker.map(([, p], i) => [`ssWorker${i}`, fN(p, 2)])),
  ...Object.fromEntries(SOCIAL_SECURITY.employer.map(([, p], i) => [`ssEmployer${i}`, fN(p, 2)])),
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
};

/** Fills every legal figure and source link under `root`. An unknown key is a bug: it throws. */
export function fillLawFigures(root = document) {
  for (const el of /** @type {HTMLElement[]} */ ([...root.querySelectorAll('[data-law]')])) {
    const value = LAW_FIGURES[el.dataset.law];
    if (value === undefined) throw new Error(`Unknown legal figure: ${el.dataset.law}`);
    if (typeof value === 'string') el.textContent = value;
    else render(value, el);
  }
  for (const a of /** @type {HTMLAnchorElement[]} */ ([...root.querySelectorAll('a[data-source]')]))
    a.href = a.dataset.art ? articleUrl(a.dataset.source, a.dataset.art) : SOURCES[a.dataset.source].url;
}
