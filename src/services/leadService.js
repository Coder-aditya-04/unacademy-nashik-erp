import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, doc, updateDoc, arrayUnion, Timestamp, getDoc, deleteDoc, limit } from 'firebase/firestore';


const LEADS_COLLECTION = "leads";

// 1. ADD NEW LEAD (Manual Entry)
import { syncToTeleCRM } from './teleCrmService';
import { getCachedAdmissions } from './cacheService';

export const createLead = async (leadData, createdBy) => {
    try {
        // Standardize phone before creating
        const cleanPhone = String(leadData.phone || "").replace(/\D/g, '').slice(-10);
        
        const docRef = await addDoc(collection(db, LEADS_COLLECTION), {
            // Basic Info
            studentName: String(leadData.studentName || "").trim(),
            aadhar: leadData.aadhar || "", // NEW: Save Aadhar Number
            phone: cleanPhone,
            parentPhone: leadData.parentPhone || "",
            courseInterest: leadData.course,

            // New Fields (Added for completeness)
            board: leadData.board || "",
            currentStandard: leadData.currentStandard || "",
            address: leadData.address || "",
            remarks: leadData.remarks || "",

            // System Data
            status: "NEW", // Default status
            source: leadData.source || "MANUAL_ENTRY", // Use passed source or default
            sourceDetails: leadData.sourceDetails || leadData.location || "", // Save location/details
            centerId: createdBy.centerId || "UN_COLLEGE", // Assigned to the creator's center

            // BDE Attribution (Optional)
            bdeId: leadData.bdeId || "",
            bdeName: leadData.bdeName || "",

            // Assignment
            // AUTO-ASSIGN Logic: If "assignedTo" is not provided, assign it to the CREATOR (Self-Assign)
            // This ensures Directors/Managers see their own leads in "My Dashboard"
            assignedTo: leadData.assignedTo || createdBy.uid,
            assignedByName: leadData.assignedByName || createdBy.name,

            // Timeline (The History Log)
            timeline: [
                {
                    type: "CREATED",
                    message: `Lead created by ${createdBy.name}`,
                    date: new Date(),
                    by: createdBy.name
                }
            ],

            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp()
        });

        // ==========================================
        // 🚀 TELECRM SYNC (Start Async)
        // ==========================================
        syncToTeleCRM({
            studentName: leadData.studentName,
            phone: leadData.phone,
            email: leadData.email || "", // Pass email if available
            source: leadData.source || "MANUAL_ENTRY",
            courseInterest: leadData.course
        }).catch(err => console.error("Silent TeleCRM Sync Fail:", err));
        // ==========================================

        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error creating lead:", error);
        return { success: false, error: error.message };
    }
};

// 1.5 CHECK DUPLICATE LEAD
export const checkLeadExists = async (value, type = 'PHONE') => {
    try {
        if (!value) return { exists: false };

        let field = 'studentName';
        let queryValue = value;

        if (type === 'PHONE') {
            const strVal = String(value).replace(/\D/g, '');
            if (strVal.length < 10) return { exists: false };
            queryValue = strVal.slice(-10);
            field = 'phone';
        } else {
            queryValue = String(value).trim();
        }

        const q = query(collection(db, LEADS_COLLECTION), where(field, "==", queryValue));

        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            return { exists: true, lead: { id: snapshot.docs[0].id, ...data } };
        }
        return { exists: false };
    } catch (error) {
        console.error("Error checking duplicate:", error);
        return { exists: false, error };
    }
};

