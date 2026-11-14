/**
 * The record on the ficha (ADR-0032): what the screens of a job under way or finished show (`recordContext`) and what
 * their buttons do, through `offers`. Nothing here is saved but the record itself: the month on the calendar, the
 * review and the questions that ask twice are only what the page remembers while open.
 */

import {
  conciliationFields,
  defaultPayBy,
  employerSummaryText,
  inspectionText,
  paymentRequestText,
} from '../claim-text.js';
import { $ } from '../dom.js';
import { num } from '../format.js';
import { conciliationOffice } from '../law.js';
import {
  addableMonth,
  balanceOf,
  minimumNote,
  monthAccounts,
  monthSpan,
  spanOf,
  standingOf,
} from '../model/accounts.js';
import { claimSteps } from '../model/claim.js';
import { lawFromRecord } from '../model/compliance.js';
import { phaseOf } from '../model/phase.js';
import { lastWayOf } from '../model/record.js';
import { missing, todayISO } from '../offer.js';
import { offers } from '../offers.js';
import { active, calcContext, calcOffer, settleOffer } from '../state.js';
import { recordClaimText } from '../text.js';
import { copyText } from './dom.js';
import { closeReview, openReview } from './navigation.js';

/**
 * @typedef {object} CalendarContext
 * @property {'ficha' | 'review'} mode
 * @property {string} today ISO date
 * @property {ReturnType<typeof monthAccounts>} acc
 * @property {number} index where this month is among `count`
 * @property {number} count
 * @property {boolean} inJob the month is part of the job: a month that can be added is not until a day is worked in it
 * @property {boolean} current the month is the one in progress
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
 * @property {{ month: string, state: 'closed' | 'due' | 'now' | 'later' | 'add', selected: boolean }[]} strip the months of the job, the one on the calendar marked, and the one that can be added
 * @property {ReturnType<typeof minimumNote>} minimum where the minimum exceeds the pay agreed: what it is made of
 * @property {string | null} addable the month after the job's last that can be added, «+ Añadir <mes>»
 * @property {ReturnType<typeof settleOffer>['job']} job the period the work really had, and the offer's
 * @property {ReturnType<typeof lawFromRecord> | null} law once the job is over: what the record says of the law
 * @property {ReturnType<typeof balanceOf> | null} balance once the job is over: what it came to
 * @property {{ months: string[] } | null} nudge the months that have ended and wait to be closed, other than the one shown
 * @property {ReturnType<typeof claimContext> | null} claim once the job is over: the ladder and its texts
 * @property {boolean} nothingPaid «No se cobró nada» was said
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
  /** The date a request asks to pay by, by offer; without one, a fortnight on. */
  payBy: /** @type {Record<string, string>} */ ({}),
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
  const phase = phaseOf(o, today, o.mine.record);
  return (phase === 'underway' || phase === 'finished') && !missing(o.terms).length ? phase : null;
}

/** The claim of a job under way or finished, from its record; null for an offer not worked. */
export function recordClaimOf(o) {
  return recordPhase(o) ? recordClaimText(o, settleOffer(o), o.mine.record) : null;
}

/**
 * The claim ladder of a job finished and the texts it offers, from the record.
 * @param {any} o
 * @param {any} r
 * @param {ReturnType<typeof settleOffer>} settled
 * @param {ReturnType<typeof standingOf>} standing
 * @param {string} today
 */
function claimContext(o, r, settled, standing, today) {
  const record = o.mine.record;
  const parties = o.mine.parties ?? { employerName: '' };
  const ladder = claimSteps({ today, standing, end: record.end, marks: o.mine.claim?.steps ?? {} });
  const payBy = ui.payBy[o.id] ?? defaultPayBy(today);
  const base = { o, r, settled, standing, record, parties, today, payBy, netFactor: r.netFactor };
  const owed = standing.hasPayments && standing.falta > 0;
  return {
    ladder,
    parties,
    payBy,
    today,
    hasPayments: standing.hasPayments,
    nearest: standing.nearest,
    deadlines: standing.deadlines,
    office: conciliationOffice(o.terms.province),
    canShare: typeof navigator.share === 'function',
    summary: owed ? employerSummaryText(base) : '',
    request: owed ? paymentRequestText(base) : '',
    inspection: owed ? inspectionText(base) : '',
    fields: owed ? conciliationFields(base) : [],
  };
}

/** Where the calendar starts for an offer: this month under way, the first still open once finished. */
function defaultMonth(rows, today, phase) {
  const shown = rows.filter((row) => row.from <= today);
  if (phase === 'underway') return (shown.at(-1) ?? rows[0]).month;
  return (shown.find((row) => !row.closed) ?? shown.at(-1)).month;
}

/** The month the calendar shows: the one picked if it has started, else the default. */
function monthOnCalendar(o, rows, today, phase, addable) {
  const picked = ui.months[o.id];
  return rows.some((row) => row.month === picked && row.from <= today) || picked === addable
    ? picked
    : defaultMonth(rows, today, phase);
}

