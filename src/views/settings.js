/** Ajustes: «Tus datos», the calculation assumptions, where your offers are saved and the backup. */

import { fInputValue, num } from '../format.js';
import { DEF_CFG, isComplete } from '../offer.js';
import { myOffers, state } from '../state.js';
import { backupStatus } from '../storage/bundle.js';
import { $, $$ } from '../ui/dom.js';

/**
 * Fills in «Tus datos» and the assumptions. Values left at their default stay empty, with the default in grey.
 * @param {HTMLElement} [skip] the field being typed in, left alone
 */
export function fillSettings(skip) {
  const cfg = state.config;
  const format = (v) => fInputValue(num(v), 0, 2);
  for (const input of /** @type {HTMLInputElement[]} */ ($$('[data-cfg]'))) {
    const key = input.dataset.cfg;
    input.placeholder = format(DEF_CFG[key]);
    if (input !== skip) input.value = num(cfg[key]) === num(DEF_CFG[key]) ? '' : format(cfg[key]);
  }
  for (const input of /** @type {HTMLInputElement[]} */ ($$('input[name=cfg_inKind]')))
    input.checked = (input.value === '1') === cfg.inKind;
  for (const input of /** @type {HTMLInputElement[]} */ ($$('input[name=cfg_unemployment]')))
    input.checked = (input.value === '1') === (cfg.unemployment !== false);
}

/** The backup reminder above the offers, and the backup status in Ajustes. */
export function paintBackup() {
  const status = backupStatus(myOffers().some((o) => isComplete(o.terms)));
  $('#backupNotice').hidden = !status.remind;
  const { last, days } = status;
  $('#backupStatus').textContent = !last
    ? 'Aún no has guardado ninguna copia.'
    : `Última copia: ${days === 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`} (${new Date(last.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })})${status.changed ? '. Has cambiado ofertas desde entonces.' : ', con todo lo que tienes ahora.'}`;
}
