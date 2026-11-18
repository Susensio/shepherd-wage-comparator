/**
 * The record on the ficha (ADR-0032): what the screens of a job under way or finished show (`recordContext`) and what
 * their buttons do, through `offers`. Nothing here is saved but the record itself: the month on the calendar, the
 * review and the questions that ask twice are only what the page remembers while open.
 */

import {
  claimToCopy,
  conciliationFields,
  daysAfter,
  defaultPayBy,
  employerSummaryText,
  inspectionText,
  paymentRequestText,
} from '../claim-text.js';
import { $ } from '../dom.js';
import { fDate, fE, fInputValue, num } from '../format.js';
import { conciliationOffice } from '../law.js';
import { cents } from '../ledger.js';
import {
  addableMonth,
  balanceOf,
  minimumNote,
  moneyState,
  monthAccounts,
  spanOf,
  standingOf,
} from '../model/accounts.js';
import { claimSteps, STEP_IDS } from '../model/claim.js';
import { lawFromRecord } from '../model/compliance.js';
import { monthSpan } from '../model/days.js';
import { dossierOf } from '../model/dossier.js';
import {
  cardsOf,
  cobradoOf,
  isBare,
  lastDayOf,
  monthFlags,
  monthOnCalendar,
  monthStrip,
  nextSeasonStart,
  paymentsNewestFirst,
  recordPhase,
} from '../model/job-view.js';
import { phaseOf } from '../model/phase.js';
import { lastWayOf } from '../model/record.js';
import { missing, parseDate, payKnown, todayISO } from '../offer.js';
import { offers } from '../offers.js';
import { active, calcOffer, settleOffer } from '../state.js';
import { ACCOUNT_CONFIG } from '../storage/account-config.js';
import { claimText, legalLine } from '../text.js';
import { accountState } from './account-section.js';
import { copyText } from './dom.js';
import {
  closeDossier,
  closeLegal,
  closeRegistro,
  closeReview,
  openDossier,
  openLegal,
  openRegistro,
  openReview,
} from './navigation.js';

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
 * @property {boolean} tapped a day of the closed month was tapped: the inline offer to reopen it shows
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
 * @property {{ month: string, work: number, off: number, kept: boolean }[]} closeAll the months that have ended and are not closed, with their counts as the calendar shows them
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
 * @property {ReturnType<typeof talkContext> | null} talk under way with something unpaid: the summary to talk to the ganadero
 * @property {import('../model/settle.js').Paid | undefined} paid «Sí, todo» or «No se cobró nada» was said
 * @property {ReturnType<typeof cobradoOf>} cobrado what was cobrado, as every view reads it
 * @property {boolean} approx a cobro was told as approximate, so Cobrado and Falta are
 * @property {boolean} noContract the job has no contract: its figures say no «netos»
 * @property {boolean} noPay the job began with no pay told: what was cobrado has nothing agreed to be compared with
 * @property {boolean} bare a job finished with nothing recorded and no answer to «¿Se cobró este trabajo?»: its ficha leads with the analysis
 * @property {boolean} recording «No todo» was answered: the cobros are being recorded
 * @property {ReturnType<typeof moneyState>} money where the money of the job stands (a job finished; settled while under way)
 * @property {boolean} expectOpen «Sí, quedó en pagarlo» was tapped and the date is being asked
 * @property {{ date: string } | null} complete no more cobro is expected, said, and every month closed: the figures are firm
 * @property {import('../model/settle.js').OfferRecord} record
 * @property {{ start: { date: string, other: boolean } | null, end: { how: string | null, early: boolean, defaulted: boolean, seasonal: boolean, min: string, error: string, agreedDate: string } | null, recall: { year: string, no: boolean, error: string, min: string } | null, endDefault: { date: string } | null } | null} cards the questions at the turns of the job: whether it began, and how it ended
 * @property {CalendarContext | null} calendar under way: the month on the calendar; finished: the month open in the registro, if any
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
  /** The month open in the registro of a job finished, by offer: one at a time, its calendar right below its row. */
  opened: /** @type {Record<string, string | null>} */ ({}),
  fresh: /** @type {string | null} */ (null),
  /** «¿Empezó el trabajo?» asked for another date, by offer. */
  startOther: /** @type {Record<string, boolean>} */ ({}),
  /** «¿Cómo acabó?» opened by hand («Acabó antes»), by offer, the way picked before its date, and what is wrong with it. */
  end: /** @type {Record<string, { how: string | null, error?: string }>} */ ({}),
  /** «¿Se llamó para la campaña?» answered «No», asking the day it was known, by offer. */
  recall: /** @type {Record<string, { no: boolean, error?: string }>} */ ({}),
  /** «¿Cómo acabó?» put off for this session with «Sigue, se alargó», by offer. */
  endLater: /** @type {Record<string, boolean>} */ ({}),
  /** «No todo» answered to «¿Se cobró este trabajo?»: the accounts open to record the cobros, by offer. */
  recording: /** @type {Record<string, boolean>} */ ({}),
  /** «Sí, quedó en pagarlo» tapped, asking «¿Para cuándo?», by offer. */
  expecting: /** @type {Record<string, boolean>} */ ({}),
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

