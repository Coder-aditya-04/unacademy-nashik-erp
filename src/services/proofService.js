// Payment proofs (screenshots, cheque photos, PDFs) for every instalment.
// Stored in Cloud Storage at proofs/{admissionId}/{paymentId}; the payment
// entry keeps only `proofPath`. Older proofs saved inline as base64
// (`proofImage` on the admission or on the first payment) stay readable.
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const PROOF_ACCEPT = PROOF_TYPES.join(',');

export const newPaymentId = () =>
    (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

// Returns an error message, or null when the file is acceptable.
export const checkProofFile = (file) => {
    if (!file) return null;
    if (!PROOF_TYPES.includes(file.type)) return 'Proof must be a JPG, PNG, WebP image or a PDF.';
    if (file.size > PROOF_MAX_BYTES) return 'Proof must be 5 MB or smaller.';
    return null;
};

export const uploadProof = async (admissionId, paymentId, file) => {
    const problem = checkProofFile(file);
    if (problem) throw new Error(problem);
    const path = `proofs/${admissionId}/${paymentId}`;
    await uploadBytes(ref(storage, path), file, { contentType: file.type });
    return path;
};

// A URL to show the proof of `payment`, or of the admission's token proof.
export const proofUrlFor = async (payment, admission = null) => {
    if (payment?.proofPath) return getDownloadURL(ref(storage, payment.proofPath));
    if (payment?.proofImage) return payment.proofImage; // older inline proof
    if (admission?.proofImage && /token|booking/i.test(payment?.type || '')) return admission.proofImage;
    return null;
};

export const hasProof = (payment, admission = null) =>
    !!(payment?.proofPath || payment?.proofImage || (admission?.proofImage && /token|booking/i.test(payment?.type || '')));
