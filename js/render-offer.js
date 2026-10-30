'use strict';
/* Rendering: the result of the active offer (earnings, «¿Es legal?», «Para negociar», season end and workings). */

/**
 * Each offer, in a single unit: that of its headline figure. Per month, even if the daily wage is agreed per day; per day only
 * for contracts shorter than a month (the month would be an extrapolation).
 */
function offerUnit(o,r){
  return extrap(r)?'day':'month';
}
/** «al mes», «por día»… or, over the whole contract, «en los 100 días». */
const unitPhrase=(D,r)=>D.u==='total'?`en los ${fN(r.natDays)} días`:UNITS[D.u].short;
/** What you earn in the other units, small under the headline figure. */
function otherUnitsHTML(r,u){
  // For contracts shorter than a month, «al mes» would be a made-up figure: it is not shown
  return `<span class="others">${UNIT_ORDER.filter(k=>k!==u&&!(k==='total'&&r.noDuration)&&!(k==='month'&&extrap(r))).map(k=>`<span><b>${(x=>fN(x,decE(x,UNITS[k].dec||undefined)))(conv(r.total,r,k))}</b> ${UNIT_TXT[k]}</span>`).join('')}</span>`;
}

/** Figure columns: per day and, next to it, per month (for contracts shorter than a month, where «al mes» would be made up, the total). The same for every offer, so they can be compared. */
function columns(D,r){
  const other=extrap(r)?'total':'month', col=(x,u)=>u==='day'?fE(conv(x,r,u),2):fU(conv(x,r,u),u); // per day, with cents: the sums add up
  const two=(a,b)=>`<span class="two"><span>${a}</span><span>${b}</span></span>`;
  return {other, header:two('Día',other==='month'?'Mes':'Total'), v:x=>two(col(x,'day'),col(x,other)), minus:x=>two('−'+col(x,'day'),'−'+col(x,other))};
}

/** Breakdown: from what you are paid to what you earn. Collapsible; open until you fold it. */
function breakdownHTML(o,r,D){
  const {u,inUnit:cu}=D;
  const fuelPerKm=num(config.fuelUse)/100*num(config.fuelPrice);
  const earnTip=`Nómina neta${r.comp.vacationPay>0.5?' + vacaciones pagadas':''}${r.B>0?' + lo que cobras en negro':''}${r.comp.housing>0.5||r.comp.food>0.5?' + lo que te ahorras en casa y comida':''}${r.comp.km>0.5?' + los km que te pagan':''}${r.comp.severance>0.5?' + la indemnización':''}${r.comp.unemployment>0.5?' + el paro que generas':''}${r.expenses>0.5?' − tus gastos de coche y otros':''}, ${({hour:'repartido entre las horas que trabajas',day:'repartido entre los días que trabajas',month:'repartido entre los meses del contrato',total:'en todo el contrato'})[u]}.${r.comp.unemployment>0.5?` El paro lo cobras al juntar ${LAW.unemployment.minDaysContributed} días cotizados.`:config.unemployment===false?' No incluye el paro.':''}`;
  // From gross to net payroll, shown when tapping «Nómina neta» (without paid vacation, which has its own row)
  const netPay=r.comp.base+r.comp.extraPays, grossPay=netPay/(r.fac||1);
  const netPayTip=[
    `Nómina bruta: ${cu(grossPay)}${r.comp.extraPays>0.5?' (con las pagas extra)':''}`,
    `− Seguridad Social (${fN(config.ssPct,1)} %)${r.irpf>0.5?` y retención de IRPF (${fN(r.irpfPct*100,1)} %)`:''}: ${cu(grossPay-netPay)}`,
    `= Nómina neta: ${cu(netPay)}`,
    r.irpf<0.5?'Con lo que ganas en el año no te retienen IRPF.':r.irpf-r.irpfYear>1?`Es la retención: en la renta te devolverían unos ${fE(r.irpf-r.irpfYear)}.`:'Es la retención de IRPF de tu nómina.',
    r.comp.vacationPay>0.5?'Las vacaciones pagadas van en su fila.':'',
  ].filter(Boolean).join('\n');
  const TIP={...explanations(o,r),payroll:netPayTip,
    vacationPay:o.vacation==='included'?`Los ${fCount(r.vacationDays)} días de vacaciones que no disfrutas van dentro de lo que te pagan: unos ${fE(r.comp.vacationPay)} netos. No se suman: es la parte del jornal que son vacaciones.`:`Los ${fCount(r.vacationDays)} días de vacaciones que no disfrutas te los pagan al acabar: unos ${fE(r.comp.vacationPay)} netos, aquí repartidos entre lo que trabajas.`,
    unemployment:`Esta oferta cotiza ${fN(r.contrib)} días y genera unos ${fN(r.unemploymentDays)} días de paro. Lo cobras cuando juntes ${LAW.unemployment.minDaysContributed} días cotizados; aquí va repartido entre lo que trabajas. Se puede quitar en «Supuestos del cálculo».`};
  const tripTxt=o.commute==='daily'?'Vas y vuelves cada día trabajado':`Subes al empezar y bajas al acabar${num(o.tripsHome)>0?`, y bajas a casa ${fInput(o.tripsHome)} ${num(o.tripsHome)===1?'vez':'veces'} al mes`:''}`;
  const carTip=`${fN(r.km)} km ${r.noDuration?'al mes':'en todo el contrato'}. ${o.car==='noCar'?'':`${tripTxt}: ${fN(num(o.kmHome))} km de ida y otros tantos de vuelta.`}${o.car==='own'&&num(o.kmWorkPerDay)>0?` Más ${fN(num(o.kmWorkPerDay))} km por día trabajado moviéndote con tu coche.`:''} Cada km: ${fE(fuelPerKm,2)} de gasolina (${fN(num(config.fuelUse),1)} l/100 km a ${fE(num(config.fuelPrice),2)}/l) + ${fE(num(config.wear),2)} de desgaste. Tu coche se cambia en «Tus datos».`;
  const shows=x=>conv(x,r,u)>=(u==='hour'?0.005:0.5); // do not show rows that round to 0 € in this unit
  const C=columns(D,r), minus=C.minus, otherUnit=C.other;
  const fp=t=>row(withTip(t.label,TIP[t.k]),C.v(t.v(r.comp)),{sw:t.color,cls:t.k==='payroll'?'strong':''});
  // Paid vacation is money coming in: it goes with payroll, inside «Cobras» (the same in every offer)
  const vacationIsMoney=true, isMoney=t=>t.money||(t.k==='vacationPay'&&vacationIsMoney);
  const present=PARTS.filter(t=>t.v(r.comp)>0.5), moneyParts=present.filter(isMoney), others=present.filter(t=>!isMoney(t));
  if(vacationIsMoney) moneyParts.sort((a,b)=>(a.k==='vacationPay'?0.5:PARTS.indexOf(a))-(b.k==='vacationPay'?0.5:PARTS.indexOf(b)));
  // Subtotal of the money you receive each month (or day): if there is more than one money row and something that is not money follows
  const parts=[...moneyParts.map(fp),...(moneyParts.length>1&&others.length?[row('Cobras',C.v(moneyParts.reduce((s,t)=>s+t.v(r.comp),0)),{sw:'',cls:'subt'})]:[]),...others.map(fp)];
  return {earnTip, html:`
    <details class="plg" data-fold="breakdown2"><summary>Desglose<span class="stat dt">cobras <b>${fU(conv(receivedOf(r),r,otherUnit),otherUnit)}</b> ${otherUnit==='month'?'al mes':'en total'}</span></summary>
    ${incomeBarHTML(r,incomeOf(r)||1)}
    <div class="rows">
      ${row('',C.header,{sw:'',cls:'hd'})}
      ${parts.join('')}
      ${shows(r.car)?row(withTip('Coche',carTip),minus(r.car),{sw:'expense',vcls:'minus'}):''}
      ${shows(r.otherExpenses)?row('Otros',minus(r.otherExpenses),{sw:'expense',vcls:'minus'}):''}
      ${row('Ganas',C.v(r.total),{sw:'',cls:'tot'})}
    </div>
    </details>`};
}


