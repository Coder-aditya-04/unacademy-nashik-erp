// Numbers for the board J screens, worked out from the live admissions and
// leads lists. Pure functions: no Firestore calls here.
import { dueInfo } from '../../utils/recovery';
import { sessionFor, getSessionStart } from '../../utils/academicYear';
import { toMs, DAY, dayStart } from '../../components/j/util';

export const CENTRES = [
    { value: 'ALL', label: 'All' },
    { value: 'UN_NASHIK_RD', label: 'Nashik Road' },
    { value: 'UN_COLLEGE', label: 'College Road' },
    { value: 'PRAYAS', label: 'Prayaas' },
];
export const CENTRE_NAME = { UN_NASHIK_RD: 'Nashik Road', UN_COLLEGE: 'College Road', PRAYAS: 'Prayaas' };
export const CENTRE_TONE = { UN_NASHIK_RD: 'var(--ok)', UN_COLLEGE: 'var(--coral)', PRAYAS: '#7E9CC0' };

// Old records carry only a centre name, or nothing (those were College Road).
export const centreOf = (r) => {
    const id = String(r?.centerId || '').trim().toUpperCase();
    const name = String(r?.centerName || '').trim().toUpperCase();
    if (id === 'UN_NASHIK_RD' || id.includes('NASHIK RD') || /NASHIK R(OA)?D|JAIL/.test(name)) return 'UN_NASHIK_RD';
    if (id.includes('PRAYAS') || name.includes('PRAYAS')) return 'PRAYAS';
    return 'UN_COLLEGE';
};
export const inCentre = (r, c) => c === 'ALL' || centreOf(r) === c;

export const LIVE = ['ACTIVE', 'TOKEN_PAID', 'COMPLETED', 'PENDING_APPROVAL'];
export const isLive = (a) => LIVE.includes(a.status) && !(Number(a.refundAmount) > 0);

export const paymentsOf = (a) => (Array.isArray(a.payments) ? a.payments : [])
    .map(p => ({ amount: Number(p.amount) || 0, ms: toMs(p.date), mode: p.mode || '', type: p.type || '', verified: p.verified, raw: p }))
    .filter(p => p.ms != null && p.amount > 0);

export const createdMs = (r) => toMs(r.createdAt) ?? toMs(r.enrollmentDate);

// [from, to) for a period: today, this month or the current session.
export const rangeFor = (period, now = Date.now()) => {
    const d = new Date(now);
    if (period === 'TODAY') { const s = dayStart(now); return [s, s + DAY]; }
    if (period === 'MONTH') return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()];
    const s = sessionFor(d), st = getSessionStart();
    const start = new Date(s.startYear, st.month - 1, st.day).getTime();
    return [start, new Date(s.startYear + 1, st.month - 1, st.day).getTime()];
};
export const inRange = (ms, [a, b]) => ms != null && ms >= a && ms < b;

export const collectedIn = (admissions, range) => admissions.reduce((sum, a) => sum + paymentsOf(a).filter(p => inRange(p.ms, range)).reduce((x, p) => x + p.amount, 0), 0);

// Seven buckets ending now: days for Today and This month, months for Session.
export const sparkBuckets = (period, now = Date.now()) => {
    const out = [];
    if (period === 'SESSION') {
        const d = new Date(now);
        for (let i = 6; i >= 0; i--) out.push([new Date(d.getFullYear(), d.getMonth() - i, 1).getTime(), new Date(d.getFullYear(), d.getMonth() - i + 1, 1).getTime()]);
    } else {
        const s = dayStart(now);
        for (let i = 6; i >= 0; i--) out.push([s - i * DAY, s - i * DAY + DAY]);
    }
    return out;
};

export const balanceOf = (a) => Math.max(0, (Number(a.amount) || 0) - (Number(a.totalPaid) || 0));

// Overdue students with days late, biggest risk first.
export const overdueList = (admissions, now = Date.now()) => admissions
    .map(a => ({ a, d: dueInfo(a, now) }))
    .filter(x => x.d && x.d.daysOverdue > 0)
    .sort((x, y) => y.d.daysOverdue - x.d.daysOverdue || y.d.balance - x.d.balance);

export const phoneOf = (r) => r?.parentPhone || r?.fatherPhone || r?.phone || r?.studentPhone || '';
export const studentPhone = (r) => r?.phone || r?.studentPhone || '';

export const dateLabel = (ms, opts = { day: 'numeric', month: 'short' }) => (ms ? new Date(ms).toLocaleDateString('en-IN', opts) : '');
export const timeLabel = (ms) => (ms ? new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');
export const ago = (ms, now = Date.now()) => {
    if (!ms) return '';
    const m = Math.round((now - ms) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return d === 1 ? 'yesterday' : `${d} days ago`;
};

export const programLabel = (p) => String(p || '').replace(/_/g, ' ').replace(/\bNEET JEE\b/, 'NEET/JEE');
