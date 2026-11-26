import test from 'node:test';
import assert from 'node:assert/strict';
import { isDropout, refundOf, dropoutBy, dropoutTotal } from '../../src/utils/dropout.js';

const A = [
    { status: 'ACTIVE', program: 'NEET', counsellorName: 'Asha' },
    { status: 'REFUNDED', refundAmount: 20000, program: 'NEET', counsellorName: 'Asha' },
    { status: 'ACTIVE', program: 'JEE', counsellorName: 'Rahul', payments: [{ amount: 5000 }, { amount: -3000, type: 'Refund', date: 1000 }] },
    { status: 'REJECTED', program: 'JEE', counsellorName: 'Rahul' },
];

test('dropout and refund detection', () => {
    assert.equal(isDropout(A[0]), false);
    assert.equal(isDropout(A[1]), true);
    assert.equal(refundOf(A[2]).amount, 3000);
    assert.equal(refundOf(A[2]).ms, 1000);
});

test('dropout totals skip rejected bookings', () => {
    const t = dropoutTotal(A);
    assert.equal(t.total, 3);
    assert.equal(t.dropped, 1);
    assert.equal(t.pct, 33.3);
    assert.equal(t.refunded, 20000);
});

test('dropout by counsellor', () => {
    const r = dropoutBy(A, a => a.counsellorName);
    const asha = r.find(x => x.key === 'Asha');
    assert.equal(asha.pct, 50);
    assert.equal(r.find(x => x.key === 'Rahul').total, 1);
});