/**
 * The card for what is illegal, the most serious issue of the offer. With cash or no contract, the figure is what it takes from you:
 * the contributions it skips (your unemployment benefit, pension and sick pay) plus what it does not pay of the minimum; if everything
 * is on payroll, what you are owed. Red if serious (no contract, below the minimum, all in cash); amber otherwise.
 */
function owedCardHTML(o,r,D){
  const {u,inUnit:cu,net:cn}=D, us=UNITS[u].short, fT=D.netAll, debt=r.debtTotal, sc=r.noContract;
  const total=x=>D.u!=='total'&&!r.noDuration&&fT(x)!==cn(x)?`${fT(x)} en todo el contrato`:'';
  if(sc){ // no contract: the serious part is not the debt, it is not contributing
    const pp=r.unemploymentLost;
    const L=[r.debtVacation>1&&`Sin contrato no te pagan las vacaciones que te corresponden (${fDays(r.vacationDays)}): te deben unos ${fT(r.debtVacation)} netos.`,
      r.debtSalary>1&&`Lo que te dan no llega al salario mínimo: te deben ${cn(r.debtSalary)} ${us}.`,
      'Sin jubilación ni bajas pagadas: si te pones malo o te haces daño, no cobras.'].filter(Boolean);
    return `<div class="owed">${(pp.euros>=1?figureHTML(fE(pp.euros),'De paro que no generas',`Unos ${fDays(pp.days)} de prestación · sin contrato no cotizas`,'Ilegal'):figureHTML(`${fN(pp.days)}<small> días</small>`,'De paro que no generas','Sin contrato no cotizas','Ilegal'))}
      <ul class="reasons">${L.map(t=>`<li>${t}</li>`).join('')}</ul>
      <p class="hint">Para que sea legal: contrato, alta en la Seguridad Social${debt>1?` y un salario de al menos ${cu(r.minNetNoContract)} netos ${us}`:''}.</p>${debt>1?claimDeadline(o,debt):''}</div>`;
  }
  if(debt<=1) return '';
  // What is missing on payroll: if it is one thing, it goes in the subtitle; if several, in rows below
  const P=owedReasons(o,r,D), owed=r.owed;
  if(owed>1){
    const sub=[P.single&&capitalize(P.single),total(owed),r.B>0&&'contando lo que cobras en negro'].filter(Boolean).join(' · ');
    return `<details class="owed" data-fold="owed"><summary>${figureHTML(withTip(cn(owed),`Netos. En bruto: ${cu(owed)} ${us}.`)+unitSuffix(u),'Te deben',sub,'Ilegal')}</summary>${P.rows||minimumBar(r,D)}${claimDeadline(o,owed)}</details>`;
  }
  return `<details class="owed" data-fold="owed"><summary>${figureHTML(cn(debt)+unitSuffix(u),P.single?capitalize(`falta ${P.single.replace(/ \(.*\)$/,'')}`):'Nómina bajo el mínimo',`${P.single?'En nómina. ':''}Lo cobrado en negro lo cubre, pero no cotiza.`,'Ilegal')}</summary>${P.rows||minimumBar(r,D)}</details>`;
}

/** The large stamp, on two lines if long (split at the most central space): so the box fits the text. */
const stampLines=t=>{ if(t.length<=12||!t.includes(' ')) return t;
  const sp=[...t.matchAll(/ /g)].map(m=>m.index), i=sp.reduce((a,b)=>Math.abs(b-t.length/2)<Math.abs(a-t.length/2)?b:a);
  return `${t.slice(0,i)}<br>${t.slice(i+1)}` };
/** The unit attached to the figure, small: «312 €/mes», «13 h/sem», «1.200 € en total». */
const unitSuffix=u=>`<small class="u">${{hour:'/h',day:'/día',month:'/mes',total:' en total'}[u]||''}</small>`;
/** A figure card: the figure large on the left, what it is next to it and a stamp in the corner. Its colour comes from --k on the card. */
const figureHTML=(figure,title,sub,stamp)=>`<div class="figcard"><span class="left"><span class="big">${figure}</span>${stamp?`<span class="stamp">${stamp}</span>`:''}</span><span class="t"><b>${title}</b>${sub?`<span>${sub}</span>`:''}</span></div>`;

/** What it does not pay of the minimum, for «Para negociar»: salary, overnight bonus or vacation. */
const minimumShortTxt=r=>(r.noContract?r.debtSalary>1:r.minSalary-r.salaryGross>1)?'por pagarte por debajo del mínimo':r.debtSalary>1?'por no pagarte el plus de pernocta':'por no pagarte las vacaciones';
/** «Para negociar»: what the employer saves at your expense, item by item. It is their margin: what they can add without losing. */
function employerHTML(o,r,D){
  if(r.cost<=0) return '';
  const A=employerSavings(r), cu=D.inUnit, us=unitPhrase(D,r), sec=h=>`<section class="employer" id="secEmployer" aria-label="Para negociar"><h3 class="q">Para negociar</h3>${h}${costHTML(o,r,D)}</section>`;
  if(A.total<=1) return sec('<div class="savings neutral"><p class="savings-t">No se ahorra nada a tu costa</p><p>Todo va en nómina, cotizando, y llega al mínimo.</p></div>');
  // What it does not pay of the minimum: salary, overnight bonus or vacation
  const F=capitalize(minimumShortTxt(r));
  const L=[[A.b,r.noContract?'Por no hacerte contrato':'Por pagarte en negro'],[A.min,F],[A.days,'Por las jornadas de más'],[A.extra,'Por las horas extra',true]].filter(x=>x[0]>1);
  // Two columns: in the offer's unit and over the whole contract (a single one if it is already the total or there is no duration)
  const two=!(r.noDuration||D.u==='total'), cell=v=>two?`<span class="two"><span>${cu(v)}</span><span>${fE(v)}</span></span>`:cu(v);
  return sec(`<div class="savings levers"><p class="lev-t">El ganadero se ahorra a tu costa${two?'':` <span>${us}</span>`}</p>
    <div class="rows sv-rows">${two?row('',`<span class="two"><span>${capitalize(us)}</span><span>En total</span></span>`,{cls:'hd'}):''}${L.map(([v,t,est])=>row(t,cell(v),{sub:est?'estimado':'',cls:est?'est':''})).join('')}</div>
    <p class="hint">Es su margen para pagarte más. Lleva su Seguridad Social y la tuya: también es tu paro y tu jubilación.</p></div>`);
}

