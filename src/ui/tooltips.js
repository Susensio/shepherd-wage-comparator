/** Explanations on tap ([data-tip]): a bubble under the element. */

import { $ } from './dom.js';

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
  document.body.appendChild(pop);
  el.classList.add('on');
  openedAt = scrollY;
  const box = el.getBoundingClientRect();
  const margin = 12;
  const width = pop.offsetWidth;
  const left = Math.max(margin, Math.min(box.left, document.documentElement.clientWidth - margin - width));
  pop.style.left = `${left + scrollX}px`;
  pop.style.top = `${box.bottom + 8 + scrollY}px`;
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
  addEventListener('scroll', () => Math.abs(scrollY - openedAt) > 24 && $('.pop') && close(), { passive: true });
}
