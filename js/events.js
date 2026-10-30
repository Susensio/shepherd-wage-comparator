'use strict';
/* Events: the offer form, folds, the «Hecho» button, tabs, button actions and «Tus datos». */

/* Offer form */
form.addEventListener('input',e=>{
  const el=e.target;
  // End date: becomes a duration in days (with a start); without a start, sets the start from the duration
  if(el.id==='fin'){
    if(!el.value) return;
    const f=parseDate(el.value), dur=num(active.duration)>0&&active.durationUnit!=='unknown';
    if(active.start){
      const days=Math.round((f-parseDate(active.start))/864e5)+1; if(days<1) return;
      active.duration=days; active.durationUnit='days';
    } else if(dur){
      const n=active.durationUnit==='days'?Math.round(num(active.duration)):Math.round(num(active.duration)*DM);
      const a=new Date(f); a.setDate(a.getDate()-n+1); active.start=isoOf(a);
    } else return;
    animateFields=true; defaultVacation(active); fill(active); persist(); renderAll(); return;
  }
  if(!el.name) return;
  if(el.type==='radio'&&el.name==='durationUnit'&&el.checked&&el.value!==active.durationUnit&&el.value!=='unknown'&&active.durationUnit!=='unknown'){
    // Changing the unit converts the duration (4 months ↔ 122 days)
    const v=num(active.duration);
    active.duration=el.value==='days'?Math.round(v*DM):Math.round(v/DM*10)/10;
    active.durationUnit=el.value; $('#duration').value=fIn(active.duration,active.duration%1?1:0);
  }
  else if(el.type==='radio'){ if(el.checked) active[el.name]=el.value }
  else if(el.type==='checkbox') active[el.name]=el.checked;
  else if(el.type==='date') active[el.name]=el.value;
  else active[el.name]=el.name==='name'?el.value:el.name==='rentValue'&&el.value.trim()===''?'':num(el.value); // empty rent: the one in «Tus datos»
  animateFields=true;
  if(el.name==='vacation') delete active.vacationAuto;
  if(el.name==='cashMode'&&el.value==='total'){
    if(!(num(active.totalAmount)>0)) active.totalUnit=['day','month'].includes(active.payUnit)?active.payUnit:'month';
    fill(active);
  }
  defaultVacation(active);
  if(['start','duration','durationUnit'].includes(el.name)) paintEnd(active);
  persist(); renderAll();
});
/** For short contracts, if you have said nothing about vacation, it is set to «paid at the end» (and the page says so). */
function defaultVacation(o){
  if(o.contract==='none') return;
  if(!o.vacation&&shortContract(o)){ o.vacation='paidAtEnd'; o.vacationAuto=true }
  else if(o.vacationAuto&&!shortContract(o)){ o.vacation=''; delete o.vacationAuto }
  else return;
  if(o===active) for(const r of form.querySelectorAll('input[name=vacation]')) r.checked=r.value===o.vacation;
}
form.addEventListener('focusout',e=>{ // an empty name does not leave the offer without a name
  if(e.target.name==='name'&&!active.name.trim()){ active.name='Oferta '+(offers.indexOf(active)+1); e.target.value=active.name; persist(); renderAll() }
});
/** Which named collapsibles (data-fold) you left open. The result is repainted on every change and reopens them. */
const folds={time:true,payroll:true,breakdown:true,...renameKeys(store.get(KEY.legacyFolds,{}),LEGACY.folds),...renameKeys(store.get(KEY.folds,{}),LEGACY.folds)};
function saveFold(d){ if(d.dataset.fold){ folds[d.dataset.fold]=d.open; store.set(KEY.folds,folds) } }
document.addEventListener('toggle',e=>{ if(e.target.dataset?.fold&&!e.target._animating) saveFold(e.target) },true);
function restoreFolds(root){ for(const d of root.querySelectorAll('[data-fold]')) d.open=!!folds[d.dataset.fold] }
restoreFolds(document);
$('#editWrap').addEventListener('toggle',()=>{ if(!$('#editWrap')._animating) syncEditor() });
let askedToSee=null; // id of the offer where you pressed «Hecho» with missing data: they are highlighted until you fill them in
/** «Hecho»: if something is missing it takes you there and does not close; if complete, it closes and scrolls to the result. */
function done(fromTop){
  const f=missing(active);
  if(!f.length&&fromTop){ // from the top you see the form fold, and then it scrolls to the result
    askedToSee=null; $('#goMsg').textContent=''; document.activeElement?.blur?.();
    // fold first and then scroll: done at the same time, the target moves meanwhile and it overshoots
    const a=toggleFold($('#editWrap'),false);
    (a?a.finished:Promise.resolve()).catch(()=>{}).then(()=>scrollToEl($('#results'))); return }
  if(!f.length){ askedToSee=null; $('#goMsg').textContent=''; document.activeElement?.blur?.();
    // Folding the form makes the result jump up: it is compensated so it stays put and then scrolls to it
    clearTimeout(scrollToEl.t); // so it does not clash with another pending scroll
    const res=$('#results'), before=res.getBoundingClientRect().top;
    openEditor(false);
    window.scrollTo({top:Math.max(0,scrollY+res.getBoundingClientRect().top-before),behavior:'instant'});
    scrollToEl(res); return }
  askedToSee=active.id; markMissing();
  const el=$(MISSING_FIELD[f[0]]), sec=el.closest('details.sec'); if(sec) sec.open=true;
  scrollToEl(el.closest('.fld'),'center'); el.focus({preventScroll:true});
}
/** Highlights in the form what is missing to see the result. */
function markMissing(){
  const f=askedToSee===active.id?missing(active):[];
  for(const [k,sel] of Object.entries(MISSING_FIELD)) $(sel).closest('.fld').classList.toggle('missing',f.includes(k));
  $('#goMsg').textContent=f.length?`Falta ${joinAnd(f)}.`:'';
}