function costHTML(o,r,D){
  const C=columns(D,r), cu=C.v;
  const vac=r.vacationPayGross>0.5?r.vacationPayGross:0, money=r.cost-r.inKind;
  const inKindLabel=r.comp.housing>0.5&&r.comp.food>0.5?'Casa y comida':r.comp.housing>0.5?'Casa':'Comida';
  // All additions: the first row has no sign, the rest «+», and totals «=»
  const F=[r.grossTotal-vac>0.5&&['Nómina bruta',r.grossTotal-vac,vac?'sin las vacaciones':''],
    vac&&['Vacaciones',vac,o.vacation==='included'?'la parte del jornal que son vacaciones':'las que no libras, pagadas al acabar'],
    r.ssEmployer>0.5&&['Seguridad Social que paga la empresa',r.ssEmployer,`aprox. ${fN(config.ssEmp,1)} % del bruto`],
    r.B>0&&[r.noContract?'En mano, sin contrato':'En negro',r.B,''],
    r.kmPaid>0.5&&['Kilometraje que te paga',r.kmPaid,''],
    r.severancePay>0.5&&['Indemnización por fin de contrato',r.severancePay,`${LAW.severanceDaysPerYear} días por año trabajado`]].filter(Boolean);
  return `<details class="plg" data-fold="cost"><summary>Cuánto le cuestas</summary><p class="hint">Por día trabajado y ${C.other==='month'?'al mes':'en todo el contrato'}.</p>
  <div class="rows">
    ${row('',C.header,{cls:'hd'})}
    ${F.map(([t,v,sub],i)=>row(`${i?'+ ':''}${t}`,cu(v),{sub})).join('')}
    ${r.inKind>0.5?row('= Dinero que pone',cu(money),{cls:'strong'})+row(`+ ${inKindLabel}`,cu(r.inKind),{sub:'lo que vale, no lo que le cuesta'}):''}
    ${row('= Le cuestas',cu(r.cost),{cls:'tot'})}
  </div>
  </details>`;
}

/** Right by right: [status, title, explanation] (status: true complies · false fails · 'warn' warning · null information). null if there is nothing to calculate with. */
function lawsOf(o,r,D){
  const {u,inUnit:cu,netWithTip:nb}=D;
  if(r.minBy.month<=0||r.daysWorked<=0) return null;
  const overTxt=r.noDuration?'al mes':'en todo el contrato', hPerDay=num(o.hoursPerDay), hs=r.hoursPerWeek;
  const us=UNITS[u].short;
  const vd=fCount(r.vacationDays), pct=fN(config.overnightPct);
  const L=[];
  // Each right is checked separately: salary without vacation or overnight bonus; then the bonus (only if the salary is reached) and vacation
  const salaryOk=r.salaryGross>=r.minSalary-1, sc=r.noContract;
  // What you are owed: what is missing of each item separately (a surplus in one does not cover what is missing in another)
  if(sc){
    L.push([false,'Contrato y alta',explanations(o,r).contract]);
    L.push([r.debtSalary<=1,'Salario mínimo',`Te pagan ${cu(r.B)} en mano ${us}; con contrato, el mínimo serían unos ${cu(r.minNetNoContract)} netos${o.overnight==='yes'?', con el plus por dormir en el monte':''}.`]);
    if(r.minVacation>1) L.push([false,'Vacaciones',`Sin contrato no te pagan los ${vd} días de vacaciones que te corresponden: unos ${D.netAll(r.minVacation)} netos.`]);
  }
  else { L.push([salaryOk,'Salario mínimo',`Te pagan ${nb(r.salaryGross)} netos ${us}; el mínimo es ${nb(r.minSalary)}.`]);
  if(o.overnight==='yes'){
    const overnightShort=r.minSalary+r.overnightPay-r.salaryGross;
    L.push(!salaryOk?[null,'Plus por dormir en el monte',`El convenio fija al menos un ${pct} % más de salario: unos ${nb(r.overnightPay)} ${us}. Ya va sumado en lo que te deben.`]
      :overnightShort<=1?[true,'Plus por dormir en el monte',`Tu salario cubre también el ${pct} % más que fija el convenio (unos ${nb(r.overnightPay)} ${us}).`]
      :[false,'Plus por dormir en el monte',`Cumples el salario mínimo, pero falta el plus de pernocta: el convenio da un ${pct} % más por dormir fuera. Te faltan unos ${nb(overnightShort)} ${us}.`]);
  }
  else L.push([null,'¿Duermes en el monte?',`Si duermes fuera por pastoreo (borda, cabaña), el convenio te da al menos un ${pct} % más de salario. Márcalo en «Casa y comida».`]);
  L.push(o.vacation==='taken'?[true,'Vacaciones',`Libras los ${vd} días que te corresponden, cobrando.`]
    :o.vacation==='paidAtEnd'?(r.vacationPayGross>=r.minVacation-1?[r.noDuration||shortContract(o)?true:'warn','Vacaciones',`Te pagan al acabar los ${vd} días que te corresponden: unos ${D.netAll(r.vacationPayGross)} netos.${r.noDuration||shortContract(o)?'':' Pero solo se pueden pagar en vez de disfrutar si el contrato acaba antes de poder librarlas: en un contrato así de largo, tienes derecho a librarlas.'}`]
      :[false,'Vacaciones',`Por los ${vd} días que te corresponden te pagan unos ${D.netAll(r.vacationPayGross)} netos, y el mínimo es ${D.netAll(r.minVacation)}.`])
    :(r.vacationPayGross>=r.minVacation-1?[r.noDuration||shortContract(o)?true:'warn','Vacaciones',`Van dentro del jornal: de lo que te pagan, unos ${D.netAll(r.vacationPayGross)} netos son los ${vd} días de vacaciones que te corresponden.${r.noDuration||shortContract(o)?'':' Pero solo se pueden cobrar en vez de disfrutar si el contrato acaba antes de poder librarlas: en un contrato así de largo, tienes derecho a librarlas.'}`]
      :[false,'Vacaciones',`Van dentro del jornal, pero no da para todo: a las vacaciones les corresponden al menos ${D.netAll(r.minVacation)} netos y, sacándolas del jornal, quedan ${D.netAll(r.vacationPayGross)}.`])); }
  L.push(r.restShort>=1?[false,'Descanso semanal',`${r.daysOffTotal<0.5?'No libras ningún día':`Libras ${fN(r.daysOffTotal)} días`} ${overTxt} y te corresponden al menos ${fN(r.restLegal)}: trabajas unos ${fN(r.restShort)} que deberían ser de descanso.`]
    :[true,'Descanso semanal','Libras al menos día y medio por semana.']);
  L.push(hs<=H_ORDINARY?[true,'Jornada','40 h o menos a la semana.']
    :(hs<=H_MAX&&hPerDay<=LAW.maxDayHours)?(A=>{
      const what=A.overtimeWeek>=0.5?`${fN(hs)} h a la semana: unas ${fN(A.over40Week)} por encima de 40.`:`${fN(hs)} h a la semana.`;
      return A.overtimeUnpaid>1&&!r.noContract
        ?[false,'Jornada',`${what} ${A.overtimeUnpaid>=A.overtimeValue-1?'No te las pagan':`Te pagan solo una parte: quedan sin pagar unas ${fN(A.overtimeUnpaidWeek)} a la semana`}. Las horas extra se pagan al menos como una hora normal, o se devuelven en descanso.`]
        :['warn','Jornada',`${what} Se pagan o se devuelven en descanso.`]})(r.savings)
    :[false,'Jornada',`${fN(hs)} h a la semana${hPerDay>LAW.maxDayHours?` y ${fN(hPerDay)} h al día`:''}: pasas del límite de la ganadería (${LAW.maxWeekHours} h a la semana y ${LAW.maxDayHours} h al día).`]);
  if(o.holidays!=='yes'&&!r.noDuration&&LAW.holidaysPerYear*r.months/12>=0.5) L.push([null,'Festivos',`Trabajas los festivos, ${(n=>n<1.5?'uno':`unos ${fN(n)}`)(LAW.holidaysPerYear*r.months/12)} en este contrato. Se pagan aparte o se compensan con descanso${r.savings.daysValue>0&&extraDaysOf(r).extra>=1?': ya van contados en las jornadas de más':''}.`]);
  return L;
}