/**
 * Everything the record's views need for an offer, or null where it has none.
 * @param {any} o
 * @param {any} r its figures: what reaches the shepherd is shown, not the gross
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
  const standing = standingOf(settled, today, phase, record.payments, r.netFactor, record.nothingPaid);
  const shown = settled.rows.filter((row) => row.from <= today);
  const addable = addableMonth(settled, today);
  const rowOf = (month) => settled.rows.find((row) => row.month === month);
  const calendarOf = (key, mode, index, count) => ({
    mode,
    today,
    acc: monthAccounts(o, record, key, today, ctx, r.netFactor),
    index,
    count,
    // A month not in the job (the one that can be added) has nothing to close, and says how it joins
    inJob: Boolean(rowOf(key)),
    current: Boolean(rowOf(key)) && rowOf(key).from <= today && today <= rowOf(key).calendarTo,
    asking: ui.ask?.type === 'reopen' && ui.ask.id === key,
    canClose: Boolean(rowOf(key)) && rowOf(key).calendarTo < today,
  });
  const key = monthOnCalendar(o, settled.rows, today, phase, addable);
  const index = shown.findIndex((row) => row.month === key);
  /** @type {RecordContext['strip']} */
  const strip = settled.rows.map((row) => ({
    month: row.month,
    state: row.closed ? 'closed' : row.from > today ? 'later' : row.calendarTo < today ? 'due' : 'now',
    selected: row.month === key,
  }));
  if (addable) strip.push({ month: addable, state: 'add', selected: addable === key });
  const waiting = standing.unclosed.filter((row) => row.month !== key).map((row) => row.month);
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
            left: keys.filter((k) => rowOf(k) && !rowOf(k).closed),
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
    claim: phase === 'finished' ? claimContext(o, r, settled, standing, today) : null,
    nothingPaid: Boolean(record.nothingPaid),
    law: phase === 'finished' ? lawFromRecord(o, record, settled, r, record.payments) : null,
    balance: phase === 'finished' ? balanceOf(o, record, settled, r) : null,
    addable,
    job: settled.job,
    minimum: minimumNote(o, settled, r),
    strip,
    nudge: waiting.length && phase === 'underway' ? { months: waiting } : null,
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

const spanOfMonth = (key) => {
  const row = settleOffer(active()).rows.find((x) => x.month === key);
  return row ? spanOf(row) : monthSpan(key);
};

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
  /** A month of the strip: it opens below. */
  selectMonth(b) {
    ui.months[active().id] = b.dataset.key;
    ui.ask = null;
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
  /** The months not closed in turn, or one month alone: a closed one, to reopen it. */
  reviewStart(b) {
    const o = active();
    const rows = settleOffer(o).rows;
    const open = rows.filter((row) => !row.closed).map((row) => row.month);
    const key = b.dataset.key;
    // A month tapped opens alone; «Revisar los meses» goes through the ones not closed
    const keys = key ? [key] : open;
    ui.review = { offerId: o.id, keys, index: 0, closed: 0 };
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
  /** «Copiar» under one of the claim texts. The icon of the button shows a tick for a moment. */
  async copyClaimText(b) {
    const claim = claimOf();
    const text = claim?.[b.dataset.kind];
    if (!text) return;
    const msg = /** @type {HTMLElement} */ (b.closest('.textcard').querySelector('.copy-msg'));
    const copied = await copyText(text, msg, {
      ok: 'Texto copiado.',
      failMsg: 'No se pudo copiar. Aquí está para seleccionarlo:',
      rows: 12,
    });
    if (copied)
      setTimeout(() => {
        msg.textContent = '';
      }, 2000);
  },
  /** The copy button of one field of the papeleta. */
  async copyField(b) {
    const field = claimOf()?.fields.find((f) => f.id === b.dataset.field);
    if (!field?.value) return;
    const copied = await navigator.clipboard.writeText(field.value).then(
      () => true,
      () => false,
    );
    b.classList.toggle('copied', copied);
    setTimeout(() => b.classList.remove('copied'), 1500);
  },
  /** «Compartir»: the phone's share sheet, where there is one. */
  async shareClaimText(b) {
    const text = claimOf()?.[b.dataset.kind];
    if (!text) return;
    await navigator.share({ text }).catch(() => {}); // cancelling the sheet is not an error
  },
  /** «Hecho» on a step of the claim, dated today. */
  markStep(b) {
    offers.markStep(active(), b.dataset.step, { done: todayISO() });
    callbacks.paint();
  },
  unmarkStep(b) {
    offers.unmarkStep(active(), b.dataset.step);
    callbacks.paint();
  },
  /** «No se cobró nada»: said once, and taken back with «Quitar». */
  nothingPaid(b) {
    offers.setNothingPaid(active(), b.dataset.off === undefined);
    callbacks.paint();
  },
};

/** The names typed in the request, and the date to pay by: saved when the field is left. */
export function onClaimInput(e) {
  const el = /** @type {HTMLInputElement} */ (e.target);
  if (el.dataset.party) {
    const o = active();
    offers.setParties(o, { ...o.mine.parties, [el.dataset.party]: el.value });
    callbacks.paint();
  } else if (el.matches('[data-pay-by]')) {
    ui.payBy[active().id] = el.value || defaultPayBy(todayISO());
    callbacks.paint();
  }
}

/** The claim ladder and texts of the active offer as the screen has them, or null. */
function claimOf() {
  const o = active();
  return recordContext(o, calcOffer(o))?.claim ?? null;
}

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
  const phase = phaseOf(o, today, o.mine.record);
  if (phase === 'offerOnly' || !o.terms.start) return { phase: null, line: null };
  if (!recordPhase(o, today)) return { phase, line: null };
  const settled = settleOffer(o);
  const s = standingOf(
    settled,
    today,
    /** @type {'underway' | 'finished'} */ (phase),
    o.mine.record.payments,
    r.netFactor,
    o.mine.record.nothingPaid,
  );
  return {
    phase,
    line: {
      hasPayments: s.hasPayments,
      owed: s.falta,
      unclosed: s.unclosed.length,
    },
  };
}
