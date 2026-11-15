// Overdue fees for the Recovery desk and the counsellor reminders.
// A student is due when the admission is live (ACTIVE / TOKEN_PAID /
// PENDING_APPROVAL), not refunded, and has a balance over ₹100.
// Due date = nextPaymentDate if set (YYYY-MM-DD or DD/MM/YYYY), otherwise
// 30 days after admission, the same rule the dashboards already use.

const DAY = 86400000;
const LIVE = new Set(['ACTIVE', 'TOKEN_PAID', 'PENDING_APPROVAL']);

const toMillis = (d) => {
    if (!d) return null;
    if (typeof d.toMillis === 'function') return d.toMillis();
    if (typeof d.seconds === 'number') return d.seconds * 1000;
    const t = new Date(d).getTime();
    return Number.isNaN(t) ? null : t;
};

export const parseDay = (s) => {
    if (!s) return null;
    const str = String(s);
    const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const [y, m, d] = dmy ? [dmy[3], dmy[2], dmy[1]] : str.slice(0, 10).split('-');
    const t = new Date(Number(y), Number(m) - 1, Number(d)).getTime();
    return Number.isNaN(t) ? null : t;
};

export const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

export const dueInfo = (a, now = Date.now()) => {
    if (!LIVE.has(a.status)) return null;
    if (a.status === 'REFUNDED' || Number(a.refundAmount) > 0) return null;
    const balance = (Number(a.amount) || 0) - (Number(a.totalPaid) || 0);
    if (balance <= 100) return null;
    let due = parseDay(a.nextPaymentDate);
    if (due == null) {
        const created = toMillis(a.createdAt) ?? toMillis(a.enrollmentDate);
        if (created == null) return null;
        due = startOfDay(created + 30 * DAY);
    }
    const daysOverdue = Math.floor((startOfDay(now) - due) / DAY);
    const promised = parseDay(a.promisedDate);
    return {
        balance, due, daysOverdue,
        promisedDate: promised,
        promiseToday: promised != null && promised === startOfDay(now),
        promiseBroken: promised != null && promised < startOfDay(now),
        lastNote: (a.recoveryTimeline || []).slice(-1)[0] || null,
    };
};

export const BUCKETS = [
    { id: 'ALL_OVERDUE', label: 'All overdue', test: (d) => d.daysOverdue > 0 },
    { id: 'D1_7', label: '1–7 days', test: (d) => d.daysOverdue >= 1 && d.daysOverdue <= 7 },
    { id: 'D8_21', label: '8–21 days', test: (d) => d.daysOverdue >= 8 && d.daysOverdue <= 21 },
    { id: 'D22', label: '22+ days', test: (d) => d.daysOverdue >= 22 },
    { id: 'UPCOMING', label: 'Due in 7 days', test: (d) => d.daysOverdue <= 0 && d.daysOverdue >= -7 },
    { id: 'PROMISED', label: 'Promised today', test: (d) => d.promiseToday },
];

// Rows for a list of admissions, most overdue first.
export const buildRecoveryList = (admissions, bucketId = 'ALL_OVERDUE', now = Date.now()) => {
    const bucket = BUCKETS.find((b) => b.id === bucketId) || BUCKETS[0];
    return (admissions || [])
        .map((a) => ({ a, d: dueInfo(a, now) }))
        .filter(({ d }) => d && bucket.test(d))
        .sort((x, y) => y.d.daysOverdue - x.d.daysOverdue || y.d.balance - x.d.balance);
};
