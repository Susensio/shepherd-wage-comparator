/**
 * What the record's views show of a job, worked out from the offer, its settled months and the questions the page has
 * open (ADR-0035). No DOM, no templates: `ui/record.js` supplies what the page remembers and paints the result.
 */

import { isoOf, parseDate, payKnown } from '../offer.js';
import { jobStatus, moneyState, standingOf } from './accounts.js';
import { hasFacts, jobStart, phaseOf } from './phase.js';

/**
 * What the page has open for one job: the answers it is waiting on.
 * @typedef {object} Pending
 * @property {{ how: string | null, error?: string } | undefined} asked «¿Cómo acabó?» opened by hand
 * @property {boolean | undefined} startOther «Empezó otro día», from the menu: the date asked
 * @property {boolean | undefined} recording «No todo» answered to «¿Se cobró este trabajo?»: the record is being made
 * @property {boolean | undefined} endLater «¿Cómo acabó?» put off for this session
 * @property {{ no: boolean, error?: string } | undefined} recall the answer to «¿Se llamó para la campaña?», if «No»
 */

const BARE = {
  phase: /** @type {const} */ ('finished'),
  hasPayments: false,
  owed: 0,
  unclosed: 0,
  bare: true,
};

/** The phase of an offer that has a record to show, or null: not decided, or only an offer. Thin terms still show it. */
export function recordPhase(o, today) {
  const phase = phaseOf(o, today, o.mine.record);
  return phase === 'underway' || phase === 'finished' ? phase : null;
}

/**
 * A job finished with nothing recorded of it and no «No todo» said: its ficha leads with the analysis and asks only
 * «¿Se cobró este trabajo?». `recording`: «No todo» was tapped on this page.
 */
export const isBare = (o, phase, recording) => phase === 'finished' && !hasFacts(o.mine.record) && !recording;

/** What the phase pill says: a job is taken as started on its date (the menu has «Empezó otro día»). */
export const pillPhase = (o, phase) => phase;

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
 * @param {Pending['recall']} answer
 */
export function recallOf(o, today, answer) {
  const record = o.mine.record;
  if (o.terms.contract !== 'seasonal' || record.end?.how !== 'agreed' || !o.terms.start) return null;
  const from = nextSeasonStart(o);
  const year = from.slice(0, 4);
  if (today < from || record.recall?.[year]) return null;
  return { year, no: Boolean(answer?.no), error: answer?.error ?? '', min: record.end.date };
}

/**
 * The questions at the turns of a job. The start date only when asked from the menu («Empezó otro día»);
 * «¿Cómo acabó?» for a finished job with no answer, or when asked from «Acabó antes».
 * @param {any} o
 * @param {'underway' | 'finished'} phase
 * @param {{ job: { to?: string } }} settled
 * @param {string} today
 * @param {Pending} pending
 */
export function cardsOf(o, phase, settled, today, pending) {
  const record = o.mine.record;
  const { asked } = pending;
  // A job started on its date: the date is asked only once «Empezó otro día» was chosen in the menu
  const start = pending.startOther && !asked ? { date: o.terms.start, other: true } : null;
  // On sick leave the contract is suspended: how it ended is not asked until the leave is closed
  const onLeave = Boolean(record.sick && !record.sick.to);
  // A finished job with nothing recorded is not asked how it ended: that is for one with a record to close
  const recorded = hasFacts(record) || Boolean(pending.recording);
  const open = asked || (phase === 'finished' && recorded && !record.end && !onLeave && !pending.endLater);
  const end = open
    ? {
        how: asked?.how ?? null,
        early: Boolean(asked),
        seasonal: o.terms.contract === 'seasonal',
        /** The first day an end or a leave can have: the job's start. */
        min: jobStart(o),
        error: asked?.error ?? '',
        /** What «Al final pactado» takes: the last day of the job, never after today. */
        agreedDate: lastDayOf(settled, today),
      }
    : null;
  const recall = recallOf(o, today, pending.recall);
  return start || end || recall ? { start, end, recall } : null;
}

/** The last day of the job, never after today. */
export const lastDayOf = (settled, today) => [settled.job.to, today].find((d) => d && d <= today) ?? today;

/** Where the calendar starts for an offer: this month under way, the first still open once finished. */
function defaultMonth(rows, today, phase) {
  const shown = rows.filter((row) => row.from <= today);
  if (phase === 'underway') return (shown.at(-1) ?? rows[0]).month;
  return (shown.find((row) => !row.closed) ?? shown.at(-1)).month;
}

/**
 * The month the calendar shows: the one picked if it has started, else the default.
 * @param {string | undefined} picked
 * @param {string | null} addable
 */
