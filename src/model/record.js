/**
 * The record, edited (ADR-0032): the marks of a month's days as the calendar shows them, and the transitions that
 * change an offer's `mine.record`. Transitions mutate the record they are given and return whether it changed; saving
 * is the caller's. No DOM.
 */

import { endOf, isoOf, newId, parseDate } from '../offer.js';
import { schedule } from './time.js';

/** @typedef {import('./settle.js').OfferRecord} OfferRecord */
/** @typedef {import('./settle.js').DayKind} DayKind */
/** @typedef {{ day: string, date: string, kind: DayKind, recorded: boolean, outside: boolean }} Mark `day` is «05»; `outside`: not a day of the job (after its end or before its start) */
/** @typedef {{ key: string, from: string, to: string }} Span the days of a month «2026-06» that belong to the offer, ISO dates */

const pad = (n) => String(n).padStart(2, '0');

/** The days of a span, as `[day, ISO date]`. */
function daysOf({ key, from, to }) {
  const [y, m] = key.split('-').map(Number);
  const out = [];
  for (let d = parseDate(from); d <= parseDate(to); d.setDate(d.getDate() + 1))
    if (d.getFullYear() === y && d.getMonth() === m - 1) out.push([pad(d.getDate()), isoOf(d)]);
  return out;
}

/**
 * What a day is before anything is recorded: the offer's days off spread evenly over the span. A default of the
 * calendar, not a rule of the model: it decides nothing until the shepherd touches the month.
 * @returns {DayKind[]}
 */
function defaultKinds(terms, count) {
  const off = 1 - schedule(terms).workFrac;
  const before = (i) => Math.floor(i * off + 0.5);
  return Array.from({ length: count }, (_, i) => (before(i + 1) > before(i) ? 'off' : 'work'));
}

/** The last day marked as worked anywhere in the record, as an ISO date, or '' (months without a worked day count for nothing). */
export function lastWorkedDay(record) {
  let last = '';
  for (const [key, month] of Object.entries(record?.months ?? {}))
    for (const [day, kind] of Object.entries(month?.days ?? {})) {
      const iso = `${key}-${day}`;
      if (kind === 'work' && iso > last) last = iso;
    }
  return last;
}

/** Whether `date` falls in the sick leave of the record. */
const onLeave = (record, date) =>
  Boolean(record?.sick && date >= record.sick.from && (!record.sick.to || date <= record.sick.to));

/**
 * The days of a month as shown: the recorded kind, else the offer's default; days after the offer's end default to libre.
 * @param {{ terms: object }} offer
 * @param {OfferRecord | undefined} record
 * @param {Span} span
 * @param {{ from: string, to: string }} [job] the days of the job in the month: the others are `outside`
 * @returns {Mark[]}
 */
export function marksOf(offer, record, span, job) {
  const days = daysOf(span);
  const end = endOf(offer.terms);
  const endIso = end ? isoOf(end) : '9999-12-31';
  const kinds = defaultKinds(offer.terms, days.filter(([, date]) => date <= endIso).length);
  const recorded = record?.months?.[span.key]?.days ?? {};
  return days.map(([day, date], i) => ({
    day,
    date,
    kind: recorded[day] ?? (onLeave(record, date) ? 'sick' : date <= endIso ? kinds[i] : 'off'),
    recorded: day in recorded,
    outside: job ? date < job.from || date > job.to : false,
  }));
}

/** @param {{ kind: DayKind }[]} marks */
export const countsOf = (marks) => ({
  work: marks.filter((m) => m.kind === 'work').length,
  off: marks.filter((m) => m.kind === 'off').length,
  sick: marks.filter((m) => m.kind === 'sick').length,
});

/** The month's days as the offer has them, whatever the record says. */
export const defaultMarks = (offer, span) => marksOf(offer, undefined, span);

const monthOf = (record, key) => {
  record.months ??= {};
  record.months[key] ??= { closed: false, days: {} };
  return record.months[key];
};

/** Writes every day of the span as shown: from here on they are facts. */
function freeze(offer, record, span) {
  const month = monthOf(record, span.key);
  month.days = Object.fromEntries(marksOf(offer, record, span).map((m) => [m.day, m.kind]));
  return month;
}

/** A month whose days are the offer's own and which is not closed holds nothing: it follows the offer again. */
function dropIfAsOffer(offer, record, span) {
  const month = record.months?.[span.key];
  if (!month || month.closed) return;
  const asOffer = defaultMarks(offer, span);
  if (marksOf(offer, record, span).every((m, i) => m.kind === asOffer[i].kind)) delete record.months[span.key];
}

/**
 * A tap on a day: jornada becomes libre and anything else becomes jornada. The first tap in a month records every day
 * as shown, so what is on the screen is what the record holds. A closed month does not change.
 * @param {{ terms: object }} offer
 * @param {OfferRecord} record
 * @param {Span} span
 * @param {string} day «05»
 */
export function toggleDay(offer, record, span, day) {
  if (record.months?.[span.key]?.closed) return false;
  const shown = marksOf(offer, record, span).find((m) => m.day === day);
  if (!shown) return false;
  const month = freeze(offer, record, span);
  month.days[day] = shown.kind === 'work' ? 'off' : 'work';
  dropIfAsOffer(offer, record, span);
  return true;
}

