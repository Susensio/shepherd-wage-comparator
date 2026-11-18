/**
 * The «⋯» menu of an offer (Duplicar, Copiar ficha, Copiar reclamación, Expediente, Acabó antes, Borrar): one menu for the ficha and every
 * card, opened from a button with `aria-haspopup="menu"` or, on wide screens, with a right click on a card.
 */

import { $ } from '../dom.js';
import { doubleTap } from './dom.js';
import { wide } from './scroller.js';

const GAP = 6;
const MARGIN = 8;

/**
 * @param {object} options
 * @param {(id: string) => {copy: boolean, claim: boolean, ended: boolean}} options.available what the offer allows
 * @param {(action: string, id: string, msg: HTMLElement) => Promise<boolean | void> | boolean | void} options.run
 *   does the action; returns whether it copied, which closes the menu after a moment
 * @returns {{ open: (trigger: HTMLElement, id: string) => void, close: () => void }}
 */
export function setUpOfferMenu({ available, run }) {
  const menu = $('#offerMenu');
  const msg = $('.menu-msg', menu);
  const items = () =>
    /** @type {HTMLElement[]} */ ([...menu.querySelectorAll('[role=menuitem]')]).filter((b) => !b.hidden);
  const del = doubleTap($('[data-menu=delete]', menu), 'Borrar', 4000);
  /** @type {{ trigger: HTMLElement, id: string, point: {x: number, y: number} | null } | null} */
  let current = null;
  let closeTimer;

  function close({ refocus = false } = {}) {
    if (!current) return;
    const { trigger } = current;
    current = null;
    clearTimeout(closeTimer);
    menu.hidden = true;
    del.reset();
    msg.textContent = '';
    for (const box of menu.querySelectorAll('.copy-fallback')) box.remove();
    trigger.setAttribute('aria-expanded', 'false');
    if (refocus) trigger.focus();
  }

  /**
   * Right-aligned to `right`, or from `left`; below `bottom` if it fits, else above `top`. Kept inside the screen.
   * @param {{ left?: number, right?: number, top: number, bottom: number }} at
   */
  function place({ left, right, top, bottom }) {
    menu.hidden = false;
    menu.style.left = '0px';
    menu.style.top = '0px';
    const { width, height } = menu.getBoundingClientRect();
    const x = right === undefined ? (left ?? 0) : right - width;
    const y = bottom + height + MARGIN <= innerHeight ? bottom : top - height;
    menu.style.left = `${Math.max(MARGIN, Math.min(x, innerWidth - width - MARGIN))}px`;
    menu.style.top = `${Math.max(MARGIN, y)}px`;
  }

  /** Under (or above) the trigger button, right-aligned to it. */
  function placeAt(trigger) {
    const box = trigger.getBoundingClientRect();
    place({ right: box.right, top: box.top - GAP, bottom: box.bottom + GAP });
  }

  /**
   * @param {HTMLElement} trigger where focus returns to
   * @param {string} id the offer
   * @param {{x: number, y: number} | null} [point] where the pointer was, if the menu is not under a button
   */
  function open(trigger, id, point = null) {
    if (current?.trigger === trigger && !point) return close({ refocus: true });
    close();
    current = { trigger, id, point };
    const { copy, claim, ended } = available(id);
    $('[data-menu=copyCard]', menu).hidden = !copy;
    $('[data-menu=copyClaim]', menu).hidden = !claim;
    $('[data-menu=endedEarly]', menu).hidden = !ended;
    $('[data-menu=startedOther]', menu).hidden = !ended;
    $('[data-menu=notTaken]', menu).hidden = !ended;
    $('[data-menu=dossier]', menu).hidden = !ended;
    if (point) place({ left: point.x, top: point.y - GAP, bottom: point.y + GAP });
    else {
      placeAt(trigger);
      trigger.setAttribute('aria-expanded', 'true');
    }
    // Focusing must not scroll: a scroll would move the trigger under the open menu
    items()[0].focus({ preventScroll: true });
  }

  menu.addEventListener('click', async (e) => {
    const item = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest('[data-menu]'));
    if (!item || !current) return;
    const { id } = current;
    const action = item.dataset.menu;
    if (action === 'delete' && !del.confirm('¿Seguro?')) return;
    clearTimeout(closeTimer);
    // Copying stays open to say it did, or to leave the text to copy by hand; the rest close first
    const copying = action.startsWith('copy');
    if (!copying) close({ refocus: action === 'duplicate' });
    const copied = await run(action, id, msg);
    if (copying && copied) closeTimer = setTimeout(() => close({ refocus: true }), 1400);
  });

  menu.addEventListener('keydown', (e) => {
    const list = items();
    const at = list.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    const move = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: list.length - 1 }[e.key];
    if (move !== undefined) {
      e.preventDefault();
      list[(move + list.length) % list.length].focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close({ refocus: true });
    } else if (e.key === 'Tab') close({ refocus: true });
  });

  document.addEventListener('click', (e) => {
    const target = /** @type {Element} */ (e.target);
    if (current && !menu.contains(target) && !target.closest('[aria-haspopup=menu]')) close();
  });
  // The menu is fixed to the screen: on a scroll it follows its button, and closes once the button leaves the screen
  // (or when it was opened at a pointer, which has no anchor to follow). Closing on every scroll lost the menu to the
  // scrolls a phone or a test makes right after opening it.
  addEventListener(
    'scroll',
    () => {
      if (!current) return;
      const box = current.trigger.getBoundingClientRect();
      if (current.point || box.bottom < 0 || box.top > innerHeight) close();
      else placeAt(current.trigger);
    },
    true,
  );
  addEventListener('resize', () => close());

  document.addEventListener('contextmenu', (e) => {
    const card = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest('.ocard[data-id]'));
    if (!card || !wide.matches) return;
    e.preventDefault();
    open(card, card.dataset.id, { x: e.clientX, y: e.clientY });
  });

  return { open, close };
}