const uniqueName=base=>{let n=base,i=2;while(offers.some(o=>o.name===n))n=`${base} ${i++}`;return n};
const deleteOffer=doubleTap($('#btnDel'),'Borrar',4000);
/** Everything done with a button: the button says what with data-action (and data-id if it belongs to an offer). */
/** Tabs: Ofertas, Comparar, Leyes and Ajustes. `scrollUp`: if the page is further down, go back to the tabs. */
const TABS=['offers','compare','laws','settings'];
function showTab(k,scrollUp){
  if(!TABS.includes(k)) k='offers';
  for(const t of TABS){ $(`[data-panel=${t}]`).hidden=t!==k; $(`.tabs [data-tab=${t}]`).setAttribute('aria-selected',t===k) }
  store.set(KEY.tab,k);
  if(k==='settings') renderBackupNotice();
  if(k==='compare') renderTimeline();
  if(k==='offers'){ renderChips.scroll=true; renderChips() } // on return, keep the chosen offer in view in the top row
  const n=$('.tabs'); if(scrollUp&&n.getBoundingClientRect().top<0) scrollTo({top:n.offsetTop});
}

/** What the sheep says when tapped (never the same twice in a row). */
const BLEATS=['¡Beee!','¡Meee!','¡Mééé!','Bee… paga la pernocta','¡Contrato o nada!','Beee… ¿y las horas extra?',
  'La lana, en nómina','Bee-bé el negro, no cotiza','¡Descanso semanal, beee!','Esquílame, pero con alta',
  'Yo también duermo en la borda','Meee… ¿vacaciones?','¡Sindicato, beee!','Ni un día sin contrato',
  'Bee… 1,5 días libres por semana','Contigo hasta la majada','Más hierba y menos horas',
  'Mi pastor no se regala','¡Que coticen hasta las ovejas!','Beee… ¿esto lo sabe la Inspección?'];
