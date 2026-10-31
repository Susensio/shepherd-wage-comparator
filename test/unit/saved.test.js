// Completing saved data with defaults. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEF_CFG, DEF_MINE, DEF_TERMS } from '../../src/offer.js';
import { ingestSaved } from '../../src/saved.js';

const current = JSON.parse(readFileSync(new URL('../fixtures/offers.json', import.meta.url), 'utf8'));
const fallbackCfg = { ...DEF_CFG, mealLunchP: 99 };

test('defaults fill the fields a saved offer lacks', () => {
  const { offers } = ingestSaved(
    { offers: [{ id: 'a', terms: { payAmount: 5 }, mine: { name: 'X' } }] },
    { fallbackCfg },
  );
  assert.deepEqual(offers, [{ id: 'a', terms: { ...DEF_TERMS, payAmount: 5 }, mine: { ...DEF_MINE, name: 'X' } }]);
});

test('offers in the old flat shape are split into terms and own figures', () => {
  const flat = { id: 'a', cmp: false, name: 'X', payAmount: 5, kmHome: 30, vacationAuto: true };
  const { offers } = ingestSaved({ offers: [flat] }, { fallbackCfg });
  assert.deepEqual(offers, [
    {
      id: 'a',
      cmp: false,
      terms: { ...DEF_TERMS, payAmount: 5, vacationAuto: true },
      mine: { ...DEF_MINE, name: 'X', kmHome: 30 },
    },
  ]);
});

test('entries that are not offers are left out', () => {
  const { offers } = ingestSaved({ offers: [null, 7, { name: 'no id' }] }, { fallbackCfg });
  assert.deepEqual(offers, []);
});

test('saved settings are completed with defaults', () => {
  const { cfg } = ingestSaved({ offers: [], cfg: { fuelUse: 9 } }, { fallbackCfg });
  assert.deepEqual(cfg, { ...DEF_CFG, fuelUse: 9 });
});

test('saved values of figures that now come from the law are dropped', () => {
  const former = { ssPct: 1, ssEmp: 2, annualHours: 3, overnightPct: 4, vacationDaysPerYear: 5 };
  const { cfg } = ingestSaved({ offers: [], cfg: { ...former, fuelUse: 9 } }, { fallbackCfg });
  assert.deepEqual(cfg, { ...DEF_CFG, fuelUse: 9 });
  for (const key of Object.keys(former)) assert.ok(!(key in cfg), key);
});

test('a bundle without cfg uses fallbackCfg', () => {
  const { cfg } = ingestSaved({ offers: [] }, { fallbackCfg });
  assert.deepEqual(cfg, fallbackCfg);
});

test('ingesting an ingested bundle changes nothing', () => {
  const first = ingestSaved(current, { fallbackCfg });
  assert.deepEqual(ingestSaved(first, { fallbackCfg }), first);
});

test('the input is not mutated', () => {
  const before = structuredClone(current);
  ingestSaved(current, { fallbackCfg });
  assert.deepEqual(current, before);
});
