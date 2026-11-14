// The knowledge base: manifest, tables and their quotes (ADR-0033). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseCsv, validateKb } from '../../scripts/build-law-data.js';

const KB = fileURLToPath(new URL('../../kb', import.meta.url));

/** A copy of kb/ to break on purpose. */
function copyKb() {
  const dir = mkdtempSync(join(tmpdir(), 'kb-'));
  cpSync(KB, dir, { recursive: true });
  return dir;
}

test('the knowledge base is valid', () => {
  const { errors } = validateKb();
  assert.deepEqual(errors, []);
});

test('every table row has a quote found verbatim in its source text, and nothing is verified without the owner', () => {
  const { errors } = validateKb();
  assert.equal(errors.filter((e) => e.includes('quote')).length, 0);
  const rows = parseCsv(readFileSync(join(KB, 'tables', 'holidays.csv'), 'utf8'));
  assert.ok(rows.length > 1);
  for (const row of rows.slice(1))
    assert.ok(['checked', 'verified'].includes(row[8]), `${row[0]} ${row[2]}: ${row[8]}`);
});

test('Aragón 2026: 12 national and regional days, two local days for each pilot municipality', () => {
  const rows = parseCsv(readFileSync(join(KB, 'tables', 'holidays.csv'), 'utf8')).slice(1);
  const regional = rows.filter((r) => r[0] === 'ccaa:02' && r[1] === '2026');
  assert.equal(regional.length, 12);
  const local = new Map();
  for (const r of rows.filter((r) => r[4] === 'local')) local.set(r[0], (local.get(r[0]) ?? 0) + 1);
  assert.equal(local.size, 14);
  for (const [territory, count] of local) assert.equal(count, 2, territory);
  assert.ok(local.has('mun:22252'), 'Yebra de Basa');
});

test('a changed quote is caught', () => {
  const dir = copyKb();
  const file = join(dir, 'tables', 'holidays.csv');
  writeFileSync(file, readFileSync(file, 'utf8').replace('Yebra de Basa. 25 de junio', 'Yebra de Basa. 26 de junio'));
  const { errors } = validateKb(dir);
  assert.ok(
    errors.some((e) => e.includes('quote not found')),
    errors.join('\n'),
  );
});

test('a date that differs from the open-data copy is caught', () => {
  const dir = copyKb();
  const file = join(dir, 'tables', 'holidays.csv');
  writeFileSync(file, readFileSync(file, 'utf8').replace('mun:22252,2026,2026-06-25', 'mun:22252,2026,2026-06-26'));
  const { errors } = validateKb(dir);
  assert.ok(
    errors.some((e) => e.includes('open-data CSV')),
    errors.join('\n'),
  );
});

test('a source id missing from the manifest is caught', () => {
  const dir = copyKb();
  const file = join(dir, 'tables', 'holidays.csv');
  writeFileSync(file, readFileSync(file, 'utf8').replace('BOA-2025-135-decreto-70', 'BOA-0000-000-nothing'));
  const { errors } = validateKb(dir);
  assert.ok(
    errors.some((e) => e.includes('not in the manifest')),
    errors.join('\n'),
  );
});

test('a duplicate day and a third local day are caught', () => {
  const dir = copyKb();
  const file = join(dir, 'tables', 'holidays.csv');
  const text = readFileSync(file, 'utf8').trimEnd().split('\n');
  writeFileSync(file, `${[...text, text[text.length - 1]].join('\n')}\n`);
  const { errors } = validateKb(dir);
  assert.ok(
    errors.some((e) => e.includes('duplicate territory and date')),
    errors.join('\n'),
  );
  assert.ok(
    errors.some((e) => e.includes('3 local days')),
    errors.join('\n'),
  );
});

test('the CSV reader handles quotes, commas and doubled quotes', () => {
  assert.deepEqual(parseCsv('a,"b,c","d ""e"""\n1,2,3\n'), [
    ['a', 'b,c', 'd "e"'],
    ['1', '2', '3'],
  ]);
});
