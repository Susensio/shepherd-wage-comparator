/**
 * settle(): what the shepherd is owed, month by month, from the offer and the record of what happened (ADR-0032).
 * Amounts are gross, in cents, rounded as rows (`ledger.js`) so the «=» rows add up. No DOM here.
 */

import { LAW } from '../law.js';
import { cents, sum } from '../ledger.js';
import { daysInclusive, endOf, isoOf, parseDate } from '../offer.js';
import { calc } from './calc.js';
import { monthShares } from './payslips.js';
import { lastWorkedDay } from './record.js';
import { claimDeadline } from './time.js';

/**
 * @typedef {'work' | 'off' | 'sick'} DayKind a libranza and a vacation day are the same mark, «off»
 * @typedef {{ id: string, date: string, amount: number, via: 'payroll' | 'cash', note?: string }} Payment `amount` is net: what arrived, after withholdings on payroll, or as handed in cash. Only `payroll` is declared, on a payslip
 * @typedef {{ closed?: boolean, days?: Record<string, DayKind> }} RecordMonth `days` is keyed by the day of the month, «05»
 * @typedef {{ months?: Record<string, RecordMonth>, payments?: Payment[] }} OfferRecord months keyed «2026-06»
 * @typedef {{ agreed: number, minimum: number, due: number, shortfall: number, received: number, owed: number, declared: number, belowMinimumOnPayroll: number }} ItemRow
 * `agreed` is the pay of the offer, payroll and the agreed cash together (as the gross that would bring the cash net): the
 * minimum is compared with total pay, as `calc` does with `coveredByCash`; `row.agreedCash` says how much of it is cash.
 * `received` is every payment; `declared` is the part of it on payroll, and `belowMinimumOnPayroll` what the minimum
 * exceeds it by: cash covers `owed` but carry no Social Security.
 */

/** The items of a month, in the order a payment covers them: by convention, a payment names no item. */
export const ITEMS = /** @type {const} */ (['salary', 'overnight', 'vacation']);

const KINDS = ['work', 'off', 'sick'];
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
  const counts = { work: 0, off: 0, sick: 0 };
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
 * The months of a dated offer with no known end, from its start up to the month of `today`: the shares of `monthShares`,
 * but each already a share of one month's pay (`calc` counts a month when there is no duration) and the last month whole.
 */
function openEndedShares(terms, today) {
  if (!terms.start || terms.start > today) return [];
  const start = parseDate(terms.start);
  const now = parseDate(today);
  const shares = [];
  for (let y = start.getFullYear(), m = start.getMonth(); new Date(y, m, 1) <= now; m++) {
    const first = new Date(y, m, 1);
    const from = start > first ? start : first;
    const to = new Date(y, m + 1, 0);
    const days = Math.round((+to - +from) / 864e5) + 1;
    const share = from === start && start > first ? Math.min(LAW.payrollMonthDays, days) / LAW.payrollMonthDays : 1;
    shares.push({ month: first, from, to, days, share, weight: share });
  }
  return shares;
}

const monthFirst = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const monthLast = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const sameDay = (a, b) => +a === +b;

/** A share of a month as the payslips have it: a whole month is 1, a part is a day count over `LAW.payrollMonthDays`. */
function shareOf(from, to) {
  const days = daysInclusive(from, to);
  if (days <= 0) return { days: 0, share: 0 };
  const whole = sameDay(from, monthFirst(from)) && sameDay(to, monthLast(to));
  return { days, share: whole ? 1 : Math.min(LAW.payrollMonthDays, days) / LAW.payrollMonthDays };
}

/**
 * The months of the job as it really was, from the offer's and the record's days (ADR-0032). A month after the offer's
 * last one enters only if it holds a day worked, and the job then goes on to the last day worked, the months between
 * included; each day of that period is paid 1/30 of a month's pay. In a closed month the days libre before the first day
 * worked of the first month, or after the last one worked of the last, lie outside the job (the calendar cannot tell
 * libre because the contract ended from libre as the last rest); open months follow the offer.
 * `weight` is the pay's share of the contract, over the offer's own shares; `dayWeight` the same before trimming (a wage
 * per day does not change); `calendarFrom` and `calendarTo` the days the calendar shows.
 * @param {ReturnType<typeof monthShares>} base the offer's months
 * @param {Date} offerEnd
 * @param {OfferRecord | undefined} record
 */