export function monthOnCalendar(picked, rows, today, phase, addable) {
  return rows.some((row) => row.month === picked && row.from <= today) || picked === addable
    ? /** @type {string} */ (picked)
    : defaultMonth(rows, today, phase);
}

/**
 * The months of the job as chips: each one's state, the one on the calendar marked, and the one that can be added.
 * @returns {{ month: string, state: 'closed' | 'due' | 'now' | 'later' | 'add', selected: boolean }[]}
 */
export function monthStrip(rows, today, key, addable) {
  const strip = rows.map((row) => ({
    month: row.month,
    state: /** @type {'closed' | 'due' | 'now' | 'later'} */ (
      row.closed ? 'closed' : row.from > today ? 'later' : row.calendarTo < today ? 'due' : 'now'
    ),
    selected: row.month === key,
  }));
  if (addable) strip.push({ month: addable, state: /** @type {any} */ ('add'), selected: addable === key });
  return strip;
}

/** What the calendar of a month needs to know of its row: whether it is in the job, in progress, or can be closed. */
export function monthFlags(row, today) {
  return {
    inJob: Boolean(row),
    current: Boolean(row) && row.from <= today && today <= row.calendarTo,
    canClose: Boolean(row) && row.calendarTo < today,
  };
}

/** The cobros, newest first; the later one of the same day first. */
export const paymentsNewestFirst = (payments) =>
  payments
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.date.localeCompare(a.p.date) || b.i - a.i)
    .map((x) => x.p);

/**
 * What was cobrado of a job, as everything that shows it reads it (Cuentas, the list's year sums, «Final de campaña», the
 * Expediente): `basis` is how it is known (`cobros`, `asAgreed`, `none`) or `unknown`, and then it is the agreed money for a
 * finished job (`approx`) and nothing for one still under way, which has not been paid yet.
 * @param {any} o
 * @param {any} r its figures
 * @param {'underway' | 'finished' | null} phase
 * @param {{ cobrado: number } | null} standing from `standingOf`, null when not computed (nothing recorded)
 * @returns {{ basis: 'cobros' | 'asAgreed' | 'none' | 'unknown', amount: number, approx: boolean }}
 */
export function cobradoOf(o, r, phase, standing) {
  const { paid, payments } = o.mine.record;
  const basis = paid ?? (payments.length ? 'cobros' : 'unknown');
  if (basis === 'unknown' || !standing)
    return { basis: 'unknown', amount: phase === 'finished' ? r.earnings.received : 0, approx: true };
  return { basis, amount: standing.cobrado, approx: basis === 'cobros' && payments.some((p) => p.approx) };
}

/**
 * What a card says of a job under way or finished: its phase and pill, and its status (`jobStatus`). Null phase for an
 * offer only offered.
 * @param {any} o
 * @param {any} r its figures
 * @param {() => ReturnType<typeof import('./settle.js').settle>} settledOf the settled months, asked for only when the job has a record
 * @param {string} today
 * @returns {{ phase: 'undecided' | 'underway' | 'finished' | null, pill?: string, status: ReturnType<typeof jobStatus>, cobrado?: ReturnType<typeof cobradoOf> }}
 */
export function cardOf(o, r, settledOf, today) {
  const phase = phaseOf(o, today, o.mine.record);
  if (phase === 'offerOnly' || !o.terms.start) return { phase: null, status: null };
  if (!recordPhase(o, today)) return { phase, status: null };
  const recordPhaseNow = /** @type {'underway' | 'finished'} */ (phase);
  // Old jobs nobody recorded are calm and cost nothing to draw
  if (recordPhaseNow === 'finished' && !hasFacts(o.mine.record))
    return { phase, pill: pillPhase(o, phase), status: jobStatus(BARE), cobrado: cobradoOf(o, r, 'finished', null) };
  const s = standingOf(settledOf(), today, recordPhaseNow, o.mine.record.payments, r.netFactor, o.mine.record.paid);
  return {
    phase,
    pill: pillPhase(o, phase),
    cobrado: cobradoOf(o, r, recordPhaseNow, s),
    // A job not yet confirmed as started has nothing to record
    status: !payKnown(o.terms)
      ? null
      : jobStatus({
          phase: recordPhaseNow,
          hasPayments: s.hasPayments,
          owed: s.falta,
          unclosed: s.unclosed.length,
          money: moneyState({ falta: s.falta, record: o.mine.record, today }),
          window: s.firstDeadline !== null,
          approx: !o.mine.record.paid && o.mine.record.payments.some((p) => p.approx),
          claim: {
            by: s.deadlines
              .filter((d) => !d.lapsed)
              .reduce((a, d) => (!a || d.deadline < a ? d.deadline : a), /** @type {string | null} */ (null)),
            lapsed: s.lapsedAll,
          },
        }),
  };
}
