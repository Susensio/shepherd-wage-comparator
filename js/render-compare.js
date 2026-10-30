'use strict';
/* Rendering: the Comparar tab (ranking, medals, head to head, weekly hours, trend and years). */

/** How much of what you receive is cash: all on payroll (green), part (amber) or all in cash (black). */
const cashTxt=r=>r.B<=0.5?'<span class="payroll">todo en nómina</span>':r.noContract||r.cashShare>=0.995?'<span class="cash">todo en negro</span>':`<span class="part">${fN(r.cashShare*100)}\u00a0% en negro</span>`;
/** What is legal about an offer, in two words, for the Comparar rows. */
// It does not just say «no cumple» (almost none complies): it says what fails, which is what tells them apart.
// Working hours are not listed here: the hours per week already show them, in their colour.
const legalShort=(o,r)=>{const f=failuresOf(o,r); if(!f) return '';
  const others=f.filter(t=>t!=='Jornada');
  return others.length?`<span class="bad">✘ ${joinAnd(others.map(t=>LAW_SHORT[t]||t))}</span>`:f.length?'':'<span class="ok">✔ cumple</span>'};

/**
 * Comparar: the ranking in the chosen unit (tap a row to see the offer),
 * the best at each thing and the weekly hours.
 */
function renderCompare(){
  const U=UNITS[cmpUnit], key=U.key;
  const sv=r=>{const v=key==='total'&&r.noDuration?NaN:r[key];return isFinite(v)?v:-1e12}; // without a duration there is no total: at the end
  const L=myOffers().filter(o=>!missing(o).length).map(o=>({o,r:calc(o)})).sort((a,b)=>sv(b.r)-sv(a.r));
  if(L.length<2){
    $('#cmpView').innerHTML='';
    $('#cmpBlk').innerHTML=`<p class="empty">${myOffers().length<2?'Añade otra oferta con «+ Nueva» para compararlas.':`Para compararlas hacen falta dos ofertas completas. ${myOffers().filter(o=>missing(o).length).map(o=>`A «${esc(o.name||'Oferta')}» le falta ${joinAnd(missing(o))}.`).join(' ')}`}</p>`;
    return;
  }
  $('#cmpView').innerHTML=unitPickerHTML();
  const ext=r=>cmpUnit==='month'&&extrap(r); // contracts shorter than a month: «al mes» is at this rate
  const figure=r=>sv(r)<=-1e11?'–':fU(r[key],cmpUnit)+(key==='total'?'':U.suf)+(ext(r)?'*':'');
  // Colour bars like the offer's, in the same unit: what is left unhatched is the row's figure
  const dv=r=>{const d=cmpUnit==='total'&&r.noDuration?r.months:U.div(r);return d>0?d:1};
  const max=Math.max(...L.map(({r})=>incomeOf(r)/dv(r)),1e-9);
  const medalMap=medals(L);
  const rows=L.map(({o,r},n)=>{const debt=r.owed*netFactor(r), el=pair.includes(o.id);
    const btnAttrs=pairMode?`class="lr pickable${el?' picked':''}" data-action="pickPair" aria-pressed="${el}"`:'class="lr" data-action="view"';
    return `<button type="button" ${btnAttrs} data-id="${o.id}"><span class="n">${pairMode?(el?'●':'○'):n+1}</span><b>${esc(o.name)}${o.offerOnly?' <small>(solo oferta)</small>':''}</b><span class="v">${figure(r)}</span>
      ${medalMap[o.id]?.length?`<span class="medals">${medalMap[o.id].map(t=>`<span>${t}</span>`).join('')}</span>`:''}${incomeBarHTML(r,max,dv(r))}
      <span class="det">${r.noContract?'':cashTxt(r)}${legalShort(o,r)}<span class="${r.hoursPerWeek<=H_ORDINARY?'':r.hoursPerWeek<=H_MAX?'warn':'bad'}">${fN(r.hoursPerWeek)} h/sem</span>${debt>1?`<span class="bad">te deben ${extrap(r)?`${fE(debt)} en total`:`${fE(conv(debt,r,'month'))} al mes`}</span>`:''}</span></button>`}).join('');
  const modeHTML=pairMode?`<div class="cmp-mode"><span>${pair.length===2?'Comparando:':pair.length?'Marca otra oferta.':'Marca dos ofertas.'}</span><button type="button" class="linkbtn" data-action="closePair">Cancelar</button></div>`
    :`<div class="cmp-mode"><span>Toca una oferta para verla.</span><button type="button" class="sm" data-action="startPair">Comparar dos</button></div>`;
  $('#cmpBlk').innerHTML=`${legendHTML(L.map(x=>x.r))}${modeHTML}<div class="lst">${rows}</div>
    ${L.some(x=>ext(x.r))?'<p class="hint">* Menos de un mes: lo que ganarías a ese ritmo en un mes entero.</p>':''}
    ${headToHeadHTML(L)}${hoursHTML(L)}`;
}

