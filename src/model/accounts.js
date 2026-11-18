/**
 * What the screens say of a settled offer (ADR-0032): one month's calendar figures, and where the offer stands today.
 * Built from `settle` and the record; nothing is calculated again. Amounts are gross, as `settle` has them. No DOM.
 */

import { isWorthCounting } from '../format.js';
import { cents, spreadTo, sum } from '../ledger.js';
import { daysBetween, monthSpan } from './days.js';
import { countsOf, defaultMarks, marksOf } from './record.js';
import { ITEMS, netOfItem, netOfRow, settle } from './settle.js';

/**
 * The lines of a ledger, in net. The cash agreed (`cashGross`, as it counts inside the dues) is taken out of the items,
 * salary first, and shown as a line of its own, «En negro», as handed (`cash`); what is left of each item is taken
 * times `netFactor`. The lines add up to the items.
 * @param {{ item: 'salary' | 'overnight' | 'vacation' | 'severance', due: number, byMinimum?: boolean }[]} grossItems dues in gross
 * @param {number} cash agreed cash, net as handed
 * @param {number} cashGross the same cash as the gross that brings it net
 * @param {number} netFactor
 * @returns {{ key: 'salary' | 'overnight' | 'vacation' | 'severance' | 'cash', due: number, byMinimum: boolean }[]}
 */
export function linesOf(grossItems, cash, cashGross, netFactor) {
  let left = cashGross;
  const lines = grossItems.map((x) => {
    const take = x.item === 'severance' ? 0 : Math.min(left, x.due); // the cash is part of the pay, not of the severance
    left = cents(left - take);
    return { key: x.item, due: netOfItem(x.item, x.due - take, netFactor), byMinimum: Boolean(x.byMinimum) };
  });
  const taken = cents(cashGross - left);
  const shown = cashGross > 0 ? cents((cash * taken) / cashGross) : 0;
  return [...lines, { key: /** @type {const} */ ('cash'), due: shown, byMinimum: false }];
}

const pad2 = (n) => String(n).padStart(2, '0');

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
    items: { salary: { ...zero }, overnight: { ...zero }, vacation: { ...zero }, severance: { ...zero } },
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
 * @param {ReturnType<typeof settle>} settled the offer settled with `record`
 * @param {ReturnType<typeof import('./calc.js').calc>} r the offer's figures: `lines`, `due` and `delta` are in net, by `r.netFactor`
 */
