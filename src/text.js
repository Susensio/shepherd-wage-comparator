/** Texts: one-line summaries of an offer, and the texts people copy (the offer card and the claim). */

import { f1, fCount, fDays, fDaysSpoken, fE, fN, fTyped, isWorthCounting, joinAnd, lowerFirst, num } from './format.js';
import { citeOf, LAW } from './law.js';
import { hoursWeek } from './model/time.js';
import { contractOf, datesText, HERD, mealsGiven, mealsList } from './offer.js';
import { fold, placeOfTerms } from './places.js';
import { failuresOf, H_MAX, isFullyUnpaid, LAW_SHORT } from './rights.js';
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

/** The same for another shepherd's offer: impersonal. */
export const MISSING_TEXT_THIRD = { ...MISSING_TEXT, cashInHand: 'lo que se paga en mano' };

/** An amount in the unit of an agreed total: 52,93 €/día · 1.140 €/mes · 4.000 € en total. */
export const fSplit = (v, unit) =>
  unit === 'total'
    ? `${fE(v)} en total`
    : unit === 'day'
      ? `${fE(v, Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2)}/día`
      : `${fE(v)}/mes`;

/**
 * Where the job is: «Yebra de Basa (Huesca)», or «Sarvisé, Yebra de Basa (Huesca)» with a village of its own. Names come
 * from the places list, so without it (not loaded yet) only the village is left. Empty if there is nothing to say.
 * @param {object} terms
 * @param {import('./places.js').PlacesIndex | null} places
 * @param {string} village yours alone: left out for offers that are not yours
 */
export function whereText(terms, places, village = '') {
  const found = places && placeOfTerms(places, terms);
  const name = village.trim();
  if (!found) return name;
  const area = found.municipality ? `${found.municipality} (${found.province})` : found.province;
  return !name || fold(name) === fold(found.municipality) ? area : `${name}, ${area}`;
}

/**
 * «Municipio de Yebra de Basa · Huesca»; the municipality itself is just «Municipio · Huesca». A place with no `name`
 * (an offer's, not a search result) always says the municipality.
 * @param {{ name?: string, municipality: string, province: string }} place
 */
export const areaLine = (place) =>
  `${place.name === place.municipality ? 'Municipio' : `Municipio de ${place.municipality}`} · ${place.province}`;

/**
 * What to call each shared offer: the sharer's name and, where two or more offers carry the same name, what tells them
 * apart: where the job is, else its dates, else both, else an ordinal.
 * @param {{ o: { id: string, mine: { name: string }, terms: object } }[]} items
 * @param {import('./places.js').PlacesIndex | null} places
 * @returns {Map<string, string>} by offer id
 */
export function sharedLabels(items, places) {
  const labels = new Map(items.map(({ o }) => [o.id, o.mine.name]));
  const byName = new Map();
  for (const item of items) {
    const key = fold(item.o.mine.name);
    byName.set(key, [...(byName.get(key) ?? []), item]);
  }
  const tiers = [
    (terms) => whereText(terms, places),
    (terms) => datesText(terms),
    (terms) => [whereText(terms, places), datesText(terms)].filter(Boolean).join(' · '),
  ];
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    const tier = tiers.find((detail) => new Set(group.map(({ o }) => detail(o.terms))).size === group.length);
    const ordered = [...group].sort((a, b) => (a.o.id < b.o.id ? -1 : 1));
    ordered.forEach(({ o }, i) => {
      const detail = tier ? tier(o.terms) : `n.º ${i + 1}`;
      if (detail) labels.set(o.id, `${o.mine.name} · ${detail}`);
    });
  }
  return labels;
}

/** The herd: «600 ovejas · 1 vaca». Empty if no head count is set. */
export const herdText = (terms) =>
  HERD.filter(([field]) => num(terms[field]) > 0)
    .map(([field, one, many]) => `${fN(num(terms[field]))} ${num(terms[field]) === 1 ? one : many}`)
    .join(' · ');

/**
 * One line per form section, for the folded summaries and the copied texts.
 * @param {import('./places.js').PlacesIndex | null} [places] to name the municipality and province
 * @param {boolean} [third] another shepherd's offer: impersonal instead of to the reader
 */
