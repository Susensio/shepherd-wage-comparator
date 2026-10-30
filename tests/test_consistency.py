"""What the page shows adds up: every «=» row, every bar and the figures repeated in different places."""

import pytest

# Every ledger with signs: the figure after «=» must come out of the rows above it. Bars must not overflow.
LEDGERS = r"""()=>{
  const out=[], P=t=>{if(t==null)return null; t=t.replace(/ /g,' ').trim(); if(/^nada$/.test(t))return 0; const m=t.match(/-?[\d.]+(,\d+)?/); return m?parseFloat(m[0].replace(/\./g,'').replace(',','.')):null};
  document.querySelectorAll('#result .rows').forEach(rows=>{
    let acc=null; const title=(rows.closest('section,details')?.querySelector('h4,summary,.lev-t')?.textContent||'').trim().slice(0,40);
    rows.querySelectorAll(':scope>.row').forEach(row=>{
      if(row.classList.contains('hd')) return;
      const last=row.lastElementChild, op=last.querySelector('.op')?.textContent, nmEl=last.querySelector('.nm')||last;
      const first=nmEl.querySelector('.two>span')||nmEl, v=P(first.textContent), lbl=row.firstElementChild.firstChild?.textContent?.trim();
      if(v==null) return;
      if(!op){ acc=v; return }
      if(op==='+') acc+=v; else if(op==='−') acc-=v; else if(op==='×') acc*=v;
      else if(op==='='){ const tol=Math.max(1.01,Math.abs(v)*0.006); if(acc!=null&&Math.abs(acc-v)>tol&&!(v===0&&acc<0)) out.push(`[${title}] «${lbl}» = ${v}, but the rows give ${Math.round(acc*100)/100}`); acc=v }
    });
  });
  document.querySelectorAll('#result .br').forEach(br=>{
    const s=[...br.querySelectorAll('.br-b i')].map(i=>parseFloat(i.style.width)).reduce((a,b)=>a+b,0);
    if(s>100.6) out.push(`bar «${br.querySelector('.br-l')?.textContent?.trim()?.slice(0,40)}»: segments take ${s.toFixed(1)} %`);
  });
  return out;
}"""

# Model invariants, and the same figure where it appears twice.
INVARIANTS = r"""async()=>{
  const {monthlyPayslips}=await import('./src/model/payslips.js');
  const o=app.active(), r=app.calcOffer(o), t=r.time, x=r.extra, dX=r.extraDays, out=[], close=(a,b,tol=1)=>Math.abs(a-b)<=tol;
  const weeks=(t.noDuration?365/12:t.natDays-t.vacationTaken)/7;
  if(!close(x.hours, x.days*x.workday+x.overtime,0.5)) out.push('extra hours ≠ extra days × workday + overtime');
  if(!close(x.normalHours+x.hours, t.hours,0.5)) out.push('normal + extra hours ≠ hours worked');
  if(dX.worked>dX.due&&!close(dX.worked-dX.due, dX.extra,0.11)) out.push('worked − due ≠ extra days');
  if(!close(x.workDaysWeek*x.hoursPerDay, t.hoursPerWeek,1.2)) out.push(`week in the bar ${(x.workDaysWeek*x.hoursPerDay).toFixed(1)} h ≠ hours per week ${t.hoursPerWeek.toFixed(1)} h`);
  if(x.overtimePerWeek>0.5&&!close(x.overtimePerWeek*weeks, x.overtime, Math.max(3,x.overtime*0.08))) out.push('overtime per week × weeks ≠ total overtime');
  const emp=1+r.cfg.ssEmp/100; if(r.savings.days>1&&!close(r.savings.days,x.daysUnpaid*emp)) out.push('extra-days savings ≠ unpaid × employer rate');
  const onPayroll=r.pay.net+r.employer.severance;
  const legend=document.querySelector('#secSeason .rc-legend');
  if(legend&&!r.noContract){ const b=[...legend.querySelectorAll('b')].map(e=>parseFloat(e.textContent.replace(/\./g,'').replace(',','.')));
    if(Math.abs(b[0]-onPayroll)>2) out.push(`season end: on payroll ${b[0]} ≠ net payroll ${Math.round(onPayroll)}`) }
  if(o.start&&!r.noContract&&!o.offerOnly){ const N=monthlyPayslips(o,r,r.cfg), sum=N.reduce((s,p)=>s+p.net,0);
    if(N.length&&Math.abs(sum-onPayroll)>3) out.push(`payslip simulator: net sum ${sum.toFixed(0)} ≠ net payroll ${onPayroll.toFixed(0)}`) }
  const pill=[...document.querySelectorAll('#result .pill')].map(e=>e.textContent).find(s=>/h\/semana/.test(s));
  if(pill&&Math.abs(parseFloat(pill.split('·')[1])-t.hoursPerWeek)>0.6) out.push(`pill «${pill}» ≠ ${t.hoursPerWeek.toFixed(1)} h`);
  return out;
}"""


def offer_ids(sample):
    return [o["id"] for o in sample["offers"]]


@pytest.mark.parametrize("index", range(8))
def test_offer_adds_up(loaded, sample, errors, index):
    offer = sample["offers"][index]
    loaded.evaluate(f"app.select('{offer['id']}')")
    if loaded.locator("#result .empty").count():
        pytest.skip("offer with missing data")
    loaded.evaluate("document.querySelectorAll('#result details').forEach(d=>d.open=true)")
    problems = loaded.evaluate(LEDGERS) + loaded.evaluate(INVARIANTS)
    assert not problems, f"{offer['name']}:\n" + "\n".join(problems)
    assert not errors
