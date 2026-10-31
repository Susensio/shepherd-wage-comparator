/** The account (ADR-0006, ADR-0009, ADR-0011): the account page's section, the button's status, and the tooltip. */

import { render } from 'lit-html';
import { ingestShared } from '../saved.js';
import { state } from '../state.js';
import { openAccount, startAccount } from '../storage/account.js';
import { ACCOUNT_CONFIG } from '../storage/account-config.js';
import { forgetGoogleChoice, showGoogleButtons } from '../storage/google-sign-in.js';
import { GUEST_TIPS, tipView } from '../views/account-tip.js';
import { othersView, shareTermsView } from '../views/others.js';
import { paintAccount, paintAccountButton } from '../views/settings.js';
import { signInView } from '../views/sign-in.js';
import { $, $$ } from './dom.js';

/** @type {any} */
let account;
/** What the section shows; `paint()` draws it. */
const view = {
  /** @type {any} */ user: null,
  /** @type {any} */ profile: null,
  /** @type {any[]} */ pending: [],
  message: '',
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
  /** Tabs whose tooltip was sent away with «Ahora no» or a sign-out: for this visit only, back on the next. */
  dismissed: /** @type {Set<string>} */ (new Set()),
  /** @type {import('../views/sign-in.js').SignIn} */
  signIn: { stage: 'email', email: '', busy: false, googleFailed: false, message: '' },
};

/** Called when what other shepherds' offers show changes: availability, loading, result. */
let onOthersChange = () => {};
/** Called when a sign-in is complete. */
let onSignedIn = () => {};

/** Other shepherds' offers can be read only when signed in with sharing on (ADR-0006). */
function syncAvailability() {
  const available = !!(view.user && view.profile?.sharing && !view.pending.length);
  if (available === state.others.available) return;
  state.others.available = available;
  if (!available) {
    Object.assign(state.others, { include: false, status: 'idle', items: [], viewId: null });
  } else state.others.include = true; // sharing means seeing the others, until hidden with the checkbox
  onOthersChange();
  if (available && !$('[data-panel=compare]').hidden) loadOthers(); // else showTab loads on arrival
}

/** Comparar's section, from the account: nothing until the saved session has been looked at, or while uploads wait. */
/** @returns {import('../views/others.js').OthersSection | null} */
function othersSection() {
  if (!view.enabled || !view.started || view.pending.length) return null;
  const message = view.othersMessage;
  if (!view.user) return { stage: 'guest', message, noPhone: false };
  if (!view.profile) return null;
  if (view.profile.sharing) return { stage: 'sharing', message, noPhone: !view.profile.phone };
  return { stage: view.othersDeclined ? 'declined' : 'ask', message, noPhone: false };
}

/** The tab shown, or the one the account page was opened from. */
const currentTab = () => /** @type {HTMLElement} */ ($('.tabs [aria-selected=true]')).dataset.tab ?? 'offers';

/**
 * The button's status and the tooltip, which depend on the tab and on the page; Google's button where the page shows
 * a sign-in. `chooser`: also open Google's account chooser.
 */
export function paintAccountStatus({ chooser = false } = {}) {
  if (!view.enabled) return;
  const status = paintAccountButton(view);
  const tab = currentTab();
  const onPage = !$('[data-panel=settings]').hidden;
  /** @type {Parameters<typeof tipView>[0] | null} */
  let tip = null;
  if (!onPage && status === 'guest' && !view.dismissed.has(tab) && GUEST_TIPS[tab])
    tip = { ...GUEST_TIPS[tab], go: 'Entrar', action: 'openAccountFromPrompt', dismissable: true };
  else if (!onPage && status === 'pending' && tab === 'offers')
    tip = {
      title: 'No se pudieron subir tus ofertas a la cuenta.',
      go: 'Revisar',
      action: 'openAccountPage',
      dismissable: false,
    };
  render(tip ? tipView(tip) : '', $('#accountTip'));
  showSignInButtons({ chooser });
}

const paint = () => {
  paintAccount(view);
  render(view.user ? '' : signInView(view.signIn, !!ACCOUNT_CONFIG.emailSignIn), $('#accountSignIn'));
  paintAccountStatus();
  const section = othersSection();
  $('#othersBlk').hidden = !section;
  render(section ? othersView(section) : '', $('#othersBlk'));
  syncAvailability();
};

/**
 * Draws Google's button where a sign-in is on screen; Google's script is loaded only then (ADR-0009). Called again
 * whenever the prompts are repainted.
 */
