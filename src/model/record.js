/**
 * The record, edited (ADR-0032): the marks of a month's days as the calendar shows them, and the transitions that
 * change an offer's `mine.record`. Transitions mutate the record they are given and return whether it changed; saving
 * is the caller's. No DOM.
 */

import { holidaysOf } from '../law.js';
import { endOf, isoOf, newId, parseDate } from '../offer.js';
import { monthFacts, spreadTotal } from './days.js';
import { schedule } from './time.js';

/** @typedef {import('./settle.js').OfferRecord} OfferRecord */
/** @typedef {import('./settle.js').DayKind} DayKind */
/** @typedef {{ day: string, date: string, kind: DayKind, recorded: boolean, counted: boolean, outside: boolean, holiday: string }} Mark `day` is «05»; `counted`: the month is kept as counts, so which day is which is laid out (work, then sick, then off) and says nothing of the real days; `outside`: not a day of the job (after its end or before its start); `holiday`: the name of the public holiday of the offer's place that falls on it, or '' (nothing where the place has no verified data) */
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
 * calendar, not a rule of the model: it decides nothing until the shepherd touches the month. An offer that takes the
 * holidays off (`terms.holidays`) has the holidays of its place libre, and the days off are spread over the other days.
 * Vacation taken (`terms.vacation`) is libre too: the last days of the offer, from `vacationFrom` on.
 * @param {object} terms
 * @param {string[]} dates ISO, the days of the job in the span
 * @param {Map<string, string>} holidays name by ISO date, of the offer's place
 * @param {string} vacationFrom ISO date, or a date past every day
 * @returns {DayKind[]}
 */
function defaultKinds(terms, dates, holidays, vacationFrom) {
  const off = 1 - schedule(terms).workFrac;
  const before = (i) => Math.floor(i * off + 0.5);
  const holidaysOff = terms.holidays === 'yes';
  let spread = 0;
  return dates.map((date) => {
    if (holidaysOff && holidays.has(date)) return 'off';
    if (date >= vacationFrom) return 'off';
    const i = spread++;
    return before(i + 1) > before(i) ? 'off' : 'work';
  });
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
  // an end said after the offer's extends the job: those days are worked unless marked otherwise
  const statedEnd = record?.end?.date ?? '';
  const { municipality, province } = offer.terms;
  const holidays = new Map(
    holidaysOf({ municipality, province, year: Number(span.key.slice(0, 4)) }).days.map((d) => [d.date, d.name]),
  );
  const vacationDays = end && offer.terms.vacation === 'taken' ? schedule(offer.terms).vacationTaken : 0;
  const kinds = defaultKinds(
    offer.terms,
    days.map(([, date]) => date).filter((date) => date <= endIso),
    holidays,
    vacationDays > 0
      ? isoOf(new Date(end.getFullYear(), end.getMonth(), end.getDate() - vacationDays + 1))
      : '9999-12-31',
  );
  const entry = record?.months?.[span.key];
  const recorded = entry?.days ?? {};
  const outside = (date) => (job ? date < job.from || date > job.to : false);
  // A month kept as counts has no days of its own: the counts are laid over the days of the job, work first
  const layout = entry?.count
    ? monthFacts(
        entry,
        parseDate(job && job.from > span.from ? job.from : span.from),
        parseDate(job && job.to < span.to ? job.to : span.to),
      ).counts
    : null;
  const laid = layout ? [...Array(layout.work).fill('work'), ...Array(layout.sick).fill('sick')] : [];
  return days.map(([day, date], i) => {
    const kind = layout
      ? outside(date)
        ? 'off'
        : (laid.shift() ?? 'off')
      : (recorded[day] ??
        (onLeave(record, date) ? 'sick' : date <= endIso ? kinds[i] : date <= statedEnd ? 'work' : 'off'));
    return {
      day,
      date,
      kind,
      recorded: Boolean(layout) || day in recorded,
      counted: Boolean(layout),
      outside: outside(date),
      holiday: holidays.get(date) ?? '',
    };
  });
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
  if (record.months?.[span.key]?.closed || record.months?.[span.key]?.count) return false; // counts have no days to tap
  const shown = marksOf(offer, record, span).find((m) => m.day === day);
  if (!shown) return false;
  const month = freeze(offer, record, span);
  month.days[day] = shown.kind === 'work' ? 'off' : 'work';
  dropIfAsOffer(offer, record, span);
  return true;
}

const KIND_COUNTS = ['work', 'off', 'sick'];

/**
 * The days of a month as counts, instead of one mark each: «22 days worked, 8 off». It replaces the month's marks; a
 * closed month does not change. Counts are whole numbers from 0 to 31.
 * @param {OfferRecord} record
 * @param {string} key «2026-06»
 * @param {{ work: number, off?: number, sick?: number }} counts
 */
