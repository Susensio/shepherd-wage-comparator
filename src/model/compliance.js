/**
 * Whether the law was kept, from what the record holds and not from what the offer promised (ADR-0032), judging facts
 * only: the weekly rest and the days worked above those due look at CLOSED months alone (the periods wholly inside
 * them); the overnight bonus and the minimum on payroll are judged only once every month is closed and a payroll cobro
 * exists. Only the model's own definitions and `law.js` figures. What the record cannot support is said, not guessed.
 * No DOM.
 */

import { LAW } from '../law.js';
import { cents, sum } from '../ledger.js';
import { marksOf } from './record.js';
import { ITEMS } from './settle.js';

/**
 * @param {{ terms: object }} offer
 * @param {import('./settle.js').OfferRecord} record
 * @param {ReturnType<typeof import('./settle.js').settle>} settled
 * @param {{ extra: { due: number }, min: { overnight: number }, netFactor: number, pay: { irpfPct: number } }} r the offer's figures
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

  // Rest: at least LAW.weeklyRest days a week, which can be grouped over LAW.restPeriodWeeks weeks; only the periods
  // that lie wholly inside closed months are judged
  const length = LAW.restPeriodWeeks * 7;
  /** @type {{ from: string, to: string, off: number, due: number }[]} */
  const fails = [];
  let periods = 0;
  for (let i = 0; i < days.length; i += length) {
    const part = days.slice(i, i + length);
    // (a last period shorter than the weeks it groups over says nothing: a day and a half a week cannot be told from a day)
    if (part.length < length || !part.every((x) => x.closed)) continue;
    const off = part.filter((x) => x.kind === 'off').length;
    const due = Math.ceil((LAW.weeklyRest * part.length) / 7);
    periods++;
    if (off < due) fails.push({ from: part[0].date, to: part.at(-1).date, off, due });
  }

  // Days worked against those due once rest, holidays and vacation taken are off (the model's `extra.due`, over the
  // whole job), in the share of the job that is closed
  const jobDays = sum(inJob.map((row) => row.days));
  const closedDays = sum(closed.map((row) => row.days));
  const worked = days.filter((x) => x.closed && x.kind === 'work').length;
  const due = jobDays > 0 ? (r.extra.due * closedDays) / jobDays : 0;

  // The overnight bonus and the minimum, once everything is closed and some payroll was cobrado
  const known = allClosed && payroll > 0;
  const overnight = settled.totals.items.overnight;
  // The minimum on payroll, in net: what arrived on payroll against the net equivalent of the minimum (the gross
  // minimum times the net factor). Real withholdings differ from the simulated ones, so it fails only beyond one more
  // simulated IRPF's worth of the minimum.
  const minimumGross = sum(ITEMS.map((item) => settled.totals.items[item].minimum));
  const minimumNet = cents(minimumGross * r.netFactor);
  const floor = cents(minimumGross * Math.max(0, r.netFactor - r.pay.irpfPct));
  return {
    months: { closed: closed.length, total: inJob.length },
    allClosed,
    rest: { periods, fails },
    days: { worked, due, extra: Math.max(0, worked - due) },
    overnight: {
      applicable: r.min.overnight > 0,
      known,
      /** What the bonus comes to, and what of it was not covered, in net. */
      due: cents(overnight.due * r.netFactor),
      missing: cents(overnight.owed * r.netFactor),
    },
    minimum: { known, minimumNet, payroll, short: cents(Math.max(0, floor - payroll)) },
  };
}
