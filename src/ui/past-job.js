/** «Trabajo ya hecho»: reads the one screen and makes the job, its record closed (ADR-0035). */

import { $ } from '../dom.js';
import { num } from '../format.js';
import { standingOf } from '../model/accounts.js';
import { daysInclusive, defaultVacation, makeOffer, parseDate, todayISO } from '../offer.js';
import { offers } from '../offers.js';
import { calcOffer, settleOffer, state } from '../state.js';
import { closePastJob, openPastJob, pastJobToFicha } from './navigation.js';

/** What the screen remembers while open: what is wrong with it, the answer to «¿Se cobró?» and the cobros listed. */
const ui = {
  error: '',
  how: '',
  /** The answer to «¿Se espera algún pago más?»: '' (not answered), `yes` or `no`. */
  expect: '',
  min: false,
  rows: /** @type {{ id: string, amount: string, date: string, via: string, approx: boolean }[]} */ ([]),
  next: 0,
};
export const pastJobState = () => ({ error: ui.error, how: ui.how, expect: ui.expect, min: ui.min, rows: ui.rows });

const newRow = () => ({ id: `r${ui.next++}`, amount: '', date: '', via: 'payroll', approx: false });

/** Takes what is typed in the cobros into `ui.rows`, so a repaint that adds or removes one keeps the rest. */
function syncRows() {
  const typed = [...document.querySelectorAll('#pastForm .past-cobro')];
  ui.rows = ui.rows.map((row, i) => ({
    ...row,
    amount: /** @type {HTMLInputElement} */ (typed[i]?.querySelector('.pastAmount'))?.value ?? row.amount,
    date: /** @type {HTMLInputElement} */ (typed[i]?.querySelector('.pastWhen'))?.value ?? row.date,
    via: /** @type {HTMLSelectElement} */ (typed[i]?.querySelector('.pastVia'))?.value ?? row.via,
    approx: /** @type {HTMLInputElement} */ (typed[i]?.querySelector('.pastApprox'))?.checked ?? row.approx,
  }));
}

/** @type {{ paint: () => void, showSelected: () => void }} */
const callbacks = { paint: () => {}, showSelected: () => {} };
/** @param {typeof callbacks} given `paint` repaints the page; `showSelected` shows the job just made */
export function setUpPastJob(given) {
  Object.assign(callbacks, given);
}

export function showPastJob() {
  ui.error = '';
  ui.how = '';
  ui.expect = '';
  ui.min = false;
  ui.rows = [newRow()];
  openPastJob();
  callbacks.paint();
}

export function hidePastJob() {
  closePastJob();
  callbacks.paint();
}

/** The buttons of the screen, by `data-action`: `events.js` joins them to its table. */
export const pastJobActions = {
  pastHow(b) {
    syncRows();
    ui.how = b.value;
    callbacks.paint();
  },
  pastExpect(b) {
    syncRows();
    ui.expect = b.value;
    callbacks.paint();
  },
  pastMin(b) {
    syncRows();
    ui.min = /** @type {HTMLInputElement} */ (b).checked;
    callbacks.paint();
  },
  pastAddCobro() {
    syncRows();
    ui.rows = [...ui.rows, newRow()];
    callbacks.paint();
  },
  pastRemoveCobro(b) {
    syncRows();
    ui.rows = ui.rows.filter((row) => row.id !== b.dataset.id);
    if (!ui.rows.length) ui.rows = [newRow()];
    callbacks.paint();
  },
};

const value = (id) => /** @type {HTMLInputElement} */ ($(`#${id}`)).value.trim();

/** A name that no other job has. */
function uniqueName(base) {
  let name = base;
  for (let i = 2; state.offers.some((o) => o.mine.name === name); i++) name = `${base} ${i}`;
  return name;
}

/** The cobros typed under «Otra cantidad» that have an amount: `{ amount, date, via, approx }`, the date empty when not typed. */
function cobrosTyped() {
  return [...document.querySelectorAll('#pastForm .past-cobro')]
    .map((row) => ({
      amount: num(/** @type {HTMLInputElement} */ (row.querySelector('.pastAmount')).value),
      date: /** @type {HTMLInputElement} */ (row.querySelector('.pastWhen')).value,
      via: /** @type {'payroll' | 'cash'} */ (/** @type {HTMLSelectElement} */ (row.querySelector('.pastVia')).value),
      approx: /** @type {HTMLInputElement} */ (row.querySelector('.pastApprox')).checked,
    }))
    .filter((cobro) => cobro.amount > 0);
}

