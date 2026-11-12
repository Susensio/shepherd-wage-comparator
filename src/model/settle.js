/**
 * settle(): what the shepherd is owed, month by month, from the offer and the record of what happened (ADR-0032).
 * Amounts are gross, in cents, rounded as rows (`ledger.js`) so the «=» rows add up. No DOM here.
 */

import { LAW } from '../law.js';
import { cents, sum } from '../ledger.js';
import { isoOf } from '../offer.js';
import { calc } from './calc.js';
import { monthShares } from './payslips.js';
import { claimDeadline } from './time.js';

/**
 * @typedef {'work' | 'off' | 'sick' | 'vacation'} DayKind
 * @typedef {{ id: string, date: string, amount: number, via: 'payroll' | 'cash' | 'transfer', note?: string }} Payment
 * @typedef {{ closed?: boolean, days?: Record<string, DayKind> }} RecordMonth `days` is keyed by the day of the month, «05»
 * @typedef {{ months?: Record<string, RecordMonth>, payments?: Payment[] }} OfferRecord months keyed «2026-06»
 * @typedef {{ agreed: number, minimum: number, due: number, shortfall: number, received: number, owed: number, declared: number, belowMinimumOnPayroll: number }} ItemRow
 * `received` is every payment, cash included; `declared` is the part of it that is not cash, and `belowMinimumOnPayroll`
 * what the minimum exceeds it by: cash covers `owed` but is still illegal as the only pay, it carries no Social Security.
 */

/** The items of a month, in the order a payment covers them (TODO: a payment names no item; unblocked by the owner's answer on whether the order matters). */
export const ITEMS = /** @type {const} */ (['salary', 'overnight', 'vacation']);

const KINDS = ['work', 'off', 'sick', 'vacation'];
const zeroItem = () => ({
  agreed: 0,
  minimum: 0,
  due: 0,
  shortfall: 0,
  received: 0,
  owed: 0,
  declared: 0,
  belowMinimumOnPayroll: 0,
});

/** The days of the record that lie inside the offer's span of the month, counted by kind. */
function factsOf(entry, from, to) {
  const counts = { work: 0, off: 0, sick: 0, vacation: 0 };
  let touched = 0;
  for (const [day, kind] of Object.entries(entry?.days || {})) {
    const date = new Date(from.getFullYear(), from.getMonth(), Number(day));
    if (!KINDS.includes(kind) || date < from || date > to) continue;
    counts[kind]++;
    touched++;
  }
  return { counts, touched };
}

/**
 * @param {{ id?: string, terms: object, mine: object }} offer
 * @param {OfferRecord | undefined} record empty or missing parts mean nothing happened yet
 * @param {string} today ISO date
 * @param {{ cfg: object, offers?: object[] }} ctx what `calc` needs
 */
