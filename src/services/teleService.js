// Telecalling data. Telecalling leads live in their own collection
// (`tele_leads`) so tens of thousands of cold leads never slow the counselling
// CRM. A lead moves into `leads` (the Admissions board) once it is Interested
// or a centre visit is booked. Every call is one doc in `calls`.
import { db } from '../firebase';
import {
    collection, doc, getDocs, query, where, writeBatch, addDoc, updateDoc, onSnapshot,
    serverTimestamp, Timestamp, increment, arrayUnion, limit, getCountFromServer,
} from 'firebase/firestore';
import { STAGE } from '../modules/tele/constants';

export const TELE = 'tele_leads';
export const UPLOADS = 'lead_uploads';
export const CALLS = 'calls';
const CHUNK = 400; // Firestore allows 500 writes per batch

const rows = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

// Phones already in the ERP (telecalling pool + counselling leads), for duplicate checks.
export const fetchKnownPhones = async (centerId) => {
    const scope = (c) => (centerId && centerId !== 'ALL' ? query(collection(db, c), where('centerId', '==', centerId)) : collection(db, c));
    const [a, b] = await Promise.all([getDocs(scope(TELE)), getDocs(scope('leads'))]);
    const set = new Set();
    [...a.docs, ...b.docs].forEach(d => { const p = d.data().phone; if (p) set.add(String(p)); });
    return set;
};

// Saves one upload: an upload record, then the leads in batches.
export const importLeads = async ({ leads, fileName, uploadName, centerId, user, skipped }, onProgress = () => {}) => {
    const up = await addDoc(collection(db, UPLOADS), {
        fileName, name: uploadName || fileName, centerId, total: leads.length, saved: 0,
        duplicates: skipped?.dupes || 0, invalid: skipped?.bad || 0,
        by: user?.name || 'Team', byUid: user?.uid || null, createdAt: serverTimestamp(), status: 'SAVING',
    });
    let saved = 0;
    for (let i = 0; i < leads.length; i += CHUNK) {
        const batch = writeBatch(db);
        leads.slice(i, i + CHUNK).forEach(l => {
            batch.set(doc(collection(db, TELE)), {
                ...l, centerId, uploadId: up.id, uploadName: uploadName || fileName,
                assignedTo: null, assignedToName: '', callCount: 0, lastCallAt: null, nextFollowUp: null,
                createdAt: serverTimestamp(), createdBy: user?.uid || null,
            });
        });
        await batch.commit();
        saved += Math.min(CHUNK, leads.length - i);
        onProgress(saved);
    }
    await updateDoc(up, { saved, status: 'DONE' });
    return { id: up.id, saved };
};

export const subscribeUploads = (centerId, cb) => onSnapshot(
    centerId && centerId !== 'ALL' ? query(collection(db, UPLOADS), where('centerId', '==', centerId)) : collection(db, UPLOADS),
    (s) => cb(rows(s).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))),
    (e) => { console.error(e); cb([]); });

// Leads waiting for a telecaller (optionally from one upload).
export const fetchUnassigned = async (centerId, uploadId) => {
    const parts = [where('assignedTo', '==', null)];
    if (centerId && centerId !== 'ALL') parts.push(where('centerId', '==', centerId));
    if (uploadId) parts.push(where('uploadId', '==', uploadId));
    return rows(await getDocs(query(collection(db, TELE), ...parts, limit(20000))));
};

export const fetchTelecallers = async (centerId) => {
    const all = rows(await getDocs(query(collection(db, 'users'), where('role', 'in', ['TELECALLER', 'Telecaller', 'telecaller']))));
    return all.filter(u => u.verified !== false && u.isActive !== false && (!centerId || centerId === 'ALL' || u.centerId === centerId))
        .map(u => ({ uid: u.uid || u.id, name: u.name || u.email || 'Telecaller', centerId: u.centerId }));
};

export const countAssigned = async (uid) => (await getCountFromServer(query(collection(db, TELE), where('assignedTo', '==', uid)))).data().count;

export const fetchAssignedTo = async (uid) => rows(await getDocs(query(collection(db, TELE), where('assignedTo', '==', uid))));

