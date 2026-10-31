/** The bubble hanging from the account button (ADR-0011): one message per tab or page, shown to a guest. */

import { html, nothing } from 'lit-html';

/** @typedef {{ title: string, text: string }} Tip */

/** @type {Record<string, Tip>} what each tab or page says to a guest; one without an entry has no tooltip */
export const GUEST_TIPS = {
  offers: { title: 'Guarda tus ofertas en una cuenta.', text: 'Ahora solo están en este navegador.' },
  compare: { title: 'Compara con otros pastores.', text: 'Entra y, si compartes tus ofertas, verás las suyas.' },
  settings: { title: 'Guarda tus ajustes en una cuenta.', text: 'Así los tienes en cualquier dispositivo.' },
};

/**
 * @param {{ title: string, text?: string, go: string, action: string, dismissable: boolean }} tip
 *   `go` is the label of the button that opens the account page; `action` says how (data-action).
 */
export const tipView = ({ title, text, go, action, dismissable }) =>
  html`<div class="tip" role="group" aria-label="Cuenta">
    <p><b>${title}</b>${text ? html` ${text}` : nothing}</p>
    <div class="tip-actions">
      <button type="button" class="go" data-action=${action}>${go}</button>
      ${dismissable ? html`<button type="button" class="later" data-action="dismissTip">Ahora no</button>` : nothing}
    </div>
  </div>`;
