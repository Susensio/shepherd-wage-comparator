'use strict';
/*
 * The figures in the HTML text (the Leyes tab and some form hints) come from law.js:
 * each <span data-law="key"> gets LAW_FIGURES[key], and each <a data-source="et" data-art="38"> its link.
 */

const decimals = x=>Math.abs(x-Math.round(x))<1e-9?0:2;
const fPct = x=>fN(x,decimals(x));
const eur = (x,d=0)=>`${fN(x,d)} €`; // with a plain space, as in the surrounding text
const link = (url,text)=>`<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
const minWageYears = Object.entries(MIN_WAGE);

/** Text (or HTML, for the links) of each figure. */
const LAW_FIGURES = {
  weeklyHours: fN(LAW.weeklyHours),
  extraWeekHours: fN(LAW.maxWeekHours-LAW.weeklyHours),
  maxDayHours: fN(LAW.maxDayHours),
  restBetweenDays: fN(LAW.restBetweenDays),
  restPeriodWeeks: fN(LAW.restPeriodWeeks),
  holidaysPerYear: fN(LAW.holidaysPerYear),
  vacationDaysPerYear: fN(LAW.vacationDaysPerYear),
  vacationPerMonth: fN(LAW.vacationDaysPerYear/12,1),
  severanceDaysPerYear: fN(LAW.severanceDaysPerYear),
  overnightPct: fN(LAW.overnightPct),
  casualMaxDays: fN(LAW.casualMaxDays),
  workDaysWeek: fN(7-LAW.weeklyRest,1),
  normalWorkday: fN(LAW.weeklyHours/(7-LAW.weeklyRest),1),
  // «en 2024, 15.876 € brutos al año (1.134 € en 14 pagas); en 2025, 16.576 € (1.184 €)…»
  smiByYear: minWageYears.map(([y,m],i)=>`en ${y}, ${eur(m.annual)}${i?'':' brutos al año'} (${eur(m.annual/14)}${i?'':' en 14 pagas'})`).join('; '),
  smiCasualByYear: joinAnd(minWageYears.map(([,m])=>eur(m.casual,2))),
  smiDecrees: joinAnd(minWageYears.map(([,m])=>link(m.url,m.decree.replace(/^RD /,'')))),
  smiDecreesLong: joinAnd(minWageYears.map(([,m])=>link(m.url,m.decree))),
  // «en 2025, hasta 340 €, que desaparece en 18.276 €; …; en 2024 no había»
  smiDeductionByYear: [
    ...minWageYears.filter(([,m])=>m.ded).map(([y,{ded}])=>`en ${y}, hasta ${eur(ded.max,decimals(ded.max))}, que desaparece en ${eur(ded.from+ded.max/ded.taper)}`),
    ...minWageYears.filter(([,m])=>!m.ded).map(([y])=>`en ${y} no había`),
  ].join('; '),
  ssWorker: fPct(ssTotal(SOCIAL_SECURITY.worker)),
  ssEmployer: fPct(ssTotal(SOCIAL_SECURITY.employer)),
  ...Object.fromEntries(SOCIAL_SECURITY.worker.map(([,p],i)=>['ssWorker'+i,fN(p,2)])),
  ...Object.fromEntries(SOCIAL_SECURITY.employer.map(([,p],i)=>['ssEmployer'+i,fN(p,2)])),
  irpfWithholding: fN(LAW.irpf.withholding),
  irpfExpenses: fN(LAW.irpf.expenses),
  benefitDays: fN(LAW.unemployment.minDaysContributed/LAW.unemployment.contribPerDay),
  minDaysContributed: fN(LAW.unemployment.minDaysContributed),
  windowYears: fN(LAW.unemployment.windowYears),
  benefitPct1: fN(LAW.unemployment.pct1*100),
  benefitPct2: fN(LAW.unemployment.pct2*100),
  benefitDays70: fN(LAW.unemployment.days70),
  benefitMin: fN(LAW.unemployment.minMonth),
  benefitMax: fN(LAW.unemployment.maxMonth),
};
const LAW_HTML = new Set(['smiDecrees','smiDecreesLong']);

function fillLawFigures(root=document){
  for(const el of root.querySelectorAll('[data-law]')){
    const v=LAW_FIGURES[el.dataset.law];
    if(v===undefined) throw new Error('Unknown legal figure: '+el.dataset.law);
    if(LAW_HTML.has(el.dataset.law)) el.innerHTML=v; else el.textContent=v;
  }
  for(const a of root.querySelectorAll('a[data-source]')) a.href=a.dataset.art?articleUrl(a.dataset.source,a.dataset.art):SOURCES[a.dataset.source].url;
}
fillLawFigures();
