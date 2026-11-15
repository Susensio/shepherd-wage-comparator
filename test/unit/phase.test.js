// The phase of an offer comes from its dates (ADR-0032).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jobEnd, phaseOf } from '../../src/model/phase.js';

const days = (start, duration, extra = {}) => ({ terms: { start, duration, durationUnit: 'days', ...extra } });

test('an offer marked «solo oferta» is never worked, whatever its dates', () => {
  assert.equal(phaseOf(days('2026-06-01', 30, { offerOnly: true }), '2026-06-10'), 'offerOnly');
  assert.equal(phaseOf(days('', 30, { offerOnly: true }), '2026-06-10'), 'offerOnly');
});

test('no start date, or one after today: undecided', () => {
  assert.equal(phaseOf({ terms: { durationUnit: 'days', duration: 30 } }, '2026-06-10'), 'undecided');
  assert.equal(phaseOf(days('2026-06-11', 30), '2026-06-10'), 'undecided');
});

test('starting today is underway', () => {
  assert.equal(phaseOf(days('2026-06-10', 30), '2026-06-10'), 'underway');
});

test('the last day is still underway; the day after is finished', () => {
  // 10 days from 1 June end on the 10th
  assert.equal(phaseOf(days('2026-06-01', 10), '2026-06-10'), 'underway');
  assert.equal(phaseOf(days('2026-06-01', 10), '2026-06-11'), 'finished');
});

test('without a known duration it stays underway', () => {
  assert.equal(phaseOf({ terms: { start: '2020-01-01', durationUnit: 'unknown' } }, '2026-06-10'), 'underway');
  assert.equal(phaseOf(days('2020-01-01', 0), '2026-06-10'), 'underway');
});

test('a duration in months ends by date', () => {
  const offer = { terms: { start: '2026-01-01', duration: 2, durationUnit: 'months' } };
  assert.equal(phaseOf(offer, '2026-02-28'), 'underway');
  assert.equal(phaseOf(offer, '2026-03-01'), 'finished');
});

test('with a record, the job ends on the later of the offer’s end and the last day worked', () => {
  const record = { months: { '2026-06': { days: { 14: 'work', 20: 'off' } } } };
  const offer = days('2026-06-01', 10); // ends on the 10th
  assert.equal(phaseOf(offer, '2026-06-14', record), 'underway'); // worked until the 14th
  assert.equal(phaseOf(offer, '2026-06-15', record), 'finished');
  assert.equal(phaseOf(offer, '2026-06-15', { months: { '2026-06': { days: { 14: 'off' } } } }), 'finished');
  assert.equal(phaseOf(offer, '2026-06-15'), 'finished'); // no record: as before
});

test('a month with nothing worked does not extend it, and an earlier day worked does not shorten it', () => {
  const offer = days('2026-06-01', 10);
  assert.equal(phaseOf(offer, '2026-07-15', { months: { '2026-07': { closed: true, days: {} } } }), 'finished');
  assert.equal(phaseOf(offer, '2026-06-11', { months: { '2026-06': { days: { '03': 'work' } } } }), 'finished');
});

test('the end the shepherd said decides: earlier than the offer’s it finishes the job, with or without an offer end', () => {
  const record = { end: { how: 'dismissed', date: '2026-06-05' } };
  assert.equal(phaseOf(days('2026-06-01', 30), '2026-06-05', record), 'underway');
  assert.equal(phaseOf(days('2026-06-01', 30), '2026-06-06', record), 'finished');
  assert.equal(phaseOf({ terms: { start: '2026-06-01', durationUnit: 'unknown' } }, '2026-06-06', record), 'finished');
});

test('a day worked after the end said still extends the job', () => {
  const record = { end: { how: 'agreed', date: '2026-06-10' }, months: { '2026-06': { days: { 15: 'work' } } } };
  assert.equal(phaseOf(days('2026-06-01', 10), '2026-06-12', record), 'underway');
  assert.equal(phaseOf(days('2026-06-01', 10), '2026-06-16', record), 'finished');
});

test('the job’s end is one: an end said after the offer’s extends it, in the phase and in settle', () => {
  const offer = days('2026-06-01', 10);
  const record = { end: { how: 'agreed', date: '2026-06-20' } };
  assert.equal(jobEnd(offer, record), '2026-06-20');
  assert.equal(phaseOf(offer, '2026-06-20', record), 'underway');
  assert.equal(phaseOf(offer, '2026-06-21', record), 'finished');
  assert.equal(jobEnd(offer, { end: { how: 'agreed', date: '2026-06-05' } }), '2026-06-05');
  assert.equal(
    jobEnd(offer, { end: { how: 'agreed', date: '2026-06-05' }, months: { '2026-06': { days: { 14: 'work' } } } }),
    '2026-06-14',
  );
  assert.equal(jobEnd({ terms: { start: '2026-06-01', durationUnit: 'unknown' } }, {}), '');
});
