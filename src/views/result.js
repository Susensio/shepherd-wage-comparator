/** The result of the active offer: what you earn, the pills, the breakdown, and the sections below. */

import { html, nothing } from 'lit-html';
import { explanations } from '../explanations.js';
import { euroDecimals, fCount, fE, fN, fTyped, isWorthCounting, joinAnd, num } from '../format.js';
import { LAW } from '../law.js';
import { retaPct } from '../model/self-employed.js';
import { actualYear, contractOf, DAYS_PER_MONTH, missing } from '../offer.js';
import { H_MAX, H_ORDINARY, rightsOf } from '../rights.js';
import { MISSING_TEXT } from '../text.js';
import {
  deductionsOf,
  earnedShown,
  fUnit,
  incomeOf,
  inUnit,
  isUnderAMonth,
  moneyIn,
  offerUnit,
  PARTS,
  UNIT_ORDER,
  UNIT_TEXT,
  UNITS,
} from '../units.js';
import { legalSection } from './legal.js';
import { negotiationSection } from './negotiate.js';
import { negroSection } from './negro.js';
import { columns, ICONS, incomeBar, row, stampLines, withTip } from './parts.js';
import { seasonEndSection } from './season-end.js';
import { workings } from './workings.js';

/** What you earn in the other units, small under the headline figure («al mes» is not shown under a month). */
const otherUnits = (r, unit) =>
  html`<span class="others">${UNIT_ORDER.filter(
    (u) => u !== unit && !(u === 'total' && r.time.noDuration) && !(u === 'month' && isUnderAMonth(r)),
  ).map((u) => {
    const x = inUnit(r.earnings.total, r, u);
    return html`<span><b>${fN(x, euroDecimals(x, UNITS[u].decimals || undefined))}</b> ${UNIT_TEXT[u]}</span>`;
  })}</span>`;

/** Under the headline: the paro the offer generates, apart from «Se gana» (ADR-0022), or why there is none. */
function paroLine(r) {
  const days = Math.round(r.unemployment.days);
  // The autónomos' own «cese de actividad» is rarely within reach (several clients): explained in Leyes, not here
  if (r.selfEmployed) return 'No genera paro de asalariado.';
  if (days < 1)
    return r.noContract
      ? 'Sin contrato no genera paro.'
      : r.cash.allCash
        ? 'Todo en negro: no genera paro.'
        : 'No genera paro.';
  return html`Y genera <b>${days} ${days === 1 ? 'día' : 'días'} de paro</b>: unos ${fE(r.unemployment.euros)}, que se cobran más adelante.`;
}

const STAMPS = {
  noContract: { text: 'Sin contrato' },
  selfEmployed: { text: 'Autónomo', warn: true },
  allCash: { text: 'Todo en negro' },
  belowMinimum: { text: 'Bajo el mínimo' },
  noOvernight: { text: 'Sin plus', warn: true },
};

const PILL_RANK = { bad: 0, warn: 1, '': 2, ok: 3 };

