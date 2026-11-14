/**
 * What the screens say of a settled offer (ADR-0032): one month's calendar figures, and where the offer stands today.
 * Built from `settle` and the record; nothing is calculated again. Amounts are gross, as `settle` has them. No DOM.
 */

import { cents, sum } from '../ledger.js';
import { parseDate } from '../offer.js';
import { countsOf, defaultMarks, marksOf } from './record.js';
import { ITEMS, settle } from './settle.js';

const DAY_MS = 864e5;

/**
 * The lines of a ledger, in net. The cash agreed (`cashGross`, as it counts inside the dues) is taken out of the items,
 * salary first, and shown as a line of its own, «En negro», as handed (`cash`); what is left of each item is taken
 * times `netFactor`. The lines add up to the items.
 * @param {{ item: 'salary' | 'overnight' | 'vacation', due: number, byMinimum?: boolean }[]} grossItems dues in gross
 * @param {number} cash agreed cash, net as handed
 * @param {number} cashGross the same cash as the gross that brings it net
 * @param {number} netFactor
 * @returns {{ key: 'salary' | 'overnight' | 'vacation' | 'cash', due: number, byMinimum: boolean }[]}
 */
export function linesOf(grossItems, cash, cashGross, netFactor) {
  let left = cashGross;
  const lines = grossItems.map((x) => {
    const take = Math.min(left, x.due);
    left = cents(left - take);
    return { key: x.item, due: cents((x.due - take) * netFactor) + 0, byMinimum: Boolean(x.byMinimum) };
  });
  const taken = cents(cashGross - left);
  const shown = cashGross > 0 ? cents((cash * taken) / cashGross) : 0;
  return [...lines, { key: /** @type {const} */ ('cash'), due: shown, byMinimum: false }];
}

const daysBetween = (from, to) => Math.round((+parseDate(to) - +parseDate(from)) / DAY_MS);

const pad2 = (n) => String(n).padStart(2, '0');
/** The span of a whole calendar month «2026-10», as the record's helpers take it. */
export function monthSpan(key) {
  const [y, m] = key.split('-').map(Number);
  return { key, from: `${key}-01`, to: `${key}-${pad2(new Date(y, m, 0).getDate())}` };
}

/**
 * The month after the job's last, when it has started and can be added: «+ Añadir <mes>». It is not part of the job
 * until a day is marked worked in it. Null for a job with no known end, or when that month is still to come.
 * @param {ReturnType<typeof settle>} settled
 * @param {string} today ISO date
 */
export function addableMonth(settled, today) {
  const last = settled.rows.at(-1);
  if (!last || !settled.job.to) return null;
  const [y, m] = last.month.split('-').map(Number);
  const next = `${m === 12 ? y + 1 : y}-${pad2(m === 12 ? 1 : m + 1)}`;
  return `${next}-01` <= today ? next : null;
}

/** A month that is not in the job (yet), as a row with nothing due, so its calendar can be shown. */
const stubRow = (key) => {
  const span = monthSpan(key);
  const zero = {
    agreed: 0,
    minimum: 0,
    due: 0,
    shortfall: 0,
    received: 0,
    owed: 0,
    declared: 0,
    belowMinimumOnPayroll: 0,
  };
  return {
    month: key,
    closed: false,
    estimate: true,
    from: span.from,
    to: span.to,
    calendarFrom: span.from,
    calendarTo: span.to,
    jobFrom: '9999-12-31',
    jobTo: '0000-01-01',
    extension: true,
    items: { salary: { ...zero }, overnight: { ...zero }, vacation: { ...zero } },
    agreedCash: 0,
    agreedCashGross: 0,
    due: 0,
  };
};

/** The span of a settled month, as the record's helpers take it. */
export const spanOf = (row) => ({ key: row.month, from: row.calendarFrom ?? row.from, to: row.calendarTo ?? row.to });

/**
 * One month for its calendar: the marks as shown, their counts, the money of the month and, when the jornadas differ
 * from the offer's, what that is worth. Counts decide: a libranza moved to another day is not a difference.
 * @param {{ id?: string, terms: object, mine: object }} offer
 * @param {import('./settle.js').OfferRecord} record
 * @param {string} key «2026-06»
 * @param {string} today ISO date
 * @param {{ cfg: object, offers?: object[] }} ctx
 * @param {number} netFactor `r.netFactor`: `lines`, `due` and `delta` are in net
 */