/** Is this offer legal? At a glance: the verdict, what it breaks, what you are owed and how your extra time is paid. */
function legalHTML(o,r,D){
  const L=lawsOf(o,r,D); if(!L) return '';
  const {u,inUnit:cu,net:cn}=D, us=UNITS[u].short, sc=r.noContract, debt=r.debtTotal, fT=D.netAll;
  const failures=L.filter(x=>x[0]===false).map(x=>x[1]), warnings=L.filter(x=>x[0]==='warn').map(x=>x[1]);
  const WARN_TXT={Jornada:'las horas extra se tienen que pagar',Vacaciones:'las vacaciones se tienen que librar'};
  const headline=sc?'Sin contrato no es legal':failures.length?'Esta oferta no cumple la ley':warnings.length?`Cumple lo básico, pero ${joinAnd(warnings.map(t=>WARN_TXT[t]||t.toLowerCase()))}`:'Esta oferta cumple lo básico';
  const EST={true:['ok','✔'],false:['bad','✘'],warn:['warn','!'],null:['off','i']}; // status → class and icon
  const source=t=>t==='Salario mínimo'?[r.smiUrl,r.smiRd]:LAW_SOURCE[t];
  const passed=L.filter(x=>x[0]===true).map(x=>x[1]), list=L.filter(x=>x[0]!==true).map(([ok,t,d])=>`<li class="law"><span class="ic ${EST[ok][0]}" aria-hidden="true">${EST[ok][1]}</span><div><b>${t}</b><span>${d}${source(t)?` <a class="lawlink" href="${source(t)[0]}" target="_blank" rel="noopener">${source(t)[1]}</a>`:''}</span></div></li>`).join('');
  // What you work on top, each in its own card: the extra days (the solid part) and the hours over 40 a week.
  // The figure is what you give away; inside, the calculation. What you are paid above the minimum covers the days first.
  const extraTimeTxt=extraTimeHTML(o,r,D);
  return `<section class="legal" id="secLegal" aria-label="¿Es legal esta oferta?">
    <h3 class="q">¿Es legal?</h3>
    <p class="verdict ${failures.length?'bad':warnings.length?'warn':'ok'}">${headline}</p>
    ${failures.length?`<p class="failures">${failures.map(t=>`<span>✘ ${capitalize(LAW_SHORT[t]||t)}</span>`).join('')}</p>`:''}
    ${owedCardHTML(o,r,D)}
    ${extraTimeTxt}
    <details class="plg" data-fold="laws"><summary>Lo que dice la ley</summary><ul class="laws">${list}</ul>${passed.length?`<p class="hint">✔ Cumple: ${joinAnd(passed.map(t=>t.toLowerCase()))}.</p>`:''}</details>
    <p class="hint">Dónde reclamar (sindicato, Inspección de Trabajo): <button type="button" class="linkbtn" data-action="tab" data-tab="laws">en «Leyes»</button>.</p>
  </section>`;
}

/** The rows of a calculation inside a card: a header (what and in which unit) and the rows. */
const ledger=(hd,rows)=>`<div class="rows sv-rows">${hd[0]||hd[1]?row(hd[0],hd[1],{cls:'hd'}):''}${rows.filter(Boolean).join('')}</div>`;
const ESTIMATE_NOTE='<p class="hint">Es una estimación: en el monte no todas las horas son iguales (paras a comer, hay ratos quieto…). Si pones menos horas al día, baja.</p>';

/** «¿Es legal?»: the extra days and the overtime you are not paid for, each in its card, with its calculation inside. */
function extraTimeHTML(o,r,D){
  const A=r.savings, dJ=extraDaysOf(r), sc=r.noContract;
  if(!(r.grossTotal>0||sc)) return '';
  const overTxt=r.noDuration?'En un mes':'En todo el contrato';
  // Whether they are paid: what you are paid above the minimum (counting cash) covers them fully, partly or not at all
  // How much of their value you are paid, with nuance: missing almost nothing is not the same as missing almost everything
  const payStatus=(shortfall,val)=>{const p=val>0?1-shortfall/val:1; return shortfall<=1?'paid':p>=0.85?'casi todas pagadas':p>0.02?'mal pagadas':'sin pagar'};
  const mark=e=>e==='paid'?'lo que te pagan de más las cubre':`<b class="${e==='casi todas pagadas'?'almost':'bad-pay'}">${e}</b>`;
  const out=[];
  // Extra days: days, over the whole contract; inside, where they come from. The money is in «Para negociar».
  if(A.daysValue>0&&dJ.extra>=1){
    const e=payStatus(A.daysUnpaid,A.daysValue), dd=fCount(dJ.extra)==='1'?'día':'días';
    out.push(`<details class="owed warn" data-fold="law-days"><summary>${figureHTML(`${fCount(dJ.extra)}<small> ${dd}</small>`,'Jornadas de más',`${overTxt} · ${mark(e)}`,{'sin pagar':'Sin pagar','mal pagadas':'Mal pagados','casi todas pagadas':'Casi pagados',paid:''}[e])}</summary>
      ${extraDaysBar(r,dJ)}</details>`);
  }
  // Overtime: per week. It is an estimate.
  if(r.tmHoursOver>=0.5){
    const e=payStatus(A.overtimeUnpaid,A.overtimeValue);
    out.push(`<details class="owed warn" data-fold="law-hours"><summary>${figureHTML(`${fN(A.over40Week)}<small> h</small><small class="u">/sem</small>`,'Horas extra',`Por encima de 40 h a la semana · ${mark(e)}`,'Estimado')}</summary>${hoursBar(o,r,A)}</details>`);
  }
  return out.join('');
}
/** Overtime rows, per week: the hours you work, minus the legal 40, minus the rest-day hours already counted as extra days. */
function overtimeRows(o,r,A){
  const S=hoursWeek(r), H=x=>`${fN(x,1)} h`, rest=S.restDayHours>=0.05;
  return [row('Horas a la semana',H(S.sem),{sub:`${f1(S.d)} días de ${fInput(S.h)} h`}),
    row('− Jornada legal',H(S.norm)),
    row('= Por encima de 40',H(S.over),{cls:rest?'':'strong'}),
    ...(rest?[row('− Ya en «Jornadas de más»',H(S.restDayHours),{sub:'días de descanso trabajados'}),
      row('= Horas extra',H(S.ext),{cls:'strong',sub:'a la semana'})]:[]),
    row('En todo el contrato',`${fN(r.tmHoursOver)} h`)];
}
function overtimeLedger(o,r,A){
  return ledger(['Una semana',''],overtimeRows(o,r,A))+'<p class="hint estimate">Al salario mínimo por hora. Es una estimación: en el monte no todas las horas son iguales.</p>';
}
/**
 * Card bars: a calculation at a glance, without rows. Each segment carries its number if it fits; the legend, always.
 * T: [[class, value, label]], scale: the total of the longest bar.
 */
function segBar(T,scale,fmt=fCount,minPc=9){
  const tr=T.filter(x=>x[1]>0.05), fits=v=>v/scale*100>=minPc;
  return `<div class="br-b">${tr.map(([c,v])=>`<i class="${c}" style="width:${(v/scale*100).toFixed(2)}%">${fits(v)?`<span class="tx">${fmt(v)}</span>`:''}</i>`).join('')}</div>
    <div class="br-k">${tr.map(([c,v,t])=>t?`<span><i class="${c}"></i>${t}${fits(v)?'':` <b>${fmt(v)}</b>`}</span>`:'').join('')}</div>`;
}
/** A marker on a bar (the minimum, what is paid…), with its label; with «faded», what lies to its right is dimmed. */
function marker(pos,txt,faded,end=100){
  pos=Math.max(0,Math.min(100,pos));
  return `${faded&&pos<end-0.5?`<span class="br-claro" style="left:${pos.toFixed(2)}%;right:${(100-end).toFixed(2)}%${end<99.5?';border-radius:0':''}"></span>`:''}<span class="br-min${pos>70?' left':''}" style="left:${pos.toFixed(2)}%"><span>${txt}</span></span>`;
}
/**
 * The owed card, at a glance: the legal minimum and, below it, what you are paid on payroll; the gap is what is missing,
 * and what cash covers, in its colour. For the item that is missing (salary with bonus, or vacation), net.
 */
