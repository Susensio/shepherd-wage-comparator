/** What a backup holds (your offers and settings) and when you last saved one. */

import { KEY, myOffers, state, store } from '../state.js';

const DAY = 864e5;

/** Your offers and settings, as the text of a backup. */
export const backupText = () => JSON.stringify({ offers: myOffers(), cfg: state.config });

/** A short fingerprint of your offers, to know whether they changed since the last backup. */
function signature() {
  let h = 0;
  for (const c of JSON.stringify(myOffers())) h = (h * 31 + c.charCodeAt(0)) | 0;
  return String(h);
}

/** Notes that a backup was just saved. */
export const markBackup = () => store.set(KEY.backup, { date: Date.now(), signature: signature() });

/** «Ahora no»: the reminder is not shown for a week. */
export const snoozeReminder = () => store.set(KEY.backupNotice, Date.now() + 7 * DAY);

/**
 * The last backup: when, how long ago, whether your offers changed since, and whether to remind you to save one
 * (with complete offers, changed for over a week, and not snoozed).
 */
export function backupStatus(hasCompleteOffers) {
  const last = store.get(KEY.backup, null);
  const changed = !last || last.signature !== signature();
  const pending = !last || (changed && Date.now() - last.date > 7 * DAY);
  return {
    last,
    days: last ? Math.floor((Date.now() - last.date) / DAY) : 0,
    changed,
    remind: hasCompleteOffers && pending && Date.now() > store.get(KEY.backupNotice, 0),
  };
}
