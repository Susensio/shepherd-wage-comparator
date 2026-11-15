// The page's versions follow the migrations: a migration that rewrites the rows or raises `min_page_version` needs the page to say so.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { PAGE_VERSION, SCHEMA_VERSION } from '../../src/schema.js';

describe('the versions of the page and of the migrations', () => {
  const migrations = new URL('../../supabase/migrations/', import.meta.url);
  const sql = readdirSync(migrations)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(new URL(name, migrations), 'utf8'));
  /** The largest value the migrations assign to a column, `set col = n`. */
  const highest = (column) =>
    Math.max(
      ...sql.flatMap((text) =>
        [...text.matchAll(new RegExp(`\\b${column}\\s*=\\s*(\\d+)`, 'g'))].map((m) => Number(m[1])),
      ),
    );

  test('SCHEMA_VERSION is the format the last migration rewrites the account rows to', () => {
    assert.equal(SCHEMA_VERSION, highest('schema_version'));
  });

  test('PAGE_VERSION is the page version the last migration raises min_page_version to', () => {
    assert.equal(PAGE_VERSION, highest('min_page_version'));
  });
});
