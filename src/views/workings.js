/** «Las cuentas, paso a paso»: what is behind each figure of the offer, in € over the whole contract. */

import { html, nothing } from 'lit-html';
import { f1, fCount, fDays, fE, fN, fTyped, isWorthCounting, joinAnd } from '../format.js';
import { LAW } from '../law.js';
import { hoursWeek } from '../model/time.js';
import { row } from './parts.js';

const section = (title, rows, note) =>
  html`<section class="workings-sec"><h4>${title}</h4><div class="rows">${rows.filter(Boolean)}</div>${note ? html`<p class="hint">${note}</p>` : nothing}</section>`;

/** «Sin pagar» or «nada», with the net amount under it. */
const unpaidRow = (label, unpaid, net, cls = 'tot') =>
  row(label, isWorthCounting(unpaid) ? fE(unpaid) : 'nada', {
    cls,
    valueCls: isWorthCounting(unpaid) ? 'bad' : 'ok',
    sub: isWorthCounting(unpaid) ? `unos ${net(unpaid)} netos` : '',
  });

function timeSection(o, r) {
  const t = r.time;
  const days = (x) => `${fCount(x)} días`;
  return section('Tiempo', [
    row('Duración', t.noDuration ? '1 mes' : days(t.natDays)),
    row('Vacaciones que te corresponden', days(t.vacationDays), {
      sub: r.noContract
        ? 'sin contrato no te las pagan'
        : { taken: 'las libras', paidAtEnd: 'te las pagan al acabar' }[o.terms.vacation] ||
          'no las libras ni te las pagan aparte',
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
      ? `Para el IRPF se suman también ${fE(others.gross)} brutos de ${others.count === 1 ? 'tu otra oferta trabajada' : `tus otras ${others.count} ofertas trabajadas`} en ${years ? 'esos años' : 'ese año'}. `
      : '',
    `IRPF de esta oferta en el año, con la deducción para sueldos cerca del SMI: ${fE(pay.irpfYear)}.`,
    isWorthCounting(pay.irpf - pay.irpfYear)
      ? ` En la renta te devolverían unos ${fE(pay.irpf - pay.irpfYear)}; no se suma a lo que ganas.`
      : '',
  ].join('');
  return section(
    'Nómina',
    [
      row('Nómina bruta', fE(pay.gross), { sub: parts.length ? `con ${joinAnd(parts)}` : '' }),
      row(`− Seguridad Social (${fN(LAW.ssWorkerPct, 1)}\u00a0%)`, fE(pay.ss)),
      row(`− Retención de IRPF (${fN(pay.irpfPct * 100, 1)}\u00a0%)`, fE(pay.irpf)),
      row('= Nómina neta', fE(pay.net), { cls: severance > 0.5 ? 'strong' : 'tot' }),
      severance > 0.5 &&
        row('+ Indemnización por fin de contrato', fE(severance), {
          sub: `${LAW.severanceDaysPerYear} días por año trabajado, en el finiquito`,
        }),
      severance > 0.5 &&
        row('= Cobrado en nómina', fE(pay.net + severance), { cls: 'tot', sub: 'como en «Final de campaña»' }),
    ],
    note,
  );
}

function earningsSection(r) {
  const { earnings: e, time: t } = r;
  const hours = `${fN(t.hours)}\u00a0h`;
  return section(
    'Lo que ganas',
    [row('Total que ganas', fE(e.total), { cls: 'tot' })],
    `Repartido: ÷ ${hours} = ${fE(e.perHour, 2)}/h · ÷ ${fN(t.daysWorked)} días = ${fE(e.perDay)}/día${t.noDuration ? '' : ` · ÷ ${fN(t.months, 1)} meses = ${fE(e.perMonth)}/mes`}.${e.parts.unemployment > 0.5 ? ` El paro: ${fN(r.unemployment.contribDays)} días cotizados dan unos ${fN(r.unemployment.days)} días de prestación; solo se cobra al llegar a ${LAW.unemployment.minDaysContributed} días cotizados en ${LAW.unemployment.windowYears} años.` : ''}`,
  );
}

/** The legal minimum, item by item: a surplus in one does not cover a shortfall in another. */
function minimumSection(o, r, net) {
  if (!(r.min.total > 0 && r.time.daysWorked > 0)) return nothing;
  const { min, pay, debt } = r;
  const withBonus = min.salary + min.overnight;
  const minimum = row('Salario mínimo', fE(min.salary), {
    sub: min.casual
      ? `${fE(r.wage.casual, 2)} por jornada × ${fN(r.time.daysWorked)} días`
      : `SMI ${r.year} de ${fE(r.wage.annual)} al año × ${fN(r.time.months, 1)} meses`,
  });
  const bonus = min.overnight > 0.5 && row(`+ Plus de pernocta (${fN(LAW.overnightPct)} %)`, fE(min.overnight));
  const salaryShort = (sub) =>
    row('= Falta de sueldo', isWorthCounting(debt.salary) ? fE(debt.salary) : 'nada', { cls: 'strong', sub });
  if (r.noContract) {
    const factor = 1 - LAW.ssWorkerPct / 100;
    return section('Mínimo legal, contado por meses', [
      minimum,
      bonus,
      row('− Te pagan en mano, pasado a bruto', fE(r.cash.total / factor)),
      salaryShort(''),
      min.vacation > 0.5 &&
        row('Vacaciones sin pagar', fE(debt.vacation), { sub: fDays(r.time.vacationDays), cls: 'strong' }),
      unpaidRow('Te deben', debt.owed, net),
    ]);
  }
  const vacation = min.vacation > 0.5 && o.terms.vacation !== 'taken';
  const covered = isWorthCounting(debt.total) && r.cash.total > 0;
  return section(
    'Mínimo legal, contado por meses',
    [
      minimum,
      bonus,
      row('− Sueldo en nómina', fE(pay.salary), { sub: 'sin las vacaciones' }),
      salaryShort(
        !isWorthCounting(debt.salary) && isWorthCounting(pay.salary - withBonus)
          ? `sobran ${fE(pay.salary - withBonus)}`
          : '',
      ),
      vacation && row('Vacaciones mínimas', fE(min.vacation), { sub: `${fDays(r.time.vacationDays)} que no libras` }),
      vacation && row('− Vacaciones en nómina', fE(pay.vacationPay)),
      vacation &&
        row('= Falta de vacaciones', isWorthCounting(debt.vacation) ? fE(debt.vacation) : 'nada', {
          cls: 'strong',
          sub:
            !isWorthCounting(debt.vacation) && isWorthCounting(pay.vacationPay - min.vacation)
              ? `sobran ${fE(pay.vacationPay - min.vacation)}`
              : '',
        }),
      row('Faltan en nómina', isWorthCounting(debt.total) ? fE(debt.total) : 'nada', {
        cls: 'subt',
        valueCls: isWorthCounting(debt.total) ? 'bad' : 'ok',
      }),
      covered &&
        row('− Lo que cobras en negro, pasado a bruto', fE(Math.min(debt.total, r.cash.grossEq)), {
          sub: 'lo cubre, pero no cotiza',
        }),
      covered && unpaidRow('= Te deben', debt.owed, net),
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
  const k = days.worked < 10 ? 10 : 1;
  const round = (v) => Math.round(v * k) / k;
  const contract = round(r.time.natDays);
  const vacation = round(r.time.vacationTaken || 0);
  const holidays = round(x.holidays || 0);
  const rest = round(contract - vacation - holidays - days.due);
  // Where they come from: the weekly rest you do not take and the holidays you work (rounding leftovers go to rest)
  const k2 = days.extra < 10 ? 10 : 1;
  const round2 = (v) => Math.round(v * k2) / k2;
  const holidaysWorked = round2(Math.min(days.extra, o.terms.holidays !== 'yes' ? x.holidays : 0));
  const restWorked = round2(days.extra - holidaysWorked);
  const split = holidaysWorked >= 0.5 && restWorked >= 0.5;
  const paid = Math.max(0, x.daysValue - x.daysUnpaid);
  return section(
    'Jornadas de más',
    [
      row('Días del contrato', fCount(contract)),
      vacation >= 0.5 / k && row('− Vacaciones que libras', fCount(vacation)),
      row('− Descanso semanal', fCount(rest), { sub: 'día y medio por semana' }),
      holidays >= 0.5 / k && row('− Festivos', fCount(holidays)),
      row('= Días laborables', fCount(days.due), { cls: 'strong' }),
      row('Trabajas', fCount(days.worked)),
      row('− Días laborables', fCount(days.due)),
      row('= Jornadas de más', fCount(days.extra), { cls: 'strong', sub: 'descanso o festivos que no libras' }),
      split && row('· Descanso semanal que no libras', fCount(restWorked)),
      split && row('· Festivos que trabajas', fCount(holidaysWorked)),
      row('Valen al salario mínimo', fE(x.daysValue), {
        sub: `${fE(x.dayValue, 2)} cada una${r.min.overnight > 0.5 ? ', con el plus de pernocta' : ''}`,
      }),
      paid > 0.5 &&
        row('− Te pagan por encima del mínimo', fE(paid), {
          sub: r.cash.total > 0 ? 'contando lo que cobras en negro' : '',
        }),
      unpaidRow('= Sin pagar', x.daysUnpaid, net),
    ],
    'Si no libras las vacaciones, esos días cuentan como laborables: los paga el dinero de las vacaciones, no son de más.',
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
  return section(
    'Horas extra',
    [
      row('Horas a la semana', hours(week.total), { sub: `${f1(week.days)} días de ${fTyped(week.hoursPerDay)} h` }),
      row('− Jornada legal', hours(week.normal)),
      row('= Por encima de 40', hours(week.over), { cls: restDays ? '' : 'strong' }),
      restDays && row('− Ya en «Jornadas de más»', hours(week.restDays), { sub: 'días de descanso trabajados' }),
      restDays && row('= Horas extra', hours(week.beyond), { cls: 'strong', sub: 'a la semana' }),
      row('En todo el contrato', `${fN(x.overtime)} h`),
      row('Valen al salario mínimo', fE(x.overtimeValue), { sub: `${fE(r.min.hourly, 2)} la hora` }),
      paid > 0.5 && row('− Te pagan, de lo que sobra tras las jornadas', fE(paid)),
      unpaidRow('= Sin pagar', x.overtimeUnpaid, net),
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
