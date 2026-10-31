/** The account (ADR-0006, ADR-0009, ADR-0011): the account page's section, the button's status, and the tooltip. */

import { render } from 'lit-html';
import { openAccount, startAccount } from '../storage/account.js';
import { ACCOUNT_CONFIG } from '../storage/account-config.js';
import { forgetGoogleChoice, showGoogleButtons } from '../storage/google-sign-in.js';
import { GUEST_TIPS, PENDING_TIP, tipView } from '../views/account-tip.js';
import { othersView, shareTermsView } from '../views/others.js';
import { signInView } from '../views/sign-in.js';
import { $, $$ } from './dom.js';
import { currentTab, openPageName } from './navigation.js';
import { othersSection, setUpOthers, syncAvailability, useAccount } from './others.js';
import { paintAccount, paintAccountButton } from './settings-page.js';

/** @type {any} */
let account;
/** What the section shows; `paint()` draws it. */
const view = {
  /** @type {any} */ user: null,
  /** @type {any} */ profile: null,
  /** @type {any[]} */ pending: [],
  message: '',
  /** `message` is a success, not a failure. */
  messageOk: false,
  /** The line in Comparar's section: a failure there is not the account page's business. */
  othersMessage: '',
  /** «Ahora no» in Comparar's section: it shrinks to a button for this visit. */
  othersDeclined: false,
  /** @type {'share' | 'delete' | null} */ confirm: null,
  /** Accounts are configured: without a project nothing of this shows. */
  enabled: false,
  /** The saved session has been looked at: until then the tooltip would only flash. */
  started: false,
  /** How the background saving goes. */
  /** @type {'saved' | 'saving' | 'error'} */ sync: 'saved',
  offline: false,
  /** The tooltip was sent away with «Ahora no» or a sign-out: gone from every tab for this visit, back on the next. */
  tipDismissed: false,
  /** @type {import('../views/sign-in.js').SignIn} */
  signIn: { stage: 'email', email: '', busy: false, googleFailed: false, message: '' },
};

/** Called when a sign-in is complete. */
let onSignedIn = () => {};

/**
 * The button's status and the tooltip, which depend on the tab and on the page; Google's button where the page shows
 * a sign-in. `chooser`: also open Google's account chooser.
 */
export function paintAccountStatus({ chooser = false } = {}) {
  if (!view.enabled) return;
  const status = paintAccountButton(view);
  const page = openPageName() ?? undefined;
  const where = page ?? currentTab();
  /** @type {Parameters<typeof tipView>[0] | null} */
  let tip = null;
  if (status === 'guest' && !view.tipDismissed && GUEST_TIPS[where])
    tip = { ...GUEST_TIPS[where], go: 'Entrar', action: 'openAccountFromPrompt', dismissable: true };
  else if (!page && status === 'pending' && where === 'offers') tip = PENDING_TIP;
  render(tip ? tipView(tip) : '', $('#accountTip'));
  showSignInButtons({ chooser });
}

const paint = () => {
  paintAccount(view);
  render(view.user ? '' : signInView(view.signIn, !!ACCOUNT_CONFIG.emailSignIn), $('#accountSignIn'));
  paintAccountStatus();
  const section = othersSection(view);
  $('#othersBlk').hidden = !section;
  render(section ? othersView(section) : '', $('#othersBlk'));
  syncAvailability(view);
};

/**
 * Draws Google's button where a sign-in is on screen; Google's script is loaded only then (ADR-0009). Called again
 * whenever the prompts are repainted.
 */
function showSignInButtons({ chooser = false } = {}) {
  const clientId = ACCOUNT_CONFIG.googleClientId;
  if (!clientId || view.user || view.signIn.googleFailed) return;
  const slots = /** @type {HTMLElement[]} */ ($$('.gsi-slot')).filter((slot) => slot.offsetParent);
  if (!slots.length) return;
  showGoogleButtons({ clientId, slots, chooser, handler: onGoogleToken }).catch((error) => {
    console.error(error);
    view.signIn.googleFailed = true;
    paint();
  });
}

