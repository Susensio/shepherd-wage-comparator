/**
 * What scrolls. Wide screens scroll the page. Phones scroll #scroller, so that Chrome's stretch at the ends of the
 * content moves only the content and leaves the tab bar, which sits outside it, still (ADR-0021).
 */

import { $ } from '../dom.js';

/** From this width the page scrolls and the tabs sit in the app bar; keep in step with the CSS. */
export const wide = window.matchMedia('(min-width: 1024px)');

const pane = () => $('#scroller');

/** The element whose scrollTop is the reader's place. */
export const scroller = () => (wide.matches ? /** @type {HTMLElement} */ (document.scrollingElement) : pane());

export const scrollPosition = () => scroller().scrollTop;

/** @param {number} top @param {ScrollBehavior} [behavior] */
export const scrollToTop = (top, behavior) => scroller().scrollTo({ top, behavior });

/** The visible part of what scrolls, in viewport coordinates. */
export function visibleArea() {
  if (wide.matches) return { top: 0, height: innerHeight };
  const { top, height } = pane().getBoundingClientRect();
  return { top, height };
}

/** The element that holds absolutely positioned things placed in `scroller()`'s coordinates. */
export const overlayHost = () => (wide.matches ? document.body : pane());

/** Fires when what scrolls scrolls (scroll events do not bubble, so this listens in the capture phase). */
export const onScroll = (/** @type {() => void} */ fn) =>
  addEventListener('scroll', fn, { passive: true, capture: true });
