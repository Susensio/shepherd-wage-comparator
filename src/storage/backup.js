/** Backups: downloading or copying one, and adding the offers of one you saved. */

import { closeTemplates, select } from '../app.js';
import { bundleFromSpanish, extractYourData, normalizeOffer } from '../legacy.js';
import { DEF_CFG, makeOffer, YOUR_DATA } from '../offer.js';
import { myOffers, saveConfig, state } from '../state.js';
import { copyText } from '../ui/dom.js';
import { fillSettings, paintBackup } from '../views/settings.js';
import { backupText, markBackup } from './bundle.js';

// Downloads are a capability of claude.ai; elsewhere there is none
const downloads = window.claude?.use ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);

/** Saves a backup file; if it cannot, copies the text, or shows it to copy by hand. */
export async function downloadBackup(msg) {
  const text = backupText();
  const filename = `jornales-copia-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    const dl = await downloads;
    if (!dl) throw { code: 'unavailable' };
    await dl.save({ filename, data: text });
    markBackup();
    msg.textContent = 'Copia guardada. Para recuperarla: Ajustes, «Elegir el archivo».';
  } catch (e) {
    if (e?.code === 'declined') {
      msg.textContent = '';
      return;
    }
    const copied = await copyText(text, msg, {
      ok: 'No se pudo descargar: la copia está en el portapapeles. Pégala en una nota o mándatela por mensaje.',
      failMsg: 'No se pudo descargar ni copiar. Aquí la tienes para copiarla a mano:',
    });
    if (copied) markBackup();
  }
  paintBackup();
}

/** Copies the backup as text. */
export async function copyBackup(msg) {
  const copied = await copyText(backupText(), msg, {
    ok: 'Copiada. Pégala en una nota o mándatela por mensaje.',
    failMsg: 'No se pudo copiar sola. Aquí la tienes, ya seleccionada: cópiala a mano.',
  });
  if (copied) {
    markBackup();
    paintBackup();
  }
}

/**
 * Adds the offers of a backup that you do not have; yours are not touched. With no offers of your own, its
 * settings are taken too. Returns whether it was a valid backup.
 */
export function loadBackup(content, msg) {
  let saved;
  try {
    saved = bundleFromSpanish(JSON.parse(content));
    if (!Array.isArray(saved.offers)) throw new Error('no offers');
  } catch {
    msg.textContent = 'Eso no es una copia válida. Usa el archivo o el texto completo que guardaste.';
    return false;
  }
  const hadOffers = !state.placeholderId && myOffers().length > 0;
  if (state.placeholderId) {
    state.offers = [];
    state.placeholderId = null;
    closeTemplates();
  }
  const cfg = saved.cfg ? { ...DEF_CFG, ...saved.cfg } : { ...state.config };
  // An old backup kept prices in each offer: start from your current data
  const migrate = !saved.cfg || saved.cfg.fuelUse === undefined;
  if (migrate) for (const k in YOUR_DATA) cfg[k] = state.config[k];
  let added = 0;
  let alreadyHad = 0;
  for (const o of extractYourData(saved.offers.map(normalizeOffer), cfg, migrate, YOUR_DATA)) {
    if (state.offers.some((x) => x.id === o.id)) alreadyHad++;
    else {
      state.offers.push(o);
      added++;
    }
  }
  if (!state.offers.length) state.offers = [makeOffer()];
  if (!hadOffers && (saved.cfg || migrate)) {
    state.config = cfg;
    saveConfig();
    fillSettings();
  }
  select(state.offers.find((o) => o.id === state.activeId)?.id || state.offers[0].id);
  msg.textContent = `${added === 1 ? 'Añadida 1 oferta' : `Añadidas ${added} ofertas`}.${
    alreadyHad
      ? ` ${alreadyHad === 1 ? 'Otra ya la tenías y no se ha tocado' : `Otras ${alreadyHad} ya las tenías y no se han tocado`}.`
      : ''
  }${hadOffers && saved.cfg ? ' «Tus datos» siguen como los tenías.' : ''}`;
  return true;
}
