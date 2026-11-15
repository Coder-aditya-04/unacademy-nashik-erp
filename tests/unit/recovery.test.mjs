import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueInfo, buildRecoveryList, parseDay } from '../../src/utils/recovery.js';

const now = new Date(2026, 10, 15, 10).getTime();
const base = { status: 'ACTIVE', amount: 100000, totalPaid: 40000 };

test('due date from nextPaymentDate in both formats', () => {
  assert.equal(parseDay('2026-11-05'), new Date(2026, 10, 5).getTime());
  assert.equal(parseDay('05/11/2026'), new Date(2026, 10, 5).getTime());
  assert.equal(dueInfo({ ...base, nextPaymentDate: '2026-11-05' }, now).daysOverdue, 10);
});

test('falls back to 30 days after admission', () => {
  const d = dueInfo({ ...base, createdAt: new Date(2026, 9, 1) }, now);
  assert.equal(d.daysOverdue, 15); // due 31 Oct
});

test('paid up, refunded or cancelled students are not due', () => {
  assert.equal(dueInfo({ ...base, totalPaid: 99950, nextPaymentDate: '2026-11-01' }, now), null);
  assert.equal(dueInfo({ ...base, refundAmount: 5000, nextPaymentDate: '2026-11-01' }, now), null);
  assert.equal(dueInfo({ ...base, status: 'COMPLETED', nextPaymentDate: '2026-11-01' }, now), null);
});

test('buckets and ordering', () => {
  const list = [
    { ...base, id: 'a', nextPaymentDate: '2026-11-12' },               // 3 days
    { ...base, id: 'b', nextPaymentDate: '2026-10-01' },               // 45 days
    { ...base, id: 'c', nextPaymentDate: '2026-11-20' },               // upcoming
    { ...base, id: 'd', nextPaymentDate: '2026-11-01', promisedDate: '2026-11-15' },
  ];
  assert.deepEqual(buildRecoveryList(list, 'ALL_OVERDUE', now).map((r) => r.a.id), ['b', 'd', 'a']);
  assert.deepEqual(buildRecoveryList(list, 'D22', now).map((r) => r.a.id), ['b']);
  assert.deepEqual(buildRecoveryList(list, 'UPCOMING', now).map((r) => r.a.id), ['c']);
  assert.deepEqual(buildRecoveryList(list, 'PROMISED', now).map((r) => r.a.id), ['d']);
});
