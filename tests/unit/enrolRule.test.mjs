import test from 'node:test';
import assert from 'node:assert/strict';
import { enrolLimits, enrolDateProblem } from '../../src/utils/enrolRule.js';

const d = (s) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };

test('Nov to Apr: batch start date up to 6 months ahead', () => {
    assert.equal(enrolLimits(d('2026-11-22')).max, '2027-05-22');
    assert.equal(enrolDateProblem('2027-02-10', d('2026-11-22')), null); // token today, batch in Feb
    assert.equal(enrolLimits(d('2027-01-15')).max, '2027-07-15');
    assert.equal(enrolLimits(d('2026-12-31')).max, '2027-06-30');
    assert.equal(enrolLimits(d('2027-04-30')).max, '2027-10-30');
    assert.match(enrolDateProblem('2027-05-23', d('2026-11-22')), /too far ahead/);
});

test('after April: only the next 30 days', () => {
    assert.equal(enrolLimits(d('2027-05-05')).max, '2027-06-04');
    assert.equal(enrolLimits(d('2027-08-01')).max, '2027-08-31');
    assert.match(enrolDateProblem('2027-07-01', d('2027-05-05')), /too far ahead/);
});

test('back-dating and empty', () => {
    assert.equal(enrolLimits(d('2027-08-01')).min, '2027-07-25');
    assert.match(enrolDateProblem('2027-07-01', d('2027-08-01')), /too far back/);
    assert.equal(enrolDateProblem('', d('2027-08-01')), 'Pick the enrolment date.');
});
