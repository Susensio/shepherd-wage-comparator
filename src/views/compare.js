/** The Comparar tab: the ranking, medals, head to head, weekly hours, and over time (trend and years). */

import { html, nothing, svg } from 'lit-html';
import { fCount, fDate, fE, fN, fTyped, isWorthCounting, joinAnd, num } from '../format.js';
import { LAW } from '../law.js';
import { yearShares } from '../model/calc.js';
import { DAYS_PER_MONTH, datesText, isComplete, missing, spanOf, workedOffers } from '../offer.js';
import { failuresOf, H_MAX, H_ORDINARY, LAW_SHORT } from '../rights.js';
import { MISSING_TEXT, MISSING_TEXT_THIRD, unpaidTime } from '../text.js';
import { fUnit, incomeOf, inUnit, isUnderAMonth, UNIT_ORDER, UNITS } from '../units.js';
import { incomeBar, legend, swatch } from './parts.js';

/** «Comparar dos»: whether it is on and which offers are picked. Not saved: every visit starts without it. */
export const pairing = { on: false, ids: /** @type {string[]} */ ([]) };

/** «Comparar por»: the unit that sorts and measures the Comparar rows. */
const unitPicker = (unit) =>
  html`<div class="view"><span class="view-l">Comparar por</span><div class="seg" role="radiogroup" aria-label="Comparar por">${UNIT_ORDER.map(
    (u) => html`<label><input type="radio" name="cmpUnit" value=${u} .checked=${u === unit}>${UNITS[u].pick}</label>`,
  )}</div></div>`;

/** Switch to the figures of the offers' terms alone, as they would be for anyone. Forced on by other shepherds' offers. */
const termsOnlySwitch = (on, forced) =>
  html`<div class="terms-only"><label><input type="checkbox" name="termsOnly" .checked=${on} ?disabled=${forced}>Solo las condiciones de la oferta</label>
    <p class="hint">${
      forced
        ? 'Con ofertas de otros pastores se comparan solo las condiciones, sin desplazamientos ni gastos de nadie.'
        : on
          ? 'Se calcula sin tus desplazamientos ni gastos, y con el IRPF como si no cobraras nada más ese año.'
          : 'Sin tus desplazamientos ni gastos.'
    }</p></div>`;

/** Whether to rank the offers other shepherds share, and how loading them went. Only offered when they can be read. */
const othersControl = ({ available, include, status, items }) =>
  available
    ? html`<div class="terms-only others-ctl"><label><input type="checkbox" name="includeOthers" .checked=${include}>Incluir ofertas de otros pastores</label>${
        include
          ? html`<p class="hint">${
              status === 'loading'
                ? 'Cargando las ofertas de otros pastores…'
                : status === 'error'
                  ? 'No se pudieron cargar las ofertas de otros pastores.'
                  : items.length
                    ? 'Aparecen con el nombre de quien las comparte.'
                    : 'Todavía no hay ofertas compartidas por otros pastores.'
            } <button type="button" class="linkbtn" data-action="refreshOthers">${status === 'error' ? 'Reintentar' : 'Actualizar'}</button></p>`
          : html`<p class="hint">Se comparan con las tuyas, sin tus desplazamientos ni gastos.</p>`
      }</div>`
    : nothing;

/** The button action that opens a row: your offer in the offers tab, another shepherd's read-only. */
const openAction = (x) => (x.sharer ? 'viewShared' : 'view');

/** How much of what you receive is cash: all on payroll, part, or all in cash. */
const cashText = (r) =>
  r.cash.total <= 0.5
    ? html`<span class="payroll">todo en nómina</span>`
    : r.noContract || r.cash.allCash
      ? html`<span class="cash">todo en negro</span>`
      : html`<span class="part">${fN(r.cash.share * 100)}\u00a0% en negro</span>`;

