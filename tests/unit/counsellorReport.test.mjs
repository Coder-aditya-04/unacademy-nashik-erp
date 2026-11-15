import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCounsellorReport, rangeFor } from '../../src/utils/counsellorReport.js';

const d = (s) => new Date(s);
const adm = [
  { status: 'ACTIVE', counsellorId: 'c1', counsellorName: 'Asha', amount: 100000, totalPaid: 40000, createdAt: d('2026-11-02'),
    payments: [{ amount: 10000, date: d('2026-11-02') }, { amount: 30000, date: d('2026-10-20') }] },
  { status: 'COMPLETED', bookedById: 'c2', bookedBy: 'Rahul', amount: 50000, totalPaid: 50000, createdAt: d('2026-10-05'),
    payments: [{ amount: 50000, date: d('2026-11-10') }] },
  { status: 'REFUNDED', counsellorId: 'c1', counsellorName: 'Asha', amount: 80000, totalPaid: 0, refundAmount: 5000, createdAt: d('2026-11-03'),
    payments: [{ amount: 5000, date: d('2026-11-03') }, { amount: -5000, date: d('2026-11-08') }] },
  { status: 'CANCELLED', counsellorId: 'c1', amount: 999999, payments: [{ amount: 999999, date: d('2026-11-05') }] },
];

test('November: booked by creation date, collected by payment date, refunds subtract', () => {
  const r = buildCounsellorReport(adm, { from: d('2026-11-01').getTime(), to: d('2026-11-30').getTime() });
  const asha = r.find((x) => x.id === 'c1'), rahul = r.find((x) => x.id === 'c2');
  assert.deepEqual([asha.admissions, asha.booked, asha.collected, asha.pending], [2, 180000, 10000, 60000]);
  assert.deepEqual([rahul.admissions, rahul.booked, rahul.collected, rahul.pending], [0, 0, 50000, 0]);
  assert.equal(r[0].id, 'c2'); // sorted by collected
});

test('all time and presets', () => {
  const r = buildCounsellorReport(adm);
  assert.equal(r.find((x) => x.id === 'c1').collected, 40000);
  const now = new Date(2026, 10, 15, 12);
  assert.equal(rangeFor('THIS_MONTH', now).from, new Date(2026, 10, 1).getTime());
  assert.equal(rangeFor('LAST_MONTH', now).to, new Date(2026, 10, 1).getTime() - 1);
});