/**
 * The text «Copiar reclamación» copies for an offer, or null where the entry is hidden: decided by `claimToCopy` from
 * the phase (menu availability and the copy itself both read it).
 * @param {any} o
 */
export function claimCopyOf(o) {
  if (missing(o.terms).length) return null;
  const r = calcOffer(o);
  if (r.selfEmployed) return null; // no labour claim: the warning is about the kind of contract itself
  const phase = phaseOf(o, todayISO(), o.mine.record);
  const worked = phase === 'underway' || phase === 'finished' ? recordContext(o, r) : null;
  return claimToCopy({
    phase,
    dismissed: o.mine.record.end?.how === 'dismissed',
    offerClaim: legalLine(o, r) ? claimText(o, r) : '',
    summary: worked?.talk?.summary ?? '',
    request: worked?.claim?.request ?? '',
    fields: worked?.claim?.fields ?? [],
  });
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
    // Money agreed en negro, or no contract at all: the page says that it is salary too
    cash: Boolean(r.noContract) || (r.cash?.total ?? 0) >= 1,
    guest: !ACCOUNT_CONFIG.url || accountState.status() === 'guest',
    summary: owed ? employerSummaryText(base) : '',
    request: owed ? paymentRequestText(base) : '',
    inspection: owed ? inspectionText(base) : '',
    fields: owed || record.end?.how === 'dismissed' ? conciliationFields(base) : [],
  };
}

/**
 * Everything the «Expediente» holds for an offer, or null where it has no record.
 * @param {any} o
 * @param {any} r
 */
export function dossierContext(o, r) {
  const today = todayISO();
  const phase = recordPhase(o, today);
  if (!phase) return null;
  const record = o.mine.record;
  const settled = settleOffer(o);
  const standing = standingOf(settled, today, phase, record.payments, r.netFactor, record.paid);
  const marks = o.mine.claim?.steps ?? {};
  return {
    today,
    record,
    parties: o.mine.parties ?? { employerName: '' },
    ladder: claimSteps({ today, standing, end: record.end, marks }),
    deadlines: standing.deadlines,
    steps: STEP_IDS.filter((id) => marks[id]).map((id) => ({ id, ...marks[id] })),
    data: dossierOf({ o, netFactor: r.netFactor, settled, standing, record }),
  };
}

/** Opens the «Expediente» over the ficha. */
export function showDossier() {
  openDossier();
  callbacks.paint();
}

/**
 * «Hablar con el ganadero» for a job under way that already has something unpaid: the summary up to today.
 * @param {any} o
 * @param {any} r
 * @param {ReturnType<typeof settleOffer>} settled
 * @param {ReturnType<typeof standingOf>} standing
 * @param {string} today
 */
