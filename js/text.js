'use strict';
/* Text: summaries, pills and the texts people copy (offer card and claim). */

/** One line per form section, for the folded summaries and the copied texts. */
function summaries(o,r){
  const one=num(o.duration)===1, dur=o.durationUnit==='unknown'?'Duración sin saber':!(num(o.duration)>0)?'Duración sin poner':`${fInput(o.duration)} ${o.durationUnit==='days'?(one?'día':'días'):(one?'mes':'meses')}`;
  const holidaysN=o.holidays==='yes', off=num(o.daysOff)>0?`libra ${fInput(o.daysOff)} ${{week:'a la semana',total:'en total'}[o.daysOffUnit]||'al mes'}${holidaysN?' y los festivos':''}`:holidaysN?'libra los festivos':'sin libranzas';
  const u=UNIT_TXT[o.payUnit];
  const vac={taken:'vacaciones disfrutadas',paidAtEnd:'vacaciones pagadas aparte',included:'vacaciones incluidas'}[o.vacation]||'vacaciones sin poner';
  const extraPaysTxt=!['year','total'].includes(o.payUnit)&&o.extraPays==='separate'?' · 2 pagas extra':'';
  const cashUnitTxt=UNIT_TXT[o.cashUnit];
  const mealsTxt=mealsGiven(o).length?`te dan ${mealsListTxt(o)}`:'sin comida';
  const car=o.car==='noCar'?'Sin tu coche':`Tu coche${r.km>0?` · ~${extrap(r)||r.months<1?`${fN(r.km)}\u00a0km en total`:`${fN(r.months>0?r.km/r.months:0)}\u00a0km/mes`} con el tuyo`:''}`;
  return {
    time:`${datesTxt(o)?datesTxt(o)+' · ':o.year?o.year+' · ':''}${dur} · ${off} · ${num(o.hoursPerDay)>0?`${fInput(o.hoursPerDay)}\u00a0h/día`:'horas sin poner'}`,
    payroll:o.contract==='none'?'Sin contrato: todo en mano':o.payrollMin?`El mínimo · ${vac}`:num(o.payAmount)>0?`${fInput(o.payAmount)} ${u} ${o.payType==='net'?'neto':'bruto'}${extraPaysTxt} · ${vac}`:'Nada en nómina',
    b:r.split?(r.split.b>0.5?`El resto hasta ${fSplit(r.split.T,r.split.u)}: ~${fSplit(r.split.b,r.split.u)}`:'Nada'):num(o.cashAmount)>0?`${fInput(o.cashAmount)} ${cashUnitTxt}`:'Nada',
    housing:`${o.overnight==='yes'?'Duermes en borda · ':''}${o.housing==='yes'?'Con casa':'Sin casa'} · ${mealsTxt}`,
    car,
    others:`${num(o.expenses)>0?`Gastos ${fE(num(o.expenses))}/mes`:'Sin otros gastos'} · IRPF ${o.irpfMode==='manual'?fN(num(o.irpfManual),1)+'\u00a0%':'estimado '+fN(r.irpfPct*100,1)+'\u00a0%'}`,
  };
}

/**
 * Explanations shown when tapping pills and rows. In one place so the pill and the breakdown say the same.
 */
