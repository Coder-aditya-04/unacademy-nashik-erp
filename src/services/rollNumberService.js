// Roll numbers: 9 digits = centre prefix (3) + year (2) + sequence (4).
// The roll number is also the student's enrollment number in KAP Connect,
// so it must never be given to two students.
//
// Two pieces make that hold:
//  - counters/roll_<prefix><yy> holds the next sequence number. It is read
//    and advanced in the same transaction that saves the admission, so a
//    number is used up only when the save succeeds (no gaps on reloads).
//  - roll_numbers/<roll> is a reservation written in the same transaction
//    that saves the roll on the admission. If the reservation already exists
//    for another admission the save is refused. This also covers rolls typed
//    in by hand.
// Rolls assigned before this existed have no reservation doc, so we also
// check the admissions collection for them before reserving.

import { db } from '../firebase';
import { sessionFor } from '../utils/academicYear';
import { doc, getDoc, collection, query, where, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';

export const ROLL_PATTERN = /^(110|111|112)\d{6}$/;

export const rollPrefixForCenter = (centerId) =>
    centerId === 'UN_NASHIK_RD' ? '110' : centerId === 'PRAYAS' ? '112' : '111';

// Year part of the roll: the academic session's end year (see utils/academicYear).
const yearSuffix = (date = new Date()) => sessionFor(date).yy;

// Is this roll already used by an admission other than `admissionId`?
// Returns that admission's data, or null.
export const findRollOwner = async (roll, admissionId = null) => {
    const snap = await getDocs(query(collection(db, 'admissions'), where('rollNumber', '==', roll)));
    const other = snap.docs.find(d => d.id !== admissionId);
    return other ? { id: other.id, ...other.data() } : null;
};

class RetryRoll extends Error {}

// Saves an admission update together with its roll number in one
// transaction:
//  - manualRoll given: that roll is reserved (refused if another student
//    holds it).
//  - otherwise the next number is taken from the centre-year counter at
//    this moment, so a number is only used up when the save succeeds.
// `buildUpdate(roll)` returns the fields to write on the admission.
// Returns the roll that was saved.
export const saveAdmissionWithRoll = async ({ admissionId, centerId, manualRoll = null, by = null, buildUpdate }) => {
    const admRef = doc(db, 'admissions', admissionId);

    if (manualRoll) {
        await runTransaction(db, async (tx) => {
            const admSnap = await tx.get(admRef);
            const reserve = await reserveRollNumberInTx(tx, {
                roll: manualRoll, admissionId, centerId,
                previousRoll: admSnap.exists() ? admSnap.data().rollNumber : null, by,
            });
            reserve();
            tx.update(admRef, buildUpdate(manualRoll));
        });
        return manualRoll;
    }

    const base = `${rollPrefixForCenter(centerId)}${yearSuffix()}`;
    const counterRef = doc(db, 'counters', `roll_${base}`);
    const bumpPast = (seq) => runTransaction(db, async (tx) => {
        const snap = await tx.get(counterRef);
        const next = snap.exists() ? Number(snap.data().next) || 1 : 1;
        if (next === seq) tx.set(counterRef, { next: seq + 1, updatedAt: serverTimestamp() }, { merge: true });
    });

    for (let attempt = 0; attempt < 50; attempt++) {
        const peekSnap = await getDoc(counterRef);
        const seq = peekSnap.exists() ? Number(peekSnap.data().next) || 1 : 1;
        if (seq > 9999) throw new Error(`No roll numbers left for ${base} this session.`);
        const roll = `${base}${String(seq).padStart(4, '0')}`;

        // Older rolls have no reservation doc; skip numbers they already use.
        if (await findRollOwner(roll, admissionId)) { await bumpPast(seq); continue; }

        try {
            await runTransaction(db, async (tx) => {
                const counterSnap = await tx.get(counterRef);
                const next = counterSnap.exists() ? Number(counterSnap.data().next) || 1 : 1;
                if (next !== seq) throw new RetryRoll(); // someone else took it
                const admSnap = await tx.get(admRef);
                const reserve = await reserveRollNumberInTx(tx, {
                    roll, admissionId, centerId,
                    previousRoll: admSnap.exists() ? admSnap.data().rollNumber : null, by,
                });
                tx.set(counterRef, { next: seq + 1, updatedAt: serverTimestamp() }, { merge: true });
                reserve();
                tx.update(admRef, buildUpdate(roll));
            });
            return roll;
        } catch (err) {
            if (err instanceof RetryRoll) continue;
            if (/already assigned/.test(err.message)) { await bumpPast(seq); continue; }
            throw err;
        }
    }
    throw new Error('Could not assign a roll number. Please try again or enter one by hand.');
};

// Claims `roll` for `admissionId` inside transaction `tx` (the caller's
// transaction that also updates the admission). Releases the admission's
// previous roll if it had a different one. Must be called before any
// tx.set/tx.update in the caller (Firestore: reads before writes).
export const reserveRollNumberInTx = async (tx, { roll, admissionId, centerId, previousRoll, by }) => {
    const rollRef = doc(db, 'roll_numbers', roll);
    const prevRef = previousRoll && previousRoll !== roll ? doc(db, 'roll_numbers', previousRoll) : null;

    const snap = await tx.get(rollRef);
    const prevSnap = prevRef ? await tx.get(prevRef) : null;

    if (snap.exists() && snap.data().admissionId !== admissionId) {
        throw new Error(`Roll number ${roll} is already assigned to another student.`);
    }

    return () => {
        tx.set(rollRef, { admissionId, centerId: centerId || null, by: by || null, reservedAt: serverTimestamp() });
        if (prevSnap && prevSnap.exists() && prevSnap.data().admissionId === admissionId) {
            tx.delete(prevRef);
        }
    };
};
