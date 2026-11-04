/** «Las cuentas, paso a paso»: what is behind each figure of the offer, in € over the whole contract. */

import { html, nothing } from 'lit-html';
import { f1, fCount, fDays, fDaysSpoken, fE, fN, fTyped, isWorthCounting, joinAnd } from '../format.js';
import { LAW } from '../law.js';
import { dayRounder, fSumE, shownDiff, shownEuros } from '../ledger.js';
import { hoursWeek } from '../model/time.js';
import { row } from './parts.js';

const section = (title, rows, note) =>
  html`<section class="workings-sec"><h4>${title}</h4><div class="rows">${rows.filter(Boolean)}</div>${note ? html`<p class="hint">${note}</p>` : nothing}</section>`;

/** «Sin pagar» or «nada», with the net amount under it. `unpaid` is already the difference of shown figures. */
const unpaidRow = (label, unpaid, net, cls = 'tot') =>
  row(label, isWorthCounting(unpaid) ? fSumE(unpaid) : 'nada', {
    cls,
    valueCls: isWorthCounting(unpaid) ? 'bad' : 'ok',
    sub: isWorthCounting(unpaid) ? `unos ${net(unpaid)} netos` : '',
  });

function timeSection(o, r) {
  const t = r.time;
  const days = (x) => `${fCount(x)} días`;
  return section('Tiempo', [
    row('Duración', t.noDuration ? '1 mes' : days(t.natDays)),
    row('Vacaciones que corresponden', days(t.vacationDays), {
      sub: r.noContract
        ? 'sin contrato no se pagan'
        : {
            taken: 'se libran',
            paidAtEnd: 'se pagan al acabar',
          }[o.terms.vacation] || 'ni se libran ni se pagan aparte',
    }),
    row('Libranzas', days(t.daysOffTotal), { sub: o.terms.holidays === 'yes' ? 'y además los festivos' : '' }),
    row('Días trabajados', fN(t.daysWorked), { cls: 'tot' }),
    row('Horas trabajadas', `${fN(t.hours)}\u00a0h`, {
      sub: `${fTyped(o.terms.hoursPerDay)}\u00a0h al día · ${fN(t.hoursPerWeek)}\u00a0h a la semana`,
    }),
  ]);
}

function payrollSection(r) {
  const { pay, others } = r;
  const severance = r.employer.severance;
  const net = shownDiff(pay.gross, pay.ss, pay.irpf);
  const parts = [
    r.earnings.parts.extraPays > 0.5 && 'las pagas extra',
    r.earnings.parts.vacationPay > 0.5 && 'las vacaciones pagadas',
  ].filter(Boolean);
  const years = others.years.length > 1;
  const note = [
    years
      ? `El contrato pasa de un año a otro: para el IRPF, su sueldo se reparte por días entre ${joinAnd(others.years)}. `
      : '',
    others.count
      ? `Para el IRPF se suman también ${fE(others.gross)} brutos de ${others.count === 1 ? 'otra oferta trabajada' : `otras ${others.count} ofertas trabajadas`} en ${years ? 'esos años' : 'ese año'}. `
      : '',
    `IRPF de esta oferta en el año, con la deducción para sueldos cerca del salario mínimo: ${fE(pay.irpfYear)}.`,
    isWorthCounting(pay.irpf - pay.irpfYear)
      ? ` En la renta devolverían unos ${fE(pay.irpf - pay.irpfYear)}; no se suma a lo que se gana.`
      : '',
  ].join('');
  return section(
    'Nómina',
    [
      row('Nómina bruta', fE(pay.gross), { sub: parts.length ? `con ${joinAnd(parts)}` : '' }),
      row(`− Seguridad Social (${fN(pay.rates.workerPct, 1)}\u00a0%)`, fE(pay.ss)),
      row(`− Retención de IRPF (${fN(pay.irpfPct * 100, 1)}\u00a0%)`, fE(pay.irpf)),
      row('= Nómina neta', fSumE(net), { cls: severance > 0.5 ? 'strong' : 'tot' }),
      severance > 0.5 &&
        row('+ Indemnización por fin de contrato', fE(severance), {
          sub: `${LAW.severanceDaysPerYear} días por año trabajado, en el finiquito`,
        }),
      severance > 0.5 &&
        row('= Cobrado en nómina', fSumE(net + shownEuros(severance)), {
          cls: 'tot',
          sub: 'como en «Final de campaña»',
        }),
    ],
    note,
  );
}

function earningsSection(r) {
  const { earnings: e, time: t } = r;
  const hours = `${fN(t.hours)}\u00a0h`;
  return section(
    'Lo que se gana',
    [row('Total', fE(e.total), { cls: 'tot' })],
    `Repartido: ÷ ${hours} = ${fE(e.perHour, 2)}/h · ÷ ${fN(t.daysWorked)} días = ${fE(e.perDay)}/día${t.noDuration ? '' : ` · ÷ ${fN(t.months, 1)} meses = ${fE(e.perMonth)}/mes`}.`,
  );
}