function minimumBar(r,D){
  const f=netFactor(r), cashGrossEq=r.B>0?r.cashGrossEq:0, v=x=>conv(x,r,D.u)*f, fmt=x=>fE(x);
  const isSalary=r.debtSalary>1;
  const min=isSalary?r.minSalary+r.overnightPay:r.minVacation, paysAbove=isSalary?r.salaryGross:r.vacationPayGross, shortfall=isSalary?r.debtSalary:r.debtVacation;
  const left=Math.max(0,shortfall-cashGrossEq), cashPart=isSalary?r.B:0;
  // A single bar: what you are paid on payroll, all the cash and, if it still falls short, what is missing. A marker shows the minimum.
  const esc=Math.max(v(min),v(paysAbove)+conv(cashPart,r,D.u)+v(left)), pos=v(min)/esc*100;
  return `<div class="br">
    <div class="br-l">Mínimo${isSalary?(r.overnightPay>0.5?', con el plus de pernocta':''):' de las vacaciones'}: <b>${fmt(v(min))}</b> <small>${UNITS[D.u].short}, netos</small></div>
    <div class="br-mw">${segBar([['t',v(paysAbove),'en nómina'],['m',conv(cashPart,r,D.u),'en negro'],['x',v(left),'falta']],esc,fmt,14)}${marker(pos,'mínimo',true)}</div>
  </div>`;
}
/**
 * The extra days, in one bar: the contract's days, split into the due days you work, the days you work
 * on top and the days off. The marker shows how far you are paid.
 */
function extraDaysBar(r,dJ){
  const k=dJ.worked<10?10:1, Rd=x=>Math.round(x*k)/k, natDays=Rd(r.natDays), vac=Rd(r.vacationTaken||0), holidaysN=Rd(r.tmHolidays||0), restDays=Rd(natDays-vac-holidaysN-dJ.due);
  const regular=Math.min(dJ.worked,dJ.due), free=Math.max(0,Rd(natDays-dJ.worked)), esc=Math.max(natDays,dJ.worked);
  // The marker shows how far you are paid: what you are paid above the minimum covers that part of the extra days
  const paid=Math.max(0,dJ.extra-(unpaidTime(r).d||0));
  return `<div class="br">
    <div class="br-mw">${segBar([['w',regular,'laborables'],['wx',dJ.extra,'extra'],['l',free,'libras']],esc)}${dJ.extra>=1?marker((regular+paid)/esc*100,'pagado',true,(regular+dJ.extra)/esc*100):''}</div>
  </div>`;
}
/** A working week, in hours: the normal ones (up to 40), the workday of the rest days you work and what goes beyond. */
function hoursWeek(r){
  const h=r.tmHoursDay||0, d=r.tmWorkDaysWeek||0, j=workdayWeek(r), sem=d*h;
  const norm=Math.min(d,7-LAW.weeklyRest)*j, restDayHours=Math.max(0,d-(7-LAW.weeklyRest))*j, ext=Math.max(0,sem-norm-restDayHours);
  return {d,h,j,sem,norm,restDayHours,ext,over:restDayHours+ext};
}
function hoursBar(o,r,A){
  const {d,h,sem,norm,restDayHours,ext}=hoursWeek(r);
  const paidHours=A.overtimeValue>0?ext*Math.max(0,1-A.overtimeUnpaid/A.overtimeValue):0, paidDaysHours=A.daysValue>0?restDayHours*Math.max(0,1-A.daysUnpaid/A.daysValue):restDayHours, H=x=>`${f1(x)} h`;
  return `<div class="br">
    <div class="br-l">Una semana: ${f1(d)} días de ${fInput(h)} h, <b>${H(sem)}</b></div>
    <div class="br-mw">${segBar([['w',norm,'normales'],['wx',restDayHours+ext,'extra']],sem,H,13)}${restDayHours+ext>0.05?marker((norm+paidDaysHours+paidHours)/sem*100,'pagado',true):''}</div>
  </div>`;
}
function extraDaysRows(r,dJ){
  // A subtraction, top to bottom: the contract's days, minus what the law gives off, are the due workdays.
  // Rounded so it adds up on screen: the rest absorbs the rounding.
  const k=dJ.worked<10?10:1, Rd=x=>Math.round(x*k)/k;
  const natDays=Rd(r.natDays), vac=Rd(r.vacationTaken||0), holidaysN=Rd(r.tmHolidays||0), restDays=Rd(natDays-vac-holidaysN-dJ.due);
  return {rows:[
    row('Días del contrato',fCount(natDays)),
    vac>=0.5/k&&row('− Vacaciones que libras',fCount(vac)),
    row('− Descanso semanal',fCount(restDays),{sub:'día y medio por semana'}),
    holidaysN>=0.5/k&&row('− Festivos',fCount(holidaysN)),
    row('= Días laborables',fCount(dJ.due),{cls:'strong'}),
    row('Trabajas',fCount(dJ.worked)),
    row('− Días laborables',fCount(dJ.due)),
    row('= Jornadas de más',fCount(dJ.extra),{cls:'strong',sub:'descanso o festivos que no libras'})].filter(Boolean)};
}

/** Deadline to claim: each payment, one year from when it was due (Estatuto, art. 59.2). Only with dates. */
function claimDeadline(o,debt){
  if(!o.start||debt<=1) return '';
  const f=endOf(o); if(!f) return '';
  const a=parseDate(o.start), last=new Date(f), firstPay=new Date(a.getFullYear(),a.getMonth()+1,0); // the first payment, at the end of the first month
  if(firstPay>last) firstPay.setTime(last);
  const plusYear=d=>{const x=new Date(d);x.setFullYear(x.getFullYear()+1);return x}, today=new Date();
  const end=plusYear(last), start=plusYear(firstPay), expired=end<today;
  return `<details class="detail deadline"><summary>Hasta cuándo puedes reclamar</summary><p class="hint${expired?' bad':''}">${expired?`El plazo para reclamarlo acabó el ${fDate(end)}: cada pago se puede reclamar durante un año.`
    :`Cada pago se puede reclamar durante un año (Estatuto, art. 59): ${+start===+end?`hasta el ${fDate(end)}`:`lo del primer mes, hasta el ${fDate(start)}; lo del último, hasta el ${fDate(end)}`}.`}</p></details>`;
}
/** Why you are owed what you are owed, in words: one line per missing item, with its share. */
function owedReasons(o,r,D){
  const cn=D.net, us=UNITS[D.u].short;
  const {salary,overnight,vac}=r.debtParts;
  const L=[salary>1&&['el salario mínimo'+(r.casual?' de temporero':''),salary],overnight>1&&[`el plus de pernocta (${fN(config.overnightPct)} %)`,overnight],
    vac>1&&[o.vacation==='paidAtEnd'?'parte de las vacaciones':'las vacaciones, que no caben en el jornal',vac]].filter(Boolean);
  if(L.length===1) return {single:L[0][0],rows:''};
  return {single:'',rows:`<div class="rows sv-rows">${row('En nómina faltan',`${capitalize(us)}, netos`,{cls:'hd'})}${L.map(([t,v])=>row(capitalize(t),cn(v))).join('')}</div>`};
}

