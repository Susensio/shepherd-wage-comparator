/** The bubble hanging from the account button (ADR-0011): one message per tab, shown to a guest. */

import { html, nothing } from 'lit-html';

/** @typedef {{ title: string, text: string }} Tip */

/** @type {Record<string, Tip>} what each tab says to a guest; a tab without an entry has no tooltip */
export const GUEST_TIPS = {
  offers: { title: 'Guarda tus ofertas en tu cuenta.', text: 'Ahora solo están en este navegador.' },
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