/**
 * Medals: what each offer is best at, only with data that can be compared even if durations differ
 * (no totals). If more than half tie, that medal is not given: it tells nobody apart.
 */
function medals(L){
  const out={}, M=[
    cmpUnit!=='hour'&&[x=>x.r.perHour,'max','más por hora'], [x=>x.r.hours>0?(x.r.savings.daysUnpaid+x.r.savings.overtimeUnpaid)/x.r.hours:0,'min','menos sin pagar'],
    [x=>x.r.hoursPerWeek,'min','menos horas'], [x=>x.r.daysOffMonth,'max','más días libres'], [x=>x.r.cashShare,'min','menos en negro']];
  for(const [f,m,t] of M.filter(Boolean)){
    const v=L.map(f), best=m==='max'?Math.max(...v):Math.min(...v), emp=L.filter((x,i)=>Math.abs(v[i]-best)<0.005);
    if(emp.length>L.length/2) continue;
    if(t==='menos en negro'&&best<=0.005) continue; // with nothing in cash, «todo en nómina» already says it
    emp.forEach(x=>(out[x.o.id]??=[]).push(t));
  }
  return out;
}

/** Head to head: the two offers picked in «Comparar dos» mode, row by row and in blocks; the better one in each row, in green. */
let pair=[], pairMode=false; // not saved: every time starts without comparing
function headToHeadHTML(L){
  if(!pairMode||L.length<2) return '';
  pair=pair.filter(id=>L.some(x=>x.o.id===id)); // in case one has been deleted
  if(pair.length<2) return '';
  const [a,b]=pair, A=L.find(x=>x.o.id===a), B=L.find(x=>x.o.id===b);
  const debt=x=>x.r.owed>1?x.r.owed*netFactor(x.r):0;
  // Totals are only compared if both last about the same (less than 10 % apart): otherwise the longer one always wins
  const similar=!A.r.noDuration&&!B.r.noDuration&&Math.abs(A.r.natDays-B.r.natDays)<=0.1*Math.max(A.r.natDays,B.r.natDays);
  const durationTxt=x=>x.r.noDuration?'sin saber':x.o.durationUnit==='days'?`${fInput(x.o.duration)} días`:`${fInput(x.o.duration)} ${num(x.o.duration)===1?'mes':'meses'}`;
  // Blocks of [what, value, format, best: 'max', 'min' or '' (information, no winner)]
  const G=[
    ['Dinero',[
      ['Ganas por hora',x=>x.r.perHour,v=>fE(v,2),'max'],
      ['Ganas al mes',x=>x.r.noDuration||!extrap(x.r)?x.r.perMonth:NaN,v=>isFinite(v)?fE(v):'–','max'],
      ['Te entra al mes',x=>x.r.noDuration||!extrap(x.r)?receivedOf(x.r)/(x.r.months||1):NaN,v=>isFinite(v)?fE(v):'–','max'],
      similar&&['Ganas en total',x=>x.r.noDuration?NaN:x.r.total,v=>isFinite(v)?fE(v):'–','max'],
      similar&&['Te entra en total',x=>x.r.noDuration?NaN:receivedOf(x.r),v=>isFinite(v)?fE(v):'–','max'],
    ]],
    ['Tiempo',[
      !similar&&['Duración',x=>x.r.noDuration?NaN:x.r.natDays,(v,x)=>durationTxt(x),''],
      ['Horas a la semana',x=>x.r.hoursPerWeek,v=>fN(v)+' h','min'],
      ['Jornadas sin pagar',x=>unpaidTime(x.r).d,v=>v>=0.5?fCount(v):'ninguna','min'],
      ['Horas extra sin pagar, a la semana',x=>unpaidTime(x.r).h,v=>v>=0.5?fN(v)+' h':'ninguna','min'],
      ['Días libres al mes',x=>x.r.daysOffMonth,v=>fCount(v),'max'],
    ]],
    ['Derechos',[
      ['En negro',x=>x.r.cashShare,v=>v<=0.005?'nada':fN(v*100)+' %','min'],
      ['Te deben',debt,v=>v>1?fE(v):'nada','min'],
      similar&&['Paro que genera',x=>x.r.unemploymentDays,v=>v>=0.5?fN(v)+' días':'nada','max'],
    ]],
  ];
  // Rows where both are the same are not shown (they do not help decide); a block without rows, neither
  const rows=G.map(([config,F])=>{const h=F.filter(Boolean).map(([t,f,fmt,m])=>{const va=f(A), vb=f(B), ta=fmt(va,A), tb=fmt(vb,B); if(ta===tb) return '';
    let w=''; if(m&&isFinite(va)&&isFinite(vb)) w=(m==='max'?va>vb:va<vb)?'a':'b';
    return `<tr><th>${t}</th><td class="${w==='a'?'wins':''}">${ta}</td><td class="${w==='b'?'wins':''}">${tb}</td></tr>`}).join('');
    return h&&`<tr class="group"><th colspan="3">${config}</th></tr>${h}`}).join('');
  const header=x=>`<th><button type="button" class="linkbtn" data-action="view" data-id="${x.o.id}">${esc(x.o.name)}</button></th>`;
  return `<div class="pair" id="pairBlk"><div class="pair-head"><h4 class="sub">Cara a cara</h4><button type="button" class="linkbtn" data-action="closePair">Cerrar</button></div>
    <table class="table pair-t"><thead><tr><th></th>${header(A)}${header(B)}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** Hours per week: the normal workday ones and, in a stronger colour, the extra ones (extra days and overtime). */
function hoursHTML(L){
  const cap=Math.max(...L.map(x=>x.r.hoursPerWeek)), pc=v=>v/cap*100;
  const rows=[...L].sort((a,b)=>a.r.hoursPerWeek-b.r.hoursPerWeek).map(({o,r})=>{
    const sem=(r.noDuration?DM:r.natDays)/7, h=r.hoursPerWeek, extra=Math.min(h,sem>0?r.tmHours/sem:0), norm=h-extra;
    return `<button type="button" class="hr" data-action="view" data-id="${o.id}"><b>${esc(o.name)}</b><span class="v">${fN(h)} h</span>
      <span class="hbar"><i class="ok" style="left:0;width:${pc(norm)}%"></i>${extra>=0.5?`<i class="unpaid" style="left:${pc(norm)}%;width:${pc(extra)}%"></i>`:''}</span></button>`}).join('');
  return `<h4 class="sub">Horas a la semana</h4><div class="lst hours">${rows}</div>
    <p class="hint">En color, las horas de más: jornadas de más y horas extra.</p>`;
}

/** «Cuándo»: what you are paid over time and each year's summary. Only with dated offers. */
function renderTimeline(){
  const present=myOffers().some(o=>o.start);
  $('#tlBlk').hidden=!present;
  $('#trend').innerHTML=present?trendHTML():''; $('#yearly').innerHTML=present?yearlyHTML():'';
}

/** A «round» axis step: 1, 2, 2.5 or 5 times a power of 10. */
const axisStep=x=>{const p=10**Math.floor(Math.log10(x||1)), m=x/p;return p*(m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10)};
/** Approximate net of the minimum wage (only the worker's Social Security). */
const netFactorMin=(cfg=config)=>1-cfg.ssPct/100;
/**
 * What you earn over time, in the «Comparar por» unit: one line,
 * a segment per job from its first to its last day and, between them, a faint curve. The axis fits your figures.
 */
function trendHTML(){
  const u=cmpUnit, f=netFactorMin(), DAY_MS=864e5, divU=r=>u==='hour'?r.hours:u==='day'?r.daysWorked:u==='month'?r.months:1;
  const smiA=o=>SMI[yearOf(o)].annual, overnight=o=>o.overnight==='yes'?1+config.overnightPct/100:1;
  const minPerUnit=(o,r)=>(u==='hour'?smiA(o)/config.annualHours:u==='day'?smiA(o)/config.annualHours*LAW.workdayHours:u==='month'?smiA(o)/12:(r.minSalary+r.minVacation)/overnight(o))*overnight(o)*f;
  const P=myOffers().filter(o=>o.start&&!missing(o).length).map(o=>{
      const r=calc(o), d=divU(r), [a,end]=span(o), m=minPerUnit(o,r);
      return {o,r,a:+a,b:+end+DAY_MS,m,y:d>0?r.total/d:NaN};
    }).filter(p=>isFinite(p.y)&&p.m>0&&!(u==='total'&&p.r.noDuration)).sort((x,y)=>x.a-y.a);
  if(!P.length) return '';
  const W=Math.max(280,Math.round($('#cmpBlk').clientWidth||360)), H=180, M={l:52,r:10,t:22,b:24};
  let x0=Math.min(...P.map(p=>p.a)), x1=Math.max(...P.map(p=>p.b)); const pad=Math.max((x1-x0)*0.03,5*DAY_MS); x0-=pad; x1+=pad;
  const y0a=new Date(x0).getFullYear(), y1a=new Date(x1).getFullYear(), years=[]; for(let y=y0a;y<=y1a;y++) years.push(y);
  // axis fitted to your figures: it does not start at 0
  const ymin=Math.min(...P.map(p=>p.y)), ymaxv=Math.max(...P.map(p=>p.y)), step=axisStep((ymaxv-ymin)/4||ymaxv/8||1);
  const lo=Math.max(0,Math.floor(ymin/step)*step-step), hi=Math.ceil(ymaxv/step)*step+step;
  const X=v=>M.l+(v-x0)/(x1-x0)*(W-M.l-M.r), Y=v=>H-M.b-(v-lo)/(hi-lo)*(H-M.t-M.b);
  const fe=v=>fE(v,u==='hour'?2:0);
  let svg='';
  for(let v=lo;v<=hi+1e-9;v+=step) svg+=`<line class="grid" x1="${M.l}" x2="${W-M.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${M.l-6}" y="${Y(v)+4}" text-anchor="end">${fN(v,v%1?1:0)} €</text>`;
  years.forEach(y=>{const a=Math.max(x0,+new Date(y,0,1)), b=Math.min(x1,+new Date(y+1,0,1));
    if(years.length>1) svg+=`<text class="axis" x="${X((a+b)/2)}" y="${H-6}" text-anchor="middle">${y}</text>`;});
  if(years.length===1) svg+=`<text class="axis" x="${M.l}" y="${H-6}" text-anchor="start">${fDate(new Date(x0+pad))}</text><text class="axis" x="${W-M.r}" y="${H-6}" text-anchor="end">${fDate(new Date(x1-pad-DAY_MS))}</text>`;
  const jobs=P.filter(p=>!p.o.offerOnly), offerOnlyPts=P.filter(p=>p.o.offerOnly), xb=p=>Math.max(X(p.b-DAY_MS),X(p.a)+3);
  const steps=jobs.slice(1).map((p,i)=>{const q=jobs[i], xa=xb(q), ya=Y(q.y), xc=X(p.a), yc=Y(p.y), m=(xa+xc)/2;
    return xc-xa<1?`M${xa},${ya}L${xc},${yc}`:`M${xa},${ya}C${m},${ya} ${m},${yc} ${xc},${yc}`}).join('');
  svg+=`<path class="line step" d="${steps}"/><path class="line" d="${jobs.map(p=>`M${X(p.a)},${Y(p.y)}H${xb(p)}`).join('')}"/>`;
  svg+=offerOnlyPts.map(p=>`<path class="offer-only" d="M${X(p.a)},${Y(p.y)}H${xb(p)}"/>`).join('');
  // each job's name, above its segment
  svg+=P.map(p=>`<text class="nm${p.o.offerOnly?' offer-only-t':''}" x="${(X(p.a)+xb(p))/2}" y="${Y(p.y)-7}" text-anchor="middle">${esc(p.o.name)}</text>`).join('');
  svg+=P.map(p=>{const v=p.y;
    return `<rect class="hit"${tipA(`${p.o.name} · ${datesTxt(p.o)}${p.o.offerOnly?' (solo era una oferta)':''}: ganas ${fe(v)} ${UNITS[u].lbl}, el ${fN(v/p.m*100)} % del mínimo legal${p.o.overnight==='yes'?' con pernocta':''} (${fe(p.m)} en neto, SMI ${yearOf(p.o)}).`)} x="${X(p.a)-4}" y="${Y(p.y)-16}" width="${xb(p)-X(p.a)+8}" height="28"/>`}).join('');
  return `<div class="trend"><h4 class="sub">Lo que ganas ${UNITS[u].lbl}, en el tiempo</h4>
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Lo que ganas ${UNITS[u].lbl} en cada trabajo, en el tiempo">${svg}</svg>
    ${offerOnlyPts.length?'<p class="hint">En raya, las que solo eran ofertas.</p>':''}</div>`;
}

/** What was worked each year: days, money, what you earn and contributions. */
function yearlyHTML(){
  // Each contract is split by days between the years it touches
  const A={};
  for(const o of workedOffers()){ if(missing(o).length||o.durationUnit==='unknown') continue; const r=calc(o);
    for(const [y,f] of Object.entries(yearShares(o))) (A[y]??=[]).push({r,f}) }
  const ys=Object.keys(A).sort().reverse(); if(!ys.length) return '';
  const C=ys.map(y=>{const R=A[y], sum=fn=>R.reduce((s,{r,f})=>s+fn(r)*f,0), money=sum(receivedOf), hours=sum(r=>r.hours);
    return {y,n:R.length,days:sum(r=>r.daysWorked),money,cashPart:sum(r=>r.B),hour:hours>0?money/hours:0,earned:sum(r=>r.total),contrib:sum(r=>r.contrib)}});
  const row=(t,f)=>`<tr><th>${t}</th>${C.map(c=>`<td>${f(c)}</td>`).join('')}</tr>`;
  return `<div class="yearly"><h4 class="sub">Año a año</h4><div class="tablew"><table class="table">
    <thead><tr><th></th>${C.map(c=>`<th>${c.y}<small>${c.n===1?'1 trabajo':c.n+' trabajos'}</small></th>`).join('')}</tr></thead><tbody>
    ${row('Días trabajados',c=>fN(c.days))}
    ${row('Dinero que cobras',c=>fE(c.money))}
    ${C.some(c=>c.cashPart>0.5)?row('de ello, en negro',c=>c.cashPart>0.5?`${fN(c.cashPart/c.money*100)} %`:'—'):''}
    ${row('Dinero por hora',c=>fE(c.hour,2))}
    ${row('Lo que ganas',c=>fE(c.earned))}
    ${row('Días cotizados',c=>fN(c.contrib))}
    </tbody></table></div><p class="hint">Sin las que solo eran ofertas. Si un contrato pasa de un año a otro, se reparte por días.</p></div>`;
}
