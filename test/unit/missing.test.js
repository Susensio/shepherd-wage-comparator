// Every map keyed by what `missing()` reports covers exactly those ids: a new one forgotten in a map fails here,
// not silently on screen.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEF_TERMS, MISSING_IDS, missing } from '../../src/offer.js';
import { FIELD_OF_MISSING, STEP_OF_MISSING, STEPS } from '../../src/steps.js';
import { MISSING_TEXT } from '../../src/text.js';
import { REQUIRED_LINE, REQUIRED_TEXT } from '../../src/views/form.js';

const sorted = (keys) => [...keys].sort();

test('the step, the field and the text of every missing id, and nothing else', () => {
  for (const [name, map] of Object.entries({ STEP_OF_MISSING, FIELD_OF_MISSING, MISSING_TEXT }))
    assert.deepEqual(sorted(Object.keys(map)), sorted(MISSING_IDS), name);
});

test('every missing id has a line under its question, its own or the one it shares', () => {
  for (const id of MISSING_IDS) assert.ok(REQUIRED_TEXT[REQUIRED_LINE[id] ?? id], id);
  for (const id of Object.keys(REQUIRED_LINE)) assert.ok(MISSING_IDS.includes(id), id);
});

test('every step a missing id points to exists', () => {
  const steps = new Set(STEPS.map((step) => step.id));
  for (const [id, step] of Object.entries(STEP_OF_MISSING)) assert.ok(steps.has(step), id);
});

test('missing() reports only listed ids, across the pay shapes', () => {
  const shapes = [
    {},
    { contract: 'none' },
    { cashMode: 'total' },
    { cashMode: 'total', payrollMin: true },
    { durationUnit: 'unknown' },
    { duration: 3, hoursPerDay: 8, payAmount: 1000, vacation: 'included' },
  ];
  for (const shape of shapes)
    for (const id of missing({ ...DEF_TERMS, ...shape }))
      assert.ok(MISSING_IDS.includes(id), `${id} in ${JSON.stringify(shape)}`);
});
