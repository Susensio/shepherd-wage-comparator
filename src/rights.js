/**
 * Right by right, whether an offer complies: what «¿Es legal?» lists, what colours the pills and what the summaries say.
 */

import { html } from 'lit-html';
import { explanations } from './explanations.js';
import { fCount, fN, isWorthCounting, num, WORTH_COUNTING_ABOVE } from './format.js';
import { citeOf, LAW } from './law.js';
import { isShortContract } from './offer.js';
import { moneyIn, UNITS } from './units.js';
import { withTip } from './views/parts.js';

/** Weekly-hours thresholds, with half an hour of slack for rounding. */
export const H_ORDINARY = LAW.weeklyHours + 0.5;
export const H_MAX = LAW.maxWeekHours + 0.5;

/** Where the law says each right, to link it. */
export const LAW_SOURCE = {
  overnight: citeOf('agreement', 29),
  vacation: citeOf('et', 38),
  rest: citeOf('et', 37),
  holidays: citeOf('et', '37.2'),
  hours: citeOf('rd1561', 5),
  contract: citeOf('et', 8),
};
/** Short names of what is breached, for pills and summaries. */
export const LAW_SHORT = {
  contract: 'sin contrato',
  salary: 'salario',
  overnight: 'pernocta',
  vacation: 'vacaciones',
  rest: 'descanso',
  hours: 'jornada',
};

/** Nothing of `value` is paid, give or take the rounding slack. */
export const isFullyUnpaid = (unpaid, value) => unpaid >= value - WORTH_COUNTING_ABOVE;

/**
 * @typedef {true | false | 'warn' | null} Status true complies · false fails · 'warn' warning · null information
 * @typedef {{id: 'contract' | 'salary' | 'overnight' | 'vacation' | 'rest' | 'hours' | 'holidays', status: Status, title: string, text: unknown}} Right
 */

/**
 * Each right, checked on its own: salary without vacation or bonus; then the bonus (only once the salary is reached)
 * and vacation; then rest and working hours. null if there is nothing to calculate with.
 * @returns {Right[] | null}
 */