/**
 * What is legal about an offer, in two words. Not just «no cumple» (almost none complies) but what fails, which is
 * what tells them apart. Working hours are left out: the hours per week already show them, in their colour.
 */
function legalShort(o, r) {
  const failures = failuresOf(o, r);
  if (!failures) return nothing;
  const others = failures.filter((id) => id !== 'hours');
  if (others.length) return html`<span class="bad">✘ ${joinAnd(others.map((id) => LAW_SHORT[id]))}</span>`;
  return failures.length ? nothing : html`<span class="ok">✔ cumple</span>`;
}

/**
 * Medals: what each offer is best at, only with figures that compare whatever the duration (no totals). If more
 * than half tie, the medal tells nobody apart and is not given.
 */
function medals(list, unit) {
  const out = {};
  const kinds = [
    unit !== 'hour' && [(x) => x.r.earnings.perHour, 'max', 'más por hora'],
    [
      (x) => (x.r.time.hours > 0 ? (x.r.extra.daysUnpaid + x.r.extra.overtimeUnpaid) / x.r.time.hours : 0),
      'min',
      'menos sin pagar',
    ],
    [(x) => x.r.time.hoursPerWeek, 'min', 'menos horas'],
    [(x) => x.r.time.daysOffMonth, 'max', 'más días libres'],
    [(x) => x.r.cash.share, 'min', 'menos en negro'],
  ].filter(Boolean);
  for (const [value, best, title] of kinds) {
    const values = list.map(value);
    const top = best === 'max' ? Math.max(...values) : Math.min(...values);
    const winners = list.filter((_, i) => Math.abs(values[i] - top) < 0.005);
    if (winners.length > list.length / 2) continue;
    if (title === 'menos en negro' && top <= 0.005) continue; // with nothing in cash, «todo en nómina» already says it
    for (const x of winners) out[x.o.id] = [...(out[x.o.id] || []), title];
  }
  return out;
}

