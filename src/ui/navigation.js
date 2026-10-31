/** Where the reader is: the tab shown, the page (account, settings) open over it, and the way back from a page. */

import { saveTab } from '../state.js';
import { $ } from './dom.js';

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

/** What the controller paints when a tab is shown or a page opened. */
const hooks = {
  tabShown: /** @type {(tab: string) => void} */ (() => {}),
  pageOpened: /** @type {(fromPrompt: boolean) => void} */ (() => {}),
};

/** @param {Partial<typeof hooks>} given */
export function onNavigate(given) {
  Object.assign(hooks, given);
}

export const currentTab = () => where.tab;
/** The page open over the tabs, or null. */
export const openPageName = () => where.page;
/** Whether the tab is what the reader sees: shown and no page over it. */
export const tabInView = (/** @type {string} */ tab) => where.tab === tab && !where.page;

/** Hides every panel but `shown`; a page also hides the tabs and the intro (body.on-page, in the CSS). */
function showPanel(shown) {
  for (const t of [...TABS, ...PAGES]) $(`[data-panel=${t}]`).hidden = t !== shown;
  where.page = PAGES.includes(shown) ? shown : null;
  document.body.classList.toggle('on-page', !!where.page);
}

/** Shows a tab. With `scrollUp`, if the page is further down, it goes back up to the tabs. */
export function showTab(tab, scrollUp) {
  const shown = TABS.includes(tab) ? tab : 'offers'; // a stored «settings» from before the pages opens Ofertas
  showPanel(shown);
  where.tab = shown;
  for (const t of TABS) $(`.tabs [data-tab=${t}]`).setAttribute('aria-selected', String(t === shown));
  saveTab(shown);
  hooks.tabShown(shown);
  const tabs = $('.tabs');
  if (scrollUp && tabs.getBoundingClientRect().top < 0) window.scrollTo({ top: tabs.offsetTop });
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
    where.scrollBeforePage = scrollY;
    history.pushState({ page: true }, ''); // the phone's Back closes the page, not the site
  }
  showPanel(page);
  hooks.pageOpened(fromPrompt);
  window.scrollTo({ top: 0 });
}

export const openAccountPage = (fromPrompt = false) => openPage('account', fromPrompt);
export const openSettingsPage = () => openPage('settings');

/** Back to the tab the page was opened from, where it was scrolled. */
function leavePage() {
  showTab(where.tab);
  window.scrollTo({ top: where.scrollBeforePage, behavior: 'instant' });
}

/** «Volver»: through the history when the page pushed an entry, so Back and «Volver» stay in step. */
export function closePage() {
  if (history.state?.page) history.back();
  else leavePage();
}

/** Back (or forward) with a page open closes it. */
export function onPopState() {
  if (where.page) leavePage();
}

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
