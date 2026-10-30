/** The «Cuenta» section of Ajustes: what the person sees and does with the account (ADR-0006). */

import { signInWithGoogle, startAccount } from '../storage/account.js';
import { ACCOUNT_CONFIG } from '../storage/account-config.js';
import { paintAccount } from '../views/settings.js';
import { $ } from './dom.js';

/** @type {any} */
let account;
/** What the section shows; `paint()` draws it. */
const view = {
  /** @type {any} */ user: null,
  /** @type {any} */ profile: null,
  /** @type {any[]} */ pending: [],
  message: '',
  /** @type {'share' | 'delete' | null} */ confirm: null,
};

const paint = () => paintAccount(view);

/** Runs an account call; its failure becomes `failure`, a short line in the section, never an alert. */
async function run(failure, call) {
  view.message = '';
  try {
    await call();
  } catch (error) {
    console.error(error);
    view.message = failure;
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
export async function setUpAccountSection({ onReplaced }) {
  if (!ACCOUNT_CONFIG.url || !ACCOUNT_CONFIG.anonKey) return;
  $('#account').hidden = false;
  paint();
  await run('No se pudo conectar con la cuenta.', async () => {
    const started = await startAccount({ onReplaced });
    if (started) await enter(started);
  });
}

/** For the buttons, by data-action. */
export const accountActions = {
  accountSignIn: () => run('No se pudo iniciar sesión. Inténtalo de nuevo.', () => signInWithGoogle()),

  accountSignOut: () =>
    run('No se pudo cerrar la sesión.', async () => {
      await account.signOut();
      Object.assign(view, { user: null, profile: null, pending: [], confirm: null });
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

  confirmShare: () =>
    run('No se pudo activar. Inténtalo de nuevo.', async () => {
      view.profile = await account.updateProfile({ sharing: true });
      view.confirm = null;
    }),
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
      Object.assign(view, { user: null, profile: null, pending: [], confirm: null });
    }),
};

/** The sharing switch: turning it on asks first; turning it off acts at once. */
export function onSharingToggled(checked) {
  if (checked) {
    view.confirm = 'share';
    paint();
    return;
  }
  run('No se pudo desactivar. Inténtalo de nuevo.', async () => {
    view.profile = await account.updateProfile({ sharing: false });
    view.confirm = null;
  });
}
