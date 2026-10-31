/** Backups: downloading or copying one, and adding the offers of one you saved. */

import { closeTemplates, select } from '../app.js';
import { ingestSaved } from '../saved.js';
import { myOffers, saveConfig, state } from '../state.js';
import { copyText } from '../ui/dom.js';
import { paintBackup } from '../ui/settings-page.js';
import { fillSettings } from '../views/settings.js';
import { backupText, markBackup } from './bundle.js';

/** Writes a result into its box; `kind` is «ok» or «warn» (the box's style). */
function say(msg, text, kind = 'ok') {
  msg.textContent = text;
  msg.dataset.kind = kind;
}

/** Saves a backup file; if it cannot, copies the text, or shows it to copy by hand. */
export async function downloadBackup(msg) {
  const text = backupText();
  const filename = `jornales-copia-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    markBackup();
    say(msg, 'Copia guardada. Para recuperarla: Ajustes, «Copia de seguridad», «Elegir el archivo».');
  } catch {
    const copied = await copyText(text, msg, {
      ok: 'No se pudo descargar: la copia está en el portapapeles. Pégala en una nota o mándatela por mensaje.',
      failMsg: 'No se pudo descargar ni copiar. Aquí la tienes para copiarla a mano:',
    });
    msg.dataset.kind = copied ? 'ok' : 'warn';
    if (copied) markBackup();
  }
  paintBackup();
}

/** Copies the backup as text. */
export async function copyBackup(msg) {
  const copied = await copyText(backupText(), msg, {
    ok: 'Copiada. Pégala en una nota o mándatela por mensaje.',
    failMsg: 'No se pudo copiar. Aquí la tienes, ya seleccionada: cópiala a mano.',
  });
  msg.dataset.kind = copied ? 'ok' : 'warn';
  if (copied) {
    markBackup();
    paintBackup();
  }
}

/**
 * Adds the offers of a backup that you do not have; yours are not touched. With no offers of your own, its
 * settings are taken too. Returns whether it was a valid backup. `msg` is shown as a warning if nothing was added.
 */
export function loadBackup(content, msg) {
  let saved;
  try {
    saved = JSON.parse(content);
    if (!Array.isArray(saved.offers)) throw new Error('no offers');
  } catch {
    say(msg, 'Eso no es una copia válida. Usa el archivo o el texto completo que guardaste.', 'warn');
    return false;
  }
  const hadOffers = !state.placeholderId && myOffers().length > 0;
  const { offers, cfg } = ingestSaved(saved, { fallbackCfg: state.config });
  const owned = state.placeholderId ? [] : state.offers;
  const fresh = offers.filter((o) => !owned.some((x) => x.id === o.id));
  const alreadyHad = offers.length - fresh.length;
  const takeCfg = !hadOffers && !!saved.cfg;
  if (takeCfg) {
    state.config = cfg;
    saveConfig();
    fillSettings(state.config);
  }
  const kept = hadOffers && saved.cfg ? ' «Tus datos» siguen como los tenías.' : '';
  if (!fresh.length) {
    const reason = !alreadyHad
      ? 'la copia no tiene ofertas'
      : alreadyHad === 1
        ? 'la de la copia ya la tenías'
        : `las ${alreadyHad} de la copia ya las tenías`;
    say(
      msg,
      `No se ha añadido ninguna oferta: ${reason}.${takeCfg ? ' Se han tomado tus datos de la copia.' : kept}`,
      'warn',
    );
    return true;
  }
  if (state.placeholderId) {
    state.offers = [];
    state.placeholderId = null;
    closeTemplates();
  }
  state.offers.push(...fresh);
  select(state.offers.find((o) => o.id === state.activeId)?.id || state.offers[0].id);
  const others = alreadyHad
    ? ` ${alreadyHad === 1 ? 'Otra ya la tenías y no ha cambiado' : `Otras ${alreadyHad} ya las tenías y no han cambiado`}.`
    : '';
  say(msg, `${fresh.length === 1 ? 'Añadida 1 oferta' : `Añadidas ${fresh.length} ofertas`}.${others}${kept}`);
  return true;
}
