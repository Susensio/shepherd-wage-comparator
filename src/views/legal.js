/** «¿Es legal?»: the verdict, what you are owed, the extra days and hours, and each right with its source. */

import { html, nothing } from 'lit-html';
import { capitalize, f1, fCount, fDate, fDays, fE, fN, fTyped, isWorthCounting, joinAnd } from '../format.js';
import { citeOf, LAW } from '../law.js';
import { claimDeadlines, hoursWeek } from '../model/time.js';
import { LAW_SHORT, LAW_SOURCE, rightsOf } from '../rights.js';
import { unpaidTime } from '../text.js';
import { inUnit, UNITS } from '../units.js';
import { voiceOf } from '../voice.js';
import { figureCard, marker, row, segmentBar, unitSuffix, withTip } from './parts.js';

/** Deadline to claim: each payment, `LAW.claimYears` after it was due. Only with dates. */
function claimDeadline(o, debt, third) {
  const deadlines = claimDeadlines(o.terms);
  if (!deadlines || !isWorthCounting(debt)) return nothing;
  const { from, until } = deadlines;
  const period = LAW.claimYears === 1 ? 'un año' : `${LAW.claimYears} años`;
  const expired = until < new Date();
  return html`<details class="detail deadline"><summary>Hasta cuándo ${third ? 'se puede' : 'puedes'} reclamar</summary><p class=${expired ? 'hint bad' : 'hint'}>${
    expired
      ? `El plazo para reclamarlo acabó el ${fDate(until)}: cada pago se puede reclamar durante ${period}.`
      : `Cada pago se puede reclamar durante ${period} (${citeOf('et', '59.2').label}): ${+from === +until ? `hasta el ${fDate(until)}` : `lo del primer mes, hasta el ${fDate(from)}; lo del último, hasta el ${fDate(until)}`}.`
  }</p></details>`;
}

/** Why you are owed what you are owed: one item in a subtitle, or one row per item. */
function owedReasons(o, r, money) {
  const { salary, overnight, vacation } = r.debt.parts;
  const reasons = [
    isWorthCounting(salary) && [`el salario mínimo${r.min.casual ? ' de temporero' : ''}`, salary],
    isWorthCounting(overnight) && [`el plus de pernocta (${fN(LAW.overnightPct)} %)`, overnight],
    isWorthCounting(vacation) && [
      o.terms.vacation === 'paidAtEnd' ? 'parte de las vacaciones' : 'las vacaciones, que no caben en el jornal',
      vacation,
    ],
  ].filter(Boolean);
  if (reasons.length === 1) return { single: reasons[0][0], rows: null };
  return {
    single: '',
    rows: html`<div class="rows sv-rows">${row('En nómina faltan', `${capitalize(UNITS[money.unit].short)}, netos`, { cls: 'hd' })}${reasons.map(([text, value]) => row(capitalize(text), money.net(value)))}</div>`,
  };
}

/**
 * The owed card at a glance: the legal minimum against what you are paid on payroll, what cash covers and what is
 * missing, in net. For the item that is missing: salary with the bonus, or vacation.
 */
function minimumBar(r, money) {
  const toUnit = (x) => inUnit(x, r, money.unit);
  const net = (x) => toUnit(x) * money.factor;
  const salary = isWorthCounting(r.debt.salary);
  const min = salary ? r.min.salary + r.min.overnight : r.min.vacation;
  const paid = salary ? r.pay.salary : r.pay.vacationPay;
  const shortfall = salary ? r.debt.salary : r.debt.vacation;
  const left = Math.max(0, shortfall - (r.cash.total > 0 ? r.cash.grossEq : 0));
  const cash = salary ? r.cash.total : 0;
  const scale = Math.max(net(min), net(paid) + toUnit(cash) + net(left));
  const euros = (x) => fE(x);
  return html`<div class="br">
    <div class="br-l">Mínimo${salary ? (r.min.overnight > 0.5 ? ', con el plus de pernocta' : '') : ' de las vacaciones'}: <b>${euros(net(min))}</b> <small>${UNITS[money.unit].short}, netos</small></div>
    <div class="br-mw">${segmentBar(
      [
        ['t', net(paid), 'en nómina'],
        ['m', toUnit(cash), 'en negro'],
        ['x', net(left), 'falta'],
      ],
      scale,
      euros,
      14,
    )}${marker((net(min) / scale) * 100, 'mínimo', true)}</div>
  </div>`;
}

/**
 * The most serious issue. Without a contract, the unemployment benefit you do not generate; otherwise what you are
 * owed, counting cash; and if cash covers it, the payroll still below the minimum.
 */
