// The legal data in src/law.js is complete and consistent. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LAW, MIN_WAGE, RULES, SOCIAL_SECURITY, SOURCES, ssTotal } from '../../src/law.js';
import { DEF_CFG } from '../../src/offer.js';

const years = Object.keys(MIN_WAGE).map(Number);

test('the minimum wage covers this year', () => {
  assert.deepEqual(
    years,
    years.map((_, i) => years[0] + i),
    'years must be consecutive',
  );
  // Fails in January until someone adds the new year's minimum wage
  assert.ok(years.includes(new Date().getFullYear()), "add this year's minimum wage to src/law.js");
});

test('the minimum-wage figures are plausible', () => {
  for (const [year, m] of Object.entries(MIN_WAGE)) {
    assert.ok(
      m.casual > m.annual / LAW.smiDaysPerYear,
      `${year}: casual daily minimum below the daily share of the annual`,
    );
    assert.ok(m.decree && m.url, `${year}: decree or link missing`);
    if (m.ded) assert.ok(m.ded.max > 0 && m.ded.taper > 0 && m.ded.from >= m.annual - 1, `${year}: odd IRPF deduction`);
  }
});

test('every rule has a source or a note', () => {
  for (const [key, rule] of Object.entries(RULES))
    assert.ok(rule.source ? SOURCES[rule.source] && rule.art : rule.note, `${key}: no source and no note`);
});

test('the default settings come from the law', () => {
  assert.equal(DEF_CFG.ssPct, ssTotal(SOCIAL_SECURITY.worker));
  assert.equal(DEF_CFG.ssEmp, ssTotal(SOCIAL_SECURITY.employer));
  assert.equal(DEF_CFG.overnightPct, LAW.overnightPct);
  assert.equal(DEF_CFG.vacationDaysPerYear, LAW.vacationDaysPerYear);
});