// 2. GET LEADS (Filtered by Role) - OPTIMIZED WITH LIMITS
export const fetchLeads = async (userProfile) => {
    try {
        if (!userProfile) return []; // Safety check

        const leadsRef = collection(db, LEADS_COLLECTION);
        let docs = [];

        // LIMIT FETCH TO LATEST 5000 to prevent performance issues (Increased from 500 due to Director Missing Data)
        // In a real app, we would use pagination (startAfter)
        const FETCH_LIMIT = 5000;

        if (userProfile.role?.toUpperCase() === 'DIRECTOR') {
            // Director sees ALL leads (Limited to latest)
            const q = query(leadsRef, limit(FETCH_LIMIT));
            const snapshot = await getDocs(q);
            docs = snapshot.docs;

        } else if (userProfile.role?.toUpperCase() === 'MANAGER') {
            // Manager: Can see ALL leads for their center
            const managerCenterId = (userProfile.centerId || "").trim().toUpperCase();
            if (managerCenterId) {
                const q = query(leadsRef, where("centerId", "==", managerCenterId));
                const snapshot = await getDocs(q);
                docs = snapshot.docs;
            } else {
                console.error("Manager has no center assigned.");
                return [];
            }

        } else {
            // Staff sees ONLY leads assigned to them
            const queries = [];

            // Normalize Center ID for Safe Search (Match Data Standard)
            // CRITICAL FIX: "Brute Force" Center IDs to handle dirty data
            // If the DB has "un_college" but we ask for "UN_COLLEGE", Rules block it.
            // We ask for ALL variants to be safe.
            const userCenter = (userProfile.centerId || "UN_COLLEGE").trim();
            const safeCenterIds = [
                userCenter.toUpperCase(), // "UN_COLLEGE"
                userCenter.toLowerCase(), // "un_college"
                userCenter.charAt(0).toUpperCase() + userCenter.slice(1).toLowerCase() // "Un_college"
            ];
            // Remove duplicates
            const uniqueCenters = [...new Set(safeCenterIds)];

            // Helper to safely execute queries without breaking Promise.all
            const safeGetDocs = (q, label) => {
                return getDocs(q).catch(err => {
                    console.warn(`⚠️ Query failed [${label}]:`, err.message);
                    return { empty: true, docs: [] }; // Return empty result on failure
                });
            };

            // 1. Standard UID Match (Current Login)
            if (userProfile.uid) {
                queries.push(safeGetDocs(query(leadsRef, where("assignedTo", "==", userProfile.uid)), "UID Match"));
            }

            // 2. Name Match (Handle Case Sensitivity)
            if (userProfile.name && typeof userProfile.name === 'string' && userProfile.name.trim() !== '') {
                const originalName = userProfile.name.trim(); // e.g. "Harun shaikh"

                // Query 2a: Exact Name Match
                queries.push(safeGetDocs(query(leadsRef, where("assignedByName", "==", originalName)), "Exact Name"));

                // Query 2b: SAFE Name Match (Name + Multiple Center Variants)
                uniqueCenters.forEach(cid => {
                    queries.push(safeGetDocs(query(leadsRef, where("assignedByName", "==", originalName), where("centerId", "==", cid)), `Safe Name (${cid})`));
                });

                // Query 2c: Title Case Match
                const titleCaseName = originalName.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

                if (titleCaseName !== originalName) {
                    console.log(`🔎 Also searching for Title Case: "${titleCaseName}"`);
                    // Standard Name Match
                    queries.push(safeGetDocs(query(leadsRef, where("assignedByName", "==", titleCaseName)), "Title Case Name"));
                    // SAFE Name Match (Title Case + Multiple Center Variants)
                    uniqueCenters.forEach(cid => {
                        queries.push(safeGetDocs(query(leadsRef, where("assignedByName", "==", titleCaseName), where("centerId", "==", cid)), `Safe Title Case (${cid})`));
                    });
                }

                // --- 3. DUPLICATE ACCOUNT LINKING (Self-Healing) ---
                // If the user has duplicate accounts (e.g. Old UID vs New UID), we find the OLD UID by Name and fetch those leads too.
                try {
                    const usersRef = collection(db, "users");
                    const nameQueries = [
                        getDocs(query(usersRef, where("name", "==", originalName)))
                    ];
                    if (titleCaseName !== originalName) {
                        nameQueries.push(getDocs(query(usersRef, where("name", "==", titleCaseName))));
                    }

                    const userSnapsArray = await Promise.all(nameQueries);

                    userSnapsArray.forEach(userSnaps => {
                        userSnaps.forEach(uDoc => {
                            // If we find ANOTHER account with the same name but different UID
                            if (uDoc.id !== userProfile.uid) {
                                const linkedEmail = uDoc.data().email;
                                console.log(`🔗 Found Linked Account for ${originalName}: ${uDoc.id} (${linkedEmail})`);

                                // SAFE Linked Account Search
                                // 1. Naked Query (If rules allow)
                                queries.push(safeGetDocs(query(leadsRef, where("assignedTo", "==", uDoc.id)), `Linked Account (${uDoc.id})`));

                                // 2. Center-Scoped Queries (To bypass old rules)
                                uniqueCenters.forEach(cid => {
                                    queries.push(safeGetDocs(query(leadsRef, where("assignedTo", "==", uDoc.id), where("centerId", "==", cid)), `Safe Linked (${cid})`));
                                });
                            }
                        });
                    });
                } catch (err) {
                    console.warn("Error linking duplicate accounts:", err);
                }

                // --- 4. PREFIX SEARCH (Fallback for Partial Matches) ---
                const parts = originalName.split(' ');
                if (parts.length > 0 && parts[0].length >= 3) {
                    const firstName = parts[0];
                    const titlePrefix = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
                    const lowerPrefix = firstName.toLowerCase();

                    // Search "Harun..." (Standard)
                    queries.push(safeGetDocs(query(leadsRef, where("assignedByName", ">=", titlePrefix), where("assignedByName", "<=", titlePrefix + '\uf8ff')), "Prefix Title"));
                    // Safe Search "Harun..." + Centers
                    uniqueCenters.forEach(cid => {
                        queries.push(safeGetDocs(query(leadsRef, where("assignedByName", ">=", titlePrefix), where("assignedByName", "<=", titlePrefix + '\uf8ff'), where("centerId", "==", cid)), `Safe Prefix Title (${cid})`));
                    });

                    // Search "harun..." (if different)
                    if (lowerPrefix !== titlePrefix) {
                        queries.push(safeGetDocs(query(leadsRef, where("assignedByName", ">=", lowerPrefix), where("assignedByName", "<=", lowerPrefix + '\uf8ff')), "Prefix Lower"));
                        // Safe Search "harun..." + Centers
                        uniqueCenters.forEach(cid => {
                            queries.push(safeGetDocs(query(leadsRef, where("assignedByName", ">=", lowerPrefix), where("assignedByName", "<=", lowerPrefix + '\uf8ff'), where("centerId", "==", cid)), `Safe Prefix Lower (${cid})`));
                        });
                    }
                }

                // --- 5. BDE SOURCE MATCH (Leads sourced by this BDE) ---
                // "BDE CAN SEE THE PREVIOUS LEAD" - Even if assigned to counselor
                if (userProfile.role === 'BDE') {
                    const bdeName = originalName || userProfile.name;
                    // 1. New Robust ID Match
                    queries.push(safeGetDocs(query(leadsRef, where("bdeId", "==", userProfile.uid)), "BDE ID Match"));

                    // 2. Name Match (Fallback if ID missing)
                    queries.push(safeGetDocs(query(leadsRef, where("bdeName", "==", bdeName)), "BDE Name Match"));

                    // 3. Legacy String Source Details Match
                    queries.push(safeGetDocs(query(leadsRef, where("source", "==", "BDE"), where("sourceDetails", "==", bdeName)), "BDE String Match"));

                    // 4. Legacy Object Match
                    queries.push(safeGetDocs(query(leadsRef, where("source", "==", "BDE"), where("sourceDetails.enteredBy", "==", bdeName)), "BDE Object Match"));
                }
            }

            if (queries.length === 0) {
                return [];
            }

            // Execute parallel queries
            const snapshots = await Promise.all(queries);

            // Merge and Deduplicate
            const uniqueLeads = new Map();
            snapshots.forEach(snap => {
                if (snap && snap.docs) {
                    snap.docs.forEach(doc => {
                        uniqueLeads.set(doc.id, doc);
                    });
                }
            });

            docs = Array.from(uniqueLeads.values());
        }

        const results = docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Normalize studentName
                studentName: data.studentName || data.name || "Unknown"
            };
        });

        // Client-side Sort (Newest First) to avoid missing Index errors in Firestore
        return results.sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        });

    } catch (error) {
        console.error("Error fetching leads:", error);
        return [];
    }
};

