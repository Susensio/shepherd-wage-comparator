'use strict';
/* Templates, motion, collapsibles, scrolling and repainting everything. */

function openTpl(){
  $('#tplGrid').innerHTML=TPL.map(t=>`<button type="button" class="tcard" data-action="template" data-tpl="${t.k}"><b>${t.t}</b><span>${t.d}</span><span class="tk">${t.s}</span></button>`).join('')
    +`<button type="button" class="tcard blank" data-action="template" data-tpl="blank"><b>En blanco</b><span>Sin nada puesto. Lo rellenas todo tú.</span></button>`;
  $('#tplPanel').hidden=false; setFocusMode(true); window.scrollTo({top:0,behavior:'smooth'});
  if(!placeholderId) $('#tplGrid button')?.focus({preventScroll:true});
}
function closeTpl(){
  $('#tplPanel').hidden=true; setFocusMode(false);
  if(placeholderId){ placeholderId=null; persist(); openEditor(true); renderChips() }
}
/** While you pick a template the offer and the rest are hidden (done in CSS with body.choosing). */
function setFocusMode(on){
  document.body.classList.toggle('choosing',on);
  $('#btnAdd').textContent=on?'× Cancelar':'+ Nueva';
}

/* --- motion: the same duration and curve for everything (those of the CSS: --t and --ease) --- */
const ANIM={dur:220, ease:'cubic-bezier(.2,.7,.3,1)'};
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Animates an element if possible; otherwise does nothing. A longer distance, a bit more time. */
function animateEl(el,frames,{distance=0,...op}={}){
  if(reducedMotion()||!el.animate) return null;
  return el.animate(frames,{duration:Math.min(ANIM.dur*1.6,ANIM.dur+distance/10),easing:ANIM.ease,...op});
}
/** Appears with a slight fade (fields being shown, the offer summary). */
const fadeIn = el=>animateEl(el,[{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'none'}]);

/** Collapsibles: tapping the title opens or closes them animating the height. */
document.addEventListener('click',e=>{
  const sum=e.target.closest('summary'), d=sum?.parentElement;
  if(!(d instanceof HTMLDetailsElement)||sum!==d.querySelector(':scope>summary')) return;
  if(d.id==='editWrap'&&d.open){ e.preventDefault(); done(true); return } // «Hecho» at the top does the same as the one at the bottom
  if(reducedMotion()) return;
  e.preventDefault(); toggleFold(d,!d.open);
});
/**
 * Opens or closes a collapsible animating its height. The final state is measured without painting it and then animated to.
 * While closing it carries the «closing» class, so the arrow and the summary change right away and not at the end.
 * «Datos de la oferta» also animates the summary below it: one grows while the other shrinks and fades.
 */
function toggleFold(d,opening){
  const ed=d.id==='editWrap', info=ed?$('#editInfo'):null;
  (d._anims||[]).forEach(a=>a.cancel());
  const from=d.offsetHeight;
  if(info) info.hidden=false;
  const infoHeight=info?.offsetHeight||0;
  d.open=opening; const to=d.offsetHeight; d.open=true; // the end state is measured without painting it; meanwhile, open
  if(ed) $('#editBtn').textContent=opening?'Hecho':'Modificar';
  if(!opening) d.classList.add('closing');
  d._animating=true; d.style.overflow='hidden';
  // Only what is visible is animated: what is below the screen appears or goes without animation.
  // So a long section slides at the same pace as a short one instead of filling the screen at once.
  const visible=Math.max(0,innerHeight-d.getBoundingClientRect().top);
  const start=opening?from:Math.min(from,Math.max(to,visible)), end_=opening?Math.min(to,Math.max(from,visible)):to;
  const op={distance:Math.abs(end_-start)};
  const anims=[animateEl(d,{height:[start+'px',end_+'px']},op)];
  if(info){
    // without the summary its gap in the form is gone too
    const hiddenMargin=`${-6-(parseFloat(getComputedStyle(info.parentElement).rowGap)||0)}px`, shownMargin='-6px';
    info.style.overflow='hidden';
    anims.push(animateEl(info,opening?{height:[infoHeight+'px','0px'],opacity:[1,0],marginTop:[shownMargin,hiddenMargin]}:{height:['0px',infoHeight+'px'],opacity:[0,1],marginTop:[hiddenMargin,shownMargin]},op));
    anims.push(animateEl(d.querySelector('.editbody'),{opacity:opening?[0,1]:[1,0]},{...op,fill:'forwards'}));
  }
  d._anims=anims.filter(Boolean);
  const end=()=>{ d.style.overflow=''; if(info) info.style.overflow=''; d.classList.remove('closing'); d._animating=false; d._anims=null; anims[2]?.cancel(); saveFold(d) };
  const settle=measured=>{ d.open=opening; end(); if(ed) syncEditor(measured) };
  if(!anims[0]) return settle(false);
  anims[0].onfinish=()=>settle(true);
  anims[0].oncancel=end;
  return anims[0];
}

/** Scrolls the page to an element. Moves only this page (scrollIntoView would also move the outer one, if embedded)
    and aims again once the page settles: closing the phone keyboard or folding sections changes the height midway. */
function scrollToEl(el,align='start'){
  if(!el) return;
  const targetY=()=>{const b=el.getBoundingClientRect(), nav=$('.offers')?.getBoundingClientRect().height||0;
    return Math.max(0,scrollY+(align==='center'?b.top-(innerHeight-b.height)/2:b.top-nav-8))};
  requestAnimationFrame(()=>window.scrollTo({top:targetY(),behavior:'smooth'}));
  clearTimeout(scrollToEl.t); scrollToEl.t=setTimeout(()=>{ const y=targetY(); if(Math.abs(y-scrollY)>4) window.scrollTo({top:y,behavior:'smooth'}) },650);
}
/** Opens or closes «Datos de la oferta» without animation (when choosing an offer, pressing «Hecho»…). */
function openEditor(on){ $('#editWrap').open=on; syncEditor() }
/** The button and the summary below it, depending on whether it is open. `measured`: the animation already showed it. */
function syncEditor(measured){
  const o=$('#editWrap').open, info=$('#editInfo'), appears=info.hidden&&!o;
  $('#editBtn').textContent=o?'Hecho':'Modificar'; info.hidden=o;
  if(appears&&!measured) fadeIn(info);
}
function setNavH(){const n=$('.offers');if(n)document.documentElement.style.setProperty('--navh',n.getBoundingClientRect().height+'px')}

/** Repaints everything from the state. */
function renderAll(){
  setTimeout(setNavH);
  const r=calc(active);
  renderChips(); renderForm(r); renderResult(r); renderCompare(); renderTimeline(); renderBackupNotice();
}
function select(id){ activeId=id; active=offers.find(x=>x.id===id); defaultVacation(active); persist(); fill(active); renderAll() }
