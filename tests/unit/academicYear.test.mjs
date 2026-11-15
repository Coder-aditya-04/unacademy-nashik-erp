import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionFor, admissionSession, sessionsIn, setSessionStart, DEFAULT_SESSION_START } from '../../src/utils/academicYear.js';

test('1 December starts the next session; roll yy is the end year', () => {
    assert.deepEqual(sessionFor(new Date(2026, 10, 30)), { key: '2025-26', startYear: 2025, endYear: 2026, yy: '26' });
    assert.deepEqual(sessionFor(new Date(2026, 11, 1)), { key: '2026-27', startYear: 2026, endYear: 2027, yy: '27' });
    assert.equal(sessionFor(new Date(2027, 0, 15)).key, '2026-27');
    assert.equal(sessionFor(new Date(2027, 1, 29 - 1)).yy, '27');
});

test('January to November match the old calendar-year roll yy', () => {
    for (let m = 0; m < 11; m++) assert.equal(sessionFor(new Date(2026, m, 15)).yy, '26');
});

test('admission session: saved field wins, else enrollment date, else createdAt', () => {
    assert.equal(admissionSession({ academicYear: '2024-25', enrollmentDate: '2026-12-05' }), '2024-25');
    assert.equal(admissionSession({ enrollmentDate: '2026-12-05' }), '2026-27');
    assert.equal(admissionSession({ enrollmentDate: '05/12/2026' }), '2026-27');
    assert.equal(admissionSession({ createdAt: { seconds: Date.UTC(2026, 5, 1) / 1000 } }), '2025-26');
});

test('sessionsIn lists newest first', () => {
    const list = sessionsIn([{ enrollmentDate: '2024-06-01' }, { enrollmentDate: '2025-12-02' }]);
    assert.ok(list.indexOf('2025-26') < list.indexOf('2023-24'));
});

test('a different start from settings is honoured, bad values fall back', () => {
    setSessionStart({ month: 6, day: 1 });
    assert.equal(sessionFor(new Date(2026, 5, 1)).key, '2026-27');
    assert.equal(sessionFor(new Date(2026, 4, 31)).key, '2025-26');
    setSessionStart({ month: 13, day: 1 });
    assert.equal(sessionFor(new Date(2026, 11, 1)).key, '2026-27');
    setSessionStart(DEFAULT_SESSION_START);
});
