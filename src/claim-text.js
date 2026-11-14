/**
 * The texts of the claim ladder (ADR-0034), each from what `settle` and `standingOf` say, so the amounts equal the
 * screens': «Resumen para el ganadero» (net, conversational, no citations), «Petición de pago» (gross, dated),
 * «Hechos para la Inspección» (facts only) and the fields of the papeleta de conciliación. Impersonal, like the other
 * texts; short enough for a phone and for a message. No DOM.
 */

import { capitalize, fDate, fE, joinAnd } from './format.js';
import { fSumE, spreadTo } from './ledger.js';
import { spanOf } from './model/accounts.js';
import { marksOf } from './model/record.js';
import { ITEMS } from './model/settle.js';
import { isoOf, parseDate } from './offer.js';
import { ITEM_TEXT, monthName, monthYear, summaries } from './text.js';

/** @typedef {{ employerName: string, employerId?: string, workerName?: string }} Parties */

/** «5 jun 2026» from an ISO date. */
const fIso = (iso) => fDate(parseDate(iso));
const jobName = (o) => o.mine.name || 'sin nombre';
const WAY = { payroll: 'en nómina', cash: 'en mano' };

/**
 * When the job really ran, from `settle`: the offer's dates unless the end said or the days marked make it otherwise.
 * «21 jun – 18 sept 2026»; «desde el 21 jun 2026» without an end.
 * @param {{ from: string, to: string }} job `settled.job`
 */
export function jobDates(job) {
  if (!job.from) return '';
  if (!job.to) return `desde el ${fIso(job.from)}`;
  const from = parseDate(job.from);
  const sameYear = from.getFullYear() === parseDate(job.to).getFullYear();
  return `${fDate(from, !sameYear)} – ${fIso(job.to)}`;
}

/** ISO date `days` after `iso`. */
export function daysAfter(iso, days) {
  const date = parseDate(iso);
  date.setDate(date.getDate() + days);
  return isoOf(date);
}

/** The pay-by date a request starts with: a fortnight on. */
export const defaultPayBy = (today) => daysAfter(today, 15);

/**
 * What is still owed, by month and item, in net, adding up to Falta (`standing.falta`) as the tiles show it.
 * @param {ReturnType<typeof import('./model/settle.js').settle>} settled
 * @param {number} falta `standing.falta`
 * @param {number} netFactor
 * @param {number} [unit] 1 for whole euros, as the tiles show them; cents by default
 * @returns {{ month: string, total: number, items: { item: 'salary' | 'overnight' | 'vacation', amount: number }[] }[]}
 */
export function owedNet(settled, falta, netFactor, unit = 0.01) {
  const rows = settled.rows.filter((row) => row.owed > 0);
  const months = spreadTo(
    rows.map((row) => row.owed * netFactor),
    falta,
    unit,
  );
  return rows.map((row, i) => {
    const owing = ITEMS.filter((item) => row.items[item].owed > 0);
    const amounts = spreadTo(
      owing.map((item) => row.items[item].owed),
      months[i],
      unit,
    );
    return { month: row.month, total: months[i], items: owing.map((item, j) => ({ item, amount: amounts[j] })) };
  });
}

const itemsText = (items, show = fSumE) =>
  items.map((x) => `${ITEM_TEXT[x.item].toLowerCase()} ${show(x.amount)}`).join(', ');

/** The days worked in each month as the calendar has them, and whether the month is closed. */
function jornadasOf(o, settled, record) {
  return settled.rows
    .filter((row) => row.days > 0)
    .map((row) => ({
      month: row.month,
      closed: row.closed,
      worked: marksOf(o, record, spanOf(row), { from: row.jobFrom, to: row.jobTo }).filter(
        (m) => !m.outside && m.kind === 'work',
      ).length,
    }));
}

/** The cobros, oldest first, one line each. */
const cobrosLines = (payments) =>
  [...payments]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => `· ${fIso(p.date)}: ${fSumE(p.amount)} ${WAY[p.via]}${p.note ? ` (${p.note})` : ''}`);