/** The offer's pills: hours, days off, contract and cash, coloured like their right in «¿Es legal?». Wrong first. */
function pills(o, r) {
  const hoursPerWeek = r.time.hoursPerWeek;
  const overTxt = r.time.noDuration ? 'al mes' : 'en todo el contrato';
  const explain = explanations(o, r);
  const statusOf = Object.fromEntries((rightsOf(o, r, 'month') || []).map((right) => [right.id, right.status]));
  const color = (id, fallback) =>
    id in statusOf
      ? statusOf[id] === true
        ? 'ok'
        : statusOf[id] === false
          ? 'bad'
          : statusOf[id] === 'warn'
            ? 'warn'
            : ''
      : fallback;
  const extra = joinAnd(
    [
      r.extraDays.extra >= 1 && r.extra.daysValue > 0 && `unos ${fCount(r.extraDays.extra)} días de más ${overTxt}`,
      r.extra.overtimePerWeek >= 0.5 &&
        `unas ${fN(r.extra.over40PerWeek)}\u00a0h a la semana por encima de ${LAW.weeklyHours}`,
    ].filter(Boolean),
  );
  const daysOff = num(o.terms.daysOff);
  const cashPct = r.cash.share * 100;
  const list = [];
  if (explain.contract)
    list.push({
      icon: 'doc',
      text: contractOf(o.terms).pill,
      status: r.noContract ? 'bad' : r.selfEmployed ? 'warn' : 'ok',
      tip: explain.contract,
    });
  if (!r.noContract && !r.selfEmployed)
    list.push(
      r.cash.total <= 0.5
        ? { icon: 'cash', text: 'Todo en nómina', status: 'ok', tip: explain.allPayroll }
        : cashPct >= 99.5
          ? { icon: 'cash', text: 'Todo en negro', status: 'bad', tip: explain.b }
          : { icon: 'cash', text: `${fN(cashPct)}\u00a0% en negro`, status: 'warn', tip: explain.b },
    );
  list.push({
    icon: 'clock',
    text: `${fTyped(o.terms.hoursPerDay)}\u00a0h/día · ${fN(hoursPerWeek)}\u00a0h/semana`,
    status: r.selfEmployed ? '' : color('hours', hoursPerWeek <= H_ORDINARY ? 'ok' : 'warn'),
    tip: `Se trabajan unas ${fN(hoursPerWeek)}\u00a0h a la semana. La jornada ordinaria son ${LAW.weeklyHours} h. En ganadería puede alargarse hasta ${LAW.maxWeekHours} h a la semana y ${LAW.maxDayHours} h al día, pero lo que pasa de ${LAW.weeklyHours} son horas extra: se pagan o se devuelven en descanso.${extra ? ` Salen ${extra}.` : ''}${hoursPerWeek > H_MAX || num(o.terms.hoursPerDay) > LAW.maxDayHours ? ` Se pasa del límite legal.` : ''}`,
  });
  list.push({
    icon: 'cal',
    text:
      r.time.daysOffMonth < 0.05
        ? 'Sin libranzas'
        : `Se libran ${fTyped(o.terms.daysOff)} ${daysOff === 1 ? 'día' : 'días'} ${{ week: 'a la semana', total: 'en total' }[o.terms.daysOffUnit] || 'al mes'}`,
    status: r.selfEmployed ? '' : color('rest', r.rest.short < 1 ? 'ok' : 'warn'),
    tip: `Por ley corresponden al menos ${fN(LAW.weeklyRest, 1)} días de descanso por semana (unos ${fN((LAW.weeklyRest * DAYS_PER_MONTH) / 7, 1)} al mes), sin contar vacaciones. Se pueden juntar en periodos de hasta ${LAW.restPeriodWeeks} semanas.${r.rest.short >= 1 ? ` Con esta oferta se trabajan unos ${fN(r.rest.short)} días ${overTxt} que deberían ser de descanso.` : ' Esta oferta lo cumple.'}`,
  });
  // Stable sort: within each colour, contract and money first
  list.sort((a, b) => PILL_RANK[a.status] - PILL_RANK[b.status]);
  return html`<div class="pills">${list.map(
    (p) =>
      html`<span class="pill ${p.status}" data-tip=${p.tip} tabindex="0" role="button"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[p.icon]}</svg>${p.text}</span>`,
  )}</div>`;
}