/** Closes a month with every day as shown; `today` (ISO) is when, for the dossier. Returns false if it already was. */
export function closeMonth(offer, record, span, today) {
  if (record.months?.[span.key]?.closed) return false;
  const month = freeze(offer, record, span);
  month.closed = true;
  if (today) month.closedAt = today;
  return true;
}

/** Opens a closed month again, keeping its days. Returns false if it was not closed. */
export function reopenMonth(record, key) {
  const month = record.months?.[key];
  if (!month?.closed) return false;
  month.closed = false;
  delete month.closedAt;
  return true;
}

/**
 * Adds a payment: the amount is net, what arrived. The way is remembered by `lastWayOf`.
 * @param {OfferRecord} record
 * @param {{ date: string, amount: number, via: 'payroll' | 'cash', note?: string }} payment
 * @returns {import('./settle.js').Payment | null} null when the amount is not a positive figure
 */
export function addPayment(record, { date, amount, via, note = '' }) {
  if (!(Number.isFinite(amount) && amount > 0) || !date) return null;
  const payment = { id: newId(), date, amount, via, ...(note.trim() ? { note: note.trim() } : {}) };
  record.payments ??= [];
  record.payments.push(payment);
  delete record.nothingPaid; // a cobro says what «No se cobró nada» said
  return payment;
}

/** Removes a payment by id. Returns whether there was one. */
export function removePayment(record, id) {
  const at = record.payments?.findIndex((p) => p.id === id) ?? -1;
  if (at < 0) return false;
  record.payments.splice(at, 1);
  return true;
}

/** The way the last payment entered was paid, or payroll before any. */
export const lastWayOf = (record) => record?.payments?.at(-1)?.via ?? 'payroll';

/** The shepherd confirmed the job began on `date` (the offer's, or another). */
export function confirmStart(record, date) {
  if (!date) return false;
  record.started = { date };
  return true;
}

/**
 * Says how and when the job ended (ADR-0034). `settle` ends the job on that date: the days after it are outside the
 * job, whether or not their months are closed.
 * @param {OfferRecord} record
 * @param {import('./settle.js').JobEnd} end `date` is an ISO date
 */
export function setEnd(record, { how, date }) {
  if (!date) return false;
  record.end = { how, date };
  return true;
}

/** Takes the end away: the job ends as its dates say again. */
export function clearEnd(record) {
  if (!record.end) return false;
  delete record.end;
  return true;
}

/** «No se cobró nada»: nothing was received, said once so Falta can be worked out. Not a payment. */
export function setNothingPaid(record, on) {
  if (on === Boolean(record.nothingPaid)) return false;
  if (on) record.nothingPaid = true;
  else delete record.nothingPaid;
  return true;
}

/** A dated note for the dossier. Returns false for an empty text. */
export function addEvidence(record, { date, text }) {
  if (!text.trim() || !date) return false;
  record.evidence ??= [];
  record.evidence.push({ date, text: text.trim() });
  return true;
}

/** Removes the note at `index`. */
export function removeEvidence(record, index) {
  if (!record.evidence?.[index]) return false;
  record.evidence.splice(index, 1);
  return true;
}

/** Sets the parties' names. An empty tax id or pastor's name leaves the field out. */
export function setParties(offer, { employerName, employerId = '', workerName = '' }) {
  offer.mine.parties = {
    employerName: employerName.trim(),
    ...(employerId.trim() ? { employerId: employerId.trim() } : {}),
    ...(workerName.trim() ? { workerName: workerName.trim() } : {}),
  };
  return true;
}

/** Marks a claim step «Hecho» on `done` (ISO date), with an optional note; it replaces an earlier mark. */
export function markStep(offer, id, { done, note = '' }) {
  const steps = { ...(offer.mine.claim?.steps ?? {}) };
  steps[id] = { done, ...(note.trim() ? { note: note.trim() } : {}) };
  offer.mine.claim = { steps };
  return true;
}

/** Takes a «Hecho» mark away. */
export function unmarkStep(offer, id) {
  if (!offer.mine.claim?.steps?.[id]) return false;
  const { [id]: _gone, ...steps } = offer.mine.claim.steps;
  offer.mine.claim = { steps };
  return true;
}

/**
 * Sick leave from `from` (ISO): the contract is suspended, the job does not end. The days up to `today` in months not
 * closed are recorded as `sick`; the days after it are `sick` by default until the leave is closed.
 * @param {OfferRecord} record
 * @param {string} from
 * @param {string} today
 */
export function startSick(record, from, today) {
  if (!from) return false;
  record.sick = { from };
  for (const d = parseDate(from); isoOf(d) <= today; d.setDate(d.getDate() + 1)) {
    const iso = isoOf(d);
    if (record.months?.[iso.slice(0, 7)]?.closed) continue;
    monthOf(record, iso.slice(0, 7)).days[iso.slice(8)] = 'sick';
  }
  return true;
}

/** Back to work: the last day of the leave is `to` (ISO). */
export function endSick(record, to) {
  if (!record.sick) return false;
  record.sick = { from: record.sick.from, to };
  return true;
}

/** «¿Se llamó para la campaña de <año>?» of a fijo discontinuo: `answer` is `yes` or `no`. */
export function answerRecall(record, year, answer) {
  record.recall = { ...(record.recall ?? {}), [year]: answer };
  return true;
}
