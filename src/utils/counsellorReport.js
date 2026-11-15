// Per-counsellor booked / collected figures for a date range.
// booked    = total fee of admissions booked in the range
// collected = money actually received in the range (refunds subtract),
//             counted from each admission's payments[] by payment date
// pending   = balance still due today on that counsellor's admissions
// Admissions are attributed to counsellorId (falls back to bookedById).

const toMillis = (d) => {
    if (!d) return null;
    if (typeof d.toMillis === 'function') return d.toMillis();
    if (typeof d.seconds === 'number') return d.seconds * 1000;
    const t = new Date(d).getTime();
    return Number.isNaN(t) ? null : t;
};

const COUNTED = new Set(['ACTIVE', 'COMPLETED', 'TOKEN_PAID', 'PENDING_APPROVAL', 'REFUNDED']);

export const buildCounsellorReport = (admissions, { from = null, to = null } = {}) => {
    const inRange = (ms) => ms != null && (from == null || ms >= from) && (to == null || ms <= to);
    const rows = new Map();

    for (const a of admissions || []) {
        if (!COUNTED.has(a.status)) continue;
        const id = a.counsellorId || a.bookedById || 'unknown';
        if (!rows.has(id)) {
            rows.set(id, { id, name: a.counsellorName || a.bookedBy || 'Unknown', admissions: 0, booked: 0, collected: 0, pending: 0 });
        }
        const r = rows.get(id);
        if (inRange(toMillis(a.createdAt))) {
            r.admissions += 1;
            r.booked += Number(a.amount) || 0;
        }
        for (const p of a.payments || []) {
            if (inRange(toMillis(p.date))) r.collected += Number(p.amount) || 0;
        }
        const refunded = a.status === 'REFUNDED' || Number(a.refundAmount) > 0;
        if (!refunded) r.pending += Math.max(0, (Number(a.amount) || 0) - (Number(a.totalPaid) || 0));
    }

    return [...rows.values()]
        .filter((r) => r.admissions || r.collected || r.pending)
        .sort((x, y) => y.collected - x.collected || y.booked - x.booked);
};

// Start/end (ms) for the range presets used by the report.
export const rangeFor = (preset, now = new Date()) => {
    const y = now.getFullYear(), m = now.getMonth();
    if (preset === 'TODAY') return { from: new Date(y, m, now.getDate()).getTime(), to: now.getTime() };
    if (preset === 'THIS_MONTH') return { from: new Date(y, m, 1).getTime(), to: now.getTime() };
    if (preset === 'LAST_MONTH') return { from: new Date(y, m - 1, 1).getTime(), to: new Date(y, m, 1).getTime() - 1 };
    return { from: null, to: null }; // ALL
};
