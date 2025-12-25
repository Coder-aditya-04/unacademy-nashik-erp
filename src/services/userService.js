import { db, firebaseConfig } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc, setDoc, deleteDoc, updateDoc, getFirestore } from 'firebase/firestore';
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";

// Initialize Secondary App for User Creation (Prevents Logging out Admin)
// We check if apps are already initialized to avoid duplicate errors in dev hot-reload
let secondaryApp;
let secondaryAuth;

try {
    secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
    secondaryAuth = getAuth(secondaryApp);
} catch (e) {
    // If already initialized, just get the existing instance (though usually getAuth throws if not init)
    // In a clean module scope, this runs once. 
    // We can't easily "get" a named app without storing it or trapping the error.
    // For safety in React Dev (Strict Mode), we can try-catch.
    console.log("Secondary App might already be initialized", e);
}

// Fetch all staff members for a specific center (or all if Director)
export const getCounsellorsByCenter = async (centerId) => {
    try {
        const usersRef = collection(db, "users");
        // Get users who are STAFF/COUNSELLOR/MANAGER by ROLE only (filtering center in JS to handle case issues)
        // Using 'in' query with Case Variations to match 'Counsellor' etc.
        const q = query(
            usersRef,
            where("role", "in", [
                "STAFF", "Staff",
                "COUNSELLOR", "Counsellor",
                "COUNSELOR", "Counselor"
            ])
        );

        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => {
                const data = doc.data();
                // Normalize centerId from db (Handle 'CenterId', 'CentreId', or 'centerId' fields)
                // Also trim whitespace to handle "UN_NASHIK_RD " vs "UN_NASHIK_RD"
                const rawCenterId = data.centerId || data.CenterId || data.CentreId || "";

                return {
                    uid: doc.id,
                    name: data.name,
                    centerId: rawCenterId.trim()
                };
            })
            // Client-side filter: Match standardized centerId (Robust against Manual Entry case issues)
            .filter(user => user.centerId === centerId);

    } catch (error) {
        console.error("Error fetching counsellors:", error);
        return [];
    }
};

export const fetchStaffList = async (centerId = null) => {
    try {
        const usersRef = collection(db, "users");
        // Fetch ALL users to avoid "in" query limits (max 10) and case-sensitivity issues
        // Small dataset (< 100 staff), so this is safe and robust.
        const snapshot = await getDocs(usersRef);

        const allStaff = snapshot.docs.map(doc => {
            const data = doc.data();
            // Normalize centerId from db (Handle 'CenterId', 'CentreId', or 'centerId' fields)
            const rawCenterId = data.centerId || data.CenterId || data.CentreId || "";

            return {
                uid: doc.id,
                ...data, // spreading data to ensure we have 'role' for filtering later
                centerId: rawCenterId.trim()
            };
        });

        if (centerId && centerId !== 'ALL') {
            // Client-side filter: Match standardized centerId
            return allStaff.filter(user => user.centerId === centerId);
        } else {
            return allStaff;
        }

    } catch (error) {
        console.error("Error fetching staff:", error);
        return [];
    }
};

/**
 * Creates a new Counselor account without logging out the current user.
 * @param {string} email 
 * @param {string} password 
 * @param {string} name 
 * @param {string} centerId 
 * @returns {Promise<boolean>}
 */


// ... (existing exports unchanged)

/**
 * Creates a new Counselor account without logging out the current user.
 * @param {string} email 
 * @param {string} password 
 * @param {string} name 
 * @param {string} centerId 
 * @returns {Promise<boolean>}
 */
export const createCounselorAccount = async (email, password, name, centerId) => {
    let createdAuthUser = null;
    try {
        if (!secondaryAuth) {
            // Fallback re-init
            secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
            secondaryAuth = getAuth(secondaryApp);
        }

        // 1. Create Auth User in Secondary App
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        createdAuthUser = userCredential.user;

        // 2. Create User Profile in Firestore (using PRIMARY DB = Current Manager's Auth)
        // Since we updated Rules to allow Managers to create users, this write will succeed.
        await setDoc(doc(db, "users", createdAuthUser.uid), {
            uid: createdAuthUser.uid,
            id: createdAuthUser.uid,
            name: name,
            email: email,
            role: "COUNSELOR",
            centerId: centerId,
            createdAt: new Date(),
            isActive: true
        });

        // 3. Sign out the secondary user immediately to be safe (though we didn't use its state)
        await signOut(secondaryAuth);

        return true;
    } catch (error) {
        console.error("Error creating counselor account:", error);

        // CLEANUP: If Auth succeeded but DB failed, delete the Auth user
        // to prevent "Email already in use" error on next try.
        if (createdAuthUser) {
            try {
                // Deleting the user requires the secondaryAuth context
                // NOTE: deleteUser comes from firebase/auth
                const { deleteUser } = await import("firebase/auth");
                await deleteUser(createdAuthUser);
                console.log("Rollback: Deleted incomplete auth user.");
            } catch (cleanupError) {
                console.error("Failed to rollback auth user:", cleanupError);
            }
        }

        throw error;
    }
};

export const deleteCounselorProfile = async (uid) => {
    try {
        await deleteDoc(doc(db, "users", uid));
        return true;
    } catch (error) {
        console.error("Error deleting counselor:", error);
        throw error;
    }
};

// --- NEW: User Approval Workflow ---

export const fetchPendingUsers = async (centerId = null) => {
    try {
        const usersRef = collection(db, "users");
        // Query for verified: false
        const q = query(usersRef, where("verified", "==", false));

        const snapshot = await getDocs(q);
        const pendingUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (centerId && centerId !== 'ALL') {
            return pendingUsers.filter(u => u.centerId === centerId);
        }
        return pendingUsers;

    } catch (error) {
        console.error("Error fetching pending users:", error);
        return [];
    }
};

export const approveUser = async (uid) => {
    try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, {
            verified: true,
            isActive: true
        });
        return true;
    } catch (error) {
        console.error("Error approving user:", error);
        throw error;
    }
};

export const rejectUser = async (uid) => {
    try {
        // Deleting the profile prevents login (Login.jsx checks for profile existence)
        // Note: The Auth user remains in Firebase Auth, but they can't access the app.
        // A Cloud Function would be better to fully clean up, but this works for MVP.
        await deleteDoc(doc(db, "users", uid));
        return true;
    } catch (error) {
        console.error("Error rejecting user:", error);
        throw error;
    }
};

export const fetchBDEList = async () => {
    try {
        // STRATEGY: Try fetching from 'users' collection (metadata_bde_list) first.
        // Reason: 'users' collection is publicly readable (for Staff List), while 'batches' might be restricted.
        const publicDocRef = doc(db, "users", "metadata_bde_list");
        const publicSnap = await getDoc(publicDocRef);

        if (publicSnap.exists()) {
            return publicSnap.data().records || [];
        }

        // FALLBACK: 'batches' collection (old location)
        const docRef = doc(db, "batches", "bde_list_configuration");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().records || docSnap.data().names || [];
        } else {
            return [];
        }
    } catch (error) {
        console.error("Error fetching BDE list:", error);
        return [];
    }
};
