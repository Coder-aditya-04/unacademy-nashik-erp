import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, arrayUnion, query, where, getDocs } from 'firebase/firestore';

// RECORD TOKEN & CONVERT LEAD
export const processTokenPayment = async (paymentData, userProfile) => {
    try {
        // LOGIC FIX:
        // amount = The TOTAL FEE (e.g., 1,00,000)
        // totalPaid = The TOKEN (e.g., 5,000)
        // Balance = 95,000 (Calculated automatically by 100k - 5k)

        const totalFee = parseFloat(paymentData.finalTotalFee) || parseFloat(paymentData.amount);
        const tokenAmount = parseFloat(paymentData.amount);

        // 1. Create the Admission Record (The Financial Record)
        const admissionRef = await addDoc(collection(db, "admissions"), {
            leadId: paymentData.leadId || null,
            studentName: paymentData.studentName,
            phone: paymentData.phone,
            program: paymentData.program,
            centerId: userProfile.centerId,
            centerName: userProfile.centerId === 'PRAYAS' ? 'Prayas' : 'Unacademy', // Simplified logic

            // FINANCIALS (FIXED)
            amount: totalFee, // This is the TOTAL DEBT
            totalPaid: tokenAmount, // This is what they paid NOW

            paymentMode: paymentData.paymentMode,
            proofImage: paymentData.proofImage || null,

            // Meta
            status: "TOKEN_PAID", // Initial Status
            bookedBy: userProfile.name,
            bookedById: userProfile.uid,
            enrollmentDate: paymentData.enrollmentDate || null, // SAVE DATE
            createdAt: serverTimestamp(),

            // Initialize Payment History Array
            payments: [{
                amount: tokenAmount,
                mode: paymentData.paymentMode,
                date: new Date(), // Storing as object for easier PDF generation later
                type: "TOKEN"
            }]
        });

        // 2. If this came from a Lead, update the Lead Status
        if (paymentData.leadId) {
            const leadRef = doc(db, "leads", paymentData.leadId);
            await updateDoc(leadRef, {
                status: "CONVERTED", // Mark as Won
                admissionId: admissionRef.id, // Link to the money record
                lastUpdated: serverTimestamp(),
                timeline: arrayUnion({
                    type: "PAYMENT",
                    result: "Token Received",
                    note: `Amount: ₹${paymentData.amount} (${paymentData.paymentMode})`,
                    date: new Date(),
                    by: userProfile.name
                })
            });
        }

        return { success: true, id: admissionRef.id };

    } catch (error) {
        console.error("Payment Error:", error);
        return { success: false, error: error.message };
    }
};

// SET PAYMENT REMINDER (New)
export const updatePaymentReminder = async (admissionId, dateStr, userProfile) => {
    try {
        const adRef = doc(db, "admissions", admissionId);
        await updateDoc(adRef, {
            nextPaymentDate: dateStr, // YYYY-MM-DD
            lastUpdated: serverTimestamp(),
            // Optional: Log who set the reminder
            reminderSetBy: userProfile.name
        });
        return { success: true };
    } catch (error) {
        console.error("Error setting reminder:", error);
        return { success: false, error: error.message };
    }
};

// FETCH PENDING DUES (For Dashboard Reminder) - ROBUST UPDATE
export const fetchUpcomingInstallments = async (userProfileOrUid) => {
    try {
        const adRef = collection(db, "admissions");

        // Handle both full profile (New) and just UID (Legacy calls)
        const userProfile = typeof userProfileOrUid === 'object' ? userProfileOrUid : { uid: userProfileOrUid };
        const uid = userProfile.uid;

        // STRATEGY: Match "fetchMyAdmissions" logic exactly to ensure visibility consistency
        // 1. If Center ID exists, fetch ALL for Center -> Filter client side (Avoids missing ID issues)
        // 2. Else -> Specific Query

        let docs = [];

        if (userProfile.centerId) {
            const q = query(adRef, where("centerId", "==", userProfile.centerId));
            const snapshot = await getDocs(q);
            docs = snapshot.docs;
        } else {
            // Fallback: Query by IDs
            const q1 = query(adRef, where("bookedById", "==", uid));
            const q2 = query(adRef, where("counsellorId", "==", uid));
            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

            // Merge
            const uniqueMap = new Map();
            snap1.forEach(doc => uniqueMap.set(doc.id, doc));
            snap2.forEach(doc => uniqueMap.set(doc.id, doc));
            docs = Array.from(uniqueMap.values());
        }

        const installments = [];
        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        docs.forEach(doc => {
            const data = doc.data();

            // VISIBILITY CHECK (Must match My Admissions)
            let isVisible = false;
            if (data.bookedById === uid) isVisible = true;
            else if (data.counsellorId === uid) isVisible = true;
            else if (userProfile.name && (data.counsellorName === userProfile.name || data.bookedBy === userProfile.name)) isVisible = true;
            // Also show if I set the reminder myself? Maybe. But let's stick to ownership first.

            if (!isVisible) return; // Skip if not my lead

            const balance = parseFloat(data.amount || 0) - parseFloat(data.totalPaid || 0);

            // Filter: Must have balance > 100
            if (balance > 100) {

                // PRIORITY: Custom Next Payment Date
                let dueDateStr;
                let isCustom = false;

                if (data.nextPaymentDate) {
                    dueDateStr = data.nextPaymentDate;
                    isCustom = true;
                } else {
                    // Default logic (only if no custom date set)
                    const admissionDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
                    const d = new Date(admissionDate);
                    d.setDate(d.getDate() + 30);
                    dueDateStr = d.toISOString().split('T')[0];
                }

                // Parse Dates safely
                let dueObj;
                if (dueDateStr.includes('/') && dueDateStr.split('/').length === 3) {
                    const [d, m, y] = dueDateStr.split('/');
                    dueObj = new Date(`${y}-${m}-${d}`);
                } else {
                    dueObj = new Date(dueDateStr);
                }

                const todayObj = new Date(todayStr); // UTC Midnight for Today
                const diffTime = dueObj - todayObj;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // SHOW IF: Overdue (<0) OR Due Today (=0)
                if (!isNaN(diffDays) && diffDays < 1) {
                    installments.push({
                        id: doc.id,
                        studentName: data.studentName,
                        phone: data.phone,
                        balance: balance,
                        dueDate: dueObj.toLocaleDateString(),
                        rawDueDate: dueObj, // For sorting
                        isOverdue: diffDays < 0,
                        isCustom: isCustom,
                        daysLeft: diffDays
                    });
                }
            }
        });

        console.log(`[DEBUG] Found ${installments.length} DUE installments for ${uid}`);

        return installments.sort((a, b) => a.rawDueDate - b.rawDueDate);

    } catch (error) {
        console.error("Error fetching dues:", error);
        return [];
    }
};