// plan = { uid: [leadIds] }, names = { uid: name }; uid null = take back.
export const allocate = async (plan, names, user) => {
    const jobs = Object.entries(plan).flatMap(([uid, ids]) => ids.map(id => [id, uid === 'null' ? null : uid]));
    for (let i = 0; i < jobs.length; i += CHUNK) {
        const batch = writeBatch(db);
        jobs.slice(i, i + CHUNK).forEach(([id, uid]) => batch.update(doc(db, TELE, id), {
            assignedTo: uid, assignedToName: uid ? (names[uid] || '') : '',
            allocatedAt: uid ? serverTimestamp() : null, allocatedBy: user?.name || 'Team',
        }));
        await batch.commit();
    }
    return jobs.length;
};

export const subscribeMyQueue = (uid, cb) => onSnapshot(
    query(collection(db, TELE), where('assignedTo', '==', uid)),
    (s) => cb(rows(s)), (e) => { console.error(e); cb([]); });

// Calls made from `since` (ms) on, for one centre or all.
export const subscribeCalls = (centerId, since, cb, byUid = null) => {
    const parts = [where('startedAt', '>=', Timestamp.fromMillis(since))];
    if (byUid) parts.push(where('byUid', '==', byUid));
    else if (centerId && centerId !== 'ALL') parts.push(where('centerId', '==', centerId));
    return onSnapshot(query(collection(db, CALLS), ...parts), (s) => cb(rows(s)), (e) => { console.error(e); cb([]); });
};

// One finished call: the call record, the lead's history, and if the lead is
// now warm enough, a copy on the Admissions board.
export const logCall = async (lead, c, user) => {
    const startedAt = Timestamp.fromMillis(c.startedAt || Date.now());
    const call = {
        teleLeadId: lead.id, phone: lead.phone, studentName: lead.studentName || '', centerId: lead.centerId || '',
        by: user?.name || 'Team', byUid: user?.uid, startedAt, talkSeconds: Math.max(0, Math.round(c.talkSeconds || 0)),
        talkSource: c.talkSource || 'estimate', result: c.result, stageBefore: lead.stage || 'NEW', stage: c.stage,
        note: (c.note || '').slice(0, 500), nextFollowUp: c.nextFollowUp || null, recordingPath: null,
        createdAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, CALLS), call);
    const update = {
        stage: c.stage, lastResult: c.result, lastCallAt: startedAt, callCount: increment(1),
        nextFollowUp: c.nextFollowUp || null, lastNote: call.note,
        activity: arrayUnion({ type: 'CALL', callId: ref.id, result: c.result, stage: c.stage, note: call.note, talkSeconds: call.talkSeconds, at: startedAt, by: call.by }),
    };
    if (STAGE[c.stage]?.promote && !lead.promotedLeadId) {
        // Strict duplicates: if the number is already on the Admissions board, link to it.
        const same = await getDocs(query(collection(db, 'leads'), where('phone', '==', lead.phone), limit(1)));
        if (!same.empty) {
            await updateDoc(same.docs[0].ref, {
                teleLeadId: lead.id, teleStage: c.stage, lastUpdated: serverTimestamp(),
                timeline: arrayUnion({ type: 'CALL', result: STAGE[c.stage].label, note: call.note, date: startedAt, by: call.by, byId: call.byUid || 'unknown' }),
            });
            update.promotedLeadId = same.docs[0].id;
            await updateDoc(doc(db, TELE, lead.id), update);
            return { id: ref.id, promotedLeadId: update.promotedLeadId, linked: true };
        }
        const l = await addDoc(collection(db, 'leads'), {
            studentName: lead.studentName, phone: lead.phone, ...(lead.parentPhone ? { parentPhone: lead.parentPhone } : {}),
            centerId: lead.centerId || '', courseInterest: lead.courseInterest || '', currentClass: lead.currentClass || '',
            school: lead.school || '', source: 'Telecalling', sourceDetails: lead.uploadName || '',
            status: 'NEW', nextFollowUp: c.nextFollowUp ? String(c.nextFollowUp).slice(0, 10) : null, teleLeadId: lead.id, teleStage: c.stage,
            telecaller: call.by, telecallerUid: call.byUid,
            timeline: [{ type: 'CALL', result: STAGE[c.stage].label, note: call.note, date: startedAt, by: call.by, byId: call.byUid || 'unknown' }],
            createdAt: serverTimestamp(), lastUpdated: serverTimestamp(),
        });
        update.promotedLeadId = l.id;
    }
    await updateDoc(doc(db, TELE, lead.id), update);
    return { id: ref.id, promotedLeadId: update.promotedLeadId || null };
};