/** Breakdown: from what you are paid to what you earn. Returns it with the explanation of the headline figure. */
function breakdown(o, r, unit) {
  const cfg = r.cfg;
  const p = r.earnings.parts;
  const money = moneyIn(r, unit);
  const earnTip = `Nómina neta${p.vacationPay > 0.5 ? ' + vacaciones pagadas' : ''}${r.cash.total > 0 ? ` + lo que se cobra en negro` : ''}${p.housing > 0.5 || p.food > 0.5 ? ` + lo que se ahorra en casa y comida` : ''}${p.km > 0.5 ? ` + los km que se pagan` : ''}${p.severance > 0.5 ? ' + la indemnización' : ''}${r.expenses.total > 0.5 ? ` − los gastos de coche y otros` : ''}, ${{ hour: `repartido entre las horas que se trabajan`, day: `repartido entre los días que se trabajan`, month: 'repartido entre los meses del contrato', total: 'en todo el contrato' }[unit]}.`;
  // From gross to net payroll, on tapping «Nómina» (paid vacation has its own row)
  const netPay = p.base + p.extraPays;
  const grossPay = netPay / (r.pay.netFactor || 1);
  const payrollTip = [
    `Nómina bruta: ${money.figure(grossPay)}${p.extraPays > 0.5 ? ' (con las pagas extra)' : ''}`,
    `− Seguridad Social (${fN(r.pay.rates.workerPct, 1)}\u00a0%)${r.pay.irpf > 0.5 ? ` y retención de IRPF (${fN(r.pay.irpfPct * 100, 1)}\u00a0%)` : ''}: ${fUnit(Math.round((num(money.figure(grossPay)) - num(money.figure(netPay))) * 100) / 100, unit)}`,
    `= Nómina neta: ${money.figure(netPay)}`,
    r.pay.irpf < 0.5
      ? 'Con lo que se gana en el año no se retiene IRPF.'
      : isWorthCounting(r.pay.irpf - r.pay.irpfYear)
        ? `Es la retención: en la renta devolverían unos ${fE(r.pay.irpf - r.pay.irpfYear)}.`
        : 'Es la retención de IRPF de la nómina.',
    p.vacationPay > 0.5 ? 'Las vacaciones pagadas van en su fila.' : '',
  ]
    .filter(Boolean)
    .join('\n');
  const vacationDays = fCount(r.time.vacationDays);
  const tips = {
    ...explanations(o, r),
    payroll: payrollTip,
    vacationPay:
      o.terms.vacation === 'included'
        ? `Los ${vacationDays} días de vacaciones que no se disfrutan van dentro de lo que se paga: unos ${fE(p.vacationPay)} netos. No se suman: es la parte del jornal que son vacaciones.`
        : `Los ${vacationDays} días de vacaciones que no se disfrutan se pagan al acabar: unos ${fE(p.vacationPay)} netos, aquí repartidos entre lo que se trabaja.`,
  };
  const trip =
    o.mine.commute === 'daily'
      ? 'Ida y vuelta cada día trabajado'
      : `Ida al empezar y vuelta al acabar${num(o.mine.tripsHome) > 0 ? `; ${fTyped(o.mine.tripsHome)} ${num(o.mine.tripsHome) === 1 ? 'bajada' : 'bajadas'} a casa al mes` : ''}`;
  const fuelPerKm = (num(cfg.fuelUse) / 100) * num(cfg.fuelPrice);
  const carTip = `${fN(r.car.km)}\u00a0km ${r.time.noDuration ? 'al mes' : 'en todo el contrato'}. ${o.mine.car === 'noCar' ? '' : `${trip}: ${fN(num(o.mine.kmHome))}\u00a0km de ida y otros tantos de vuelta.`}${o.mine.car === 'own' && num(o.mine.kmWorkPerDay) > 0 ? ` Más ${fN(num(o.mine.kmWorkPerDay))}\u00a0km por día trabajado en coche propio.` : ''} Cada km: ${fE(fuelPerKm, 2)} de gasolina (${fN(num(cfg.fuelUse), 1)} l/100 km a ${fE(num(cfg.fuelPrice), 2)}/l) + ${fE(num(cfg.wear), 2)} de desgaste. El coche se cambia en «Datos comunes».`;

  // Rows that round to 0 € in both columns are not shown
  const cols = columns(r);
  const shows = (x) => cols.shown(x).some((shown) => shown !== 0);
  const partRow = (part) =>
    row(withTip(part.label, tips[part.key]), cols.value(part.value(p)), {
      swatch: part.color,
      cls: part.key === 'payroll' ? 'strong' : '',
    });
  const present = PARTS.filter((part) => part.value(p) > 0.5);
  // Money that reaches you first, paid vacation right after payroll, then a subtotal if something else follows
  const position = (part) => (part.key === 'vacationPay' ? 0.5 : PARTS.indexOf(part));
  const moneyParts = present.filter((part) => part.money).sort((a, b) => position(a) - position(b));
  const others = present.filter((part) => !part.money);
  const received = moneyParts.map((part) => part.value(p));
  const earned = present.map((part) => part.value(p));
  const se = r.selfEmployed;
  const over = r.time.noDuration ? 'al mes' : 'en todo el contrato';
  const deductionTips = {
    Coche: carTip,
    'Cuota de autónomos': se
      ? `Con unos ${fE(se.netForTramo)} de rendimiento al mes (lo facturado × ${fN(LAW.selfEmployed.moduleIndex, 2)}, menos el ${fN(LAW.selfEmployed.genericExpensesPct)}\u00a0%), la base mínima del tramo es de ${fE(se.base, 2)}; la cuota es el ${fN(retaPct(), 2)}\u00a0% de esa base, ${over}.`
      : '',
    IRPF: se
      ? `Por módulos: lo facturado × ${fN(LAW.selfEmployed.moduleIndex, 2)}, menos el ${fN(LAW.selfEmployed.moduleReductionPct)}\u00a0%, son ${fE(se.activityNet)} de rendimiento ${over}; el IRPF que eso suma en el año. En cada factura se retiene el ${fN(LAW.selfEmployed.withholdingPct)}\u00a0%, a cuenta.`
      : '',
  };
  const deductions = deductionsOf(r).filter(([, x]) => shows(x));
  const expenses = deductions.map(([, x]) => x);
  return {
    earnTip,
    html: html`
    <details class="plg" data-fold="breakdown2"><summary>Desglose<span class="stat dt">cobrado <b>${cols.sumTexts(received)[1]}</b> ${cols.other === 'month' ? 'al mes' : 'en total'}</span></summary>
    ${incomeBar(r, incomeOf(r) || 1)}
    <div class="rows">
      ${row('', cols.header, { swatch: '', cls: 'hd' })}
      ${[
        ...moneyParts.map(partRow),
        ...(moneyParts.length > 1 && others.length
          ? [row('Cobrado', cols.sum(received), { swatch: '', cls: 'subt' })]
          : []),
        ...others.map(partRow),
      ]}
      ${deductions.map(([label, x]) => row(withTip(label, deductionTips[label]), cols.minus(x), { swatch: 'expense', valueCls: 'minus' }))}
      ${row('Total', cols.sum(earned, expenses), { swatch: '', cls: 'tot' })}
    </div>
    </details>`,
  };
}

