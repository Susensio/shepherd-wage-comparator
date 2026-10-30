/** Small DOM helpers: lookups, the clipboard and buttons that ask twice. */

/**
 * The first element matching `selector`, under `root`.
 * @param {string} selector
 * @param {ParentNode} [root]
 * @returns {HTMLElement}
 */
export const $ = (selector, root = document) => /** @type {HTMLElement} */ (root.querySelector(selector));
/**
 * Every element matching `selector`, under `root`.
 * @param {string} selector
 * @param {ParentNode} [root]
 * @returns {HTMLElement[]}
 */
export const $$ = (selector, root = document) => /** @type {HTMLElement[]} */ ([...root.querySelectorAll(selector)]);

/**
 * Copies to the clipboard and says so in `msg`. If it cannot, it leaves the text selected to copy by hand: in
 * `field` if given, or in a box under the message. Returns whether it could copy.
 * @param {string} content
 * @param {HTMLElement} msg
 * @param {{ok: string, failMsg: string, rows?: number, field?: HTMLTextAreaElement}} options
 */
export async function copyText(content, msg, { ok, failMsg, rows = 6, field }) {
  try {
    await navigator.clipboard.writeText(content);
    msg.textContent = ok;
    return true;
  } catch {
    msg.textContent = failMsg;
    const next = msg.nextElementSibling;
    const previous = next?.classList.contains('copy-fallback') ? /** @type {HTMLTextAreaElement} */ (next) : null;
    const box =
      field || previous || Object.assign(document.createElement('textarea'), { rows, className: 'copy-fallback' });
    if (!field && !previous) msg.after(box);
    box.value = content;
    box.select();
    return false;
  }
}

/** A button that asks for a second tap before acting (delete, replace…). */
export function doubleTap(button, label, ms) {
  let armed = false;
  let timer;
  const reset = () => {
    armed = false;
    clearTimeout(timer);
    button.textContent = label;
  };
  return {
    reset,
    /** True on the second tap; on the first, arms it and shows `notice`. */
    confirm(notice) {
      if (armed) {
        reset();
        return true;
      }
      armed = true;
      button.textContent = notice;
      clearTimeout(timer);
      timer = setTimeout(reset, ms);
      return false;
    },
  };
}
