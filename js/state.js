'use strict';
/* State: the offers, the active offer, settings and preferences, and saving them to the browser. */

const store = {
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},
};

/** Completes a saved offer and brings offers from earlier versions to the current format. */
function norm(o){
  o=offerFromSpanish(o);
  const x={...DEF_OFFER,...o};
  if(o&&o.daysOff===undefined&&o.legacyDaysPerWeek!==undefined){x.daysOff=Math.max(0,7-Number(o.legacyDaysPerWeek));x.daysOffUnit='week'}
  if(o&&o.commute===undefined&&o.legacyTripsPerWeek!==undefined) x.commute='liveIn';
  if(['legacyOnDaysOff','manual','legacyNever'].includes(x.commute)) x.commute='liveIn'; // it used to count trips home on days off as well
  if(x.car==='legacyCompanyCar'){ x.car='own'; x.kmWorkPerDay=''; x.kmRate='' } // before: a company car for work
  if(o&&o.legacyInKind&&o.housing===undefined){x.housing='yes';x.rentValue=o.legacyInKind}
  if(o&&o.mealBreakfast===undefined&&o.food!==undefined){ // before: no / some (the midday one) / all
    x.mealBreakfast=x.mealSnack=x.mealDinner=o.food==='yes'; x.mealLunch=o.food==='yes'||o.food==='partial';
  }
  if(o&&o.mealSnack===undefined&&o.mealBreakfast&&o.mealLunch&&o.mealDinner) x.mealSnack=true; // you had all of them: they are still all
  if(o&&o.legacyMealValue!==undefined&&o.mealBreakfastP===undefined){ // before, one price for a whole day: it is split like the defaults
    const tot=MEALS.reduce((t,c)=>t+c[2],0);
    for(const [k, ,def] of MEALS) x[k+'P']=Math.max(1,Math.round(num(o.legacyMealValue)*def/tot)); // in round euros (they then move to «Tus datos»)
  }
  // Before, «the minimum on payroll and the rest in cash» was one checkbox: now they are two separate choices
  if(o&&o.legacySplit){ x.cashMode='total'; x.payrollMin=true }
  delete x.legacySplit;
  delete x.legacyDaysPerWeek;delete x.legacyTripsPerWeek;delete x.legacyInKind;delete x.food;delete x.block;delete x.legacyTimesPerMonth;delete x.legacyMealValue;
  return x;
}
/** Meal, car, rent and vacation-day prices used to be stored in each offer. Now they are in «Tus datos»:
    the most common value among the offers is taken. Rent stays in the offer only if it differs. */
function extractYourData(list,cfg,migrate){
  const mostCommon=vals=>{const c=new Map();for(const v of vals)c.set(v,(c.get(v)||0)+1);let m,n=0;for(const [v,k] of c)if(k>n){m=v;n=k}return m};
  if(migrate) for(const k in YOUR_DATA){
    const withHousing=k==='rentValue'?list.filter(o=>o.housing==='yes'):list;
    const vals=(withHousing.length?withHousing:list).map(o=>o[k]).filter(v=>v!==undefined&&v!==''&&!isNaN(num(v))).map(num);
    if(vals.length) cfg[k]=mostCommon(vals);
  }
  for(const o of list){
    for(const k in YOUR_DATA) if(k!=='rentValue') delete o[k];
    if(o.rentValue!==''&&(o.housing!=='yes'||num(o.rentValue)===num(cfg.rentValue))) o.rentValue='';
  }
  return list;
}
const newId = ()=>'o'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const makeOffer = (extra={})=>({...DEF_OFFER,id:newId(),name:'Oferta 1',cmp:true,...extra});

const savedCfg = cfgFromSpanish(store.get(KEY.cfg,{}));
let config = {...DEF_CFG,...savedCfg};
// The old 31.5 % was the general scheme; shepherds are in the agricultural one (30.25 %). If you had not changed it, it is updated
if(config.ssEmp===31.5) config.ssEmp=DEF_CFG.ssEmp;
if(config.ssPct===6.5) config.ssPct=DEF_CFG.ssPct; // same for the worker's rate: 6.5 % before, 6.43 % on your payslip
let cmpUnit = (u=>LEGACY.units[u]??u)(store.get(KEY.cmpUnit,'hour')); if(!UNITS[cmpUnit]) cmpUnit='hour'; // the Comparar unit: per hour is the fairest between different workdays

let offers = store.get(KEY.offers,null);
const firstRun = !Array.isArray(offers);
offers = firstRun ? [] : offers.map(norm);
const migrateData = !firstRun&&savedCfg.fuelUse===undefined;
extractYourData(offers,config,migrateData);
// Older versions kept the offer being edited separately
const legacyDraft = offerFromSpanish(store.get(KEY.legacyDraft,null));
if(legacyDraft&&legacyDraft.id&&offers.some(x=>x.id===legacyDraft.id)) offers=offers.map(x=>x.id===legacyDraft.id?{...extractYourData([norm(legacyDraft)],config,false)[0],cmp:x.cmp}:x);
if(!offers.length) offers=[makeOffer()];
/** On first run there is a placeholder offer that is replaced by the template you pick. */
let placeholderId = firstRun ? offers[0].id : null;
let activeId = store.get(KEY.active,null) || (legacyDraft&&legacyDraft.id) || offers[0].id;
if(!offers.some(x=>x.id===activeId)) activeId=offers[0].id;
/** The active offer: the form edits it directly and it is saved on every change. */
let active = offers.find(x=>x.id===activeId);

const myOffers = ()=>offers.filter(o=>o.id!==placeholderId);
let persistRequested=false;
// Announces every saved change (used by the Claude account sync set up further down)
let onChange=()=>{}, inCloud=false;
function persist(){
  store.set(KEY.offers,offers); store.set(KEY.active,activeId); onChange();
  if(!persistRequested&&!placeholderId){ persistRequested=true; try{ navigator.storage?.persist?.().catch(()=>{}) }catch(e){} } // so the browser does not delete them when short of space
}
function saveCfg(){ store.set(KEY.cfg,config); onChange() }
if(legacyDraft){ store.set(KEY.legacyDraft,null); persist() }
if(migrateData){ saveCfg(); persist() }

/** Effective unit: without a duration there is no total, so it is shown per month. */
const conv = (x,r,u)=>{const dv=UNITS[u].div(r);return dv>0?x/dv:0};
const fU = (x,u)=>fE(x,UNITS[u].dec||undefined);
/** Approximate net of a gross figure of this offer (what reaches you). The gross is kept for reference. */
const netFactor = r=>r.fac>0?r.fac:1-config.ssPct/100;
/**
 * How an offer's money is written in the chosen unit:
 * inUnit(x) the figure as it is · net(x) a gross figure converted to net · netWithTip(x) the net, with the gross on tap ·
 * netAll(x) net, without converting to the unit.
 */
function money(r,u){
  const f=netFactor(r), inUnit=x=>fU(conv(x,r,u),u), net=x=>inUnit(x*f);
  // red(x): the figure in the unit, already rounded as it is written; with it the rows of a calculation add up on screen
  // (per hour and per day, with cents; per month and in total, in euros)
  const dd=u==='hour'||u==='day'?2:0, k=10**dd, red=x=>Math.round(conv(x,r,u)*k)/k;
  return {u, inUnit, net, red, fmt:v=>fE(v,dd), netWithTip:x=>withTip(net(x),`${inUnit(x)} brutos en nómina`), netAll:(x,d=0)=>fE(x*f,d)};
}
/** For contracts shorter than a month, «per month» is an extrapolation. */
const extrap = r=>!r.noDuration&&r.months<0.97;
