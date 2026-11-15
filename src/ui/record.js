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
import { fDate, num } from '../format.js';
import { conciliationOffice } from '../law.js';
import {
  addableMonth,
  balanceOf,
  jobStatus,
  minimumNote,
  monthAccounts,
  monthSpan,
  spanOf,
  standingOf,
} from '../model/accounts.js';
import { claimSteps, STEP_IDS } from '../model/claim.js';
import { lawFromRecord } from '../model/compliance.js';
import { dossierOf } from '../model/dossier.js';
import { hasFacts, jobStart, phaseOf } from '../model/phase.js';
import { lastWayOf } from '../model/record.js';
import { isoOf, missing, parseDate, todayISO } from '../offer.js';
import { offers } from '../offers.js';
import { active, calcContext, calcOffer, settleOffer } from '../state.js';
import { ACCOUNT_CONFIG } from '../storage/account-config.js';
import { claimText, legalLine } from '../text.js';
import { accountState } from './account-section.js';
import { copyText } from './dom.js';
import { closeDossier, closeLegal, closeReview, openDossier, openLegal, openReview } from './navigation.js';

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
 * @property {boolean} asksComplete the review came from «Cerrar el registro» and no month is left: «¿Están apuntados todos los cobros?» comes next
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
 * @property {ReturnType<typeof talkContext> | null} talk under way with something unpaid: the summary to talk to the ganadero
 * @property {boolean} nothingPaid «No se cobró nada» was said
 * @property {{ date: string } | null} complete the record closed with every month closed: the figures are firm
 * @property {boolean} asking «¿Están apuntados todos los cobros?» waits for its answer
 * @property {import('../model/settle.js').OfferRecord} record
 * @property {{ start: { date: string, other: boolean } | null, end: { how: string | null, early: boolean, seasonal: boolean, min: string, error: string, agreedDate: string } | null, recall: { year: string, no: boolean, error: string, min: string } | null } | null} cards the questions at the turns of the job: whether it began, and how it ended
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
  review:
    /** @type {{ offerId: string, keys: string[], index: number, closed: number, thenComplete: boolean } | null} */ (
      null
    ),
  /** The month open in the registro of a job finished, by offer: one at a time, its calendar right below its row. */
  opened: /** @type {Record<string, string | null>} */ ({}),
  /** «Cerrar el registro» asking whether every cobro is recorded, by offer. */
  completing: /** @type {Record<string, boolean>} */ ({}),
  fresh: /** @type {string | null} */ (null),
  /** «¿Empezó el trabajo?» asked for another date, by offer. */
  startOther: /** @type {Record<string, boolean>} */ ({}),
  /** «¿Cómo acabó?» opened by hand («Acabó antes»), by offer, the way picked before its date, and what is wrong with it. */
  end: /** @type {Record<string, { how: string | null, error?: string }>} */ ({}),
  /** «¿Se llamó para la campaña?» answered «No», asking the day it was known, by offer. */
  recall: /** @type {Record<string, { no: boolean, error?: string }>} */ ({}),
  /** «¿Cómo acabó?» put off for this session with «Sigue, se alargó», by offer. */
  endLater: /** @type {Record<string, boolean>} */ ({}),
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
 * The questions at the turns of a job. «¿Empezó?» only for a job under way with nothing recorded and no answer yet;
 * «¿Cómo acabó?» for a finished job with no answer, or when asked from «Acabó antes».
 * @param {any} o
 * @param {'underway' | 'finished'} phase
 * @param {ReturnType<typeof settleOffer>} settled
 * @param {string} today
 */
function cardsOf(o, phase, settled, today) {
  const record = o.mine.record;
  const asked = ui.end[o.id];
  const start =
    phase === 'underway' && !record.started && !hasFacts(record) && !asked
      ? { date: o.terms.start, other: Boolean(ui.startOther[o.id]) }
      : null;
  const seasonal = o.terms.contract === 'seasonal';
  // On sick leave the contract is suspended: how it ended is not asked until the leave is closed
  const onLeave = Boolean(record.sick && !record.sick.to);
  const open = asked || (phase === 'finished' && !record.end && !onLeave && !ui.endLater[o.id]);
  const end = open
    ? {
        how: asked?.how ?? null,
        early: Boolean(asked),
        seasonal,
        /** The first day an end or a leave can have: the job's start. */
        min: jobStart(o),
        error: asked?.error ?? '',
        /** What «Al final pactado» takes: the last day of the job, never after today. */
        agreedDate: [settled.job.to, today].find((d) => d && d <= today) ?? today,
      }
    : null;
  return start || end || recallOf(o, today) ? { start, end, recall: recallOf(o, today) } : null;
}

/** Under way with nothing recorded and no answer to «¿Empezó el trabajo?»: the job is not known to have started. */
const unconfirmedStart = (o, phase) => phase === 'underway' && !o.mine.record.started && !hasFacts(o.mine.record);

/** What the phase pill says: «Por empezar» until the start is confirmed, else the phase. */
export const pillPhase = (o, phase) => (unconfirmedStart(o, phase) ? 'toStart' : phase);

