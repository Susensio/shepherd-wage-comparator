/**
 * Motion: the same duration and curve everywhere (the CSS's --t and --ease), folding sections by animating their
 * height, and scrolling to things.
 */

import { $ } from '../dom.js';
import { saveFold } from './folds.js';
import { scrollPosition, scrollToTop, visibleArea } from './scroller.js';

const ANIM = { duration: 220, easing: 'cubic-bezier(.2,.7,.3,1)' };
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animates an element if it can; otherwise does nothing. A longer distance takes a little longer. */
/**
 * @param {Element} el
 * @param {Keyframe[] | PropertyIndexedKeyframes} frames
 * @param {KeyframeAnimationOptions & {distance?: number}} [options]
 * @returns {Animation | null}
 */
export function animate(el, frames, { distance = 0, ...options } = {}) {
  if (reducedMotion() || !el.animate) return null;
  return el.animate(frames, {
    duration: Math.min(ANIM.duration * 1.6, ANIM.duration + distance / 10),
    easing: ANIM.easing,
    ...options,
  });
}

/** Appears with a slight fade: fields being shown, the offer summary. */
export const fadeIn = (el) =>
  animate(el, [
    { opacity: 0, transform: 'translateY(-4px)' },
    { opacity: 1, transform: 'none' },
  ]);

/**
 * Opens or closes a collapsible animating its height. The end state is measured without painting it, then animated
 * to. While closing it carries the «closing» class, so the arrow and the summary change at once, not at the end.
 * @param {HTMLDetailsElement & {_anims?: Animation[] | null, _animating?: boolean}} d
 * @param {boolean} opening
 * @returns {Animation | undefined} the animation, if there is one
 */
export function toggleFold(d, opening) {
  for (const a of d._anims || []) a.cancel();
  const from = d.offsetHeight;
  d.open = opening;
  const to = d.offsetHeight;
  d.open = true; // the end state is measured without painting it; meanwhile, open
  if (!opening) d.classList.add('closing');
  d._animating = true;
  d.style.overflow = 'hidden';
  // Only what is on screen is animated: below it things appear or go at once, so a long section slides at the same
  // pace as a short one instead of filling the screen in one go
  const area = visibleArea();
  const visible = Math.max(0, area.top + area.height - d.getBoundingClientRect().top);
  const start = opening ? from : Math.min(from, Math.max(to, visible));
  const end = opening ? Math.min(to, Math.max(from, visible)) : to;
  const anim = animate(d, { height: [`${start}px`, `${end}px`] }, { distance: Math.abs(end - start) });
  d._anims = anim ? [anim] : [];
  const finish = () => {
    d.style.overflow = '';
    d.classList.remove('closing');
    d._animating = false;
    d._anims = null;
    saveFold(d);
  };
  if (!anim) {
    d.open = opening;
    finish();
    return undefined;
  }
  anim.onfinish = () => {
    d.open = opening;
    finish();
  };
  anim.oncancel = finish;
  return anim;
}

let scrollTimer;
/** Stops a pending second aim of scrollToElement. */
export const cancelScroll = () => clearTimeout(scrollTimer);

/**
 * Scrolls what scrolls to an element. Only this page moves (scrollIntoView would also move the outer one, if embedded),
 * and it aims again once the page settles: closing the phone keyboard or folding sections changes heights midway.
 * @param {HTMLElement | null} el
 * @param {'start' | 'center'} align
 */
export function scrollToElement(el, align = 'start') {
  if (!el) return;
  const targetY = () => {
    const box = el.getBoundingClientRect();
    // The entry's header sticks to the top and would cover it
    const nav = $('#entry:not([hidden]) .entryhead')?.getBoundingClientRect().height || 0;
    const area = visibleArea();
    const offset =
      align === 'center' ? box.top - area.top - (area.height - box.height) / 2 : box.top - area.top - nav - 8;
    return Math.max(0, scrollPosition() + offset);
  };
  const behavior = () => (reducedMotion() ? 'instant' : 'smooth');
  requestAnimationFrame(() => scrollToTop(targetY(), behavior()));
  cancelScroll();
  scrollTimer = setTimeout(() => {
    const y = targetY();
    if (Math.abs(y - scrollPosition()) > 4) scrollToTop(y, behavior());
  }, 650);
}
