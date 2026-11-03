/**
 * Where the reader is: the tab shown, the page (account, settings) open over it, and the way back from a page. Over
 * the Ofertas tab, the list shows an offer's ficha, and the guided entry covers the whole screen. Each page, ficha
 * and entry pushes a history entry, so the phone's Back goes one level up. On wide screens the list and the ficha
 * are side by side (ADR-0021): the ficha is always open there and pushes nothing.
 */

import { $ } from '../dom.js';
import { saveTab } from '../state.js';
import { scrollPosition, scrollToTop, wide } from './scroller.js';

const TABS = ['offers', 'compare', 'laws'];

/** The pages opened from the bar's buttons, over the tab shown: each is a panel of its own. */
const PAGES = ['account', 'settings'];

/** @typedef {'account' | 'settings'} PageName */

const where = {
  /** The tab shown, or the one a page was opened from. */
  tab: 'offers',
  page: /** @type {PageName | null} */ (null),
  /** The account page was opened from a tooltip: leave it once signed in. */
  leaveAfterSignIn: false,
  /** The page that tooltip was on (Ajustes), to go back to it instead of the tab. */
  promptFromPage: /** @type {PageName | null} */ (null),
  scrollBeforePage: 0,
};

/** Over the Ofertas tab. `ficha`: an offer's ficha, instead of the list. `entry`: the guided entry, over either. */
const view = { ficha: false, entry: false };
/** Where the list and the ficha were scrolled when something opened over them. */
const scrolls = { list: 0, ficha: 0 };

/** What the controller paints when a tab is shown or a page opened. */
const hooks = {
  tabShown: /** @type {(tab: string) => void} */ (() => {}),
  pageOpened: /** @type {(fromPrompt: boolean) => void} */ (() => {}),
  /** The ficha or the entry opened or closed. */
  viewChanged: /** @type {() => void} */ (() => {}),
  /** Back closed the entry: it is dismissed, not saved. */
  entryDismissed: /** @type {() => void} */ (() => {}),
};

/** @param {Partial<typeof hooks>} given */
export function onNavigate(given) {
  Object.assign(hooks, given);
}

export const currentTab = () => where.tab;
/** The page open over the tabs, or null. */
export const openPageName = () => where.page;
/** Whether the tab is what the reader sees: shown and no page over it. */
export const fichaOpen = () => view.ficha;
export const entryOpen = () => view.entry;
export const tabInView = (/** @type {string} */ tab) => where.tab === tab && !where.page;

/** Shows the list and the ficha as the view says; on wide screens both, with the ficha of the active offer. */
function applyView() {
  $('#offersList').hidden = !wide.matches && view.ficha;
  $('#ficha').hidden = !view.ficha;
  $('#entry').hidden = !view.entry;
  document.body.classList.toggle('on-entry', view.entry);
  document.body.classList.toggle('in-ficha', view.ficha && !wide.matches);
}
if (wide.matches) view.ficha = true;
applyView();

/** The tabs sit in the app bar on wide screens; on phones, after #scroller, so its stretch does not move them. */
function placeTabs() {
  const tabs = $('.tabs');
  if (wide.matches) $('.appbar').insertBefore(tabs, $('.bar-actions'));
  else document.body.append(tabs);
}
placeTabs();
wide.addEventListener('change', () => {
  placeTabs();
  go({ ficha: wide.matches, entry: view.entry }, 'none');
});

/** Hides every panel but `shown`; a page also hides the tabs and the intro (body.on-page, in the CSS). */
function showPanel(shown) {
  for (const t of [...TABS, ...PAGES]) $(`[data-panel=${t}]`).hidden = t !== shown;
  where.page = PAGES.includes(shown) ? shown : null;
  document.body.classList.toggle('on-page', !!where.page);
}

/** Shows a tab. With `scrollUp`, the page goes back to the top. */
export function showTab(tab, scrollUp) {
  const shown = TABS.includes(tab) ? tab : 'offers'; // a stored «settings» from before the pages opens Ofertas
  showPanel(shown);
  where.tab = shown;
  for (const t of TABS) $(`.tabs [data-tab=${t}]`).setAttribute('aria-selected', String(t === shown));
  saveTab(shown);
  hooks.tabShown(shown);
  if (scrollUp) scrollToTop(0);
}

/**
 * Opens a page over the tab shown, which stays selected so «Volver» knows where to go. `fromPrompt`: the account page
 * was opened from a tooltip, so signing in sends the reader back at once; from the button, the page stays, since
 * whoever went there may want the profile or sharing next.
 * @param {PageName} page
 */