export function showSignInButtons({ chooser = false } = {}) {
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

/** Runs a sign-in step; its failure becomes `failure`, a line under the sign-in choices. */
async function signInStep(failure, call) {
  Object.assign(view.signIn, { message: '', busy: true });
  paint();
  try {
    await call();
  } catch (error) {
    console.error(error);
    view.signIn.message = failure;
  }
  view.signIn.busy = false;
  paint();
}

/** Signed in by whatever way: read the account, upload this browser's offers, show who is in. */
async function connect(opened) {
  await enter({ account: opened, ...(await opened.connect()) });
  if (!view.pending.length) onSignedIn(); // offers waiting for a decision keep the page open
  view.signIn = { stage: 'email', email: '', busy: false, googleFailed: view.signIn.googleFailed, message: '' };
}

function onGoogleToken(token, nonce) {
  signInStep('No se pudo entrar con Google. Inténtalo de nuevo.', async () => {
    const opened = await openAccount();
    await opened.signInWithGoogleToken(token, nonce);
    await connect(opened);
  });
}

/** Signing out or deleting the account: no tooltip on any tab for this visit. */
function signedOut() {
  forgetGoogleChoice();
  for (const tab of Object.keys(GUEST_TIPS)) view.dismissed.add(tab);
  Object.assign(view, { user: null, profile: null, pending: [], confirm: null });
}

/** The value of a field in the sign-in form that holds `button`. */
const fieldBy = (button, name) =>
  /** @type {HTMLInputElement} */ (/** @type {HTMLFormElement} */ (button.closest('form')).elements.namedItem(name));

let loadSeq = 0;

/** Fetches the others' offers into `state.others` (memory only); the latest request wins. */
export async function loadOthers() {
  if (!account || !state.others.available) return;
  const seq = ++loadSeq;
  state.others.status = 'loading';
  onOthersChange();
  let status = /** @type {'ready' | 'error'} */ ('ready');
  let items = [];
  try {
    items = (await account.sharedOffers()).map(ingestShared).filter(Boolean);
  } catch (error) {
    console.error(error);
    status = 'error';
  }
  if (seq !== loadSeq || !state.others.available) return;
  state.others.status = status;
  if (status === 'ready') {
    state.others.items = items;
    if (!items.some((x) => x.o.id === state.others.viewId)) state.others.viewId = null;
  }
  onOthersChange();
}

/** Runs an account call; its failure becomes `failure`, a short line in `line`'s section, never an alert. */
async function run(failure, call, line = 'message') {
  view[line] = '';
  try {
    await call();
  } catch (error) {
    console.error(error);
    view[line] = failure;
  }
  paint();
}

/** Takes a connected account: the signed-in user, the offers waiting for a decision, and the profile. */
async function enter(started) {
  account = started.account;
  view.user = started.user;
  view.pending = started.pending;
  view.profile = null;
  if (view.user && !view.pending.length) view.profile = await account.profile();
}

/** Called once at startup. With no project configured the section stays hidden and nothing else happens. */
export async function setUpAccountSection({ onReplaced, onOthers, onSignedIn: signedIn }) {
  onOthersChange = onOthers;
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
  await run('No se pudo conectar con la cuenta.', async () => {
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
  run(
    on ? 'No se pudo activar. Inténtalo de nuevo.' : 'No se pudo desactivar. Inténtalo de nuevo.',
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
    signInStep('No se pudo iniciar sesión. Inténtalo de nuevo.', async () => (await openAccount()).signIn()),

  sendEmailCode(button) {
    const input = fieldBy(button, 'signInEmail');
    if (!input.reportValidity()) return;
    const email = input.value.trim();
    signInStep('No se pudo enviar el código. Revisa el correo e inténtalo de nuevo.', async () => {
      await (await openAccount()).sendEmailCode(email);
      Object.assign(view.signIn, { stage: 'code', email });
    });
  },

  verifyEmailCode(button) {
    const input = fieldBy(button, 'signInCode');
    const code = input.value.replace(/\D/g, '');
    if (code.length !== 6) {
      view.signIn.message = 'El código tiene 6 cifras.';
      paint();
      return;
    }
    signInStep('El código no vale o ha caducado. Revísalo o pide otro.', async () => {
      const opened = await openAccount();
      await opened.verifyEmailCode(view.signIn.email, code);
      await connect(opened);
    });
  },

  changeSignInEmail() {
    Object.assign(view.signIn, { stage: 'email', message: '' });
    paint();
  },

  dismissTip() {
    view.dismissed.add(currentTab());
    paintAccountStatus();
  },

  accountSignOut: () =>
    run('No se pudo cerrar la sesión.', async () => {
      await account.signOut();
      signedOut();
    }),

  uploadPending: () =>
    run('No se pudieron subir las ofertas. Inténtalo de nuevo.', async () => {
      await account.uploadPending();
      view.pending = [];
      view.profile = await account.profile();
    }),

  discardPending: () =>
    run('No se pudo cargar la cuenta.', async () => {
      account.discardPending();
      view.pending = [];
      view.profile = await account.profile();
    }),

  saveProfile: () =>
    run('No se pudo guardar el perfil.', async () => {
      const value = (id) => /** @type {HTMLInputElement} */ ($(id)).value.trim() || null;
      view.profile = await account.updateProfile({
        name: value('#profName'),
        email: value('#profEmail'),
        phone: value('#profPhone'),
      });
      view.message = 'Perfil guardado.';
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
    run('No se pudo borrar la cuenta. Inténtalo de nuevo.', async () => {
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
