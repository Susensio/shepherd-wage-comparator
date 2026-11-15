// Completing saved data with defaults. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { DEF_CFG, DEF_MINE, DEF_TERMS, emptyRecord } from '../../src/offer.js';
import { ingestSaved, ingestShared, normalizeRecord, SCHEMA_VERSION, upgrade } from '../../src/schema.js';

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

test('the account schema is at version 8', () => {
  assert.equal(SCHEMA_VERSION, 8);
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

  test('upgrade[3] changes nothing; the default fills vatIncluded', () => {
    const v3 = { id: 'a', terms: { payAmount: 5 }, mine: {} };
    assert.equal(upgrade[3].offer(v3), v3);
    const { offers } = ingestSaved({ schema_version: 3, offers: [v3] }, { fallbackCfg });
    assert.equal(offers[0].terms.vatIncluded, false);
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

describe('version 5: mine.record (ADR-0032)', () => {
  const EMPTY = { months: {}, payments: [] };

  test('upgrade[4] adds an empty record where there is none and touches nothing else', () => {
    const [own, bare] = fixture('v4').offers;
    assert.deepEqual(upgrade[4].offer(own), { ...own, mine: { ...own.mine, record: EMPTY } });
    assert.deepEqual(upgrade[4].offer(bare), { ...bare, mine: { ...bare.mine, record: EMPTY } });
    const recorded = {
      id: 'a',
      terms: {},
      mine: { record: { months: { '2026-06': { closed: true, days: {} } }, payments: [] } },
    };
    assert.deepEqual(upgrade[4].offer(recorded), recorded);
    assert.deepEqual(upgrade[4].offer({ id: 'a', terms: {} }).mine, { record: EMPTY });
  });

  test('a version 4 bundle comes out with a record and every unknown field kept', () => {
    const { offers } = ingestSaved(fixture('v4'), { fallbackCfg });
    assert.deepEqual(offers[0].mine.record, EMPTY);
    assert.equal(offers[0].mine.futureMineField, 7);
    assert.equal(offers[0].terms.futureTermsField, 'kept');
    assert.equal(offers[0].mine.kmHome, 108);
    assert.deepEqual(offers[1].mine.record, EMPTY);
    assert.equal('schema_version' in offers[0], false);
  });

  test('a record is not shared between offers, nor with the default', () => {
    const { offers } = ingestSaved(fixture('v4'), { fallbackCfg });
    offers[0].mine.record.payments.push({ id: 'p' });
    assert.equal(offers[1].mine.record.payments.length, 0);
    assert.equal(DEF_MINE.record.payments.length, 0);
    assert.notEqual(emptyRecord().months, emptyRecord().months);
    assert.ok(Object.isFrozen(DEF_MINE.record));
  });

  test('a shared offer carries a neutral empty record, not the sharer’s', () => {
    const shared = ingestShared({
      offer: { id: 'a', schema_version: 5, terms: { payAmount: 5 } },
      sharer: { name: 'Ana' },
    });
    assert.deepEqual(shared?.o.mine.record, EMPTY);
    assert.notEqual(shared?.o.mine.record, DEF_MINE.record);
  });

  test('normalising drops unknown day kinds, non-finite amounts, unknown ways and bad months, and keeps the rest', () => {
    const { offers } = ingestSaved(
      {
        schema_version: 5,
        offers: [
          {
            id: 'a',
            terms: {},
            mine: {
              record: {
                months: {
                  '2026-06': {
                    closed: true,
                    days: { '01': 'work', '02': 'vacation', '03': 'sick', 32: 'off', x: 'off', '04': 'off' },
                  },
                  '2026-13': { closed: true, days: {} },
                  junk: {},
                  '2026-07': { days: { '05': 'off' } },
                  '2026-08': 'no',
                },
                payments: [
                  { id: 'p1', date: '2026-06-30', amount: 500.5, via: 'payroll', note: 'junio' },
                  { date: '2026-07-05', amount: 100, via: 'cash' },
                  { id: 'p3', date: '2026-07-06', amount: Number.NaN, via: 'cash' },
                  { id: 'p4', date: '2026-07-06', amount: '100', via: 'cash' },
                  { id: 'p5', date: '2026-07-06', amount: 100, via: 'bizum' },
                  { id: 'p5b', date: '2026-07-06', amount: 100, via: 'transfer' },
                  { id: 'p6', date: 'ayer', amount: 100, via: 'cash' },
                  'x',
                ],
              },
            },
          },
        ],
      },
      { fallbackCfg },
    );
    const { record } = offers[0].mine;
    assert.deepEqual(record.months, {
      '2026-06': { closed: true, days: { '01': 'work', '03': 'sick', '04': 'off' } },
      '2026-07': { closed: false, days: { '05': 'off' } },
    });
    assert.equal(record.payments.length, 2);
    assert.deepEqual(record.payments[0], {
      id: 'p1',
      date: '2026-06-30',
      amount: 500.5,
      via: 'payroll',
      note: 'junio',
    });
    assert.equal(typeof record.payments[1].id, 'string');
    assert.ok(record.payments[1].id.length > 0);
    // Normalising what is already clean changes nothing
    assert.deepEqual(
      ingestSaved({ schema_version: 5, offers: [offers[0]] }, { fallbackCfg }).offers[0].mine.record.months,
      record.months,
    );
  });

  test('fields this page does not know survive in the record and its parts, as copies', () => {
    const saved = {
      future: { a: 1 },
      months: { '2026-06': { closed: true, days: {}, mood: 'good' } },
      payments: [{ id: 'p', date: '2026-06-30', amount: 5, via: 'cash', receipt: 'r1' }],
      end: { how: 'quit', date: '2026-08-01', reason: 'x' },
      started: { date: '2026-06-01', by: 'y' },
      complete: { date: '2026-09-01', by: 'z' },
      sick: { from: '2026-07-01', doctor: 'w' },
      evidence: [{ date: '2026-07-02', text: 't', photo: 'u' }],
    };
    const record = normalizeRecord(saved);
    assert.deepEqual(record.future, { a: 1 });
    assert.notEqual(record.future, saved.future);
    assert.equal(record.months['2026-06'].mood, 'good');
    assert.equal(record.payments[0].receipt, 'r1');
    assert.equal(record.end.reason, 'x');
    assert.equal(record.started.by, 'y');
    assert.equal(record.complete.by, 'z');
    assert.equal(record.sick.doctor, 'w');
    assert.equal(record.evidence[0].photo, 'u');
    // What it knows is still judged: an invalid known field is not let through as an unknown one
    assert.equal('paid' in normalizeRecord({ paid: 'yes' }), false);
    assert.equal('end' in normalizeRecord({ end: { how: 'bad', date: '2026-08-01' } }), false);
    assert.deepEqual(normalizeRecord(record), record);
  });

  test('a record that is not an object becomes an empty one', () => {
    for (const bad of [null, 'x', 5, [], { months: [], payments: 'no' }]) {
      const { offers } = ingestSaved(
        { schema_version: 5, offers: [{ id: 'a', terms: {}, mine: { record: bad } }] },
        { fallbackCfg },
      );
      assert.deepEqual(offers[0].mine.record, EMPTY);
    }
  });
});

describe('version 6: the claim ladder (ADR-0034)', () => {
  const EMPTY_RECORD = { months: {}, payments: [] };
  const CLEAN = { employerName: '' };

  test('upgrade[5] adds empty parties and claim where there are none and touches nothing else', () => {
    const [own, bare] = fixture('v5').offers;
    assert.deepEqual(upgrade[5].offer(own), {
      ...own,
      mine: { ...own.mine, parties: CLEAN, claim: { steps: {} } },
    });
    assert.deepEqual(upgrade[5].offer(bare).mine, { name: 'Puerto B', parties: CLEAN, claim: { steps: {} } });
    const kept = {
      id: 'a',
      terms: {},
      mine: { parties: { employerName: 'X' }, claim: { steps: { talk: { done: '2026-11-01' } } } },
    };
    assert.deepEqual(upgrade[5].offer(kept), kept);
  });

  test('a version 5 bundle comes out with parties, claim, the record kept and every unknown field kept', () => {
    const { offers } = ingestSaved(fixture('v5'), { fallbackCfg });
    assert.deepEqual(offers[0].mine.parties, CLEAN);
    assert.deepEqual(offers[0].mine.claim, { steps: {} });
    assert.equal(offers[0].mine.record.months['2026-06'].closed, true);
    assert.equal(offers[0].mine.record.payments.length, 1);
    assert.equal(offers[0].mine.futureMineField, 7);
    assert.equal(offers[0].terms.futureTermsField, 'kept');
    assert.deepEqual(offers[1].mine.claim, { steps: {} });
  });

  test('parties and claim are not shared between offers, nor with the default', () => {
    const { offers } = ingestSaved(fixture('v5'), { fallbackCfg });
    offers[0].mine.parties.employerName = 'X';
    offers[0].mine.claim.steps.talk = { done: '2026-11-01' };
    assert.equal(offers[1].mine.parties.employerName, '');
    assert.deepEqual(offers[1].mine.claim.steps, {});
    assert.ok(Object.isFrozen(DEF_MINE.parties) && Object.isFrozen(DEF_MINE.claim));
  });

  test('a shared offer carries neutral parties and claim, not the sharer’s', () => {
    const shared = ingestShared({
      offer: { id: 'a', schema_version: 6, terms: { payAmount: 5 } },
      sharer: { name: 'Ana' },
    });
    assert.deepEqual(shared?.o.mine.parties, CLEAN);
    assert.deepEqual(shared?.o.mine.claim, { steps: {} });
  });

  test('normalising keeps a valid end, start, notes, closedAt and the paid answer, and drops the rest', () => {
    const record = (extra) =>
      ingestSaved(
        {
          schema_version: 6,
          offers: [{ id: 'a', terms: {}, mine: { record: { months: {}, payments: [], ...extra } } }],
        },
        { fallbackCfg },
      ).offers[0].mine.record;
    const full = record({
      end: { how: 'dismissed', date: '2026-10-03', extra: 1 },
      started: { date: '2026-06-21' },
      paid: 'none',
      evidence: [
        { date: '2026-09-01', text: 'Mensaje del ganadero' },
        { date: 'ayer', text: 'x' },
        { date: '2026-09-02', text: '  ' },
        'no',
      ],
      months: { '2026-06': { closed: true, closedAt: '2026-07-02', days: {} }, '2026-07': { closedAt: 'hoy' } },
    });
    assert.deepEqual(full.end, { how: 'dismissed', date: '2026-10-03', extra: 1 }); // unknown sub-fields are kept
    assert.deepEqual(
      record({ sick: { from: '2026-09-20', to: '2026-10-01', x: 1 }, recall: { 2027: 'no', 2028: 'x' } }),
      {
        months: {},
        payments: [],
        sick: { from: '2026-09-20', to: '2026-10-01', x: 1 },
        recall: { 2027: 'no' },
      },
    );
    assert.deepEqual(full.started, { date: '2026-06-21' });
    assert.equal(full.paid, 'none');
    assert.deepEqual(full.evidence, [{ date: '2026-09-01', text: 'Mensaje del ganadero' }]);
    assert.equal(full.months['2026-06'].closedAt, '2026-07-02');
    assert.equal('closedAt' in full.months['2026-07'], false);
    for (const bad of [
      { end: { how: 'sick', date: '2026-10-03' } },
      { sick: { from: 'x' } },
      { recall: { next: 'yes', 2027: 'maybe' } },
      { end: { how: 'fired', date: '2026-10-03' } },
      { end: { how: 'quit', date: 'x' } },
      { end: 'no' },
      { started: { date: 5 } },
      { paid: 'yes' },
      { paid: true },
      { evidence: 'no' },
    ])
      assert.deepEqual(record(bad), EMPTY_RECORD, JSON.stringify(bad));
    // Normalising what is already clean changes nothing
    assert.deepEqual(
      ingestSaved({ schema_version: 6, offers: [{ id: 'a', terms: {}, mine: { record: full } }] }, { fallbackCfg })
        .offers[0].mine.record,
      full,
    );
  });

  test('normalising parties and claim steps: strings only, a step needs a date', () => {
    const { offers } = ingestSaved(
      {
        schema_version: 6,
        offers: [
          {
            id: 'a',
            terms: {},
            mine: {
              parties: { employerName: 'Casa Pérez', employerId: 'B123', workerName: 5, extra: 1 },
              claim: {
                steps: {
                  talk: { done: '2026-11-01', note: 'por teléfono', promise: '2026-11-20' },
                  request: { done: 'ayer', promise: '2026-11-20' },
                  union: 'x',
                  future: { done: '2026-11-02' },
                },
              },
            },
          },
        ],
      },
      { fallbackCfg },
    );
    assert.deepEqual(offers[0].mine.parties, { employerName: 'Casa Pérez', employerId: 'B123' });
    assert.deepEqual(offers[0].mine.claim.steps, {
      talk: { done: '2026-11-01', note: 'por teléfono', promise: '2026-11-20' },
      future: { done: '2026-11-02' },
    });
    for (const bad of [null, 'x', [], 5]) {
      const [o] = ingestSaved(
        { schema_version: 6, offers: [{ id: 'a', terms: {}, mine: { parties: bad, claim: bad } }] },
        { fallbackCfg },
      ).offers;
      assert.deepEqual([o.mine.parties, o.mine.claim], [CLEAN, { steps: {} }]);
    }
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
    const { offers, cfg } = ingestSaved(fixture('v9-future'), { fallbackCfg });
    const [offer] = offers;
    assert.equal(offer.schema_version, 9);
    assert.equal('newTerm' in offer.terms, false);
    assert.equal('newMine' in offer.mine, false);
    assert.equal('newTop' in offer, false);
    assert.equal('newSetting' in cfg, false);
    assert.equal(offer.terms.payAmount, 1785);
    assert.equal(offer.terms.offerOnly, true, 'a known key, read as saved');
  });

  test('an offer of a newer version keeps its stamp when ingested again from the browser copy', () => {
    const first = ingestSaved(fixture('v9-future'), { fallbackCfg });
    const again = ingestSaved(first, { fallbackCfg });
    assert.equal(again.offers[0].schema_version, 9);
  });

  test('a shared row of a newer version is read without them', () => {
    const shared = ingestShared({
      offer: { id: 'a', schema_version: 9, terms: { payAmount: 5, newTerm: 'x' } },
      sharer: { name: 'Ana' },
    });
    assert.equal(shared?.o.terms.payAmount, 5);
    assert.equal('newTerm' in (shared?.o.terms ?? {}), false);
    assert.equal('schema_version' in (shared?.o ?? {}), false);
  });

  test('a shared row of the current version keeps them, and its sharer names it', () => {
    const shared = ingestShared({
      offer: { id: 'a', schema_version: 8, terms: { payAmount: 5, newTerm: 'x' } },
      sharer: { name: 'Ana' },
    });
    assert.equal(shared?.o.terms.newTerm, 'x');
    assert.equal(shared?.o.mine.name, 'Ana');
  });
});

describe('version 7: the record closed (ADR-0032)', () => {
  test('upgrade[6] is the identity: a version-6 bundle comes through whole, with no record closed', () => {
    const [offer] = fixture('v6').offers;
    assert.deepEqual(upgrade[6].offer(offer), offer);
    const { offers } = ingestSaved(fixture('v6'), { fallbackCfg });
    assert.equal('complete' in offers[0].mine.record, false);
    assert.equal(offers[0].mine.record.end.how, 'agreed');
    assert.equal(offers[0].mine.record.months['2026-06'].closedAt, '2026-07-02');
    assert.equal(offers[0].mine.parties.employerName, 'Casa Pérez');
    assert.equal(offers[0].mine.futureMineField, 7, 'what the page does not know is kept');
  });

  test('a record closed keeps its date and its unknown fields; anything else is dropped', () => {
    const record = (complete) =>
      ingestSaved(
        {
          schema_version: 7,
          offers: [{ id: 'a', terms: {}, mine: { record: { months: {}, payments: [], complete } } }],
        },
        { fallbackCfg },
      ).offers[0].mine.record;
    assert.deepEqual(record({ date: '2026-11-15', extra: 1 }).complete, { date: '2026-11-15', extra: 1 });
    for (const bad of [true, 'x', { date: 'hoy' }, { date: 5 }, null, []])
      assert.equal('complete' in record(bad), false, JSON.stringify(bad));
    // Normalising what is already clean changes nothing
    const clean = record({ date: '2026-11-15' });
    assert.deepEqual(
      ingestSaved({ schema_version: 7, offers: [{ id: 'a', terms: {}, mine: { record: clean } }] }, { fallbackCfg })
        .offers[0].mine.record,
      clean,
    );
  });
});

describe('version 8: paid, counts of days, approximate cobros (ADR-0035)', () => {
  const record = (version, saved) =>
    ingestSaved({ schema_version: version, offers: [{ id: 'a', terms: {}, mine: { record: saved } }] }, { fallbackCfg })
      .offers[0].mine.record;

  test('upgrade[7] turns nothingPaid true into paid none and deletes the old field either way', () => {
    const [offer] = fixture('v7').offers;
    assert.equal(offer.mine.record.nothingPaid, true);
    const upgraded = upgrade[7].offer(offer).mine.record;
    assert.equal(upgraded.paid, 'none');
    assert.equal('nothingPaid' in upgraded, false);
    assert.deepEqual(upgraded.complete, { date: '2026-11-15' });
    const falsy = upgrade[7].offer({ id: 'a', mine: { record: { months: {}, payments: [], nothingPaid: false } } });
    assert.equal('paid' in falsy.mine.record, false);
    assert.equal('nothingPaid' in falsy.mine.record, false);
    const { offers } = ingestSaved(fixture('v7'), { fallbackCfg });
    assert.equal(offers[0].mine.record.paid, 'none');
    assert.equal('nothingPaid' in offers[0].mine.record, false, 'normalizeRecord would keep it as unknown');
    assert.equal(offers[0].mine.futureMineField, 7);
  });

  test('upgrade[7] leaves an offer with no record, or without the flag, as it is', () => {
    const bare = { id: 'a', terms: {}, mine: { name: 'X' } };
    assert.equal(upgrade[7].offer(bare), bare);
    const clean = { id: 'a', terms: {}, mine: { record: { months: {}, payments: [], paid: 'asAgreed' } } };
    assert.equal(upgrade[7].offer(clean), clean);
  });

  test('paid is kept when asAgreed or none and dropped otherwise', () => {
    assert.equal(record(8, { paid: 'asAgreed' }).paid, 'asAgreed');
    assert.equal(record(8, { paid: 'none' }).paid, 'none');
    for (const bad of ['yes', true, 1, null, 'ASAGREED']) assert.equal('paid' in record(8, { paid: bad }), false);
  });

  test('a month of counts keeps whole counts from 0 to 31; per-day marks win over counts', () => {
    const month = (saved) => record(8, { months: { '2026-07': saved } }).months['2026-07'];
    assert.deepEqual(month({ closed: true, count: { work: 22, off: 8, sick: 1 } }).count, {
      work: 22,
      off: 8,
      sick: 1,
    });
    assert.deepEqual(month({ count: { work: 22.5, off: -1, sick: 40, extra: 3 } }).count, { work: 0, off: 0, sick: 0 });
    assert.deepEqual(month({ count: { work: 20 } }).count, { work: 20, off: 0, sick: 0 });
    for (const bad of [5, 'x', [], null]) assert.equal('count' in month({ count: bad }), false);
    const both = month({ days: { '01': 'work' }, count: { work: 9, off: 0, sick: 0 } });
    assert.deepEqual(both.days, { '01': 'work' });
    assert.equal('count' in both, false);
    assert.deepEqual(month({ count: { work: 1, off: 0, sick: 0 }, note: 'x' }).note, 'x');
  });

  test('a cobro marked approx keeps the mark; any other value drops it', () => {
    const cobro = (approx) =>
      record(8, { payments: [{ id: 'p', date: '2026-07-01', amount: 100, via: 'cash', approx }] }).payments[0];
    assert.equal(cobro(true).approx, true);
    for (const bad of [false, 'yes', 1, undefined]) assert.equal('approx' in cobro(bad), false);
  });

  test('the version-8 fixture comes through whole, and normalising it again changes nothing', () => {
    const { offers } = ingestSaved(fixture('v8'), { fallbackCfg });
    const saved = offers[0].mine.record;
    assert.equal(saved.paid, 'asAgreed');
    assert.deepEqual(saved.months['2026-07'].count, { work: 22, off: 8, sick: 1 });
    assert.equal(saved.payments[1].approx, true);
    assert.deepEqual(ingestSaved({ schema_version: 8, offers }, { fallbackCfg }).offers[0].mine.record, saved);
  });
});
