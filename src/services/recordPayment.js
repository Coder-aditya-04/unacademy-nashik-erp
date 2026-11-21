// Records a payment or refund on an admission (paymentService.js keeps the token and reminder helpers). Shared by the student
// profile's Fees tab and the older StudentManager tools.
import { db } from '../firebase';
import { doc, arrayUnion, Timestamp, runTransaction, setDoc, serverTimestamp } from 'firebase/firestore';
import { clearAdmissionsCache } from './cacheService';
import { uploadProof, checkProofFile, newPaymentId } from './proofService';

// Same accounts as the receipt and the Accounts screens.
export const PAY_MODES = ['KAP Online (RTGS/NEFT)', 'Cash', 'Cheque', 'KAP QR (AXIS)', 'Ujjivan QR', 'POS - SHS', 'SHS Online (RTGS/NEFT)'];
export const canRecordPayment = (role) => ['DIRECTOR', 'ACCOUNTANT', 'ADMIN'].includes(String(role || '').toUpperCase());

// Throws with a plain message when something is wrong.
export const recordPayment = async ({ student, refund = false, amount, mode = 'Cash', remarks = '', proofFile = null, userProfile }) => {
    const amountVal = Number(amount);
    if (!(amountVal > 0)) throw new Error('Enter an amount greater than zero.');
    const fileProblem = checkProofFile(proofFile);
    if (fileProblem) throw new Error(fileProblem);

    const studentRef = doc(db, 'admissions', student.id);
    // Every payment gets an id so its proof can live at proofs/{admissionId}/{paymentId}.
    const paymentId = newPaymentId();
    const proofPath = proofFile ? await uploadProof(student.id, paymentId, proofFile) : null;
    const newPayment = {
        id: paymentId,
        ...(proofPath && { proofPath, proofType: proofFile.type }),
        amount: refund ? -amountVal : amountVal,
        date: Timestamp.now(),
        mode,
        type: refund ? 'REFUND' : 'Installment/Balance',
        ...(refund && { remarks: remarks || 'Refund processed by Accountant' }),
    };

    // Read the latest record inside a transaction so two people recording at
    // once cannot overwrite each other's totals.
    await runTransaction(db, async (tx) => {
        const snap = await tx.get(studentRef);
        if (!snap.exists()) throw new Error('Admission record not found.');
        const fresh = snap.data();
        const freshPaid = Number(fresh.totalPaid) || 0;
        const update = { payments: [...(fresh.payments || []), newPayment] };
        if (refund) {
            update.refundAmount = (Number(fresh.refundAmount) || 0) + amountVal;
            update.totalPaid = freshPaid - amountVal;
            update.status = (freshPaid - amountVal) <= 0 ? 'REFUNDED' : (fresh.status || student.status);
        } else {
            update.totalPaid = freshPaid + amountVal;
        }
        tx.update(studentRef, update);
    });
    clearAdmissionsCache();

    if (student.leadId) {
        const entry = {
            type: refund ? 'REFUND_ISSUED' : 'PAYMENT',
            result: refund ? 'Refund Processed' : 'Installment Received',
            note: refund ? `Refund: ₹${amountVal.toLocaleString()} (${mode}). Remarks: ${remarks || 'N/A'}` : `Amount: ₹${amountVal.toLocaleString()} (${mode})`,
            date: new Date(),
            by: userProfile?.name || 'Team',
        };
        try {
            await setDoc(doc(db, 'leads', student.leadId), {
                timeline: arrayUnion(entry),
                ...(refund ? { status: 'REFUNDED' } : {}),
                studentName: student.studentName || 'Unknown',
                phone: student.phone || '',
                ...(refund ? {} : { status: 'CONVERTED' }),
                centerId: student.centerId || null,
                admissionId: student.id,
                lastUpdated: serverTimestamp(),
            }, { merge: true });
        } catch (e) { console.warn('Could not sync to lead timeline:', e); }
    }
    return { paymentId };
};