export function rightsOf(o, r, unit = 'month') {
  if (r.min.total <= 0 || r.time.daysWorked <= 0) return null;
  const money = moneyIn(r, unit);
  const netWithTip = (x) => withTip(money.net(x), `${money.figure(x)} brutos en nómina`);
  const per = UNITS[unit].short;
  const overTxt = r.time.noDuration ? 'al mes' : 'en todo el contrato';
  const hoursPerDay = num(o.terms.hoursPerDay);
  const hoursPerWeek = r.time.hoursPerWeek;
  const vacationDays = fCount(r.time.vacationDays);
  const pct = fN(LAW.overnightPct);
  const rights = [];
  const add = (id, status, title, text) => rights.push({ id, status, title, text });

  const salaryOk = r.pay.salary >= r.min.salary - 1;
  if (r.noContract) {
    add('contract', false, 'Contrato y alta', explanations(o, r).contract);
    add(
      'salary',
      !isWorthCounting(r.debt.salary),
      'Salario mínimo',
      `Te pagan ${money.figure(r.cash.total)} en mano ${per}; con contrato, el mínimo serían unos ${money.figure(r.debt.minNetNoContract)} netos${o.terms.overnight === 'yes' ? ', con el plus por dormir en el monte' : ''}.`,
    );
    if (isWorthCounting(r.min.vacation))
      add(
        'vacation',
        false,
        'Vacaciones',
        `Sin contrato no te pagan los ${vacationDays} días de vacaciones que te corresponden: unos ${money.netAll(r.min.vacation)} netos.`,
      );
  } else {
    add(
      'salary',
      salaryOk,
      'Salario mínimo',
      html`Te pagan ${netWithTip(r.pay.salary)} netos ${per}; el mínimo es ${netWithTip(r.min.salary)}.`,
    );
    if (o.terms.overnight === 'yes') {
      const short = r.min.salary + r.min.overnight - r.pay.salary;
      const title = 'Plus por dormir en el monte';
      if (!salaryOk)
        add(
          'overnight',
          null,
          title,
          html`El convenio fija al menos un ${pct}\u00a0% más de salario: unos ${netWithTip(r.min.overnight)} ${per}. Ya va sumado en lo que te deben.`,
        );
      else if (!isWorthCounting(short))
        add(
          'overnight',
          true,
          title,
          html`Tu salario cubre también el ${pct}\u00a0% más que fija el convenio (unos ${netWithTip(r.min.overnight)} ${per}).`,
        );
      else
        add(
          'overnight',
          false,
          title,
          html`Cumples el salario mínimo, pero falta el plus de pernocta: el convenio da un ${pct}\u00a0% más por dormir fuera. Te faltan unos ${netWithTip(short)} ${per}.`,
        );
    } else
      add(
        'overnight',
        null,
        '¿Duermes en el monte?',
        `Si duermes fuera por pastoreo (borda, cabaña), el convenio te da al menos un ${pct}\u00a0% más de salario. Márcalo en «Casa y comida».`,
      );
    const mayBePaid = r.time.noDuration || isShortContract(o.terms);
    const onlyIfShort = mayBePaid
      ? ''
      : ' Pero solo se pueden pagar en vez de disfrutar si el contrato acaba antes de poder librarlas: en un contrato así de largo, tienes derecho a librarlas.';
    const paid = r.pay.vacationPay >= r.min.vacation - 1;
    if (o.terms.vacation === 'taken')
      add('vacation', true, 'Vacaciones', `Libras los ${vacationDays} días que te corresponden, cobrando.`);
    else if (o.terms.vacation === 'paidAtEnd')
      paid
        ? add(
            'vacation',
            mayBePaid || 'warn',
            'Vacaciones',
            `Te pagan al acabar los ${vacationDays} días que te corresponden: unos ${money.netAll(r.pay.vacationPay)} netos.${onlyIfShort}`,
          )
        : add(
            'vacation',
            false,
            'Vacaciones',
            `Por los ${vacationDays} días que te corresponden te pagan unos ${money.netAll(r.pay.vacationPay)} netos, y el mínimo es ${money.netAll(r.min.vacation)}.`,
          );
    else
      paid
        ? add(
            'vacation',
            mayBePaid || 'warn',
            'Vacaciones',
            `Van dentro del jornal: de lo que te pagan, unos ${money.netAll(r.pay.vacationPay)} netos son los ${vacationDays} días de vacaciones que te corresponden.${onlyIfShort.replace('pagar en vez', 'cobrar en vez')}`,
          )
        : add(
            'vacation',
            false,
            'Vacaciones',
            `Van dentro del jornal, pero no da para todo: a las vacaciones les corresponden al menos ${money.netAll(r.min.vacation)} netos y, sacándolas del jornal, quedan ${money.netAll(r.pay.vacationPay)}.`,
          );
  }

  if (r.rest.short >= 1)
    add(
      'rest',
      false,
      'Descanso semanal',
      `${r.time.daysOffTotal < 0.5 ? 'No libras ningún día' : `Libras ${fN(r.time.daysOffTotal)} días`} ${overTxt} y te corresponden al menos ${fN(r.rest.legal)}: trabajas unos ${fN(r.rest.short)} que deberían ser de descanso.`,
    );
  else add('rest', true, 'Descanso semanal', 'Libras al menos día y medio por semana.');

  const x = r.extra;
  if (hoursPerWeek <= H_ORDINARY) add('hours', true, 'Jornada', '40 h o menos a la semana.');
  else if (hoursPerWeek <= H_MAX && hoursPerDay <= LAW.maxDayHours) {
    const what =
      x.overtimePerWeek >= 0.5
        ? `${fN(hoursPerWeek)} h a la semana: unas ${fN(x.over40PerWeek)} por encima de 40.`
        : `${fN(hoursPerWeek)} h a la semana.`;
    if (isWorthCounting(x.overtimeUnpaid) && !r.noContract)
      add(
        'hours',
        false,
        'Jornada',
        `${what} ${isFullyUnpaid(x.overtimeUnpaid, x.overtimeValue) ? 'No te las pagan' : `Te pagan solo una parte: quedan sin pagar unas ${fN(x.overtimeUnpaidPerWeek)} a la semana`}. Las horas extra se pagan al menos como una hora normal, o se devuelven en descanso.`,
      );
    else add('hours', 'warn', 'Jornada', `${what} Se pagan o se devuelven en descanso.`);
  } else
    add(
      'hours',
      false,
      'Jornada',
      `${fN(hoursPerWeek)} h a la semana${hoursPerDay > LAW.maxDayHours ? ` y ${fN(hoursPerDay)} h al día` : ''}: pasas del límite de la ganadería (${LAW.maxWeekHours} h a la semana y ${LAW.maxDayHours} h al día).`,
    );

  const holidays = (LAW.holidaysPerYear * r.time.months) / 12;
  if (o.terms.holidays !== 'yes' && !r.time.noDuration && holidays >= 0.5)
    add(
      'holidays',
      null,
      'Festivos',
      `Trabajas los festivos, ${holidays < 1.5 ? 'uno' : `unos ${fN(holidays)}`} en este contrato. Se pagan aparte o se compensan con descanso${x.daysValue > 0 && r.extraDays.extra >= 1 ? ': ya van contados en las jornadas de más' : ''}.`,
    );
  return rights;
}

/** The ids of the rights an offer breaches, or null if there is nothing to calculate with. */
export const failuresOf = (o, r) =>
  rightsOf(o, r)
    ?.filter((right) => right.status === false)
    .map((right) => right.id) ?? null;
