import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getCachedAdmissions } from './cacheService';

const BATCH_COLLECTION = 'batches';

// 1. CREATE BATCH
export const createBatch = async (batchData, createdBy) => {
    try {
        const docRef = await addDoc(collection(db, BATCH_COLLECTION), {
            name: batchData.name,
            centerId: batchData.centerId,
            course: batchData.course, // JEE_11, NEET_12 etc.
            faculty: batchData.faculty || [], // Array of { subject, name, photoUrl? }
            facultyPhotoUrl: batchData.facultyPhotoUrl || "", // Single group photo
            capacity: Number(batchData.capacity) || 60,
            startDate: batchData.startDate,

            createdAt: serverTimestamp(),
            createdBy: createdBy.name
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error creating batch:", error);
        return { success: false, error: error.message };
    }
};

// 2. FETCH BATCHES (By Center)
export const fetchBatches = async (centerId) => {
    try {
        const batchRef = collection(db, BATCH_COLLECTION);
        let q;

        if (centerId) {
            q = query(batchRef, where("centerId", "==", centerId));
        } else {
            q = query(batchRef); // Director fetches all
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error fetching batches:", error);
        return [];
    }
};

// 3. UPDATE BATCH
export const updateBatch = async (batchId, updates) => {
    try {
        const docRef = doc(db, BATCH_COLLECTION, batchId);
        await updateDoc(docRef, { ...updates, lastUpdated: serverTimestamp() });
        return { success: true };
    } catch (error) {
        console.error("Error updating batch:", error);
        return { success: false, error: error.message };
    }
};

// 4. DELETE BATCH
export const deleteBatch = async (batchId) => {
    try {
        await deleteDoc(doc(db, BATCH_COLLECTION, batchId));
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// 5. FETCH REAL BATCH ENROLLMENTS (Aggregation)
export const fetchRealBatchEnrollments = async (centerId) => {
    try {
        const admissions = await getCachedAdmissions(centerId);

        const counts = {};
        admissions.forEach(data => {
            const batchName = data.batchAssigned;
            const status = data.status || 'ACTIVE'; // Fallback to ACTIVE if legacy record has no status
            const docCenterId = data.centerId;

            // Filter by centerId if provided
            if (centerId && docCenterId !== centerId) {
                return;
            }

            // Only count active, token paid, or completed admissions
            if (batchName && ['ACTIVE', 'TOKEN_PAID', 'COMPLETED'].includes(status.toUpperCase())) {
                counts[batchName] = (counts[batchName] || 0) + 1;
            }
        });
        return counts;
    } catch (error) {
        console.error("Error fetching batch enrollments:", error);
        return {};
    }
};