/** Head to head: the two offers picked, row by row and in blocks; the better one in each row, in green. */
function headToHead(list) {
  if (!pairing.on || list.length < 2) return nothing;
  pairing.ids = pairing.ids.filter((id) => list.some((x) => x.o.id === id)); // in case one was deleted
  if (pairing.ids.length < 2) return nothing;
  const [a, b] = pairing.ids.map((id) => list.find((x) => x.o.id === id));
  const say = (you, they) => (a.sharer || b.sharer ? they : you); // a column of another shepherd's: impersonal
  const debt = (x) => (isWorthCounting(x.r.debt.owed) ? x.r.debt.owed * x.r.netFactor : 0);
  // Totals only compare when both last about the same (under 10 % apart): otherwise the longer one always wins
  const similar =
    !a.r.time.noDuration &&
    !b.r.time.noDuration &&
    Math.abs(a.r.time.natDays - b.r.time.natDays) <= 0.1 * Math.max(a.r.time.natDays, b.r.time.natDays);
  const duration = (x) =>
    x.r.time.noDuration
      ? 'sin saber'
      : x.o.terms.durationUnit === 'days'
        ? `${fTyped(x.o.terms.duration)} días`
        : `${fTyped(x.o.terms.duration)} ${num(x.o.terms.duration) === 1 ? 'mes' : 'meses'}`;
  const orDash = (format) => (v) => (Number.isFinite(v) ? format(v) : '–');
  const perMonthOk = (x) => x.r.time.noDuration || !isUnderAMonth(x.r);
  // Blocks of [what, value, format, best: 'max', 'min' or '' (information, no winner)]
  /** @type {[string, any[]][]} */
  const groups = [
    [
      'Dinero',
      [
        [say('Ganas por hora', 'Se gana por hora'), (x) => x.r.earnings.perHour, (v) => fE(v, 2), 'max'],
        [
          say('Ganas al mes', 'Se gana al mes'),
          (x) => (perMonthOk(x) ? x.r.earnings.perMonth : Number.NaN),
          orDash(fE),
          'max',
        ],
        [
          say('Te entra al mes', 'Entra al mes'),
          (x) => (perMonthOk(x) ? x.r.earnings.received / (x.r.time.months || 1) : Number.NaN),
          orDash(fE),
          'max',
        ],
        similar && [
          say('Ganas en total', 'Se gana en total'),
          (x) => (x.r.time.noDuration ? Number.NaN : x.r.earnings.total),
          orDash(fE),
          'max',
        ],
        similar && [
          say('Te entra en total', 'Entra en total'),
          (x) => (x.r.time.noDuration ? Number.NaN : x.r.earnings.received),
          orDash(fE),
          'max',
        ],
      ],
    ],
    [
      'Tiempo',
      [
        !similar && [
          'Duración',
          (x) => (x.r.time.noDuration ? Number.NaN : x.r.time.natDays),
          (_, x) => duration(x),
          '',
        ],
        ['Horas a la semana', (x) => x.r.time.hoursPerWeek, (v) => `${fN(v)} h`, 'min'],
        ['Jornadas sin pagar', (x) => unpaidTime(x.r).days, (v) => (v >= 0.5 ? fCount(v) : 'ninguna'), 'min'],
        [
          'Horas extra sin pagar, a la semana',
          (x) => unpaidTime(x.r).hours,
          (v) => (v >= 0.5 ? `${fN(v)} h` : 'ninguna'),
          'min',
        ],
        ['Días libres al mes', (x) => x.r.time.daysOffMonth, (v) => fCount(v), 'max'],
      ],
    ],
    [
      'Derechos',
      [
        ['En negro', (x) => x.r.cash.share, (v) => (v <= 0.005 ? 'nada' : `${fN(v * 100)} %`), 'min'],
        [say('Te deben', 'Se le deben'), debt, (v) => (isWorthCounting(v) ? fE(v) : 'nada'), 'min'],
        similar && [
          'Paro que genera',
          (x) => x.r.unemployment.days,
          (v) => (v >= 0.5 ? `${fN(v)} días` : 'nada'),
          'max',
        ],
      ],
    ],
  ];
  // Rows where both say the same do not help decide and are left out; so is a block left without rows
  const rows = groups.map(([title, lines]) => {
    const shown = lines.filter(Boolean).flatMap(([label, value, format, best]) => {
      const va = value(a);
      const vb = value(b);
      const ta = format(va, a);
      const tb = format(vb, b);
      if (ta === tb) return [];
      const winner =
        best && Number.isFinite(va) && Number.isFinite(vb) ? ((best === 'max' ? va > vb : va < vb) ? 'a' : 'b') : '';
      return [
        html`<tr><th>${label}</th><td class=${winner === 'a' ? 'wins' : ''}>${ta}</td><td class=${winner === 'b' ? 'wins' : ''}>${tb}</td></tr>`,
      ];
    });
    return shown.length ? html`<tr class="group"><th colspan="3">${title}</th></tr>${shown}` : nothing;
  });
  const header = (x) =>
    html`<th><button type="button" class="linkbtn" data-action=${openAction(x)} data-id=${x.o.id}>${x.o.mine.name}</button></th>`;
  return html`<div class="pair" id="pairBlk"><div class="pair-head"><h4 class="sub">Cara a cara</h4><button type="button" class="linkbtn" data-action="closePair">Cerrar</button></div>
    <table class="table pair-t"><thead><tr><th></th>${header(a)}${header(b)}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** Hours per week: the normal ones and, in a stronger colour, the extra ones (extra days and overtime). */
function hoursView(list) {
  const limit = LAW.weeklyHours;
  const cap = Math.max(limit, ...list.map((x) => x.r.time.hoursPerWeek));
  const pct = (v) => (v / cap) * 100;
  const rows = [...list]
    .sort((a, b) => a.r.time.hoursPerWeek - b.r.time.hoursPerWeek)
    .map((x) => {
      const { o, r } = x;
      const weeks = (r.time.noDuration ? DAYS_PER_MONTH : r.time.natDays) / 7;
      const total = r.time.hoursPerWeek;
      const extra = Math.min(total, weeks > 0 ? r.extra.hours / weeks : 0);
      const normal = total - extra;
      return html`<button type="button" class="hr" data-action=${openAction(x)} data-id=${o.id}><b>${o.mine.name}</b><span class="v">${fN(total)} h</span>
      <span class="hbar"><i class="ok" style="left:0;width:${pct(normal)}%"></i>${
        extra >= 0.5 ? html`<i class="unpaid" style="left:${pct(normal)}%;width:${pct(extra)}%"></i>` : nothing
      }<s style="left:${pct(limit)}%"></s></span></button>`;
    });
  const anyExtra = list.some((x) => x.r.extra.hours > 0.5);
  return html`<h4 class="sub">Horas a la semana</h4><div class="lst hours">${rows}</div>
    <p class="legend"><span>${swatch('--c-work')}Horas normales</span>${
      anyExtra ? html`<span>${swatch('--c-work-extra')}Horas de más</span>` : nothing
    }<span><i class="lg-line"></i>${limit} h, máximo legal</span></p>`;
}

/**
 * Comparar: the ranking in the chosen unit (tap a row to see the offer), the best at each thing and the weekly hours.
 * @param {{o: object, r: object, sharer?: object}[]} all your offers and, with `sharer`, other shepherds' ones, with their figures
 * @param {string} unit
 * @param {boolean} termsOnly show the figures of the terms alone
 * @param {{available: boolean, include: boolean, status: string, items: object[]}} others other shepherds' offers
 * @returns {{picker: unknown, body: unknown, more: unknown}}
 */
export function compareView(all, unit, termsOnly, others) {
  const U = UNITS[unit];
  // Without a duration there is no total: those go last
  const sortValue = (r) => {
    const v = unit === 'total' && r.time.noDuration ? Number.NaN : r.earnings[U.key];
    return Number.isFinite(v) ? v : -1e12;
  };
  const list = all.filter(({ o }) => isComplete(o.terms)).sort((a, b) => sortValue(b.r) - sortValue(a.r));
  const controls = othersControl(others);
  if (list.length < 2) {
    const incomplete = all.filter(({ o }) => !isComplete(o.terms));
    return {
      picker: nothing,
      body: html`${controls}<p class="empty">${
        all.length < 2
          ? 'Añade otra oferta con «+ Nueva» para compararlas.'
          : `Para compararlas hacen falta dos ofertas completas. ${incomplete.map((x) => `A «${x.o.mine.name || 'Oferta'}» le falta ${joinAnd(missing(x.o.terms).map((id) => (x.sharer ? MISSING_TEXT_THIRD : MISSING_TEXT)[id]))}.`).join(' ')}`
      }</p>`,
      more: nothing,
    };
  }
  const atRate = (r) => unit === 'month' && isUnderAMonth(r); // shorter than a month: «al mes» is at that rate
  const figure = (r) =>
    sortValue(r) <= -1e11
      ? '–'
      : `${fUnit(r.earnings[U.key], unit)}${U.key === 'total' ? '' : U.suffix}${atRate(r) ? '*' : ''}`;
  // Colour bars like the offer's, in the same unit: what is left unhatched is the row's figure
  const per = (r) => {
    const d = unit === 'total' && r.time.noDuration ? r.time.months : U.per(r);
    return d > 0 ? d : 1;
  };
  const max = Math.max(...list.map(({ r }) => incomeOf(r) / per(r)), 1e-9);
  const medalsOf = medals(list, unit);
  const rows = list.map((x, n) => {
    const { o, r } = x;
    const debt = r.debt.owed * r.netFactor;
    const picked = pairing.ids.includes(o.id);
    const hoursCls = r.time.hoursPerWeek <= H_ORDINARY ? '' : r.time.hoursPerWeek <= H_MAX ? 'warn' : 'bad';
    const content = html`<span class="n">${pairing.on ? (picked ? '●' : '○') : n + 1}</span><b>${o.mine.name}${o.terms.offerOnly ? html` <small>(solo oferta)</small>` : nothing}</b><span class="v">${figure(r)}</span>
      ${medalsOf[o.id]?.length ? html`<span class="medals">${medalsOf[o.id].map((t) => html`<span>${t}</span>`)}</span>` : nothing}${incomeBar(r, max, per(r))}
      <span class="det">${x.sharer ? html`<span class="who">otro pastor</span>` : nothing}${r.noContract ? nothing : cashText(r)}${legalShort(o, r)}<span class=${hoursCls}>${fN(r.time.hoursPerWeek)}\u00a0h/sem</span>${
        isWorthCounting(debt)
          ? html`<span class="bad">${x.sharer ? 'se le deben' : 'te deben'} ${isUnderAMonth(r) ? `${fE(debt)} en total` : `${fE(inUnit(debt, r, 'month'))} al mes`}</span>`
          : nothing
      }</span>`;
    return pairing.on
      ? html`<button type="button" class=${picked ? 'lr pickable picked' : 'lr pickable'} data-action="pickPair" aria-pressed=${String(picked)} data-id=${o.id}>${content}</button>`
      : html`<button type="button" class=${x.sharer ? 'lr other' : 'lr'} data-action=${openAction(x)} data-id=${o.id}>${content}</button>`;
  });
  const mode = pairing.on
    ? html`<div class="cmp-mode"><span>${pairing.ids.length === 2 ? 'Comparando:' : pairing.ids.length ? 'Marca otra oferta.' : 'Marca dos ofertas.'}</span><button type="button" class="linkbtn" data-action="closePair">Cancelar</button></div>`
    : html`<div class="cmp-mode"><span>Toca una oferta para verla.</span><button type="button" class="sm" data-action="startPair">Comparar dos</button></div>`;
  return {
    picker: unitPicker(unit),
    body: html`${controls}${termsOnlySwitch(termsOnly, others.available && others.include)}${legend(list.map((x) => x.r))}${mode}<div class="lst">${rows}</div>
    ${list.some((x) => atRate(x.r)) ? html`<p class="hint">* Menos de un mes: lo que ganarías a ese ritmo en un mes entero.</p>` : nothing}
`,
    // After the «Otros pastores» section, which sits right under the ranking
    more: html`${headToHead(list)}${hoursView(list)}`,
  };
}

/* --- Over time --- */

const DAY_MS = 864e5;

/** A round axis step: 1, 2, 2.5 or 5 times a power of 10. */
function axisStep(x) {
  const p = 10 ** Math.floor(Math.log10(x || 1));
  const m = x / p;
  return p * (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10);
}

/**
 * What you earn over time, in the Comparar unit: a segment per job from its first to its last day and, between them,
 * a faint curve. The axis fits your figures; it does not start at 0.
 * @param {{o: object, r: object}[]} all
 * @param {string} unit
 * @param {number} width the width available, in px
 */
export function trendView(all, unit, width) {
  const U = UNITS[unit];
  // The legal minimum in the unit, net of the worker's Social Security only
  const minimumIn = (o, r) => {
    const bonus = o.terms.overnight === 'yes' ? 1 + LAW.overnightPct / 100 : 1;
    const annual = r.wage.annual;
    const base =
      unit === 'hour'
        ? annual / LAW.annualHours
        : unit === 'day'
          ? (annual / LAW.annualHours) * LAW.workdayHours
          : unit === 'month'
            ? annual / 12
            : (r.min.salary + r.min.vacation) / bonus;
    return base * bonus * (1 - LAW.ssWorkerPct / 100);
  };
  const points = all
    .filter(({ o }) => o.terms.start && isComplete(o.terms))
    .map(({ o, r }) => {
      const d = U.per(r);
      const [start, end] = spanOf(o.terms);
      return { o, r, a: +start, b: +end + DAY_MS, m: minimumIn(o, r), y: d > 0 ? r.earnings.total / d : Number.NaN };
    })
    .filter((p) => Number.isFinite(p.y) && p.m > 0 && !(unit === 'total' && p.r.time.noDuration))
    .sort((p, q) => p.a - q.a);
  if (!points.length) return nothing;

  const W = Math.max(280, Math.round(width || 360));
  const H = 180;
  const M = { l: 52, r: 10, t: 22, b: 24 };
  let x0 = Math.min(...points.map((p) => p.a));
  let x1 = Math.max(...points.map((p) => p.b));
  const pad = Math.max((x1 - x0) * 0.03, 5 * DAY_MS);
  x0 -= pad;
  x1 += pad;
  const years = [];
  for (let y = new Date(x0).getFullYear(); y <= new Date(x1).getFullYear(); y++) years.push(y);
  const yMin = Math.min(...points.map((p) => p.y));
  const yMax = Math.max(...points.map((p) => p.y));
  const step = axisStep((yMax - yMin) / 4 || yMax / 8 || 1);
  const lo = Math.max(0, Math.floor(yMin / step) * step - step);
  const hi = Math.ceil(yMax / step) * step + step;
  const X = (v) => M.l + ((v - x0) / (x1 - x0)) * (W - M.l - M.r);
  const Y = (v) => H - M.b - ((v - lo) / (hi - lo)) * (H - M.t - M.b);
  const euros = (v) => fE(v, unit === 'hour' ? 2 : 0);

  const grid = [];
  for (let v = lo; v <= hi + 1e-9; v += step)
    grid.push(
      svg`<line class="grid" x1=${M.l} x2=${W - M.r} y1=${Y(v)} y2=${Y(v)}/><text class="axis" x=${M.l - 6} y=${Y(v) + 4} text-anchor="end">${fN(v, v % 1 ? 1 : 0)}\u00a0€</text>`,
    );
  const yearLabels =
    years.length > 1
      ? years.map((y) => {
          const a = Math.max(x0, +new Date(y, 0, 1));
          const b = Math.min(x1, +new Date(y + 1, 0, 1));
          return svg`<text class="axis" x=${X((a + b) / 2)} y=${H - 6} text-anchor="middle">${y}</text>`;
        })
      : svg`<text class="axis" x=${M.l} y=${H - 6} text-anchor="start">${fDate(new Date(x0 + pad))}</text><text class="axis" x=${W - M.r} y=${H - 6} text-anchor="end">${fDate(new Date(x1 - pad - DAY_MS))}</text>`;
  const jobs = points.filter((p) => !p.o.terms.offerOnly);
  const offersOnly = points.filter((p) => p.o.terms.offerOnly);
  const xEnd = (p) => Math.max(X(p.b - DAY_MS), X(p.a) + 3);
  const steps = jobs
    .slice(1)
    .map((p, i) => {
      const q = jobs[i];
      const xa = xEnd(q);
      const ya = Y(q.y);
      const xc = X(p.a);
      const yc = Y(p.y);
      const mid = (xa + xc) / 2;
      return xc - xa < 1 ? `M${xa},${ya}L${xc},${yc}` : `M${xa},${ya}C${mid},${ya} ${mid},${yc} ${xc},${yc}`;
    })
    .join('');
  const tip = (p) =>
    `${p.o.mine.name} · ${datesText(p.o.terms)}${p.o.terms.offerOnly ? ' (solo era una oferta)' : ''}: ganas ${euros(p.y)} ${U.label}, el ${fN((p.y / p.m) * 100)} % del mínimo legal${p.o.terms.overnight === 'yes' ? ' con pernocta' : ''} (${euros(p.m)} en neto, SMI ${p.r.wage.year}).`;
  return html`<div class="trend"><h4 class="sub">Lo que ganas ${U.label}, en el tiempo</h4>
    <svg viewBox="0 0 ${W} ${H}" width=${W} height=${H} role="img" aria-label="Lo que ganas ${U.label} en cada trabajo, en el tiempo">${grid}${yearLabels}<path class="line step" d=${steps}/><path class="line" d=${jobs
      .map((p) => `M${X(p.a)},${Y(p.y)}H${xEnd(p)}`)
      .join(
        '',
      )}/>${offersOnly.map((p) => svg`<path class="offer-only" d="M${X(p.a)},${Y(p.y)}H${xEnd(p)}"/>`)}${points.map(
      (p) =>
        svg`<text class=${p.o.terms.offerOnly ? 'nm offer-only-t' : 'nm'} x=${(X(p.a) + xEnd(p)) / 2} y=${Y(p.y) - 7} text-anchor="middle">${p.o.mine.name}</text>`,
    )}${points.map(
      (p) =>
        svg`<rect class="hit" data-tip=${tip(p)} tabindex="0" role="button" x=${X(p.a) - 4} y=${Y(p.y) - 16} width=${xEnd(p) - X(p.a) + 8} height="28"/>`,
    )}</svg>
    ${offersOnly.length ? html`<p class="hint">En raya, las que solo eran ofertas.</p>` : nothing}</div>`;
}

/**
 * What was worked each year: days, money, what you earn and contributions. Each contract is split by days between
 * the years it touches; offers you did not work are left out.
 */
export function yearlyView(all) {
  const byYear = {};
  const worked = new Set(workedOffers(all.map((x) => x.o)));
  for (const { o, r } of all) {
    if (!worked.has(o) || !isComplete(o.terms) || o.terms.durationUnit === 'unknown') continue;
    for (const [year, share] of Object.entries(yearShares(o.terms)))
      byYear[year] = [...(byYear[year] || []), { r, share }];
  }
  const years = Object.keys(byYear).sort().reverse();
  if (!years.length) return nothing;
  const columns = years.map((year) => {
    const items = byYear[year];
    const sum = (fn) => items.reduce((s, { r, share }) => s + fn(r) * share, 0);
    const money = sum((r) => r.earnings.received);
    const hours = sum((r) => r.time.hours);
    return {
      year,
      jobs: items.length,
      days: sum((r) => r.time.daysWorked),
      money,
      cash: sum((r) => r.cash.total),
      perHour: hours > 0 ? money / hours : 0,
      earned: sum((r) => r.earnings.total),
      contrib: sum((r) => r.unemployment.contribDays),
    };
  });
  const row = (label, cell) => html`<tr><th>${label}</th>${columns.map((c) => html`<td>${cell(c)}</td>`)}</tr>`;
  return html`<div class="yearly"><h4 class="sub">Año a año</h4><div class="tablew"><table class="table">
    <thead><tr><th></th>${columns.map((c) => html`<th>${c.year}<small>${c.jobs === 1 ? '1 trabajo' : `${c.jobs} trabajos`}</small></th>`)}</tr></thead><tbody>
    ${row('Días trabajados', (c) => fN(c.days))}
    ${row('Dinero que cobras', (c) => fE(c.money))}
    ${columns.some((c) => c.cash > 0.5) ? row('de ello, en negro', (c) => (c.cash > 0.5 ? `${fN((c.cash / c.money) * 100)}\u00a0%` : '—')) : nothing}
    ${row('Dinero por hora', (c) => fE(c.perHour, 2))}
    ${row('Lo que ganas', (c) => fE(c.earned))}
    ${row('Días cotizados', (c) => fN(c.contrib))}
    </tbody></table></div><p class="hint">Sin las que solo eran ofertas. Si un contrato pasa de un año a otro, se reparte por días.</p></div>`;
}
