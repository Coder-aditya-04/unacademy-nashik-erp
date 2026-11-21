// Refunds and dropout rate. A dropout is an admission that was refunded,
// cancelled or marked dropped. Rejected bookings (never admitted) don't count.
const ms = (v) => (v?.seconds != null ? v.seconds * 1000 : v ? new Date(v).getTime() || null : null);

export const DROP_STATUSES = ['REFUNDED', 'CANCELLED', 'DROPPED', 'DROPOUT', 'LEFT'];
export const counts = (a) => !['REJECTED'].includes(String(a.status || '').toUpperCase());
export const isDropout = (a) => DROP_STATUSES.includes(String(a.status || '').toUpperCase()) || Number(a.refundAmount) > 0;

// { amount, ms, mode, note } for an admission's refund.
export const refundOf = (a) => {
    const neg = (Array.isArray(a.payments) ? a.payments : []).filter(p => Number(p.amount) < 0 || /refund/i.test(p.type || '') || /refund/i.test(p.mode || ''));
    const last = neg[neg.length - 1];
    const amount = Number(a.refundAmount) || neg.reduce((x, p) => x + Math.abs(Number(p.amount) || 0), 0);
    return {
        amount, ms: ms(last?.date) || ms(a.refundDate) || ms(a.lastUpdated) || ms(a.createdAt),
        mode: last?.mode || '', note: a.refundReason || a.refundRemarks || last?.remarks || last?.note || '',
    };
};

const pct = (d, t) => (t ? Math.round((d / t) * 1000) / 10 : 0);

// Rows by any key: [{ key, total, dropped, pct, refunded }], biggest first.
export const dropoutBy = (admissions, keyOf) => {
    const m = {};
    admissions.filter(counts).forEach(a => {
        const k = keyOf(a) || 'Not set';
        const r = (m[k] ||= { key: k, total: 0, dropped: 0, refunded: 0 });
        r.total += 1;
        if (isDropout(a)) { r.dropped += 1; r.refunded += refundOf(a).amount; }
    });
    return Object.values(m).map(r => ({ ...r, pct: pct(r.dropped, r.total) })).sort((x, y) => y.total - x.total);
};

export const dropoutTotal = (admissions) => {
    const list = admissions.filter(counts);
    const dropped = list.filter(isDropout);
    return { total: list.length, dropped: dropped.length, pct: pct(dropped.length, list.length), refunded: dropped.reduce((x, a) => x + refundOf(a).amount, 0) };
};
