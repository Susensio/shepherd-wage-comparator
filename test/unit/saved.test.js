// Completing saved data with defaults. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEF_CFG, DEF_OFFER } from '../../src/offer.js';
import { ingestSaved } from '../../src/saved.js';

const current = JSON.parse(readFileSync(new URL('../fixtures/offers.json', import.meta.url), 'utf8'));
const fallbackCfg = { ...DEF_CFG, mealLunchP: 99 };

test('defaults fill the fields a saved offer lacks', () => {
  const { offers } = ingestSaved({ offers: [{ id: 'a', name: 'X' }] }, { fallbackCfg });
  assert.deepEqual(offers, [{ ...DEF_OFFER, id: 'a', name: 'X' }]);
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
