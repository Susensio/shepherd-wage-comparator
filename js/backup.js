'use strict';
/* Backups: download or copy a file, the reminder, and restoring from a file or pasted text. */

/* Backup: downloadable file (or text) and a reminder if it has been a while */
const backupText=()=>JSON.stringify({offers:myOffers(),cfg:config});
/** Short fingerprint of the content, to know whether it changed since the last backup. */
const signature=()=>{let h=0;for(const c of JSON.stringify(myOffers()))h=(h*31+c.charCodeAt(0))|0;return String(h)};
const markBackup=()=>store.set(KEY.backup,{date:Date.now(),signature:signature()});
const DAY=864e5;
function renderBackupNotice(){
  const c=(c=>c&&c.fecha?{date:c.fecha,signature:c.firma}:c)(store.get(KEY.backup,null)), snooze=store.get(KEY.backupNotice,0);
  const present=myOffers().some(o=>!missing(o).length);
  const pending=!c||(c.signature!==signature()&&Date.now()-c.date>7*DAY);
  $('#backupNotice').hidden=inCloud||!(present&&pending&&Date.now()>snooze);
  const days=c?Math.floor((Date.now()-c.date)/DAY):0;
  $('#backupStatus').textContent=!c?'Aún no has guardado ninguna copia.'
    :`Última copia: ${days===0?'hoy':days===1?'ayer':`hace ${days} días`} (${new Date(c.date).toLocaleDateString('es-ES',{day:'numeric',month:'long'})})${c.signature!==signature()?'. Has cambiado ofertas desde entonces.':', con todo lo que tienes ahora.'}`;
}
// The downloads capability comes from claude.ai; outside it does not exist
const downloadsP=window.claude?.use?window.claude.use('downloads').catch(()=>null):Promise.resolve(null);
async function downloadBackup(msg){
  const txt=backupText(), name=`jornales-copia-${new Date().toISOString().slice(0,10)}.json`;
  try{
    const dl=await downloadsP; if(!dl) throw {code:'unavailable'};
    await dl.save({filename:name,data:txt});
    markBackup(); msg.textContent='Copia guardada. Para recuperarla: Ajustes, «Elegir el archivo».';
  }catch(e){
    if(e&&e.code==='declined'){ msg.textContent=''; return }
    if(await copyText(txt,msg,{ok:'No se pudo descargar: la copia está en el portapapeles. Pégala en una nota o mándatela por mensaje.',
      failMsg:'No se pudo descargar ni copiar. Aquí la tienes para copiarla a mano:'})) markBackup();
  }
  renderBackupNotice();
}
/** Adds the offers of a backup that you do not have; yours are not touched. Returns whether the backup was valid. */
function loadBackup(content,msg){
  let d; try{ d=bundleFromSpanish(JSON.parse(content)); if(!Array.isArray(d.offers)) throw 0 }
  catch(e){ msg.textContent='Eso no es una copia válida. Usa el archivo o el texto completo que guardaste.'; return false }
  const hadOffers=!placeholderId&&myOffers().length>0; // with offers of your own, the backup does not touch anything you already have
  if(placeholderId){ offers=[]; placeholderId=null; closeTpl() }
  let added=0, alreadyHad=0;
  const backupCfg=d.cfg?{...DEF_CFG,...d.cfg}:{...config};
  const migrate=!d.cfg||d.cfg.fuelUse===undefined;
  if(migrate) for(const k in YOUR_DATA) backupCfg[k]=config[k]; // old backup: start from your current data
  for(const o of extractYourData(d.offers.map(norm),backupCfg,migrate)){
    if(offers.some(x=>x.id===o.id)) alreadyHad++; else { offers.push(o); added++ }
  }
  if(!offers.length) offers=[makeOffer()];
  if(!hadOffers&&(d.cfg||migrate)){ config=backupCfg; saveCfg(); fillCfg() }
  select(offers.find(o=>o.id===activeId)?.id||offers[0].id);
  msg.textContent=`${added===1?'Añadida 1 oferta':`Añadidas ${added} ofertas`}.${alreadyHad?` ${alreadyHad===1?'Otra ya la tenías y no se ha tocado':`Otras ${alreadyHad} ya las tenías y no se han tocado`}.`:''}${hadOffers&&d.cfg?' «Tus datos» siguen como los tenías.':''}`;
  return true;
}
// If the file picker does not open (it happens inside some Claude windows), the file can be dragged onto the box
const pasteBox=$('#backupPaste');
pasteBox.addEventListener('dragover',e=>{ if([...e.dataTransfer.types].includes('Files')){ e.preventDefault(); pasteBox.classList.add('dragging') } });
pasteBox.addEventListener('dragleave',()=>pasteBox.classList.remove('dragging'));
pasteBox.addEventListener('drop',async e=>{
  const f=e.dataTransfer.files?.[0]; pasteBox.classList.remove('dragging'); if(!f) return;
  e.preventDefault(); loadBackup(await f.text(),$('#bkMsg2'));
});
$('#backupFile').addEventListener('change',async e=>{
  const f=e.target.files?.[0]; if(!f) return;
  loadBackup(await f.text(),$('#bkMsg2')); e.target.value='';
});
// In Ajustes the sections are always open: their title does not fold
for(const sm of $$('details.fixed>summary')) sm.addEventListener('click',e=>e.preventDefault());