export function monthAccounts(offer, record, key, today, settled, r) {
  const { netFactor } = r;
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
    const base = settle(offer, asOffer, today, r).rows.find((x) => x.month === key);
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
 * - `corresponde`, `cobrado` (with `paid` `asAgreed`: what the offer agreed, net) and `falta` = corresponde − cobrado, never below 0, over the months that have ended (the
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
 * @param {import('./settle.js').Paid} [paid] `none`: "No se cobró nada" was said, so with no cobro what corresponds is what is owed
 */
export function standingOf(settled, today, phase, payments, netFactor, paid) {
  const { rows, totals } = settled;
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
        : item === 'severance'
          ? finished
            ? sum(rows.map((row) => row.items.severance.due))
            : 0 // falls due with the end
          : sum(counted.map((row) => row.items[item].due)),
    // The minimum is why a line is what it is only where it fell short in the months it covers
    byMinimum: item !== 'severance' && sum(counted.map((row) => row.items[item].shortfall)) > 0,
  }));
  const lines = linesOf(
    dueItems,
    sum(counted.map((row) => row.agreedCash)),
    sum(counted.map((row) => row.agreedCashGross)),
    netFactor,
  );
  const corresponde = sum(lines.map((x) => x.due));
  // «Sí, todo»: what the offer agreed was received, so what is missing is only what the minimum adds to it (and the
  // severance, which the offer does not promise); «No se cobró nada», and the payments are not read
  // (under «Lo pactado» what is missing is what is owed: the minimum's shortfall and what nobody agreed in money)
  const lack = paid === 'asAgreed' ? 'owed' : 'shortfall';
  const shortOf = (item) =>
    item === 'vacation'
      ? sum(rows.map((row) => row.items.vacation[lack])) * accrual
      : item === 'severance'
        ? finished
          ? sum(rows.map((row) => row.items.severance[lack]))
          : 0
        : sum(counted.map((row) => row.items[item][lack]));
  const shortNet = sum(ITEMS.map((item) => netOfItem(item, shortOf(item), netFactor)));
  const cobrado =
    paid === 'asAgreed'
      ? Math.max(0, cents(corresponde - shortNet))
      : paid === 'none'
        ? 0
        : sum(payments.map((p) => p.amount));
  const falta = Math.max(0, cents(corresponde - cobrado));
  // What the law adds to the agreed pay, item by item in whole euros that add up to the net total
  const shortItems = ITEMS.map((item) => ({ key: item, amount: netOfItem(item, shortOf(item), netFactor) })).filter(
    (x) => x.amount > 0,
  );
  const shortWhole = spreadTo(
    shortItems.map((x) => x.amount),
    Math.round(sum(shortItems.map((x) => x.amount))),
    1,
  );
  // Nothing is dated while nothing was said to be paid: with no cobro the debt is only what corresponds
  const hasPayments = payments.length > 0 || Boolean(paid);
  const claimable = falta > 0 && hasPayments;
  const deadlines = claimable
    ? rows
        .filter((row) => row.owed > 0 && row.deadline)
        .map((row) => ({
          month: row.month,
          owed: netOfRow(row, 'owed', netFactor),
          deadline: /** @type {string} */ (row.deadline),
          lapsed: row.lapsed,
          daysLeft: daysBetween(today, /** @type {string} */ (row.deadline)),
        }))
    : [];
  // The same months in whole euros, as the tiles show them, adding up to Falta (the ledger rule: `spreadTo`)
  const owedSum = sum(deadlines.map((d) => d.owed));
  const whole = spreadTo(
    deadlines.map((d) => d.owed),
    Math.abs(owedSum - falta) < 1 ? Math.round(falta) : Math.round(owedSum),
    1,
  );
  const shown = deadlines.map((d, i) => ({ ...d, owedWhole: whole[i] }));
  return {
    hasPayments,
    ended,
    /** The months counted in Corresponde: those that have ended and the one in progress (every one once finished). */
    counted: counted.map((row) => row.month),
    corresponde,
    /** What the offer agreed, net: Corresponde without what only the law adds (the minimum, a severance the offer does not mention). */
    agreed: Math.max(0, cents(corresponde - shortNet)),
    /** What the law adds to the pay agreed, per item (`salary`, `overnight`, `vacation`, `severance`), in whole euros adding up to the net total. */
    legalItems: shortItems.map((x, i) => ({ key: x.key, amount: shortWhole[i] })),
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
      due: netOfRow(row, 'due', netFactor),
      owed: claimable ? netOfRow(row, 'owed', netFactor) : 0,
      deadline: claimable ? row.deadline : null,
      lapsed: row.lapsed,
      daysLeft: claimable && row.deadline ? daysBetween(today, row.deadline) : null,
    })),
    /** The earliest deadline not lapsed of what is due, with cobros said or not: dates a job with no cobro recorded yet. */
    firstDeadline: rows
      .filter((row) => row.deadline && !row.lapsed)
      .reduce((a, row) => (!a || row.deadline < a ? row.deadline : a), /** @type {string | null} */ (null)),
    /** Something is owed and every month of it is past its deadline. */
    lapsedAll: deadlines.length > 0 && deadlines.every((d) => d.lapsed),
    /** The claim that lapses first, or null. */
    nearest: deadlines.length ? deadlines.reduce((a, b) => (b.deadline < a.deadline ? b : a)) : null,
    deadlines: shown,
  };
}

/**
 * Where the money of a finished job stands (ADR-0035, «option D»: the state comes from what the shepherd expects). With
 * nothing missing it is `settled`. With Falta above 0: `owed` once the shepherd said no more is expected (`complete`) or
 * the date the ganadero promised passed; `expecting` while a cobro is expected and the promised date, if any, has not
 * passed; `unconfirmed` while neither was said, which is never a debt to claim.
 * @param {{ falta: number, record: { complete?: object, expecting?: { by?: string } }, today: string }} job `today` is an ISO date
 * @returns {'settled' | 'owed' | 'expecting' | 'unconfirmed'}
 */