/** The legal minimum, item by item: a surplus in one does not cover a shortfall in another. */
function minimumSection(o, r, net) {
  if (!(r.min.total > 0 && r.time.daysWorked > 0)) return nothing;
  const { min, pay, debt } = r;
  const bonusShown = min.overnight > 0.5 ? shownEuros(min.overnight) : 0;
  const shortOf = (...taken) => Math.max(0, shownDiff(min.salary, ...taken) + bonusShown);
  const minimum = row('Salario mínimo', fE(min.salary), {
    sub: min.casual
      ? `${fE(r.wage.casual, 2)} por jornada × ${fN(r.time.daysWorked)} días`
      : `Salario mínimo ${r.year} de ${fE(r.wage.annual)} al año × ${fN(r.time.months, 1)} meses`,
  });
  const bonus = min.overnight > 0.5 && row(`+ Plus de pernocta (${fN(LAW.overnightPct)} %)`, fE(min.overnight));
  const salaryShort = (short, sub) =>
    row('= Falta de sueldo', isWorthCounting(short) ? fSumE(short) : 'nada', { cls: 'strong', sub });
  if (r.noContract) {
    const factor = 1 - r.pay.rates.workerPct / 100;
    const cashShort = shortOf(r.cash.total / factor);
    return section('Mínimo legal, contado por meses', [
      minimum,
      bonus,
      row('− Se paga en negro, pasado a bruto', fE(r.cash.total / factor)),
      salaryShort(cashShort, ''),
      min.vacation > 0.5 &&
        row('Vacaciones sin pagar', fE(debt.vacation), { sub: fDays(r.time.vacationDays), cls: 'strong' }),
      unpaidRow('Debe el ganadero', cashShort + (min.vacation > 0.5 ? shownEuros(debt.vacation) : 0), net),
    ]);
  }
  const vacation = min.vacation > 0.5 && o.terms.vacation !== 'taken';
  const payShort = shortOf(pay.salary);
  const surplus = shownEuros(pay.salary) - shownEuros(min.salary) - bonusShown;
  const vacationShort = vacation ? Math.max(0, shownDiff(min.vacation, pay.vacationPay)) : 0;
  const shortTotal = (isWorthCounting(payShort) ? payShort : 0) + (isWorthCounting(vacationShort) ? vacationShort : 0);
  const cashCover = Math.min(shortTotal, shownEuros(Math.min(debt.total, r.cash.grossEq)));
  const covered = isWorthCounting(debt.total) && r.cash.total > 0;
  return section(
    'Mínimo legal, contado por meses',
    [
      minimum,
      bonus,
      row('− Sueldo en nómina', fE(pay.salary), { sub: 'sin las vacaciones' }),
      salaryShort(payShort, !isWorthCounting(payShort) && isWorthCounting(surplus) ? `sobran ${fSumE(surplus)}` : ''),
      vacation &&
        row('Vacaciones mínimas', fE(min.vacation), {
          sub: `${fDays(r.time.vacationDays)} que no se libran`,
        }),
      vacation && row('− Vacaciones en nómina', fE(pay.vacationPay)),
      vacation &&
        row('= Falta de vacaciones', isWorthCounting(vacationShort) ? fSumE(vacationShort) : 'nada', {
          cls: 'strong',
          sub:
            !isWorthCounting(vacationShort) && isWorthCounting(-shownDiff(min.vacation, pay.vacationPay))
              ? `sobran ${fSumE(-shownDiff(min.vacation, pay.vacationPay))}`
              : '',
        }),
      row('Faltan en nómina', isWorthCounting(shortTotal) ? fSumE(shortTotal) : 'nada', {
        cls: 'subt',
        valueCls: isWorthCounting(shortTotal) ? 'bad' : 'ok',
      }),
      covered &&
        row('− Lo que se cobra en negro, pasado a bruto', fSumE(cashCover), {
          sub: 'lo cubre, pero no cotiza',
        }),
      covered && unpaidRow('= Debe el ganadero', shortTotal - cashCover, net),
    ],
    'Cada cosa se cuenta por separado: lo que sobra en el sueldo no compensa lo que falta en vacaciones, ni al revés.',
  );
}

/**
 * The extra days, as a subtraction: the contract's days minus what the law gives off are the due workdays; what you
 * work above them is extra. Rounded so it adds up on screen: the weekly rest absorbs the rounding.
 */
