import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';

const APPROVALS_REF = collection(db, "approvals");

// 1. CREATE REQUEST (Counsellor)
export const requestDiscount = async (data, userProfile) => {
    try {
        await addDoc(APPROVALS_REF, {
            leadId: data.leadId || null,
            studentName: data.studentName || "Unknown",
            program: data.program || "Unknown",
            originalFee: data.originalFee || 0,
            offeredFee: data.offeredFee || 0,
            discountPercent: data.discountPercent || 0,

            status: "PENDING", // PENDING, APPROVED, REJECTED
            requestedBy: userProfile.name || "Staff",
            requestedById: userProfile.uid || null,
            centerId: userProfile.centerId || null,

            createdAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Error requesting approval:", error);
        return { success: false, error: error.message };
    }
};

// 2. FETCH PENDING (Director)
export const fetchPendingApprovals = async () => {
    try {
        // NOTE: Removed orderBy to avoid "Missing Index" error. Sorting client-side.
        const q = query(APPROVALS_REF, where("status", "==", "PENDING"));
        const snapshot = await getDocs(q);

        const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Client-side sort: Newest first
        return results.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
    } catch (error) {
        console.error("Error fetching approvals:", error);
        return [];
    }
};

// 3. PROCESS REQUEST (Director)
export const processApproval = async (id, status, directorName) => {
    try {
        const docRef = doc(db, "approvals", id);
        await updateDoc(docRef, {
            status: status, // 'APPROVED' or 'REJECTED'
            actionBy: directorName,
            actionAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        return { success: false };
    }
};
