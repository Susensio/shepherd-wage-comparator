/** Comparar's «Otros pastores» section: the pitch for guests, the sharing consent, and the sharing state. */

import { html, nothing } from 'lit-html';

/** What sharing shows and to whom; the account page's confirmation and the Comparar consent both draw it. */
export const shareTermsView = () => html`
  <p>Se ven las condiciones de todas tus ofertas, con tu nombre, tu correo y tu teléfono. Las ven los pastores que han entrado y comparten al menos una oferta.</p>
  <p>No se ven tus km, tus gastos, los nombres de tus ofertas ni tus ajustes.</p>
  <p>Si dejas de compartir, tus datos dejan de verse y dejas de ver las ofertas de otros pastores.</p>`;

/**
 * @typedef {{
 *   stage: 'guest' | 'ask' | 'declined' | 'sharing',
 *   message: string,
 *   noPhone: boolean,
 * }} OthersSection
 */

const skeleton = html`<div class="others-skel" aria-hidden="true">${[78, 62, 46].map(
  (width) => html`<div class="skel-row"><i style="width:${width}%"></i></div>`,
)}</div>`;

/** @param {OthersSection} section */
export function othersView({ stage, message, noPhone }) {
  const body = {
    guest: html`${skeleton}
      <p>Compara tus ofertas con las de otros pastores.</p>
      <div class="actions"><button type="button" class="sm pri" data-action="openAccountFromPrompt">Entrar</button></div>`,
    ask: html`<div class="account-confirm" role="group" aria-labelledby="othersConsentTitle">
        <p id="othersConsentTitle"><strong>Compara tus ofertas con las de otros pastores.</strong></p>
        <p>Para verlas, comparte las tuyas. Esto es lo que se ve:</p>
        ${shareTermsView()}
        <div class="actions">
          <button type="button" class="sm pri" data-action="shareFromCompare">Compartir y comparar</button>
          <button type="button" class="sm" data-action="declineShare">Ahora no</button>
        </div>
      </div>`,
    declined: html`<div class="actions"><button type="button" class="sm" data-action="reopenShare">Compartir y comparar</button></div>`,
    sharing: html`<p class="hint">Compartes tus ofertas y ves las de otros pastores.
        <button type="button" class="linkbtn" data-action="stopSharing">Dejar de compartir</button></p>
      ${
        noPhone
          ? html`<p class="hint">Añade un teléfono a tu perfil para que te puedan contactar.
              <button type="button" class="linkbtn" data-action="openAccountPage">Ir al perfil</button></p>`
          : nothing
      }`,
  }[stage];
  return html`<h3>Otros pastores</h3>${body}${message ? html`<p class="account-msg" role="status">${message}</p>` : nothing}`;
}