/** Signed in by whatever way: read the account, upload this browser's offers, show who is in. */
async function connect(opened) {
  await enter({ account: opened, ...(await opened.connect()) });
  if (!view.pending.length) onSignedIn(); // offers waiting for a decision keep the page open
  view.signIn = { stage: 'email', email: '', busy: false, googleFailed: view.signIn.googleFailed, message: '' };
}

function onGoogleToken(token, nonce) {
  attempt('No se pudo entrar. Inténtalo de nuevo.', async () => {
    const opened = await openAccount();
    await opened.signInWithGoogleToken(token, nonce);
    await connect(opened);
  });
}

/**
 * Signing out or deleting the account: no tooltip on any tab for this visit. `keptInAccount`: the offers were cleared
 * from the browser but remain in the account, which the welcome says.
 */
function signedOut({ keptInAccount = false } = {}) {
  forgetGoogleChoice();
  view.tipDismissed = true;
  $('#signedOutNotice').hidden = !keptInAccount;
  view.message = keptInAccount ? $('#signedOutNotice').textContent : '';
  view.messageOk = keptInAccount;
  Object.assign(view, { user: null, profile: null, pending: [], confirm: null });
}

/** The value of a field in the sign-in form that holds `button`. */
const fieldBy = (button, name) =>
  /** @type {HTMLInputElement} */ (/** @type {HTMLFormElement} */ (button.closest('form')).elements.namedItem(name));

/**
 * Runs an account call; its failure becomes `failure`, a short line, never an alert. `line`: «message» (the account
 * page), «othersMessage» (Comparar's section) or «signIn» (under the sign-in choices, busy while it runs).
 * @param {string} failure
 * @param {() => Promise<void>} call
 * @param {'message' | 'othersMessage' | 'signIn'} [line]
 */
async function attempt(failure, call, line = 'message') {
  const signingIn = line === 'signIn';
  // connect() replaces view.signIn, so the line is looked up each time
  const write = (text) => {
    if (signingIn) view.signIn.message = text;
    else view[line] = text;
  };
  write('');
  if (line === 'message') view.messageOk = false;
  if (signingIn) {
    view.signIn.busy = true;
    paint();
  }
  try {
    await call();
  } catch (error) {
    console.error(error);
    write(failure);
  }
  if (signingIn) view.signIn.busy = false;
  paint();
}

/** Takes a connected account: the signed-in user, the offers waiting for a decision, and the profile. */
async function enter(started) {
  $('#signedOutNotice').hidden = true;
  account = started.account;
  useAccount(account);
  view.user = started.user;
  view.pending = started.pending;
  view.profile = null;
  if (view.user && !view.pending.length) view.profile = await account.profile();
}

/** Called once at startup. With no project configured the section stays hidden and nothing else happens. */
export async function setUpAccountSection({ onReplaced, onOthers, onSignedIn: signedIn }) {
  setUpOthers(onOthers);
  onSignedIn = signedIn;
  if (!ACCOUNT_CONFIG.url || !ACCOUNT_CONFIG.anonKey) return;
  view.enabled = true;
  view.offline = navigator.onLine === false;
  $('#account').hidden = false;
  addEventListener('offline', () => {
    view.offline = true;
    paint();
  });
  addEventListener('online', () => {
    view.offline = false;
    account?.changed(); // what failed while offline is written now
    paint();
  });
  render(shareTermsView(), $('#shareTerms'));
  paint();
  await attempt('No se pudo conectar con la cuenta.', async () => {
    try {
      const started = await startAccount({
        onReplaced,
        onStatus(status) {
          view.sync = status;
          paintAccount(view);
          paintAccountStatus();
        },
      });
      if (started) await enter(started);
    } finally {
      view.started = true;
    }
  });
}

