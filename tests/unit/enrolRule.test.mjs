import test from 'node:test';
import assert from 'node:assert/strict';
import { enrolLimits, enrolDateProblem } from '../../src/utils/enrolRule.js';

const d = (s) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };

test('Dec to Apr: any date up to 30 April of the session', () => {
    assert.equal(enrolLimits(d('2026-12-10')).max, '2027-04-30');
    assert.equal(enrolLimits(d('2027-02-01')).max, '2027-04-30');
    assert.equal(enrolLimits(d('2027-04-30')).max, '2027-04-30');
    assert.equal(enrolDateProblem('2027-05-01', d('2027-01-15')) !== null, true);
    assert.equal(enrolDateProblem('2027-04-20', d('2027-01-15')), null);
});

test('May onwards: next 30 days, never after 29 June', () => {
    assert.equal(enrolLimits(d('2027-05-05')).max, '2027-06-04');
    assert.equal(enrolLimits(d('2027-06-10')).max, '2027-06-29');
    assert.match(enrolDateProblem('2027-07-01', d('2027-06-10')), /too far ahead/);
});

test('late admissions and back-dating', () => {
    assert.equal(enrolLimits(d('2027-08-01')).max, '2027-08-31');
    assert.equal(enrolLimits(d('2027-08-01')).min, '2027-07-25');
    assert.match(enrolDateProblem('2027-07-01', d('2027-08-01')), /too far back/);
    assert.equal(enrolDateProblem('', d('2027-08-01')), 'Pick the enrolment date.');
});
