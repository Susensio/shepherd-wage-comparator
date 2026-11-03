/**
 * Pull down to reload, on phones. The content scrolls in #scroller (ADR-0021), and Chrome only offers its own pull to
 * refresh on the whole page, so a pull past the top of #scroller reloads the page here.
 */

import { $ } from '../dom.js';
import { wide } from './scroller.js';

/** How far the finger travels, past the top, before letting go reloads. */
const THRESHOLD = 110;
/** The circle follows the finger at this fraction of its travel, so it lags a little behind it as native ones do. */
const FOLLOW = 0.5;

export function setUpPullRefresh() {
  const pane = /** @type {HTMLElement} */ ($('#scroller'));
  const circle = /** @type {HTMLElement} */ ($('#pullRefresh'));
  if (!pane || !circle) return;
  /** @type {number | null} */
  let startY = null;
  let travel = 0;

  const show = (distance) => {
    const shown = Math.min(distance * FOLLOW, THRESHOLD * FOLLOW + 16);
    circle.style.transform = `translate(-50%, ${shown}px) rotate(${distance * 2}deg)`;
    circle.style.opacity = String(Math.min(1, distance / THRESHOLD));
    circle.classList.toggle('ready', distance >= THRESHOLD);
  };
  const reset = () => {
    startY = null;
    travel = 0;
    circle.style.transform = '';
    circle.style.opacity = '';
    circle.classList.remove('ready');
  };

  pane.addEventListener(
    'touchstart',
    (e) => {
      // Only from the very top, on phones, and not while an offer is being entered step by step
      if (wide.matches || pane.scrollTop > 0 || document.body.classList.contains('on-entry') || e.touches.length > 1)
        return;
      startY = e.touches[0].clientY;
    },
    { passive: true },
  );
  pane.addEventListener(
    'touchmove',
    (e) => {
      if (startY === null) return;
      // The content scrolled after all: not a pull
      if (pane.scrollTop > 0) return reset();
      // Not (yet) down: keep the start, show nothing; the first moves of a finger can be still
      travel = Math.max(0, e.touches[0].clientY - startY);
      show(travel);
    },
    { passive: true },
  );
  const end = () => {
    if (startY !== null && travel >= THRESHOLD) {
      circle.classList.add('spinning');
      location.reload();
      return;
    }
    reset();
  };
  pane.addEventListener('touchend', end, { passive: true });
  pane.addEventListener('touchcancel', reset, { passive: true });
}
