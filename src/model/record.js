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
    kind: recorded[day] ?? (date <= endIso ? kinds[i] : 'off'),
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

/** Closes a month with every day as shown. Returns false if it already was. */
export function closeMonth(offer, record, span) {
  if (record.months?.[span.key]?.closed) return false;
  freeze(offer, record, span).closed = true;
  return true;
}

/** Opens a closed month again, keeping its days. Returns false if it was not closed. */
export function reopenMonth(record, key) {
  const month = record.months?.[key];
  if (!month?.closed) return false;
  month.closed = false;
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
