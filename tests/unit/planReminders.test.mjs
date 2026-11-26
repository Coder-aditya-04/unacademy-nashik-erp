import test from 'node:test';
import assert from 'node:assert/strict';
import { remindersFor } from '../../src/utils/planReminderList.js';

const now = new Date(2026, 10, 24, 10, 0).getTime();

test('future timed tasks get a reminder at their time', () => {
    const r = remindersFor('2026-11-24', [{ id: 'a', title: 'Call Mr Patil', time: '14:30' }], now);
    assert.equal(r.length, 1);
    assert.equal(r[0].schedule.at.getHours(), 14);
    assert.equal(r[0].schedule.at.getMinutes(), 30);
    assert.match(r[0].body, /2:30 PM/);
    assert.equal(r[0].extra.plan, '2026-11-24');
});

test('done, untimed and past tasks are skipped', () => {
    const r = remindersFor('2026-11-24', [
        { id: 'a', title: 'Done', time: '15:00', done: true },
        { id: 'b', title: 'No time' },
        { id: 'c', title: 'Earlier', time: '09:00' },
    ], now);
    assert.equal(r.length, 0);
});

test('ids are stable 32-bit numbers and differ per day', () => {
    const a = remindersFor('2026-11-25', [{ id: 'x', title: 'T', time: '09:00' }], now)[0].id;
    const b = remindersFor('2026-11-25', [{ id: 'x', title: 'T', time: '09:00' }], now)[0].id;
    const c = remindersFor('2026-11-26', [{ id: 'x', title: 'T', time: '09:00' }], now)[0].id;
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.ok(Number.isInteger(a) && a > 0 && a <= 2147483647);
});