// 2.5 SUBSCRIBE TO LEADS (Real-time for Directors/Managers/BDEs)
import { onSnapshot, or } from 'firebase/firestore';

export const subscribeToLeads = (userProfile, onUpdate) => {
    const role = userProfile?.role?.toUpperCase();

    // 1. DIRECTOR: See All (Limited)
    if (role === 'DIRECTOR') {
        const q = query(
            collection(db, LEADS_COLLECTION),
            limit(5000) // Increased limit to show all history
        );
        return onSnapshot(q, (snapshot) => {
            const leads = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                studentName: doc.data().studentName || doc.data().name || "Unknown"
            }));
            leads.sort((a, b) => {
                const dateA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
                const dateB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
                return dateB - dateA;
            });
            onUpdate(leads);
        }, (error) => console.error("Real-time Error:", error));
    }

    // 2. MANAGER: See Center Leads
    if (role === 'MANAGER' && userProfile.centerId) {
        const q = query(
            collection(db, LEADS_COLLECTION),
            where("centerId", "==", userProfile.centerId)
        );
        return onSnapshot(q, (snapshot) => {
            const leads = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                studentName: doc.data().studentName || doc.data().name || "Unknown"
            }));
            leads.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            onUpdate(leads);
        }, (error) => console.error("Real-time Error:", error));
    }

    // 3. BDE: See Own Leads (Real-time Update - ROBUST)
    if (role === 'BDE') {
        const bdeName = userProfile.name.trim();

        // Fix: Fetch latest leads overall and filter client-side to guarantee newest leads show up
        // This matches the DIRECTOR query and avoids any missing index errors, while preventing
        // the silent truncation caused by limit(1000) without orderBy.
        const q = query(
            collection(db, LEADS_COLLECTION),
            limit(5000)
        );

        return onSnapshot(q, (snapshot) => {
            const rawLeads = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                studentName: doc.data().studentName || doc.data().name || "Unknown"
            }));

            // Client-Side Filter for THIS BDE
            const myLeads = rawLeads.filter(l => {
                // Check 1: ID Match
                if (l.bdeId === userProfile.uid) return true;

                // Check 2: Name Match (Exact or Includes)
                if (l.bdeName === bdeName) return true;

                // Check 3: Source Details (Legacy) -> "Mukunda" or { enteredBy: "Mukunda" }
                const sd = l.sourceDetails;
                if (typeof sd === 'string' && sd.includes(bdeName)) return true;
                if (typeof sd === 'object' && sd?.enteredBy?.includes(bdeName)) return true;

                return false;
            });

            // Sort
            myLeads.sort((a, b) => {
                const dateA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
                const dateB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
                return dateB - dateA;
            });
            onUpdate(myLeads);

        }, (error) => console.error("BDE Real-time Error:", error));
    }

    // Fallback for others (One-time fetch)
    fetchLeads(userProfile).then(onUpdate);
    return () => { };
};

