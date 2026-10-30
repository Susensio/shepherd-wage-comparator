/** Texts: one-line summaries of an offer, and the texts people copy (the offer card and the claim). */

import { f1, fCount, fDays, fE, fN, fTyped, joinAnd, lowerFirst, num } from './format.js';
import { LAW } from './law.js';
import { hoursWeek } from './model/time.js';
import { contractOf, datesText, mealsGiven, mealsList } from './offer.js';
import { failuresOf, H_MAX, LAW_SHORT } from './rights.js';
import { isUnderAMonth, moneyIn, offerUnit, UNIT_TEXT, UNITS } from './units.js';

/** What `missing()` can report, as the sentence names it. */
export const MISSING_TEXT = {
  duration: 'la duración',
  hoursPerDay: 'las horas por día',
  pay: 'el sueldo',
  agreedTotal: 'el total pactado',
  cashInHand: 'lo que te pagan en mano',
  vacation: 'qué pasa con las vacaciones',
};

/** An amount in the unit of an agreed total: 52,93 €/día · 1.140 €/mes · 4.000 € en total. */
export const fSplit = (v, unit) =>
  unit === 'total'
    ? `${fE(v)} en total`
    : unit === 'day'
      ? `${fE(v, Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2)}/día`
      : `${fE(v)}/mes`;

/** One line per form section, for the folded summaries and the copied texts. */
export function summaries(o, r) {
  const one = num(o.duration) === 1;
  const duration =
    o.durationUnit === 'unknown'
      ? 'Duración sin saber'
      : !(num(o.duration) > 0)
        ? 'Duración sin poner'
        : `${fTyped(o.duration)} ${o.durationUnit === 'days' ? (one ? 'día' : 'días') : one ? 'mes' : 'meses'}`;
  const holidaysOff = o.holidays === 'yes';
  const per = { week: 'a la semana', total: 'en total' }[o.daysOffUnit] || 'al mes';
  const daysOff =
    num(o.daysOff) > 0
      ? `libra ${fTyped(o.daysOff)} ${per}${holidaysOff ? ' y los festivos' : ''}`
      : holidaysOff
        ? 'libra los festivos'
        : 'sin libranzas';
  const vacation =
    { taken: 'vacaciones disfrutadas', paidAtEnd: 'vacaciones pagadas aparte', included: 'vacaciones incluidas' }[
      o.vacation
    ] || 'vacaciones sin poner';
  const extraPays = !['year', 'total'].includes(o.payUnit) && o.extraPays === 'separate' ? ' · 2 pagas extra' : '';
  const meals = mealsGiven(o).length ? `te dan ${mealsList(o)}` : 'sin comida';
  const km = r.car.km;
  const carKm =
    km > 0
      ? ` · ~${isUnderAMonth(r) || r.time.months < 1 ? `${fN(km)}\u00a0km en total` : `${fN(r.time.months > 0 ? km / r.time.months : 0)}\u00a0km/mes`} con el tuyo`
      : '';
  const split = r.split;
  return {
    time: `${datesText(o) ? `${datesText(o)} · ` : o.year ? `${o.year} · ` : ''}${duration} · ${daysOff} · ${num(o.hoursPerDay) > 0 ? `${fTyped(o.hoursPerDay)}\u00a0h/día` : 'horas sin poner'}`,
    payroll:
      o.contract === 'none'
        ? 'Sin contrato: todo en mano'
        : o.payrollMin
          ? `El mínimo · ${vacation}`
          : num(o.payAmount) > 0
            ? `${fTyped(o.payAmount)} ${UNIT_TEXT[o.payUnit]} ${o.payType === 'net' ? 'neto' : 'bruto'}${extraPays} · ${vacation}`
            : 'Nada en nómina',
    b: split
      ? split.cash > 0.5
        ? `El resto hasta ${fSplit(split.agreed, split.unit)}: ~${fSplit(split.cash, split.unit)}`
        : 'Nada'
      : num(o.cashAmount) > 0
        ? `${fTyped(o.cashAmount)} ${UNIT_TEXT[o.cashUnit]}`
        : 'Nada',
    housing: `${o.overnight === 'yes' ? 'Duermes en borda · ' : ''}${o.housing === 'yes' ? 'Con casa' : 'Sin casa'} · ${meals}`,
    car: o.car === 'noCar' ? 'Sin tu coche' : `Tu coche${carKm}`,
    others: `${num(o.expenses) > 0 ? `Gastos ${fE(num(o.expenses))}/mes` : 'Sin otros gastos'} · IRPF ${o.irpfMode === 'manual' ? `${fN(num(o.irpfManual), 1)}\u00a0%` : `estimado ${fN(r.pay.irpfPct * 100, 1)}\u00a0%`}`,
  };
}

