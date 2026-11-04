// Completing saved data with defaults. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { DEF_CFG, DEF_MINE, DEF_TERMS } from '../../src/offer.js';
import { ingestSaved, ingestShared, SCHEMA_VERSION, upgrade } from '../../src/schema.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/schema/${name}.json`, import.meta.url), 'utf8'));
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

test('unknown legacy keys of a flat offer are dropped', () => {
  const { offers } = ingestSaved({ offers: [{ id: 'a', oldThing: 1, payAmount: 5 }] }, { fallbackCfg });
  assert.equal('oldThing' in offers[0].terms, false);
  assert.equal('oldThing' in offers[0].mine, false);
  assert.equal(offers[0].terms.payAmount, 5);
});

test('offerOnly ends in terms: from a flat offer, from mine, mine winning over a stale copy in terms', () => {
  const { offers } = ingestSaved(
    {
      offers: [
        { id: 'a', terms: { offerOnly: true }, mine: {} },
        { id: 'b', offerOnly: true },
        { id: 'c', terms: { offerOnly: true }, mine: { offerOnly: false } },
      ],
    },
    { fallbackCfg },
  );
  assert.deepEqual(
    offers.map((o) => [o.terms.offerOnly, 'offerOnly' in o.mine]),
    [
      [true, false],
      [true, false],
      [false, false],
    ],
  );
});

test("a shared row's offerOnly and village are read (ADR-0028)", () => {
  const shared = ingestShared({
    offer: { id: 'a', schema_version: 3, terms: { offerOnly: true, place: 'Sarvisé' } },
    sharer: { name: 'X' },
  });
  assert.equal(shared?.o.terms.offerOnly, true);
  assert.equal(shared?.o.terms.place, 'Sarvisé');
});

test('entries that are not offers are left out', () => {
  const { offers } = ingestSaved({ offers: [null, 7, { name: 'no id' }] }, { fallbackCfg });
  assert.deepEqual(offers, []);
});

test('saved settings are completed with defaults', () => {
  const { cfg } = ingestSaved({ offers: [], cfg: { fuelUse: 9 } }, { fallbackCfg });
  assert.deepEqual(cfg, { ...DEF_CFG, fuelUse: 9 });
});