// 3. UPDATE LEAD
export const updateLead = async (leadId, updates, userProfile) => {
    try {
        const leadRef = doc(db, LEADS_COLLECTION, leadId);

        // Fetch current lead to see if it's tied to an admission
        const leadSnap = await getDoc(leadRef);
        let leadData = null;
        if (leadSnap.exists()) {
            leadData = leadSnap.data();
        }

        // Prepare Update Object (Clean & Explicit)
        const cleanUpdates = {
            studentName: updates.studentName,
            aadhar: updates.aadhar,
            phone: updates.phone,
            parentPhone: updates.parentPhone,
            courseInterest: updates.course || updates.courseInterest,
            status: updates.status, // Allow status updates
            assignedTo: updates.assignedTo,
            assignedByName: updates.assignedByName,

            // New Attributes
            board: updates.board,
            currentStandard: updates.currentStandard,
            address: updates.address,
            remarks: updates.remarks,

            // Source Update Logic (Only if provided)
            ...(updates.source && { source: updates.source }),
            ...(updates.sourceDetails && { sourceDetails: updates.sourceDetails }),

            lastUpdated: serverTimestamp()
        };

        // Remove undefined keys
        Object.keys(cleanUpdates).forEach(key => cleanUpdates[key] === undefined && delete cleanUpdates[key]);

        await updateDoc(leadRef, cleanUpdates);

        // SYNC ADMISSION IF COUNSELLOR CHANGED
        if (leadData && updates.assignedTo && updates.assignedTo !== leadData.assignedTo && leadData.admissionId) {
            try {
                const admissionRef = doc(db, "admissions", leadData.admissionId);
                const admissionSnap = await getDoc(admissionRef);
                if (admissionSnap.exists()) {
                    await updateDoc(admissionRef, {
                        counsellorId: updates.assignedTo,
                        counsellorName: updates.assignedByName || "Unknown Staff",
                        bookedById: updates.assignedTo, // Transfer full ownership
                        bookedBy: updates.assignedByName || "Unknown Staff",
                    });
                    console.log(`Successfully transferred admission ${leadData.admissionId} to ${updates.assignedByName}`);
                }
            } catch (syncErr) {
                console.error("Error syncing admission counsellor:", syncErr);
            }
        }

        // Optional: Log 'Update' to timeline if significant changes?
        // For now, we only log status changes separately or via 'addInteraction'

        return { success: true };
    } catch (error) {
        console.error("Error updating lead:", error);
        return { success: false, error: error.message };
    }
};