function talkContext(o, r, settled, standing, today) {
  if (!(standing.hasPayments && standing.falta > 0)) return null;
  const record = o.mine.record;
  const parties = o.mine.parties ?? { employerName: '' };
  const step = {
    id: /** @type {const} */ ('talk'),
    deadline: null,
    daysLeft: null,
    lapsed: false,
    ready: true,
    done: o.mine.claim?.steps?.talk ?? null,
  };
  return {
    step,
    canShare: typeof navigator.share === 'function',
    summary: employerSummaryText({ o, r, settled, standing, record, parties, until: today }),
  };
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
  const standing = standingOf(settled, today, phase, record.payments, r.netFactor, record.paid);
  const shown = settled.rows.filter((row) => row.from <= today);
  const addable = addableMonth(settled, today);
  const rowOf = (month) => settled.rows.find((row) => row.month === month);
  const calendarOf = (key, mode, index, count) => ({
    mode,
    today,
    acc: monthAccounts(o, record, key, today, settled, r),
    index,
    count,
    // A month not in the job (the one that can be added) has nothing to close, and says how it joins
    ...monthFlags(rowOf(key), today),
    asking: ui.ask?.type === 'reopen' && ui.ask.id === key,
    tapped: ui.ask?.type === 'closedDay' && ui.ask.id === key,
  });
  const key = monthOnCalendar(ui.months[o.id], settled.rows, today, phase, addable);
  const picked = ui.opened[o.id];
  const opened = picked && (rowOf(picked) || picked === addable) ? picked : null;
  const index = shown.findIndex((row) => row.month === key);
  const strip = monthStrip(settled.rows, today, key, addable);
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
    payments: paymentsNewestFirst(record.payments),
    fresh: ui.fresh,
    ask: ui.ask,
    claim: phase === 'finished' ? claimContext(o, r, settled, standing, today) : null,
    talk: phase === 'underway' ? talkContext(o, r, settled, standing, today) : null,
    paid: record.paid,
    cobrado: cobradoOf(o, r, phase, standing),
    noContract: Boolean(r.noContract),
    noPay: !payKnown(o.terms),
    approx: !record.paid && record.payments.some((p) => p.approx),
    bare: isBare(o, phase, ui.recording[o.id]),
    recording: Boolean(ui.recording[o.id]),
    // Every month closed as well: a month reopened or added after it makes the figures estimates again
    complete: record.complete && !standing.unclosed.length ? record.complete : null,
    money: phase === 'finished' ? moneyState({ falta: standing.falta, record, today }) : 'settled',
    expectOpen: Boolean(ui.expecting[o.id]),
    record,
    cards: cardsOf(o, phase, settled, today, {
      asked: ui.end[o.id],
      startOther: ui.startOther[o.id],
      endLater: ui.endLater[o.id],
      recording: ui.recording[o.id],
      recall: ui.recall[o.id],
    }),
    law: phase === 'finished' ? lawFromRecord(o, record, settled, r, record.payments) : null,
    balance: phase === 'finished' ? balanceOf(o, record, settled, r) : null,
    addable,
    job: settled.job,
    minimum: minimumNote(o, settled, r),
    strip,
    // The months that have ended and are not closed, with their days as the calendar shows them: what «Cerrar los meses» closes
    closeAll: standing.unclosed.map((row) => {
      const counts = monthAccounts(o, record, row.month, today, settled, r)?.counts;
      return {
        month: row.month,
        work: counts?.work ?? 0,
        off: counts?.off ?? 0,
        kept: Boolean(record.months?.[row.month]),
      };
    }),
    nudge: waiting.length && phase === 'underway' ? { months: waiting } : null,
    // A job finished shows a calendar only for the month opened in its registro
    calendar:
      phase === 'underway'
        ? calendarOf(key, 'ficha', index, shown.length)
        : opened
          ? calendarOf(
              opened,
              'ficha',
              shown.findIndex((row) => row.month === opened),
              shown.length,
            )
          : null,
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
    approx: /** @type {HTMLInputElement} */ ($('#payApprox')),
    error: $('#payError'),
    done: $('#payDone'),
    cancel: $('#payCancel'),
    title: $('#payTitle'),
    more: $('#payMore'),
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

/** The cobro the sheet is changing, or null while it makes a new one. */
let editing = null;

/** @param {import('../model/settle.js').Payment | null} [payment] a cobro to change; without one, a new cobro */
function openPaySheet(payment = null) {
  const sheet = sheetElements();
  const today = todayISO();
  editing = payment;
  sheet.form.reset();
  const o = active();
  // A new cobro of a finished job is dated on the job's last day, never after today
  const lastDay = phaseOf(o, today, o.mine.record) === 'finished' ? lastDayOf(settleOffer(o), today) : today;
  sheet.date.value = payment?.date ?? lastDay;
  sheet.date.max = today;
  sheet.amount.value = payment ? fInputValue(payment.amount, 0, 2) : '';
  sheet.note.value = payment?.note ?? '';
  sheet.approx.checked = Boolean(payment?.approx);
  /** @type {HTMLDetailsElement} */ ($('#payExtra')).open = Boolean(payment?.note || payment?.approx);
  setWay(payment?.via ?? lastWayOf(active().mine.record));
  sheet.title.textContent = payment ? 'Editar el cobro' : 'Cobro';
  sheet.more.hidden = Boolean(payment);
  sheet.error.textContent = '';
  sheet.done.textContent = '';
  sheet.cancel.textContent = 'Cancelar';
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
  const fields = {
    date: sheet.date.value,
    amount,
    via: wayChosen(),
    note: sheet.note.value,
    approx: sheet.approx.checked,
  };
  const payment = editing ? offers.updatePayment(active(), editing.id, fields) : offers.addPayment(active(), fields);
  // «Guardar y apuntar otro»: the sheet stays, with the date and the way of the last one
  if (!editing && event.submitter === sheet.more) {
    sheet.amount.value = '';
    sheet.note.value = '';
    sheet.approx.checked = false;
    sheet.done.textContent = `Apuntado: ${fE(amount, 2)}. Se puede apuntar otro.`;
    sheet.cancel.textContent = 'Hecho';
    sheet.amount.focus();
  } else sheet.dialog.close();
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
  if (ui.opened[active().id]) ui.opened[active().id] = key;
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
  /** A month of the registro of a job finished: its calendar opens in place, and a second tap folds it. */
  toggleMonth(b) {
    const id = active().id;
    ui.opened[id] = ui.opened[id] === b.dataset.key ? null : b.dataset.key;
    ui.ask = null;
    callbacks.paint();
  },
  /** A month of the strip: it opens below. */
  selectMonth(b) {
    ui.months[active().id] = b.dataset.key;
    ui.ask = null;
    callbacks.paint();
  },
  /** A day of a closed month was tapped: the calendar says it is closed and offers to reopen it. */
  closedDay(b) {
    stayOn(b.dataset.key);
    ui.ask = { type: 'closedDay', id: b.dataset.key };
    callbacks.paint();
  },
  /** «Cerrar los meses»: every month that has ended is closed as the calendar shows it (the summary of their days is right above the button). */
  closeAllMonths() {
    const o = active();
    for (const row of standingOf(
      settleOffer(o),
      todayISO(),
      recordPhase(o, todayISO()) ?? 'finished',
      o.mine.record.payments,
      calcOffer(o).netFactor,
      o.mine.record.paid,
    ).unclosed)
      offers.closeMonth(o, spanOfMonth(row.month));
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
  openPaySheet: () => openPaySheet(),
  editPayment: (b) => openPaySheet(active().mine.record.payments.find((p) => p.id === b.dataset.id)),
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
  /** «Sí, quedó en pagarlo»: asks for the date. */
  expectYes() {
    ui.expecting[active().id] = true;
    callbacks.paint();
  },
  /** «Sin fecha»: a cobro is expected, with no date promised. */
  expectNoDate() {
    delete ui.expecting[active().id];
    offers.expectPayment(active());
    callbacks.paint();
  },
  /** «No»: no more cobro is expected. */
  expectNo() {
    delete ui.expecting[active().id];
    offers.completeRecord(active());
    callbacks.paint();
  },
  /** «Cambiar»: the question again. */
  expectChange() {
    delete ui.expecting[active().id];
    offers.clearExpectation(active());
    callbacks.paint();
  },
  startOtherCancel() {
    delete ui.startOther[active().id];
    callbacks.paint();
  },
  /** Another start date: the offer's own date moves, since it is a fact of the job, and the answer is kept. */
  saveStart() {
    const o = active();
    const date = /** @type {HTMLInputElement} */ ($('#startOther')).value;
    if (!date) return;
    offers.patchTerms(o, { start: date });
    delete ui.startOther[o.id];
    offers.confirmStart(o, date);
    callbacks.paint();
  },
  /** «¿Cómo acabó?»: a way, then its date; «Al final pactado» needs none. */
  pickEnd(b) {
    const o = active();
    if (b.dataset.how === 'agreed') {
      const end = recordContext(o, calcOffer(o))?.cards?.end;
      offers.setEnd(o, { how: 'agreed', date: end?.agreedDate ?? todayISO() });
      delete ui.end[o.id];
    } else ui.end[o.id] = { how: b.dataset.how };
    callbacks.paint();
  },
  saveEnd(b) {
    const o = active();
    const date = /** @type {HTMLInputElement} */ ($('#endDate')).value;
    const error = dateProblem(date, o.terms.start);
    if (error) {
      ui.end[o.id] = { how: b.dataset.how, error };
      return callbacks.paint();
    }
    offers.setEnd(o, { how: b.dataset.how, date });
    delete ui.end[o.id];
    callbacks.paint();
  },
  /** Sick leave: the job goes on, its days are marked `sick`. */
  saveSick() {
    const o = active();
    const date = /** @type {HTMLInputElement} */ ($('#endDate')).value;
    const error = dateProblem(date, o.terms.start);
    if (error) {
      ui.end[o.id] = { how: 'sick', error };
      return callbacks.paint();
    }
    offers.startSick(o, date);
    delete ui.end[o.id];
    callbacks.paint();
  },
  /** «Registro»: the page of the days and the cobros, over the ficha; a month named opens first. */
  openRegistro(b) {
    const id = active().id;
    if (b.dataset.key) {
      ui.months[id] = b.dataset.key;
      if (recordPhase(active(), todayISO()) === 'finished') ui.opened[id] = b.dataset.key;
    }
    openRegistro();
    callbacks.paint();
  },
  closeRegistro() {
    closeRegistro();
    callbacks.paint();
  },
  /** «Vía legal»: the page of its own, over Cuentas; Back returns. */
  openLegal() {
    openLegal();
    callbacks.paint();
  },
  closeLegal() {
    closeLegal();
    callbacks.paint();
  },
  /** «Volver al trabajo»: yesterday was the last day of the leave. */
  sickBack() {
    offers.endSick(active(), daysAfter(todayISO(), -1));
    callbacks.paint();
  },
  endCancel() {
    delete ui.end[active().id];
    ui.endLater[active().id] = true;
    callbacks.paint();
  },
  recallYes() {
    const o = active();
    offers.answerRecall(o, nextSeasonStart(o).slice(0, 4), 'yes');
    callbacks.paint();
  },
  recallNo() {
    ui.recall[active().id] = { no: true };
    callbacks.paint();
  },
  recallNoCancel() {
    delete ui.recall[active().id];
    callbacks.paint();
  },
  /** Not called back: a dismissal, counted from the day it was known. */
  recallNoSave() {
    const o = active();
    const date = /** @type {HTMLInputElement} */ ($('#recallDate')).value;
    const error = dateProblem(date, o.mine.record.end?.date ?? o.terms.start);
    if (error) {
      ui.recall[o.id] = { no: true, error };
      return callbacks.paint();
    }
    offers.answerRecall(o, nextSeasonStart(o).slice(0, 4), 'no');
    offers.setEnd(o, { how: 'dismissed', date });
    delete ui.recall[o.id];
    callbacks.paint();
  },
  /** «Sigue, se alargó»: the days after the end are marked in the calendar, starting with the next month. */
  endLonger() {
    const o = active();
    ui.endLater[o.id] = true;
    const key = recordContext(o, calcOffer(o))?.addable;
    if (key) recordActions.reviewStart({ dataset: { key } });
    else callbacks.paint();
  },
  /** «Acabó antes», in the menu, or «Cambiar» on the line of the end. */
  endedEarly() {
    ui.end[active().id] = { how: null };
    callbacks.paint();
  },
  openDossier: showDossier,
  closeDossier() {
    closeDossier();
    callbacks.paint();
  },
  printDossier: () => window.print(),
  /** «Añadir apunte»: a dated note, today's date. */
  addNote() {
    const field = /** @type {HTMLInputElement} */ ($('#noteText'));
    if (offers.addEvidence(active(), { date: todayISO(), text: field.value })) callbacks.paint();
  },
  removeNote(b) {
    offers.removeEvidence(active(), Number(b.dataset.index));
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
  /** «Sí, todo»: what was agreed was received. */
  paidAll() {
    ui.ask = null;
    offers.setPaid(active(), 'asAgreed');
    callbacks.paint();
  },
  /** «Otra cantidad»: the accounts open and the cobro to record, right there. */
  paidSome() {
    ui.recording[active().id] = true;
    ui.ask = null;
    callbacks.paint();
    openPaySheet();
  },
  /**
   * «También se cobró»: «Lo pactado» was not all. It becomes cobros, one on the last day for everything that corresponds
   * (the cash agreed apart, as it was), so nothing is missing.
   */
  alsoPaid() {
    const o = active();
    const settled = settleOffer(o);
    const standing = standingOf(settled, todayISO(), 'finished', [], calcOffer(o).netFactor, 'asAgreed');
    const date = lastDayOf(settled, todayISO());
    const cash = standing.lines.find((x) => x.key === 'cash')?.due ?? 0;
    if (cash > 0) offers.addPayment(o, { date, amount: cash, via: 'cash' });
    offers.addPayment(o, { date, amount: cents(standing.corresponde - cash), via: 'payroll' });
    callbacks.paint();
  },
  /** «No se cobró nada» of a job finished asks first: it makes everything that corresponds a debt. */
  paidNoneAsk() {
    ui.ask = { type: 'paidNone' };
    callbacks.paint();
  },
  paidNone() {
    ui.ask = null;
    offers.setPaid(active(), 'none');
    callbacks.paint();
  },
  paidNoneCancel() {
    ui.ask = null;
    callbacks.paint();
  },
  /** «Quitar» under «Sí, todo» or «No se cobró nada»: the question again. */
  paidClear() {
    delete ui.recording[active().id];
    offers.setPaid(active(), undefined);
    callbacks.paint();
  },
};

/** What is wrong with a date typed for an end or a leave: empty, before the job started or after today; else ''. */
function dateProblem(date, min) {
  const today = todayISO();
  if (date && date >= min && date <= today) return '';
  const fIso = (iso) => fDate(parseDate(iso));
  return date ? `El día tiene que estar entre el ${fIso(min)} y hoy.` : `Escribe el día, entre el ${fIso(min)} y hoy.`;
}

/** The names typed in the request, and the date to pay by: saved when the field is left. */
export function onClaimInput(e) {
  const el = /** @type {HTMLInputElement} */ (e.target);
  if (el.dataset.party) {
    const o = active();
    offers.setParties(o, { ...o.mine.parties, [el.dataset.party]: el.value });
    callbacks.paint();
  } else if (el.matches('[data-promise]')) {
    offers.setPromise(active(), el.value);
    callbacks.paint();
  } else if (el.matches('[data-expect-by]')) {
    if (!el.value) return;
    delete ui.expecting[active().id];
    offers.expectPayment(active(), el.value);
    callbacks.paint();
  } else if (el.matches('[data-pay-by]')) {
    ui.payBy[active().id] = el.value || defaultPayBy(todayISO());
    callbacks.paint();
  }
}

/** The claim ladder and texts of the active offer as the screen has them, or null. */
function claimOf() {
  const o = active();
  const c = recordContext(o, calcOffer(o));
  return c?.claim ?? c?.talk ?? null;
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

/** «Acabó antes» from the menu of an offer: asks how it ended on its ficha. */
export function askHowItEnded(offerId) {
  ui.end[offerId] = { how: null };
}

/** «Empezó otro día» from the menu of an offer: asks the date on its ficha. */
export function askStartDate(offerId) {
  ui.startOther[offerId] = true;
}

/** «No se cogió: solo oferta» from the menu: the job stays an offer. */
export function markNotTaken(o) {
  offers.patchTerms(o, { offerOnly: true });
  offers.save();
}