export function moneyState({ falta, record, today }) {
  if (falta <= 0) return 'settled';
  if (record.complete) return 'owed';
  if (!record.expecting) return 'unconfirmed';
  return record.expecting.by && record.expecting.by < today ? 'owed' : 'expecting';
}

/**
 * The status of a worked job on its card in Trabajos: a tone and one short line, or null where nothing is said. The list
 * stays calm (ADR-0035): red only where the ganadero owes (`money` is `owed`: no more is expected, or the promise lapsed)
 * and the claim is still in time; amber «Esperando cobro» while a cobro is expected, and amber while a claim deadline
 * runs and something remains to record; grey «Por confirmar» while nobody said whether a cobro is expected, for a job
 * finished with nothing recorded («Sin registro») and for what lapsed («Prescrito», never red); green «Saldado» for a job
 * with nothing missing. A job under way says nothing until a month has ended.
 * @param {{ phase: 'underway' | 'finished', hasPayments: boolean, owed: number, unclosed: number, money?: ReturnType<typeof moneyState>, claim?: { by: string | null, lapsed: boolean }, bare?: boolean, window?: boolean, approx?: boolean }} job `unclosed`: months that have ended and are not closed; `money`: of a finished job, from `moneyState`; `claim`: the deadline of what is owed (`by`: the nearest not lapsed; `lapsed`: all of it is); `bare`: finished with nothing recorded; `window`: some deadline of what is due has not passed; `approx`: the cobros are approximate
 * @returns {{ tone: 'red' | 'amber' | 'grey' | 'green', text: string, owed?: number, approx?: boolean, claim?: { by: string | null, lapsed: boolean } } | null}
 */
export function jobStatus({
  phase,
  hasPayments,
  owed,
  unclosed,
  money = 'owed',
  claim,
  bare = false,
  window = true,
  approx = false,
}) {
  const finished = phase === 'finished';
  if (bare && finished) return { tone: 'grey', text: 'Sin registro' };
  if (hasPayments && owed > 0) {
    const about = approx ? { approx: true } : {};
    if (finished && claim?.lapsed) return { tone: 'grey', text: 'Prescrito', owed, ...about };
    if (finished && money === 'expecting') return { tone: 'amber', text: 'Esperando cobro', owed, ...about };
    if (finished && money === 'unconfirmed') return { tone: 'grey', text: 'Por confirmar', owed, ...about };
    return {
      tone: 'red',
      text: finished ? 'Debe' : 'Falta',
      owed,
      ...about,
      ...(finished && claim ? { claim } : {}),
    };
  }
  if (!finished && unclosed === 0) return null;
  /** @param {string} text */
  const amber = (text) => (window ? { tone: /** @type {const} */ ('amber'), text } : null);
  if (!hasPayments) return amber('Sin cobros apuntados');
  if (unclosed > 0) return amber(unclosed === 1 ? '1 mes sin cerrar' : `${unclosed} meses sin cerrar`);
  return finished ? { tone: 'green', text: 'Saldado' } : null;
}

/**
 * What the job left besides the figures of the tiles, for «Balance del trabajo» (ADR-0032): the days worked, and the days
 * contributed and the paro the offer generates. `firm` is whether every month is closed: until then Corresponde and the
 * days worked partly follow the offer. The contributions and the paro always follow the
 * offer, because the real payslip is not recorded. In net, as the rest.
 * @param {{ terms: object }} offer
 * @param {import('./settle.js').OfferRecord} record
 * @param {ReturnType<typeof settle>} settled
 * @param {{ unemployment: { contribDays: number, contribVacationDays: number, days: number, euros: number } }} r the offer's figures
 */