// 4. ASSIGN LEAD TO STAFF
export const assignLead = async (leadId, staffObj, assignedBy) => {
    try {
        const leadRef = doc(db, "leads", leadId);

        const leadSnap = await getDoc(leadRef);
        const leadData = leadSnap.exists() ? leadSnap.data() : null;

        await updateDoc(leadRef, {
            assignedTo: staffObj.uid,
            assignedByName: staffObj.name || "Unknown Staff",
            status: "ASSIGNED", // Update status from NEW to ASSIGNED
            lastUpdated: serverTimestamp(),

            // Add to timeline history
            timeline: arrayUnion({
                type: "ASSIGNMENT",
                message: `Lead assigned to ${staffObj.name || "Unknown Staff"}`,
                date: Timestamp.now(),
                by: assignedBy || "Unknown User"
            })
        });

        // SYNC ADMISSION IF PRESENT
        if (leadData && leadData.admissionId && staffObj.uid !== leadData.assignedTo) {
            try {
                const admissionRef = doc(db, "admissions", leadData.admissionId);
                const admissionSnap = await getDoc(admissionRef);
                if (admissionSnap.exists()) {
                    await updateDoc(admissionRef, {
                        counsellorId: staffObj.uid,
                        counsellorName: staffObj.name || "Unknown Staff",
                        bookedById: staffObj.uid, // Transfer full ownership
                        bookedBy: staffObj.name || "Unknown Staff",
                    });
                }
            } catch (syncErr) {
                console.error("Error syncing admission counsellor on assign:", syncErr);
            }
        }

        return { success: true };
    } catch (error) {
        console.error("Error assigning lead:", error);
        return { success: false, error: error.message };
    }
};

// 5. GET SINGLE LEAD DETAILS
export const getLeadById = async (leadId) => {
    try {
        const docRef = doc(db, "leads", leadId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                studentName: data.studentName || data.name || "Unknown"
            };
        }
        return null;
    } catch (error) {
        console.error("Error getting lead:", error);
        return null;
    }
};

// 5. ADD INTERACTION (Call/Visit Log)
export const addInteraction = async (leadId, interactionData, userProfile) => {
    try {
        const leadRef = doc(db, "leads", leadId);

        // Create the timeline entry
        const newEntry = {
            type: interactionData.type, // 'CALL', 'VISIT', 'WHATSAPP'
            result: interactionData.result, // 'Ringing', 'Interested', etc.
            note: interactionData.note || "",
            date: Timestamp.now(),
            by: userProfile.name,
            byId: userProfile.uid || "unknown"
        };

        // Update Lead Status if provided (e.g., change from NEW to VISITED)
        const updatePayload = {
            timeline: arrayUnion(newEntry),
            lastUpdated: serverTimestamp()
        };

        if (interactionData.newStatus) {
            updatePayload.status = interactionData.newStatus;
        }

        // NEW: If a Next Follow-up Date is provided, save it
        if (interactionData.nextFollowUp) {
            // Storing as string YYYY-MM-DD for simple equality/range checks
            updatePayload.nextFollowUp = interactionData.nextFollowUp;
        }

        await updateDoc(leadRef, updatePayload);
        return { success: true };

    } catch (error) {
        console.error("Error adding interaction:", error);
        return { success: false, error: error.message };
    }
};