function extraDaysSection(o, r, net) {
  const x = r.extra;
  const days = r.extraDays;
  if (!(x.daysValue > 0 && days.extra >= 1)) return nothing;
  const { round, half } = dayRounder(days.worked);
  const contract = round(r.time.natDays);
  const vacation = round(r.time.vacationTaken || 0);
  const holidays = round(x.holidays || 0);
  const rest = round(contract - vacation - holidays - days.due);
  // Where they come from: the weekly rest you do not take and the holidays you work (rounding leftovers go to rest)
  const { round: roundExtra } = dayRounder(days.extra);
  const holidaysWorked = roundExtra(Math.min(days.extra, o.terms.holidays !== 'yes' ? x.holidays : 0));
  const restWorked = roundExtra(days.extra - holidaysWorked);
  const split = holidaysWorked >= 0.5 && restWorked >= 0.5;
  const paid = Math.max(0, x.daysValue - x.daysUnpaid);
  const unpaid = shownDiff(x.daysValue, paid > 0.5 ? paid : 0);
  return section(
    'Jornadas de más',
    [
      row('Días del contrato', fCount(contract)),
      vacation >= half && row('− Vacaciones que se libran', fCount(vacation)),
      row('− Descanso semanal', fCount(rest), { sub: `${fDaysSpoken(LAW.weeklyRest)} por semana` }),
      holidays >= half && row('− Festivos', fCount(holidays)),
      row('= Días laborables', fCount(days.due), { cls: 'strong' }),
      row('Se trabajan', fCount(days.worked)),
      row('− Días laborables', fCount(days.due)),
      row('= Jornadas de más', fCount(days.extra), {
        cls: 'strong',
        sub: 'descanso o festivos que no se libran',
      }),
      split && row('· Descanso semanal que no se libra', fCount(restWorked)),
      split && row('· Festivos que se trabajan', fCount(holidaysWorked)),
      row('Valen al salario mínimo', fE(x.daysValue), {
        sub: `${fE(x.dayValue, 2)} cada una${r.min.overnight > 0.5 ? ', con el plus de pernocta' : ''}`,
      }),
      paid > 0.5 &&
        row('− Se paga por encima del mínimo', fE(paid), {
          sub: r.cash.total > 0 ? 'contando lo que se cobra en negro' : '',
        }),
      unpaidRow('= Sin pagar', unpaid, net),
    ],
    'Si no se libran las vacaciones, esos días cuentan como laborables: los paga el dinero de las vacaciones, no son de más.',
  );
}

/** Overtime, per week: the hours you work, minus the legal 40, minus the rest-day hours already in the extra days. */
function overtimeSection(r, net) {
  const x = r.extra;
  if (!(x.overtime >= 0.5 && x.overtimeValue > 0.5)) return nothing;
  const week = hoursWeek(x);
  const hours = (v) => `${fN(v, 1)} h`;
  const restDays = week.restDays >= 0.05;
  const paid = Math.max(0, x.overtimeValue - x.overtimeUnpaid);
  const unpaid = shownDiff(x.overtimeValue, paid > 0.5 ? paid : 0);
  return section(
    'Horas extra',
    [
      row('Horas a la semana', hours(week.total), { sub: `${f1(week.days)} días de ${fTyped(week.hoursPerDay)} h` }),
      row('− Jornada legal', hours(week.normal)),
      row(`= Por encima de ${LAW.weeklyHours}`, hours(week.over), { cls: restDays ? '' : 'strong' }),
      restDays && row('− Ya en «Jornadas de más»', hours(week.restDays), { sub: 'días de descanso trabajados' }),
      restDays && row('= Horas extra', hours(week.beyond), { cls: 'strong', sub: 'a la semana' }),
      row('En todo el contrato', `${fN(x.overtime)} h`),
      row('Valen al salario mínimo', fE(x.overtimeValue), { sub: `${fE(r.min.hourly, 2)} la hora` }),
      paid > 0.5 && row('− Se paga, de lo que sobra tras las jornadas', fE(paid)),
      unpaidRow('= Sin pagar', unpaid, net),
    ],
    'Es una estimación: en el monte no todas las horas son iguales.',
  );
}

/** Every section of the workings. */
export function workings(o, r) {
  const net = (x) => fE(x * r.netFactor);
  const over = r.time.noDuration
    ? 'en un mes (sin saber la duración)'
    : `en los ${fN(r.time.natDays)} días del contrato`;
  return html`<p class="hint">Todo ${over}, en euros brutos salvo que diga «neto». Es lo que hay detrás de cada cifra de arriba.</p>
    ${timeSection(o, r)}
    ${r.pay.gross > 0.5 ? payrollSection(r) : nothing}
    ${earningsSection(r)}
    ${minimumSection(o, r, net)}
    ${extraDaysSection(o, r, net)}
    ${overtimeSection(r, net)}`;
}