export function setMonthCounts(record, key, { work, off = 0, sick = 0 }) {
  const count = { work, off, sick };
  if (KIND_COUNTS.some((kind) => !(Number.isInteger(count[kind]) && count[kind] >= 0 && count[kind] <= 31)))
    return false;
  if (record.months?.[key]?.closed) return false;
  record.months ??= {};
  const { days: _marks, ...month } = record.months[key] ?? {};
  record.months[key] = { ...month, closed: false, count };
  return true;
}

/**
 * A total of days worked for the whole job, entered once: it is spread over the months of the job as counts
 * (`spreadTotal`), the rest of each month being days off. Months already closed stay as they are.
 * @param {OfferRecord} record
 * @param {{ key: string, days: number }[]} months the days of the job in each month
 * @param {number} total
 */
export function enterTotalDays(record, months, total) {
  if (!(Number.isInteger(total) && total >= 0)) return false;
  const worked = spreadTotal(total, months);
  let changed = false;
  for (const { key, days } of months) {
    if (record.months?.[key]?.closed) continue;
    changed = setMonthCounts(record, key, { work: worked[key], off: days - worked[key] }) || changed;
  }
  return changed;
}

/** Closes a month with every day as shown; `today` (ISO) is when, for the dossier. Returns false if it already was. */
export function closeMonth(offer, record, span, today) {
  if (record.months?.[span.key]?.closed) return false;
  const month = record.months?.[span.key]?.count ? record.months[span.key] : freeze(offer, record, span);
  month.closed = true;
  if (today) month.closedAt = today;
  return true;
}

/** Opens a closed month again, keeping its days; the record is no longer complete. Returns false if it was not closed. */
export function reopenMonth(record, key) {
  const month = record.months?.[key];
  if (!month?.closed) return false;
  month.closed = false;
  delete month.closedAt;
  delete record.complete;
  return true;
}

/** «Cerrar el registro»: every cobro is recorded, said on `today` (ISO). Returns false if it already was. */
export function completeRecord(record, today) {
  if (record.complete || !today) return false;
  record.complete = { date: today };
  return true;
}

/** «Reabrir el registro»: more cobros may come. Returns false if it was not complete. */
export function reopenRecord(record) {
  if (!record.complete) return false;
  delete record.complete;
  return true;
}

/**
 * Adds a payment: the amount is net, what arrived. The way is remembered by `lastWayOf`. `approx`: a lump remembered, not
 * an exact figure.
 * @param {OfferRecord} record
 * @param {{ date: string, amount: number, via: 'payroll' | 'cash', note?: string, approx?: boolean }} payment
 * @returns {import('./settle.js').Payment | null} null when the amount is not a positive figure
 */
export function addPayment(record, { date, amount, via, note = '', approx = false }) {
  if (!(Number.isFinite(amount) && amount > 0) || !date) return null;
  const payment = {
    id: newId(),
    date,
    amount,
    via,
    ...(note.trim() ? { note: note.trim() } : {}),
    ...(approx ? { approx: true } : {}),
  };
  record.payments ??= [];
  record.payments.push(payment);
  delete record.paid; // a cobro is more specific than «Sí, todo» or «No se cobró nada»
  return payment;
}

/**
 * Changes a payment in place, keeping its id: the fields as `addPayment` takes them.
 * @param {OfferRecord} record
 * @param {string} id
 * @param {{ date: string, amount: number, via: 'payroll' | 'cash', note?: string, approx?: boolean }} fields
 * @returns {import('./settle.js').Payment | null} null when there is no such payment or the amount is not a positive figure
 */
export function updatePayment(record, id, { date, amount, via, note = '', approx = false }) {
  const payment = record.payments?.find((p) => p.id === id);
  if (!payment || !(Number.isFinite(amount) && amount > 0) || !date) return null;
  for (const key of ['note', 'approx']) delete payment[key];
  Object.assign(payment, {
    date,
    amount,
    via,
    ...(note.trim() ? { note: note.trim() } : {}),
    ...(approx ? { approx: true } : {}),
  });
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

/**
 * «¿Se cobró este trabajo?» as one answer, not a payment: `asAgreed` (Sí, todo) or `none` (No se cobró nada); undefined
 * takes the answer back and the cobros speak again. Returns whether it changed.
 * @param {OfferRecord} record
 * @param {'asAgreed' | 'none' | undefined} paid
 */
export function setPaid(record, paid) {
  if (paid === record.paid) return false;
  if (paid) record.paid = paid;
  else delete record.paid;
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

/**
 * «Prometió pagar el <fecha>»: the ganadero's promise after the conversation, kept on the step «Hablar con el ganadero»
 * (marked done today if it was not). An empty date takes the promise away.
 * @param {{ mine: { claim?: { steps?: Record<string, any> } } }} offer
 * @param {string} date ISO
 * @param {string} today ISO
 */
export function setPromise(offer, date, today) {
  const steps = { ...(offer.mine.claim?.steps ?? {}) };
  const { promise: _old, ...talk } = steps.talk ?? { done: today };
  steps.talk = date ? { ...talk, promise: date } : talk;
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
    const month = record.months?.[iso.slice(0, 7)];
    if (month?.closed || month?.count) continue; // a counted month says its sick days in its count
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
