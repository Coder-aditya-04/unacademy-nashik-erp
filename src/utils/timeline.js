// One timeline for a student, from the first telecalling call to the last
// fee entry. Everything that happens is appended to the lead's `timeline`
// array (calls, stage moves, edits, rating, payments synced from Accounts),
// so anyone who can open the student sees the same story. Pure functions.

const toMs = (v) => {
    if (!v) return null;
    if (typeof v === 'number') return v;
    if (v.seconds != null) return v.seconds * 1000;
    if (v.toMillis) return v.toMillis();
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
};

export const TEMPS = [
    { id: 'HOT', label: 'Hot', emoji: '🔥', tag: 'jb-tag-late' },
    { id: 'WARM', label: 'Warm', emoji: '🌤️', tag: 'jb-tag-next' },
    { id: 'COLD', label: 'Cold', emoji: '🧊', tag: 'jb-tag-soft' },
];
export const TEMP = Object.fromEntries(TEMPS.map(t => [t.id, t]));

export const ratingText = (r = {}) => [
    r.temperature ? `${TEMP[r.temperature]?.emoji || ''} ${TEMP[r.temperature]?.label || r.temperature}`.trim() : '',
    r.stars ? '★'.repeat(r.stars) + '☆'.repeat(Math.max(0, 5 - r.stars)) : '',
].filter(Boolean).join(' · ') || 'not rated';

// Fields whose edits are worth showing, with a plain label.
export const TRACKED = {
    studentName: 'Name', phone: 'Phone', parentPhone: 'Parent phone', courseInterest: 'Course',
    status: 'Status', assignedByName: 'Counsellor', board: 'Board', currentStandard: 'Class',
    address: 'Address', source: 'Source', centerId: 'Centre',
};

const norm = (v) => (v === undefined || v === null ? '' : String(v).trim());

// [{ field, label, from, to }] for tracked fields that really changed.
export const diffChanges = (before = {}, updates = {}) => Object.keys(TRACKED)
    .filter(k => updates[k] !== undefined && norm(updates[k]) !== norm(before[k]))
    .map(k => ({ field: k, label: TRACKED[k], from: norm(before[k]), to: norm(updates[k]) }));

const KIND = [
    [/^(CALL|TELE_CALL)$/, 'call', '📞'], [/WHATSAPP/, 'call', '💬'], [/VISIT/, 'call', '🏫'],
    [/RATING/, 'rating', '⭐'], [/CHANGE|STATUS|ASSIGN|TRANSFER|BATCH/, 'change', '✏️'],
    [/REFUND/, 'fee', '↩️'], [/PAY|FEE|INSTAL|CORRECTION|TOKEN|DISCOUNT|LOAN/, 'fee', '💰'],
    [/ADMISSION|ENROL|VERIF/, 'fee', '🎓'], [/CREATED/, 'change', '🌱'], [/QUOTE/, 'note', '🧮'],
];
const kindOf = (type = '') => KIND.find(([re]) => re.test(String(type).toUpperCase())) || [null, 'note', '📝'];

// Normalise one stored entry into { ms, kind, emoji, title, detail, by, role }.
export const entryFor = (t = {}) => {
    const [, kind, emoji] = kindOf(t.type);
    let title = t.result || t.message || t.type || 'Note';
    let detail = t.note || '';
    if (Array.isArray(t.changes) && t.changes.length) {
        title = t.changes.length === 1 ? `${t.changes[0].label} changed` : `${t.changes.length} details changed`;
        detail = t.changes.map(c => `${c.label}: ${c.from || '—'} → ${c.to || '—'}`).join(' · ');
    }
    if (t.type === 'RATING') {
        title = `Rated ${ratingText(t.to)}`;
        detail = t.from && (t.from.temperature || t.from.stars) ? `was ${ratingText(t.from)}` : '';
    }
    if (t.talkSeconds) detail = [detail, `talked ${Math.round(t.talkSeconds / 60) || '<1'} min`].filter(Boolean).join(' · ');
    return { ms: toMs(t.date || t.at), kind, emoji, title, detail, by: t.by || '', role: t.role || '' };
};

// Whole story for a lead and (optionally) its admission, newest first.
export const buildTimeline = ({ lead, admission } = {}) => {
    const out = (lead?.timeline || []).map(entryFor);
    if (lead?.createdAt && !(lead.timeline || []).some(t => t.type === 'CREATED')) {
        out.push({ ms: toMs(lead.createdAt), kind: 'change', emoji: '🌱', title: 'Enquiry created', detail: [lead.source, lead.sourceDetails?.location || (typeof lead.sourceDetails === 'string' ? lead.sourceDetails : '')].filter(Boolean).join(' · '), by: lead.sourceDetails?.enteredBy || lead.telecaller || '', role: lead.source === 'Telecalling' ? 'Telecaller' : '' });
    }
    if (admission) {
        const feesLogged = out.some(e => e.kind === 'fee' && /paid|received|token|instal/i.test(e.title + e.detail));
        if (!feesLogged) (admission.payments || []).forEach(p => out.push({ ms: toMs(p.date), kind: 'fee', emoji: '💰', title: `Paid ₹${Math.round(Number(p.amount) || 0).toLocaleString('en-IN')}`, detail: [p.mode, p.type].filter(Boolean).join(' · '), by: p.by || p.collectedBy || '', role: '' }));
        (admission.recoveryTimeline || []).forEach(t => out.push({ ms: toMs(t.date || t.at), kind: 'call', emoji: '⏰', title: t.outcome || t.result || 'Recovery call', detail: t.message || t.note || '', by: t.by || '', role: 'Recovery' }));
        if (!out.some(e => /admission/i.test(e.title))) out.push({ ms: toMs(admission.createdAt || admission.timestamp), kind: 'fee', emoji: '🎓', title: 'Admission booked', detail: admission.program || '', by: admission.counsellorName || admission.bookedBy || '', role: 'Counsellor' });
    }
    // Newest first; entries saved in the same second keep their saved order (later on top).
    return out.map((e, i) => ({ ...e, i })).filter(e => e.ms).sort((a, b) => b.ms - a.ms || b.i - a.i).map(({ i, ...e }) => e); // eslint-disable-line no-unused-vars
};

// Converts telecalling activity into lead timeline entries (on promotion).
export const fromTeleActivity = (activity = [], stageLabel = (s) => s) => activity.map(a => (a.type === 'RATING' ? a : {
    type: 'CALL', result: stageLabel(a.stage), note: a.note || '', date: a.at, by: a.by || 'Telecaller', role: 'Telecaller',
    ...(a.talkSeconds ? { talkSeconds: a.talkSeconds } : {}),
}));
