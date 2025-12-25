import { db } from '../firebase';
import { collection, doc, getDocs, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { PROGRAMS } from '../utils/feeData'; // Import legacy data for seeding

const COLLECTION_NAME = 'fee_structures';

// 1. Fetch All Fee Structures
export const fetchFeeStructures = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        const fees = {};
        querySnapshot.forEach((doc) => {
            fees[doc.id] = doc.data();
        });
        return fees;
    } catch (error) {
        console.error("Error fetching fee structures:", error);
        throw error;
    }
};

// 2. Save/Update Fee Structure
export const saveFeeStructure = async (key, data) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, key);
        await setDoc(docRef, { ...data, updatedAt: new Date() }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error saving fee structure:", error);
        throw error;
    }
};

// 3. Delete Fee Structure (Optional, but good for management)
// Not strictly requested but good practice.

// 4. Seed Initial Data (One-time use)
export const seedInitialFeeData = async () => {
    try {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        if (!snapshot.empty) {
            console.log("Fee structures already exist. Skipping seed.");
            return false;
        }

        console.log("Seeding initial fee data...");
        const promises = Object.entries(PROGRAMS).map(([key, data]) => {
            return setDoc(doc(db, COLLECTION_NAME, key), {
                ...data,
                basePrice: data.total, // Ensure consistency
                createdAt: new Date(),
                updatedAt: new Date()
            });
        });

        await Promise.all(promises);
        console.log("Seeding complete!");
        return true;
    } catch (error) {
        console.error("Error seeding data:", error);
        throw error;
    }
};
