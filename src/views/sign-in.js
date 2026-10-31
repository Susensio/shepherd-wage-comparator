/** The ways in (ADR-0009): Google's button, or a code sent by email. Shown on the sign-in card, the welcome and the Cuenta tab. */

import { html, nothing } from 'lit-html';

/**
 * @typedef {{ stage: 'email' | 'code', email: string, busy: boolean, googleFailed: boolean, message: string }} SignIn
 */

/** Google's button is drawn into `.gsi-slot` by Google's script; if that script does not load, a plain button. */
const google = ({ googleFailed }) =>
  googleFailed
    ? html`<button type="button" class="pri" data-action="accountSignIn">Continuar con Google</button>`
    : html`<div class="gsi-slot"></div>`;

const emailStep = ({ email, busy }) =>
  html`<form class="signin-email" onsubmit="return false">
    <label class="fld">Tu correo<input type="text" name="signInEmail" autocomplete="email" inputmode="email" pattern="[^@\\s]+@[^@\\s]+\\.[^@\\s]+"
      .value=${email} required></label>
    <div class="actions"><button type="submit" ?disabled=${busy} data-action="sendEmailCode">Enviarme un código</button></div>
  </form>`;

const codeStep = ({ email, busy }) =>
  html`<form class="signin-email" onsubmit="return false">
    <p>Se ha enviado un código a <b>${email}</b>. Escríbelo aquí, o abre el enlace del correo en este navegador.</p>
    <label class="fld">Código<input type="text" class="n" name="signInCode" autocomplete="one-time-code" inputmode="numeric"
      maxlength="6" pattern="[0-9]{6}"></label>
    <div class="actions">
      <button type="submit" class="pri" ?disabled=${busy} data-action="verifyEmailCode">Entrar</button>
      <button type="button" class="sm" data-action="changeSignInEmail">Otro correo</button>
    </div>
  </form>`;

const email = (signIn) =>
  html`<p class="signin-or"><span>o con tu correo</span></p>
    ${signIn.stage === 'code' ? codeStep(signIn) : emailStep(signIn)}`;

/**
 * @param {SignIn} signIn
 * @param {boolean} withEmail
 */
export const signInView = (signIn, withEmail) =>
  html`<div class="signin">
    ${google(signIn)} ${withEmail ? email(signIn) : nothing}
    ${signIn.message ? html`<p class="hint account-msg" role="status">${signIn.message}</p>` : nothing}
  </div>`;

/** The card under the tabs while signed out; «Ahora no» shrinks it to a line for the rest of the visit (ADR-0010). */
export const signInCardView = (signIn, withEmail) =>
  html`<h2>Guarda tus ofertas en una cuenta</h2>
    <p>Sin cuenta, tus ofertas solo están en este navegador, que puede borrarlas. Con una cuenta se guardan en ella y las ves
      desde cualquier dispositivo. Si quieres, también puedes comparar tus ofertas con las de otros pastores, compartiendo
      las tuyas.</p>
    ${signInView(signIn, withEmail)}
    <div class="actions"><button type="button" class="sm" data-action="skipSignIn">Ahora no</button></div>`;