export function settle(offer, record, today, ctx) {
  const { terms } = offer;
  const r = calc(offer, ctx);
  const shares = monthShares(terms);
  const labour = !r.selfEmployed; // labour law does not apply to an invoice (ADR-0029)
  const { time, pay, min } = r;
  // The wage as calculated: «solo el mínimo» turns it into a total
  const perDay = (terms.payrollMin ? 'total' : terms.payUnit) === 'day' && time.paidDays > 0;
  const dayRate = perDay ? pay.base / time.paidDays : 0;
  // TODO: vacation days marked in a closed month do not change the vacation owed; unblocked by the owner's rule on how
  // vacation taken in kind settles against the vacation paid at the end.
  const vacationMinimum = terms.vacation === 'taken' && !r.noContract ? 0 : min.vacation; // as the ficha's debt
  const holidaysOff = terms.holidays === 'yes' ? (LAW.holidaysPerYear * time.months) / 12 : 0;

  const plans = shares.map((share) => {
    const key = isoOf(share.month).slice(0, 7);
    const entry = record?.months?.[key];
    const closed = Boolean(entry?.closed);
    const { counts, touched } = factsOf(entry, share.from, share.to);
    // The part of the month that still follows the offer: none once closed
    const open = closed ? 0 : (share.days - touched) / share.days;
    const w = share.weight;
    const worked = counts.work + open * time.daysWorked * w;
    // Paid days (docs/model.md): worked, plus vacation taken, plus holidays, which follow the offer even in a closed
    // month. TODO: a holiday worked is counted twice, and sick days are not paid; unblocked by the owner's answer on
    // how a real month pays them.
    const vacationDays =
      terms.vacation === 'taken' ? counts.vacation + open * time.vacationTaken * time.workFrac * w : 0;
    const paid = worked + vacationDays + holidaysOff * time.workFrac * w;

    // Without a contract the agreed pay is the cash, as the gross that would bring it net (what `calc` credits)
    const wage = r.noContract
      ? (r.cash.total / r.netFactor) * w
      : perDay
        ? dayRate * paid + pay.extraPays * w
        : pay.salary * w;
    const casual = min.casual && time.daysWorked > 0;
    const minimumSalary = casual ? (min.salary * worked) / time.daysWorked : min.salary * w;
    return { share, key, closed, counts, open, worked, wage, minimumSalary };
  });

  // Rounded by running total, so a column of rows adds up to its total rounded (a share of 6867.586 over 4 months
  // does not come out a cent short)
  const spread = (values) => {
    let before = 0;
    let running = 0;
    return values.map((x) => {
      running += x;
      const row = cents(running - before) + 0; // + 0: no -0
      before = cents(running);
      return row;
    });
  };
  const wageRows = spread(plans.map((x) => (labour ? x.wage : 0)));
  const salaryMinRows = spread(plans.map((x) => (labour ? x.minimumSalary : 0)));
  const overnightMinRows = spread(plans.map((x) => (labour ? min.overnightRate * x.minimumSalary : 0)));

  const rows = plans.map(({ share, key, closed, counts, open, worked }, index) => {
    // The agreed pay covers the minimum salary first, then the overnight bonus
    const overnightCovered = Math.min(
      overnightMinRows[index],
      Math.max(0, cents(wageRows[index] - salaryMinRows[index])),
    );
    const last = index === shares.length - 1;
    const agreed = {
      salary: cents(wageRows[index] - overnightCovered),
      overnight: overnightCovered,
      vacation: labour && last ? cents(pay.vacationPay) : 0,
    };
    const minimum = {
      salary: salaryMinRows[index],
      overnight: overnightMinRows[index],
      vacation: labour && last ? cents(vacationMinimum) : 0,
    };
    /** @type {Record<typeof ITEMS[number], ItemRow>} */
    const items = { salary: zeroItem(), overnight: zeroItem(), vacation: zeroItem() };
    for (const item of ITEMS) {
      const due = Math.max(agreed[item], minimum[item]);
      items[item] = {
        ...zeroItem(),
        agreed: agreed[item],
        minimum: minimum[item],
        due,
        shortfall: cents(Math.max(0, minimum[item] - agreed[item])),
        owed: due,
      };
    }
    // Days worked above the due workdays: valued at the minimum wage, apart. TODO: count them in `owed` once the ficha
    // sets the pay above the minimum against them per month (`paidAbove` in calc.js covers them over the whole contract).
    const extraDays = Math.max(0, worked - r.extra.due * share.weight);
    const dueDate = share.to;
    return {
      month: key,
      closed,
      estimate: !closed,
      from: isoOf(share.from),
      to: isoOf(share.to),
      /** Days of the record, by kind, and the share of the month still following the offer. */
      facts: { ...counts, followingOffer: open },
      items,
      extraDays: { days: extraDays, value: cents(extraDays * r.extra.dayValue) },
      due: sum(ITEMS.map((item) => items[item].due)),
      shortfall: sum(ITEMS.map((item) => items[item].shortfall)),
      received: 0,
      owed: 0,
      /** What the minimum exceeds the money that is not cash by, summed over the items. */
      belowMinimumOnPayroll: 0,
      dueDate: isoOf(dueDate),
      /** Last day the owed amount can be claimed; null when nothing is owed. */
      deadline: /** @type {string | null} */ (null),
      lapsed: false,
      claimDeadlineDate: claimDeadline(dueDate),
    };
  });

  // Payments, oldest first, fill the oldest unpaid month first, cash included: it arrived. Cash is also reported apart.
  // TODO: payroll amounts are net in practice and the dues are gross; compared as they are until the owner decides.
  const payments = [...(record?.payments || [])].sort((a, b) => a.date.localeCompare(b.date));
  const cash = sum(payments.filter((p) => p.via === 'cash').map((p) => p.amount));
  let pool = sum(payments.map((p) => p.amount));
  let declaredPool = sum(payments.filter((p) => p.via !== 'cash').map((p) => p.amount));
  for (const row of rows) {
    for (const item of ITEMS) {
      const x = row.items[item];
      x.received = Math.min(pool, x.due);
      pool = cents(pool - x.received);
      x.owed = cents(x.due - x.received);
      x.declared = Math.min(declaredPool, x.due);
      declaredPool = cents(declaredPool - x.declared);
      x.belowMinimumOnPayroll = cents(Math.max(0, x.minimum - x.declared));
    }
    row.received = sum(ITEMS.map((item) => row.items[item].received));
    row.owed = sum(ITEMS.map((item) => row.items[item].owed));
    row.belowMinimumOnPayroll = sum(ITEMS.map((item) => row.items[item].belowMinimumOnPayroll));
    if (row.owed > 0) {
      row.deadline = isoOf(row.claimDeadlineDate);
      row.lapsed = row.deadline < today;
    }
  }

  const column = (field) => sum(rows.map((row) => row[field]));
  const itemTotals = Object.fromEntries(
    ITEMS.map((item) => [
      item,
      Object.fromEntries(
        Object.keys(zeroItem()).map((field) => [field, sum(rows.map((row) => row.items[item][field]))]),
      ),
    ]),
  );
  const totals = {
    due: column('due'),
    shortfall: column('shortfall'),
    received: column('received'),
    owed: column('owed'),
    belowMinimumOnPayroll: column('belowMinimumOnPayroll'),
    /** Owed in months whose claim has not lapsed. */
    claimable: sum(rows.filter((row) => !row.lapsed).map((row) => row.owed)),
    cash,
    /** Money beyond what every month was due. */
    unassigned: pool,
    items: itemTotals,
  };
  return { rows: rows.map(({ claimDeadlineDate, ...row }) => row), totals };
}
