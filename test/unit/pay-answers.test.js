// The pay questions as a view over the terms, and the conversion of shapes they cannot say. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calc } from '../../src/model/calc.js';
import { DEF_CFG, makeOffer } from '../../src/offer.js';
import { answersOf, isAnswerable, toAnswerable, writeAnswers } from '../../src/pay-answers.js';
import { normalizeOffer } from '../../src/saved.js';

const sample = JSON.parse(readFileSync(new URL('../fixtures/offers.json', import.meta.url), 'utf8'));
const cfg = { ...DEF_CFG, ...sample.cfg };

/** The figures a conversion keeps: what you earn and receive, the payroll, the cash and what is owed. */
const figuresOf = (r) => ({
  earnings: r.earnings.total,
  received: r.earnings.received,
  gross: r.pay.gross,
  net: r.pay.net,
  cash: r.cash.total,
  debtTotal: r.debt.total,
  debtSalary: r.debt.salary,
  debtVacation: r.debt.vacation,
  owed: r.debt.owed,
});

function assertSameFigures(before, after, what) {
  for (const [key, value] of Object.entries(before))
    assert.ok(Math.abs(value - after[key]) <= 0.01, `${what}: ${key} ${value} became ${after[key]}`);
}

/** Converts `offer` among `offers` and checks its figures; returns whether it was converted. */
function convert(offer, offers) {
  const ctx = { cfg, offers };
  const before = figuresOf(calc(offer, ctx));
  const converted = toAnswerable(offer, ctx);
  assert.equal(isAnswerable(offer.terms), true, `${offer.mine.name} can be said in the questions`);
  assertSameFigures(before, figuresOf(calc(offer, ctx)), offer.mine.name);
  return converted;
}

const offerWith = (terms) =>
  normalizeOffer({
    id: 'x',
    terms: { start: '2026-06-01', duration: 3, durationUnit: 'months', hoursPerDay: 9, ...terms },
    mine: { name: 'X' },
  });

test('every sample offer keeps its earnings and debt once converted', () => {
  const offers = sample.offers.map(normalizeOffer);
  const converted = offers.filter((offer) => convert(offer, offers)).map((offer) => offer.mine.name);
  // A gross payslip with nothing en negro is the only sample shape the questions did not have
  assert.deepEqual(converted, ['Invernada C']);
});

test('each sample offer reads as the expected answers', () => {
  const offers = sample.offers.map(normalizeOffer);
  const read = Object.fromEntries(
    offers.map((o) => {
      convert(o, offers);
      const { payroll, unit, partType } = answersOf(o.terms);
      return [o.mine.name, [payroll, unit, o.terms.contract, ...(payroll === 'part' ? [partType] : [])]];
    }),
  );
  assert.deepEqual(read, {
    'Puerto A': ['part', 'month', 'seasonal', 'net'],
    'Puerto A, otra cuenta': ['part', 'month', 'seasonal', 'gross'],
    'Campaña B': ['min', 'day', 'seasonal'],
    'Invernada C': ['part', 'month', 'temporary', 'gross'],
    'Sin contrato D': ['none', 'day', 'none'],
    'Temporada E': ['all', 'total', 'seasonal'],
    'Temporada F': ['all', 'day', 'seasonal'],
    'Sin contrato G': ['none', 'day', 'none'],
  });
});

test('a payslip and en negro money become a part of a total', () => {
  for (const payType of ['net', 'gross'])
    for (const vacation of ['paidAtEnd', 'taken']) {
      const offer = offerWith({
        payType,
        vacation,
        payAmount: 1400,
        payUnit: 'month',
        cashAmount: 300,
        cashUnit: 'month',
      });
      assert.equal(convert(offer, [offer]), true, `${payType} ${vacation}`);
      assert.equal(answersOf(offer.terms).payroll, 'part');
    }
});

test('en negro money in another unit than the payslip', () => {
  const offer = offerWith({
    payAmount: 1400,
    payUnit: 'month',
    cashAmount: 20,
    cashUnit: 'day',
    vacation: 'paidAtEnd',
  });
  assert.equal(convert(offer, [offer]), true);
  assert.equal(answersOf(offer.terms).unit, 'month');
});

test('the minimum on payroll with en negro money', () => {
  const offer = offerWith({ payrollMin: true, cashAmount: 20, cashUnit: 'day', vacation: 'paidAtEnd' });
  assert.equal(convert(offer, [offer]), true);
  assert.equal(answersOf(offer.terms).payroll, 'min');
});

test('a total in another unit than the part', () => {
  const offer = offerWith({
    cashMode: 'total',
    payAmount: 1400,
    payUnit: 'month',
    totalAmount: 60,
    totalUnit: 'day',
    vacation: 'paidAtEnd',
  });
  assert.equal(convert(offer, [offer]), true);
  assert.equal(offer.terms.totalUnit, 'month');
});

test('a yearly amount becomes monthly, and its extra pays (never counted) are not', () => {
  const offer = offerWith({ payAmount: 18000, payUnit: 'year', extraPays: 'separate', vacation: 'taken' });
  assert.equal(convert(offer, [offer]), true);
  assert.deepEqual([offer.terms.payUnit, offer.terms.payAmount, offer.terms.extraPays], ['month', 1500, 'included']);
});

test('a total without a duration is a month', () => {
  const offer = offerWith({
    durationUnit: 'unknown',
    duration: '',
    payAmount: 1400,
    payUnit: 'total',
    vacation: 'taken',
  });
  assert.equal(convert(offer, [offer]), true);
  assert.equal(offer.terms.payUnit, 'month');
});

test('a gross payslip with vacation inside the pay is said as its net', () => {
  const offer = offerWith({ payType: 'gross', payAmount: 1500, vacation: 'included' });
  assert.equal(convert(offer, [offer]), true);
  assert.deepEqual([answersOf(offer.terms).payroll, offer.terms.payType], ['all', 'net']);
});

test('a shape that cannot be converted without changing its figures is left alone', () => {
  const offer = offerWith({ payType: 'net', payAmount: 1400, cashAmount: 300, vacation: 'included' });
  const terms = structuredClone(offer.terms);
  assert.equal(toAnswerable(offer, { cfg, offers: [offer] }), false);
  assert.deepEqual(offer.terms, terms);
});

test('the answers go to the terms by the mapping and read back', () => {
  const read = (payroll, extra = {}) => {
    const { terms } = makeOffer();
    writeAnswers(terms, { payroll, amount: 60, unit: 'day', part: 40, partType: 'gross', ...extra });
    return terms;
  };
  const all = read('all');
  assert.deepEqual(
    [all.payrollMin, all.payType, all.payAmount, all.payUnit, all.cashMode, all.cashAmount],
    [false, 'net', 60, 'day', 'amount', ''],
  );
  assert.deepEqual(answersOf(read('all')), { payroll: 'all', amount: 60, unit: 'day', part: '', partType: 'net' });
  assert.deepEqual(answersOf(read('min')), { payroll: 'min', amount: 60, unit: 'day', part: '', partType: 'net' });
  assert.deepEqual(answersOf(read('part')), { payroll: 'part', amount: 60, unit: 'day', part: 40, partType: 'gross' });
  assert.deepEqual(answersOf(read('none')), { payroll: 'none', amount: 60, unit: 'day', part: '', partType: 'net' });
  assert.equal(read('none').contract, 'none');
  // Leaving «Nada, sin contrato» gives the default contract back
  const terms = read('none');
  writeAnswers(terms, { payroll: 'all', amount: 60, unit: 'day', part: '', partType: 'net' });
  assert.equal(terms.contract, 'temporary');
});
