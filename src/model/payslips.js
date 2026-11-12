/** Estimated payslips, month by month, for a dated season. */

import { LAW } from '../law.js';
import { daysInclusive, endOf, parseDate } from '../offer.js';

/**
 * The calendar months of a dated season: the first day of the month, the offer's first and last day in it, its days
 * there and its `share` of the pay (partial months by days at 1/30), plus `weight`, the share scaled so the weights add
 * up to 1. [] without a start or a known end.
 * @param {object} terms the offer's terms
 */
export function monthShares(terms) {
  const end = endOf(terms);
  if (!terms.start || !end) return [];
  const start = parseDate(terms.start);
  const months = [];
  for (let y = start.getFullYear(), m = start.getMonth(); new Date(y, m, 1) <= end; m++) {
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const from = Math.max(+start, +first);
    const to = Math.min(+end, +last);
    const days = daysInclusive(from, to);
    const whole = from === +first && to === +last;
    months.push({
      month: first,
      from: new Date(from),
      to: new Date(to),
      days,
      share: whole ? 1 : Math.min(LAW.payrollMonthDays, days) / LAW.payrollMonthDays,
    });
  }
  const shares = months.reduce((sum, x) => sum + x.share, 0) || 1;
  return months.map((x) => ({ ...x, weight: x.share / shares }));
}

/**
 * Each calendar month gets its share of the salary (partial months by days at 1/30, adjusted so the sum is the
 * contract's); the vacation not taken and the severance go in the last one, the final settlement.
 * Contributions at the law's rates (law.js).
 */
export function monthlyPayslips(terms, r) {
  if (r.pay.gross <= 0) return [];
  const months = monthShares(terms);
  const scale = r.time.months / (months.reduce((sum, x) => sum + x.share, 0) || 1);
  const lastIdx = months.length - 1;
  const ss = r.pay.rates.workerPct / 100;
  const employer = r.pay.rates.employerPct / 100;
  return months.map((x, i) => {
    const salary = (r.pay.salary * x.share * scale) / r.time.months;
    const vacation = r.pay.vacationPay > 0 && i === lastIdx ? r.pay.vacationPay : 0;
    const gross = salary + vacation;
    const severance = i === lastIdx ? r.employer.severance : 0;
    const contrib = gross * ss;
    const irpf = gross * r.pay.irpfPct;
    return {
      month: x.month,
      days: x.days,
      share: x.share,
      salary,
      vacation,
      gross,
      contrib,
      irpf,
      severance,
      net: gross - contrib - irpf + severance,
      employer: gross * employer,
    };
  });
}