export function balanceOf(offer, record, settled, r) {
  const inJob = settled.rows.filter((row) => row.days > 0);
  const marks = inJob.map((row) => ({
    closed: row.closed,
    worked: marksOf(offer, record, { key: row.month, from: row.from, to: row.to }).filter((m) => m.kind === 'work')
      .length,
  }));
  return {
    months: { closed: inJob.filter((row) => row.closed).length, total: inJob.length },
    firm: inJob.length > 0 && inJob.every((row) => row.closed),
    worked: marks.reduce((t, m) => t + m.worked, 0),
    workedClosed: marks.filter((m) => m.closed).reduce((t, m) => t + m.worked, 0),
    contribDays: r.unemployment.contribDays,
    contribVacationDays: r.unemployment.contribVacationDays,
    paroDays: r.unemployment.days,
    paroEuros: r.unemployment.euros,
  };
}

/**
 * What paying en negro or without a contract meant, for the talk with the ganadero: the Social Security he saved and the
 * paro that was not generated, as the offer's analysis has them (the real payslip is not recorded). Null where the job had
 * neither cash nor a missing contract, or the saving is nothing.
 * @param {{ noContract?: boolean, cash: { total: number }, savings: { cash: number }, unemployment: { lost: { days: number, euros: number } } }} r the offer's figures
 * @returns {{ saved: number, paroDays: number, paroEuros: number } | null}
 */
export function negroOf(r) {
  if (!(r.noContract || r.cash.total > 0.5) || !isWorthCounting(r.savings.cash)) return null;
  const { days, euros } = r.unemployment.lost;
  const paro = Math.round(days) >= 1 && isWorthCounting(euros);
  return { saved: r.savings.cash, paroDays: paro ? Math.round(days) : 0, paroEuros: paro ? euros : 0 };
}

/**
 * Why Corresponde is more than the pay agreed, where it is: the minimum the law and the convenio demand exceeds the
 * pay agreed, item by item (ADR-0004: the greater is owed per item). In net, one unit (per day, or per month), the
 * components of the minimum that apply and the items that fall short. Null where no item falls short. The figures are the
 * model's own.
 * @param {{ terms: object }} offer
 * @param {ReturnType<typeof settle>} settled
 * @param {{ netFactor: number, noContract?: boolean, time: { daysWorked: number, months: number }, split?: { unit?: string } | null }} r
 */
export function minimumNote(offer, settled, r) {
  const { totals } = settled;
  if (totals.shortfall < 1) return null;
  const { terms } = offer;
  const agreedUnit = terms.payrollMin ? terms.totalUnit : terms.payUnit;
  const inTotal = agreedUnit === 'total';
  const perDay = agreedUnit === 'day' || r.split?.unit === 'day';
  const per = inTotal ? 1 : perDay ? r.time.daysWorked : r.time.months;
  if (!(per > 0)) return null;
  const each = (gross) => cents((gross * r.netFactor) / per);
  const items = totals.items;
  const components = [
    { key: 'salary', amount: each(items.salary.minimum) },
    { key: 'overnight', amount: each(items.overnight.minimum) },
    { key: 'vacation', amount: each(items.vacation.minimum) },
  ].filter((x) => x.amount > 0);
  // The pay's items only: the severance is the law's, not a shortfall of what was agreed
  const payItems = ITEMS.filter((item) => item !== 'severance');
  const agreedGross = sum(payItems.map((item) => items[item].agreed)) - totals.agreedCashGross;
  const total = sum(components.map((x) => x.amount));
  const agreed = cents((agreedGross * r.netFactor + totals.agreedCash) / per);
  // Without a contract «las vacaciones no se pagan aparte» says nothing the missing contract has not said
  const short = payItems
    .map((key) => ({ key, amount: each(items[key].shortfall) }))
    .filter((x) => x.amount > 0 && !(x.key === 'vacation' && r.noContract));
  if (total <= agreed && !short.length) return null;
  return {
    /** No contract: the figures are said plain, with no «netos». */
    noContract: Boolean(r.noContract),
    /** The unit the pay was agreed in: per day, per month or in total. */
    unit: inTotal ? 'total' : perDay ? 'día' : 'mes',
    components,
    total,
    agreed,
    /** The minimum as a whole is above the pay agreed; else only some items fall short (ADR-0004), listed in `short`. */
    exceeds: total > agreed,
    short,
  };
}
