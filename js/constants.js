'use strict';
/* Legal figures, units, defaults and the tables everything else reads. */

const DM = 365/12; // calendar days in an average month

/** Legal figures and fixed assumptions. Sources are listed in the Leyes tab. */
const LAW = {
  workdayHours: 8,             // hours in an ordinary workday
  weeklyHours: 40,         // ordinary hours per week (ET art. 34)
  workdayMaxHours: 9,          // ordinary hours per day at most (ET art. 34.3)
  maxWeekHours: 60,             // livestock: 40 + up to 20 h (RD 1561/1995, art. 5)
  maxDayHours: 12,                // livestock: effective hours per day (RD 1561/1995, art. 5)
  weeklyRest: 1.5,       // rest days per week (ET art. 37.1)
  casualMaxDays: 120,      // casual-worker minimum wage: temporary contracts of up to 120 days
  smiDaysPerYear: 420,          // 14 payments of 30 days: daily minimum wage = annual / 420
  severanceDaysPerYear: 12,        // severance at the end of a temporary contract (ET art. 49.1.c)
  holidaysPerYear: 14,          // public holidays per year (national, regional and local)
  unemployment: {contribPerDay: 3, days70: 180, pct1: .7, pct2: .6, minMonth: 560, maxMonth: 1225, contribRate: .047},
  // withholding: the minimum for casual farm workers, to get from what you are paid to the gross
  irpf: {expenses: 2000, personalAllowance: 5550, withholding: 2, // the deduction for wages near the minimum wage is in the SMI table, per year
         scale: [[12450,.19],[20200,.24],[35200,.30],[60000,.37],[300000,.45],[Infinity,.47]]},
};
/** Minimum wage per year: annual (14 payments, 40 h a week) and per workday for temporary contracts of 120 days or less. */
const SMI = {
  // ded: IRPF deduction for wages near the minimum wage (up to `max` €, reduced by `taper` € per euro above `from`). There was none in 2024.
  2024: {annual:15876, casual:53.71, rd:'RD 145/2024', url:'https://www.mites.gob.es/fogasa/impresos/RD_SMI_2024.pdf', ded:null},
  2025: {annual:16576, casual:56.08, rd:'RD 87/2025',  url:'https://www.mites.gob.es/fogasa/impresos/RD_SMI_2025.pdf', ded:{max:340, from:16576, taper:.2}},
  2026: {annual:17094, casual:57.82, rd:'RD 126/2026', url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-3815', ded:{max:590.89, from:17094, taper:.2}},
};
const YEARS = Object.keys(SMI);
/** The year an offer starts: that of its start date; without a date, the one it had set or the current one. */
const actualYear = o=>Number(o.start?o.start.slice(0,4):o.year||new Date().getFullYear());
/** The minimum-wage year of an offer: its own, or the closest one in the table. */
const yearOf = o=>String(clamp(actualYear(o),Number(YEARS[0]),Number(YEARS.at(-1))));

/* Offer dates */
const parseDate = s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
/** Last day of the contract: the start date plus the duration. null without a date or a duration. */
function endOf(o){
  if(!o.start||o.durationUnit==='unknown'||!(num(o.duration)>0)) return null;
  const f=parseDate(o.start), n=num(o.duration);
  if(o.durationUnit==='days') f.setDate(f.getDate()+Math.round(n)-1);
  else { // date to date; if that day does not exist in the target month (31 January + 1 month), it ends on the last day of the month
    const whole=Math.floor(n), d0=f.getDate(), rest=Math.round((n-whole)*DM);
    f.setDate(1); f.setMonth(f.getMonth()+whole);
    const last=new Date(f.getFullYear(),f.getMonth()+1,0).getDate();
    if(d0>last){ f.setDate(last); if(rest) f.setDate(f.getDate()+rest) }
    else { f.setDate(d0); f.setDate(f.getDate()+rest-1) }
  }
  return f;
}
const fDate = (d,year=true)=>d.toLocaleDateString('es-ES',{day:'numeric',month:'short',...(year?{year:'numeric'}:{})}).replace(/\./g,'');
/** What an offer takes up in the calendar: [start, end]. Without a duration, only the first day. */
const span = o=>{const a=parseDate(o.start);return [a,endOf(o)||a]};
/** Offers that count as work done or to do: with a date and not marked as «just an offer». */
const workedOffers = ()=>myOffers().filter(o=>o.start&&!o.offerOnly);
/** Other worked offers whose dates overlap this one. */
const overlapsOf = o=>{
  if(!o.start||o.offerOnly) return [];
  const [a,f]=span(o);
  return workedOffers().filter(p=>p.id!==o.id&&(([b,e])=>b<=f&&e>=a)(span(p)));
};
/** «1–30 nov 2025», «15 jun – 30 sep 2026», «desde el 1 jun 2026». '' without a date. */
function datesTxt(o){
  if(!o.start) return '';
  const a=parseDate(o.start), f=endOf(o);
  if(!f) return `desde el ${fDate(a)}`;
  if(a.getFullYear()!==f.getFullYear()) return `${fDate(a)} – ${fDate(f)}`;
  if(a.getMonth()===f.getMonth()) return `${a.getDate()}–${fDate(f)}`;
  return `${fDate(a,false)} – ${fDate(f)}`;
}
// Weekly-hours warning thresholds (half an hour of slack for rounding)
const H_ORDINARY = LAW.weeklyHours + .5, H_MAX = LAW.maxWeekHours + .5;

/** Units of the picker: how a contract figure is divided and with how many decimals it is shown. */
const UNITS = {
  hour:  {key:'perHour', sel:'hora',  lbl:'por hora',          short:'por hora', head:'Por hora', suf:'/hora',     dec:2, div:r=>r.hours},
  day:   {key:'perDay',  sel:'día',   lbl:'por día trabajado', short:'por día',  head:'Por día',  suf:'/día',      dec:0, div:r=>r.daysWorked},
  month:   {key:'perMonth',  sel:'mes',   lbl:'al mes',            short:'al mes',   head:'Por mes',  suf:'/mes',      dec:0, div:r=>r.months},
  total: {key:'total',   sel:'total', lbl:'en total',          short:'en total', head:'Total',    suf:' en total', dec:0, div:()=>1},
};
const UNIT_ORDER = Object.keys(UNITS);
/** How the unit of an amount is written: «60 €/día», «1.200 €/mes», «4.000 € en total». */
const UNIT_TXT = {hour:'€/h',day:'€/día',month:'€/mes',year:'€/año',total:'€ en total'};

/**
 * Parts of what you earn, in the order they appear in the bar, the legend and the breakdown.
 * `label` goes in the legend; `longLabel`, in the breakdown. Payroll joins salary and extra payments; paid vacation is separate.
 */
const PARTS = [
  // money you are paid every month
  {k:'payroll', color:'--c-pay',      label:'Nómina',   longLabel:'Nómina neta',                       v:c=>c.base+c.extraPays, money:true},
  {k:'b',      color:'--c-cash',      label:'Negro',      longLabel:'En negro',                          v:c=>c.b,             money:true},
  {k:'km',     color:'--c-km',     label:'Km',    longLabel:'Kilometraje pagado',                v:c=>c.km,            money:true},
  // the rest: at the end, in kind and unemployment benefit
  {k:'vacationPay', color:'--c-vac',    label:'Vacaciones', longLabel:'Vacaciones pagadas', v:c=>c.vacationPay},
  {k:'severance',  color:'--c-sev',  label:'Indemnización', longLabel:'Indemnización por fin de contrato', v:c=>c.severance},
  {k:'housing',   color:'--c-housing',    label:'Casa',          longLabel:'Casa que te ponen',                 v:c=>c.housing},
  {k:'food', color:'--c-food', label:'Comida',        longLabel:'Comida que te dan',                 v:c=>c.food},
  {k:'unemployment',   color:'--c-unemp',   label:'Paro', longLabel:'Paro que generas',               v:c=>c.unemployment},
];
const incomeOf = r=>PARTS.reduce((s,t)=>s+t.v(r.comp),0);
/** Colour swatch of a part, or the hatching for expenses. */
const swatch = color=>color==='expense'?'<span class="sw expense"></span>':`<span class="sw" style="background:var(${color})"></span>`;
/** Legend of the bars, with only the segments that appear. */
function legendHTML(rs){
  const present=PARTS.filter(t=>rs.some(r=>t.v(r.comp)>0.5));
  return `<p class="legend">${present.map(t=>`<span>${swatch(t.color)}${t.label}</span>`).join('')}${rs.some(r=>r.expenses>0.5)?`<span>${swatch('expense')}Gastos</span>`:''}</p>`;
}
/**
 * Bar of what you earn: one segment per income and, over the end, hatching for your expenses.
 * What is left unhatched is what you earn. `div` converts figures to the unit; `scale` is what 100 % is worth.
 */
function incomeBarHTML(r,scale,div=1){
  const w=x=>Math.max(0,x/div/scale*100);
  const income=incomeOf(r), expenses=Math.min(r.expenses,income);
  return `<div class="bar" aria-hidden="true">${PARTS.map(t=>t.v(r.comp)>0.5?`<i style="width:${w(t.v(r.comp))}%;background:var(${t.color})"></i>`:'').join('')}${expenses>0.5?`<b class="expense" style="left:${w(income-expenses)}%;width:${w(expenses)}%"></b>`:''}</div>`;
}

const CONTRACTS = {
  temporary: {stat:'Temporal',         phrase:'temporal',         kind:'contrato temporal', pillLabel:'Contrato temporal'},
  seasonal: {stat:'Fijo discontinuo', phrase:'fijo discontinuo', kind:'fijo discontinuo',  pillLabel:'Fijo discontinuo'},
  permanent:     {stat:'Fijo',             phrase:'fijo',             kind:'contrato fijo',     pillLabel:'Contrato fijo'},
  none:  {stat:'Sin contrato',     phrase:'sin contrato ni alta', kind:'sin contrato',   pillLabel:'Sin contrato'},
};
const contract = o => CONTRACTS[o.contract] || CONTRACTS.temporary;
/** Meals you may be given: [field, name, default price (€)]. The price of each is in «Tus datos», field + «P». */
const MEALS = [['mealBreakfast','desayuno',2],['mealSnack','almuerzo',3],['mealLunch','comida',4],['mealDinner','cena',4]];
const mealsGiven = o=>MEALS.filter(([k])=>o[k]);
/** What you save per day on food: the sum of the prices of the meals you are given. */
const foodPerDay = (o,cfg=config)=>mealsGiven(o).reduce((s,[k])=>s+num(cfg[k+'P']),0);
/** Rent you save when housing is provided: the one in «Tus datos», unless the offer sets another for its area. */
const rentPerMonth = (o,cfg=config)=>o.rentValue===''||o.rentValue==null?num(cfg.rentValue):num(o.rentValue);
const mealsListTxt = o=>{const n=mealsGiven(o).map(([,t])=>t);return n.length===MEALS.length?'todas las comidas':n.length?joinAnd(n):''};

/** Values of a new offer. What you are told in the offer (duration, hours, days off, pay) starts empty;
    your own figures (meal prices, car, rent) are in «Tus datos» (DEF_CFG). */
const DEF_OFFER = {name:'',duration:'',durationUnit:'months',hoursPerDay:'',daysOff:'',daysOffUnit:'month',holidays:'no',payType:'net',payAmount:'',payUnit:'month',extraPays:'included',vacation:'included',cashAmount:'',cashUnit:'month',
  contract:'temporary',overnight:'no',housing:'no',rentValue:'',mealBreakfast:false,mealSnack:false,mealLunch:false,mealDinner:false,car:'own',commute:'daily',tripsHome:'',kmHome:'',kmWorkPerDay:'',kmRate:'',
  expenses:'',irpfMode:'auto',irpfManual:2,start:'',year:'',offerOnly:false,cashMode:'amount',payrollMin:false,totalAmount:'',totalUnit:'month'};
/** What applies to every offer: «Tus datos» and «Supuestos del cálculo». */
const YOUR_DATA = {rentValue:350,mealBreakfastP:2,mealSnackP:3,mealLunchP:4,mealDinnerP:4,fuelUse:7,fuelPrice:1.45,wear:0.06,vacationDaysPerYear:30};
const DEF_CFG = {unemployment:true,ssEmp:30.25,others:0,ssPct:6.43,inKind:true,annualHours:1826,overnightPct:25,...YOUR_DATA};

/** Templates to start an offer. */
const TPL = [
  {k:'summer',t:'Puerto',d:'Verano en el monte. Duermes en la borda; bajas cuando libras.',s:'Fijo discontinuo · duermes en borda · vives allí',
   v:{contract:'seasonal',durationUnit:'months',overnight:'yes',housing:'no',commute:'liveIn'}},
  {k:'season',t:'Temporada con casa',d:'Invernada u otra zona: varios meses con casa y libranzas.',s:'Temporal · con casa · vives allí',
   v:{contract:'temporary',durationUnit:'months',overnight:'no',housing:'yes',commute:'liveIn'}},
  {k:'harvest',t:'Campaña o jornales',d:'Unos días o semanas a jornal: esquileo, partos, días sueltos.',s:'Temporal · por días · cobras por día, en limpio · vuelves cada día',
   v:{contract:'temporary',durationUnit:'days',payType:'net',payUnit:'day',commute:'daily'}},
  {k:'permanent',t:'Fijo todo el año',d:'Contrato anual en una explotación. Vuelves a casa cada día.',s:'Fijo · 12 meses · cobras al mes · vuelves cada día',
   v:{contract:'permanent',durationUnit:'months',duration:12,payUnit:'month',commute:'daily'}},
];

/** When each form field is shown (the data-show attribute in the HTML). */
const SHOW = {
  withDuration:   o=>o.durationUnit!=='unknown',
  withDate:      o=>!!o.start,
  hasExtraPays:    o=>!o.payrollMin&&!['year','total'].includes(o.payUnit),
  fixedPayroll:       o=>!o.payrollMin,
  cashByTotal:        o=>fromTotal(o),
  cashByAmount:        o=>!fromTotal(o),
  overnight:      o=>o.overnight==='yes',
  showRent:     o=>o.housing==='yes',
  showMeals:   o=>mealsGiven(o).length>0,
  mealBreakfast:o=>!!o.mealBreakfast, mealSnack:o=>!!o.mealSnack, mealLunch:o=>!!o.mealLunch, mealDinner:o=>!!o.mealDinner,
  trips:        o=>o.car!=='noCar',
  tripsHome:       o=>o.car!=='noCar'&&o.commute==='liveIn',
  ownCar:   o=>o.car==='own',
  noCar:      o=>o.car==='noCar',
  kmRate:      o=>o.car==='own'&&num(o.kmWorkPerDay)>0,
  irpfManual:    o=>o.irpfMode==='manual',
  withContract:   o=>o.contract!=='none',
  noContract:   o=>o.contract==='none',
};

/** Storage keys (do not change them: saved data would be lost). */
const KEY = {backup:'cj.copia', backupNotice:'cj.copiaAviso', offers:'cj.ofertas', active:'cj.active', cfg:'cj.cfg', cmpUnit:'cj.unidadCmp', tab:'cj.tab', ts:'cj.ts', uploaded:'cj.enCuenta', folds:'cj.secs', legacyFolds:'cj.plegados', legacyDraft:'cj.draft'};
