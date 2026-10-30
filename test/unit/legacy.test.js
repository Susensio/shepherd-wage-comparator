// Converting saved data of any age. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ingestSaved } from '../../src/legacy.js';
import { DEF_CFG, YOUR_DATA } from '../../src/offer.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
const current = read('offers.json');
const spanish = read('offers_es.json');
const fallbackCfg = { ...DEF_CFG, mealLunchP: 99 };

test('a Spanish-era bundle (ofertas) converts to today names', () => {
  const { offers, cfg } = ingestSaved(spanish, { fallbackCfg });
  assert.equal(offers.length, spanish.ofertas.length);
  assert.equal(offers[0].name, spanish.ofertas[0].nombre);
  assert.equal(offers[0].payType, 'net');
  assert.equal(offers[0].durationUnit, 'days');
  assert.equal(cfg.fuelUse, spanish.cfg.consumo);
  assert.ok(!('consumo' in cfg));
});

test('older 31.5 % and 6.5 % defaults are replaced', () => {
  const { cfg } = ingestSaved({ offers: [], cfg: { ...current.cfg, ssEmp: 31.5, ssPct: 6.5 } }, { fallbackCfg });
  assert.equal(cfg.ssEmp, DEF_CFG.ssEmp);
  assert.equal(cfg.ssPct, DEF_CFG.ssPct);
});

test('migrated: old and cfg-less saves yes, current no', () => {
  const { consumo: _, ...oldCfg } = spanish.cfg;
  assert.equal(ingestSaved({ ...spanish, cfg: oldCfg }, { fallbackCfg }).migrated, true);
  assert.equal(ingestSaved(spanish, { fallbackCfg }).migrated, false);
  assert.equal(ingestSaved({ offers: current.offers }, { fallbackCfg }).migrated, true);
  assert.equal(ingestSaved(current, { fallbackCfg }).migrated, false);
});

test('a bundle without cfg uses fallbackCfg', () => {
  const { cfg } = ingestSaved({ offers: [] }, { fallbackCfg });
  assert.equal(cfg.mealLunchP, 99);
  assert.deepEqual(cfg, fallbackCfg);
});

test('your data missing from an old cfg comes from fallbackCfg', () => {
  const { cfg } = ingestSaved({ offers: [], cfg: { ssEmp: 20 } }, { fallbackCfg });
  for (const k in YOUR_DATA) assert.equal(cfg[k], fallbackCfg[k]);
});

test('converting a converted bundle changes nothing', () => {
  for (const data of [spanish, current]) {
    const first = ingestSaved(data, { fallbackCfg });
    const second = ingestSaved({ offers: first.offers, cfg: first.cfg }, { fallbackCfg });
    assert.deepEqual(second.offers, first.offers);
    assert.deepEqual(second.cfg, first.cfg);
    assert.equal(second.migrated, false);
  }
});

test('the input is not mutated', () => {
  for (const data of [spanish, current, { offers: current.offers }]) {
    const before = structuredClone(data);
    ingestSaved(data, { fallbackCfg });
    assert.deepEqual(data, before);
  }
});
