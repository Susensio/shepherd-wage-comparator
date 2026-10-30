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

test('offers in the old flat shape are left out', () => {
  const { offers } = ingestSaved({ offers: [{ id: 'a', name: 'X', payAmount: 5 }] }, { fallbackCfg });
  assert.deepEqual(offers, []);
});

test('saved settings are completed with defaults', () => {
  const { cfg } = ingestSaved({ offers: [], cfg: { ssEmp: 20 } }, { fallbackCfg });
  assert.deepEqual(cfg, { ...DEF_CFG, ssEmp: 20 });
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
