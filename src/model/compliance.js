/**
 * Whether the law was kept, from what the record holds and not from what the offer promised (ADR-0032), judging facts
 * only: the facts of the terms (no contract, cash agreed) need no month closed; the weekly rest and the days worked above
 * those due, and the public holidays worked, look at CLOSED months alone (the periods wholly inside them). The overnight bonus and the minimum on payroll
 * are judged only once the shepherd has closed the record (`record.complete`: every cobro is recorded) with every month
 * closed: until then not every cobro is known. Only the model's own definitions and `law.js` figures. What the record cannot support is said, not guessed.
 * No DOM.
 */

import { holidaysOf, holidayWorkOf, LAW } from '../law.js';
import { cents, sum } from '../ledger.js';
import { marksOf } from './record.js';
import { ITEMS } from './settle.js';

/**
 * @param {{ terms: object }} offer
 * @param {import('./settle.js').OfferRecord} record
 * @param {ReturnType<typeof import('./settle.js').settle>} settled
 * @param {{ noContract?: boolean, cash?: { total: number }, extra: { due: number }, min: { overnight: number, overnightAgreement: { pct: number } | null }, netFactor: number, pay: { irpfPct: number } }} r the offer's figures
 * @param {import('./settle.js').Payment[]} payments
 */
export function lawFromRecord(offer, record, settled, r, payments) {
  const inJob = settled.rows.filter((row) => row.days > 0);
  const closed = inJob.filter((row) => row.closed);
  const days = inJob.flatMap((row) =>
    marksOf(offer, record, { key: row.month, from: row.from, to: row.to }).map((mark) => ({
      ...mark,
      closed: row.closed,
    })),
  );
  const allClosed = inJob.length > 0 && closed.length === inJob.length;
  const payroll = sum(payments.filter((p) => p.via === 'payroll').map((p) => p.amount));

  // Rest (ET 37.1, RD 1561/1995 art. 5.3): a full day off each week, or two per 14 days; only the half day accumulates,
  // over LAW.restPeriodWeeks weeks, so LAW.weeklyRest a week on average over the period. Only the periods wholly inside
  // closed months are judged
  const length = LAW.restPeriodWeeks * 7;
  /** @type {{ from: string, to: string, off: number, due: number, weekly: boolean }[]} `weekly`: short of full days, whatever the total */
  const fails = [];
  let periods = 0;
  const offIn = (part) => part.filter((x) => x.kind === 'off').length;
  for (let i = 0; i < days.length; i += length) {
    const part = days.slice(i, i + length);
    // (a last period shorter than the weeks it groups over says nothing: a day and a half a week cannot be told from a day)
    if (part.length < length || !part.every((x) => x.closed)) continue;
    const off = offIn(part);
    const due = Math.ceil((LAW.weeklyRest * part.length) / 7);
    // each 14 days: a day off in each of its weeks, or two days in all
    let fullDays = true;
    for (let k = 0; k < part.length; k += 14) {
      const window = part.slice(k, k + 14);
      const weeks = [window.slice(0, 7), window.slice(7)].filter((w) => w.length);
      if (!weeks.every((w) => offIn(w) >= 1) && offIn(window) < 2) fullDays = false;
    }
    periods++;
    if (off < due || !fullDays) fails.push({ from: part[0].date, to: part.at(-1).date, off, due, weekly: !fullDays });
  }

  // Days worked against those due once rest, holidays and vacation taken are off (the model's `extra.due`, over the
  // whole job), in the share of the job that is closed
  const jobDays = sum(inJob.map((row) => row.days));
  const closedDays = sum(closed.map((row) => row.days));
  const worked = days.filter((x) => x.closed && x.kind === 'work').length;
  const due = jobDays > 0 ? (r.extra.due * closedDays) / jobDays : 0;

  // Public holidays worked in closed months: judged only where every closed month's year has verified data for the
  // place (otherwise the count would be partial and silent about it). `local`: the municipality's two local days are in.
  const places = [...new Set(closed.map((row) => Number(row.month.slice(0, 4))))].map((year) =>
    holidaysOf({ municipality: offer.terms.municipality, province: offer.terms.province, year }),
  );
  const holidays = {
    known: closed.length > 0 && places.every((place) => place.known),
    local: places.every((place) => place.local),
    worked: days
      .filter((x) => x.closed && x.kind === 'work' && x.holiday)
      .map((x) => ({ date: x.date, name: x.holiday })),
    agreement: holidayWorkOf(offer.terms.province),
  };

  // The overnight bonus and the minimum, once every month is closed and the shepherd said every cobro is recorded
  const known = allClosed && Boolean(record.complete);
  const overnight = settled.totals.items.overnight;
  // The minimum on payroll, in net: what arrived on payroll against the net equivalent of the minimum (the gross
  // minimum times the net factor). Real withholdings differ from the simulated ones, so it fails only beyond one more
  // simulated IRPF's worth of the minimum.
  // (the pay's minimum: the severance at the end of a temporary contract is not part of the monthly pay)
  const minimumGross = sum(
    ITEMS.filter((item) => item !== 'severance').map((item) => settled.totals.items[item].minimum),
  );
  const minimumNet = cents(minimumGross * r.netFactor);
  const floor = cents(minimumGross * Math.max(0, r.netFactor - r.pay.irpfPct));
  // Facts of the terms, known before any month is closed: no contract means no alta in Social Security, and cash
  // agreed is pay off the payslip (the whole pay, without a contract, so it is said once)
  const facts = [
    ...(r.noContract ? [{ id: /** @type {const} */ ('noContract') }] : []),
    ...(!r.noContract && (r.cash?.total ?? 0) >= 1
      ? [{ id: /** @type {const} */ ('cash'), amount: settled.totals.agreedCash }]
      : []),
  ];
  return {
    facts,
    months: { closed: closed.length, total: inJob.length },
    allClosed,
    rest: { periods, fails },
    days: { worked, due, extra: Math.max(0, worked - due) },
    holidays,
    overnight: {
      applicable: r.min.overnight > 0,
      pct: r.min.overnightAgreement?.pct ?? 0,
      known,
      /** What the bonus comes to, and what of it was not covered, in net. */
      due: cents(overnight.due * r.netFactor),
      missing: cents(overnight.owed * r.netFactor),
    },
    // Without a contract there is no payroll: the facts say it, and the minimum on payroll does not apply
    minimum: { known, applicable: !r.noContract, minimumNet, payroll, short: cents(Math.max(0, floor - payroll)) },
  };
}
