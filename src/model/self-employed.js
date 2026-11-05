/**
 * Self-employed (autónomo): what reaches the shepherd from an invoice, after IVA (if the agreed amount had it inside),
 * the RETA quota and IRPF by módulos. Figures and sources in `LAW.selfEmployed` (ADR-0029).
 */

import { num } from '../format.js';
import { LAW, ssOf } from '../law.js';
import { irpfWithActivity } from './tax.js';

/** The tramo's minimum base for a net income per month (Orden PJC/297/2026 art. 18.1). */
export function retaBase(netPerMonth) {
  const tramo = LAW.selfEmployed.tramos.find(([upTo]) => netPerMonth <= upTo);
  return (tramo ?? LAW.selfEmployed.tramos.at(-1))[1];
}

/** RETA, % of the base: every item together (31,50 % in 2026). */
export const retaPct = () => LAW.selfEmployed.rates.reduce((sum, [, pct]) => sum + pct, 0);

/**
 * @param {object} terms the offer's terms: `payAmount` per `payUnit` is what is invoiced, with IVA inside if `vatIncluded`
 * @param {{ months: number, daysWorked: number, noDuration: boolean }} time
 * @param {{ cfg: object, irpfShares: {share: number, others: number, deduction: object | null}[] }} ctx
 */
export function selfEmployed(terms, time, { cfg, irpfShares }) {
  const se = LAW.selfEmployed;
  const amount = num(terms.payAmount);
  const { months, daysWorked, noDuration } = time;
  // Per day: each day worked is invoiced; «en total» without a duration is a month, like the rest of the page
  const agreed = terms.payUnit === 'day' ? amount * daysWorked : terms.payUnit === 'month' ? amount * months : amount;
  const vat = terms.vatIncluded ? agreed - agreed / (1 + se.vatPct / 100) : 0;
  const invoiced = agreed - vat;
  // Módulos: «rendimiento neto previo» (no amortisations, so also «minorado»), then the year's 5 % reduction
  const netPrevious = invoiced * se.moduleIndex;
  const activityNet = netPrevious * (1 - se.moduleReductionPct / 100);
  // RETA: the tramo of what the activity gives a month, less 7 % generic expenses, over the months registered
  const registered = noDuration ? 1 : months;
  const netForTramo = registered > 0 ? (netPrevious * (1 - se.genericExpensesPct / 100)) / registered : 0;
  const base = retaBase(netForTramo);
  const quota = (base * retaPct() * registered) / 100;
  // IRPF of the year, on top of what other offers pay on a payslip (their workers' Social Security, a temporary's)
  const irpf = irpfWithActivity(activityNet, cfg, irpfShares, ssOf('temporary').workerPct);
  return {
    agreed,
    vat,
    invoiced,
    netPrevious,
    activityNet,
    netForTramo,
    base,
    quota,
    irpf,
    withheld: (invoiced * se.withholdingPct) / 100,
    net: invoiced - quota - irpf,
  };
}
