/** Reading a backup: which of its offers are new, whether its settings are taken, and what to tell the shepherd. */

import { ingestSaved } from '../saved.js';

/**
 * What loading a backup would do, without doing it: `{ valid: false, text, kind }` if `content` is not a backup,
 * else `{ valid: true, fresh, cfg, text, kind }`. `fresh` are the offers to add (those you do not have; yours are not
 * touched), `cfg` the settings to take or null, `text` what to say and `kind` its style («ok» or «warn»). The
 * settings are taken only when you have no offers of your own, even if the copy adds nothing.
 * @param {string} content
 * @param {{ mine: { id: string }[], config: object }} yours your offers (not the placeholder) and your settings
 */
export function planImport(content, { mine, config }) {
  let saved;
  try {
    saved = JSON.parse(content);
    if (!Array.isArray(saved.offers)) throw new Error('no offers');
  } catch {
    return {
      valid: false,
      text: 'Eso no es una copia válida. Usa el archivo o el texto completo que guardaste.',
      kind: 'warn',
    };
  }
  const hadOffers = mine.length > 0;
  const { offers, cfg } = ingestSaved(saved, { fallbackCfg: config });
  const fresh = offers.filter((o) => !mine.some((x) => x.id === o.id));
  const alreadyHad = offers.length - fresh.length;
  const takeCfg = !hadOffers && !!saved.cfg;
  const kept = hadOffers && saved.cfg ? ' «Tus datos» siguen como los tenías.' : '';
  if (!fresh.length) {
    const reason = !alreadyHad
      ? 'la copia no tiene ofertas'
      : alreadyHad === 1
        ? 'la de la copia ya la tenías'
        : `las ${alreadyHad} de la copia ya las tenías`;
    return {
      valid: true,
      fresh,
      cfg: takeCfg ? cfg : null,
      text: `No se ha añadido ninguna oferta: ${reason}.${takeCfg ? ' Se han tomado tus datos de la copia.' : kept}`,
      kind: 'warn',
    };
  }
  const others = alreadyHad
    ? ` ${alreadyHad === 1 ? 'Otra ya la tenías y no ha cambiado' : `Otras ${alreadyHad} ya las tenías y no han cambiado`}.`
    : '';
  return {
    valid: true,
    fresh,
    cfg: takeCfg ? cfg : null,
    text: `${fresh.length === 1 ? 'Añadida 1 oferta' : `Añadidas ${fresh.length} ofertas`}.${others}${kept}`,
    kind: 'ok',
  };
}
