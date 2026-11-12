/**
 * The record on the ficha (ADR-0032): what the screens of a job under way or finished show (`recordContext`) and what
 * their buttons do, through `offers`. Nothing here is saved but the record itself: the month on the calendar, the
 * review and the questions that ask twice are only what the page remembers while open.
 */

import { $ } from '../dom.js';
import { num } from '../format.js';
import { monthAccounts, spanOf, standingOf } from '../model/accounts.js';
import { phaseOf } from '../model/phase.js';
import { lastWayOf } from '../model/record.js';
import { missing, todayISO } from '../offer.js';
import { offers } from '../offers.js';
import { active, calcContext, settleOffer } from '../state.js';
import { recordClaimText } from '../text.js';
import { copyText } from './dom.js';
import { closeReview, openReview } from './navigation.js';

/**
 * @typedef {object} CalendarContext
 * @property {'ficha' | 'review'} mode
 * @property {ReturnType<typeof monthAccounts>} acc
 * @property {number} index where this month is among `count`
 * @property {number} count
 * @property {number} netFactor the figures of the month are shown net
 * @property {boolean} asking whether «Reabrir» is waiting for its confirmation
 * @property {boolean} canClose only a month that has ended can be closed
 *
 * @typedef {object} ReviewDone the review has gone through every month
 * @property {'review'} mode
 * @property {true} done
 * @property {number} closed months it closed
 * @property {string[]} left months still as the offer has them
 *
 * @typedef {object} RecordContext
 * @property {'underway' | 'finished'} phase
 * @property {string} today
 * @property {ReturnType<typeof standingOf>} standing
 * @property {ReturnType<typeof settleOffer>} settled
 * @property {import('../model/settle.js').Payment[]} payments newest first
 * @property {string | null} fresh the cobro just added
 * @property {{ type: string, id?: string } | null} ask
 * @property {boolean} showAll the whole list of cobros, each removable, instead of the last two
 * @property {CalendarContext | null} calendar
 * @property {CalendarContext | ReviewDone | null} review
 */

/** What the page remembers while open. */
const ui = {
  /** The month on the calendar, by offer. */
  months: /** @type {Record<string, string>} */ ({}),
  /** A question that waits for a second tap: reopening a month, removing a cobro. */
  ask: /** @type {{ type: string, id?: string } | null} */ (null),
  /** «Repasar los meses»: the months to go through and where it is. */
  review: /** @type {{ offerId: string, keys: string[], index: number, closed: number } | null} */ (null),
  fresh: /** @type {string | null} */ (null),
  /** «Cobros» lists every cobro. */
  showAll: false,
};

/** What `ui/record.js` asks of the page. */
const callbacks = { paint: () => {} };
/** @param {Partial<typeof callbacks>} given `paint` repaints the page */
export function setUpRecord(given) {
  Object.assign(callbacks, given);
  const sheet = sheetElements();
  sheet.form.addEventListener('submit', savePayment);
}

/** The phase of an offer that has a record to show, or null: not decided, only an offer, or not complete. */
export function recordPhase(o, today = todayISO()) {
  const phase = phaseOf(o, today);
  return (phase === 'underway' || phase === 'finished') && !missing(o.terms).length ? phase : null;
}

/** Where the calendar starts for an offer: this month under way, the first still open once finished. */
function defaultMonth(rows, today, phase) {
  const shown = rows.filter((row) => row.from <= today);
  if (phase === 'underway') return (shown.at(-1) ?? rows[0]).month;
  return (shown.find((row) => !row.closed) ?? shown.at(-1)).month;
}

/** The month the calendar shows: the one picked if it has started, else the default. */
function monthOnCalendar(o, rows, today, phase) {
  const picked = ui.months[o.id];
  return rows.some((row) => row.month === picked && row.from <= today) ? picked : defaultMonth(rows, today, phase);
}

/**
 * Everything the record's views need for an offer, or null where it has none.
 * @param {any} o
 * @param {{ netFactor: number }} r its figures: what reaches the shepherd is shown, not the gross
 * @returns {RecordContext | null}
 */