/** Where the law says it, to link from each right. */
const LAW_SOURCE={
  'Plus por dormir en el monte':citeOf('agreement',29),
  '¿Duermes en el monte?':citeOf('agreement',29),
  'Vacaciones':citeOf('et',38),
  'Descanso semanal':citeOf('et',37),
  'Festivos':citeOf('et','37.2'),
  'Jornada':citeOf('rd1561',5),
  'Contrato y alta':citeOf('et',8),
};
/** Short names of what is breached, for the pills and summary lines. */
const LAW_SHORT={'Contrato y alta':'sin contrato','Salario mínimo':'salario','Plus por dormir en el monte':'pernocta','Vacaciones':'vacaciones','Descanso semanal':'descanso','Jornada':'jornada'};
const capitalize=t=>t[0].toUpperCase()+t.slice(1);
/** What an offer breaches (titles from lawsOf), or null if there is nothing to calculate with. */
const failuresOf=(o,r)=>{ const L=lawsOf(o,r,money(r,'month')); return L&&L.filter(x=>x[0]===false).map(x=>x[1]) };
/** What is legal about an offer, in one line: for the summary, the Comparar cards and the card. */
function legalLine(o,r){
  const f=failuresOf(o,r); if(!f) return null;
  const A=r.savings, est=(f,v)=>f>=v-1?'sin pagar':'mal pagadas';
  const hours=[A.days>1&&`jornadas de más ${est(A.daysUnpaid,A.daysValue)}`,A.extra>1&&`horas extra ${est(A.overtimeUnpaid,A.overtimeValue)}`].filter(Boolean).join(' y ');
  return f.length?{cls:'bad',txt:`✘ No cumple: ${joinAnd(f.map(t=>LAW_SHORT[t]||t))}${hours?' · '+hours:''}`}
    :hours?{cls:'warn',txt:`! Cumple lo básico, pero ${hours}`}:{cls:'ok',txt:'✔ Cumple lo básico'};
}

function renderResult(r){
  const o=active, u=offerUnit(o,r), D=money(r,u), cu=D.inUnit, shortfall=missing(o);
  if(shortfall.length){
    $('#result').innerHTML=`<p class="empty">Para ver cuánto ganas falta ${joinAnd(shortfall)}. <button type="button" class="linkbtn" data-action="complete">Ponerlo</button></p>`;
    return;
  }
  const {earnTip,html:breakdown}=breakdownHTML(o,r,D);
  const yr=actualYear(o), notice=String(yr)!==r.year?`<p class="year-warning">Esta oferta es de ${yr} y la página aún no tiene el salario mínimo ni el IRPF de ${yr}: las cuentas usan los de ${r.year}.</p>`:'';
  $('#result').innerHTML=`${notice}
    <h3 class="q">¿Cuánto ganas?</h3>
    <div class="tag"><span class="lbl tipl"${tipA(earnTip)}>Ganas ${UNITS[u].lbl}</span><span class="tag-row"><span class="big">${cu(r.total)}</span>${(([t,c])=>t?`<a href="#secLegal" class="stamp${c}">${stampLines(t)}</a>`:'')(stampOf(r))}</span>${otherUnitsHTML(r,u)}
      ${r.noDuration?'<span class="sub">Sin duración, se cuenta un mes</span>':''}</div>
    ${card(o,r)}
    ${breakdown}
    ${legalHTML(o,r,D)}
    ${employerHTML(o,r,D)}
    ${seasonEndHTML(o,r)}
    <details class="plg" data-fold="workings"><summary>Las cuentas, paso a paso</summary><div class="doc">${workingsHTML(o,r)}</div></details>
    <div class="copyrow copies"><button type="button" class="sm" data-action="card" title="Para mandarla por WhatsApp o guardarla en notas">Copiar ficha</button>${legalLine(o,r)?'<button type="button" class="sm" data-action="claim" title="Para el sindicato, la inspección o tu propia nota">Copiar reclamación</button>':''}<span class="hint" id="cardMsg"></span><span class="hint" id="claimMsg"></span></div>`;
  restoreFolds($('#result'));
}


/**
 * Estimated payslips, month by month, for a season with dates. Each calendar month gets its share of the salary (partial
 * months by days at 1/30, adjusted so the sum matches the contract); the vacation not taken and the
 * severance, in the last one (the final settlement). Contributions at the «Supuestos» rates.
 */
/** The month chosen in each offer's payslip simulator (not saved). */
const payslipMonthSel={};
function monthlyPayslips(o,r,cfg=config){
  const f=endOf(o); if(!o.start||!f||r.grossTotal<=0) return [];
  const a=parseDate(o.start), M=[];
  for(let y=a.getFullYear(),m=a.getMonth();new Date(y,m,1)<=f;m++){
    const start=new Date(y,m,1), end=new Date(y,m+1,0), d0=Math.max(+a,+start), d1=Math.min(+f,+end);
    const days=Math.round((d1-d0)/864e5)+1, fullMonth=d0===+start&&d1===+end;
    M.push({month:new Date(y,m,1), days, frac:fullMonth?1:Math.min(30,days)/30});
  }
  const fracSum=M.reduce((s,x)=>s+x.frac,0)||1, k=r.months/fracSum, lastIdx=M.length-1;
  const ss=cfg.ssPct/100, emp=cfg.ssEmp/100, irpfPct=r.grossTotal>0?r.irpf/r.grossTotal:0;
  return M.map((x,i)=>{
    const salary=r.salaryGross*x.frac*k/r.months, vac=r.vacationPayGross>0&&i===lastIdx?r.vacationPayGross:0; // vacation, in the final settlement
    const gross=salary+vac, severance=i===lastIdx?r.severancePay:0;
    const contrib=gross*ss, irpf=gross*irpfPct;
    return {...x, salary, vac, gross, contrib, irpf, severance, net:gross-contrib-irpf+severance, employer:gross*emp, cost:gross*(1+emp)+severance};
  });
}

/**
 * Season accounts (after the fact): only for dated offers you have worked. The totals of what you should have
 * been paid (on payroll and in cash), what you worked and what you generated; and, folded, the estimated monthly payslips.
 */