/** «al mes», «por día»… or, over the whole contract, «en los 100 días». */
export const unitPhrase = (unit, r) => (unit === 'total' ? `en los ${fN(r.time.natDays)} días` : UNITS[unit].short);

/** What the employer does not pay of the minimum, for «Para negociar»: salary, overnight bonus or vacation. */
export const minimumShortText = (r) =>
  (r.noContract ? r.debt.salary > 1 : r.min.salary - r.pay.salary > 1)
    ? 'por pagarte por debajo del mínimo'
    : r.debt.salary > 1
      ? 'por no pagarte el plus de pernocta'
      : 'por no pagarte las vacaciones';

/** The extra days and the overtime per week you are not paid for; if none is paid, all of them. */
export function unpaidTime(r) {
  const x = r.extra;
  const days = r.savings.days > 1 ? (x.daysUnpaid >= x.daysValue - 1 ? r.extraDays.extra : x.daysUnpaidCount) : 0;
  const week = hoursWeek(x);
  const hours =
    week.restDays * (x.daysValue > 0 && r.savings.days > 1 ? x.daysUnpaid / x.daysValue : 0) +
    week.beyond * (x.overtimeValue > 0 && r.savings.overtime > 1 ? x.overtimeUnpaid / x.overtimeValue : 0);
  return { days, hours: hours >= 0.5 ? hours : 0 };
}

/** What is legal about an offer, in one line: for the summaries, the Comparar rows and the card. */
export function legalLine(o, r) {
  const failures = failuresOf(o, r);
  if (!failures) return null;
  const x = r.extra;
  const status = (unpaid, value) => (unpaid >= value - 1 ? 'sin pagar' : 'mal pagadas');
  const time = [
    r.savings.days > 1 && `jornadas de más ${status(x.daysUnpaid, x.daysValue)}`,
    r.savings.overtime > 1 && `horas extra ${status(x.overtimeUnpaid, x.overtimeValue)}`,
  ]
    .filter(Boolean)
    .join(' y ');
  if (failures.length)
    return {
      status: 'bad',
      text: `✘ No cumple: ${joinAnd(failures.map((t) => LAW_SHORT[t] || t))}${time ? ` · ${time}` : ''}`,
    };
  return time
    ? { status: 'warn', text: `! Cumple lo básico, pero ${time}` }
    : { status: 'ok', text: '✔ Cumple lo básico' };
}

