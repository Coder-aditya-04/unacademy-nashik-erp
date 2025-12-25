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

// FETCH PENDING DUES (For Dashboard Reminder)
export const fetchUpcomingInstallments = async (counsellorUid) => {
    try {
        const adRef = collection(db, "admissions");
        // Get all admissions for this counsellor that are NOT fully paid
        // Note: Ideally efficient query, but for now client-side filter might be safer if status isn't reliable
        const q = query(adRef, where("bookedById", "==", counsellorUid));

        const snapshot = await getDocs(q);
        const installments = [];
        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        snapshot.forEach(doc => {
            const data = doc.data();
            const balance = parseFloat(data.amount || 0) - parseFloat(data.totalPaid || 0);

            if (balance > 100) { // Only if significant balance remains

                // PRIORITY: Use Custom Payment Date if set, otherwise default logic
                let dueDateStr;
                let isCustom = false;

                if (data.nextPaymentDate) {
                    dueDateStr = data.nextPaymentDate;
                    isCustom = true;
                } else {
                    // Heuristic: 2nd Installment is usually 30 days after admission
                    const admissionDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
                    const d = new Date(admissionDate);
                    d.setDate(d.getDate() + 30);
                    dueDateStr = d.toISOString().split('T')[0];
                }

                // Check if overdue or upcoming (within next 7 days)
                // String comparison works for YYYY-MM-DD: "2025-12-25" > "2025-12-21"

                // Logic: Show if Due Date <= Today + 7 days
                // Actually, let's just parse relevant ones
                const dueObj = new Date(dueDateStr);
                const todayObj = new Date(todayStr);
                const diffTime = dueObj - todayObj;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // If Overdue (diffDays < 0) OR Upcoming soon (diffDays < 7)
                if (diffDays < 7) {
                    installments.push({
                        id: doc.id,
                        studentName: data.studentName,
                        phone: data.phone,
                        balance: balance,
                        dueDate: dueObj.toLocaleDateString(),
                        isOverdue: diffDays < 0,
                        isCustom: isCustom
                    });
                }
            }
        });

        return installments;

    } catch (error) {
        console.error("Error fetching dues:", error);
        return [];
    }
};
