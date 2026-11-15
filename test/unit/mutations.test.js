// Offers change only through `offers.js` (ADR-0035): nothing outside it, the record model and the schema assigns to an
// offer's terms or own figures.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const SRC = new URL('../../src/', import.meta.url).pathname;
const allowed = new Set(['offers.js', 'schema.js', 'offer.js', 'model/record.js', 'pay-answers.js']);

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (entry.name.endsWith('.js')) yield path;
  }
}

test('no file outside offers.js assigns to an offer’s terms or mine', () => {
  const found = [];
  for (const path of files(SRC)) {
    const name = path.slice(SRC.length);
    if (allowed.has(name)) continue;
    readFileSync(path, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/\.(terms|mine)(\.\w+|\[[^\]]+\])+\s*(=|\+=|\|\|=|\?\?=)[^=]/.test(line)) found.push(`${name}:${i + 1}`);
        if (/\b(delete|Object\.assign\()\s*[\w.]*\.(terms|mine)\b/.test(line)) found.push(`${name}:${i + 1}`);
      });
  }
  assert.deepEqual(found, []);
});
