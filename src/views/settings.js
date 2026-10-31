/** The settings page's fields («Tus datos», «Cómo se cuenta»). */

import { fInputValue, num } from '../format.js';
import { DEF_CFG } from '../offer.js';
import { $$ } from '../ui/dom.js';

/**
 * Fills in «Tus datos» and the two counting choices. Values left at their default stay empty, with the default in grey.
 * @param {any} cfg the settings
 * @param {HTMLElement} [skip] the field being typed in, left alone
 */
export function fillSettings(cfg, skip) {
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
