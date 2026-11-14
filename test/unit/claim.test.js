// The ladder of a claim: its steps, deadlines and the next one to take (ADR-0034). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { claimSteps, dismissalDeadline } from '../../src/model/claim.js';

describe('dismissalDeadline: 20 weekdays from the day after, holidays ignored', () => {
  test('a Friday: the weekend does not count, the 20th weekday is the Friday four weeks on', () => {
    // 2026-10-02 is a Friday
    assert.equal(new Date('2026-10-02T12:00:00').getDay(), 5);
    assert.equal(dismissalDeadline('2026-10-02'), '2026-10-30');
  });

  test('a Saturday and a Sunday count from the Monday after', () => {
    assert.equal(dismissalDeadline('2026-10-03'), '2026-10-30'); // Saturday
    assert.equal(dismissalDeadline('2026-10-04'), '2026-10-30'); // Sunday
  });

  test('a Monday: the 20th weekday is the Monday four weeks on', () => {
    assert.equal(dismissalDeadline('2026-10-05'), '2026-11-02');
  });

  test('August counts like any month, and the year turns', () => {
    assert.equal(dismissalDeadline('2026-08-03'), '2026-08-31');
    assert.equal(dismissalDeadline('2026-12-18'), '2027-01-15');
  });
});

/** The parts of `standingOf` the ladder reads. */
const standing = (deadlines, extra = {}) => ({
  hasPayments: true,
  falta: deadlines.reduce((t, d) => t + d.owed, 0),
  deadlines,
  ...extra,
});
const owing = (deadline, lapsed = false) => ({ month: '2026-07', owed: 100, deadline, lapsed, daysLeft: 0 });
const ladder = (over) =>
  claimSteps({ today: '2026-11-14', standing: standing([owing('2027-07-31')]), end: undefined, marks: {}, ...over });
const ids = (l) => l.steps.map((s) => s.id);

describe('claimSteps', () => {
  test('owed: the ladder from the conversation to FOGASA, the court waiting for the conciliation', () => {
    const l = ladder({});
    assert.equal(l.mode, 'owed');
    assert.deepEqual(ids(l), ['talk', 'request', 'union', 'conciliation', 'inspection', 'court', 'fogasa']);
    assert.equal(l.steps.find((s) => s.id === 'court')?.ready, false);
    assert.equal(l.by, '2027-07-31');
    assert.equal(l.steps.find((s) => s.id === 'conciliation')?.deadline, '2027-07-31');
    assert.equal(l.inWindow, true);
    assert.equal(l.next?.id, 'talk');
    assert.equal(l.next?.by, '2027-07-31');
  });

  test('the conciliation’s deadline is the earliest month not lapsed; lapsed ones are skipped', () => {
    const l = ladder({ standing: standing([owing('2026-10-31', true), owing('2027-08-31'), owing('2027-07-31')]) });
    assert.equal(l.by, '2027-07-31');
    const none = ladder({ standing: standing([owing('2026-10-31', true)]) });
    assert.equal(none.by, null);
    assert.equal(none.lapsedAll, true);
    assert.equal(none.inWindow, false);
  });

  test('marks decide the next step; the court opens once the conciliation is done', () => {
    const marks = { talk: { done: '2026-11-01' }, request: { done: '2026-11-02' } };
    assert.equal(ladder({ marks }).next?.id, 'union');
    const filed = ladder({ marks: { ...marks, union: { done: '2026-11-03' }, conciliation: { done: '2026-11-04' } } });
    assert.equal(filed.steps.find((s) => s.id === 'court')?.ready, true);
    assert.equal(filed.next?.id, 'inspection');
    assert.deepEqual(filed.steps.find((s) => s.id === 'talk')?.done, { done: '2026-11-01' });
  });

  test('nothing owed and nobody dismissed: no ladder', () => {
    const l = ladder({ standing: standing([], { falta: 0 }) });
    assert.equal(l.mode, 'settled');
    assert.deepEqual(l.steps, []);
    assert.equal(l.inWindow, false);
    assert.equal(l.next, null);
  });

  test('no cobro recorded: only the first step', () => {
    const l = ladder({ standing: standing([], { hasPayments: false, falta: 800 }) });
    assert.equal(l.mode, 'noCobros');
    assert.deepEqual(ids(l), ['talk']);
    assert.equal(l.inWindow, false);
  });

  test('a dismissal comes first, with its conservative date, even when nothing is owed', () => {
    const l = ladder({
      standing: standing([], { falta: 0 }),
      end: { how: 'dismissed', date: '2026-11-06' }, // a Friday
    });
    assert.equal(l.mode, 'dismissed');
    assert.deepEqual(ids(l), ['dismissal']);
    const [d] = l.steps;
    assert.equal(d.deadline, '2026-12-04');
    assert.equal(d.daysLeft, 20);
    assert.equal(d.lapsed, false);
    assert.equal(l.inWindow, true);
    assert.equal(l.next?.by, '2026-12-04');
  });

  test('a dismissal and something owed: the dismissal leads, the rest follow', () => {
    const l = ladder({ end: { how: 'dismissed', date: '2026-11-06' } });
    assert.equal(ids(l)[0], 'dismissal');
    assert.equal(ids(l).length, 8);
    assert.equal(l.next?.id, 'dismissal');
  });

  test('a dismissal window that lapsed, or was acted on, is not open', () => {
    const lapsed = ladder({ standing: standing([], { falta: 0 }), end: { how: 'dismissed', date: '2026-09-01' } });
    assert.equal(lapsed.steps[0].lapsed, true);
    assert.equal(lapsed.inWindow, false);
    const acted = ladder({
      standing: standing([], { falta: 0 }),
      end: { how: 'dismissed', date: '2026-11-06' },
      marks: { dismissal: { done: '2026-11-10' } },
    });
    assert.equal(acted.inWindow, false);
    assert.equal(acted.next, null);
  });

  test('other ways of ending add no step of their own', () => {
    for (const how of ['agreed', 'quit', 'sick'])
      assert.equal(ids(ladder({ end: { how, date: '2026-11-06' } }))[0], 'talk');
  });
});
