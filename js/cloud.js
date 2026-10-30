'use strict';

/* --- Saving to your Claude account ---
   If whoever opens the page can save to it (its owner, or a collaborator), their offers and data are
   saved automatically in their private slot of the account (data/users/<id>/estado) and restored on any device.
   If not (public link, no session), everything stays in the browser, as always. The most recent wins. */
const cloud={ref:null, lastSaved:backupText(), timer:null, queue:Promise.resolve(), reason:''}; // lastSaved: the last thing saved; only what differs counts as a change
function paintCloud(){
  $('#cloudStatus').textContent=inCloud?'Tus ofertas se guardan solas en tu cuenta de Claude: las tienes en cualquier dispositivo donde entres con tu sesión.':'Tus ofertas se guardan solo en este navegador'+(cloud.reason?` (${cloud.reason})`:'')+'.';
  $('#backupWhy').textContent=inCloud?'La copia en archivo es solo un respaldo, o para pasar tus ofertas a otra persona.':'El navegador puede borrarlas (Safari, por ejemplo, si pasas una semana sin abrir la página). Guarda una copia de vez en cuando.';
  renderBackupNotice();
}
function uploadCloud(){
  const ref=cloud.ref; if(!ref) return;
  const data={offers:myOffers(),cfg:config,ts:store.get(KEY.ts,Date.now())};
  cloud.queue=cloud.queue.then(()=>ref.set(data)).then(()=>{ store.set(KEY.uploaded,true); if(!inCloud){ inCloud=true; paintCloud() } })
    .catch(e=>{ cloud.ref=null; inCloud=false; cloud.reason='la cuenta no deja guardar: '+(e?.code||'error'); paintCloud() }); // no permission to save: it stays in the browser
}
onChange=()=>{
  const c=backupText(); if(c===cloud.lastSaved) return;
  cloud.lastSaved=c; store.set(KEY.ts,Date.now());
  if(cloud.ref){ clearTimeout(cloud.timer); cloud.timer=setTimeout(uploadCloud,1500) } // a single save per batch of changes
};
(async()=>{
  try{
    const fail=t=>{ cloud.reason=t; paintCloud() };
    const cl=window.claude; if(!cl?.use) return fail('abierta fuera de Claude');
    const [user,db]=await Promise.all([cl.use('user'),cl.use('db')]);
    if(!user||!db) return fail(`sin acceso a la cuenta: ${!user?'usuario':''}${!user&&!db?' y ':''}${!db?'datos':''}`);
    const id=await user.id(); if(!id) return fail('sin sesión de Claude en esta página');
    const ref=db.doc(`data/users/${id}/estado`), snap=await ref.get(), d=snap.exists?bundleFromSpanish(snap.data()):null;
    if(d&&Array.isArray(d.offers)&&d.offers.length&&(!myOffers().length||(Number(d.ts)||0)>store.get(KEY.ts,0))){ // no offers here: always take the account's
      // The account's data is newer than this browser's: use it
      // If this browser had never been saved to the account, its offers are not lost: they are added
      const notUploaded=store.get(KEY.uploaded,false)?[]:myOffers().filter(o=>!d.offers.some(x=>x.id===o.id));
      offers=[...d.offers.map(norm),...notUploaded]; config={...DEF_CFG,...(d.cfg||{})};
      store.set(KEY.offers,offers); store.set(KEY.cfg,config); store.set(KEY.ts,notUploaded.length?Date.now():Number(d.ts)); store.set(KEY.uploaded,true);
      cloud.lastSaved=notUploaded.length?'':backupText();
      placeholderId=null; if(!$('#tplPanel').hidden) closeTpl();
      cloud.ref=ref; inCloud=true; fillCfg(); renderChips.scroll=true;
      select(offers.find(o=>o.id===activeId)?.id||offers[0].id); paintCloud(); // with offers not uploaded yet, select already uploads them
      return;
    }
    cloud.lastSaved=backupText(); cloud.ref=ref;
    if(!store.get(KEY.ts,0)) store.set(KEY.ts,Date.now());
    if(myOffers().length) uploadCloud(); // this browser's data is the newest: upload it
    else fail('aún no hay ofertas que guardar');
  }catch(e){ cloud.reason='error al leer la cuenta: '+(e?.code||e?.message||'desconocido'); paintCloud() }
})();
