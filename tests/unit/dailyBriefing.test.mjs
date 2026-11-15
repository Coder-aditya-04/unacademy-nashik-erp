import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyBriefing, localYmd } from '../../src/utils/dailyBriefing.js';

const today = '2026-11-15';

test('splits follow-ups into today and missed, oldest missed first', () => {
    const b = buildDailyBriefing({ today, tasks: [
        { id: 'a', nextFollowUp: '2026-11-15' },
        { id: 'b', nextFollowUp: '2026-11-13' },
        { id: 'c', nextFollowUp: '2026-11-10' },
    ] });
    assert.deepEqual(b.followUpsToday.map(t => t.id), ['a']);
    assert.deepEqual(b.followUpsMissed.map(t => t.id), ['c', 'b']);
});

test('fee dues: overdue (most late first), today, next 2 days; later ones left out', () => {
    const b = buildDailyBriefing({ today, installments: [
        { id: 'x', daysLeft: -3, balance: 1000 },
        { id: 'y', daysLeft: -20, balance: 5000 },
        { id: 'z', daysLeft: 0, balance: 200 },
        { id: 'w', daysLeft: 2, balance: 300 },
        { id: 'v', daysLeft: 6, balance: 300 },
    ] });
    assert.deepEqual(b.feesOverdue.map(i => i.id), ['y', 'x']);
    assert.deepEqual(b.feesToday.map(i => i.id), ['z']);
    assert.deepEqual(b.feesSoon.map(i => i.id), ['w']);
    assert.equal(b.overdueAmount, 6000);
    assert.equal(b.count, 4);
});

test('a promise due today is listed once, as a promise', () => {
    const b = buildDailyBriefing({ today, installments: [{ id: 'p', daysLeft: 0, promisedDate: today, balance: 900 }] });
    assert.equal(b.promisesToday.length, 1);
    assert.equal(b.feesToday.length, 0);
    assert.equal(b.count, 1);
});

test('empty day', () => {
    assert.equal(buildDailyBriefing({ today }).count, 0);
    assert.match(localYmd(new Date(2026, 0, 5)), /^2026-01-05$/);
});
