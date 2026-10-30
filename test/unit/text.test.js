// The texts people copy: the card, the claim and the form summaries. Run with `npm run test:unit`.
// Pins stable fragments of today's behaviour, not whole strings.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calc } from '../../src/model/calc.js';
import { DEF_CFG } from '../../src/offer.js';
import { normalizeOffer } from '../../src/saved.js';
import { cardText, claimText, summaries } from '../../src/text.js';
import { offerOf } from './flat-offer.js';

const sample = JSON.parse(readFileSync(new URL('../fixtures/offers.json', import.meta.url), 'utf8'));
const cfg = { ...DEF_CFG, ...sample.cfg };
const offers = sample.offers.map(normalizeOffer);
const resultOf = (o) => calc(o, { cfg, offers });
const byId = (id) => offers.find((o) => o.id === id);

// A permanent full-time contract at exactly the 2026 minimum wage, as in rights.test.js
const COMPLIANT = offerOf({
  id: 't',
  name: 'Cumplidora',
  start: '2026-01-01',
  contract: 'permanent',
  duration: 12,
  durationUnit: 'months',
  hoursPerDay: 8,
  daysOff: 2,
  daysOffUnit: 'week',
  holidays: 'yes',
  payType: 'gross',
  payAmount: 1221,
  payUnit: 'month',
  extraPays: 'separate',
  vacation: 'taken',
  housing: 'no',
  car: 'noCar',
  kmHome: 0,
  overnight: 'no',
});

const noBrokenValues = (text, what) => {
  assert.doesNotMatch(text, /NaN|undefined|null|Infinity/, what);
};

test('no sample offer prints NaN or undefined in any text', () => {
  for (const o of offers) {
    const r = resultOf(o);
    noBrokenValues(cardText(o, r), `card of ${o.mine.name}`);
    noBrokenValues(claimText(o, r), `claim of ${o.mine.name}`);
    noBrokenValues(JSON.stringify(summaries(o, r)), `summaries of ${o.mine.name}`);
  }
});

test('summaries: one line per form section', () => {
  const o = byId('o1');
  const s = summaries(o, resultOf(o));
  assert.deepEqual(Object.keys(s), ['time', 'payroll', 'b', 'housing', 'car', 'others']);
  assert.match(s.time, /102 días/);
  assert.match(s.payroll, /neto/);
  assert.match(s.housing, /^Duermes en borda/);
  assert.match(s.car, /^Tu coche/);
});

test('summaries: a no-contract offer says everything is paid in hand', () => {
  const o = byId('o5');
  assert.equal(summaries(o, resultOf(o)).payroll, 'Sin contrato: todo en mano');
});

test('card: starts with the offer name and shows the verdict line', () => {
  for (const o of offers) {
    const lines = cardText(o, resultOf(o)).split('\n');
    assert.equal(lines[0], o.mine.name);
    assert.ok(
      lines.some((l) => l.startsWith('✘ No cumple: ')),
      `verdict of ${o.mine.name}`,
    );
  }
});

test('card: a compliant offer says it meets the basics and has no lever to negotiate', () => {
  const card = cardText(COMPLIANT, resultOf(COMPLIANT));
  assert.match(card, /✔ Cumple lo básico/);
  assert.doesNotMatch(card, /No cumple/);
  assert.doesNotMatch(card, /Para negociar/);
});

test('card: a negotiation lever appears exactly when the employer saves something', () => {
  for (const o of offers) {
    const r = resultOf(o);
    const card = cardText(o, r);
    assert.equal(card.includes('Para negociar'), r.savings.total > 1, o.mine.name);
  }
  const card = cardText(byId('o1'), resultOf(byId('o1')));
  assert.match(card, /Para negociar, el ganadero se ahorra al mes: .* por pagarte en negro/);
});

test('card: no-contract offers name the missing contract and no unemployment benefit', () => {
  const o = byId('o5');
  const card = cardText(o, resultOf(o));
  assert.match(card, /por no hacerte contrato/);
  assert.match(card, /No cumple: sin contrato/);
  assert.match(card, /No genera paro/);
});

test('card: cash is shown only when there is some', () => {
  assert.match(cardText(byId('o1'), resultOf(byId('o1'))), /\nEn negro: /);
  assert.doesNotMatch(cardText(byId('o4'), resultOf(byId('o4'))), /En negro/);
});

test('claim: opens with the offer name and has the section headings', () => {
  const o = byId('o1');
  const claim = claimText(o, resultOf(o));
  assert.equal(claim.split('\n')[0], 'Oferta: Puerto A');
  assert.match(claim, /^SALARIO$/m);
  assert.match(claim, /Estatuto, art\./);
});

test('claim: without a contract it cites article 8 and the cash paid', () => {
  const o = byId('o5');
  const claim = claimText(o, resultOf(o));
  assert.match(claim, /Sin contrato ni alta en la Seguridad Social \(Estatuto, art\. 8\)/);
  assert.match(claim, /Se pagan .* en mano en todo el contrato/);
});

test('claim: a compliant offer reports no pay shortfall', () => {
  const claim = claimText(COMPLIANT, resultOf(COMPLIANT));
  assert.match(claim, /^Oferta: Cumplidora/);
  assert.doesNotMatch(claim, /no llega al mínimo/);
});
