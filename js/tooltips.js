'use strict';

/* Explanations on tap ([data-tip]): a bubble under the element */
let popY=0;
function closePop(){ $('.pop')?.remove(); $('[data-tip].on')?.classList.remove('on') }
function openPop(el){
  const pop=document.createElement('div'); pop.className='pop'; pop.setAttribute('role','tooltip'); pop.textContent=el.dataset.tip;
  document.body.appendChild(pop); el.classList.add('on'); popY=scrollY;
  const rc=el.getBoundingClientRect(), W=document.documentElement.clientWidth, m=12, w=pop.offsetWidth;
  const left=Math.max(m,Math.min(rc.left,W-m-w));
  pop.style.left=(left+scrollX)+'px'; pop.style.top=(rc.bottom+8+scrollY)+'px';
  pop.style.setProperty('--arrow-x',Math.max(12,Math.min(w-12,rc.left+rc.width/2-left))+'px'); // the little arrow points at the element
}
document.addEventListener('click',e=>{
  if(e.target.closest('.pop')) return;
  const el=e.target.closest('[data-tip]'), wasOn=el&&el.classList.contains('on');
  closePop(); if(el&&!wasOn){ e.preventDefault(); openPop(el) }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') closePop();
  else if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('[data-tip]')){ e.preventDefault(); e.target.click() }
});
addEventListener('resize',()=>{ closePop(); setNavH(); chipEdges() });
addEventListener('scroll',()=>{ if($('.pop')&&Math.abs(scrollY-popY)>24) closePop() },{passive:true}); // a slight scroll while tapping does not close it
