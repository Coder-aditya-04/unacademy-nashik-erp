// Roll numbers: 9 digits = centre prefix (3) + year (2) + sequence (4).
// The roll number is also the student's enrollment number in KAP Connect,
// so it must never be given to two students.
//
// Two pieces make that hold:
//  - counters/roll_<prefix><yy> hands out the next sequence number in a
//    transaction, so two accountants never get the same suggestion.
//  - roll_numbers/<roll> is a reservation written in the same transaction
//    that saves the roll on the admission. If the reservation already exists
//    for another admission the save is refused. This also covers rolls typed
//    in by hand.
// Rolls assigned before this existed have no reservation doc, so we also
// check the admissions collection for them before reserving.

import { db } from '../firebase';
import { doc, collection, query, where, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';

export const ROLL_PATTERN = /^(110|111|112)\d{6}$/;

export const rollPrefixForCenter = (centerId) =>
    centerId === 'UN_NASHIK_RD' ? '110' : centerId === 'PRAYAS' ? '112' : '111';

const yearSuffix = (date = new Date()) => String(date.getFullYear()).slice(-2);

// Is this roll already used by an admission other than `admissionId`?
// Returns that admission's data, or null.
export const findRollOwner = async (roll, admissionId = null) => {
    const snap = await getDocs(query(collection(db, 'admissions'), where('rollNumber', '==', roll)));
    const other = snap.docs.find(d => d.id !== admissionId);
    return other ? { id: other.id, ...other.data() } : null;
};

// Suggests the next free roll for a centre. It only suggests: the roll is
// claimed by reserveRollNumber when the admission is saved.
export const suggestRollNumber = async (centerId, admissionId = null) => {
    const base = `${rollPrefixForCenter(centerId)}${yearSuffix()}`;
    const counterRef = doc(db, 'counters', `roll_${base}`);

    for (let attempt = 0; attempt < 50; attempt++) {
        const seq = await runTransaction(db, async (tx) => {
            const snap = await tx.get(counterRef);
            const next = snap.exists() ? Number(snap.data().next) || 1 : 1;
            if (next > 9999) throw new Error(`No roll numbers left for ${base} this year.`);
            tx.set(counterRef, { next: next + 1, updatedAt: serverTimestamp() }, { merge: true });
            return next;
        });
        const roll = `${base}${String(seq).padStart(4, '0')}`;
        // Skip numbers already used by older, randomly generated rolls.
        if (!(await findRollOwner(roll, admissionId))) return roll;
    }
    throw new Error('Could not find a free roll number. Please enter one by hand.');
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
