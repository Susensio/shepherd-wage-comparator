/**
 * The ladder of a claim (ADR-0034): the steps from the gentlest to the strongest, which of them apply to a job
 * finished, their deadlines and the next one to take. From what `standingOf` says and the end and steps the shepherd
 * recorded; no legal advice, only where each step stands. No DOM.
 */

import { LAW } from '../law.js';
import { isoOf, parseDate } from '../offer.js';
import { daysBetween } from './days.js';

/**
 * The last day to act against a dismissal, counted conservatively: `LAW.dismissalDays` weekdays (Monday to Friday)
 * from the day after, holidays ignored. ET art. 59.3 counts working days, so the real date is never earlier than this
 * one, and holidays can only make it later.
 * @param {string} date ISO date of the dismissal
 * @returns {string} ISO date
 */
export function dismissalDeadline(date) {
  const day = parseDate(date);
  for (let counted = 0; counted < LAW.dismissalDays; ) {
    day.setDate(day.getDate() + 1);
    if (day.getDay() !== 0 && day.getDay() !== 6) counted++;
  }
  return isoOf(day);
}

/** The steps in order, the dismissal first where it applies. */
export const STEP_IDS = /** @type {const} */ ([
  'dismissal',
  'talk',
  'request',
  'union',
  'conciliation',
  'inspection',
  'court',
  'fogasa',
]);

/**
 * @typedef {typeof STEP_IDS[number]} StepId
 * @typedef {object} Step
 * @property {StepId} id
 * @property {string | null} deadline the date it must be taken by, if the step has one of its own
 * @property {number | null} daysLeft days from today to `deadline`; negative once lapsed
 * @property {boolean} lapsed `deadline` is before today
 * @property {boolean} ready it can be taken now: the court only after the conciliation was done
 * @property {{ done: string, note?: string, promise?: string } | null} done the «Hecho» mark
 */

/**
 * The ladder for a job finished.
 * - `mode`: `settled` (nothing owed and no dismissal: no ladder), `noCobros` (no cobro recorded: the first step and the prompt),
 *   `owed`, or `dismissed` (the job ended by dismissal, whether or not something is owed).
 * - `by`: the claim deadline, the earliest month not lapsed (ET art. 59.2); `lapsedAll` when none is left.
 * - `inWindow`: something is owed within its deadline, or a dismissal window is open: the job is «Para reclamar».
 * - `next`: the first step ready and not done, with the date it counts against (its own, else `by`); with no cobro
 *   said, `cobros` (to write them down) unless a dismissal comes first.
 * @param {object} input
 * @param {string} input.today ISO date
 * @param {ReturnType<typeof import('./accounts.js').standingOf>} input.standing
 * @param {import('./settle.js').JobEnd | undefined} input.end
 * @param {Record<string, { done: string, note?: string, promise?: string }>} input.marks `mine.claim.steps`
 */
export function claimSteps({ today, standing, end, marks }) {
  const owed = standing.hasPayments && standing.falta > 0;
  const dismissed = end?.how === 'dismissed';
  const mode = dismissed ? 'dismissed' : owed ? 'owed' : standing.hasPayments ? 'settled' : 'noCobros';
  const open = standing.deadlines.filter((d) => !d.lapsed);
  const noCobros = !standing.hasPayments;
  // With no cobro said the deadlines are still running: the earliest month not lapsed
  const by = noCobros
    ? (standing.firstDeadline ?? null)
    : open.length
      ? open.reduce((a, b) => (b.deadline < a.deadline ? b : a)).deadline
      : null;
  const lapsedAll = owed && !open.length;
  const make = (id, deadline = null, ready = true) => ({
    id,
    deadline,
    daysLeft: deadline ? daysBetween(today, deadline) : null,
    lapsed: deadline ? deadline < today : false,
    ready,
    done: marks[id] ?? null,
  });
  /** @type {Step[]} */
  const steps = [];
  if (dismissed) steps.push(make('dismissal', dismissalDeadline(end.date)));
  if (owed || !standing.hasPayments) steps.push(make('talk'));
  if (owed) {
    steps.push(
      make('request'),
      make('union'),
      // after a dismissal the papeleta also impugns it: the earlier of that deadline and the amounts'
      make('conciliation', dismissed ? ([dismissalDeadline(end.date), by].filter(Boolean).sort()[0] ?? null) : by),
      make('inspection'),
      make('court', null, Boolean(marks.conciliation)),
      make('fogasa'),
    );
  } else if (dismissed) {
    // A dismissal always has the union and the papeleta, owed or not; the papeleta's deadline is the dismissal's
    steps.push(make('union'), make('conciliation', steps[0].deadline));
  }
  const dismissal = steps.find((s) => s.id === 'dismissal');
  /** The date the ganadero promised to pay, while it has not passed. */
  const promise = owed && marks.talk?.promise && marks.talk.promise >= today ? marks.talk.promise : null;
  const next = steps.find((s) => s.ready && !s.done) ?? null;
  return {
    mode,
    steps: mode === 'settled' ? [] : steps,
    by,
    lapsedAll,
    inWindow: ((owed || noCobros) && by !== null) || Boolean(dismissal && !dismissal.lapsed && !dismissal.done),
    // With no cobro said, what comes first is saying them; a promise to pay not yet due is waited for
    next:
      noCobros && !(next?.id === 'dismissal')
        ? { id: /** @type {const} */ ('cobros'), deadline: null, by }
        : promise && next?.id !== 'dismissal'
          ? { id: /** @type {const} */ ('promise'), deadline: null, by, promise }
          : next && { ...next, by: next.deadline ?? by },
  };
}
