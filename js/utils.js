'use strict';
/* Numbers, formatting, HTML helpers and the clipboard. */

const $ = s=>document.querySelector(s);
const $$ = s=>[...document.querySelectorAll(s)];
const clamp = (x,a,b)=>Math.min(b,Math.max(a,x));

/** Reads a number written the Spanish way: «1.200», «1.200,50», «1,5», «60 €». */
function num(v){
  if(typeof v==='number') return v;
  let s=String(v??'').trim().replace(/\s|€|%/g,'');
  if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
  else if(/^\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
  const n=parseFloat(s);
  return isFinite(n)?n:0;
}
const nf = (d0,d1=d0,grouping=true)=>new Intl.NumberFormat('es-ES',{minimumFractionDigits:d0,maximumFractionDigits:d1,useGrouping:grouping?'always':false}); // 'always': es-ES does not group 4-digit numbers by default
const fN = (x,d=0)=>nf(d).format(x);              // 1.234
/** Decimals of a euro figure: the ones asked for or, otherwise, two below 10 € (3,40 €) and none above. */
const decE = (x,d)=>d!==undefined?d:Math.abs(x)>0.004&&Math.abs(x)<9.995?2:0;
const fE = (x,d)=>fN(x,decE(x,d))+'\u00a0€';               // 1.234 € · 3,40 €
const fIn = (x,d0,d1=d0)=>nf(d0,d1,false).format(x); // for inputs: 1234,5 (no thousands separator)
/** A figure as you typed it: «7,5» h, «4» days off. */
const fInput = v=>fN(num(v),num(v)%1?1:0);
/** A count (days, hours): one decimal only if it is small and not round. «4,3» días, «13» días. */
const fCount = x=>fN(x,x<10&&Math.abs(x-Math.round(x))>=0.05?1:0);
/** «1 día», «2,5 días»: the count with its word in singular or plural. */
/** One decimal only when needed: «8 h», «7,3 h». */
const f1 = x=>fN(x,Math.abs(x-Math.round(x))>=0.05?1:0);
const fDays = x=>`${fCount(x)} ${fCount(x)==='1'?'día':'días'}`;
const esc = s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/** Attributes of an element that shows an explanation when tapped. */
const tipA = t=>t?` data-tip="${esc(t)}" tabindex="0" role="button"`:'';

/**
 * Copies to the clipboard and says so in `msg`. If it cannot, leaves the text selected to copy by hand:
 * in `field` if given, or in a new box below the message. Returns whether it could copy.
 */
async function copyText(content, msg, {ok, failMsg, rows=6, field}){
  try{ await navigator.clipboard.writeText(content); msg.textContent=ok; return true }
  catch(e){
    msg.textContent=failMsg;
    const prev=msg.nextElementSibling?.classList.contains('copy-fallback')?msg.nextElementSibling:null;
    const ta=field||prev||Object.assign(document.createElement('textarea'),{rows:rows,className:'copy-fallback'});
    if(!field&&!prev) msg.after(ta);
    ta.value=content; ta.select(); return false;
  }
}
/** Element that explains something when tapped (dotted underline). */
const withTip = (txt,tip)=>tip?`<span class="tipl"${tipA(tip)}>${txt}</span>`:txt;
/**
 * Label–figure row. `sw`: swatch colour ('expense' for the hatching, '' to leave the gap);
 * `sub`: note under the label; `cls`: row class (hd, strong, tot); `vcls`: figure class (ok, bad, minus).
 */
const row = (lbl,val,{sw,sub,cls,vcls}={})=>{
  // «− Descanso», «= Total»…: the sign moves to the figures column, aligned, and «=» gets a rule above
  const m=typeof lbl==='string'&&val!==''&&/^([−+=×]) (.*)$/s.exec(lbl);
  if(m){ lbl=capitalize(m[2]); val=`<span class="op">${m[1]}</span><span class="nm">${val}</span>`; cls=[cls,'opr',m[1]==='='&&'eq'].filter(Boolean).join(' ') }
  return `<div class="row${sw!==undefined?' c':''}${cls?' '+cls:''}">${sw===undefined?'':sw?swatch(sw):'<span></span>'}<span>${lbl}${sub?`<small>${sub}</small>`:''}</span><span${vcls?` class="${vcls}"`:''}>${val}</span></div>`};

/** Button that asks for a second tap before acting (delete, replace…). */
function doubleTap(btn, normalLabel, ms){
  let armed=false, timer=null;
  const reset=()=>{armed=false; clearTimeout(timer); btn.textContent=normalLabel};
  return {
    reset,
    /** Returns true if it was already armed (second tap); otherwise arms it with the notice. */
    confirm(notice){
      if(armed){ reset(); return true }
      armed=true; btn.textContent=notice; clearTimeout(timer); timer=setTimeout(reset,ms); return false;
    },
  };
}