function explanations(o,r){
  return {
    housing: `Te ponen casa.${config.inKind?` Se cuenta como ${fE(rentPerMonth(o))} al mes que te ahorras, lo que te costaría un alquiler. Lo cambias para todas en «Tus datos», o solo para esta en «Casa y comida».`:''}`,
    food: `Te dan ${mealsListTxt(o)}.${config.inKind?` Te ahorras unos ${fE(foodPerDay(o))} por día trabajado. El precio de cada comida lo cambias en «Tus datos».`:''}`,
    b: 'Lo que cobras en negro cuenta como dinero, pero no cotiza: no da paro, jubilación ni baja, ni cuenta para la indemnización.',
    allPayroll: 'Todo lo que cobras va en nómina y cotiza: cuenta para el paro, la jubilación, la baja y la indemnización.',
    severance: `Al acabar un contrato temporal te toca una indemnización de ${LAW.severanceDaysPerYear} días de salario por año trabajado (Estatuto de los Trabajadores, art. 49.1.c). Va en el finiquito.`,
    contract: {
      temporary:`Contrato por temporada. Al acabar te toca una indemnización de ${LAW.severanceDaysPerYear} días de salario por año trabajado${r.severancePay>0.5?`: unos ${fE(r.severancePay)} brutos`:''}.${r.casual?` Como dura ${LAW.casualMaxDays} días o menos, el mínimo es el de temporero: ${fE(r.smiEv,2)} por jornada.`:''}`,
      seasonal:'Trabajas por temporadas, pero el contrato sigue entre una y otra: la empresa tiene que volver a llamarte cada campaña, en el orden que marque el convenio. Al acabar cada temporada no hay indemnización, y entre campañas puedes cobrar el paro si tienes cotizado lo suficiente. Si no te llaman, es un despido.',
      permanent:`Contrato indefinido todo el año. Si te despiden sin causa justificada te corresponden ${LAW.dismissalDaysPerYear} días de salario por año trabajado.`,
      none:'Trabajar sin contrato ni alta en la Seguridad Social es ilegal. No cotizas: no generas paro ni jubilación, y si te accidentas no estás cubierto. La responsabilidad es del ganadero, no tuya.',
    }[o.contract],
  };
}


/* Offer pills. Colour: green = in your favour or legal · amber = risk or below the legal level · red = clearly wrong · grey = data.
   Tapping one shows its explanation with the offer's figures. */
const ICONS={
  cal:'<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>',
  clock:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  home:'<path d="M4 11l8-6 8 6v9H4z"/><path d="M10 20v-5h4v5"/>',
  food:'<path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 3c-2 0-3 3-3 7h3v11"/>',
  cash:'<rect x="3" y="7" width="18" height="10" rx="1"/><circle cx="12" cy="12" r="2.5"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  scale:'<path d="M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 006 0zM18 8l-3 6a3 3 0 006 0z"/>',
  moon:'<path d="M20 14A8 8 0 1110 4a6 6 0 0010 10z"/>',
  doc:'<path d="M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 16h6"/>',
};
const pill=(ic,txt,cls='',tip='')=>`<span class="pill ${cls}"${tipA(tip)}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[ic]}</svg>${txt}</span>`;

