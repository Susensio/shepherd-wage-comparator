/** The settings page («Tus datos», «Cómo se cuenta», the backup) and the account page, and the bar's account button. */

import { fInputValue, num } from '../format.js';
import { DEF_CFG, isComplete } from '../offer.js';
import { myOffers, state } from '../state.js';
import { ACCOUNT_CONFIG } from '../storage/account-config.js';
import { backupStatus } from '../storage/bundle.js';
import { $, $$ } from '../ui/dom.js';

/**
 * Fills in «Tus datos» and the two counting choices. Values left at their default stay empty, with the default in grey.
 * @param {HTMLElement} [skip] the field being typed in, left alone
 */
export function fillSettings(skip) {
  const cfg = state.config;
  const format = (v) => fInputValue(num(v), 0, 2);
  for (const input of /** @type {HTMLInputElement[]} */ ($$('[data-cfg]'))) {
    const key = input.dataset.cfg;
    input.placeholder = format(DEF_CFG[key]);
    if (input !== skip) input.value = num(cfg[key]) === num(DEF_CFG[key]) ? '' : format(cfg[key]);
  }
  for (const input of /** @type {HTMLInputElement[]} */ ($$('input[name=cfg_inKind]')))
    input.checked = (input.value === '1') === cfg.inKind;
  for (const input of /** @type {HTMLInputElement[]} */ ($$('input[name=cfg_unemployment]')))
    input.checked = (input.value === '1') === (cfg.unemployment !== false);
}

/** The backup reminder above the offers, and the status in the settings page's backup card (the account part of the card is toggled in `paintAccountButton`). */
export function paintBackup() {
  const status = backupStatus(myOffers().some((o) => isComplete(o.terms)));
  // With accounts, the offers are kept in the account instead
  $('#backupNotice').hidden = !status.remind || !!(ACCOUNT_CONFIG.url && ACCOUNT_CONFIG.anonKey);
  const { last, days } = status;
  const title = $('#backupStatus');
  title.textContent = !last
    ? 'Aún no has guardado ninguna copia.'
    : `Última copia: ${days === 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`} (${new Date(last.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })})`;
  // No copy yet is a warning too, for a guest; `changed` alone is true then, but by accident
  const stale = !last || status.changed;
  title.classList.toggle('ok', !stale);
  title.classList.toggle('warn', stale);
  const since = !last
    ? ''
    : status.changed
      ? 'Has cambiado ofertas desde entonces. '
      : 'Incluye todo lo que tienes ahora. ';
  $('#backupAdvice').textContent = `${since}El navegador puede borrar tus ofertas: guarda una copia de vez en cuando.`;
}

/**
 * @typedef {{
 *   user: any, profile: any, pending: any[], message: string, messageOk: boolean, confirm: 'share' | 'delete' | null,
 *   enabled: boolean, started: boolean, sync: 'saved' | 'saving' | 'error', offline: boolean,
 *   othersMessage: string, othersDeclined: boolean, tipDismissed: boolean, signIn: any,
 * }} AccountView
 */

/** Where the account stands, as the dot on its button shows it. */
function accountStatus(/** @type {AccountView} */ view) {
  if (!view.started) return 'connecting';
  if (!view.user) return 'guest';
  if (view.pending.length) return 'pending';
  if (view.offline) return 'offline';
  if (view.sync === 'error') return 'error';
  return view.sync === 'saving' ? 'saving' : 'online';
}

const STATUS_TEXT = {
  connecting: 'Conectando con la cuenta…',
  guest: 'Entrar. Tus ofertas solo están en este navegador.',
  pending: 'No se pudieron subir a la cuenta las ofertas de este navegador.',
  offline: 'Sin conexión: los cambios se guardan en este navegador y se suben al volver la conexión.',
  error: 'No se pudieron guardar los últimos cambios en la cuenta. Se vuelve a intentar con el próximo cambio.',
  saving: 'Guardando en la cuenta…',
  online: 'Conectado: tus ofertas y ajustes se guardan en tu cuenta.',
};

/** Up to two capitals: the first letters of the first two words of the name, or of the email's name part. */
const initialsOf = (/** @type {string} */ text) =>
  text
    .trim()
    .split('@')[0]
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0].toUpperCase())
    .join('');

/** Where the settings page says they are kept: nothing until the saved session has been looked at. */
const storageLine = (/** @type {AccountView} */ view) =>
  view.user ? 'Se guardan en tu cuenta.' : view.started ? 'Se guardan solo en este navegador.' : '';

/**
 * The account button (a person for a guest, the initials once signed in) with its status dot, and what depends on the
 * account being there or not. Only called with a project configured: without one the button stays hidden.
 * @param {AccountView} view
 */
export function paintAccountButton(view) {
  const status = accountStatus(view);
  const button = $('#accountButton');
  const who = view.user && (view.profile?.name || view.user.user_metadata?.name || view.user.email);
  const initials = who ? initialsOf(who) : '';
  button.hidden = false;
  button.dataset.status = status;
  button.dataset.kind = initials ? 'initials' : 'person';
  $('#accountButton .initials').textContent = initials;
  const label = status === 'guest' ? STATUS_TEXT.guest : `Cuenta. ${STATUS_TEXT[status]}`;
  button.setAttribute('aria-label', label);
  button.title = label;
  $('#accountTitle').hidden = status !== 'guest';
  // Signed in, the account keeps the offers: the backup card says so instead of warning about the browser
  $('#backupGuest').hidden = !!view.user;
  $('#backupAccount').hidden = !view.user;
  const storage = $('#settingsStorage');
  storage.textContent = storageLine(view);
  storage.hidden = !storage.textContent;
  const sync = $('#accountSync');
  sync.textContent = view.user && !view.pending.length ? STATUS_TEXT[status] : '';
  sync.dataset.status = status;
  return status;
}

/** The profile whose fields are in the inputs: they are filled when it changes, so typing is not overwritten. */
let filledProfile = null;

/**
 * The «Cuenta» section: signed out, choosing what to do with the browser's offers, or signed in.
 * @param {AccountView} view
 */
export function paintAccount({ user, profile, pending, message, messageOk, confirm }) {
  $('#accountMsg').textContent = message;
  $('#accountMsg').classList.toggle('ok', messageOk);
  $('#accountOut').hidden = !!user;
  $('#accountPending').hidden = !(user && pending.length);
  $('#accountIn').hidden = !(user && !pending.length);
  $('#pendingList').replaceChildren(
    ...pending.map((offer) => Object.assign(document.createElement('li'), { textContent: offer.mine.name })),
  );
  if (!user) return;
  const name = profile?.name || user.user_metadata?.name;
  const email = profile?.email || user.email;
  $('#accountWho').textContent = `Has entrado como ${[name, email].filter(Boolean).join(' · ')}.`;
  if (!profile) return;
  if (filledProfile !== profile) {
    filledProfile = profile;
    /** @type {HTMLInputElement} */ ($('#profName')).value = profile.name ?? '';
    /** @type {HTMLInputElement} */ ($('#profEmail')).value = profile.email ?? '';
    /** @type {HTMLInputElement} */ ($('#profPhone')).value = profile.phone ?? '';
  }
  /** @type {HTMLInputElement} */ ($('#profSharing')).checked = profile.sharing && confirm !== 'share';
  $('#sharingState').textContent = profile.sharing
    ? 'Compartes tus ofertas y ves las de otros pastores.'
    : 'No compartes tus ofertas ni ves las de otros pastores.';
  $('#shareConfirm').hidden = confirm !== 'share';
  $('#deleteConfirm').hidden = confirm !== 'delete';
}