/** Turns sharing on or off through the account; a failure goes to `line`. */
const setSharing = (on, line) =>
  attempt(
    on
      ? 'No se pudieron compartir tus ofertas. Inténtalo de nuevo.'
      : 'No se pudo dejar de compartir. Inténtalo de nuevo.',
    async () => {
      view.profile = await account.updateProfile({ sharing: on });
      view.confirm = null;
      if (!on) view.othersDeclined = false;
    },
    line,
  );

/** For the buttons, by data-action. */
export const accountActions = {
  accountSignIn: () =>
    attempt('No se pudo entrar. Inténtalo de nuevo.', async () => (await openAccount()).signIn(), 'signIn'),

  sendEmailCode(button) {
    const input = fieldBy(button, 'signInEmail');
    if (!input.reportValidity()) return;
    const email = input.value.trim();
    attempt(
      'No se pudo enviar el código. Revisa la dirección e inténtalo de nuevo.',
      async () => {
        await (await openAccount()).sendEmailCode(email);
        Object.assign(view.signIn, { stage: 'code', email });
      },
      'signIn',
    );
  },

  resendEmailCode: () =>
    attempt(
      'No se pudo enviar el código. Inténtalo de nuevo.',
      async () => {
        await (await openAccount()).sendEmailCode(view.signIn.email);
        view.signIn.message = 'Se ha enviado otro código.';
      },
      'signIn',
    ),

  verifyEmailCode(button) {
    const input = fieldBy(button, 'signInCode');
    const code = input.value.replace(/\D/g, '');
    if (code.length !== 6) {
      view.signIn.message = 'El código tiene 6 cifras.';
      paint();
      return;
    }
    attempt(
      'El código no es correcto o ha caducado. Revísalo o pide otro.',
      async () => {
        const opened = await openAccount();
        await opened.verifyEmailCode(view.signIn.email, code);
        await connect(opened);
      },
      'signIn',
    );
  },

  changeSignInEmail() {
    Object.assign(view.signIn, { stage: 'email', message: '' });
    paint();
  },

  dismissTip() {
    view.tipDismissed = true;
    paintAccountStatus();
  },

  accountSignOut: () =>
    attempt('No se pudo salir. Inténtalo de nuevo.', async () => {
      await account.signOut();
      signedOut({ keptInAccount: true });
    }),

  uploadPending: () =>
    attempt('No se pudieron subir las ofertas. Inténtalo de nuevo.', async () => {
      await account.uploadPending();
      view.pending = [];
      view.profile = await account.profile();
    }),

  discardPending: () =>
    attempt('No se pudo cargar la cuenta.', async () => {
      account.discardPending();
      view.pending = [];
      view.profile = await account.profile();
    }),

  saveProfile: () =>
    attempt('No se pudo guardar el perfil.', async () => {
      const value = (id) => /** @type {HTMLInputElement} */ ($(id)).value.trim() || null;
      view.profile = await account.updateProfile({
        name: value('#profName'),
        email: value('#profEmail'),
        phone: value('#profPhone'),
      });
      view.message = 'Perfil guardado.';
      view.messageOk = true;
    }),

  confirmShare: () => setSharing(true, 'message'),
  shareFromCompare: () => setSharing(true, 'othersMessage'),
  declineShare() {
    view.othersDeclined = true;
    paint();
  },
  reopenShare() {
    view.othersDeclined = false;
    paint();
  },
  stopSharing: () => setSharing(false, 'othersMessage'),
  cancelShare() {
    view.confirm = null;
    paint();
  },

  askDeleteAccount() {
    view.confirm = 'delete';
    paint();
  },
  cancelDeleteAccount() {
    view.confirm = null;
    paint();
  },
  confirmDeleteAccount: () =>
    attempt('No se pudo borrar la cuenta. Inténtalo de nuevo.', async () => {
      await account.deleteAccount();
      signedOut();
    }),
};

/** The sharing switch: turning it on asks first; turning it off acts at once. */
export function onSharingToggled(checked) {
  if (checked) {
    view.confirm = 'share';
    paint();
    return;
  }
  setSharing(false, 'message');
}
