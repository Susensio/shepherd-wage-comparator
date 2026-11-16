/** «Trabajo ya hecho»: reads the one screen and makes the job, its record closed (ADR-0035). */

import { $ } from '../dom.js';
import { num } from '../format.js';
import { daysInclusive, defaultVacation, makeOffer, parseDate, todayISO } from '../offer.js';
import { offers } from '../offers.js';
import { settleOffer, state } from '../state.js';
import { closePastJob, openPastJob, pastJobToFicha } from './navigation.js';

/** What is wrong with the screen, painted under the button. */
const ui = { error: '' };
export const pastJobError = () => ui.error;

/** @type {{ paint: () => void, showSelected: () => void }} */
const callbacks = { paint: () => {}, showSelected: () => {} };
/** @param {typeof callbacks} given `paint` repaints the page; `showSelected` shows the job just made */
export function setUpPastJob(given) {
  Object.assign(callbacks, given);
}

export function showPastJob() {
  ui.error = '';
  openPastJob();
  callbacks.paint();
}

export function hidePastJob() {
  closePastJob();
  callbacks.paint();
}

const value = (id) => /** @type {HTMLInputElement} */ ($(`#${id}`)).value.trim();

/** A name that no other job has. */
function uniqueName(base) {
  let name = base;
  for (let i = 2; state.offers.some((o) => o.mine.name === name); i++) name = `${base} ${i}`;
  return name;
}

/** What is wrong with the dates and the figures typed, or ''. */
function problemOf({ start, end, days, duration }) {
  if (!start || !end) return 'Escribe el primer y el último día.';
  if (end < start) return 'El último día no puede ser anterior al primero.';
  if (end >= todayISO()) return 'El trabajo tiene que haber acabado antes de hoy.';
  if (days !== '' && !(Number.isInteger(num(days)) && num(days) >= 0 && num(days) <= duration))
    return `Los días trabajados tienen que ser un número entre 0 y ${duration}.`;
  return '';
}

/** «Guardar el trabajo»: the job with its dates and, of what is typed, the pay agreed, the days and the cobros. */
export function savePastJob() {
  const start = value('pastStart');
  const end = value('pastEnd');
  const days = value('pastDays');
  const duration = start && end && end >= start ? daysInclusive(parseDate(start), parseDate(end)) : 0;
  ui.error = problemOf({ start, end, days, duration });
  if (ui.error) return callbacks.paint();

  const pay = num(value('pastPay'));
  const paid = num(value('pastPaid'));
  const terms = {
    start,
    duration,
    durationUnit: 'days',
    ...(pay > 0 ? { payAmount: pay, payUnit: value('pastUnit'), payType: value('pastType') } : {}),
  };
  const job = makeOffer(terms, { name: uniqueName(value('pastName') || 'Trabajo ya hecho') });
  if (state.placeholderId) offers.chooseTemplate(job);
  else offers.add(job);
  offers.editTerms(job, defaultVacation);

  // What happened: the days as counts, the cobros as one lump; with no cobro told, what was agreed was received
  if (days !== '')
    offers.enterTotalDays(
      job,
      settleOffer(job).rows.map((row) => ({ key: row.month, days: row.days })),
      num(days),
    );
  if (paid > 0)
    offers.addPayment(job, { date: end, amount: paid, via: 'payroll', approx: $('#pastApprox').matches(':checked') });
  else if (pay > 0) offers.setPaid(job, 'asAgreed');
  const recorded = days !== '' || paid > 0 || pay > 0;
  if (recorded) {
    for (const row of settleOffer(job).rows)
      offers.closeMonth(job, { key: row.month, from: row.calendarFrom, to: row.calendarTo });
    offers.completeRecord(job);
  }
  ui.error = '';
  callbacks.showSelected();
  pastJobToFicha();
}