export function recordContext(o, r) {
  const today = todayISO();
  const phase = recordPhase(o, today);
  if (!phase) return null;
  const record = o.mine.record;
  const settled = settleOffer(o);
  if (!settled.rows.length) return null;
  const ctx = calcContext();
  const standing = standingOf(settled, today, phase, record.payments, r.netFactor);
  const shown = settled.rows.filter((row) => row.from <= today);
  const calendarOf = (key, mode, index, count) => ({
    mode,
    acc: monthAccounts(o, record, key, today, ctx),
    index,
    count,
    netFactor: r.netFactor,
    asking: ui.ask?.type === 'reopen' && ui.ask.id === key,
    canClose: settled.rows.find((row) => row.month === key).to < today,
  });
  const key = monthOnCalendar(o, settled.rows, today, phase);
  const index = shown.findIndex((row) => row.month === key);
  /** @type {CalendarContext | ReviewDone | null} */
  let review = null;
  if (ui.review?.offerId === o.id) {
    const { keys, index: at, closed } = ui.review;
    review =
      at >= keys.length
        ? {
            mode: 'review',
            done: true,
            closed,
            left: keys.filter((k) => !settled.rows.find((row) => row.month === k).closed),
          }
        : calendarOf(keys[at], 'review', at, keys.length);
  }
  return {
    phase,
    today,
    standing,
    settled,
    payments: [...record.payments]
      .map((p, i) => ({ p, i }))
      .sort((a, b) => b.p.date.localeCompare(a.p.date) || b.i - a.i)
      .map((x) => x.p),
    fresh: ui.fresh,
    ask: ui.ask,
    showAll: ui.showAll,
    calendar: calendarOf(key, 'ficha', index, shown.length),
    review,
  };
}

/* --- The cobro sheet --- */

function sheetElements() {
  return {
    dialog: /** @type {HTMLDialogElement} */ ($('#paySheet')),
    form: /** @type {HTMLFormElement} */ ($('#payForm')),
    amount: /** @type {HTMLInputElement} */ ($('#payAmount')),
    date: /** @type {HTMLInputElement} */ ($('#payDate')),
    note: /** @type {HTMLInputElement} */ ($('#payNote')),
    error: $('#payError'),
  };
}

const setWay = (way) => {
  for (const b of document.querySelectorAll('#paySheet [data-via]'))
    b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.via === way));
};
const wayChosen = () =>
  /** @type {'payroll' | 'cash'} */ (
    /** @type {HTMLElement | null} */ (document.querySelector('#paySheet [data-via][aria-pressed=true]'))?.dataset
      .via ?? 'payroll'
  );

function openPaySheet() {
  const sheet = sheetElements();
  const today = todayISO();
  sheet.form.reset();
  sheet.date.value = today;
  sheet.date.max = today;
  setWay(lastWayOf(active().mine.record));
  sheet.error.textContent = '';
  sheet.dialog.showModal();
  sheet.amount.focus();
}

function savePayment(event) {
  event.preventDefault();
  const sheet = sheetElements();
  const amount = num(sheet.amount.value);
  if (!(amount > 0)) {
    sheet.error.textContent = 'Escribe una cantidad mayor que cero.';
    sheet.amount.focus();
    return;
  }
  if (!sheet.date.value || sheet.date.value > todayISO()) {
    sheet.error.textContent = 'La fecha no puede ser posterior a hoy.';
    sheet.date.focus();
    return;
  }
  const payment = offers.addPayment(active(), {
    date: sheet.date.value,
    amount,
    via: wayChosen(),
    note: sheet.note.value,
  });
  sheet.dialog.close();
  ui.fresh = payment.id;
  callbacks.paint();
  setTimeout(() => {
    ui.fresh = null;
    callbacks.paint();
  }, 2200);
}

/* --- Buttons --- */

const spanOfMonth = (key) => spanOf(settleOffer(active()).rows.find((row) => row.month === key));

/** The month of the calendar moves among those that have started. */
function moveMonth(step) {
  const o = active();
  const today = todayISO();
  const all = settleOffer(o).rows;
  const rows = all.filter((row) => row.from <= today);
  const at = rows.findIndex((row) => row.month === monthOnCalendar(o, all, today, recordPhase(o, today)));
  const next = rows[Math.min(rows.length - 1, Math.max(0, at + step))];
  ui.months[o.id] = next.month;
  ui.ask = null;
}

/** The calendar stays on a month it was used on, though the month stops being the first still open. */
const stayOn = (key) => {
  ui.months[active().id] = key;
};

