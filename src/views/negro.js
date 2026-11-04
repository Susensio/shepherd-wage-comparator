/** «Dinero en negro»: in words, what money paid en negro does not give, in the page's own terms. */

import { html, nothing } from 'lit-html';
import { fE, fN, isWorthCounting } from '../format.js';
import { UNITS } from '../units.js';

/** «14 días». */
const daysText = (days) => `${fN(days)} ${Math.round(days) === 1 ? 'día' : 'días'}`;

/** Only with money en negro or no contract. */
export function negroSection(r, money) {
  if (!(r.cash.total > 0.5 || r.noContract)) return nothing;
  const { lost, euros } = r.unemployment;
  const contributions = r.noContract
    ? `Sin contrato, nada de lo que se cobra cuenta para la jubilación, una baja o el paro.`
    : `${money.figure(r.cash.total)}${UNITS[money.unit].suffix} van en negro: no cuentan para la jubilación ni para una baja.`;
  const paro = isWorthCounting(lost.euros)
    ? r.noContract
      ? `Con contrato, este trabajo generaría ${daysText(lost.days)} de paro: unos ${fE(lost.euros)}.`
      : `En nómina, generarían unos ${fE(lost.euros)} más de paro.`
    : euros > 0 && !r.noContract
      ? 'Al paro no le afecta: lo que va en nómina ya da el máximo.'
      : '';
  const title = 'Dinero en negro';
  return html`<section class="employer negro" id="secNegro" aria-label=${title}><h3 class="q">${title}</h3>
    <div class="savings"><p>${contributions}</p>${paro ? html`<p>${paro}</p>` : nothing}</div></section>`;
}