const ACTIONS={
  tab(b){ showTab(b.dataset.tab,true) },
  // Comparar: tapping an offer picks it for the head to head (with a third one, the first picked drops out)
  pickPair(b){ const id=b.dataset.id; pair=pair.includes(id)?pair.filter(x=>x!==id):[...pair,id].slice(-2); renderCompare();
    if(pair.length===2) scrollToEl($('#pairBlk'),'center') },
  startPair(){ pairMode=true; pair=[]; renderCompare() },
  closePair(){ pairMode=false; pair=[]; renderCompare() },
  beee(b){ const t=b.querySelector('.beee'); const F=BLEATS.filter(f=>f!==t.textContent); t.textContent=F[Math.floor(Math.random()*F.length)];
    b.classList.remove('bleating'); void b.offsetWidth; b.classList.add('bleating'); clearTimeout(b._t); b._t=setTimeout(()=>b.classList.remove('bleating'),1600) },
  /* Offers */
  newOffer(){ $('#tplPanel').hidden?openTpl():closeTpl() },
  choose(b){
    if(!$('#tplPanel').hidden) closeTpl();
    if(b.dataset.id!==activeId){ deleteOffer.reset(); renderChips.scroll=true; select(b.dataset.id) }
  },
  template(b){
    const t=TPL.find(x=>x.k===b.dataset.tpl);
    const o=makeOffer({...t?.v,name:uniqueName(t?.t||'Oferta')});
    if(placeholderId&&offers.length===1&&offers[0].id===placeholderId) offers=[];
    placeholderId=null;
    offers.push(o); closeTpl(); renderChips.scroll=true; select(o.id); openEditor(true);
    for(const d of $$('[data-fold=time],[data-fold=payroll]')) d.open=true;
    const n=$('#name'); scrollToEl(n,'center'); n.focus({preventScroll:true}); n.select();
  },
  duplicate(){
    const o={...active,id:newId(),name:active.name+' (copia)',cmp:true};
    offers.splice(offers.indexOf(active)+1,0,o); select(o.id);
  },
  deleteOffer(){
    if(!deleteOffer.confirm('¿Borrar «'+active.name+'»? Toca otra vez')) return;
    const i=offers.indexOf(active); offers.splice(i,1);
    if(!offers.length){ // no offers left: back to the welcome
      const o=makeOffer(); offers.push(o); placeholderId=o.id;
      select(o.id); store.set(KEY.offers,null); openTpl(); return;
    }
    select(offers[Math.max(0,i-1)].id);
  },
  edit(){ toggleFold($('#editWrap'),true) },
  complete(){ if(!$('#editWrap').open) openEditor(true); done() },
  done(){ done(false) }, // the «Hecho» at the bottom (the one at the top is the collapsible's title)
  /* Result and comparison */
  claim(){ copyText(claimText(active,calc(active)),$('#claimMsg'),{ok:'Texto copiado.',failMsg:'No se pudo copiar. Aquí lo tienes para seleccionarlo:',rows:12}) },
  workings(){ const d=$('[data-fold=workings]'); if(d){ d.open=true; saveFold(d); scrollToEl(d) } },
  payslipMonth(b){ const id=b.dataset.offer, r=calc(active), n=monthlyPayslips(active,r).length; payslipMonthSel[id]=clamp((payslipMonthSel[id]??n-1)+Number(b.dataset.step),0,n-1); renderAll() },
  card(){ copyText(cardText(active,calc(active)),$('#cardMsg'),{ok:'Ficha copiada.',failMsg:'No se pudo copiar. Aquí la tienes para seleccionarla:',rows:7}) },
  view(b){ showTab('offers'); renderChips.scroll=true; select(b.dataset.id); scrollToEl($('#results')) }, // to see the offer, without opening the form
  /* Backup */
  download(b){ downloadBackup(b.closest('#backupNotice')?$('#noticeMsg'):$('#bkMsg')) },
  snoozeBackup(){ store.set(KEY.backupNotice,Date.now()+7*DAY); renderBackupNotice() },
  async copyBackupText(){ if(await copyText(backupText(),$('#bkMsg'),{ok:'Copiada. Pégala en una nota o mándatela por mensaje.',failMsg:'No se pudo copiar sola. Aquí la tienes, ya seleccionada: cópiala a mano.'})){ markBackup(); renderBackupNotice() } },
  loadBackupText(){ const t=$('#backupPaste'); if(!t.value.trim()){ $('#bkMsg2').textContent='Pega antes el texto de una copia.'; t.focus(); return } if(loadBackup(t.value,$('#bkMsg2'))) t.value='' },
};
document.addEventListener('click',e=>{ const b=e.target.closest('[data-action]'); if(b) ACTIONS[b.dataset.action](b) });

/* Result and comparison */
document.addEventListener('change',e=>{
  if(e.target.name==='cmpUnit'){ cmpUnit=e.target.value; store.set(KEY.cmpUnit,cmpUnit); renderAll() }
});

/* «Tus datos» and calculation assumptions */
/** Fills in «Tus datos» and the assumptions. Values left at their default stay empty, with the default in grey. */
function fillCfg(skip){
  const fmt=v=>fIn(num(v),0,2);
  for(const i of $$('[data-cfg]')){
    const k=i.dataset.cfg; i.placeholder=fmt(DEF_CFG[k]);
    if(i!==skip) i.value=num(config[k])===num(DEF_CFG[k])?'':fmt(config[k]);
  }
  $$('input[name=cfg_inKind]').forEach(i=>i.checked=(i.value==='1')===config.inKind);
  $$('input[name=cfg_unemployment]').forEach(i=>i.checked=(i.value==='1')===(config.unemployment!==false));
}
/** «Tus datos» and «Supuestos del cálculo»: they apply to every offer. */
function onCfgInput(e){
  const el=e.target;
  if(el.dataset.cfg) config[el.dataset.cfg]=el.value.trim()===''?DEF_CFG[el.dataset.cfg]:num(el.value); // empty: the default value
  else if(el.name==='cfg_inKind') config.inKind=el.value==='1';
  else if(el.name==='cfg_unemployment') config.unemployment=el.value==='1';
  else return;
  saveCfg(); fillCfg(el); renderAll();
}
$('#yourdata').addEventListener('input',onCfgInput);
$('#assumptions').addEventListener('input',onCfgInput);
