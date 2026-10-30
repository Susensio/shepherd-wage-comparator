'use strict';
/* Rendering: the Comparar unit picker, the offer chips and the offer form. */

/** «Comparar por»: the unit that sorts and measures the Comparar cards. */
function unitPickerHTML(){
  return `<div class="view"><span class="view-l">Comparar por</span><div class="seg" role="radiogroup" aria-label="Comparar por">${UNIT_ORDER.map(u=>
    `<label><input type="radio" name="cmpUnit" value="${u}"${u===cmpUnit?' checked':''}>${UNITS[u].sel}</label>`).join('')}</div></div>`;
}

/** Fades the edge of the offer chips on the side where there are more, to show they can be scrolled.
    It follows the position: it grows as you scroll, up to 28 px. */
function chipEdges(){
  const c=$('#chips'), max=Math.max(0,c.scrollWidth-c.clientWidth), F=28;
  c.style.setProperty('--fade-l',Math.min(F,c.scrollLeft)+'px');
  c.style.setProperty('--fade-r',Math.min(F,max-c.scrollLeft)+'px');
}
$('#chips').addEventListener('scroll',chipEdges,{passive:true});
/** Your offers in order: most recent start date first; those without a date at the end, in the order you created them. */
const sortedOffers = ()=>[...myOffers()].sort((a,b)=>(b.start||'').localeCompare(a.start||''));
function renderChips(){
  const chips=$('#chips'), keep=chips.scrollLeft;
  chips.innerHTML=sortedOffers().map(o=>{const incomplete=missing(o).length>0;
    return `<button type="button" class="chip${incomplete?' incomplete':''}" data-action="choose" data-id="${o.id}" aria-current="${o.id===activeId}"${incomplete?' title="Le faltan datos"':''}>
    <span class="cn">${esc(o.name||'Sin nombre')}</span></button>`}).join('');
  $('nav.offers').hidden=!!placeholderId; $('#welcome').hidden=!placeholderId; $('#intro').hidden=!!placeholderId;
  chips.scrollLeft=keep; chipEdges();
  const cur=$('#chips [aria-current="true"]');
  if(cur&&renderChips.scroll){ // keep the active offer in view
    const l=cur.offsetLeft-chips.offsetLeft;
    if(l<chips.scrollLeft||l+cur.offsetWidth>chips.scrollLeft+chips.clientWidth) chips.scrollLeft=Math.max(0,l-16);
    renderChips.scroll=false;
  }
}

/* --- form --- */
const form=$('#f');
/** A date as a date input wants it: 2026-06-21. */
const isoOf=d=>d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:'';
/** The end date, always calculated from start + duration (not saved: so they cannot contradict each other). */
const paintEnd=o=>{ const f=$('#end'); if(f&&document.activeElement!==f) f.value=isoOf(endOf(o)) };
function fill(o){
  paintEnd(o);
  for(const el of form.elements){
    if(!el.name) continue;
    if(el.type==='radio') el.checked=String(o[el.name])===el.value;
    else if(el.type==='date') el.value=o[el.name]||'';
    else if(el.type==='checkbox') el.checked=!!o[el.name];
    else if(el.type==='text') el.value=el.name==='name'?(o.name||''):o[el.name]===''?'':fIn(num(o[el.name]),0,2);
  }
}
const showers=$$('[data-show]').map(el=>[el,SHOW[el.dataset.show]]);
let animateFields=false; // only when the form is touched, not when switching offers or at startup
function applyShow(r){
  for(const [el,fn] of showers){
    const view=!!fn(active,r), appears=el.hidden&&view;
    el.hidden=!view;
    if(appears&&animateFields) fadeIn(el);
  }
  animateFields=false;
}