export function summaries(o, r, places = null, third = false) {
  const one = num(o.terms.duration) === 1;
  const duration =
    o.terms.durationUnit === 'unknown'
      ? 'Duración sin saber'
      : !(num(o.terms.duration) > 0)
        ? 'Duración sin poner'
        : `${fTyped(o.terms.duration)} ${o.terms.durationUnit === 'days' ? (one ? 'día' : 'días') : one ? 'mes' : 'meses'}`;
  const holidaysOff = o.terms.holidays === 'yes';
  const per = { week: 'a la semana', total: 'en total' }[o.terms.daysOffUnit] || 'al mes';
  const daysOff =
    num(o.terms.daysOff) > 0
      ? `libra ${fTyped(o.terms.daysOff)} ${per}${holidaysOff ? ' y los festivos' : ''}`
      : holidaysOff
        ? 'libra los festivos'
        : 'sin libranzas';
  const vacation =
    { taken: 'vacaciones disfrutadas', paidAtEnd: 'vacaciones pagadas aparte', included: 'vacaciones incluidas' }[
      o.terms.vacation
    ] || 'vacaciones sin poner';
  const extraPays =
    !['year', 'total'].includes(o.terms.payUnit) && o.terms.extraPays === 'separate' ? ' · 2 pagas extra' : '';
  const meals = mealsGiven(o.terms).length ? `${third ? 'se dan' : 'te dan'} ${mealsList(o.terms)}` : 'sin comida';
  const km = r.car.km;
  const carKm =
    km > 0
      ? ` · ~${isUnderAMonth(r) || r.time.months < 1 ? `${fN(km)}\u00a0km en total` : `${fN(r.time.months > 0 ? km / r.time.months : 0)}\u00a0km/mes`} con el tuyo`
      : '';
  const split = r.split;
  const where = whereText(o.terms, places, o.mine.place);
  const herd = herdText(o.terms);
  return {
    where,
    herd,
    place: [where, herd].filter(Boolean).join(' · ') || 'Sin poner',
    time: `${datesText(o.terms) ? `${datesText(o.terms)} · ` : o.terms.year ? `${o.terms.year} · ` : ''}${duration} · ${daysOff} · ${num(o.terms.hoursPerDay) > 0 ? `${fTyped(o.terms.hoursPerDay)}\u00a0h/día` : 'horas sin poner'}`,
    payroll:
      o.terms.contract === 'none'
        ? 'Sin contrato: todo en mano'
        : o.terms.payrollMin
          ? `El mínimo · ${vacation}`
          : num(o.terms.payAmount) > 0
            ? `${fTyped(o.terms.payAmount)} ${UNIT_TEXT[o.terms.payUnit]} ${o.terms.payType === 'net' ? 'neto' : 'bruto'}${extraPays} · ${vacation}`
            : 'Nada en nómina',
    b: split
      ? split.cash > 0.5
        ? `El resto hasta ${fSplit(split.agreed, split.unit)}: ~${fSplit(split.cash, split.unit)}`
        : 'Nada'
      : num(o.terms.cashAmount) > 0
        ? `${fTyped(o.terms.cashAmount)} ${UNIT_TEXT[o.terms.cashUnit]}`
        : 'Nada',
    housing: `${o.terms.overnight === 'yes' ? (third ? 'Se duerme en borda · ' : 'Duermes en borda · ') : ''}${o.terms.housing === 'yes' ? 'Con casa' : 'Sin casa'} · ${meals}`,
    car: o.mine.car === 'noCar' ? 'Sin tu coche' : `Tu coche${carKm}`,
    others: `${num(o.mine.expenses) > 0 ? `Gastos ${fE(num(o.mine.expenses))}/mes` : 'Sin otros gastos'} · IRPF ${o.mine.irpfMode === 'manual' ? `${fN(num(o.mine.irpfManual), 1)}\u00a0%` : `estimado ${fN(r.pay.irpfPct * 100, 1)}\u00a0%`}`,
  };
}

/** «al mes», «por día»… or, over the whole contract, «en los 100 días». */
export const unitPhrase = (unit, r) => (unit === 'total' ? `en los ${fN(r.time.natDays)} días` : UNITS[unit].short);

/** What the employer does not pay of the minimum, for «Para negociar»: salary, overnight bonus or vacation. */
export const minimumShortText = (r) =>
  (r.noContract ? isWorthCounting(r.debt.salary) : isWorthCounting(r.min.salary - r.pay.salary))
    ? 'por pagarte por debajo del mínimo'
    : isWorthCounting(r.debt.salary)
      ? 'por no pagarte el plus de pernocta'
      : 'por no pagarte las vacaciones';

/** The extra days and the overtime per week you are not paid for; if none is paid, all of them. */
export function unpaidTime(r) {
  const x = r.extra;
  const days = isWorthCounting(r.savings.days)
    ? isFullyUnpaid(x.daysUnpaid, x.daysValue)
      ? r.extraDays.extra
      : x.daysUnpaidCount
    : 0;
  const week = hoursWeek(x);
  const hours =
    week.restDays * (x.daysValue > 0 && isWorthCounting(r.savings.days) ? x.daysUnpaid / x.daysValue : 0) +
    week.beyond * (x.overtimeValue > 0 && isWorthCounting(r.savings.overtime) ? x.overtimeUnpaid / x.overtimeValue : 0);
  return { days, hours: hours >= 0.5 ? hours : 0 };
}