/** The first day of the season after the one worked, for a fijo discontinuo: its start a year on. */
export function nextSeasonStart(o) {
  const start = parseDate(o.terms.start);
  start.setFullYear(start.getFullYear() + 1);
  return isoOf(start);
}

/**
 * «¿Se llamó para la campaña de <año>?»: a fijo discontinuo that ended at the end of its campaign, from the day its next
 * season is expected to start (the start a year on), until answered.
 * @param {any} o
 * @param {string} today
 */
function recallOf(o, today) {
  const record = o.mine.record;
  if (o.terms.contract !== 'seasonal' || record.end?.how !== 'agreed' || !o.terms.start) return null;
  const from = nextSeasonStart(o);
  const year = from.slice(0, 4);
  if (today < from || record.recall?.[year]) return null;
  return { year, no: Boolean(ui.recall[o.id]?.no), error: ui.recall[o.id]?.error ?? '', min: record.end.date };
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
  const standing = standingOf(settled, today, phase, record.payments, r.netFactor, record.nothingPaid);
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
  const picked = ui.opened[o.id];
  const opened = picked && (rowOf(picked) || picked === addable) ? picked : null;
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
            asksComplete: ui.review.thenComplete && !keys.some((k) => rowOf(k) && !rowOf(k).closed),
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
    talk: phase === 'underway' ? talkContext(o, r, settled, standing, today) : null,
    nothingPaid: Boolean(record.nothingPaid),
    // Every month closed as well: a month reopened or added after it makes the figures estimates again
    complete: record.complete && !standing.unclosed.length ? record.complete : null,
    asking: Boolean(ui.completing[o.id]),
    record,
    cards: cardsOf(o, phase, settled, today),
    law: phase === 'finished' ? lawFromRecord(o, record, settled, r, record.payments) : null,
    balance: phase === 'finished' ? balanceOf(o, record, settled, r) : null,
    addable,
    job: settled.job,
    minimum: minimumNote(o, settled, r),
    strip,
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
    ui.review = { offerId: o.id, keys, index: 0, closed: 0, thenComplete: b.dataset.after === 'complete' };
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
  /** «Cerrar el registro»: the months not closed are reviewed first, then it asks whether every cobro is recorded. */
  closeRecord() {
    const o = active();
    if (settleOffer(o).rows.some((row) => !row.closed))
      return recordActions.reviewStart({ dataset: { after: 'complete' } });
    ui.completing[o.id] = true;
    callbacks.paint();
  },
  /** «Sí, cerrar»: every cobro is recorded. From the end of the review it also leaves the review. */
  completeYes() {
    const o = active();
    delete ui.completing[o.id];
    offers.completeRecord(o);
    if (ui.review) recordActions.reviewEnd();
    else callbacks.paint();
  },
  completeNo() {
    delete ui.completing[active().id];
    callbacks.paint();
  },
  reopenRecord() {
    offers.reopenRecord(active());
    callbacks.paint();
  },
  /** «¿Empezó el trabajo?»: yes, as the offer says. */
  confirmStart() {
    const o = active();
    offers.confirmStart(o, o.terms.start);
    callbacks.paint();
  },
  startOther() {
    ui.startOther[active().id] = true;
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
    o.terms.start = date;
    delete ui.startOther[o.id];
    offers.confirmStart(o, date);
    callbacks.paint();
  },
  /** It was not taken: the offer stays an offer. */
  notTaken() {
    const o = active();
    o.terms.offerOnly = true;
    offers.save();
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
  /** «No se cobró nada»: said once, and taken back with «Quitar». */
  nothingPaid(b) {
    offers.setNothingPaid(active(), b.dataset.off === undefined);
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

/**
 * What a card says of a job under way or finished: its phase and pill, and its status (`jobStatus`). Null phase for an
 * offer only offered.
 * @param {any} o
 * @returns {{ phase: 'undecided' | 'underway' | 'finished' | null, pill?: string, status: ReturnType<typeof jobStatus> }}
 */
export function cardRecord(o, r) {
  const today = todayISO();
  const phase = phaseOf(o, today, o.mine.record);
  if (phase === 'offerOnly' || !o.terms.start) return { phase: null, status: null };
  if (!recordPhase(o, today)) return { phase, status: null };
  const s = standingOf(
    settleOffer(o),
    today,
    /** @type {'underway' | 'finished'} */ (phase),
    o.mine.record.payments,
    r.netFactor,
    o.mine.record.nothingPaid,
  );
  return {
    phase,
    pill: pillPhase(o, /** @type {any} */ (phase)),
    // A job not yet confirmed as started has nothing to record
    status: unconfirmedStart(o, phase)
      ? null
      : jobStatus({
          phase: /** @type {'underway' | 'finished'} */ (phase),
          hasPayments: s.hasPayments,
          owed: s.falta,
          unclosed: s.unclosed.length,
          complete: Boolean(o.mine.record.complete) && s.unclosed.length === 0,
          claim: {
            by: s.deadlines
              .filter((d) => !d.lapsed)
              .reduce((a, d) => (!a || d.deadline < a ? d.deadline : a), /** @type {string | null} */ (null)),
            lapsed: s.lapsedAll,
          },
        }),
  };
}
