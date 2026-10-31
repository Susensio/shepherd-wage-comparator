/** «Las cuentas, paso a paso»: what is behind each figure of the offer, in € over the whole contract. */

import { html, nothing } from 'lit-html';
import { f1, fCount, fDays, fDaysSpoken, fE, fN, fTyped, isWorthCounting, joinAnd } from '../format.js';
import { LAW } from '../law.js';
import { hoursWeek } from '../model/time.js';
import { voiceOf } from '../voice.js';
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

function timeSection(o, r, third) {
  const say = voiceOf(third);
  const t = r.time;
  const days = (x) => `${fCount(x)} días`;
  return section('Tiempo', [
    row('Duración', t.noDuration ? '1 mes' : days(t.natDays)),
    row(say('Vacaciones que te corresponden', 'Vacaciones que le corresponden'), days(t.vacationDays), {
      sub: r.noContract
        ? say('sin contrato no te las pagan', 'sin contrato no se pagan')
        : {
            taken: say('las libras', 'se libran'),
            paidAtEnd: say('te las pagan al acabar', 'se pagan al acabar'),
          }[o.terms.vacation] || say('no las libras ni te las pagan aparte', 'ni se libran ni se pagan aparte'),
    }),
    row('Libranzas', days(t.daysOffTotal), { sub: o.terms.holidays === 'yes' ? 'y además los festivos' : '' }),
    row('Días trabajados', fN(t.daysWorked), { cls: 'tot' }),
    row('Horas trabajadas', `${fN(t.hours)}\u00a0h`, {
      sub: `${fTyped(o.terms.hoursPerDay)}\u00a0h al día · ${fN(t.hoursPerWeek)}\u00a0h a la semana`,
    }),
  ]);
}

function payrollSection(r, third) {
  const say = voiceOf(third);
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
      ? `Para el IRPF se suman también ${fE(others.gross)} brutos de ${others.count === 1 ? say('tu otra oferta trabajada', 'otra oferta trabajada') : say(`tus otras ${others.count} ofertas trabajadas`, `otras ${others.count} ofertas trabajadas`)} en ${years ? 'esos años' : 'ese año'}. `
      : '',
    `IRPF de esta oferta en el año, con la deducción para sueldos cerca del SMI: ${fE(pay.irpfYear)}.`,
    isWorthCounting(pay.irpf - pay.irpfYear)
      ? ` En la renta ${say('te devolverían', 'devolverían')} unos ${fE(pay.irpf - pay.irpfYear)}; no se suma a lo que ${say('ganas', 'se gana')}.`
      : '',
  ].join('');
  return section(
    'Nómina',
    [
      row('Nómina bruta', fE(pay.gross), { sub: parts.length ? `con ${joinAnd(parts)}` : '' }),
      row(`− Seguridad Social (${fN(pay.rates.workerPct, 1)}\u00a0%)`, fE(pay.ss)),
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

function earningsSection(r, third) {
  const { earnings: e, time: t } = r;
  const hours = `${fN(t.hours)}\u00a0h`;
  return section(
    third ? 'Lo que se gana' : 'Lo que ganas',
    [row(third ? 'Total que se gana' : 'Total que ganas', fE(e.total), { cls: 'tot' })],
    `Repartido: ÷ ${hours} = ${fE(e.perHour, 2)}/h · ÷ ${fN(t.daysWorked)} días = ${fE(e.perDay)}/día${t.noDuration ? '' : ` · ÷ ${fN(t.months, 1)} meses = ${fE(e.perMonth)}/mes`}.${e.parts.unemployment > 0.5 ? ` El paro: ${fN(r.unemployment.contribDays)} días cotizados dan unos ${fN(r.unemployment.days)} días de prestación; solo se cobra al llegar a ${LAW.unemployment.minDaysContributed} días cotizados en ${LAW.unemployment.windowYears} años.` : ''}`,
  );
}

/** The legal minimum, item by item: a surplus in one does not cover a shortfall in another. */
function minimumSection(o, r, net, third) {
  const say = voiceOf(third);
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
    const factor = 1 - r.pay.rates.workerPct / 100;
    return section('Mínimo legal, contado por meses', [
      minimum,
      bonus,
      row(say('− Te pagan en mano, pasado a bruto', '− Se paga en mano, pasado a bruto'), fE(r.cash.total / factor)),
      salaryShort(''),
      min.vacation > 0.5 &&
        row('Vacaciones sin pagar', fE(debt.vacation), { sub: fDays(r.time.vacationDays), cls: 'strong' }),
      unpaidRow(say('Te deben', 'Se le deben'), debt.owed, net),
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
      vacation &&
        row('Vacaciones mínimas', fE(min.vacation), {
          sub: `${fDays(r.time.vacationDays)} que ${say('no libras', 'no se libran')}`,
        }),
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
        row(
          say('− Lo que cobras en negro, pasado a bruto', '− Lo que se cobra en negro, pasado a bruto'),
          fE(Math.min(debt.total, r.cash.grossEq)),
          {
            sub: 'lo cubre, pero no cotiza',
          },
        ),
      covered && unpaidRow(say('= Te deben', '= Se le deben'), debt.owed, net),
    ],
    'Cada cosa se cuenta por separado: lo que sobra en el sueldo no compensa lo que falta en vacaciones, ni al revés.',
  );
}

/**
 * The extra days, as a subtraction: the contract's days minus what the law gives off are the due workdays; what you
 * work above them is extra. Rounded so it adds up on screen: the weekly rest absorbs the rounding.
 */
function extraDaysSection(o, r, net, third) {
  const say = voiceOf(third);
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
      vacation >= 0.5 / k && row(say('− Vacaciones que libras', '− Vacaciones que se libran'), fCount(vacation)),
      row('− Descanso semanal', fCount(rest), { sub: `${fDaysSpoken(LAW.weeklyRest)} por semana` }),
      holidays >= 0.5 / k && row('− Festivos', fCount(holidays)),
      row('= Días laborables', fCount(days.due), { cls: 'strong' }),
      row(say('Trabajas', 'Se trabajan'), fCount(days.worked)),
      row('− Días laborables', fCount(days.due)),
      row('= Jornadas de más', fCount(days.extra), {
        cls: 'strong',
        sub: say('descanso o festivos que no libras', 'descanso o festivos que no se libran'),
      }),
      split && row(say('· Descanso semanal que no libras', '· Descanso semanal que no se libra'), fCount(restWorked)),
      split && row(say('· Festivos que trabajas', '· Festivos que se trabajan'), fCount(holidaysWorked)),
      row('Valen al salario mínimo', fE(x.daysValue), {
        sub: `${fE(x.dayValue, 2)} cada una${r.min.overnight > 0.5 ? ', con el plus de pernocta' : ''}`,
      }),
      paid > 0.5 &&
        row(say('− Te pagan por encima del mínimo', '− Se paga por encima del mínimo'), fE(paid), {
          sub: r.cash.total > 0 ? say('contando lo que cobras en negro', 'contando lo que se cobra en negro') : '',
        }),
      unpaidRow('= Sin pagar', x.daysUnpaid, net),
    ],
    say(
      'Si no libras las vacaciones, esos días cuentan como laborables: los paga el dinero de las vacaciones, no son de más.',
      'Si no se libran las vacaciones, esos días cuentan como laborables: los paga el dinero de las vacaciones, no son de más.',
    ),
  );
}

