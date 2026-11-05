/** The Otros pastores tab's section: the pitch for guests, the sharing consent, and the sharing state. */

import { html, nothing } from 'lit-html';

/** What sharing shows and to whom, in full: the account page's confirmation and the one-line version in the tab's consent. */
export const shareTermsView = () => html`
  <p>Se ven las condiciones de las ofertas, el pueblo y si son solo oferta, con el nombre, el correo y el teléfono. Las ven los pastores que han entrado y comparten al menos una oferta.</p>
  <p>No se ven los km, los gastos, los nombres de las ofertas ni los ajustes.</p>
  <p>Si se deja de compartir, los datos dejan de verse, y también las ofertas de otros pastores.</p>`;

/**
 * @typedef {{
 *   stage: 'guest' | 'ask' | 'declined' | 'sharing',
 *   message: string,
 *   noPhone: boolean,
 * }} OthersSection
 */

/** The tab's consent in one line: what is seen and by whom (ADR-0006); the full text is in the account page. */
const shareShortView = () => html`<p>
    A cambio, se comparten las propias: sus condiciones, el nombre, el correo y el teléfono, solo con quien también
    comparte.
  </p>`;

const skeleton = html`<div class="others-skel" aria-hidden="true">${[78, 62, 46].map(
  (width) => html`<div class="skel-row"><i style="width:${width}%"></i></div>`,
)}</div>`;

/** @param {OthersSection} section */
export function othersView({ stage, message, noPhone }) {
  const body = {
    guest: html`${skeleton}
      <p><strong>¿Pagan mejor en otros sitios?</strong> Entra y compara las ofertas con las de otros pastores.</p>
      <div class="actions"><button type="button" class="sm pri" data-action="openAccountFromPrompt">Entrar</button></div>`,
    ask: html`<div class="account-confirm" role="group" aria-labelledby="othersConsentTitle">
        <p id="othersConsentTitle"><strong>¿Pagan mejor en otros sitios?</strong> Mira las ofertas de otros pastores.</p>
        ${shareShortView()}
        <div class="actions">
          <button type="button" class="sm pri" data-action="shareFromOthers">Compartir y comparar</button>
          <button type="button" class="sm" data-action="declineShare">Ahora no</button>
        </div>
      </div>`,
    declined: html`<div class="actions"><button type="button" class="sm" data-action="reopenShare">Compartir y comparar</button></div>`,
    sharing: html`<p class="hint">Se comparten las ofertas y se ven las de otros pastores.
        <button type="button" class="linkbtn" data-action="stopSharing">Dejar de compartir</button></p>
      ${
        noPhone
          ? html`<p class="hint">Añade un teléfono al perfil para que puedan contactar.
              <button type="button" class="linkbtn" data-action="openAccountPage">Ir al perfil</button></p>`
          : nothing
      }`,
  }[stage];
  return html`<h3>Otros pastores</h3>${body}${message ? html`<p class="account-msg" role="status">${message}</p>` : nothing}`;
}