/**
 * «Resumen para el ganadero»: what the job came to and what is still missing, in net, by month and item, for talking
 * to the ganadero; it ends asking when it can be paid. No citations.
 * @param {object} c
 * @param {any} c.o
 * @param {any} c.r the offer's figures
 * @param {ReturnType<typeof import('./model/settle.js').settle>} c.settled
 * @param {ReturnType<typeof import('./model/accounts.js').standingOf>} c.standing
 * @param {import('./model/settle.js').OfferRecord} c.record
 * @param {Parties} c.parties
 */
export function employerSummaryText({ o, r, settled, standing, record, parties }) {
  const lines = summaries(o, r);
  const when = jobDates(settled.job);
  const to = parties.employerName ? `Hola, ${parties.employerName}.` : 'Hola.';
  const out = [to, `Se han repasado las cuentas del trabajo de ${jobName(o)}${when ? ` (${when})` : ''}.`, ''];
  out.push(`Pactado: ${lines.pay}.`);
  out.push(
    `Jornadas: ${jornadasOf(o, settled, record)
      .map((j) => `${monthName(j.month)} ${j.worked}${j.closed ? '' : ' (estimadas)'}`)
      .join(', ')}.`,
  );
  out.push('');
  // Whole euros, as the tiles show them; the months are spread so they add up to the Falta shown
  const whole = (x) => fE(x, 0);
  const falta = Math.round(standing.falta);
  out.push(`Corresponde: ${whole(standing.corresponde)} netos.`);
  const payments = record.payments ?? [];
  if (payments.length) {
    out.push(`Cobrado: ${whole(standing.cobrado)} netos.`, ...cobrosLines(payments));
  } else out.push('Cobrado: nada hasta ahora.');
  out.push('', `Falta: ${whole(falta)} netos.`);
  for (const m of owedNet(settled, falta, r.netFactor, 1))
    out.push(`· ${capitalize(monthName(m.month))}: ${whole(m.total)} (${itemsText(m.items, whole)})`);
  if (standing.unclosed.length)
    out.push(
      '',
      `${capitalize(joinAnd(standing.unclosed.map((row) => monthName(row.month))))}: calculado según lo pactado, sin cerrar.`,
    );
  out.push('', '¿Cuándo se puede pagar?');
  return out.join('\n');
}

/**
 * «Petición de pago»: a dated written request in gross, as the claim is, with a date to pay by. Polite; it does not say
 * that it stops any deadline.
 * @param {object} c
 * @param {any} c.o
 * @param {ReturnType<typeof import('./model/settle.js').settle>} c.settled
 * @param {import('./model/settle.js').OfferRecord} c.record
 * @param {Parties} c.parties
 * @param {string} c.today ISO date
 * @param {string} c.payBy ISO date
 */
export function paymentRequestText({ o, settled, record, parties, today, payBy }) {
  const { rows, totals } = settled;
  const when = jobDates(settled.job);
  const out = [`Fecha: ${fIso(today)}`];
  if (parties.employerName)
    out.push(`A: ${parties.employerName}${parties.employerId ? ` (${parties.employerId})` : ''}`);
  if (parties.workerName) out.push(`De: ${parties.workerName}`);
  out.push(
    '',
    `Asunto: petición de pago del trabajo de pastor en ${jobName(o)}${when ? ` (${when})` : ''}`,
    '',
    'Buenos días:',
    '',
    // One unit: what is owed, in gross as a payslip says it. What arrived is in the accounts already, with no figure
    'Revisadas las cuentas del trabajo, queda por pagar, en bruto:',
  );
  for (const row of rows.filter((x) => x.owed > 0)) {
    const parts = ITEMS.filter((item) => row.items[item].owed > 0).map(
      (item) => `${ITEM_TEXT[item].toLowerCase()} ${fSumE(row.items[item].owed)}`,
    );
    out.push(`· ${capitalize(monthYear(row.month))}: ${parts.join(', ')}`);
  }
  out.push(
    `Total pendiente: ${fSumE(totals.owed)} brutos.${record.payments?.length ? ' Lo ya cobrado está descontado.' : ''}`,
    '',
    `Se pide que se pague antes del ${fIso(payBy)}. Si hay alguna diferencia con estas cuentas, se pueden revisar.`,
    '',
    'Gracias.',
  );
  if (parties.workerName) out.push(parties.workerName);
  return out.join('\n');
}