function seasonEndHTML(o,r){
  if(!o.start||o.offerOnly||r.noDuration||!endOf(o)) return '';
  const N=monthlyPayslips(o,r), banked=N.reduce((s,x)=>s+x.net,0);
  const total=banked+r.B, pB=total>0?r.B/total:0;
  const tot=figureHTML(fE(total),'Total cobrado',`del ${fDate(parseDate(o.start))} al ${fDate(endOf(o))}`,'')
    +(r.B>0.5&&banked>0.5?`<div class="rc-bar" aria-hidden="true"><i style="flex:${1-pB}"></i><i class="b" style="flex:${pB}"></i></div>`:'')
    +`<div class="rc-legend">${!r.noContract?`<span><i class="sw" style="background:var(--c-pay)"></i>En nómina</span><b>${fE(banked)}</b>`:''}${r.B>0.5?`<span><i class="sw" style="background:var(--c-cash)"></i>En negro${banked>0.5?` <small>${fN(pB*100)}\u00a0%</small>`:''}</span><b>${fE(r.B)}</b>`:''}</div>`;
  const data=[`${fN(r.daysWorked)} días trabajados (${fN(r.hours)} h)`, r.km>0.5&&`${fN(r.km)} km, unos ${fE(r.car)} de coche`,
    r.contrib>0&&`${fN(r.contrib)} días cotizados, unos ${fN(r.unemploymentDays)} de paro`].filter(Boolean).join(' · ');
  // Payslip simulator: you pick the month and its payslip appears, like a real one (items, detail, credits and deductions)
  const monthShort=d=>{const t=d.toLocaleDateString('es-ES',{month:'short'}).replace('.','');return t[0].toUpperCase()+t.slice(1)};
  const k=N.length?clamp(payslipMonthSel[o.id]??N.length-1,0,N.length-1):0, x=N[k];
  const e2=v=>fN(v,2), pct=v=>`${fN(v,2)} %`;
  // item by item when the rates are the default ones; otherwise, a single line with yours
  const workerRates=Math.abs(config.ssPct-ssTotal(SOCIAL_SECURITY.worker))<0.005?SOCIAL_SECURITY.worker:[['Seguridad Social',config.ssPct]];
  const employerRates=Math.abs(config.ssEmp-ssTotal(SOCIAL_SECURITY.employer))<0.005?SOCIAL_SECURITY.employer:[['Seguridad Social',config.ssEmp]];
  const vacationDay=r.vacationDays>0?r.vacationPayGross/r.vacationDays:0;
  // All payslips go in the same table and only the chosen month's is visible: the other rows are collapsed
  // (visibility:collapse), but they count towards column widths, so they do not change from one month to the next.
  const view=m=>m===k?'':' class="collapsed"', cl=(m,c)=>m===k?(c?` class="${c}"`:''):` class="collapsed${c?' '+c:''}"`;
  const fil=(m,c,d,credit,debit)=>`<tr${view(m)}><th>${c}</th><td class="det">${d||''}</td><td>${credit!=null?e2(credit):''}</td><td>${debit!=null?e2(debit):''}</td></tr>`;
  const payroll=x?`<div class="tablew paper"><table class="table ps-t">
      <thead><tr><th>Concepto</th><th class="det">Detalle</th><th>Abonos</th><th>Deducciones</th></tr></thead>
      <tbody>${N.map((x,m)=>`
        ${fil(m,'Salario',x.frac<1?`${x.days} días`:'mes entero',x.salary,null)}
        ${x.vac>0.5?fil(m,'Vacaciones',x.vac>=r.vacationPayGross-0.5?`${fCount(r.vacationDays)} días a ${e2(vacationDay)}`:'parte del mes',x.vac,null):''}
        <tr${cl(m,'base')}><th>Base de cotización</th><td class="det">${e2(x.gross)}</td><td></td><td></td></tr>
        ${workerRates.map(([c,p])=>fil(m,c,pct(p),null,x.gross*p/100)).join('')}
        ${fil(m,'IRPF',pct(r.irpfPct*100),null,x.irpf)}
        ${x.severance>0.5?fil(m,'Indemnización',`${LAW.severanceDaysPerYear} días por año`,x.severance,null):''}`).join('')}
      </tbody>
      <tfoot>${N.map((x,m)=>`<tr${cl(m,'tt')}><th>Totales</th><td></td><td>${e2(x.gross+x.severance)}</td><td>${e2(x.contrib+x.irpf)}</td></tr>
        <tr${cl(m,'net')}><th colspan="3">Neto a percibir</th><td>${e2(x.net)}</td></tr>`).join('')}</tfoot></table>
      <table class="table ps-t ps-emp"><thead><tr><th>Aportación de la empresa</th><th class="det">Tipo</th><th>Importe</th></tr></thead>
      <tbody>${N.map((x,m)=>employerRates.map(([c,p])=>`<tr${view(m)}><th>${c}</th><td class="det">${pct(p)}</td><td>${e2(x.gross*p/100)}</td></tr>`).join('')).join('')}</tbody>
      <tfoot>${N.map((x,m)=>`<tr${view(m)}><th colspan="2">Total empresa</th><td>${e2(x.employer)}</td></tr>`).join('')}</tfoot></table></div>`:'';
  const monthLong=d=>{const t=d.toLocaleDateString('es-ES',{month:'long',year:'numeric'}).replace(' de ',' ');return t[0].toUpperCase()+t.slice(1)};
  const sel=N.length?`<div class="ps-nav"><button type="button" class="sm" data-action="payslipMonth" data-offer="${o.id}" data-step="-1"${k>0?'':' disabled'} aria-label="Mes anterior">‹</button>
    <span>${monthLong(x.month)}${x.frac<1?` <small>(${x.days} días)</small>`:''} <small>· ${k+1} de ${N.length}</small></span>
    <button type="button" class="sm" data-action="payslipMonth" data-offer="${o.id}" data-step="1"${k<N.length-1?'':' disabled'} aria-label="Mes siguiente">›</button></div>`:'';
  const sim=N.length?`<details class="plg" data-fold="payslips"><summary>Simulador de nóminas<span class="stat dt">${N.length} ${N.length===1?'nómina':'nóminas'}</span></summary>${sel}${payroll}
    <p class="hint">Es una estimación para comparar con tus nóminas: la real puede llevar bonificaciones, otros redondeos u otra base de cotización.</p></details>`:'';
  return `<section class="season-end" id="secSeason" aria-label="Final de campaña"><h3 class="q">Final de campaña</h3>
    <div class="received">${tot}<p class="hint">${data}.</p></div>
    ${sim}
  </section>`;
}