function card(o,r){
  const p=[], hs=r.hoursPerWeek, hPerDay=num(o.hoursPerDay), overTxt=r.noDuration?'al mes':'en todo el contrato', X=explanations(o,r);
  const vd=fCount(r.vacationDays);
  // The colour of each pill, the same as its right in «¿Es legal?»
  const E=Object.fromEntries((lawsOf(o,r,money(r,'month'))||[]).map(x=>[x[1],x[0]]));
  const est=(t,def)=>t in E?(E[t]===true?'ok':E[t]===false?'bad':E[t]==='warn'?'warn':''):def;
  p.push(pill('clock',`${fInput(o.hoursPerDay)}\u00a0h/día · ${fN(hs)}\u00a0h/semana`, est('Jornada',hs<=H_ORDINARY?'ok':'warn'),
    `Trabajas unas ${fN(hs)}\u00a0h a la semana. La jornada ordinaria son ${LAW.weeklyHours} h. En ganadería puede alargarse hasta ${LAW.maxWeekHours} h a la semana y ${LAW.maxDayHours} h al día, pero lo que pasa de ${LAW.weeklyHours} son horas extra: se pagan o se devuelven en descanso.`
    +(t=>t?` Te salen ${t}.`:'')(joinAnd([extraDaysOf(r).extra>=1&&r.savings.daysValue>0&&`unos ${fCount(extraDaysOf(r).extra)} días de más ${overTxt}`,r.savings.overtimeWeek>=0.5&&`unas ${fN(r.savings.over40Week)}\u00a0h a la semana por encima de 40`].filter(Boolean)))+(hs>H_MAX||hPerDay>LAW.maxDayHours?' Pasas del límite legal.':'')));
  const nl=num(o.daysOff), daysOffTxt=`Libras ${fInput(o.daysOff)} ${nl===1?'día':'días'} ${{week:'a la semana',total:'en total'}[o.daysOffUnit]||'al mes'}`;
  p.push(pill('cal',r.daysOffMonth<0.05?'Sin libranzas':daysOffTxt, est('Descanso semanal',r.restShort<1?'ok':'warn'),
    `Por ley te corresponden al menos ${fN(LAW.weeklyRest,1)} días de descanso por semana (unos ${fN(LAW.weeklyRest*DM/7,1)} al mes), sin contar vacaciones. Se pueden juntar en periodos de hasta ${LAW.restPeriodWeeks} semanas.`
    +(r.restShort>=1?` Con esta oferta trabajas unos ${fN(r.restShort)} días ${overTxt} que deberían ser de descanso.`:' Esta oferta lo cumple.')));
  if(X.contract) p.push(pill('doc',contract(o).pillLabel,r.noContract?'bad':'ok',X.contract));
  const pct=r.cashShare*100;
  if(!r.noContract) p.push(r.B<=0.5?pill('cash','Todo en nómina','ok',X.allPayroll)
    :pill('cash',r.noContract||pct>=99.5?'Todo en negro':`${fN(pct)}\u00a0% en negro`,r.noContract||pct>=99.5?'bad':'warn',X.b));
  p.unshift(...p.splice(p.length-(X.contract?2:1))); // contract and money first: that is what matters most
  // From most to least important: first what is wrong, then warnings and finally what is fine (within each group, in that order)
  const RANK={bad:0,warn:1,'':2,ok:3}, rank=h=>RANK[(h.match(/class="pill ([a-z]*)/)||[])[1]||''];
  p.sort((a,b)=>rank(a)-rank(b));
  return `<div class="pills">${p.join('')}</div>`;
}

/** The extra days and the overtime (per week) you are not paid for; if none is paid, all of them. */
function unpaidTime(r){
  const A=r.savings, dJ=extraDaysOf(r);
  return {d:A.days>1?(A.daysUnpaid>=A.daysValue-1?dJ.extra:A.daysUnpaidEq):0, h:(S=>(t=>t>=0.5?t:0)(S.restDayHours*(A.daysValue>0&&A.days>1?A.daysUnpaid/A.daysValue:0)+S.ext*(A.overtimeValue>0&&A.extra>1?A.overtimeUnpaid/A.overtimeValue:0)))(hoursWeek(r)), dJ};
}
/** Short card to send on WhatsApp or keep in notes. */
function cardText(o,r){
  const s=summaries(o,r);
  return [
    o.name||'Oferta',
    `${s.time} → ${fN(r.daysWorked)} días trabajados`,
    `Nómina: ${s.payroll}`,
    r.B>0?`En negro: ${s.b[0].toLowerCase()+s.b.slice(1)}`:'',
    `${s.housing} · ${s.car}`,
    `Ganas: ${fE(r.perHour,2)}/hora · ${fE(r.perDay)}/día · ${fE(r.perMonth)}/mes${r.noDuration?' (sin saber la duración)':` · ${fE(r.total)} en total`}`,
    legalLine(o,r)?.txt||'',
    (A=>[A.daysValue>0&&extraDaysOf(r).extra>=1&&`Jornadas de más: ${fCount(extraDaysOf(r).extra)} en el contrato`,r.tmHoursOver>=0.5&&`Horas extra: unas ${fN(A.over40Week)} a la semana por encima de 40 (estimado)`].filter(Boolean).join(' · '))(r.savings),
    (A=>(D=>{const L=[[A.b,r.noContract?'por no hacerte contrato':'por pagarte en negro'],[A.min,minimumShortTxt(r)],[A.days,'por las jornadas de más'],[A.extra,'por las horas extra (estimado)']].filter(x=>x[0]>1);
      return L.length?`Para negociar, el ganadero se ahorra ${unitPhrase(D,r)}: ${joinAnd(L.map(([v,t])=>`${D.inUnit(v)} ${t}`))}`:''})(money(r,offerUnit(o,r))))(employerSavings(r)),
    r.unemploymentDays>0?`Genera ~${fN(r.unemploymentDays)} días de paro (se cobran al llegar a ${LAW.unemployment.minDaysContributed} días cotizados en ${LAW.unemployment.windowYears} años)`:'No genera paro',
  ].filter(Boolean).join('\n');
}

/** Text for the union, the labour inspectorate or your own notes. */
function claimText(o,r){
  const rs=summaries(o,r), A=r.savings, dJ=extraDaysOf(r), L=[], fNet=x=>fE(x*netFactor(r)), min=t=>t[0].toLowerCase()+t.slice(1);
  L.push(`Oferta: ${o.name||'sin nombre'}`);
  L.push(`Condiciones: ${rs.time}. ${rs.payroll}.${r.B>0?` En negro: ${min(rs.b)}.`:''} ${rs.housing}.`);
  L.push(`Días trabajados: ${fN(r.daysWorked)} · Horas: ${fN(r.hours)} (${fN(r.hoursPerWeek)} h a la semana).`);
  L.push('');
  // 1. Minimum wage
  L.push('SALARIO');
  if(r.noContract){
    L.push(`Sin contrato ni alta en la Seguridad Social (Estatuto, art. 8). Se pagan ${fE(r.B)} en mano en todo el contrato${r.months>=1?` (${fE(r.B/r.months)} al mes)`:''}, sin cotizar.`);
    L.push(`Mínimo en todo el contrato: ${fE(r.minSalary+r.overnightPay)} brutos, unos ${fE(r.minNetNoContract)} netos (SMI ${r.year}, ${r.smiRd}${r.overnightPay>0?`, más el ${fN(config.overnightPct)} % por pernoctar fuera por pastoreo`:''}).`);
    if(r.debtVacation>1) L.push(`Vacaciones sin pagar (${fDays(r.vacationDays)}): ${fE(r.debtVacation)} brutos, unos ${fNet(r.debtVacation)} netos (Estatuto, art. 38).`);
    if(r.debtSalary>1) L.push(`Lo que se paga no llega al mínimo: faltan ${fE(r.debtSalary)} brutos.`);
  } else {
    L.push(`Tipo de contrato: ${contract(o).phrase}. Nómina bruta en todo el contrato: ${fE(r.grossTotal)} (unos ${fE(r.netTotal)} netos).`);
    L.push(`Mínimo en todo el contrato, contado por meses: ${fE(r.minBy.month)} brutos.`);
    L.push(`- SMI ${r.year} (${r.smiRd})${r.casual?`, ${fE(r.smiEv,2)} por jornada (contratos temporales de ${LAW.casualMaxDays} días o menos)`:`, ${fE(r.smiA)} al año para ${LAW.weeklyHours} h semanales`}: ${fE(r.minSalary)}.`);
    if(r.overnightPay>0) L.push(`- Plus por pernoctar fuera por pastoreo, ${fN(config.overnightPct)} % del salario (convenio del campo de Huesca, art. 29): ${fE(r.overnightPay)}.`);
    if(r.minVacation>0) L.push(`- Vacaciones (${fDays(r.vacationDays)}; Estatuto, art. 38): ${fE(r.minVacation)}.`);
    const {salary,overnight,vac}=r.debtParts;
    if(r.debtTotal>1){
      const P=[salary>1&&['de salario',salary],overnight>1&&['de plus de pernocta',overnight],vac>1&&['de vacaciones',vac]].filter(Boolean);
      L.push(`En nómina faltan ${fE(r.debtTotal)} brutos ${P.length===1?P[0][0]:`(${joinAnd(P.map(([t,v])=>`${fE(v)} ${t}`))})`}. Lo que sobra en un concepto no compensa lo que falta en otro.`);
      if(r.B>0) L.push(r.owed>1?`Se pagan además ${fE(r.B)} sin declarar, que no cotizan. Contándolos, siguen faltando ${fE(r.owed)} brutos, unos ${fNet(r.owed)} netos.`
        :`Se pagan además ${fE(r.B)} sin declarar: cubren esa falta, pero no cotizan (menos paro y menos jubilación).`);
    } else {
      L.push('La nómina llega al mínimo legal.');
      if(r.B>0) L.push(`Se pagan además ${fE(r.B)} sin declarar, que no cotizan.`);
    }
  }
  // 2. Rest and extra days
  if(A.daysValue>0&&dJ.extra>=1){
    L.push(''); L.push('DESCANSO Y JORNADAS DE MÁS');
    if(r.restShort>=1) L.push(`Descanso semanal: ${fN(r.daysOffTotal)} días libres frente a un mínimo de ${fN(r.restLegal)} (día y medio por semana; Estatuto, art. 37.1).`);
    if(o.holidays!=='yes'&&r.tmHolidays>=0.5) L.push(`Festivos trabajados: ${Math.round(r.tmHolidays)<=1?'uno':`unos ${fN(r.tmHolidays)}`} (Estatuto, art. 37.2).`);
    L.push(`Jornadas de más: ${fCount(dJ.extra)}. De ${fCount(r.natDays)} días de contrato, ${fCount(dJ.due)} son laborables, sin el descanso semanal ni los festivos${r.vacationTaken>0?' ni las vacaciones':''}, y se trabajan ${fCount(dJ.worked)}.`);
    L.push(`Cada una, una jornada normal de ${f1(r.tmWorkday)} h al salario mínimo (${fE(r.tmDayRef,2)}${r.overnightPay>0.5?', con el plus de pernocta':''}); lo que pasa de ahí va en las horas extra. Valen ${fE(A.daysValue)} brutos.`
      +(A.daysUnpaid>1?` ${A.daysValue-A.daysUnpaid>1?`Lo que se paga por encima del mínimo${r.B>0?', contando lo cobrado en negro,':''} cubre ${fE(A.daysValue-A.daysUnpaid)}; s`:'S'}in pagar: ${fE(A.daysUnpaid)} brutos, unos ${fNet(A.daysUnpaid)} netos.`:' Lo que se paga por encima del mínimo las cubre.'));
  }
  // 3. Overtime (estimate)
  if(r.tmHoursOver>=0.5){
    L.push(''); L.push('HORAS EXTRA (ESTIMACIÓN)');
    L.push(`Jornadas de ${fInput(o.hoursPerDay)} h: ${f1(Math.max(0,num(o.hoursPerDay)-r.tmWorkday))} h de más cada día sobre la jornada normal (40 h semanales; Estatuto, art. 34), en ${fCount(r.daysWorked)} días trabajados: ${fN(r.tmHoursOver)} h, unas ${fN(A.overtimeWeek)} a la semana.`);
    L.push(`Al salario mínimo por hora (${fE(r.smiHour,2)}), valen ${fE(A.overtimeValue)} brutos.`+(A.overtimeUnpaid>1?` Sin pagar: ${fE(A.overtimeUnpaid)} brutos, unos ${fNet(A.overtimeUnpaid)} netos.`:' Lo que se paga por encima del mínimo las cubre.')
      +' Las horas extra se pagan al menos como una hora normal o se compensan con descanso (Estatuto, art. 35).');
    if(r.hoursPerWeek>H_MAX||num(o.hoursPerDay)>LAW.maxDayHours) L.push(`Se supera el máximo de la ganadería: ${LAW.maxWeekHours} h a la semana y ${LAW.maxDayHours} h al día (RD 1561/1995, art. 5).`);
  }
  L.push('');
  L.push('Cálculo aproximado hecho con el Comparador de jornales. Conviene revisarlo con el convenio vigente y un sindicato.');
  return L.join('\n');
}