// 6. GET TASKS FOR TODAY (Leads with Follow-up <= Today)
export const fetchTodaysTasks = async (userProfile) => {
    try {
        if (!userProfile) return [];

        // FIX: Use Local Date (YYYY-MM-DD) instead of UTC to avoid timezone issues
        // This ensures that "Today" means "Today in User's Timezone"
        const localDate = new Date();
        const todayStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

        const leadsRef = collection(db, LEADS_COLLECTION);
        let docs = [];

        // 1. DIRECTOR: See ALL Pending Tasks
        if (userProfile.role?.toUpperCase() === 'DIRECTOR') {
            const q = query(leadsRef); // Fetch all, will filter in memory for complex date/status
            const snapshot = await getDocs(q);
            docs = snapshot.docs;
        }
        // 2. MANAGER: See Pending Tasks for their CENTER
        else if (userProfile.role?.toUpperCase() === 'MANAGER') {
            const managerCenterId = (userProfile.centerId || "").trim().toUpperCase();
            if (managerCenterId) {
                const q = query(leadsRef, where("centerId", "==", managerCenterId));
                const snapshot = await getDocs(q);
                docs = snapshot.docs;
            }
        }
        // 3. STAFF: See Only ASSIGNED Tasks (With Robust Logic)
        else {
            // Helper to safely execute queries without breaking Promise.all
            const safeGetDocs = (q, label) => {
                return getDocs(q).catch(err => {
                    console.warn(`⚠️ Query failed [${label}]:`, err.message);
                    return { empty: true, docs: [] }; // Return empty result on failure
                });
            };

            const queries = [];
            const uniqueCenters = [
                (userProfile.centerId || "UN_COLLEGE").trim().toUpperCase(),
                (userProfile.centerId || "UN_COLLEGE").trim().toLowerCase()
            ];

            // 1. Standard UID Match
            if (userProfile.uid) {
                queries.push(safeGetDocs(query(leadsRef, where("assignedTo", "==", userProfile.uid)), "UID Match"));
            }

            // 2. Name Match (Robust)
            if (userProfile.name && typeof userProfile.name === 'string' && userProfile.name.trim() !== '') {
                const originalName = userProfile.name.trim();
                queries.push(safeGetDocs(query(leadsRef, where("assignedByName", "==", originalName)), "Exact Name"));

                // Query 2b: Title Case Match
                const titleCaseName = originalName.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                if (titleCaseName !== originalName) {
                    queries.push(safeGetDocs(query(leadsRef, where("assignedByName", "==", titleCaseName)), "Title Case Name"));
                }

                // 3. DUPLICATE ACCOUNT LINKING (Self-Healing)
                // If user has duplicate accounts, we find OLD UID by Name and fetch those leads too.
                try {
                    const usersRef = collection(db, "users");
                    const nameQueries = [
                        getDocs(query(usersRef, where("name", "==", originalName)))
                    ];
                    if (titleCaseName !== originalName) {
                        nameQueries.push(getDocs(query(usersRef, where("name", "==", titleCaseName))));
                    }

                    const nameSnapshots = await Promise.all(nameQueries);
                    const linkedUIDs = new Set();
                    nameSnapshots.forEach(snap => {
                        snap.docs.forEach(doc => linkedUIDs.add(doc.id));
                    });

                    // Fetch leads for these linked UIDs
                    linkedUIDs.forEach(uid => {
                        if (uid !== userProfile.uid) {
                            queries.push(safeGetDocs(query(leadsRef, where("assignedTo", "==", uid)), `Linked Account (${uid})`));
                        }
                    });
                } catch (err) {
                    console.warn("⚠️ Failed to check for duplicate accounts:", err);
                }
            }

            if (queries.length === 0) return [];

            const snapshots = await Promise.all(queries);
            const uniqueDocs = new Map();
            snapshots.forEach(snap => {
                if (snap && snap.docs) {
                    snap.docs.forEach(doc => uniqueDocs.set(doc.id, doc));
                }
            });
            docs = Array.from(uniqueDocs.values());
        }

        return docs
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    studentName: data.studentName || data.name || "Unknown"
                };
            })
            // Filter: Has follow-up AND is due today or past AND is NOT converted/closed
            .filter(lead => {
                // Expanded Converted Statuses (Includes REJECTED now)
                const isConverted = ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN', 'CLOSED', 'LOST', 'REJECTED'].includes(lead.status);
                // "Pending" means: Not Converted AND (Due Today OR Overdue)
                return lead.nextFollowUp && lead.nextFollowUp <= todayStr && !isConverted;
            });
    } catch (error) {
        console.error("Error fetching tasks:", error);
        return [];
    }
};

