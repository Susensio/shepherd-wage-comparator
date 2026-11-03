/** «Lo que te cuesta el negro»: in words, what money paid en negro does not give. */

import { html, nothing } from 'lit-html';
import { fE, fN, isWorthCounting } from '../format.js';
import { UNITS } from '../units.js';
import { voiceOf } from '../voice.js';

/** «14 días». */
const daysText = (days) => `${fN(days)} ${Math.round(days) === 1 ? 'día' : 'días'}`;

/** Only with money en negro or no contract. */
export function negroSection(r, money, third) {
  if (!(r.cash.total > 0.5 || r.noContract)) return nothing;
  const say = voiceOf(third);
  const { lost, euros } = r.unemployment;
  const contributions = r.noContract
    ? 'Sin contrato nada cotiza: no hay jubilación ni baja pagada.'
    : `Los ${money.figure(r.cash.total)}${UNITS[money.unit].suffix} que ${say('cobras', 'se cobran')} en negro no cotizan: no cuentan para ${say('tu', 'la')} jubilación ni para una baja.`;
  const paro = isWorthCounting(lost.euros)
    ? r.noContract
      ? `Con contrato se generarían ${daysText(lost.days)} de paro: unos ${fE(lost.euros)}.`
      : `Con ese dinero en nómina se generarían unos ${fE(lost.euros)} más de paro.`
    : euros > 0 && !r.noContract
      ? 'Al paro no le resta: con lo que va en nómina ya llega al máximo.'
      : '';
  const title = say('Lo que te cuesta el negro', 'Lo que cuesta el negro');
  return html`<section class="employer negro" id="secNegro" aria-label=${title}><h3 class="q">${title}</h3>
    <div class="savings"><p>${contributions}</p>${paro ? html`<p>${paro}</p>` : nothing}</div></section>`;
}
