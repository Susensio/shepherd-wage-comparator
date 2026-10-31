/** The account page (Ajustes without a project): the account, «Tus datos», the calculation assumptions and the backup. */

import { fInputValue, num } from '../format.js';
import { DEF_CFG, isComplete } from '../offer.js';
import { myOffers, state } from '../state.js';
import { ACCOUNT_CONFIG } from '../storage/account-config.js';
import { backupStatus } from '../storage/bundle.js';
import { $, $$ } from '../ui/dom.js';

/**
 * Fills in «Tus datos» and the assumptions. Values left at their default stay empty, with the default in grey.
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

/** The backup reminder above the offers, and the backup status on the account page. */
export function paintBackup() {
  const status = backupStatus(myOffers().some((o) => isComplete(o.terms)));
  // With accounts, the offers are kept in the account instead
  $('#backupNotice').hidden = !status.remind || !!(ACCOUNT_CONFIG.url && ACCOUNT_CONFIG.anonKey);
  const { last, days } = status;
  $('#backupStatus').textContent = !last
    ? 'Aún no has guardado ninguna copia.'
    : `Última copia: ${days === 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`} (${new Date(last.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })})${status.changed ? '. Has cambiado ofertas desde entonces.' : ', con todo lo que tienes ahora.'}`;
}

/**
 * @typedef {{
 *   user: any, profile: any, pending: any[], message: string, confirm: 'share' | 'delete' | null,
 *   enabled: boolean, started: boolean, sync: 'saved' | 'saving' | 'error', offline: boolean,
 * }} AccountView
 */

/** Where the account stands, as the dot on its button shows it. */
export function accountStatus(/** @type {AccountView} */ view) {
  if (!view.enabled) return 'off';
  if (!view.started) return 'connecting';
  if (!view.user) return 'guest';
  if (view.pending.length) return 'pending';
  if (view.offline) return 'offline';
  if (view.sync === 'error') return 'error';
  return view.sync === 'saving' ? 'saving' : 'online';
}

const STATUS_TEXT = {
  off: '',
  connecting: 'Conectando con la cuenta…',
  guest: 'Sin cuenta: las ofertas solo están en este navegador.',
  pending: 'No se pudieron subir a la cuenta las ofertas de este navegador.',
  offline: 'Sin conexión: los cambios se guardan en este navegador y se suben al volver la conexión.',
  error: 'No se pudieron guardar los últimos cambios en la cuenta. Se reintenta con el siguiente.',
  saving: 'Guardando en la cuenta…',
  online: 'Conectado: tus ofertas y ajustes se guardan en tu cuenta.',
};

/** Up to two capitals: the first letters of the first two words of the name, or of the email's name part. */
const initialsOf = (/** @type {string} */ text) =>
  text
    .split('@')[0]
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

/**
 * The account button (a cog without a project, a person for a guest, the initials once signed in) with its status dot,
 * and what depends on the account being there or not. Returns the status.
 * @param {AccountView} view
 */
export function paintAccountButton(view) {
  const status = accountStatus(view);
  const button = $('#accountButton');
  const who = view.user && (view.profile?.name || view.user.user_metadata?.name || view.user.email);
  button.dataset.status = status;
  button.dataset.kind = status === 'off' ? 'cog' : who ? 'initials' : 'person';
  $('#accountButton .initials').textContent = who ? initialsOf(who) : '';
  if (status !== 'off') {
    const label = `Cuenta. ${STATUS_TEXT[status]}`;
    button.setAttribute('aria-label', label);
    button.title = label;
  }
  const guest = status === 'guest';
  $('#guestNote').hidden = !guest;
  $('#accountTitle').hidden = !guest;
  $('#pageTitle').textContent = status === 'off' ? 'Ajustes' : 'Cuenta';
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
export function paintAccount({ user, profile, pending, message, confirm }) {
  $('#accountMsg').textContent = message;
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
    ? 'Tus ofertas se están compartiendo y ves las de los demás.'
    : 'Tus ofertas no se comparten. Tampoco ves las de los demás.';
  $('#shareConfirm').hidden = confirm !== 'share';
  $('#deleteConfirm').hidden = confirm !== 'delete';
}
