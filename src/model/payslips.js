/** Estimated payslips, month by month, for a dated season. */

import { endOf, parseDate } from '../offer.js';

/**
 * Each calendar month gets its share of the salary (partial months by days at 1/30, adjusted so the sum is the
 * contract's); the vacation not taken and the severance go in the last one, the final settlement.
 * Contributions at the settings' rates.
 */
export function monthlyPayslips(o, r, cfg) {
  const end = endOf(o);
  if (!o.start || !end || r.pay.gross <= 0) return [];
  const start = parseDate(o.start);
  const months = [];
  for (let y = start.getFullYear(), m = start.getMonth(); new Date(y, m, 1) <= end; m++) {
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const from = Math.max(+start, +first);
    const to = Math.min(+end, +last);
    const days = Math.round((to - from) / 864e5) + 1;
    const whole = from === +first && to === +last;
    months.push({ month: first, days, share: whole ? 1 : Math.min(30, days) / 30 });
  }
  const shares = months.reduce((sum, x) => sum + x.share, 0) || 1;
  const scale = r.time.months / shares;
  const lastIdx = months.length - 1;
  const ss = cfg.ssPct / 100;
  const employer = cfg.ssEmp / 100;
  return months.map((x, i) => {
    const salary = (r.pay.salary * x.share * scale) / r.time.months;
    const vacation = r.pay.vacationPay > 0 && i === lastIdx ? r.pay.vacationPay : 0;
    const gross = salary + vacation;
    const severance = i === lastIdx ? r.employer.severance : 0;
    const contrib = gross * ss;
    const irpf = gross * r.pay.irpfPct;
    return {
      ...x,
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
