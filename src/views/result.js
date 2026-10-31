/** The result of the active offer: what you earn, the pills, the breakdown, and the sections below. */

import { html, nothing } from 'lit-html';
import { explanations } from '../explanations.js';
import { euroDecimals, fCount, fE, fN, fTyped, joinAnd, num } from '../format.js';
import { LAW } from '../law.js';
import { actualYear, contractOf, DAYS_PER_MONTH, missing } from '../offer.js';
import { H_MAX, H_ORDINARY, rightsOf } from '../rights.js';
import { legalLine, MISSING_TEXT } from '../text.js';
import {
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

const STAMPS = {
  noContract: { text: 'Sin contrato' },
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
  const statusOf = Object.fromEntries((rightsOf(o, r) || []).map((right) => [right.id, right.status]));
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
      r.extra.overtimePerWeek >= 0.5 && `unas ${fN(r.extra.over40PerWeek)}\u00a0h a la semana por encima de 40`,
    ].filter(Boolean),
  );
  const daysOff = num(o.terms.daysOff);
  const cashPct = r.cash.share * 100;
  const list = [];
  if (explain.contract)
    list.push({
      icon: 'doc',
      text: contractOf(o.terms).pill,
      status: r.noContract ? 'bad' : 'ok',
      tip: explain.contract,
    });
  if (!r.noContract)
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
    status: color('hours', hoursPerWeek <= H_ORDINARY ? 'ok' : 'warn'),
    tip: `Trabajas unas ${fN(hoursPerWeek)}\u00a0h a la semana. La jornada ordinaria son ${LAW.weeklyHours} h. En ganadería puede alargarse hasta ${LAW.maxWeekHours} h a la semana y ${LAW.maxDayHours} h al día, pero lo que pasa de ${LAW.weeklyHours} son horas extra: se pagan o se devuelven en descanso.${extra ? ` Te salen ${extra}.` : ''}${hoursPerWeek > H_MAX || num(o.terms.hoursPerDay) > LAW.maxDayHours ? ' Pasas del límite legal.' : ''}`,
  });
  list.push({
    icon: 'cal',
    text:
      r.time.daysOffMonth < 0.05
        ? 'Sin libranzas'
        : `Libras ${fTyped(o.terms.daysOff)} ${daysOff === 1 ? 'día' : 'días'} ${{ week: 'a la semana', total: 'en total' }[o.terms.daysOffUnit] || 'al mes'}`,
    status: color('rest', r.rest.short < 1 ? 'ok' : 'warn'),
    tip: `Por ley te corresponden al menos ${fN(LAW.weeklyRest, 1)} días de descanso por semana (unos ${fN((LAW.weeklyRest * DAYS_PER_MONTH) / 7, 1)} al mes), sin contar vacaciones. Se pueden juntar en periodos de hasta ${LAW.restPeriodWeeks} semanas.${r.rest.short >= 1 ? ` Con esta oferta trabajas unos ${fN(r.rest.short)} días ${overTxt} que deberían ser de descanso.` : ' Esta oferta lo cumple.'}`,
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
  const earnTip = `Nómina neta${p.vacationPay > 0.5 ? ' + vacaciones pagadas' : ''}${r.cash.total > 0 ? ' + lo que cobras en negro' : ''}${p.housing > 0.5 || p.food > 0.5 ? ' + lo que te ahorras en casa y comida' : ''}${p.km > 0.5 ? ' + los km que te pagan' : ''}${p.severance > 0.5 ? ' + la indemnización' : ''}${p.unemployment > 0.5 ? ' + el paro que generas' : ''}${r.expenses.total > 0.5 ? ' − tus gastos de coche y otros' : ''}, ${{ hour: 'repartido entre las horas que trabajas', day: 'repartido entre los días que trabajas', month: 'repartido entre los meses del contrato', total: 'en todo el contrato' }[unit]}.${p.unemployment > 0.5 ? ` El paro lo cobras al juntar ${LAW.unemployment.minDaysContributed} días cotizados.` : cfg.unemployment === false ? ' No incluye el paro.' : ''}`;
  // From gross to net payroll, on tapping «Nómina» (paid vacation has its own row)
  const netPay = p.base + p.extraPays;
  const grossPay = netPay / (r.pay.netFactor || 1);
  const payrollTip = [
    `Nómina bruta: ${money.figure(grossPay)}${p.extraPays > 0.5 ? ' (con las pagas extra)' : ''}`,
    `− Seguridad Social (${fN(cfg.ssPct, 1)}\u00a0%)${r.pay.irpf > 0.5 ? ` y retención de IRPF (${fN(r.pay.irpfPct * 100, 1)}\u00a0%)` : ''}: ${money.figure(grossPay - netPay)}`,
    `= Nómina neta: ${money.figure(netPay)}`,
    r.pay.irpf < 0.5
      ? 'Con lo que ganas en el año no te retienen IRPF.'
      : r.pay.irpf - r.pay.irpfYear > 1
        ? `Es la retención: en la renta te devolverían unos ${fE(r.pay.irpf - r.pay.irpfYear)}.`
        : 'Es la retención de IRPF de tu nómina.',
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
        ? `Los ${vacationDays} días de vacaciones que no disfrutas van dentro de lo que te pagan: unos ${fE(p.vacationPay)} netos. No se suman: es la parte del jornal que son vacaciones.`
        : `Los ${vacationDays} días de vacaciones que no disfrutas te los pagan al acabar: unos ${fE(p.vacationPay)} netos, aquí repartidos entre lo que trabajas.`,
    unemployment: `Esta oferta cotiza ${fN(r.unemployment.contribDays)} días y genera unos ${fN(r.unemployment.days)} días de paro. Lo cobras cuando juntes ${LAW.unemployment.minDaysContributed} días cotizados; aquí va repartido entre lo que trabajas. Se puede quitar en «Supuestos del cálculo».`,
  };
  const trip =
    o.mine.commute === 'daily'
      ? 'Vas y vuelves cada día trabajado'
      : `Subes al empezar y bajas al acabar${num(o.mine.tripsHome) > 0 ? `, y bajas a casa ${fTyped(o.mine.tripsHome)} ${num(o.mine.tripsHome) === 1 ? 'vez' : 'veces'} al mes` : ''}`;
  const fuelPerKm = (num(cfg.fuelUse) / 100) * num(cfg.fuelPrice);
  const carTip = `${fN(r.car.km)}\u00a0km ${r.time.noDuration ? 'al mes' : 'en todo el contrato'}. ${o.mine.car === 'noCar' ? '' : `${trip}: ${fN(num(o.mine.kmHome))}\u00a0km de ida y otros tantos de vuelta.`}${o.mine.car === 'own' && num(o.mine.kmWorkPerDay) > 0 ? ` Más ${fN(num(o.mine.kmWorkPerDay))}\u00a0km por día trabajado moviéndote con tu coche.` : ''} Cada km: ${fE(fuelPerKm, 2)} de gasolina (${fN(num(cfg.fuelUse), 1)} l/100 km a ${fE(num(cfg.fuelPrice), 2)}/l) + ${fE(num(cfg.wear), 2)} de desgaste. Tu coche se cambia en «Tus datos».`;

  // Rows that round to 0 € in this unit are not shown
  const shows = (x) => inUnit(x, r, unit) >= (unit === 'hour' ? 0.005 : 0.5);
  const cols = columns(r);
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
  const received = moneyParts.reduce((sum, part) => sum + part.value(p), 0);
  return {
    earnTip,
    html: html`
    <details class="plg" data-fold="breakdown2"><summary>Desglose<span class="stat dt">cobras <b>${fUnit(inUnit(r.earnings.received, r, cols.other), cols.other)}</b> ${cols.other === 'month' ? 'al mes' : 'en total'}</span></summary>
    ${incomeBar(r, incomeOf(r) || 1)}
    <div class="rows">
      ${row('', cols.header, { swatch: '', cls: 'hd' })}
      ${[
        ...moneyParts.map(partRow),
        ...(moneyParts.length > 1 && others.length
          ? [row('Cobras', cols.value(received), { swatch: '', cls: 'subt' })]
          : []),
        ...others.map(partRow),
      ]}
      ${shows(r.car.cost) ? row(withTip('Coche', carTip), cols.minus(r.car.cost), { swatch: 'expense', valueCls: 'minus' }) : nothing}
      ${shows(r.expenses.other) ? row('Otros', cols.minus(r.expenses.other), { swatch: 'expense', valueCls: 'minus' }) : nothing}
      ${row('Ganas', cols.value(r.earnings.total), { swatch: '', cls: 'tot' })}
    </div>
    </details>`,
  };
}

/**
 * The whole result of an offer, or what is still missing to show it. `readOnly` (another shepherd's offer): nothing to
 * complete, negotiate or copy.
 */
export function resultView(o, r, { readOnly = false } = {}) {
  const shortfall = missing(o.terms);
  if (shortfall.length)
    return html`<p class="empty">Para ver cuánto ganas falta ${joinAnd(shortfall.map((id) => MISSING_TEXT[id]))}. ${readOnly ? nothing : html`<button type="button" class="linkbtn" data-action="complete">Ponerlo</button>`}</p>`;
  const unit = offerUnit(r);
  const money = moneyIn(r, unit);
  const { earnTip, html: breakdownView } = breakdown(o, r, unit);
  const year = actualYear(o.terms);
  const line = legalLine(o, r);
  return html`${
    year !== r.year
      ? html`<p class="year-warning">Esta oferta es de ${year} y aún no están incluidos el salario mínimo ni el IRPF de ${year}: las cuentas usan los de ${r.year}.</p>`
      : ''
  }
    <h3 class="q">¿Cuánto ganas?</h3>
    <div class="tag"><span class="lbl tipl" data-tip=${earnTip} tabindex="0" role="button">Ganas ${UNITS[unit].label}</span><span class="tag-row"><span class="big">${money.figure(r.earnings.total)}</span>${
      r.stamp
        ? html`<a href="#secLegal" class=${STAMPS[r.stamp.code].warn ? 'stamp warn' : 'stamp'}>${stampLines(STAMPS[r.stamp.code].text)}</a>`
        : nothing
    }</span>${otherUnits(r, unit)}
      ${r.time.noDuration ? html`<span class="sub">Sin duración, se cuenta un mes</span>` : ''}</div>
    ${pills(o, r)}
    ${breakdownView}
    ${legalSection(o, r, money)}
    ${readOnly ? nothing : negotiationSection(o, r, money)}
    ${readOnly ? nothing : seasonEndSection(o, r)}
    <details class="plg" data-fold="workings"><summary>Las cuentas, paso a paso</summary><div class="doc">${workings(o, r)}</div></details>
    ${readOnly ? nothing : copyRow(line)}`;
}

const copyRow = (line) =>
  html`<div class="copyrow copies"><button type="button" class="sm" data-action="copyCard" title="Para mandarla por WhatsApp o guardarla en notas">Copiar ficha</button>${
    line
      ? html`<button type="button" class="sm" data-action="copyClaim" title="Para el sindicato, la inspección o tu propia nota">Copiar reclamación</button>`
      : nothing
  }<span class="hint" id="cardMsg"></span><span class="hint" id="claimMsg"></span></div>`;
