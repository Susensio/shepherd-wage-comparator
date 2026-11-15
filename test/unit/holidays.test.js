// Public holidays: the generated module (kb/tables → src/law-territorial.js) and holidaysOf in law.js (ADR-0033).

import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildTerritorialModule } from '../../scripts/build-law-data.js';
import { holidaysOf } from '../../src/law.js';

const KB = fileURLToPath(new URL('../../kb', import.meta.url));
const GENERATED = fileURLToPath(new URL('../../src/law-territorial.js', import.meta.url));

const monthDay = (days) => days.map((d) => d.date.slice(5));

test('the committed generated module is what the script produces now', () => {
  assert.equal(
    readFileSync(GENERATED, 'utf8'),
    buildTerritorialModule(),
    'run `npm run law-data` and commit src/law-territorial.js',
  );
});

test('Yebra de Basa 2026: the 12 national and regional days and its two local days, in date order', () => {
  const { days, local, known } = holidaysOf({ municipality: '22252', province: 'HU', year: 2026 });
  assert.deepEqual([known, local, days.length], [true, true, 14]);
  assert.deepEqual(
    days.filter((d) => d.scope === 'local').map((d) => d.date),
    ['2026-06-25', '2026-08-10'],
  );
  assert.equal(days.filter((d) => d.scope !== 'local').length, 12);
  assert.deepEqual(monthDay(days), [...monthDay(days)].sort());
  assert.ok(days.some((d) => d.date === '2026-04-23' && d.scope === 'regional'));
});

test('every day carries its source id, article and link', () => {
  const { days } = holidaysOf({ municipality: '22252', province: 'HU', year: 2026 });
  for (const day of days) {
    assert.ok(day.cite.id, day.date);
    assert.ok(day.cite.label, day.date);
    assert.match(day.cite.url, /^https:\/\//, day.date);
  }
});

test('Aínsa-Sobrarbe 2026: 20 Jan and 14 Sep are its local days', () => {
  const { days, local } = holidaysOf({ municipality: '22907', province: 'HU', year: 2026 });
  assert.equal(local, true);
  assert.deepEqual(
    days.filter((d) => d.scope === 'local').map((d) => d.date),
    ['2026-01-20', '2026-09-14'],
  );
});

test('a municipality without local data gets the 12 days and local: false', () => {
  const abiego = holidaysOf({ municipality: '22001', province: 'HU', year: 2026 });
  assert.deepEqual([abiego.known, abiego.local, abiego.days.length], [true, false, 12]);
  const none = holidaysOf({ province: 'Z', year: 2026 });
  assert.deepEqual([none.known, none.local, none.days.length], [true, false, 12]);
});

test('Zaragoza and Teruel are Aragón too', () => {
  for (const province of ['Z', 'TE']) assert.equal(holidaysOf({ province, year: 2026 }).days.length, 12, province);
});

test('another province, an unknown one or another year is not known', () => {
  const unknown = { days: [], local: false, known: false };
  assert.deepEqual(holidaysOf({ municipality: '08019', province: 'B', year: 2026 }), unknown);
  assert.deepEqual(holidaysOf({ municipality: '22252', province: 'HU', year: 2027 }), unknown);
  assert.deepEqual(holidaysOf({ year: 2026 }), unknown);
});

test('only verified rows are emitted', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-'));
  cpSync(KB, dir, { recursive: true });
  const file = join(dir, 'tables', 'holidays.csv');
  const lines = readFileSync(file, 'utf8')
    .split('\n')
    .map((line) =>
      line.startsWith('mun:22252,2026,2026-06-25') || line.startsWith('ccaa:02,2026,2026-12-25')
        ? line.replace(',verified,owner 2026-11-15,', ',checked,,')
        : line,
    );
  writeFileSync(file, lines.join('\n'));
  const { HOLIDAY_DATA } = await import(
    `data:text/javascript;base64,${Buffer.from(buildTerritorialModule(dir)).toString('base64')}`
  );
  assert.deepEqual(
    HOLIDAY_DATA.local['22252'][2026].map((d) => d.date),
    ['2026-08-10'],
  );
  const regional = HOLIDAY_DATA.regional['ccaa:02'][2026].map((d) => d.date);
  assert.equal(regional.length, 11);
  assert.ok(!regional.includes('2026-12-25'));
});

test('a kb with errors generates nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-'));
  cpSync(KB, dir, { recursive: true });
  const file = join(dir, 'tables', 'holidays.csv');
  writeFileSync(file, readFileSync(file, 'utf8').replace('BOA-2025-135-decreto-70', 'BOA-0000-000-nothing'));
  assert.throws(() => buildTerritorialModule(dir), /nothing generated/);
});
