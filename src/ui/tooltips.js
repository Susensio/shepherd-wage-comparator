/** Explanations on tap ([data-tip]): a bubble under the element. */

import { $ } from '../dom.js';
import { onScroll, overlayHost, scrollPosition } from './scroller.js';

let openedAt = 0;

function close() {
  $('.pop')?.remove();
  $('[data-tip].on')?.classList.remove('on');
}

function open(el) {
  const pop = document.createElement('div');
  pop.className = 'pop';
  pop.setAttribute('role', 'tooltip');
  pop.textContent = el.dataset.tip;
  const host = overlayHost();
  host.appendChild(pop);
  el.classList.add('on');
  openedAt = scrollPosition();
  const hostBox = host.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  const margin = 12;
  const width = pop.offsetWidth;
  const left = Math.max(margin, Math.min(box.left, document.documentElement.clientWidth - margin - width));
  // In the host's own coordinates: the page's on wide screens (where the host is the body, at the origin), else the scroller's
  const origin =
    host === document.body ? { x: scrollX, y: scrollY } : { x: -hostBox.left, y: -hostBox.top + host.scrollTop };
  pop.style.left = `${left + origin.x}px`;
  pop.style.top = `${box.bottom + 8 + origin.y}px`;
  // the little arrow points at the element
  pop.style.setProperty('--arrow-x', `${Math.max(12, Math.min(width - 12, box.left + box.width / 2 - left))}px`);
}

export function setUpTooltips() {
  document.addEventListener('click', (e) => {
    const target = /** @type {Element} */ (e.target);
    if (target.closest('.pop')) return;
    const el = /** @type {HTMLElement | null} */ (target.closest('[data-tip]'));
    const wasOpen = el?.classList.contains('on');
    close();
    if (el && !wasOpen) {
      e.preventDefault();
      open(el);
    }
  });
  document.addEventListener('keydown', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (e.key === 'Escape') close();
    else if ((e.key === 'Enter' || e.key === ' ') && target.matches?.('[data-tip]')) {
      e.preventDefault();
      target.click();
    }
  });
  addEventListener('resize', close);
  // a slight scroll while tapping does not close it
  onScroll(() => Math.abs(scrollPosition() - openedAt) > 24 && $('.pop') && close());
}