/** What is wrong with the dates and the figures typed, or ''. */
function problemOf({ start, end, days, duration, how, min, pay, cobros, contract }) {
  if (!start || !end) return 'Escribe el primer y el último día.';
  if (end < start) return 'El último día no puede ser anterior al primero.';
  if (end >= todayISO()) return 'El trabajo tiene que haber acabado antes de hoy.';
  if (days !== '' && !(Number.isInteger(num(days)) && num(days) >= 0 && num(days) <= duration))
    return `Los días trabajados tienen que ser un número entre 0 y ${duration}.`;
  if ((pay > 0 || min) && !contract) return 'Para apuntar el pago, elige el contrato.';
  if (how === 'all' && !(pay > 0) && !min) return 'Para dar por cobrado lo pactado, escribe el pago.';
  if (how === 'part' && !cobros.length) return 'Escribe la cantidad de al menos un cobro.';
  if (cobros.some((cobro) => cobro.date && (cobro.date > todayISO() || cobro.date < start)))
    return 'La fecha de un cobro tiene que estar entre el primer día y hoy.';
  return '';
}

/** «Guardar el trabajo»: the job with its dates and, of what is typed, the pay agreed, the days and the cobros. */
export function savePastJob() {
  const start = value('pastStart');
  const end = value('pastEnd');
  const days = value('pastDays');
  const duration = start && end && end >= start ? daysInclusive(parseDate(start), parseDate(end)) : 0;
  const { how, min } = ui;
  const contract =
    /** @type {HTMLInputElement | null} */ (document.querySelector('#pastContract input:checked'))?.value ?? '';
  const pay = min ? 0 : num(value('pastPay'));
  const cobros = how === 'part' ? cobrosTyped() : [];
  const expectBy =
    ui.expect === 'yes' ? /** @type {HTMLInputElement | null} */ (document.querySelector('#pastExpectBy'))?.value : '';
  ui.error = problemOf({ start, end, days, duration, how, min, pay, cobros, contract });
  if (ui.error) {
    syncRows();
    return callbacks.paint();
  }

  const unit = value('pastUnit');
  const off = value('pastOff');
  // The contract is what was said, never one invented: «Sin contrato» is all cash, «Autónomo» an invoice
  const pays =
    contract === 'none'
      ? pay > 0
        ? { cashAmount: pay, cashUnit: unit }
        : {}
      : contract === 'selfEmployed'
        ? pay > 0
          ? { payAmount: pay, payUnit: unit, payType: 'gross' }
          : {}
        : {
            ...(min ? { payrollMin: true } : {}),
            ...(pay > 0 ? { payAmount: pay, payUnit: unit, payType: value('pastType') } : {}),
          };
  const terms = {
    start,
    duration,
    durationUnit: 'days',
    ...(contract ? { contract } : {}),
    ...(off !== '' ? { daysOff: num(off), daysOffUnit: 'month' } : {}),
    ...pays,
  };
  const job = makeOffer(terms, { name: uniqueName(value('pastName') || 'Trabajo ya hecho') });
  if (state.placeholderId) offers.chooseTemplate(job);
  else offers.add(job);
  offers.editTerms(job, defaultVacation);
  // It ended as agreed, on its last day: the ficha does not ask how it ended
  offers.setEnd(job, { how: 'agreed', date: end });

  // What happened: the days as counts and what was paid; with no answer to «¿Se cobró?», what was agreed was received
  if (days !== '')
    offers.enterTotalDays(
      job,
      settleOffer(job).rows.map((row) => ({ key: row.month, days: row.days })),
      num(days),
    );
  if (how === 'part')
    for (const cobro of cobros)
      offers.addPayment(job, { date: cobro.date || end, amount: cobro.amount, via: cobro.via, approx: cobro.approx });
  else if (how === 'none') offers.setPaid(job, 'none');
  else if (how === 'all' || (how === '' && (pay > 0 || min))) offers.setPaid(job, 'asAgreed');
  const recorded = days !== '' || how !== '' || pay > 0 || min;
  if (recorded) {
    for (const row of settleOffer(job).rows)
      offers.closeMonth(job, { key: row.month, from: row.calendarFrom, to: row.calendarTo });
    // Said of what is missing (only where a «Nada» or «Otra cantidad» left Falta): unanswered it stays «Por confirmar»
    const falta = standingOf(
      settleOffer(job),
      todayISO(),
      'finished',
      job.mine.record.payments,
      calcOffer(job).netFactor,
      job.mine.record.paid,
    ).falta;
    const asked = (how === 'part' || how === 'none') && falta > 0;
    if (asked && ui.expect === 'yes') offers.expectPayment(job, expectBy);
    else if (!asked || ui.expect === 'no') offers.completeRecord(job);
  }
  ui.error = '';
  callbacks.showSelected();
  pastJobToFicha();
}