function owedCard(o, r, money, third) {
  const say = voiceOf(third);
  const per = UNITS[money.unit].short;
  const debt = r.debt.total;
  if (r.noContract) {
    const lost = r.unemployment.lost;
    const reasons = [
      isWorthCounting(r.debt.vacation) &&
        `Sin contrato no ${say('te pagan', 'se pagan')} las vacaciones que ${say('te', 'le')} corresponden (${fDays(r.time.vacationDays)}): ${say('te deben', 'se le deben')} unos ${money.netAll(r.debt.vacation)} netos.`,
      isWorthCounting(r.debt.salary) &&
        `Lo que ${say('te dan', 'se da')} no llega al salario mínimo: ${say('te deben', 'se le deben')} ${money.net(r.debt.salary)} ${per}.`,
      say(
        'Sin jubilación ni bajas pagadas: si te pones malo o te haces daño, no cobras.',
        'Sin jubilación ni bajas pagadas: en caso de enfermedad o accidente, no se cobra.',
      ),
    ].filter(Boolean);
    return html`<div class="owed">${
      lost.euros >= 1
        ? figureCard(
            fE(lost.euros),
            say('De paro que no generas', 'De paro que no se genera'),
            `Unos ${fDays(lost.days)} de prestación · sin contrato ${say('no cotizas', 'no se cotiza')}`,
            'Ilegal',
          )
        : figureCard(
            html`${fN(lost.days)}<small> días</small>`,
            say('De paro que no generas', 'De paro que no se genera'),
            `Sin contrato ${say('no cotizas', 'no se cotiza')}`,
            'Ilegal',
          )
    }
      <ul class="reasons">${reasons.map((t) => html`<li>${t}</li>`)}</ul>
      <p class="hint">Para que sea legal: contrato, alta en la Seguridad Social${isWorthCounting(debt) ? ` y un salario de al menos ${money.figure(r.debt.minNetNoContract)} netos ${per}` : ''}.</p>${isWorthCounting(debt) ? claimDeadline(o, debt, third) : nothing}</div>`;
  }
  if (!isWorthCounting(debt)) return nothing;
  const reasons = owedReasons(o, r, money);
  const owed = r.debt.owed;
  if (isWorthCounting(owed)) {
    const total =
      money.unit !== 'total' && !r.time.noDuration && money.netAll(owed) !== money.net(owed)
        ? `${money.netAll(owed)} en todo el contrato`
        : '';
    const sub = [
      reasons.single && capitalize(reasons.single),
      total,
      r.cash.total > 0 && `contando lo que ${say('cobras', 'se cobra')} en negro`,
    ]
      .filter(Boolean)
      .join(' · ');
    return html`<details class="owed" data-fold="owed"><summary>${figureCard(
      html`${withTip(money.net(owed), `Netos. En bruto: ${money.figure(owed)} ${per}.`)}${unitSuffix(money.unit)}`,
      say('Te deben', 'Se le deben'),
      sub,
      'Ilegal',
    )}</summary>${reasons.rows || minimumBar(r, money)}${claimDeadline(o, owed, third)}</details>`;
  }
  return html`<details class="owed" data-fold="owed"><summary>${figureCard(
    html`${money.net(debt)}${unitSuffix(money.unit)}`,
    reasons.single ? capitalize(`falta ${reasons.single.replace(/ \(.*\)$/, '')}`) : 'Nómina bajo el mínimo',
    `${reasons.single ? 'En nómina. ' : ''}Lo cobrado en negro lo cubre, pero no cotiza.`,
    'Ilegal',
  )}</summary>${reasons.rows || minimumBar(r, money)}</details>`;
}

/** The extra days in one bar: due days worked, extra days and days off; the marker shows how far they are paid. */
function extraDaysBar(r, third) {
  const days = r.extraDays;
  const k = days.worked < 10 ? 10 : 1;
  const round = (x) => Math.round(x * k) / k;
  const contract = round(r.time.natDays);
  const regular = Math.min(days.worked, days.due);
  const free = Math.max(0, round(contract - days.worked));
  const scale = Math.max(contract, days.worked);
  const paid = Math.max(0, days.extra - (unpaidTime(r).days || 0));
  return html`<div class="br">
    <div class="br-mw">${segmentBar(
      [
        ['w', regular, 'laborables'],
        ['wx', days.extra, 'extra'],
        ['l', free, third ? 'libres' : 'libras'],
      ],
      scale,
    )}${days.extra >= 1 ? marker(((regular + paid) / scale) * 100, 'pagado', true, ((regular + days.extra) / scale) * 100) : nothing}</div>
  </div>`;
}

/** A working week: the normal hours and those above 40; the marker shows how far they are paid. */
function hoursBar(r) {
  const x = r.extra;
  const { days, hoursPerDay, total, normal, restDays, beyond } = hoursWeek(x);
  const paidBeyond = x.overtimeValue > 0 ? beyond * Math.max(0, 1 - x.overtimeUnpaid / x.overtimeValue) : 0;
  const paidRestDays = x.daysValue > 0 ? restDays * Math.max(0, 1 - x.daysUnpaid / x.daysValue) : restDays;
  const hours = (h) => `${f1(h)} h`;
  return html`<div class="br">
    <div class="br-l">Una semana: ${f1(days)} días de ${fTyped(hoursPerDay)} h, <b>${hours(total)}</b></div>
    <div class="br-mw">${segmentBar(
      [
        ['w', normal, 'normales'],
        ['wx', restDays + beyond, 'extra'],
      ],
      total,
      hours,
      13,
    )}${restDays + beyond > 0.05 ? marker(((normal + paidRestDays + paidBeyond) / total) * 100, 'pagado', true) : nothing}</div>
  </div>`;
}

