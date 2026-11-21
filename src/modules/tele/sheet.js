// Turning an uploaded sheet (rows of cells) into clean lead rows.
// Pure functions, so they are unit tested without a browser.
import { stageFromText } from './constants.js';

// ERP field -> header words we recognise (lower case, punctuation removed).
export const FIELDS = [
    { key: 'studentName', label: 'Student name', need: true, words: ['student name', 'name', 'lead name', 'full name', 'student'] },
    { key: 'phone', label: 'Phone', need: true, words: ['phone', 'mobile', 'phone number', 'mobile number', 'contact', 'student phone', 'number'] },
    { key: 'parentPhone', label: 'Parent phone', words: ['parent phone', 'parent phone number', 'father phone', 'parent mobile', 'alternate number', 'alternate phone'] },
    { key: 'currentClass', label: 'Class', words: ['class', 'standard', 'std', 'current class'] },
    { key: 'courseInterest', label: 'Course', words: ['course', 'course interest', 'program', 'stream'] },
    { key: 'school', label: 'School', words: ['school', 'school name', 'college'] },
    { key: 'board', label: 'Board', words: ['board', 'boards'] },
    { key: 'rank', label: 'Rank', words: ['rank'] },
    { key: 'score', label: 'UNSAT score', words: ['unsat score', 'score', 'marks', 'unsat'] },
    { key: 'area', label: 'Area / city', words: ['area', 'city', 'location', 'address'] },
    { key: 'source', label: 'Lead source', words: ['source', 'lead source'] },
    { key: 'collectedBy', label: 'Collected by', words: ['lead collected by', 'collected by', 'bde', 'bde name'] },
    { key: 'stage', label: 'Stage (old)', words: ['status', 'stage', 'lead status', 'lead stage'] },
    // Extra columns a TeleCRM export carries, so old leads keep their history.
    { key: 'owner', label: 'Telecaller (old)', words: ['assigned to', 'lead owner', 'owner', 'assignee', 'telecaller', 'caller', 'agent'] },
    { key: 'nextFollowUp', label: 'Follow-up date', words: ['next follow up', 'follow up date', 'follow up', 'followup', 'callback', 'call back', 'next call', 'reminder'] },
    { key: 'lastNote', label: 'Remarks', words: ['remarks', 'remark', 'last remark', 'notes', 'note', 'comments', 'comment', 'description'] },
    { key: 'temperature', label: 'Hot / Warm / Cold', words: ['rating', 'temperature', 'priority', 'lead rating'] },
    { key: 'createdOn', label: 'Lead date', words: ['created on', 'created at', 'created date', 'lead date', 'date added', 'created'] },
];

const clean = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Best guess of which column holds which field; exact header matches win.
export const guessMapping = (headers) => {
    const map = {};
    const used = new Set();
    const hs = headers.map(clean);
    for (const pass of ['exact', 'contains']) {
        for (const f of FIELDS) {
            if (map[f.key] != null) continue;
            const i = hs.findIndex((h, idx) => !used.has(idx) && h && f.words.some(w => (pass === 'exact' ? h === w : h.includes(w))));
            if (i >= 0) { map[f.key] = i; used.add(i); }
        }
    }
    return map;
};

// Indian mobile numbers to 10 digits; anything else is rejected.
export const tenDigits = (v) => {
    let d = String(v ?? '').replace(/\.0+$/, '').replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d) ? d : '';
};

// CSV text -> rows (handles quotes, commas and new lines inside quotes).
export const parseCsv = (text) => {
    const rows = []; let row = []; let cell = ''; let q = false;
    const s = String(text).replace(/^\uFEFF/, '');
    for (let i = 0; i < s.length; i += 1) {
        const c = s[i];
        if (q) {
            if (c === '"' && s[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') q = false; else cell += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && s[i + 1] === '\n') i += 1;
            row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim() !== ''));
};

// Dates in exports: 2026-11-21, 21/11/2026, 21-11-26, 21 Nov 2026, Excel serials.
export const ymdFrom = (v) => {
    if (v == null || v === '') return '';
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000); return d.toISOString().slice(0, 10); }
    const t = String(v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(t); // Indian day first
    if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; const mo = Number(m[2]); const d = Number(m[1]); if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const TEMP_WORDS = { hot: 'HOT', warm: 'WARM', cold: 'COLD', high: 'HOT', medium: 'WARM', low: 'COLD' };

// Rows + mapping -> { good, bad, dupes } against phones already in the ERP.
export const buildLeads = (rows, map, existingPhones = new Set()) => {
    const good = []; const bad = []; const dupes = [];
    const seen = new Set();
    rows.forEach((r, idx) => {
        const get = (k) => (map[k] == null ? '' : String(r[map[k]] ?? '').trim());
        const phone = tenDigits(get('phone'));
        const name = get('studentName');
        if (!phone || !name) { bad.push({ line: idx + 2, why: !name ? 'No name' : 'Phone is not a 10-digit mobile', raw: r }); return; }
        if (existingPhones.has(phone) || seen.has(phone)) { dupes.push({ line: idx + 2, phone, name }); return; }
        seen.add(phone);
        const lead = { studentName: name, phone, stage: map.stage == null ? 'NEW' : stageFromText(get('stage')) };
        const parent = tenDigits(get('parentPhone'));
        if (parent && parent !== phone) lead.parentPhone = parent;
        for (const k of ['currentClass', 'courseInterest', 'school', 'board', 'rank', 'score', 'area', 'source', 'collectedBy', 'owner']) {
            const v = get(k); if (v) lead[k] = v.slice(0, 120);
        }
        const raw = (k) => (map[k] == null ? '' : r[map[k]]);
        const note = get('lastNote'); if (note) lead.lastNote = note.slice(0, 500);
        const fu = ymdFrom(raw('nextFollowUp')); if (fu) lead.nextFollowUp = fu;
        const made = ymdFrom(raw('createdOn')); if (made) lead.importedCreatedOn = made;
        const temp = TEMP_WORDS[get('temperature').toLowerCase().split(/\s+/)[0]]; if (temp) lead.temperature = temp;
        good.push(lead);
    });
    return { good, bad, dupes };
};

// Split leads between telecallers: equal round robin, or fixed counts.
export const splitLeads = (ids, people, counts = null) => {
    const out = Object.fromEntries(people.map(p => [p, []]));
    if (!people.length) return out;
    if (counts) {
        let i = 0;
        for (const p of people) { const n = Math.max(0, Number(counts[p]) || 0); out[p] = ids.slice(i, i + n); i += n; }
        return out;
    }
    ids.forEach((id, i) => out[people[i % people.length]].push(id));
    return out;
};