test('saved values of figures that now come from the law, and of removed settings, are dropped', () => {
  const former = { ssPct: 1, ssEmp: 2, annualHours: 3, overnightPct: 4, vacationDaysPerYear: 5, unemployment: true };
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

test('offers saved before the place and herd fields get them empty', () => {
  const { offers } = ingestSaved(
    { offers: [{ id: 'a', terms: { payAmount: 5 }, mine: { name: 'X' } }] },
    { fallbackCfg },
  );
  assert.deepEqual(
    [
      offers[0].terms.municipality,
      offers[0].terms.province,
      offers[0].terms.sheep,
      offers[0].terms.goats,
      offers[0].terms.cattle,
    ],
    ['', '', '', '', ''],
  );
  assert.equal(offers[0].terms.place, '');
});

test('the village, its codes, the head counts and whether it was worked are terms, shared (ADR-0028)', () => {
  for (const field of ['place', 'municipality', 'province', 'sheep', 'goats', 'cattle', 'offerOnly']) {
    assert.ok(field in DEF_TERMS, field);
    assert.ok(!(field in DEF_MINE), field);
  }
});

test('the account schema is at version 3', () => {
  assert.equal(SCHEMA_VERSION, 3);
});

describe('upgrade chain', () => {
  test('every version below the current one has an upgrader entry', () => {
    for (let v = 1; v < SCHEMA_VERSION; v++) assert.ok(upgrade[v], `upgrade[${v}]`);
  });

  test('upgrade[1] on offers: flat fields split, legacy keys dropped', () => {
    const [flat] = fixture('v1').offers;
    assert.deepEqual(upgrade[1].offer(flat), {
      id: 'flat-1',
      cmp: false,
      terms: {
        payAmount: 1785,
        payType: 'net',
        payUnit: 'month',
        contract: 'seasonal',
        start: '2026-06-21',
        duration: 102,
        vacationAuto: true,
      },
      mine: { name: 'Puerto A', kmHome: 108, car: 'own', offerOnly: true },
    });
  });

  test('upgrade[1] on offers leaves an offer already split as it is', () => {
    const split = { id: 'a', terms: { payAmount: 5 }, mine: {} };
    assert.equal(upgrade[1].offer(split), split);
  });

  test('upgrade[2] moves offerOnly and the village from mine to terms, keeping the rest', () => {
    const [own, stale] = fixture('v2').offers;
    assert.deepEqual(upgrade[2].offer({ ...own, mine: { ...own.mine, place: 'Sarvisé' } }), {
      ...own,
      terms: { ...own.terms, offerOnly: true, place: 'Sarvisé' },
      mine: { name: 'Puerto A', kmHome: 108, car: 'own', futureMineField: 7 },
    });
    assert.deepEqual(upgrade[2].offer(stale).terms, { payAmount: 1200, offerOnly: true });
  });

  test('upgrade[2] leaves an offer already in version 3 as it is (browser copies are not stamped)', () => {
    const v3 = { id: 'a', terms: { payAmount: 5, offerOnly: true, place: 'X' }, mine: { name: 'Y' } };
    assert.deepEqual(upgrade[2].offer(v3), v3);
  });

  test('upgrade[1] on settings drops the former law figures', () => {
    const { cfg } = fixture('v1');
    assert.deepEqual(upgrade[1].cfg(cfg), { rentValue: 350, fuelUse: 7 });
  });

  test("a version 1 bundle comes out in today's shape", () => {
    const { offers, cfg } = ingestSaved(fixture('v1'), { fallbackCfg });
    assert.equal(offers.length, 1);
    assert.equal(offers[0].terms.offerOnly, true);
    assert.equal(offers[0].mine.name, 'Puerto A');
    assert.equal(offers[0].terms.payAmount, 1785);
    assert.equal('oldThing' in offers[0].terms, false);
    assert.equal(offers[0].cmp, false);
    assert.deepEqual(cfg, { ...DEF_CFG, rentValue: 350, fuelUse: 7 });
  });

  test('a version 1 stamp makes even a split-looking offer go through the chain', () => {
    const { offers } = ingestSaved(
      { schema_version: 1, offers: [{ id: 'a', terms: { payAmount: 5 }, mine: {} }] },
      { fallbackCfg },
    );
    assert.equal(offers[0].terms.payAmount, 5);
  });

  test('a stamp on an account row decides, over the shape', () => {
    const { offers } = ingestSaved(
      { offers: [{ id: 'a', schema_version: 1, name: 'X', payAmount: 5 }] },
      { fallbackCfg },
    );
    assert.equal(offers[0].mine.name, 'X');
    assert.equal('schema_version' in offers[0], false);
  });
});

describe('fields the page does not know', () => {
  test('a current-version bundle keeps them through ingestion, so a write does not lose them', () => {
    const { offers, cfg } = ingestSaved(fixture('v2'), { fallbackCfg });
    assert.equal(offers[0].terms.futureTermsField, 'kept');
    assert.equal(offers[0].mine.futureMineField, 7);
    assert.deepEqual(offers[0].futureTopField, [1, 2]);
    assert.equal(cfg.futureCfgField, 'kept');
  });

  test('a newer version is read without them and keeps its version, so it is never written', () => {
    const { offers, cfg } = ingestSaved(fixture('v4-future'), { fallbackCfg });
    const [offer] = offers;
    assert.equal(offer.schema_version, 4);
    assert.equal('newTerm' in offer.terms, false);
    assert.equal('newMine' in offer.mine, false);
    assert.equal('newTop' in offer, false);
    assert.equal('newSetting' in cfg, false);
    assert.equal(offer.terms.payAmount, 1785);
    assert.equal(offer.terms.offerOnly, true, 'a known key, read as saved');
  });

  test('an offer of a newer version keeps its stamp when ingested again from the browser copy', () => {
    const first = ingestSaved(fixture('v4-future'), { fallbackCfg });
    const again = ingestSaved(first, { fallbackCfg });
    assert.equal(again.offers[0].schema_version, 4);
  });

  test('a shared row of a newer version is read without them', () => {
    const shared = ingestShared({
      offer: { id: 'a', schema_version: 4, terms: { payAmount: 5, newTerm: 'x' } },
      sharer: { name: 'Ana' },
    });
    assert.equal(shared?.o.terms.payAmount, 5);
    assert.equal('newTerm' in (shared?.o.terms ?? {}), false);
    assert.equal('schema_version' in (shared?.o ?? {}), false);
  });

  test('a shared row of the current version keeps them, and its sharer names it', () => {
    const shared = ingestShared({
      offer: { id: 'a', schema_version: 3, terms: { payAmount: 5, newTerm: 'x' } },
      sharer: { name: 'Ana' },
    });
    assert.equal(shared?.o.terms.newTerm, 'x');
    assert.equal(shared?.o.mine.name, 'Ana');
  });
});