/**
 * «Hechos para la Inspección»: facts only, no amounts claimed and no legal conclusion: the job, the days, the cobros and how
 * it ended.
 * @param {object} c
 * @param {any} c.o
 * @param {any} c.r the offer's figures
 * @param {ReturnType<typeof import('./model/settle.js').settle>} c.settled
 * @param {import('./model/settle.js').OfferRecord} c.record
 * @param {Parties} c.parties
 */
export function inspectionText({ o, r, settled, record, parties }) {
  const when = jobDates(settled.job);
  const out = [`Hechos del trabajo de pastor en ${jobName(o)}${when ? ` (${when})` : ''}.`];
  if (parties.employerName)
    out.push(`Ganadero: ${parties.employerName}${parties.employerId ? ` (${parties.employerId})` : ''}.`);
  if (r.noContract) out.push('No hubo contrato ni alta en la Seguridad Social.');
  else if ((r.cash?.total ?? 0) >= 1) out.push('Una parte del pago se pactó en negro.');
  out.push(
    `Jornadas por mes: ${jornadasOf(o, settled, record)
      .map((j) => `${monthName(j.month)} ${j.worked}${j.closed ? '' : ' (según lo pactado, mes sin cerrar)'}`)
      .join(', ')}.`,
  );
  const payments = record.payments ?? [];
  if (payments.length) out.push('Cobros recibidos:', ...cobrosLines(payments));
  else if (record.nothingPaid) out.push('No se ha cobrado nada.');
  if (record.end) {
    const how = {
      agreed: 'al final pactado',
      dismissed: 'despedido por el ganadero',
      quit: 'por decisión del pastor',
      sick: 'por baja médica o accidente',
    };
    out.push(`El trabajo acabó el ${fIso(record.end.date)}, ${how[record.end.how]}.`);
  }
  for (const note of record.evidence ?? []) out.push(`Apunte del ${fIso(note.date)}: ${note.text}`);
  return out.join('\n');
}

/**
 * The fields of the papeleta de conciliación, prefilled from the record, each to copy: `{ id, label, value }`.
 * @param {object} c
 * @param {any} c.o
 * @param {ReturnType<typeof import('./model/settle.js').settle>} c.settled
 * @param {import('./model/settle.js').OfferRecord} c.record
 * @param {Parties} c.parties
 */
export function conciliationFields({ o, settled, record, parties }) {
  const { rows, totals, job } = settled;
  const owing = rows.filter((row) => row.owed > 0);
  const how = record.end?.how === 'dismissed' ? `Despedido el ${fIso(record.end.date)}. ` : '';
  const concept = owing
    .map(
      (row) =>
        `${monthYear(row.month)}: ${ITEMS.filter((i) => row.items[i].owed > 0)
          .map((i) => `${ITEM_TEXT[i].toLowerCase()} ${fSumE(row.items[i].owed)}`)
          .join(', ')}`,
    )
    .join('; ');
  return [
    { id: 'worker', label: 'Solicitante (pastor)', value: parties.workerName ?? '' },
    { id: 'employer', label: 'Demandado (ganadero)', value: parties.employerName },
    { id: 'employerId', label: 'NIF o CIF del ganadero', value: parties.employerId ?? '' },
    { id: 'job', label: 'Trabajo', value: `Pastor en ${jobName(o)}` },
    {
      id: 'period',
      label: 'Periodo trabajado',
      value: job.from ? `del ${fIso(job.from)}${job.to ? ` al ${fIso(job.to)}` : ''}` : '',
    },
    { id: 'amount', label: 'Cantidad que se reclama (bruta)', value: totals.owed > 0 ? fSumE(totals.owed) : '' },
    { id: 'concept', label: 'Concepto', value: `${how}Cantidades pendientes de pago. ${concept}`.trim() },
  ];
}