/**
 * The result of an offer in two parts: `head` (the headline, its stamp and the pills, or what is still missing) and
 * `analysis` (the breakdown, the law and the workings; null while something is missing). `readOnly` (another
 * shepherd's offer): nothing to complete, negotiate or copy.
 */
export function resultParts(o, r, { readOnly = false } = {}) {
  const shortfall = missing(o.terms);
  if (shortfall.length)
    return {
      head: html`<p class="empty">Para ver cuánto se gana falta ${joinAnd(shortfall.map((id) => MISSING_TEXT[id]))}. ${readOnly ? nothing : html`<button type="button" class="linkbtn" data-action="complete">Ponerlo</button>`}</p>`,
      analysis: null,
    };
  const unit = offerUnit(r);
  const money = moneyIn(r, unit);
  const { earnTip, html: breakdownView } = breakdown(o, r, unit);
  const shown = earnedShown(r);
  // The headline is the ledger's «Total» in the same unit, so the two never differ by a rounding
  const headline = unit in shown ? fUnit(shown[unit], unit) : money.figure(r.earnings.total);
  const year = actualYear(o.terms);
  const head = html`${
    year !== r.year
      ? html`<p class="year-warning">Esta oferta es de ${year} y aún no están incluidos el salario mínimo ni el IRPF de ${year}: las cuentas usan los de ${r.year}.</p>`
      : ''
  }
    <h3 class="q">¿Cuánto se gana?</h3>
    <div class="tag"><span class="lbl tipl" data-tip=${earnTip} tabindex="0" role="button">Se gana ${UNITS[unit].label}</span><span class="tag-row"><span class="big">${headline}</span>${
      r.stamp
        ? html`<a href="#secLegal" class=${STAMPS[r.stamp.code].warn ? 'stamp warn' : 'stamp'}>${stampLines(STAMPS[r.stamp.code].text)}</a>`
        : nothing
    }</span>${otherUnits(r, unit)}
      ${r.time.noDuration ? html`<span class="sub">Sin duración, se cuenta un mes</span>` : ''}
      <span class="sub paro">${paroLine(r)}</span></div>
    ${pills(o, r)}`;
  const analysis = html`${breakdownView}
    ${legalSection(o, r, money)}
    ${negroSection(r, money)}
    ${readOnly ? nothing : negotiationSection(o, r, money)}
    ${readOnly ? nothing : seasonEndSection(o, r)}
    <details class="plg" data-fold="workings"><summary>Las cuentas, paso a paso</summary><div class="doc">${workings(o, r)}</div></details>`;
  return { head, analysis };
}

/** The whole result of an offer, or what is still missing to show it. */
export function resultView(o, r, options = {}) {
  const { head, analysis } = resultParts(o, r, options);
  return html`${head}${analysis ?? nothing}`;
}