/** What is legal about an offer, in one line: for the summaries, the Comparar rows and the card. */
export function legalLine(o, r) {
  const failures = failuresOf(o, r);
  if (!failures) return null;
  const x = r.extra;
  const status = (unpaid, value) => (isFullyUnpaid(unpaid, value) ? 'sin pagar' : 'mal pagadas');
  const time = [
    isWorthCounting(r.savings.days) && `jornadas de más ${status(x.daysUnpaid, x.daysValue)}`,
    isWorthCounting(r.savings.overtime) && `horas extra ${status(x.overtimeUnpaid, x.overtimeValue)}`,
  ]
    .filter(Boolean)
    .join(' y ');
  if (failures.length)
    return {
      status: 'bad',
      text: `✘ No cumple: ${joinAnd(failures.map((id) => LAW_SHORT[id]))}${time ? ` · ${time}` : ''}`,
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
  ].filter(([value]) => isWorthCounting(value));
  return [
    o.mine.name || 'Oferta',
    `${s.time} → ${fN(r.time.daysWorked)} días trabajados`,
    `Nómina: ${s.payroll}`,
    r.cash.total > 0 ? `En negro: ${lowerFirst(s.b)}` : '',
    `${s.housing} · ${s.car}`,
    `Ganas: ${fE(r.earnings.perHour, 2)}/hora · ${fE(r.earnings.perDay)}/día · ${fE(r.earnings.perMonth)}/mes${r.time.noDuration ? ' (sin saber la duración)' : ` · ${fE(r.earnings.total)} en total`}`,
    legalLine(o, r)?.text || '',
    [
      x.daysValue > 0 && r.extraDays.extra >= 1 && `Jornadas de más: ${fCount(r.extraDays.extra)} en el contrato`,
      x.overtime >= 0.5 &&
        `Horas extra: unas ${fN(x.over40PerWeek)} a la semana por encima de ${LAW.weeklyHours} (estimado)`,
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

  add(`Oferta: ${o.mine.name || 'sin nombre'}`);
  add(`Condiciones: ${s.time}. ${s.payroll}.${cash > 0 ? ` En negro: ${lowerFirst(s.b)}.` : ''} ${s.housing}.`);
  add(
    `Días trabajados: ${fN(r.time.daysWorked)} · Horas: ${fN(r.time.hours)} (${fN(r.time.hoursPerWeek)}\u00a0h a la semana).`,
    '',
  );

  add('SALARIO');
  if (r.noContract) {
    add(
      `Sin contrato ni alta en la Seguridad Social (${citeOf('et', '8').label}). Se pagan ${fE(cash)} en mano en todo el contrato${r.time.months >= 1 ? ` (${fE(cash / r.time.months)} al mes)` : ''}, sin cotizar.`,
    );
    add(
      `Mínimo en todo el contrato: ${fE(r.min.salary + r.min.overnight)} brutos, unos ${fE(r.debt.minNetNoContract)} netos (SMI ${r.year}, ${r.wage.decree}${r.min.overnight > 0 ? `, más el ${fN(LAW.overnightPct)}\u00a0% por pernoctar fuera por pastoreo` : ''}).`,
    );
    if (isWorthCounting(r.debt.vacation))
      add(
        `Vacaciones sin pagar (${fDays(r.time.vacationDays)}): ${fE(r.debt.vacation)} brutos, unos ${fNet(r.debt.vacation)} netos (${citeOf('et', '38').label}).`,
      );
    if (isWorthCounting(r.debt.salary)) add(`Lo que se paga no llega al mínimo: faltan ${fE(r.debt.salary)} brutos.`);
  } else {
    add(
      `Tipo de contrato: ${contractOf(o.terms).phrase}. Nómina bruta en todo el contrato: ${fE(r.pay.gross)} (unos ${fE(r.pay.net)} netos).`,
    );
    add(`Mínimo en todo el contrato, contado por meses: ${fE(r.min.total)} brutos.`);
    add(
      `- SMI ${r.year} (${r.wage.decree})${r.min.casual ? `, ${fE(r.wage.casual, 2)} por jornada (contratos temporales de ${LAW.casualMaxDays} días o menos)` : `, ${fE(r.wage.annual)} al año para ${LAW.weeklyHours} h semanales`}: ${fE(r.min.salary)}.`,
    );
    if (r.min.overnight > 0)
      add(
        `- Plus por pernoctar fuera por pastoreo, ${fN(LAW.overnightPct)}\u00a0% del salario (convenio del campo de Huesca, art. 29): ${fE(r.min.overnight)}.`,
      );
    if (r.min.vacation > 0)
      add(`- Vacaciones (${fDays(r.time.vacationDays)}; ${citeOf('et', '38').label}): ${fE(r.min.vacation)}.`);
    const { salary, overnight, vacation } = r.debt.parts;
    if (isWorthCounting(r.debt.total)) {
      const parts = [
        isWorthCounting(salary) && ['de salario', salary],
        isWorthCounting(overnight) && ['de plus de pernocta', overnight],
        isWorthCounting(vacation) && ['de vacaciones', vacation],
      ].filter(Boolean);
      add(
        `En nómina faltan ${fE(r.debt.total)} brutos ${parts.length === 1 ? parts[0][0] : `(${joinAnd(parts.map(([t, v]) => `${fE(v)} ${t}`))})`}. Lo que sobra en un concepto no compensa lo que falta en otro.`,
      );
      if (cash > 0)
        add(
          isWorthCounting(r.debt.owed)
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
        `Descanso semanal: ${fN(r.time.daysOffTotal)} días libres frente a un mínimo de ${fN(r.rest.legal)} (${fDaysSpoken(LAW.weeklyRest)} por semana; ${citeOf('et', '37.1').label}).`,
      );
    if (o.terms.holidays !== 'yes' && x.holidays >= 0.5)
      add(
        `Festivos trabajados: ${Math.round(x.holidays) <= 1 ? 'uno' : `unos ${fN(x.holidays)}`} (${citeOf('et', '37.2').label}).`,
      );
    add(
      `Jornadas de más: ${fCount(days.extra)}. De ${fCount(r.time.natDays)} días de contrato, ${fCount(days.due)} son laborables, sin el descanso semanal ni los festivos${r.time.vacationTaken > 0 ? ' ni las vacaciones' : ''}, y se trabajan ${fCount(days.worked)}.`,
    );
    const paid = x.daysValue - x.daysUnpaid;
    add(
      `Cada una, una jornada normal de ${f1(x.workday)} h al salario mínimo (${fE(x.dayValue, 2)}${r.min.overnight > 0.5 ? ', con el plus de pernocta' : ''}); lo que pasa de ahí va en las horas extra. Valen ${fE(x.daysValue)} brutos.${
        isWorthCounting(x.daysUnpaid)
          ? ` ${isWorthCounting(paid) ? `Lo que se paga por encima del mínimo${cash > 0 ? ', contando lo cobrado en negro,' : ''} cubre ${fE(paid)}; s` : 'S'}in pagar: ${fE(x.daysUnpaid)} brutos, unos ${fNet(x.daysUnpaid)} netos.`
          : ' Lo que se paga por encima del mínimo las cubre.'
      }`,
    );
  }

  if (x.overtime >= 0.5) {
    add('', 'HORAS EXTRA (ESTIMACIÓN)');
    add(
      `Jornadas de ${fTyped(o.terms.hoursPerDay)} h: ${f1(Math.max(0, num(o.terms.hoursPerDay) - x.workday))} h de más cada día sobre la jornada normal (${LAW.weeklyHours} h semanales; ${citeOf('et', '34').label}), en ${fCount(r.time.daysWorked)} días trabajados: ${fN(x.overtime)} h, unas ${fN(x.overtimePerWeek)} a la semana.`,
    );
    add(
      `Al salario mínimo por hora (${fE(r.min.hourly, 2)}), valen ${fE(x.overtimeValue)} brutos.${isWorthCounting(x.overtimeUnpaid) ? ` Sin pagar: ${fE(x.overtimeUnpaid)} brutos, unos ${fNet(x.overtimeUnpaid)} netos.` : ' Lo que se paga por encima del mínimo las cubre.'} Las horas extra se pagan al menos como una hora normal o se compensan con descanso (${citeOf('et', '35').label}).`,
    );
    if (r.time.hoursPerWeek > H_MAX || num(o.terms.hoursPerDay) > LAW.maxDayHours)
      add(
        `Se supera el máximo de la ganadería: ${LAW.maxWeekHours} h a la semana y ${LAW.maxDayHours} h al día (${citeOf('rd1561', '5').label}).`,
      );
  }

  add(
    '',
    'Cálculo aproximado hecho con el Comparador de jornales. Conviene revisarlo con el convenio vigente y un sindicato.',
  );
  return lines.join('\n');
}