function openPage(page, fromPrompt = false) {
  where.leaveAfterSignIn = fromPrompt;
  where.promptFromPage = fromPrompt ? where.page : null; // a tooltip on Ajustes returns to Ajustes
  if (!where.page) {
    where.scrollBeforePage = scrollPosition();
    history.pushState({ page: true }, ''); // the phone's Back closes the page, not the site
  }
  showPanel(page);
  hooks.pageOpened(fromPrompt);
  scrollToTop(0);
}

export const openAccountPage = (fromPrompt = false) => openPage('account', fromPrompt);
export const openSettingsPage = () => openPage('settings');

/** Back to the tab the page was opened from, where it was scrolled. */
function leavePage() {
  showTab(where.tab);
  scrollToTop(where.scrollBeforePage, 'instant');
}

/** «Volver»: through the history when the page pushed an entry, so Back and «Volver» stay in step. */
export function closePage() {
  if (history.state?.page) history.back();
  else leavePage();
}

/** Back (or forward) closes what is open on top: the entry, else the page, else the ficha. */
export function onPopState() {
  const kept = history.state ?? {};
  if (view.entry && !kept.entry) {
    hooks.entryDismissed();
    go({ ficha: !!kept.ficha, entry: false }, 'none');
  } else if (where.page && !kept.page) leavePage();
  else if (view.ficha && !view.entry && !kept.ficha && !wide.matches) go({ ficha: false, entry: false }, 'none');
}

/** Forgets history entries left from before a reload, whose views are gone. */
export const resetHistory = () => history.replaceState(null, '');

/**
 * Changes what shows over the Ofertas tab, with its history entry: `push` a new one, `replace` this one, `back` to
 * drop the one that was pushed (the popstate that follows finds nothing left to close), or `none` when Back did it.
 * @param {{ ficha: boolean, entry: boolean }} next
 * @param {'push' | 'replace' | 'back' | 'none'} how
 */
function go(next, how) {
  if (wide.matches) next = { ...next, ficha: true };
  const depth = (v) => (v.entry ? 2 : v.ficha ? 1 : 0);
  const deeper = depth(next) > depth(view);
  if (!view.entry) scrolls[view.ficha ? 'ficha' : 'list'] = scrollPosition();
  const marker = next.entry ? { entry: true } : next.ficha && !wide.matches ? { ficha: true } : null;
  Object.assign(view, next);
  if (how === 'push') history.pushState(marker, '');
  else if (how === 'replace') history.replaceState(marker, '');
  else if (how === 'back' && (history.state?.entry || history.state?.ficha)) history.back();
  applyView();
  hooks.viewChanged();
  const restore = !deeper && (how === 'back' || how === 'none');
  scrollToTop(restore && !view.entry ? scrolls[view.ficha ? 'ficha' : 'list'] : 0, 'instant');
}

/** An offer's ficha, in place of the list. */
export function openFicha() {
  showTab('offers');
  if (!view.ficha) go({ ficha: true, entry: false }, 'push');
}
/** «Ofertas», on the ficha: back to the list. */
export function closeFicha() {
  if (!wide.matches) go({ ficha: false, entry: false }, 'back');
}
/** The guided entry, over the list (a new offer) or the ficha (one step of it). */
export const openEntry = () => go({ ficha: view.ficha, entry: true }, 'push');
/** Out of the entry, to what it covered. */
export const closeEntry = () => go({ ficha: view.ficha, entry: false }, 'back');
/** The last step of a new offer: its ficha, where the entry was. */
export const entryToFicha = () => go({ ficha: true, entry: false }, view.ficha ? 'back' : 'replace');
/** Every offer was replaced: whatever was open is gone. Leaves history as it is. */
export const resetViews = () => go({ ficha: false, entry: false }, 'none');
/** The ficha's offer is gone: the list, with no ficha to come back to. */
export const leaveFicha = () => go({ ficha: false, entry: false }, 'replace');

/** A sign-in completed: if it began at the tooltip, back to where it began. */
export function returnAfterSignIn() {
  const back = where.leaveAfterSignIn && where.page === 'account';
  const toPage = where.promptFromPage;
  where.leaveAfterSignIn = false;
  where.promptFromPage = null;
  if (!back) return;
  if (toPage) openPage(toPage);
  else closePage();
}
