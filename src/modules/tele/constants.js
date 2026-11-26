// Telecalling vocabulary, copied from the team's TeleCRM setup (21 Nov 2026)
// so telecallers see the same stages and call results they already know.

export const STAGES = [
    { id: 'NEW', label: 'New lead', tone: '#7E9BC0', open: true },
    { id: 'NATC', label: 'NATC', tone: '#9AA7B4', open: true },
    { id: 'DNP', label: 'DNP', tone: '#D8734F', open: true },
    { id: 'COLD', label: 'Cold', tone: '#C9A646', open: true },
    { id: 'WARM', label: 'Warm', tone: '#E2BE4E', open: true },
    { id: 'INTERESTED', label: 'Interested', tone: '#8FAE7B', open: true, promote: true },
    { id: 'VISIT_SCHEDULED', label: 'Centre visit scheduled', tone: '#6F9E86', open: true, promote: true },
    { id: 'VISIT_RESCHEDULED', label: 'Centre visit rescheduled', tone: '#6F9E86', open: true, promote: true },
    { id: 'VISIT_AGREED', label: 'Visit done: agree to pay', tone: '#4E8A6A', open: true, promote: true },
    { id: 'VISIT_PENDING', label: 'Visit done: decision pending', tone: '#9C8FD0', open: true, promote: true },
    { id: 'NOT_INTERESTED', label: 'Not interested', tone: '#B7A99A', open: false },
    { id: 'INVALID', label: 'Invalid lead', tone: '#B7A99A', open: false },
    { id: 'ENROLLED', label: 'Enrolled', tone: '#2F7A55', open: false },
    { id: 'LOST', label: 'Lost', tone: '#B7A99A', open: false },
];
export const STAGE = Object.fromEntries(STAGES.map(s => [s.id, s]));

// Call results. CONNECTED is filled in automatically when talk time > 0 s.
export const RESULTS = [
    { id: 'CONNECTED', label: 'Connected', e: '✅' },
    { id: 'NUMBER_BUSY', label: 'Number busy', e: '⛔' },
    { id: 'NO_ANSWER', label: 'No answer', e: '📵' },
    { id: 'SWITCHED_OFF', label: 'Switched off', e: '📴' },
    { id: 'WRONG_NUMBER', label: 'Wrong number', e: '❌' },
    { id: 'CALL_LATER', label: 'Call later', e: '⏰' },
    { id: 'REDIALED', label: 'Redialed', e: '🔁' },
];
export const RESULT = Object.fromEntries(RESULTS.map(r => [r.id, r]));

// TeleCRM stage names as they appear in an export, for importing old leads.
const STAGE_ALIASES = {
    'new lead': 'NEW', new: 'NEW', fresh: 'NEW', natc: 'NATC', dnp: 'DNP', cold: 'COLD', warm: 'WARM',
    interested: 'INTERESTED', 'centre visit scheduled': 'VISIT_SCHEDULED', 'center visit scheduled': 'VISIT_SCHEDULED',
    'centre visit rescheduled': 'VISIT_RESCHEDULED', 'center visit rescheduled': 'VISIT_RESCHEDULED',
    'centre visit done - agree to pay': 'VISIT_AGREED', 'center visit done - agree to pay': 'VISIT_AGREED',
    'centre visit done - decision pending': 'VISIT_PENDING', 'center visit done - decision pending': 'VISIT_PENDING',
    'not interested': 'NOT_INTERESTED', 'invalid lead': 'INVALID', invalid: 'INVALID', enrolled: 'ENROLLED', lost: 'LOST',
};
export const stageFromText = (t) => STAGE_ALIASES[String(t || '').trim().toLowerCase()] || 'NEW';