function jobShares(base, offerEnd, record) {
  const baseTotal = base.reduce((t, x) => t + x.share, 0) || 1;
  const entryOf = (x) => record?.months?.[isoOf(x.month).slice(0, 7)];
  const workDays = (x) =>
    Object.entries(entryOf(x)?.days ?? {})
      .filter(([, kind]) => kind === 'work')
      .map(([day]) => Number(day))
      .sort((a, b) => a - b);
  let list = base.map((x) => ({ ...x, extension: false, calendarFrom: x.from, calendarTo: monthLast(x.month) }));
  // Extension: through the last day worked after the offer's end
  const lastWork = lastWorkedDay(record);
  if (list.length && lastWork > isoOf(offerEnd)) {
    const until = parseDate(lastWork);
    const tail = list.at(-1);
    const sameMonth = tail.month.getFullYear() === until.getFullYear() && tail.month.getMonth() === until.getMonth();
    tail.to = sameMonth ? until : monthLast(tail.month);
    for (let y = tail.month.getFullYear(), m = tail.month.getMonth() + 1; new Date(y, m, 1) <= until; m++) {
      const first = new Date(y, m, 1);
      const to =
        first.getFullYear() === until.getFullYear() && first.getMonth() === until.getMonth() ? until : monthLast(first);
      list.push({
        month: first,
        from: first,
        to,
        days: 0,
        share: 0,
        weight: 0,
        extension: true,
        calendarFrom: first,
        calendarTo: monthLast(first),
      });
    }
  }
  list = list.map((x) => ({ ...x, ...shareOf(x.from, x.to) }));
  const dayShare = list.map((x) => x.share);
  // Trimming, in closed months only
  const first = list[0];
  if (first && entryOf(first)?.closed) {
    const [day] = workDays(first);
    if (day)
      first.from = new Date(first.month.getFullYear(), first.month.getMonth(), Math.max(day, first.from.getDate()));
  }
  // An open month follows the offer, so the job still goes on in it; only closed months can end it
  const lastIndex = list.findLastIndex((x) => !entryOf(x)?.closed || workDays(x).length > 0);
  if (lastIndex >= 0) {
    list.forEach((x, i) => {
      if (!entryOf(x)?.closed) return;
      if (i > lastIndex) x.to = new Date(x.from.getFullYear(), x.from.getMonth(), x.from.getDate() - 1);
      else if (i === lastIndex)
        x.to = new Date(x.month.getFullYear(), x.month.getMonth(), Math.min(x.to.getDate(), workDays(x).at(-1)));
    });
  }
  return list.map((x, i) => {
    const trimmed = shareOf(x.from, x.to);
    return { ...x, ...trimmed, weight: trimmed.share / baseTotal, dayWeight: dayShare[i] / baseTotal };
  });
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
  const openEnded = !endOf(terms);
  const offerEnd = endOf(terms);
  const offerShares = openEnded ? [] : monthShares(terms);
  const whole = openEnded
    ? openEndedShares(terms, today).map((x) => ({
        ...x,
        dayWeight: x.weight,
        extension: false,
        calendarFrom: x.from,
        calendarTo: x.to,
      }))
    : jobShares(offerShares, /** @type {Date} */ (offerEnd), record);
  // The month in progress counts up to and including today: a wage per day from the days worked so far, a monthly or
  // total wage one thirtieth per elapsed day (the payslips' partial month), the vacation and the cash in proportion
  const now = parseDate(today);
  const shares = whole.map((x) => {
    const full = { ...x, fullTo: x.to, fullShare: x.share, fullWeight: x.weight };
    if (!(x.days > 0 && x.from <= now && now < x.to)) return full;
    const part = shareOf(x.from, now);
    const scale = x.share > 0 ? part.share / x.share : 0;
    return { ...full, to: now, ...part, weight: x.weight * scale, dayWeight: x.dayWeight * scale };
  });
  const labour = !r.selfEmployed; // labour law does not apply to an invoice (ADR-0029)
  const { time, pay, min } = r;
  // The wage as calculated: «solo el mínimo» turns it into a total
  const perDay = (terms.payrollMin ? 'total' : terms.payUnit) === 'day' && time.paidDays > 0;
  const totalPerDay = r.split?.unit === 'day' && time.daysWorked > 0;
  const dayRate = perDay ? pay.base / time.paidDays : 0;
  const vacationMinimum = terms.vacation === 'taken' && !r.noContract ? 0 : min.vacation; // as the ficha's debt
  // Vacation taken is paid and follows the offer, like the holidays; the vacation owed comes from the terms, not the days.
  const vacationTaken = time.vacationTaken;
  const holidaysOff = terms.holidays === 'yes' ? (LAW.holidaysPerYear * time.months) / 12 : 0;

  // Cash as gross, as `calc` credits it: its bisection (`r.cash.grossEq`) shared out over the cash, since the tax is
  // progressive; without a contract, through the net factor, as `calc` does for the debt.
  const cashRatio = r.noContract || !(r.cash.total > 0) ? 1 / r.netFactor : r.cash.grossEq / r.cash.total;
  const offerDays = offerShares.reduce((t, x) => t + x.days, 0);
  const workPattern = offerDays > 0 ? time.daysWorked / offerDays : 0;
  const plans = shares.map((share) => {
    const key = isoOf(share.month).slice(0, 7);
    const entry = record?.months?.[key];
    const closed = Boolean(entry?.closed);
    const { counts, touched } = factsOf(entry, share.from, share.to);
    // The part of the month that still follows the offer: none once closed
    // (an extension month has no offer to follow: its days default to libre)
    const open = closed || share.extension || share.days <= 0 ? 0 : (share.days - touched) / share.days;
    const w = share.weight;
    const wDay = share.dayWeight;
    // The days still following the offer are worked as the offer's pattern says: its days worked over its calendar days,
    // so a month of 28 days has 28 days' worth, as the calendar shows (the average month of an offer without an end
    // keeps the share)
    const followed = openEnded
      ? open * time.daysWorked * w
      : (share.days - touched) * (closed || share.extension || share.days <= 0 ? 0 : workPattern);
    const worked = counts.work + followed;
    // Paid days (docs/model.md): worked, plus vacation taken, plus holidays, which follow the offer even in a closed
    // month. TODO: a holiday worked is counted twice, and sick days are not paid; unblocked by the owner's answer on
    // how a real month pays them.
    const paid = worked + (vacationTaken + holidaysOff) * time.workFrac * wDay;

    // The agreed cash of the month, net as handed: per day worked it follows the days (the facts of a closed month
    // included), else it is the month's share like the pay
    const cash =
      r.cash.unit === 'day' && time.daysWorked > 0 ? (r.cash.total / time.daysWorked) * worked : r.cash.total * w;
    // The payroll pay, plus the cash as the gross that would bring it net (what `calc` credits): without a contract the
    // pay is only that. Both go to the one pool that covers the minimum salary first, then the overnight bonus.
    // A net total agreed per day is that much for each day worked, payroll and cash together: the payroll follows the
    // days worked alone (the vacation taken is inside the total), so the total scales with them
    const payroll = r.noContract
      ? 0
      : totalPerDay
        ? (pay.base / time.daysWorked) * worked + pay.extraPays * w
        : perDay
          ? dayRate * paid + pay.extraPays * w
          : pay.salary * w;
    const cashGross = cash * cashRatio;
    const wage = payroll + cashGross;
    const casual = min.casual && time.daysWorked > 0;
    const minimumSalary = casual ? (min.salary * worked) / time.daysWorked : min.salary * w;
    return { share, key, closed, counts, open, worked, wage, payroll, cash, cashGross, minimumSalary };
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
  const payrollRows = spread(plans.map((x) => (labour ? x.payroll : 0)));
  const cashRows = spread(plans.map((x) => (labour ? x.cash : 0)));
  const cashGrossRows = spread(plans.map((x) => (labour ? x.cashGross : 0)));
  const salaryMinRows = spread(plans.map((x) => (labour ? x.minimumSalary : 0)));
  const overnightMinRows = spread(plans.map((x) => (labour ? min.overnightRate * x.minimumSalary : 0)));

  // Known end: the vacation falls due with the final settlement. No end: it accrues month by month.
  // A net total agreed per day with the vacation inside it is that much for each day worked, the vacation too: it
  // accrues, and its minimum with it, in each month with the days worked there (it reads the agreed amount per day)
  const vacationByDays = totalPerDay && Boolean(r.split?.included);
  const vacationShareOf = (index) =>
    vacationByDays
      ? plans[index].worked / (time.daysWorked || 1)
      : openEnded
        ? plans[index].share.weight
        : index === shares.length - 1
          ? shares.reduce((t, x) => t + x.fullWeight, 0)
          : 0;
  const vacationAgreedOf = (index) => (labour ? cents(pay.vacationPay * vacationShareOf(index)) : 0);
  const vacationMinimumOf = (index) => (labour ? cents(vacationMinimum * vacationShareOf(index)) : 0);
  // Cash above what the month's minimum salary and bonus need covers a vacation shortfall, as in `calc`: that much of the
  // cash moves from the salary to the vacation, so the vacation is covered and the total due is the pay agreed
  // (not without a contract: `calc` owes the whole vacation whatever the cash)
  const spare = plans.map((_, i) =>
    labour && !r.noContract
      ? Math.max(0, cents(wageRows[i] - Math.max(salaryMinRows[i] + overnightMinRows[i], payrollRows[i])))
      : 0,
  );
  const last = plans.length - 1;
  const shortOf = (i) => Math.max(0, cents(vacationMinimumOf(i) - vacationAgreedOf(i)));
  const moveIn = plans.map((_, i) =>
    openEnded ? Math.min(spare[i], shortOf(i)) : i === last ? Math.min(sum(spare), shortOf(i)) : 0,
  );
  const spareTotal = sum(spare);
  const moveOut = openEnded
    ? moveIn
    : spread(spare.map((x) => (spareTotal > 0 ? (x * (moveIn[last] ?? 0)) / spareTotal : 0)));

  const rows = plans.map(({ share, key, closed, counts, open, worked }, index) => {
    // The agreed pay covers the minimum salary first, then the overnight bonus
    const overnightCovered = Math.min(
      overnightMinRows[index],
      Math.max(0, cents(wageRows[index] - salaryMinRows[index])),
    );
    const agreed = {
      salary: cents(wageRows[index] - overnightCovered - moveOut[index]),
      overnight: overnightCovered,
      vacation: cents(vacationAgreedOf(index) + moveIn[index]),
    };
    const minimum = {
      salary: salaryMinRows[index],
      overnight: overnightMinRows[index],
      vacation: vacationMinimumOf(index),
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
    const dueDate = share.days > 0 ? share.fullTo : share.calendarTo;
    return {
      month: key,
      closed,
      estimate: !closed,
      from: isoOf(share.from),
      to: isoOf(share.days > 0 ? share.to : share.calendarTo),
      /** The share of a month counted so far, and whole: they differ only for the month in progress. */
      share: share.share,
      fullShare: share.fullShare,
      /** Days of the month inside the job: 0 for a closed month outside it. */
      days: share.days,
      /** The first and last day of the month that belong to the job, the month in progress counted whole. */
      jobFrom: isoOf(share.from),
      jobTo: isoOf(share.fullTo),
      /** The days the calendar shows, whatever the job's own span: the offer's month, or the whole month after it. */
      calendarFrom: isoOf(share.calendarFrom),
      calendarTo: isoOf(share.calendarTo),
      /** A month after the offer's last one, in the job because a day was worked in it or after it. */
      extension: share.extension,
      /** Days of the record, by kind, and the share of the month still following the offer. */
      facts: { ...counts, followingOffer: open },
      /** The cash agreed for the month, net as handed: part of the pay in `items`, shown apart. */
      agreedCash: cashRows[index],
      /** The same cash as the gross that brings it net, as it counts in `items`. */
      agreedCashGross: cashGrossRows[index],
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
  // What arrived is net; it is grossed up as `calc` credits cash, so it compares with the gross dues.
  const payments = [...(record?.payments || [])].sort((a, b) => a.date.localeCompare(b.date));
  // Cash as agreed is grossed up the way the agreement was, so paying it exactly leaves nothing owed
  const grossOf = (list) => sum(list.map((p) => cents(p.amount * (p.via === 'cash' ? cashRatio : 1 / r.netFactor))));
  const cash = sum(payments.filter((p) => p.via === 'cash').map((p) => p.amount));
  let pool = grossOf(payments);
  let declaredPool = grossOf(payments.filter((p) => p.via === 'payroll'));
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
    /** Cash agreed over the whole job, net as handed (inside the agreed pay of the items). */
    agreedCash: column('agreedCash'),
    agreedCashGross: column('agreedCashGross'),
    /** Owed in months whose claim has not lapsed. */
    claimable: sum(rows.filter((row) => !row.lapsed).map((row) => row.owed)),
    /** Cash handed over, net as recorded: the «en negro» money. */
    cash,
    /** Gross equivalent of the money beyond what every month was due. */
    unassigned: pool,
    items: itemTotals,
  };
  // The period the work really had, from the days: the offer's, unless days were marked beyond or short of it
  const live = shares.filter((x) => x.days > 0);
  const job = {
    from: live.length ? isoOf(live[0].from) : terms.start || '',
    to: openEnded || !live.length ? '' : isoOf(live[live.length - 1].fullTo),
    offerFrom: terms.start || '',
    offerTo: offerEnd ? isoOf(offerEnd) : '',
  };
  return {
    rows: rows.map(({ claimDeadlineDate, ...row }) => row),
    totals,
    /** The vacation accrues with the days worked (a net total agreed per day, vacation inside it). */
    vacationByDays,
    job: { ...job, differs: !openEnded && (job.from !== job.offerFrom || job.to !== job.offerTo) },
  };
}
