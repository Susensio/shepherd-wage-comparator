/** Element lookups, below the views so the two that fill static markup (form, settings) can use them. */

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
