/** Small pieces the views are built from: rows of figures, figure cards, bars and explanations on tap. */

import { html, nothing, svg } from 'lit-html';
import { capitalize, fCount, fE } from '../format.js';
import { fUnit, incomeOf, inUnit, isUnderAMonth, PARTS } from '../model/units.js';

/** Content that explains itself when tapped (dotted underline). */
export const withTip = (content, tip) =>
  tip ? html`<span class="tipl" data-tip=${tip} tabindex="0" role="button">${content}</span>` : content;

/** Colour swatch of a part, or the hatching of expenses. */
export const swatch = (color) =>
  color === 'expense'
    ? html`<span class="sw expense"></span>`
    : html`<span class="sw" style="background:var(${color})"></span>`;

/** Two figures side by side, in the two columns of a ledger. */
export const two = (a, b) => html`<span class="two"><span>${a}</span><span>${b}</span></span>`;

/**
 * Figure columns: per day and, next to it, per month (the total for contracts shorter than a month, where a month
 * would be made up). The same for every offer, so they compare. Per day with cents, so the sums add up.
 */
export function columns(r) {
  const other = isUnderAMonth(r) ? 'total' : 'month';
  const cell = (x, unit) => (unit === 'day' ? fE(inUnit(x, r, unit), 2) : fUnit(inUnit(x, r, unit), unit));
  return {
    other,
    header: two('Día', other === 'month' ? 'Mes' : 'Total'),
    value: (x) => two(cell(x, 'day'), cell(x, other)),
    minus: (x) => two(`−${cell(x, 'day')}`, `−${cell(x, other)}`),
  };
}

/**
 * A label–figure row.
 * A label starting with «− », «+ », «= » or «× » puts the sign in its own column next to the figure, and «=» gets a
 * rule above, like a sum on paper.
 * @param {unknown} label
 * @param {unknown} value
 * @param {{swatch?: string, sub?: unknown, cls?: string, valueCls?: string}} [options]
 *   swatch: colour ('expense' for the hatching, '' for an empty gap) · sub: note under the label ·
 *   cls: row class (hd, strong, tot, subt) · valueCls: figure class (ok, bad, minus)
 */
export function row(label, value, { swatch: color, sub, cls, valueCls } = {}) {
  const op = typeof label === 'string' && value !== '' && /^([−+=×]) (.*)$/s.exec(label);
  const classes = ['row', color !== undefined && 'c', cls, op && 'opr', op?.[1] === '=' && 'eq']
    .filter(Boolean)
    .join(' ');
  return html`<div class=${classes}>${color === undefined ? nothing : color ? swatch(color) : html`<span></span>`}<span
      >${op ? capitalize(op[2]) : label}${sub ? html`<small>${sub}</small>` : nothing}</span
    ><span class=${valueCls || nothing}>${op ? html`<span class="op">${op[1]}</span><span class="nm">${value}</span>` : value}</span></div>`;
}

/** The rows of a calculation inside a card, under an optional header. */
export const ledger = (header, rows) =>
  html`<div class="rows sv-rows">${header ? row(header[0], header[1], { cls: 'hd' }) : nothing}${rows.filter(Boolean)}</div>`;

/** The large stamp, on two lines if it is long (split at the most central space), so the box fits the text. */
export function stampLines(text) {
  if (text.length <= 12 || !text.includes(' ')) return text;
  const middle = text.length / 2;
  const spaces = [...text.matchAll(/ /g)].map((m) => m.index);
  const i = spaces.reduce((a, b) => (Math.abs(b - middle) < Math.abs(a - middle) ? b : a));
  return html`${text.slice(0, i)}<br />${text.slice(i + 1)}`;
}

/** A figure card: the figure large on the left, what it is next to it and a stamp in the corner. Colour: --k of the card. */
export const figureCard = (figure, title, sub, stamp) =>
  html`<div class="figcard"><span class="left"><span class="big">${figure}</span>${stamp ? html`<span class="stamp">${stamp}</span>` : nothing}</span><span class="t"><b>${title}</b>${sub ? html`<span>${sub}</span>` : nothing}</span></div>`;

/** The unit attached to a figure, small: «312 €/mes», «13 h/sem», «1.200 € en total». */
export const unitSuffix = (unit) =>
  html`<small class="u">${{ hour: '/h', day: '/día', month: '/mes', total: ' en total' }[unit] || ''}</small>`;

/**
 * Bars inside the cards: a calculation at a glance. Each segment carries its figure if it fits; the legend, always.
 * @param {[string, number, string][]} segments [class, value, label]
 * @param {number} scale the value of 100 %
 */
export function segmentBar(segments, scale, format = fCount, minPct = 9) {
  const shown = segments.filter(([, value]) => value > 0.05);
  const fits = (value) => (value / scale) * 100 >= minPct;
  return html`<div class="br-b">${shown.map(
    ([cls, value]) =>
      html`<i class=${cls} style="width:${((value / scale) * 100).toFixed(2)}%">${fits(value) ? html`<span class="tx">${format(value)}</span>` : nothing}</i>`,
  )}</div>
    <div class="br-k">${shown.map(([cls, value, label]) =>
      label
        ? html`<span><i class=${cls}></i>${label}${fits(value) ? nothing : html` <b>${format(value)}</b>`}</span>`
        : nothing,
    )}</div>`;
}

/** A marker on a bar (the minimum, what is paid…) with its label; with `faded`, what lies right of it is dimmed. */
export function marker(pos, label, faded, end = 100) {
  const at = Math.max(0, Math.min(100, pos));
  return html`${
    faded && at < end - 0.5
      ? html`<span class="br-claro" style="left:${at.toFixed(2)}%;right:${(100 - end).toFixed(2)}%${end < 99.5 ? ';border-radius:0' : ''}"></span>`
      : nothing
  }<span class=${at > 70 ? 'br-min left' : 'br-min'} style="left:${at.toFixed(2)}%"><span>${label}</span></span>`;
}

/** Legend of the income bars, with only the parts that appear. */
export function legend(results) {
  const present = PARTS.filter((part) => results.some((r) => part.value(r.earnings.parts) > 0.5));
  return html`<p class="legend">${present.map((part) => html`<span>${swatch(part.color)}${part.label}</span>`)}${
    results.some((r) => r.expenses.total > 0.5) ? html`<span>${swatch('expense')}Gastos</span>` : nothing
  }</p>`;
}

/**
 * Bar of what you earn: one segment per income and, over the end, hatching for your expenses; what is left unhatched
 * is what you earn. `per` converts figures to the unit; `scale` is what 100 % is worth.
 */
export function incomeBar(r, scale, per = 1) {
  const width = (x) => Math.max(0, (x / per / scale) * 100);
  const income = incomeOf(r);
  const expenses = Math.min(r.expenses.total, income);
  return html`<div class="bar" aria-hidden="true">${PARTS.map((part) => {
    const value = part.value(r.earnings.parts);
    return value > 0.5 ? html`<i style="width:${width(value)}%;background:var(${part.color})"></i>` : nothing;
  })}${expenses > 0.5 ? html`<b class="expense" style="left:${width(income - expenses)}%;width:${width(expenses)}%"></b>` : nothing}</div>`;
}

/** Icons of the pills. */
export const ICONS = {
  cal: svg`<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>`,
  clock: svg`<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>`,
  cash: svg`<rect x="3" y="7" width="18" height="10" rx="1"/><circle cx="12" cy="12" r="2.5"/>`,
  doc: svg`<path d="M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 16h6"/>`,
};