/** What changes in the form on recalculation: visible fields, summaries and hints. */
function renderForm(r){
  const o=active;
  applyShow(r); markMissing();
  $('#vacationHint').textContent=o.vacationAuto&&o.vacation==='paidAtEnd'?'Marcado de forma automática: en un contrato de menos de un mes no da tiempo a disfrutarlas y lo normal es que te las paguen aparte al acabar. Cámbialo si no es así.':'';
  const rs=summaries(o,r);
  $('#editInfo').innerHTML=[['Tiempo',rs.time],['Nómina',rs.payroll],['En negro',rs.b],['Casa y comida',rs.housing],['Coche',rs.car],['Contrato',contract(o).stat]]
    .filter(Boolean).map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  for(const k in rs){ const el=$('#sum-'+k); if(el) el.textContent=rs[k] }
  const uTxt={day:'/día trabajado',month:'/mes',year:'/año',total:' en total'}[o.payUnit];
  const withholdingTxt=o.irpfMode==='manual'?'':o.contract==='temporary'&&r.irpfPct*100<LAW.irpf.withholding+0.05?' (la mínima de los eventuales agrarios)':'';
  const refund=r.irpf-r.irpfYear;
  $('#payHint').textContent=num(o.payAmount)>0
    ? (o.payType==='net'
        ? `Unos ${fE(r.payGross)} brutos${uTxt}: ${fN(config.ssPct,2)} % de Seguridad Social y ${fN(r.irpfPct*100,1)} % de IRPF${withholdingTxt}.`
        : `Unos ${fE(r.payNet)} netos${uTxt}: ${fN(config.ssPct,2)} % de Seguridad Social y ${fN(r.irpfPct*100,1)} % de IRPF${withholdingTxt}.`)
      +(refund>1?` En la renta te devolverían unos ${fE(refund)} (no contado).`:'')
      +(o.payUnit==='day'?' El jornal en nómina cubre también vacaciones y festivos librados.':'')
    : '';
  if(num(o.payAmount)>0&&o.payUnit==='total'&&o.vacation==='paidAtEnd') $('#payHint').textContent+=' Pon lo que cobraste sin las vacaciones: las vacaciones pagadas se suman aparte.';
  const rp=r.split;
  if(o.payrollMin&&o.contract!=='none') $('#payHint').textContent=`En nómina, el mínimo${r.casual?' de temporero (el contrato dura 120 días o menos)':''}: unos ${fE(r.minSalary/r.months)} brutos al mes, ${fE(r.minSalary/r.months*netFactor(r))} netos.`;
  // The calculation, over the whole contract: vacation is paid once (at the end), not every month
  const tot=x=>fE(x), mT=rp?(rp.u==='day'?r.daysWorked:rp.u==='month'?r.months:1):1;
  $('#cashAuto').textContent=!rp?'':!(rp.T>0)?'Lo de en negro es lo que queda del total pactado tras la nómina y las vacaciones.'
    :rp.shortfall?`El total pactado no llega ni a la nómina (${tot((rp.incl?rp.net:rp.payrollNet)*mT)} netos): no queda nada en negro.`
    :`${tot(rp.T*mT)} pactados − ${tot(rp.payrollNet*mT)} de nómina${rp.vacationNet>0.5&&rp.incl?` − ${tot(rp.vacationNet*mT)} de vacaciones`:''} = ${tot(rp.cashTotal)} en negro${rp.u!=='total'&&!r.noDuration?` (${fSplit(rp.b,rp.u)})`:''}.${rp.vacationNet>0.5&&!rp.incl?` Las vacaciones (${tot(rp.vacationNet*mT)}), aparte.`:''} Todo en neto.`;
  $('#mealsHint').textContent=mealsGiven(o).length?`Te ahorras ${fE(foodPerDay(o),foodPerDay(o)%1?2:0)} por día trabajado. Los precios, en «Tus datos».`:'';
  $('#rentValue').placeholder=fIn(num(config.rentValue),0);
  $('#rentHint').textContent=`Vacío: ${fE(num(config.rentValue))}, el de «Tus datos». Pon otro si aquí el alquiler es más caro o más barato, y 0 si sigues pagando tu casa mientras tanto.`;
  const S=SMI[r.year], yr=actualYear(o);
  $('#yearHint').textContent=`${o.start?'':'Sin fecha, se toma '+yr+'. '}${yr!==Number(r.year)?`El salario mínimo de ${yr} aún no está en la página: se usa el de ${r.year}. `:''}Salario mínimo de ${r.year}: ${fE(S.annual)} al año (${fE(S.annual/14)} en 14 pagas), o ${fE(S.casual,2)} por jornada en temporales de 120 días o menos (${S.rd}).`;
  const overlap=overlapsOf(o);
  $('#overlapHint').textContent=overlap.length?`Coincide en fechas con ${joinAnd(overlap.map(p=>`«${p.name}»`))}. Si una solo era una oferta que no trabajaste, márcalo en ella: así no se suman las dos en el año ni en el IRPF.`:'';
  $('#daysOffHint').textContent=r.months<=0?'':o.daysOffUnit==='total'&&!r.noDuration
    ? `En todo el contrato trabajas unos ${fN(r.daysWorked)} días y libras ${fCount(r.daysOffTotal)}${[o.holidays==='yes'&&'los festivos',r.vacationTaken>0&&'las vacaciones'].filter(Boolean).map((t,i,a)=>(i?' y ':', más ')+t).join('')}. Son unas ${fN(r.hoursPerWeek)}\u00a0h a la semana.`
    : `Trabajas unos ${fN(r.workedPerMonth)} días al mes y libras ${fCount(r.daysOffMonth)}${o.holidays==='yes'?', más los festivos':''}. Son unas ${fN(r.hoursPerWeek)}\u00a0h a la semana.`;
  const commuteTxt={daily:'ida y vuelta cada día trabajado',liveIn:`al empezar y al acabar${num(o.tripsHome)>0?', y cuando bajas a casa':''}`};
  $('#carHint').textContent=(o.car==='noCar'
    ? 'Sin coche propio: no se cuentan gasolina ni desgaste.'
    : r.km>0?`Con tu coche: unos ${fN(r.months>0?r.km/r.months:0)}\u00a0km al mes (${commuteTxt[o.commute]}${o.car==='own'&&num(o.kmWorkPerDay)>0?', más lo que mueves trabajando':''}). Consumo y gasolina, en «Tus datos».`:'');
}