/** Leaves the review. */
const endReview = () => {
  ui.review = null;
};

/** The buttons of the record, by `data-action`: `events.js` joins them to its table. */
export const recordActions = {
  toggleDay(b) {
    stayOn(b.dataset.key);
    offers.toggleDay(active(), spanOfMonth(b.dataset.key), b.dataset.day);
    callbacks.paint();
  },
  calendarMonth(b) {
    moveMonth(Number(b.dataset.step));
    callbacks.paint();
  },
  closeMonth(b) {
    stayOn(b.dataset.key);
    offers.closeMonth(active(), spanOfMonth(b.dataset.key));
    callbacks.paint();
  },
  reopenAsk(b) {
    stayOn(b.dataset.key);
    ui.ask = { type: 'reopen', id: b.dataset.key };
    callbacks.paint();
  },
  reopenYes(b) {
    ui.ask = null;
    offers.reopenMonth(active(), b.dataset.key);
    callbacks.paint();
  },
  reopenNo() {
    ui.ask = null;
    callbacks.paint();
  },
  openPaySheet,
  payVia: (b) => setWay(b.dataset.via),
  payCancel: () => sheetElements().dialog.close(),
  removePaymentAsk(b) {
    ui.ask = { type: 'payment', id: b.dataset.id };
    callbacks.paint();
  },
  removePayment(b) {
    ui.ask = null;
    offers.removePayment(active(), b.dataset.id);
    callbacks.paint();
  },
  /** «Ver todos los cobros»: the whole list in place, each cobro removable. */
  toggleCobros() {
    ui.showAll = !ui.showAll;
    ui.ask = null;
    callbacks.paint();
  },
  reviewStart() {
    const o = active();
    const rows = settleOffer(o).rows.filter((row) => !row.closed);
    ui.review = { offerId: o.id, keys: rows.map((row) => row.month), index: 0, closed: 0 };
    ui.ask = null;
    openReview();
    callbacks.paint();
  },
  reviewClose(b) {
    offers.closeMonth(active(), spanOfMonth(b.dataset.key));
    ui.review.closed++;
    ui.review.index++;
    callbacks.paint();
  },
  reviewSkip() {
    ui.review.index++;
    callbacks.paint();
  },
  reviewEnd() {
    endReview();
    closeReview();
    callbacks.paint();
  },
  /** The copy icon of the accounts: the claim, from what the record shows. */
  async copyRecordClaim(b) {
    const o = active();
    const msg = /** @type {HTMLElement} */ (b.closest('.block').querySelector('.copy-msg'));
    const copied = await copyText(recordClaimText(o, settleOffer(o), o.mine.record), msg, {
      ok: 'Texto copiado.',
      failMsg: 'No se pudo copiar. Aquí está para seleccionarlo:',
      rows: 12,
    });
    if (!copied) return;
    b.classList.add('copied');
    setTimeout(() => {
      b.classList.remove('copied');
      msg.textContent = '';
    }, 2000);
  },
};

/** Back left the review: its history entry is already gone. */
export const dismissReview = endReview;

/** Switching to another offer, or to another phase, ends what was open for the one before. */
export function forgetRecordUi(offerId) {
  if (ui.review && ui.review.offerId !== offerId) {
    endReview();
    closeReview();
  }
  ui.ask = null;
}

/**
 * What a card says of a job under way or finished: its phase and, with a record to show, what is owed and how many
 * months are still not closed. Null phase for an offer only offered.
 * @param {any} o
 * @returns {{ phase: 'undecided' | 'underway' | 'finished' | null, line: { hasPayments: boolean, owed: number, unclosed: number } | null }}
 */
export function cardRecord(o, r) {
  const today = todayISO();
  const phase = phaseOf(o, today);
  if (phase === 'offerOnly') return { phase: null, line: null };
  if (!recordPhase(o, today)) return { phase, line: null };
  const settled = settleOffer(o);
  const s = standingOf(
    settled,
    today,
    /** @type {'underway' | 'finished'} */ (phase),
    o.mine.record.payments,
    r.netFactor,
  );
  return {
    phase,
    line: {
      hasPayments: s.hasPayments,
      owed: Math.max(0, s.balance),
      unclosed: s.unclosed.length,
    },
  };
}