/** Short card to send on WhatsApp or keep in notes. */
export function cardText(o, r) {
  const s = summaries(o, r);
  const x = r.extra;
  const savings = r.savings;
  const unit = offerUnit(r);
  const money = moneyIn(r, unit);
  const levers = [
    [savings.cash, r.noContract ? 'por no hacerte contrato' : 'por pagarte en negro'],
    [savings.minimum, minimumShortText(r)],
    [savings.days, 'por las jornadas de más'],
    [savings.overtime, 'por las horas extra (estimado)'],
  ].filter(([value]) => value > 1);
  return [
    o.name || 'Oferta',
    `${s.time} → ${fN(r.time.daysWorked)} días trabajados`,
    `Nómina: ${s.payroll}`,
    r.cash.total > 0 ? `En negro: ${lowerFirst(s.b)}` : '',
    `${s.housing} · ${s.car}`,
    `Ganas: ${fE(r.earnings.perHour, 2)}/hora · ${fE(r.earnings.perDay)}/día · ${fE(r.earnings.perMonth)}/mes${r.time.noDuration ? ' (sin saber la duración)' : ` · ${fE(r.earnings.total)} en total`}`,
    legalLine(o, r)?.text || '',
    [
      x.daysValue > 0 && r.extraDays.extra >= 1 && `Jornadas de más: ${fCount(r.extraDays.extra)} en el contrato`,
      x.overtime >= 0.5 && `Horas extra: unas ${fN(x.over40PerWeek)} a la semana por encima de 40 (estimado)`,
    ]
      .filter(Boolean)
      .join(' · '),
    levers.length
      ? `Para negociar, el ganadero se ahorra ${unitPhrase(unit, r)}: ${joinAnd(levers.map(([v, t]) => `${money.figure(v)} ${t}`))}`
      : '',
    r.unemployment.days > 0
      ? `Genera ~${fN(r.unemployment.days)} días de paro (se cobran al llegar a ${LAW.unemployment.minDaysContributed} días cotizados en ${LAW.unemployment.windowYears} años)`
      : 'No genera paro',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Text for the union, the labour inspectorate or your own notes. */
export function claimText(o, r) {
  const s = summaries(o, r);
  const x = r.extra;
  const days = r.extraDays;
  const fNet = (v) => fE(v * r.netFactor);
  const cash = r.cash.total;
  const lines = [];
  const add = (...l) => lines.push(...l);

  add(`Oferta: ${o.name || 'sin nombre'}`);
  add(`Condiciones: ${s.time}. ${s.payroll}.${cash > 0 ? ` En negro: ${lowerFirst(s.b)}.` : ''} ${s.housing}.`);
  add(
    `Días trabajados: ${fN(r.time.daysWorked)} · Horas: ${fN(r.time.hours)} (${fN(r.time.hoursPerWeek)}\u00a0h a la semana).`,
    '',
  );

  add('SALARIO');
  if (r.noContract) {
    add(
      `Sin contrato ni alta en la Seguridad Social (Estatuto, art. 8). Se pagan ${fE(cash)} en mano en todo el contrato${r.time.months >= 1 ? ` (${fE(cash / r.time.months)} al mes)` : ''}, sin cotizar.`,
    );
    add(
      `Mínimo en todo el contrato: ${fE(r.min.salary + r.min.overnight)} brutos, unos ${fE(r.debt.minNetNoContract)} netos (SMI ${r.year}, ${r.wage.decree}${r.min.overnight > 0 ? `, más el ${fN(r.cfg.overnightPct)}\u00a0% por pernoctar fuera por pastoreo` : ''}).`,
    );
    if (r.debt.vacation > 1)
      add(
        `Vacaciones sin pagar (${fDays(r.time.vacationDays)}): ${fE(r.debt.vacation)} brutos, unos ${fNet(r.debt.vacation)} netos (Estatuto, art. 38).`,
      );
    if (r.debt.salary > 1) add(`Lo que se paga no llega al mínimo: faltan ${fE(r.debt.salary)} brutos.`);
  } else {
    add(
      `Tipo de contrato: ${contractOf(o).phrase}. Nómina bruta en todo el contrato: ${fE(r.pay.gross)} (unos ${fE(r.pay.net)} netos).`,
    );
    add(`Mínimo en todo el contrato, contado por meses: ${fE(r.min.total)} brutos.`);
    add(
      `- SMI ${r.year} (${r.wage.decree})${r.min.casual ? `, ${fE(r.wage.casual, 2)} por jornada (contratos temporales de ${LAW.casualMaxDays} días o menos)` : `, ${fE(r.wage.annual)} al año para ${LAW.weeklyHours} h semanales`}: ${fE(r.min.salary)}.`,
    );
    if (r.min.overnight > 0)
      add(
        `- Plus por pernoctar fuera por pastoreo, ${fN(r.cfg.overnightPct)}\u00a0% del salario (convenio del campo de Huesca, art. 29): ${fE(r.min.overnight)}.`,
      );
    if (r.min.vacation > 0)
      add(`- Vacaciones (${fDays(r.time.vacationDays)}; Estatuto, art. 38): ${fE(r.min.vacation)}.`);
    const { salary, overnight, vacation } = r.debt.parts;
    if (r.debt.total > 1) {
      const parts = [
        salary > 1 && ['de salario', salary],
        overnight > 1 && ['de plus de pernocta', overnight],
        vacation > 1 && ['de vacaciones', vacation],
      ].filter(Boolean);
      add(
        `En nómina faltan ${fE(r.debt.total)} brutos ${parts.length === 1 ? parts[0][0] : `(${joinAnd(parts.map(([t, v]) => `${fE(v)} ${t}`))})`}. Lo que sobra en un concepto no compensa lo que falta en otro.`,
      );
      if (cash > 0)
        add(
          r.debt.owed > 1
            ? `Se pagan además ${fE(cash)} sin declarar, que no cotizan. Contándolos, siguen faltando ${fE(r.debt.owed)} brutos, unos ${fNet(r.debt.owed)} netos.`
            : `Se pagan además ${fE(cash)} sin declarar: cubren esa falta, pero no cotizan (menos paro y menos jubilación).`,
        );
    } else {
      add('La nómina llega al mínimo legal.');
      if (cash > 0) add(`Se pagan además ${fE(cash)} sin declarar, que no cotizan.`);
    }
  }

  if (x.daysValue > 0 && days.extra >= 1) {
    add('', 'DESCANSO Y JORNADAS DE MÁS');
    if (r.rest.short >= 1)
      add(
        `Descanso semanal: ${fN(r.time.daysOffTotal)} días libres frente a un mínimo de ${fN(r.rest.legal)} (día y medio por semana; Estatuto, art. 37.1).`,
      );
    if (o.holidays !== 'yes' && x.holidays >= 0.5)
      add(
        `Festivos trabajados: ${Math.round(x.holidays) <= 1 ? 'uno' : `unos ${fN(x.holidays)}`} (Estatuto, art. 37.2).`,
      );
    add(
      `Jornadas de más: ${fCount(days.extra)}. De ${fCount(r.time.natDays)} días de contrato, ${fCount(days.due)} son laborables, sin el descanso semanal ni los festivos${r.time.vacationTaken > 0 ? ' ni las vacaciones' : ''}, y se trabajan ${fCount(days.worked)}.`,
    );
    const paid = x.daysValue - x.daysUnpaid;
    add(
      `Cada una, una jornada normal de ${f1(x.workday)} h al salario mínimo (${fE(x.dayValue, 2)}${r.min.overnight > 0.5 ? ', con el plus de pernocta' : ''}); lo que pasa de ahí va en las horas extra. Valen ${fE(x.daysValue)} brutos.${
        x.daysUnpaid > 1
          ? ` ${paid > 1 ? `Lo que se paga por encima del mínimo${cash > 0 ? ', contando lo cobrado en negro,' : ''} cubre ${fE(paid)}; s` : 'S'}in pagar: ${fE(x.daysUnpaid)} brutos, unos ${fNet(x.daysUnpaid)} netos.`
          : ' Lo que se paga por encima del mínimo las cubre.'
      }`,
    );
  }

  if (x.overtime >= 0.5) {
    add('', 'HORAS EXTRA (ESTIMACIÓN)');
    add(
      `Jornadas de ${fTyped(o.hoursPerDay)} h: ${f1(Math.max(0, num(o.hoursPerDay) - x.workday))} h de más cada día sobre la jornada normal (40 h semanales; Estatuto, art. 34), en ${fCount(r.time.daysWorked)} días trabajados: ${fN(x.overtime)} h, unas ${fN(x.overtimePerWeek)} a la semana.`,
    );
    add(
      `Al salario mínimo por hora (${fE(r.min.hourly, 2)}), valen ${fE(x.overtimeValue)} brutos.${x.overtimeUnpaid > 1 ? ` Sin pagar: ${fE(x.overtimeUnpaid)} brutos, unos ${fNet(x.overtimeUnpaid)} netos.` : ' Lo que se paga por encima del mínimo las cubre.'} Las horas extra se pagan al menos como una hora normal o se compensan con descanso (Estatuto, art. 35).`,
    );
    if (r.time.hoursPerWeek > H_MAX || num(o.hoursPerDay) > LAW.maxDayHours)
      add(
        `Se supera el máximo de la ganadería: ${LAW.maxWeekHours} h a la semana y ${LAW.maxDayHours} h al día (RD 1561/1995, art. 5).`,
      );
  }

  add(
    '',
    'Cálculo aproximado hecho con el Comparador de jornales. Conviene revisarlo con el convenio vigente y un sindicato.',
  );
  return lines.join('\n');
}
