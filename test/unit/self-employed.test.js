// Self-employed (autónomo): invoice, IVA, RETA quota and IRPF by módulos, against figures worked out by hand.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calc } from '../../src/model/calc.js';
import { retaBase } from '../../src/model/self-employed.js';
import { DEF_CFG, DEF_MINE, DEF_TERMS } from '../../src/offer.js';

const cfg = { ...DEF_CFG, others: 0, inKind: false };
const offer = (terms) => ({
  id: 'se',
  terms: {
    ...DEF_TERMS,
    contract: 'selfEmployed',
    start: '2026-05-01',
    durationUnit: 'months',
    hoursPerDay: 8,
    payUnit: 'month',
    ...terms,
  },
  mine: { ...DEF_MINE, car: 'noCar' },
});
const cents = (x) => Math.round(x * 100) / 100;

test('RETA tramos: the minimum base of the tramo of a net income per month', () => {
  assert.equal(retaBase(0), 653.59);
  assert.equal(retaBase(670), 653.59);
  assert.equal(retaBase(688), 718.95);
  assert.equal(retaBase(1166.7), 849.67);
  assert.equal(retaBase(1200), 950.98);
  assert.equal(retaBase(10000), 1928.1);
});

test('4 months at 2.000 €, IVA apart: tramo 2, no IRPF under the personal allowance', () => {
  const r = calc(offer({ payAmount: 2000, duration: 4 }), { cfg, alone: true });
  const se = r.selfEmployed;
  assert.equal(se.invoiced, 8000);
  assert.equal(se.vat, 0);
  assert.equal(cents(se.netPrevious), 2960); // × 0,37
  assert.equal(cents(se.netForTramo), 688.2); // × 0,93 ÷ 4 months
  assert.equal(se.base, 718.95);
  assert.equal(cents(se.quota), 905.88); // 718,95 × 31,5 % × 4
  assert.equal(se.irpf, 0);
  assert.equal(cents(r.earnings.total), 7094.12);
  assert.equal(r.unemployment.days, 0);
  assert.equal(r.debt.total, 0);
  assert.equal(r.savings.total, 0);
  assert.deepEqual(r.stamp, { code: 'selfEmployed' });
});

test('IVA inside the agreed amount is taken off at 10 %', () => {
  const r = calc(offer({ payAmount: 2000, duration: 4, vatIncluded: true }), { cfg, alone: true });
  assert.equal(cents(r.selfEmployed.invoiced), 7272.73);
  assert.equal(cents(r.selfEmployed.vat), 727.27);
});

test('a year at 3.000 €: tramo 3 of the reduced table, IRPF on the módulos income less 5 %', () => {
  const r = calc(offer({ payAmount: 3000, duration: 12 }), { cfg, alone: true });
  const se = r.selfEmployed;
  assert.equal(cents(se.activityNet), 12654); // 36.000 × 0,37 × 0,95
  assert.equal(se.base, 849.67);
  assert.equal(cents(se.quota), 3211.75);
  // (12.450 × 19 % + 204 × 24 %) − 5.550 × 19 %
  assert.equal(cents(se.irpf), 1359.96);
  assert.equal(cents(r.earnings.total), cents(36000 - 3211.75 - 1359.96));
});
