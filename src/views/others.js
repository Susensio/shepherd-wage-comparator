/** Comparar's «Otros pastores» section: the pitch for guests, the sharing consent, and the sharing state. */

import { html, nothing } from 'lit-html';

/** What sharing shows and to whom; the account page's confirmation and the Comparar consent both draw it. */
export const shareTermsView = () => html`
  <p>Se mostrarán todas las condiciones de todas tus ofertas, junto con tu nombre, tu correo y tu teléfono. Las verá cualquier usuario con sesión iniciada que también comparta al menos una oferta.</p>
  <p>No se muestran tus km, tus gastos, los nombres que has puesto a las ofertas ni tus ajustes.</p>
  <p>Si lo desactivas, tus datos dejan de verse y tú dejas de ver los de los demás.</p>`;

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
        <p>Para verlas, se comparten las tuyas. Esto es lo que se verá:</p>
        ${shareTermsView()}
        <div class="actions">
          <button type="button" class="sm pri" data-action="shareFromCompare">Compartir y comparar</button>
          <button type="button" class="sm" data-action="declineShare">Ahora no</button>
        </div>
      </div>`,
    declined: html`<div class="actions"><button type="button" class="sm" data-action="reopenShare">Compartir para comparar</button></div>`,
    sharing: html`<p class="hint">Compartes tus ofertas y ves las de otros pastores.
        <button type="button" class="linkbtn" data-action="stopSharing">Dejar de compartir</button></p>
      ${
        noPhone
          ? html`<p class="hint">Añade un teléfono en tu cuenta para que te puedan contactar.
              <button type="button" class="linkbtn" data-action="openAccountPage">Abrir la cuenta</button></p>`
          : nothing
      }`,
  }[stage];
  return html`<h3>Otros pastores</h3>${body}${message ? html`<p class="account-msg" role="status">${message}</p>` : nothing}`;
}
