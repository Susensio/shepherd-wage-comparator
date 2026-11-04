/** Backups on the page: downloading or copying one, and adding the offers of one you saved. */

import { showSelected } from '../app.js';
import { offers } from '../offers.js';
import { myOffers, saveConfig, state } from '../state.js';
import { planImport } from '../storage/backup.js';
import { backupText, markBackup } from '../storage/bundle.js';
import { fillSettings } from '../views/settings.js';
import { copyText } from './dom.js';
import { paintBackup } from './settings-page.js';

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
      failMsg: 'No se pudo descargar ni copiar. Aquí está para copiarla a mano:',
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
    failMsg: 'No se pudo copiar. Aquí está, ya seleccionada: cópiala a mano.',
  });
  msg.dataset.kind = copied ? 'ok' : 'warn';
  if (copied) {
    markBackup();
    paintBackup();
  }
}

/**
 * Adds the offers of a backup that you do not have (see `planImport`) and says what happened in `msg`, as a warning
 * if nothing was added. Returns whether it was a valid backup.
 */
export function loadBackup(content, msg) {
  const plan = planImport(content, { mine: myOffers(), config: state.config });
  say(msg, plan.text, plan.kind);
  if (!plan.valid) return false;
  if (plan.cfg) {
    state.config = plan.cfg;
    saveConfig();
    fillSettings(state.config);
  }
  if (!plan.fresh.length) return true;
  offers.addImported(plan.fresh);
  showSelected();
  return true;
}