/** Overtime, per week: the hours you work, minus the legal 40, minus the rest-day hours already in the extra days. */
function overtimeSection(r, net, third) {
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
      row(`= Por encima de ${LAW.weeklyHours}`, hours(week.over), { cls: restDays ? '' : 'strong' }),
      restDays && row('− Ya en «Jornadas de más»', hours(week.restDays), { sub: 'días de descanso trabajados' }),
      restDays && row('= Horas extra', hours(week.beyond), { cls: 'strong', sub: 'a la semana' }),
      row('En todo el contrato', `${fN(x.overtime)} h`),
      row('Valen al salario mínimo', fE(x.overtimeValue), { sub: `${fE(r.min.hourly, 2)} la hora` }),
      paid > 0.5 &&
        row(
          third ? '− Se paga, de lo que sobra tras las jornadas' : '− Te pagan, de lo que sobra tras las jornadas',
          fE(paid),
        ),
      unpaidRow('= Sin pagar', x.overtimeUnpaid, net),
    ],
    'Es una estimación: en el monte no todas las horas son iguales.',
  );
}

/** Every section of the workings. */
export function workings(o, r, third = false) {
  const net = (x) => fE(x * r.netFactor);
  const over = r.time.noDuration
    ? 'en un mes (sin saber la duración)'
    : `en los ${fN(r.time.natDays)} días del contrato`;
  return html`<p class="hint">Todo ${over}, en euros brutos salvo que diga «neto». Es lo que hay detrás de cada cifra de arriba.</p>
    ${timeSection(o, r, third)}
    ${r.pay.gross > 0.5 ? payrollSection(r, third) : nothing}
    ${earningsSection(r, third)}
    ${minimumSection(o, r, net, third)}
    ${extraDaysSection(o, r, net, third)}
    ${overtimeSection(r, net, third)}`;
}
