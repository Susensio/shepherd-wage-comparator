/**
 * Motion: the same duration and curve everywhere (the CSS's --t and --ease), folding sections by animating their
 * height, and scrolling to things.
 */

import { $ } from './dom.js';
import { saveFold } from './folds.js';

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

/** «Datos de la oferta»: the button and the summary under it, depending on whether it is open. */
export function syncEditor(measured) {
  const open = /** @type {HTMLDetailsElement} */ ($('#editWrap')).open;
  const info = $('#editInfo');
  const appears = info.hidden && !open;
  $('#editBtn').textContent = open ? 'Hecho' : 'Modificar';
  info.hidden = open;
  if (appears && !measured) fadeIn(info);
}

/** Opens or closes «Datos de la oferta» without animation (choosing an offer, pressing «Hecho»…). */
export function openEditor(open) {
  /** @type {HTMLDetailsElement} */ ($('#editWrap')).open = open;
  syncEditor();
}

/**
 * Opens or closes a collapsible animating its height. The end state is measured without painting it, then animated
 * to. While closing it carries the «closing» class, so the arrow and the summary change at once, not at the end.
 * «Datos de la oferta» also animates the summary under it: one grows while the other shrinks and fades.
 * @param {HTMLDetailsElement & {_anims?: Animation[] | null, _animating?: boolean}} d
 * @param {boolean} opening
 * @returns {Animation | undefined} the main animation, if there is one
 */
export function toggleFold(d, opening) {
  const editor = d.id === 'editWrap';
  const info = editor ? $('#editInfo') : null;
  for (const a of d._anims || []) a.cancel();
  const from = d.offsetHeight;
  if (info) info.hidden = false;
  const infoHeight = info?.offsetHeight || 0;
  d.open = opening;
  const to = d.offsetHeight;
  d.open = true; // the end state is measured without painting it; meanwhile, open
  if (editor) $('#editBtn').textContent = opening ? 'Hecho' : 'Modificar';
  if (!opening) d.classList.add('closing');
  d._animating = true;
  d.style.overflow = 'hidden';
  // Only what is on screen is animated: below it things appear or go at once, so a long section slides at the same
  // pace as a short one instead of filling the screen in one go
  const visible = Math.max(0, innerHeight - d.getBoundingClientRect().top);
  const start = opening ? from : Math.min(from, Math.max(to, visible));
  const end = opening ? Math.min(to, Math.max(from, visible)) : to;
  const options = { distance: Math.abs(end - start) };
  const anims = [animate(d, { height: [`${start}px`, `${end}px`] }, options)];
  if (info) {
    // without the summary, its gap in the form goes too
    const hiddenMargin = `${-6 - (Number.parseFloat(getComputedStyle(info.parentElement).rowGap) || 0)}px`;
    const shownMargin = '-6px';
    info.style.overflow = 'hidden';
    anims.push(
      animate(
        info,
        opening
          ? { height: [`${infoHeight}px`, '0px'], opacity: [1, 0], marginTop: [shownMargin, hiddenMargin] }
          : { height: ['0px', `${infoHeight}px`], opacity: [0, 1], marginTop: [hiddenMargin, shownMargin] },
        options,
      ),
    );
    anims.push(animate($('.editbody', d), { opacity: opening ? [0, 1] : [1, 0] }, { ...options, fill: 'forwards' }));
  }
  d._anims = anims.filter(Boolean);
  const finish = () => {
    d.style.overflow = '';
    if (info) info.style.overflow = '';
    d.classList.remove('closing');
    d._animating = false;
    d._anims = null;
    anims[2]?.cancel();
    saveFold(d);
  };
  const settle = (measured) => {
    d.open = opening;
    finish();
    if (editor) syncEditor(measured);
  };
  if (!anims[0]) {
    settle(false);
    return undefined;
  }
  anims[0].onfinish = () => settle(true);
  anims[0].oncancel = finish;
  return anims[0];
}

let scrollTimer;
/** Stops a pending second aim of scrollToElement. */
export const cancelScroll = () => clearTimeout(scrollTimer);

/**
 * Scrolls the page to an element. Only this page moves (scrollIntoView would also move the outer one, if embedded),
 * and it aims again once the page settles: closing the phone keyboard or folding sections changes heights midway.
 * @param {HTMLElement | null} el
 * @param {'start' | 'center'} align
 */
export function scrollToElement(el, align = 'start') {
  if (!el) return;
  const targetY = () => {
    const box = el.getBoundingClientRect();
    const nav = $('.offers')?.getBoundingClientRect().height || 0;
    return Math.max(0, scrollY + (align === 'center' ? box.top - (innerHeight - box.height) / 2 : box.top - nav - 8));
  };
  const behavior = () => (reducedMotion() ? 'instant' : 'smooth');
  requestAnimationFrame(() => window.scrollTo({ top: targetY(), behavior: behavior() }));
  cancelScroll();
  scrollTimer = setTimeout(() => {
    const y = targetY();
    if (Math.abs(y - scrollY) > 4) window.scrollTo({ top: y, behavior: behavior() });
  }, 650);
}

/** Keeps --navh at the height of the offers bar, which sticks to the top. */
export function setNavHeight() {
  const nav = $('.offers');
  if (nav) document.documentElement.style.setProperty('--navh', `${nav.getBoundingClientRect().height}px`);
}
