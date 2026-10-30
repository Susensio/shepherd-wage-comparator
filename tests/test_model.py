"""The calculations, checked against figures worked out by hand from the law."""

CHECKS = r"""()=>{
const out=[], ok=(name,cond,info)=>out.push({name,ok:!!cond,info:info===undefined?'':String(info)});
const R=x=>Math.round(x*100)/100;
// A permanent full-time contract at exactly the 2026 minimum wage, 14 payments, with days off and holidays taken
const base={...DEF_OFFER,id:'t',name:'t',start:'2026-01-01',contract:'permanent',duration:12,durationUnit:'months',hoursPerDay:8,daysOff:2,daysOffUnit:'week',
  holidays:'yes',payType:'gross',payAmount:1221,payUnit:'month',extraPays:'separate',vacation:'taken',housing:'no',car:'noCar',kmHome:0,overnight:'no'};
const C=o=>calc(norm({...base,...o}),config,{noOthers:true});

let r=C({});
ok('minimum wage, 14 payments: nothing owed', r.debtTotal<1, R(r.debtTotal));
ok('minimum wage: 40 h a week', Math.abs(r.hoursPerWeek-40)<0.01, r.hoursPerWeek);
ok('minimum wage: no extra time', r.tmHours<0.06*r.tmHoursNorm, R(r.tmHours));
ok('minimum wage: nothing unpaid', r.savings.daysUnpaid+r.savings.overtimeUnpaid<1);
ok('minimum wage: 17,094 € gross a year', Math.abs(r.grossTotal-17094)<1, R(r.grossTotal));
ok('minimum wage: no IRPF', r.irpf<0.5, R(r.irpf));
ok('minimum wage: no stamp', !r.stamp[0], r.stamp[0]);

r=C({payAmount:17094/12,extraPays:'included'});
ok('prorated minimum wage: nothing owed', r.debtTotal<1, R(r.debtTotal));

r=C({payAmount:1220});
ok('one euro short a month: 14 € owed', Math.abs(r.debtTotal-14)<0.5, R(r.debtTotal));
ok('one euro short: «Bajo el mínimo» stamp', r.stamp[0]==='Bajo el mínimo', r.stamp[0]);

r=C({contract:'temporary',duration:100,durationUnit:'days',payAmount:57.82,payUnit:'day',vacation:'paidAtEnd',extraPays:'included'});
ok('100-day temporary contract: casual-worker minimum', r.casual);
ok('casual-worker daily minimum: nothing owed', r.debtTotal<1, R(r.debtTotal));

r=C({payType:'net',payAmount:1500,payUnit:'month',extraPays:'included'});
ok('asked-for net = calculated net', Math.abs(r.netTotal/12-1500)<0.5, R(r.netTotal/12));

const inc=C({contract:'temporary',duration:3,payAmount:80,payUnit:'day',vacation:'included',extraPays:'included'});
const sep=C({contract:'temporary',duration:3,payAmount:80,payUnit:'day',vacation:'paidAtEnd',extraPays:'included'});
ok('vacation included: total = daily wage × paid days', Math.abs(inc.grossTotal-80*inc.natDays*(5/7))<1, R(inc.grossTotal));
ok('vacation paid at the end: total = daily wage × paid days + vacation', Math.abs(sep.grossTotal-80*sep.natDays*(5/7)-sep.vacationPayGross)<1);

for(const o of offers){ const r=calc(o);
  ok(`breakdown adds up to the total (${o.name})`, Math.abs(incomeOf(r)-r.expenses-r.total)<0.01);
  ok(`per month × months = total (${o.name})`, r.noDuration||Math.abs(r.perMonth*r.months-r.total)<0.01) }

ok('360 days contributed → 120 days of unemployment benefit', Math.abs(unemploymentBenefit(20000,360).days-120)<0.01);

const d26=SMI[2026].ded;
ok('IRPF on the 2026 minimum wage = 0', irpfTax(17094,6.5,d26)<0.01, R(irpfTax(17094,6.5,d26)));
ok('IRPF on 20,000 € ≈ 1,345 €', Math.abs(irpfTax(20000,6.5,d26)-1345)<2, R(irpfTax(20000,6.5,d26)));
ok('minimum-wage deduction ends at 20,048.45 €', Math.abs(Math.max(0,d26.max-(20048.45-d26.from)*d26.taper))<0.01);

r=C({contract:'none',payAmount:0,cashAmount:0,duration:1}); const mn=r.minNetNoContract;
r=C({contract:'none',payAmount:0,cashAmount:mn,cashUnit:'total',duration:1});
ok('no contract, paid the minimum: no salary owed', r.debtSalary<1, R(r.debtSalary));
ok('no contract: vacation owed', r.debtVacation>1, R(r.debtVacation));

r=C({overnight:'yes'});
ok('overnight bonus: 25 % of the minimum wage owed', Math.abs(r.debtSalary-17094*0.25)<1, R(r.debtSalary));
ok('overnight bonus: «Sin plus» stamp', r.stamp[0]==='Sin plus', r.stamp[0]);

r=C({cashAmount:300,cashUnit:'month'});
ok('cash: employer saves the contributions', Math.abs(r.savings.b-(r.cashGrossEq*(1+config.ssEmp/100)-r.B))<0.01, R(r.savings.b));

r=C({hoursPerDay:10.5,daysOff:1,holidays:'no'});
ok('63 h a week: extra hours = hours − normal hours', Math.abs(r.tmHours-(r.hours-r.tmHoursNorm))<0.01, R(r.tmHours));
ok('63 h a week: unpaid ≤ value', r.savings.daysUnpaid<=r.savings.daysValue+0.01&&r.savings.overtimeUnpaid<=r.savings.overtimeValue+0.01);

ok('102 days from 21 June = 3 months and 10 days', Math.abs(payrollMonths(parseDate('2026-06-21'),102)-10/3)<1e-9);
r=C({start:'2026-06-21',duration:102,durationUnit:'days',payAmount:2100,payType:'net',extraPays:'included'});
ok('2,100 € net × 3 months and 10 days = 7,000 €', Math.abs(r.netTotal-7000)<1, R(r.netTotal));

for(const o of offers){ if(!o.start||o.offerOnly) continue; const r=calc(o), N=monthlyPayslips(o,r); if(!N.length) continue;
  const sum=N.reduce((s,x)=>s+x.gross,0);
  ok(`payslips add up to the gross (${o.name})`, Math.abs(sum-r.grossTotal)<0.5, R(sum)+' vs '+R(r.grossTotal)) }
return out}"""


def test_calculations(loaded, errors):
    results = loaded.evaluate(CHECKS)
    failed = [f"{c['name']}: {c['info']}" for c in results if not c["ok"]]
    assert len(results) > 30
    assert not failed, "\n".join(failed)
    assert not errors