export function monthAccounts(offer, record, key, today, ctx, netFactor) {
  const settled = settle(offer, record, today, ctx);
  const row =
    settled.rows.find((x) => x.month === key) ?? (addableMonth(settled, today) === key ? stubRow(key) : undefined);
  if (!row) return null;
  const span = spanOf(row);
  // Days outside the job are not libranzas: they stay out of the counts (and of the money, which only counts the job's days)
  const marks = marksOf(offer, record, span, { from: row.jobFrom ?? row.from, to: row.jobTo ?? row.to });
  const counts = countsOf(marks.filter((m) => !m.outside));
  const offerCounts = countsOf(defaultMarks(offer, span));
  const jornadas = counts.work - offerCounts.work;
  let delta = null;
  if (!row.closed && jornadas !== 0) {
    // Against the offer's days written out, not its averages: one jornada less is worth one jornada
    const asOffer = {
      ...record,
      months: {
        ...record.months,
        [key]: { closed: false, days: Object.fromEntries(defaultMarks(offer, span).map((m) => [m.day, m.kind])) },
      },
    };
    // (a month after the offer is not in the job without a day worked: all of it is more than the offer)
    const base = settle(offer, asOffer, today, ctx).rows.find((x) => x.month === key);
    delta = cents(row.due - (base?.due ?? 0)) + 0; // + 0: no -0
  }
  const lines = linesOf(
    ITEMS.map((item) => ({ item, due: row.items[item].due })),
    row.agreedCash,
    row.agreedCashGross,
    netFactor,
  );
  return {
    row,
    span,
    marks,
    counts,
    jornadas,
    /** In net: salary, overnight bonus, vacation and «En negro» (the cash agreed), adding up to `due`. */
    lines,
    due: sum(lines.map((x) => x.due)),
    delta: delta === null ? null : cents(delta * netFactor) + 0,
  };
}

/**
 * Where an offer stands, in net: the owner thinks in what reaches the shepherd, so what `settle` has gross is taken
 * times `netFactor` (the factor it uses to gross the payroll cobros up) and the cobros are as they arrived. The job is
 * worked with its totals, not month by month: months matter only for the days that make `corresponde`.
 * - `corresponde`, `cobrado` and `falta` = corresponde − cobrado, never below 0, over the months that have ended (the
 *   whole job once over). `sobra`: what was cobrado beyond it, a note and not a debt (real payslips differ from the
 *   simulated ones).
 * - `running`: the month in progress, counted up to today; the vacation accrues with the days counted.
 * - `lines`: `corresponde` as ledger lines (salary, overnight bonus, vacation once over, «En negro»).
 * - `nearest` and `deadlines`: when the claim of what is missing lapses. The payments are assigned oldest first, to date
 *   it and for nothing else; nothing when nothing is missing.
 * - `unclosed`: the months not closed, among those that have ended.
 * @param {ReturnType<typeof settle>} settled
 * @param {string} today ISO date
 * @param {'underway' | 'finished'} phase
 * @param {import('./settle.js').Payment[]} payments with none, nothing is owed that the shepherd has not said
 * @param {number} netFactor `r.netFactor`
 */
export function standingOf(settled, today, phase, payments, netFactor) {
  const { rows, totals } = settled;
  const net = (gross) => cents(gross * netFactor) + 0; // + 0: no -0
  const finished = phase === 'finished';
  const ended = finished ? rows : rows.filter((row) => row.to < today);
  // What counts: the months that have ended and the month in progress up to today (`settle` has counted it so far)
  const counted = finished ? rows : rows.filter((row) => row.from <= today && row.days > 0);
  const current = finished ? undefined : rows.find((row) => row.share < row.fullShare);
  // The vacation falls due at the end but accrues with the days: its share is the share of the job counted so far
  const fullShare = sum(rows.map((row) => row.fullShare));
  const accrual =
    finished || settled.vacationByDays || fullShare <= 0 ? 1 : sum(counted.map((row) => row.share)) / fullShare;
  const dueItems = ITEMS.map((item) => ({
    item,
    due:
      item === 'vacation'
        ? sum(rows.map((row) => row.items.vacation.due)) * accrual
        : sum(counted.map((row) => row.items[item].due)),
    // The minimum is why a line is what it is only where it fell short in the months it covers
    byMinimum: sum(counted.map((row) => row.items[item].shortfall)) > 0,
  }));
  const lines = linesOf(
    dueItems,
    sum(counted.map((row) => row.agreedCash)),
    sum(counted.map((row) => row.agreedCashGross)),
    netFactor,
  );
  const corresponde = sum(lines.map((x) => x.due));
  const cobrado = sum(payments.map((p) => p.amount));
  const falta = Math.max(0, cents(corresponde - cobrado));
  // Nothing is dated while nothing was said to be paid: with no cobro the debt is only what corresponds
  const claimable = falta > 0 && payments.length > 0;
  const deadlines = claimable
    ? rows
        .filter((row) => row.owed > 0 && row.deadline)
        .map((row) => ({
          month: row.month,
          owed: net(row.owed),
          deadline: /** @type {string} */ (row.deadline),
          lapsed: row.lapsed,
          daysLeft: daysBetween(today, /** @type {string} */ (row.deadline)),
        }))
    : [];
  return {
    hasPayments: payments.length > 0,
    ended,
    corresponde,
    cobrado,
    /** Of `cobrado`, what was handed in cash. */
    cobradoEnMano: totals.cash,
    /** The cash agreed over the months counted, net as handed: with none cobrado en mano it is a prompt to record. */
    enManoAgreed: sum(ended.map((row) => row.agreedCash)),
    falta,
    sobra: Math.max(0, cents(cobrado - corresponde)),
    /** The month in progress, counted up to today, or null. */
    running: current ? { month: current.month } : null,
    lines,
    unclosed: ended.filter((row) => !row.closed),
    /** Every month counted, with its state and, for dating a claim, what the oldest-first assignment leaves open of it. */
    months: ended.map((row) => ({
      month: row.month,
      closed: row.closed,
      due: net(row.due),
      owed: claimable ? net(row.owed) : 0,
      deadline: claimable ? row.deadline : null,
      lapsed: row.lapsed,
      daysLeft: claimable && row.deadline ? daysBetween(today, row.deadline) : null,
    })),
    /** The claim that lapses first, or null. */
    nearest: deadlines.length ? deadlines.reduce((a, b) => (b.deadline < a.deadline ? b : a)) : null,
    deadlines,
  };
}