/** How much of their value extra time is paid, with nuance: missing almost nothing is not missing almost everything. */
const payStatus = (unpaid, value) => {
  const share = value > 0 ? 1 - unpaid / value : 1;
  return !isWorthCounting(unpaid)
    ? 'paid'
    : share >= 0.85
      ? 'casi todas pagadas'
      : share > 0.02
        ? 'mal pagadas'
        : 'sin pagar';
};
const payMark = (status, third) =>
  status === 'paid'
    ? third
      ? 'lo que se paga de más las cubre'
      : 'lo que te pagan de más las cubre'
    : html`<b class=${status === 'casi todas pagadas' ? 'almost' : 'bad-pay'}>${status}</b>`;
const PAY_STAMP = {
  'sin pagar': 'Sin pagar',
  'mal pagadas': 'Mal pagados',
  'casi todas pagadas': 'Casi pagados',
  paid: '',
};

/** The extra days (the solid part) and the hours over 40 a week, each in its card with its bar. */
function extraTimeCards(r, third) {
  if (!(r.pay.gross > 0 || r.noContract)) return nothing;
  const x = r.extra;
  const days = r.extraDays.extra;
  const over = r.time.noDuration ? 'En un mes' : 'En todo el contrato';
  const cards = [];
  if (x.daysValue > 0 && days >= 1) {
    const status = payStatus(x.daysUnpaid, x.daysValue);
    cards.push(html`<details class="owed warn" data-fold="law-days"><summary>${figureCard(
      html`${fCount(days)}<small> ${fCount(days) === '1' ? 'día' : 'días'}</small>`,
      'Jornadas de más',
      html`${over} · ${payMark(status, third)}`,
      PAY_STAMP[status],
    )}</summary>
      ${extraDaysBar(r, third)}</details>`);
  }
  if (x.overtime >= 0.5) {
    const status = payStatus(x.overtimeUnpaid, x.overtimeValue);
    cards.push(
      html`<details class="owed warn" data-fold="law-hours"><summary>${figureCard(
        html`${fN(x.over40PerWeek)}<small> h</small><small class="u">/sem</small>`,
        'Horas extra',
        html`Por encima de ${LAW.weeklyHours} h a la semana · ${payMark(status, third)}`,
        'Estimado',
      )}</summary>${hoursBar(r)}</details>`,
    );
  }
  return cards;
}

const RIGHT_ICON = { true: ['ok', '✔'], false: ['bad', '✘'], warn: ['warn', '!'], null: ['off', 'i'] };
const WARN_TEXT = { hours: 'las horas extra se tienen que pagar', vacation: 'las vacaciones se tienen que librar' };

/** «¿Es legal?» */
export function legalSection(o, r, money, third = false) {
  const rights = rightsOf(o, r, money.unit, third);
  if (!rights) return nothing;
  const failures = rights.filter((x) => x.status === false);
  const warnings = rights.filter((x) => x.status === 'warn');
  const passed = rights.filter((x) => x.status === true);
  const headline = r.noContract
    ? 'Sin contrato no es legal'
    : failures.length
      ? 'Esta oferta no cumple la ley'
      : warnings.length
        ? `Cumple lo básico, pero ${joinAnd(warnings.map((x) => WARN_TEXT[x.id] || x.title.toLowerCase()))}`
        : 'Esta oferta cumple lo básico';
  const sourceOf = (id) => (id === 'salary' ? { url: r.wage.url, label: r.wage.decree } : LAW_SOURCE[id]);
  const item = ({ id, status, title, text }) => {
    const [cls, icon] = RIGHT_ICON[status];
    const source = sourceOf(id);
    return html`<li class="law"><span class="ic ${cls}" aria-hidden="true">${icon}</span><div><b>${title}</b><span>${text}${
      source ? html` <a class="lawlink" href=${source.url} target="_blank" rel="noopener">${source.label}</a>` : nothing
    }</span></div></li>`;
  };
  return html`<section class="legal" id="secLegal" aria-label="¿Es legal esta oferta?">
    <h3 class="q">¿Es legal?</h3>
    <p class="verdict ${failures.length ? 'bad' : warnings.length ? 'warn' : 'ok'}">${headline}</p>
    ${failures.length ? html`<p class="failures">${failures.map((x) => html`<span>✘ ${capitalize(LAW_SHORT[x.id] || x.title)}</span>`)}</p>` : ''}
    ${owedCard(o, r, money, third)}
    ${extraTimeCards(r, third)}
    <details class="plg" data-fold="laws"><summary>Lo que dice la ley</summary><ul class="laws">${rights
      .filter((x) => x.status !== true)
      .map(
        item,
      )}</ul>${passed.length ? html`<p class="hint">✔ Cumple: ${joinAnd(passed.map((x) => x.title.toLowerCase()))}.</p>` : nothing}</details>
    <p class="hint">Dónde reclamar (sindicato, Inspección de Trabajo): <button type="button" class="linkbtn" data-action="tab" data-tab="laws">en «Leyes»</button>.</p>
  </section>`;
}
