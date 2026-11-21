import test from 'node:test';
import assert from 'node:assert/strict';
import { diffChanges, entryFor, buildTimeline, ratingText, fromTeleActivity } from '../../src/utils/timeline.js';

test('diffChanges only reports tracked fields that changed', () => {
    const d = diffChanges({ phone: '9876543210', status: 'NEW', remarks: 'x' }, { phone: '9876543210', status: 'VISITED', remarks: 'y', courseInterest: 'NEET' });
    assert.deepEqual(d.map(c => c.field), ['courseInterest', 'status']);
    assert.equal(d[1].from, 'NEW');
    assert.equal(d[1].to, 'VISITED');
});

test('entryFor renders changes, rating and calls', () => {
    const c = entryFor({ type: 'CHANGE', changes: [{ label: 'Status', from: 'NEW', to: 'VISITED' }], date: 1000, by: 'Riya' });
    assert.equal(c.title, 'Status changed');
    assert.match(c.detail, /NEW → VISITED/);
    const r = entryFor({ type: 'RATING', to: { temperature: 'HOT', stars: 4 }, from: { temperature: 'WARM' }, date: 2000 });
    assert.match(r.title, /Hot/);
    assert.match(r.title, /★★★★☆/);
    assert.match(r.detail, /Warm/);
    const k = entryFor({ type: 'CALL', result: 'Interested', talkSeconds: 130, at: { seconds: 5 } });
    assert.equal(k.kind, 'call');
    assert.equal(k.ms, 5000);
    assert.match(k.detail, /2 min/);
});

test('buildTimeline merges lead and admission, newest first, without double payments', () => {
    const lead = { createdAt: 100, source: 'Telecalling', timeline: [
        { type: 'CALL', result: 'Interested', date: 200 },
        { type: 'PAYMENT', result: 'Token Received', note: 'Amount: ₹5,000', date: 400 },
    ] };
    const admission = { payments: [{ amount: 5000, date: 400 }], recoveryTimeline: [{ outcome: 'Promised', date: 500 }], createdAt: 300 };
    const t = buildTimeline({ lead, admission });
    assert.deepEqual(t.map(e => e.ms), [500, 400, 300, 200, 100]);
    assert.equal(t.filter(e => e.kind === 'fee' && /Paid|Token/.test(e.title)).length, 1);
});

test('ratingText and tele activity conversion', () => {
    assert.equal(ratingText({}), 'not rated');
    assert.equal(ratingText({ stars: 2 }), '★★☆☆☆');
    const t = fromTeleActivity([{ stage: 'WARM', note: 'call back', at: 9, by: 'Pooja', talkSeconds: 40 }], s => s.toLowerCase());
    assert.equal(t[0].result, 'warm');
    assert.equal(t[0].role, 'Telecaller');
    assert.equal(t[0].talkSeconds, 40);
});