/**
 * What the job came to, for «Balance del trabajo» (ADR-0032): Corresponde and Cobrado (of it, in nómina and in hand),
 * the days worked, and the days contributed and the paro the offer generates. `firm` is whether every month is closed:
 * until then Corresponde and the days worked partly follow the offer. The contributions and the paro always follow the
 * offer, because the real payslip is not recorded. In net, as the rest.
 * @param {{ terms: object }} offer
 * @param {import('./settle.js').OfferRecord} record
 * @param {ReturnType<typeof settle>} settled
 * @param {ReturnType<typeof standingOf>} standing
 * @param {{ unemployment: { contribDays: number, days: number, euros: number } }} r the offer's figures
 */
export function balanceOf(offer, record, settled, standing, r) {
  const inJob = settled.rows.filter((row) => row.days > 0);
  const marks = inJob.map((row) => ({
    closed: row.closed,
    worked: marksOf(offer, record, { key: row.month, from: row.from, to: row.to }).filter((m) => m.kind === 'work')
      .length,
  }));
  return {
    months: { closed: inJob.filter((row) => row.closed).length, total: inJob.length },
    firm: inJob.length > 0 && inJob.every((row) => row.closed),
    corresponde: standing.corresponde,
    cobrado: standing.cobrado,
    cobradoMano: standing.cobradoEnMano,
    cobradoNomina: cents(standing.cobrado - standing.cobradoEnMano),
    worked: marks.reduce((t, m) => t + m.worked, 0),
    workedClosed: marks.filter((m) => m.closed).reduce((t, m) => t + m.worked, 0),
    contribDays: r.unemployment.contribDays,
    paroDays: r.unemployment.days,
    paroEuros: r.unemployment.euros,
  };
}

/**
 * Why Corresponde is more than the pay agreed, where it is: the minimum the law and the convenio demand exceeds the
 * pay agreed (ADR-0004: the greater is owed). In net, one unit (per day, or per month), the components of the minimum
 * that apply. Null where the minimum does not exceed what was agreed. The figures are the model's own.
 * @param {{ terms: object }} offer
 * @param {ReturnType<typeof settle>} settled
 * @param {{ netFactor: number, time: { daysWorked: number, months: number }, split?: { unit?: string } | null }} r
 */
export function minimumNote(offer, settled, r) {
  const { totals } = settled;
  if (totals.shortfall < 1) return null;
  const { terms } = offer;
  const perDay = (terms.payrollMin ? terms.totalUnit : terms.payUnit) === 'day' || r.split?.unit === 'day';
  const per = perDay ? r.time.daysWorked : r.time.months;
  if (!(per > 0)) return null;
  const each = (gross) => cents((gross * r.netFactor) / per);
  const items = totals.items;
  const components = [
    { key: 'salary', amount: each(items.salary.minimum) },
    { key: 'overnight', amount: each(items.overnight.minimum) },
    { key: 'vacation', amount: each(items.vacation.minimum) },
  ].filter((x) => x.amount > 0);
  const agreedGross = sum(ITEMS.map((item) => items[item].agreed)) - totals.agreedCashGross;
  return {
    unit: perDay ? 'día' : 'mes',
    components,
    total: sum(components.map((x) => x.amount)),
    agreed: cents((agreedGross * r.netFactor + totals.agreedCash) / per),
  };
}