/** Workings: what is behind each figure of the offer, step by step, in € over the whole contract. */
function workingsHTML(o,r){
  const fT=x=>fE(x), fNet=x=>fE(x*netFactor(r)), hh=x=>fN(x)+' h', dd=x=>fCount(x)+' días';
  const sec=(t,rows,note)=>`<section class="workings-sec"><h4>${t}</h4><div class="rows">${rows.filter(Boolean).join('')}</div>${note?`<p class="hint">${note}</p>`:''}</section>`;
  const tot=r.noDuration?'en un mes (sin saber la duración)':`en los ${fN(r.natDays)} días del contrato`;
  const out=[`<p class="hint">Todo ${tot}, en euros brutos salvo que diga «neto». Es lo que hay detrás de cada cifra de arriba.</p>`];
  // Time
  out.push(sec('Tiempo',[
    row('Duración',r.noDuration?'1 mes':dd(r.natDays)),
    row('Vacaciones que te corresponden',dd(r.vacationDays),{sub:r.noContract?'sin contrato no te las pagan':{taken:'las libras',paidAtEnd:'te las pagan al acabar'}[o.vacation]||'no las libras ni te las pagan aparte'}),
    row('Libranzas',dd(r.daysOffTotal),{sub:o.holidays==='yes'?'y además los festivos':''}),
    row('Días trabajados',fN(r.daysWorked),{cls:'tot'}),
    row('Horas trabajadas',hh(r.hours),{sub:`${fInput(o.hoursPerDay)} h al día · ${fN(r.hoursPerWeek)} h a la semana`}),
  ]));
  // Payroll
  if(r.grossTotal>0.5) out.push(sec('Nómina',[
    row('Nómina bruta',fT(r.grossTotal),{sub:(x=>x.length?'con '+joinAnd(x):'')([r.extraPaysNet>0.5&&'las pagas extra',r.vacationPayNet>0.5&&'las vacaciones pagadas'].filter(Boolean))}),
    row(`− Seguridad Social (${fN(config.ssPct,1)} %)`,fT(r.ss)),
    row(`− Retención de IRPF (${fN(r.irpfPct*100,1)} %)`,fT(r.irpf)),
    row('= Nómina neta',fT(r.netTotal),{cls:r.severancePay>0.5?'strong':'tot'}),
    r.severancePay>0.5&&row('+ Indemnización por fin de contrato',fT(r.severancePay),{sub:`${LAW.severanceDaysPerYear} días por año trabajado, en el finiquito`}),
    r.severancePay>0.5&&row('= Cobrado en nómina',fT(r.netTotal+r.severancePay),{cls:'tot',sub:'como en «Final de campaña»'}),
  ],`${r.othersIncome.years.length>1?`El contrato pasa de un año a otro: para el IRPF, su sueldo se reparte por días entre ${joinAnd(r.othersIncome.years)}. `:''}${r.othersIncome.n?`Para el IRPF se suman también ${fT(r.othersIncome.gross)} brutos de ${r.othersIncome.n===1?'tu otra oferta trabajada':`tus otras ${r.othersIncome.n} ofertas trabajadas`} en ${r.othersIncome.years.length>1?'esos años':'ese año'}. `:''}IRPF de esta oferta en el año, con la deducción para sueldos cerca del SMI: ${fT(r.irpfYear)}.${r.irpf-r.irpfYear>1?` En la renta te devolverían unos ${fT(r.irpf-r.irpfYear)}; no se suma a lo que ganas.`:''}`));
  // What you earn
  out.push(sec('Lo que ganas',[
    row('Total que ganas',fT(r.total),{cls:'tot'}),
  ],`Repartido: ÷ ${hh(r.hours)} = ${fE(r.perHour,2)}/h · ÷ ${fN(r.daysWorked)} días = ${fE(r.perDay)}/día${r.noDuration?'':` · ÷ ${fN(r.months,1)} meses = ${fE(r.perMonth)}/mes`}.${r.comp.unemployment>0.5?` El paro: ${fN(r.contrib)} días cotizados dan unos ${fN(r.unemploymentDays)} días de prestación; solo se cobra al llegar a ${LAW.unemployment.minDaysContributed} días cotizados en ${LAW.unemployment.windowYears} años.`:''}`));
  // Legal minimum, by item: a surplus in one does not cover a shortfall in another, so the subtraction is done for each
  if(r.minBy.month>0&&r.daysWorked>0){
    const sm=r.minSalary+r.overnightPay, f=1-config.ssPct/100;
    const rows=r.noContract?[
      row('Salario mínimo',fT(r.minSalary),{sub:r.casual?`${fE(r.smiEv,2)} por jornada × ${fN(r.daysWorked)} días`:`SMI ${r.year} de ${fE(r.smiA)} al año × ${fN(r.months,1)} meses`}),
      r.overnightPay>0.5&&row(`+ Plus de pernocta (${fN(config.overnightPct)} %)`,fT(r.overnightPay)),
      row('− Te pagan en mano, pasado a bruto',fT(r.B/f)),
      row('= Falta de sueldo',r.debtSalary>1?fT(r.debtSalary):'nada',{cls:'strong'}),
      r.minVacation>0.5&&row('Vacaciones sin pagar',fT(r.debtVacation),{sub:fDays(r.vacationDays),cls:'strong'}),
      row('Te deben',r.owed>1?fT(r.owed):'nada',{cls:'tot',vcls:r.owed>1?'bad':'ok',sub:r.owed>1?`unos ${fNet(r.owed)} netos`:''}),
    ]:[
      row('Salario mínimo',fT(r.minSalary),{sub:r.casual?`${fE(r.smiEv,2)} por jornada × ${fN(r.daysWorked)} días`:`SMI ${r.year} de ${fE(r.smiA)} al año × ${fN(r.months,1)} meses`}),
      r.overnightPay>0.5&&row(`+ Plus de pernocta (${fN(config.overnightPct)} %)`,fT(r.overnightPay)),
      row('− Sueldo en nómina',fT(r.salaryGross),{sub:'sin las vacaciones'}),
      row('= Falta de sueldo',r.debtSalary>1?fT(r.debtSalary):'nada',{cls:'strong',sub:r.debtSalary<=1&&r.salaryGross-sm>1?`sobran ${fT(r.salaryGross-sm)}`:''}),
      r.minVacation>0.5&&o.vacation!=='taken'&&row('Vacaciones mínimas',fT(r.minVacation),{sub:`${fDays(r.vacationDays)} que no libras`}),
      r.minVacation>0.5&&o.vacation!=='taken'&&row('− Vacaciones en nómina',fT(r.vacationPayGross)),
      r.minVacation>0.5&&o.vacation!=='taken'&&row('= Falta de vacaciones',r.debtVacation>1?fT(r.debtVacation):'nada',{cls:'strong',sub:r.debtVacation<=1&&r.vacationPayGross-r.minVacation>1?`sobran ${fT(r.vacationPayGross-r.minVacation)}`:''}),
      row('Faltan en nómina',r.debtTotal>1?fT(r.debtTotal):'nada',{cls:'subt',vcls:r.debtTotal>1?'bad':'ok'}),
      r.debtTotal>1&&r.B>0&&row('− Lo que cobras en negro, pasado a bruto',fT(Math.min(r.debtTotal,r.cashGrossEq)),{sub:'lo cubre, pero no cotiza'}),
      r.debtTotal>1&&r.B>0&&row('= Te deben',r.owed>1?fT(r.owed):'nada',{cls:'tot',vcls:r.owed>1?'bad':'ok',sub:r.owed>1?`unos ${fNet(r.owed)} netos`:''}),
    ];
    out.push(sec('Mínimo legal, contado por meses',rows.filter(Boolean),
      r.noContract?'':'Cada cosa se cuenta por separado: lo que sobra en el sueldo no compensa lo que falta en vacaciones, ni al revés.'));
  }
  // Extra days and overtime: the full detail (above, only the figures)
  const A=r.savings, dJ=extraDaysOf(r);
  if(A.daysValue>0&&dJ.extra>=1){
    const J=extraDaysRows(r,dJ), k=dJ.extra<10?10:1, Rd=x=>Math.round(x*k)/k;
    // Where they come from: the weekly rest you do not take and the public holidays you work (rounding leftovers go to rest)
    const holidaysWorked=o.holidays!=='yes'?r.tmHolidays:0, holidaysN=Rd(Math.min(dJ.extra,holidaysWorked)), restDays=Rd(dJ.extra-holidaysN);
    const restSplit=holidaysN>=0.5&&restDays>=0.5?[row('· Descanso semanal que no libras',fCount(restDays)),row('· Festivos que trabajas',fCount(holidaysN))]:[];
    const paidAmt=Math.max(0,A.daysValue-A.daysUnpaid);
    out.push(sec('Jornadas de más',[...J.rows,...restSplit,
      row('Valen al salario mínimo',fT(A.daysValue),{sub:`${fE(r.tmDayRef,2)} cada una${r.overnightPay>0.5?', con el plus de pernocta':''}`}),
      paidAmt>0.5&&row('− Te pagan por encima del mínimo',fT(paidAmt),{sub:r.B>0?'contando lo que cobras en negro':''}),
      row('= Sin pagar',A.daysUnpaid>1?fT(A.daysUnpaid):'nada',{cls:'tot',vcls:A.daysUnpaid>1?'bad':'ok',sub:A.daysUnpaid>1?`unos ${fNet(A.daysUnpaid)} netos`:''})].filter(Boolean),
      'Si no libras las vacaciones, esos días cuentan como laborables: los paga el dinero de las vacaciones, no son de más.'));
  }
  if(r.tmHoursOver>=0.5&&A.overtimeValue>0.5){
    const paidAmt=Math.max(0,A.overtimeValue-A.overtimeUnpaid);
    out.push(sec('Horas extra',[
      ...overtimeRows(o,r,A),
      row('Valen al salario mínimo',fT(A.overtimeValue),{sub:`${fE(r.smiHour,2)} la hora`}),
      paidAmt>0.5&&row('− Te pagan, de lo que sobra tras las jornadas',fT(paidAmt)),
      row('= Sin pagar',A.overtimeUnpaid>1?fT(A.overtimeUnpaid):'nada',{cls:'tot',vcls:A.overtimeUnpaid>1?'bad':'ok',sub:A.overtimeUnpaid>1?`unos ${fNet(A.overtimeUnpaid)} netos`:''}),
    ].filter(Boolean),'Es una estimación: en el monte no todas las horas son iguales.'));
  }
  return out.join('');
}