// 8. FETCH COUNSELLOR STATS (Total Admissions & Breakdown)
export const fetchCounsellorStats = async (userProfile) => {
    try {
        const admissions = await getCachedAdmissions(userProfile.centerId);

        // Robust Client Filter
        const counsellorDocs = admissions.filter(data => {
            // Match centerId if present
            if (userProfile.centerId && data.centerId !== userProfile.centerId) {
                return false;
            }

            // Match fetchMyAdmissions logic: BookedBy OR AssignedTo OR Name Match
            return data.bookedById === userProfile.uid ||
                data.counsellorId === userProfile.uid ||
                data.counsellorName === userProfile.name;
        });

        // Calculate Breakdown
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthIndex = lastMonthDate.getMonth();
        const lastMonthYear = lastMonthDate.getFullYear();

        const breakdown = {
            'TOTAL': counsellorDocs.length,
            'THIS MONTH': 0,
            'LAST MONTH': 0,
            'JAN': 0, 'FEB': 0, 'MAR': 0, 'APR': 0, 'MAY': 0, 'JUN': 0,
            'JUL': 0, 'AUG': 0, 'SEP': 0, 'OCT': 0, 'NOV': 0, 'DEC': 0
        };

        const monthKeys = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

        counsellorDocs.forEach(data => {
            // Use admissionDate or createdAt
            let date = data.admissionDate ? new Date(data.admissionDate) : (data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date()));

            const m = date.getMonth();
            const y = date.getFullYear();

            // Increment specific month count (regardless of year, or maybe constrained to current year? usually Dashboard shows current academic year. For simplicity, we'll just map all history to months for now, or maybe current year is better. User asked for "Jan Feb", implying annual 12 bins. I'll count ALL "Jan"s? No, typically "Jan 2024". I'll assume current year for specific months to be safe, or just bulk them if it's a simple view. Let's do Current Year for specific months)
            if (y === currentYear) {
                breakdown[monthKeys[m]]++;
            }

            // This Month Logic
            if (m === currentMonth && y === currentYear) {
                breakdown['THIS MONTH']++;
            }

            // Last Month Logic
            if (m === lastMonthIndex && y === lastMonthYear) {
                breakdown['LAST MONTH']++;
            }
        });

        return {
            totalAdmissions: breakdown['TOTAL'], // Keep legacy field as Total
            breakdown
        };

    } catch (error) {
        console.error("Error fetching stats:", error);
        return { totalAdmissions: 0, breakdown: {} };
    }
};

// 7. SAVE QUOTE TO TIMELINE
export const saveQuoteToHistory = async (leadId, quoteData, userProfile) => {
    try {
        const leadRef = doc(db, "leads", leadId);

        // Create a special timeline entry for the quote
        const newEntry = {
            type: "QUOTE",
            result: `Quoted ₹${quoteData.finalFee.toLocaleString()}`,
            note: `Discount: ${quoteData.discount}%, Plan: ${quoteData.plan}`,
            amount: quoteData.finalFee, // Store raw number for reports later
            date: Timestamp.now(),
            by: userProfile.name
        };

        await updateDoc(leadRef, {
            timeline: arrayUnion(newEntry),
            budgetQuoted: quoteData.finalFee, // Update main field for filtering
            lastUpdated: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error("Error saving quote:", error);
        return { success: false, error: error.message };
    }
};

// 9. FETCH MY ADMISSIONS (From Admissions Collection) - ROBUST UPDATE
export const fetchMyAdmissions = async (userProfile) => {
    try {
        const admissions = await getCachedAdmissions(userProfile.centerId);

        const results = admissions.filter(adm => {
            // Match centerId if present
            if (userProfile.centerId && adm.centerId !== userProfile.centerId) {
                return false;
            }

            // Strict Filter: Must be linked to this user
            // Check 1: Booked By Me
            if (adm.bookedById === userProfile.uid) return true;
            // Check 2: Assigned Counsellor is Me
            if (adm.counsellorId === userProfile.uid) return true;
            // Check 3: Legacy Name Match
            if (adm.counsellorName === userProfile.name) return true;

            return false;
        });

        // Client-side Sort (Newest First)
        return results.sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        });

    } catch (error) {
        console.error("Error fetching my admissions:", error);
        return [];
    }
};

// Stray code removed

// 11. DELETE LEAD (Manager/Director Only)
export const deleteLead = async (leadId) => {
    try {
        const leadRef = doc(db, "leads", leadId);
        await deleteDoc(leadRef);
        return { success: true };
    } catch (error) {
        console.error("Error deleting lead:", error);
        return { success: false, error: error.message };
    }
};
