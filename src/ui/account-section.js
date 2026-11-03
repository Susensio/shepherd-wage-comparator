/** The account (ADR-0006, ADR-0009, ADR-0011): paints `account-state.js` as the account page's section, the button's status, the tooltip and Comparar's section. */

import { render } from 'lit-html';
import { createAccountState } from '../account-state.js';
import { $, $$ } from '../dom.js';
import { ingestShared } from '../saved.js';
import { state } from '../state.js';
import { createAccountLoader } from '../storage/account.js';
import { ACCOUNT_CONFIG } from '../storage/account-config.js';
import { forgetGoogleChoice, showGoogleButtons } from '../storage/google-sign-in.js';
import { GUEST_TIPS, PENDING_TIP, tipView } from '../views/account-tip.js';
import { othersView, shareTermsView } from '../views/others.js';
import { signInView } from '../views/sign-in.js';
import { currentTab, openPageName, tabInView } from './navigation.js';
import { paintAccount, paintAccountButton } from './settings-page.js';

export const accountLoader = createAccountLoader();
export const accountState = createAccountState({
  enabled: !!(ACCOUNT_CONFIG.url && ACCOUNT_CONFIG.anonKey),
  loader: accountLoader,
  others: state.others,
  ingestShared,
  isOnline: () => navigator.onLine !== false,
  wantsOthers: () => tabInView('compare'),
  forgetGoogleChoice,
});
const { view } = accountState;

/** Refetches other shepherds' offers (the latest request wins). */
export const loadOthers = () => accountState.loadOthers();

/**
 * Comparar's section, from the account: nothing until the saved session has been looked at, or while uploads wait.
 * @returns {import('../views/others.js').OthersSection | null}
 */
function othersSection() {
  if (!view.enabled || !view.started || view.pending.length) return null;
  const message = view.othersMessage;
  if (!view.user) return { stage: 'guest', message, noPhone: false };
  if (!view.profile) return null;
  if (view.profile.sharing) return { stage: 'sharing', message, noPhone: !view.profile.phone };
  return { stage: view.othersDeclined ? 'declined' : 'ask', message, noPhone: false };
}

/**
 * The button's status and the tooltip, which depend on the tab and on the page; Google's button where the page shows
 * a sign-in. `chooser`: also open Google's account chooser.
 */
export function paintAccountStatus({ chooser = false } = {}) {
  if (!view.enabled) return;
  const status = accountState.status();
  paintAccountButton(view, status);
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

function paint() {
  paintAccount(view);
  render(view.user || !view.started ? '' : signInView(view.signIn, !!ACCOUNT_CONFIG.emailSignIn), $('#accountSignIn'));
  paintAccountStatus();
  const section = othersSection();
  $('#othersBlk').hidden = !section;
  render(section ? othersView(section) : '', $('#othersBlk'));
}

/**
 * Draws Google's button where a sign-in is on screen; Google's script is loaded only then (ADR-0009). Called again
 * whenever the prompts are repainted.
 */
function showSignInButtons({ chooser = false } = {}) {
  const clientId = ACCOUNT_CONFIG.googleClientId;
  if (!clientId || !view.started || view.user || view.signIn.googleFailed) return;
  const slots = /** @type {HTMLElement[]} */ ($$('.gsi-slot')).filter((slot) => slot.offsetParent);
  if (!slots.length) return;
  showGoogleButtons({ clientId, slots, chooser, handler: accountState.signInWithGoogleToken }).catch((error) => {
    console.error(error);
    accountState.googleFailed();
  });
}

/** Called once at startup. With no project configured the section stays hidden and nothing else happens. */
export async function setUpAccountSection() {
  accountState.subscribe((event) => {
    if (event === 'account') paint();
    if (event === 'status') {
      paintAccount(view);
      paintAccountStatus();
    }
  });
  if (!ACCOUNT_CONFIG.url || !ACCOUNT_CONFIG.anonKey) return;
  $('#account').hidden = false;
  addEventListener('offline', () => accountState.setOnline(false));
  addEventListener('online', () => accountState.setOnline(true));
  render(shareTermsView(), $('#shareTerms'));
  await accountState.start();
}

/** The value of a field in the sign-in form that holds `button`. */
const fieldBy = (button, name) =>
  /** @type {HTMLInputElement} */ (/** @type {HTMLFormElement} */ (button.closest('form')).elements.namedItem(name));

/** For the buttons, by data-action. */
export const accountActions = {
  accountSignIn: () => accountState.signIn(),

  sendEmailCode(button) {
    const input = fieldBy(button, 'signInEmail');
    if (!input.reportValidity()) return;
    accountState.sendEmailCode(input.value.trim());
  },

  resendEmailCode: () => accountState.resendEmailCode(),
  verifyEmailCode: (button) => accountState.verifyEmailCode(fieldBy(button, 'signInCode').value),
  changeSignInEmail: () => accountState.changeSignInEmail(),
  dismissTip: () => accountState.dismissTip(),
  accountSignOut: () => accountState.signOut(),
  uploadPending: () => accountState.uploadPending(),
  discardPending: () => accountState.discardPending(),

  saveProfile() {
    const value = (id) => /** @type {HTMLInputElement} */ ($(id)).value.trim() || null;
    accountState.saveProfile({ name: value('#profName'), email: value('#profEmail'), phone: value('#profPhone') });
  },

  confirmShare: () => accountState.confirmShare(),
  shareFromCompare: () => accountState.shareFromCompare(),
  declineShare: () => accountState.declineShare(),
  reopenShare: () => accountState.reopenShare(),
  stopSharing: () => accountState.stopSharing(),
  cancelShare: () => accountState.cancelShare(),
  askDeleteAccount: () => accountState.askDeleteAccount(),
  cancelDeleteAccount: () => accountState.cancelDeleteAccount(),
  confirmDeleteAccount: () => accountState.deleteAccount(),
};

/** The sharing switch: turning it on asks first; turning it off acts at once. */
export const onSharingToggled = (checked) => accountState.toggleSharing(checked);
