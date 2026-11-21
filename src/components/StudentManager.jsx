import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, Timestamp, runTransaction, collection, query, getDocs, where, getDoc, limit, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { clearAdmissionsCache } from '../services/cacheService';
import { uploadProof, proofUrlFor, hasProof, checkProofFile, newPaymentId, PROOF_ACCEPT } from '../services/proofService';
import { FileText, CheckCircle, Clock, Printer, CreditCard, X, Paperclip, Image as ImageIcon, Calendar, TrendingUp, AlertCircle, ArrowRight, Mail, User, Briefcase, School, Edit2, Trash2 } from 'lucide-react';
import { CENTERS } from '../utils/centers';
import { PROGRAMS } from '../utils/feeData';
import { estimateSchedule } from '../utils/feeSchedule';
import { downloadOfficialReceipt } from '../utils/receipt';
import { useFeeStructure } from '../hooks/useFeeStructure';

const StudentManager = ({ student, onClose, refreshData, userProfile }) => {
    const { feeStructures } = useFeeStructure();
    const [payAmount, setPayAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [transactionType, setTransactionType] = useState('PAYMENT'); // 'PAYMENT' or 'REFUND'
    const [refundRemarks, setRefundRemarks] = useState('');
    const [loading, setLoading] = useState(false);
    const [showProof, setShowProof] = useState(false); // Proof Modal State
    const [proofView, setProofView] = useState(null); // { url, isPdf } for an instalment proof
    const [proofFile, setProofFile] = useState(null); // proof for the payment being recorded
    const [attachingIdx, setAttachingIdx] = useState(null);

    // Edit Fee State (Director only)
    const [editFee, setEditFee] = useState(String(student.amount || ''));
    const [editFeeLoading, setEditFeeLoading] = useState(false);

    // Transfer Center State (Director only)
    const [editCenter, setEditCenter] = useState(student.centerId || '');
    const [transferLoading, setTransferLoading] = useState(false);

    // Course Correction State (Director only)
    const [editCourse, setEditCourse] = useState(student.standard || student.program || '');
    const [courseLoading, setCourseLoading] = useState(false);
    const [recoveredCourse, setRecoveredCourse] = useState('');

    // Payment Plan Correction State (Director only)
    const [editPaymentPlan, setEditPaymentPlan] = useState(student.paymentPlan || 'INSTALLMENT');
    const [planLoading, setPlanLoading] = useState(false);

    // Edit Transaction State (Director only)
    const [editingPayIdx, setEditingPayIdx] = useState(null);
    const [editPayAmt, setEditPayAmt] = useState('');
    const [editPayMode, setEditPayMode] = useState('Cash');
    const [editPayType, setEditPayType] = useState('Installment/Balance');
    const [editPayRemarks, setEditPayRemarks] = useState('');

    // Batch Management State
    const [batchAssigned, setBatchAssigned] = useState(student.batchAssigned || student.batchName || '');
    const [savingBatch, setSavingBatch] = useState(false);

    // Counsellor Name Recovery State
    const [counsellorName, setCounsellorName] = useState(student.counsellorName || student.bookedBy || student.counselorName || student.counsellor || student.enteredBy || student.createdBy || 'Team');

    // DEEP FETCH: Recover Missing Counsellor Name
    useEffect(() => {
        const fetchDeepInfo = async () => {
            // Check if current name is actually a UID (no spaces, long string, 20+ chars)
            const isUid = (name) => name && name.length > 20 && !name.includes(' ');

            if (counsellorName !== 'Team' && !isUid(counsellorName)) return; // Already has a valid name

            let recoveredName = null;
            try {
                // Strategy 1: Fetch by Lead ID
                if (student.leadId) {
                    const leadRef = doc(db, 'leads', student.leadId);
                    const leadSnap = await getDoc(leadRef);
                    if (leadSnap.exists()) {
                        const leadData = leadSnap.data();
                        recoveredName = leadData.assignedByName || leadData.assignedTo || leadData.sourceDetails?.enteredBy;
                    }
                }

                // Strategy 2: Fetch by Phone (Fallback)
                if ((!recoveredName || isUid(recoveredName)) && student.phone) {
                    try {
                        const q = query(collection(db, 'leads'), where('phone', '==', student.phone), limit(1));
                        const querySnap = await getDocs(q);
                        if (!querySnap.empty) {
                            const leadData = querySnap.docs[0].data();
                            recoveredName = leadData.assignedByName || leadData.assignedTo || leadData.sourceDetails?.enteredBy;
                        }
                    } catch (e) { console.error(e); }
                }

                // Strategy 3: Resolve UID to Name (if we found a UID)
                if (recoveredName && isUid(recoveredName)) {
                    try {
                        const userRef = doc(db, 'users', recoveredName);
                        // We need to fetch user doc. Note: 'users' collection access might require permission.
                        // Assuming 'users' collection stores user profiles by UID.
                        const userSnap = await getDoc(userRef);
                        if (userSnap.exists()) {
                            const userData = userSnap.data();
                            recoveredName = userData.name || userData.displayName || userData.email || 'Team';
                        }
                    } catch (uidErr) {
                        console.error("UID Resolve Error (Manager):", uidErr);
                    }
                }

                if (recoveredName && !isUid(recoveredName)) setCounsellorName(recoveredName);
            } catch (err) {
                console.error("Deep Fetch Error (Manager):", err);
            }
        };
        fetchDeepInfo();
    }, [student]);

    // RECOVER COURSE INTEREST FROM LEAD
    useEffect(() => {
        const recoverCourse = async () => {
            // Only attempt if standard looks generic (no "NEET" or "JEE" keyword)
            const std = (student.standard || student.program || '').toUpperCase();
            const isGeneric = std.includes('NEET_JEE') || std.includes('MHT_CET');
            if (!isGeneric) return;

            try {
                if (student.leadId) {
                    const leadSnap = await getDoc(doc(db, 'leads', student.leadId));
                    if (leadSnap.exists()) {
                        const interest = leadSnap.data().courseInterest;
                        if (interest) {
                            setRecoveredCourse(interest);
                            return;
                        }
                    }
                }
                // Fallback: search by phone
                if (student.phone) {
                    const q = query(collection(db, 'leads'), where('phone', '==', student.phone), limit(1));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        const interest = snap.docs[0].data().courseInterest;
                        if (interest) setRecoveredCourse(interest);
                    }
                }
            } catch (e) {
                console.error('Course recovery failed:', e);
            }
        };
        recoverCourse();
    }, [student]);

    // FETCH BATCHES
    const [batchList, setBatchList] = useState([]);
    useEffect(() => {
        const fetchBatches = async () => {
            try {
                // Fetch batches for this center
                const q = query(collection(db, "batches"), where("centerId", "==", student.centerId));
                const snap = await getDocs(q);
                const list = snap.docs.map(d => d.data().name);
                setBatchList(list);
            } catch (e) {
                console.error("Failed to load batches", e);
            }
        };
        fetchBatches();
    }, [student.centerId]);

    // Helper: Auto-Recreate or Update Lead CRM Timeline
    const syncLeadTimeline = async (payload) => {
        if (!student.leadId) return;
        try {
            const leadRef = doc(db, "leads", student.leadId);
            await setDoc(leadRef, {
                ...payload,
                studentName: student.studentName || "Unknown",
                phone: student.phone || "",
                status: payload.status || "CONVERTED",
                centerId: student.centerId || null,
                admissionId: student.id,
                lastUpdated: serverTimestamp()
            }, { merge: true });
        } catch (leadErr) {
            console.warn("Could not sync to lead timeline:", leadErr);
        }
    };

    const handleUpdateBatch = async () => {
        if (!batchAssigned) return;
        setSavingBatch(true);
        try {
            const docRef = doc(db, "admissions", student.id);
            await updateDoc(docRef, { batchAssigned: batchAssigned });
            clearAdmissionsCache();

            // Sync to CRM Lead Timeline
            await syncLeadTimeline({
                batchAssigned: batchAssigned,
                timeline: arrayUnion({
                    type: "BATCH_UPDATE",
                    result: "Batch Assigned",
                    note: `Batch assigned: ${batchAssigned}`,
                    date: new Date(),
                    by: userProfile?.name || "Team"
                })
            });

            if (refreshData) refreshData();
            alert("Batch Updated Successfully!");
        } catch (error) {
            console.error(error);
            alert("Error updating batch");
        }
        setSavingBatch(false);
    };

    // Helper: WhatsApp Share

    // Schedule estimate lives in utils/feeSchedule (shared with the receipt page).
    const getEstimatedSchedule = (total, paid, startDate, programName = "", paymentPlan = "") => estimateSchedule(total, paid, startDate, programName, paymentPlan, feeStructures);

    // Derived State
    // A missing or zero totalPaid means nothing has been paid yet. Falling back
    // to `amount` here used to show unpaid students as fully paid, and made the
    // next payment add on top of the full fee.
    const totalPaid = Number(student.totalPaid) || 0;
    const balanceDue = (student.status === 'REFUNDED' || student.refundAmount > 0) ? 0 : Math.max(0, (student.amount || 0) - totalPaid);
    const isFullyPaid = balanceDue <= 0;

    // Resolve Schedule: Use Real or Estimate
    let displaySchedule = student.paymentSchedule || [];
    if (student.status === 'REFUNDED' || student.refundAmount > 0) {
        displaySchedule = [];
    } else if (displaySchedule.length === 0 && !isFullyPaid) {
        // Fix: Use Custom Enrollment Date if available, else CreatedAt, else Today
        const startDate = student.enrollmentDate
            ? new Date(student.enrollmentDate)
            : (student.createdAt?.seconds ? new Date(student.createdAt.seconds * 1000) : new Date());

        displaySchedule = getEstimatedSchedule(student.amount || 0, totalPaid, startDate, student.program || student.standard, student.paymentPlan);
    }

    // 2. RECORD NEW PAYMENT / REFUND
    const handleAddPayment = async () => {
        if (!payAmount) return;
        setLoading(true);

        try {
            const studentRef = doc(db, "admissions", student.id);
            const isRefund = transactionType === 'REFUND';
            const amountVal = Number(payAmount);

            const fileProblem = checkProofFile(proofFile);
            if (fileProblem) throw new Error(fileProblem);

            // Every payment gets an id so its proof can live at
            // proofs/{admissionId}/{paymentId}. Upload first, then record.
            const paymentId = newPaymentId();
            const proofPath = proofFile ? await uploadProof(student.id, paymentId, proofFile) : null;

            const newPayment = {
                id: paymentId,
                ...(proofPath && { proofPath, proofType: proofFile.type }),
                amount: isRefund ? -amountVal : amountVal,
                date: Timestamp.now(),
                mode: paymentMode,
                type: isRefund ? "REFUND" : "Installment/Balance",
                ...(isRefund && { remarks: refundRemarks || "Refund processed by Accountant" })
            };

            if (!(amountVal > 0)) throw new Error("Enter an amount greater than zero.");

            // Read the latest record inside a transaction so two people
            // recording payments at once (or a stale cached copy) cannot
            // overwrite each other's totals.
            await runTransaction(db, async (tx) => {
                const snap = await tx.get(studentRef);
                if (!snap.exists()) throw new Error("Admission record not found.");
                const fresh = snap.data();
                const freshPaid = Number(fresh.totalPaid) || 0;

                const updatePayload = {
                    payments: [...(fresh.payments || []), newPayment],
                };

                if (isRefund) {
                    updatePayload.refundAmount = (Number(fresh.refundAmount) || 0) + amountVal;
                    updatePayload.totalPaid = freshPaid - amountVal;
                    updatePayload.status = (freshPaid - amountVal) <= 0 ? 'REFUNDED' : (fresh.status || student.status);
                } else {
                    updatePayload.totalPaid = freshPaid + amountVal;
                }

                tx.update(studentRef, updatePayload);
            });

            clearAdmissionsCache();

            // SYNC TO CRM TIMELINE
            const timelineEntry = {
                type: isRefund ? "REFUND_ISSUED" : "PAYMENT",
                result: isRefund ? "Refund Processed" : "Installment Received",
                note: isRefund 
                    ? `Refund: ₹${amountVal.toLocaleString()} (${paymentMode}). Remarks: ${refundRemarks || 'N/A'}`
                    : `Amount: ₹${amountVal.toLocaleString()} (${paymentMode})`,
                date: new Date(),
                by: userProfile?.name || "Team"
            };

            const leadPayload = {
                timeline: arrayUnion(timelineEntry)
            };

            if (isRefund) {
                leadPayload.status = 'REFUNDED';
            }

            await syncLeadTimeline(leadPayload);

            alert(isRefund ? "Refund Recorded Successfully!" : "Payment Recorded Successfully!");
            setPayAmount('');
            setProofFile(null);
            setRefundRemarks('');
            setTransactionType('PAYMENT');

            if (refreshData) refreshData();
            onClose();

        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        }
        setLoading(false);
    };

    // Permission Check
    const canRecordPayment = ['DIRECTOR', 'ACCOUNTANT', 'ADMIN'].includes(userProfile?.role);
    const isDirector = userProfile?.role === 'DIRECTOR';

    // EDIT & DELETE INDIVIDUAL TRANSACTIONS (Director Only)

    // Loads the latest payments for this admission inside a transaction and
    // checks that entry `idx` is still the one shown on screen, so an edit or
    // delete never lands on the wrong transaction after someone else changed
    // the list.
    const loadFreshPayments = async (tx, studentRef, idx) => {
        const snap = await tx.get(studentRef);
        if (!snap.exists()) throw new Error("Admission record not found.");
        const fresh = snap.data();
        const freshPayments = [...(fresh.payments || [])];
        const shown = (student.payments || [])[idx];
        const current = freshPayments[idx];
        const sameEntry = shown && current
            && Number(shown.amount) === Number(current.amount)
            && (shown.date?.seconds ?? null) === (current.date?.seconds ?? null);
        if (!sameEntry) {
            throw new Error("This payment list was changed by someone else. Close and reopen the student, then try again.");
        }
        return { fresh, freshPayments };
    };

    const openProof = async (pay) => {
        try {
            const url = await proofUrlFor(pay, student);
            if (!url) return;
            const isPdf = /\.pdf($|\?)|application%2Fpdf|^data:application\/pdf/i.test(url) || pay?.proofType === 'application/pdf';
            setProofView({ url, isPdf });
        } catch (err) {
            console.error(err);
            alert("Could not open the proof: " + err.message);
        }
    };

    // Attach a proof to a payment already recorded (Director / Accounts).
    const handleAttachProof = async (idx, file) => {
        if (!file) return;
        const problem = checkProofFile(file);
        if (problem) { alert(problem); return; }
        setAttachingIdx(idx);
        try {
            const shown = (student.payments || [])[idx];
            const paymentId = shown?.id || newPaymentId();
            const proofPath = await uploadProof(student.id, paymentId, file);
            const studentRef = doc(db, "admissions", student.id);
            await runTransaction(db, async (tx) => {
                const { freshPayments } = await loadFreshPayments(tx, studentRef, idx);
                freshPayments[idx] = { ...freshPayments[idx], id: paymentId, proofPath, proofType: file.type };
                tx.update(studentRef, { payments: freshPayments });
            });
            clearAdmissionsCache();
            alert("Proof attached.");
            if (refreshData) refreshData();
        } catch (err) {
            console.error(err);
            alert("Could not attach the proof: " + err.message);
        }
        setAttachingIdx(null);
    };

    const recomputeTotals = (fresh, originalPayments, currentPayments) => {
        const newPaymentsSum = currentPayments.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        const originalAllPaymentsSum = originalPayments.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        const legacyInitial = Math.max(0, (Number(fresh.totalPaid) || 0) - originalAllPaymentsSum);
        const newTotalPaid = legacyInitial + newPaymentsSum;
        const newRefundAmount = currentPayments.reduce((acc, curr) => acc + (Number(curr.amount || 0) < 0 ? Math.abs(Number(curr.amount)) : 0), 0);
        return {
            payments: currentPayments,
            totalPaid: newTotalPaid,
            refundAmount: newRefundAmount,
            status: newTotalPaid <= 0 ? 'REFUNDED' : (fresh.status === 'REFUNDED' ? 'ACTIVE' : fresh.status)
        };
    };
    const handleDeletePayment = async (idx) => {
        const payItem = student.payments[idx];
        const confirmed = window.confirm(
            `⚠️ DELETE TRANSACTION\n\nType: ${payItem.type || 'Installment'}\nAmount: ₹${Math.abs(payItem.amount).toLocaleString()}\nDate: ${payItem.date?.seconds ? new Date(payItem.date.seconds * 1000).toLocaleDateString('en-IN') : 'Recent'}\n\nAre you absolutely sure you want to delete this payment transaction? This will update the total paid amount.`
        );
        if (!confirmed) return;

        setLoading(true);
        try {
            const studentRef = doc(db, "admissions", student.id);
            const updatePayload = await runTransaction(db, async (tx) => {
                const { fresh, freshPayments } = await loadFreshPayments(tx, studentRef, idx);
                const currentPayments = [...freshPayments];
                currentPayments.splice(idx, 1);
                const payload = recomputeTotals(fresh, freshPayments, currentPayments);
                tx.update(studentRef, payload);
                return payload;
            });
            const newRefundAmount = updatePayload.refundAmount;
            clearAdmissionsCache();

            // SYNC TO CRM TIMELINE
            const leadPayload = {
                timeline: arrayUnion({
                    type: "PAYMENT_DELETED",
                    result: "Transaction Deleted",
                    note: `Deleted transaction: ₹${Math.abs(payItem.amount).toLocaleString()} (${payItem.mode || 'N/A'}). Action by Director.`,
                    date: new Date(),
                    by: userProfile?.name || "Team"
                }),
                status: updatePayload.status === 'REFUNDED' || newRefundAmount > 0 ? 'REFUNDED' : 'CONVERTED'
            };
            await syncLeadTimeline(leadPayload);

            alert("Transaction deleted successfully!");
            if (refreshData) refreshData();
            onClose();
        } catch (error) {
            console.error(error);
            alert("Error deleting transaction: " + error.message);
        }
        setLoading(false);
    };

    const handleEditPayment = async (idx) => {
        if (!editPayAmt) return;
        setLoading(true);
        try {
            const studentRef = doc(db, "admissions", student.id);
            const originalPayItem = (student.payments || [])[idx];
            const newAmountVal = Number(editPayAmt);
            const isRefund = editPayType === 'REFUND';
            
            const updatedPayItem = {
                ...originalPayItem,
                amount: isRefund ? -Math.abs(newAmountVal) : Math.abs(newAmountVal),
                mode: editPayMode,
                type: editPayType,
                ...(isRefund && editPayRemarks ? { remarks: editPayRemarks } : {})
            };
            
            if (!isRefund && updatedPayItem.remarks) {
                delete updatedPayItem.remarks;
            }

            const updatePayload = await runTransaction(db, async (tx) => {
                const { fresh, freshPayments } = await loadFreshPayments(tx, studentRef, idx);
                const currentPayments = [...freshPayments];
                currentPayments[idx] = updatedPayItem;
                const payload = recomputeTotals(fresh, freshPayments, currentPayments);
                tx.update(studentRef, payload);
                return payload;
            });
            const newRefundAmount = updatePayload.refundAmount;
            clearAdmissionsCache();

            // SYNC TO CRM TIMELINE
            const leadPayload = {
                timeline: arrayUnion({
                    type: "PAYMENT_EDITED",
                    result: "Transaction Edited",
                    note: `Edited transaction: Original ₹${Math.abs(originalPayItem.amount).toLocaleString()} -> New ₹${Math.abs(updatedPayItem.amount).toLocaleString()} (${editPayMode}). Action by Director.`,
                    date: new Date(),
                    by: userProfile?.name || "Team"
                }),
                status: updatePayload.status === 'REFUNDED' || newRefundAmount > 0 ? 'REFUNDED' : 'CONVERTED'
            };
            await syncLeadTimeline(leadPayload);

            alert("Transaction edited successfully!");
            setEditingPayIdx(null);
            if (refreshData) refreshData();
            onClose();
        } catch (error) {
            console.error(error);
            alert("Error editing transaction: " + error.message);
        }
        setLoading(false);
    };

    // DELETE ADMISSION (Director/Accountant Only)
    const handleDeleteAdmission = async () => {
        const confirmed = window.confirm(
            `⚠️ DELETE ADMISSION\n\nStudent: ${student.studentName}\nAmount: ₹${student.amount?.toLocaleString()}\n\nThis will PERMANENTLY delete this record. Are you absolutely sure?`
        );
        if (!confirmed) return;
        const doubleConfirm = window.confirm(`FINAL CONFIRMATION: Delete admission for "${student.studentName}"?`);
        if (!doubleConfirm) return;

        try {
            if (student.leadId) {
                if (window.confirm(`Do you ALSO want to permanently delete the associated CRM Lead Record?\n\n- Click OK to delete the Lead completely.\n- Click Cancel to keep the lead but revert its status to 'FOLLOW_UP'.`)) {
                    await deleteDoc(doc(db, 'leads', student.leadId));
                } else {
                    await updateDoc(doc(db, 'leads', student.leadId), {
                        status: 'FOLLOW_UP',
                        admissionId: null,
                        updatedAt: new Date()
                    });
                }
            }

            await deleteDoc(doc(db, 'admissions', student.id));
            clearAdmissionsCache();
            alert('Admission deleted successfully.');
            onClose();
            if (refreshData) refreshData();
        } catch (err) {
            console.error(err);
            alert('Error deleting admission: ' + err.message);
        }
    };

    // EDIT TOTAL FEE (Director Only)
    const handleUpdateFee = async () => {
        const newFee = Number(editFee);
        if (!newFee) return;
        const isSameFee = newFee === student.amount;
        const confirmMsg = isSameFee
            ? `Re-sync loan fields for ₹${newFee.toLocaleString()} fee?\n\nThis will recalculate Down Payment & Loan Amount so the student appears in Loan Verification.`
            : `Update total fee from ₹${student.amount?.toLocaleString()} to ₹${newFee.toLocaleString()}?\n\nThis will also recalculate loan fields if applicable.`;
        if (!window.confirm(confirmMsg)) return;

        setEditFeeLoading(true);
        try {
            const updateData = { amount: newFee };

            if (student.paymentPlan === 'LOAN') {
                const newDownPayment = Math.round(newFee * 0.25);
                const newLoanAmount = newFee - newDownPayment;
                updateData.downPayment = newDownPayment;
                updateData.loanAmount = newLoanAmount;
            }

            await updateDoc(doc(db, 'admissions', student.id), updateData);
            clearAdmissionsCache();

            // Sync to CRM Lead Timeline
            await syncLeadTimeline({
                timeline: arrayUnion({
                    type: "FEE_UPDATE",
                    result: "Fee Updated",
                    note: `Total Fee corrected from ₹${student.amount?.toLocaleString()} to ₹${newFee.toLocaleString()}`,
                    date: new Date(),
                    by: userProfile?.name || "Team"
                })
            });

            alert('Total fee updated successfully!' + (student.paymentPlan === 'LOAN' ? '\n\nDown Payment & Loan Amount recalculated automatically.' : ''));
            onClose();
            if (refreshData) refreshData();
        } catch (err) {
            console.error(err);
            alert('Error updating fee: ' + err.message);
        }
        setEditFeeLoading(false);
    };

    // TRANSFER ACADEMIC CENTER (Director Only)
    const handleTransferCenter = async () => {
        if (!editCenter || editCenter === student.centerId) return;
        const targetCenterName = CENTERS[editCenter]?.name || editCenter;
        
        if (!window.confirm(`Transfer student to ${targetCenterName}?\n\nTheir roll number stays the same. They will be removed from their current batch and moved to the target center.`)) return;
        
        setTransferLoading(true);
        try {
            // 1. Move the admission. The roll number stays the same: it is the
            //    student's KAP Connect enrollment number, so it never changes.
            await updateDoc(doc(db, 'admissions', student.id), {
                centerId: editCenter,
                centerName: targetCenterName,
                batchAssigned: null,
                batchId: null,
                batchName: null
            });

            // 3. Update Lead Document
            await syncLeadTimeline({
                centerId: editCenter,
                batchAssigned: null,
                timeline: arrayUnion({
                    type: "CENTER_TRANSFER",
                    result: "Center Transferred",
                    note: `Student transferred to ${targetCenterName}. Roll No unchanged: ${student.rollNumber || 'not assigned'}. Batch unassigned.`,
                    date: new Date(),
                    by: userProfile?.name || "Team"
                })
            });

            clearAdmissionsCache();
            alert(`Student successfully transferred to ${targetCenterName}!\nRoll number unchanged.\nBatch has been cleared.`);
            if (refreshData) refreshData();
            onClose(); 
        } catch (err) {
            console.error(err);
            alert('Error transferring center: ' + err.message);
        }
        setTransferLoading(false);
    };

    // UPDATE COURSE/STANDARD (Director Only)
    const handleUpdateCourse = async () => {
        if (!editCourse || editCourse === student.standard) return;
        if (!window.confirm(`Change course from "${student.standard || student.program}" to "${editCourse}"?`)) return;
        setCourseLoading(true);
        try {
            await updateDoc(doc(db, 'admissions', student.id), { standard: editCourse });
            clearAdmissionsCache();

            // Sync to CRM Lead Timeline
            await syncLeadTimeline({
                timeline: arrayUnion({
                    type: "COURSE_UPDATE",
                    result: "Course Updated",
                    note: `Course changed from "${student.standard || student.program}" to "${editCourse}"`,
                    date: new Date(),
                    by: userProfile?.name || "Team"
                })
            });

            // Mutate local object so UI updates immediately if modal stays open
            student.standard = editCourse; 
            alert('Course updated successfully! Batch options will now match this course.');
            if (refreshData) refreshData();
            // Don't auto-close so they can immediately assign the batch
            // onClose(); 
        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        }
        setCourseLoading(false);
    };

    // UPDATE PAYMENT PLAN (Director Only)
    const handleUpdatePaymentPlan = async () => {
        if (!editPaymentPlan || editPaymentPlan === (student.paymentPlan || 'INSTALLMENT')) return;
        if (!window.confirm(`Change Payment Plan from "${student.paymentPlan || 'INSTALLMENT'}" to "${editPaymentPlan}"?\n\nIf changing to LOAN, default downpayment (25%) will be calculated.`)) return;
        setPlanLoading(true);
        try {
            let updateData = { paymentPlan: editPaymentPlan };
            
            if (editPaymentPlan === 'LOAN') {
                updateData.downPayment = (student.amount || 0) * 0.25;
                updateData.loanAmount = (student.amount || 0) * 0.75;
            } else {
                updateData.downPayment = null;
                updateData.loanAmount = null;
                updateData.loanDisbursed = null;
            }

            await updateDoc(doc(db, 'admissions', student.id), updateData);
            clearAdmissionsCache();

            // Sync to CRM Lead Timeline
            await syncLeadTimeline({
                timeline: arrayUnion({
                    type: "PLAN_UPDATE",
                    result: "Payment Plan Updated",
                    note: `Payment Plan changed to ${editPaymentPlan}.`,
                    date: new Date(),
                    by: userProfile?.name || "Team"
                })
            });

            student.paymentPlan = editPaymentPlan; // mutate locally
            alert(`Payment Plan successfully updated to ${editPaymentPlan}!`);
            if (refreshData) refreshData();
            // onClose();
        } catch (err) {
            console.error(err);
            alert('Error updating payment plan: ' + err.message);
        }
        setPlanLoading(false);
    };


    const handleGenerateReceipt = (pay, idx) => downloadOfficialReceipt(student, idx, feeStructures);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 font-sans">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* 1. PREMIUM HEADER */}
                <div className="g4-hero !border-0 !border-b-[3px] !rounded-none text-white p-6 flex justify-between items-start shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-xl font-bold shadow-lg ring-2 ring-indigo-400">
                            {student.studentName.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">{student.studentName}</h2>
                            <div className="flex flex-wrap items-center gap-4 text-slate-300 text-sm mt-2">
                                <span className="bg-slate-800 px-2 py-0.5 rounded text-xs font-mono uppercase tracking-wide border border-slate-700">{student.category || 'GEN'}</span>
                                <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> {student.standard || student.program}</span>
                                {recoveredCourse && (
                                    <span className="flex items-center gap-1 text-cyan-300 font-bold bg-cyan-900/40 px-2 py-0.5 rounded border border-cyan-700/50">
                                        <School className="w-3 h-3" /> Lead Course: {recoveredCourse}
                                    </span>
                                )}
                                <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> +91 {student.phone}</span>
                                <span className="flex items-center gap-1 text-orange-300 font-bold"><User className="w-3 h-3" /> Counsellor: {counsellorName}</span>
                                {student.proofImage && (
                                    <button
                                        onClick={() => setShowProof(true)}
                                        className="flex items-center gap-1 text-emerald-300 font-bold hover:text-emerald-100 hover:underline cursor-pointer bg-slate-800/50 px-2 py-0.5 rounded border border-slate-600"
                                        title="View Admission Token Proof"
                                    >
                                        <FileText className="w-3 h-3" /> View Proof
                                    </button>
                                )}
                            </div>

                            {/* BATCH ASSIGNMENT CONTROL */}
                            <div className="flex items-center gap-2 mt-3">
                                <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
                                    <Briefcase className="w-3 h-3 ml-2 mr-1 text-slate-400" />
                                    <input
                                        type="text"
                                        list="batchOptions"
                                        placeholder="Assign Batch..."
                                        className="bg-transparent text-xs text-white placeholder-slate-500 border-none focus:ring-0 w-32"
                                        value={batchAssigned}
                                        onChange={(e) => setBatchAssigned(e.target.value)}
                                    />
                                    <datalist id="batchOptions">
                                        {batchList.map((b, i) => (
                                            <option key={i} value={b} />
                                        ))}
                                    </datalist>
                                </div>
                                {batchAssigned !== student.batchAssigned && (
                                    <button
                                        onClick={handleUpdateBatch}
                                        disabled={savingBatch}
                                        className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                                    >
                                        {savingBatch ? '...' : <><CheckCircle className="w-3 h-3" /> Save</>}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 2. DASHBOARD BODY */}
                <div className="p-6 overflow-y-auto custom-scrollbar grow bg-slate-50/15">
                    <div className={`grid grid-cols-1 ${canRecordPayment ? 'lg:grid-cols-12' : 'grid-cols-1'} gap-6`}>
                        
                        {/* Left Column: Stats, Timeline, History */}
                        <div className={canRecordPayment ? 'lg:col-span-7 space-y-6 flex flex-col' : 'col-span-1 space-y-6 flex flex-col'}>
                            
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Fee</p>
                                    <p className="text-xl font-black text-slate-800">₹{student.amount?.toLocaleString()}</p>
                                </div>
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">
                                        {student.refundAmount > 0 ? "Net Paid" : "Total Paid"}
                                    </p>
                                    <p className="text-xl font-black text-emerald-700">₹{totalPaid.toLocaleString()}</p>
                                </div>
                                {student.refundAmount > 0 && (
                                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                                        <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-0.5">Refunded</p>
                                        <p className="text-xl font-black text-rose-700">₹{student.refundAmount.toLocaleString()}</p>
                                    </div>
                                )}
                                <div className={`p-4 rounded-xl border ${balanceDue > 0 ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${balanceDue > 0 ? 'text-orange-600' : 'text-slate-400'}`}>Balance Due</p>
                                    <p className={`text-xl font-black ${balanceDue > 0 ? 'text-orange-700' : 'text-slate-400'}`}>₹{balanceDue > 0 ? balanceDue.toLocaleString() : '0'}</p>
                                </div>
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 relative overflow-hidden">
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5">Next Due</p>
                                    {(() => {
                                        const nextInst = displaySchedule.find(i => !i.paid && new Date(i.date) > new Date());
                                        return nextInst ? (
                                            <>
                                                <p className="text-base font-bold text-indigo-900">{new Date(nextInst.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                                                <p className="text-[10px] text-indigo-600 font-medium">₹{nextInst.amount?.toLocaleString()}</p>
                                            </>
                                        ) : (
                                            <p className="text-base font-bold text-slate-400">None</p>
                                        );
                                    })()}
                                    <Calendar className="absolute -bottom-2 -right-2 w-10 h-10 text-indigo-200 opacity-30" />
                                </div>
                            </div>

                            {/* Timeline & History stacked (or side by side if full-width) */}
                            <div className={`grid grid-cols-1 ${!canRecordPayment ? 'md:grid-cols-2' : 'grid-cols-1'} gap-6`}>
                                {/* Timeline */}
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                        <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Installment Timeline
                                    </h3>
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {displaySchedule.length === 0 ? (
                                            <div className="p-6 text-center bg-slate-50">
                                                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-1.5 opacity-50" />
                                                <p className="text-slate-500 font-medium text-xs">Full Payment Received</p>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-100"></div>
                                                {displaySchedule.map((inst, i) => {
                                                    const isPast = new Date(inst.date) < new Date();
                                                    const isPaid = inst.paid;
                                                    let statusColor = "bg-slate-200 text-slate-500";
                                                    if (isPaid) statusColor = "bg-emerald-500 text-white ring-4 ring-emerald-100";
                                                    else if (isPast && !isPaid) statusColor = "bg-red-500 text-white ring-4 ring-red-100";
                                                    else statusColor = "bg-indigo-500 text-white ring-4 ring-indigo-100";

                                                    return (
                                                        <div key={i} className="relative pl-14 p-3 hover:bg-slate-50 transition border-b border-slate-50 last:border-0 group">
                                                            <div className={`absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full ${statusColor} z-10 flex items-center justify-center`}></div>
                                                            <div className="flex justify-between items-center">
                                                                <div>
                                                                    <p className={`text-xs font-bold ${isPaid ? 'text-emerald-700 line-through opacity-70' : 'text-slate-800'}`}>
                                                                        {inst.name} {inst.isEstimate && <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded ml-1 font-normal">Est</span>}
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Due: {inst.label || new Date(inst.date).toLocaleDateString('en-IN')}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className={`text-xs font-bold ${isPaid ? 'text-emerald-600' : 'text-slate-800'}`}>₹{inst.amount?.toLocaleString()}</p>
                                                                    {isPast && !isPaid && <span className="text-[9px] text-red-600 font-bold uppercase">Overdue</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* History */}
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Transaction History
                                    </h3>
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {(!student.payments || student.payments.length === 0) && totalPaid > 0 && (
                                            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700 uppercase">Initial Payment</p>
                                                    <p className="text-[9px] text-slate-400">Legacy Record</p>
                                                </div>
                                                <p className="text-xs font-bold text-emerald-600">₹{totalPaid.toLocaleString()}</p>
                                            </div>
                                        )}
                                        {student.payments?.map((pay, idx) => {
                                            const isEditing = editingPayIdx === idx;
                                            return isEditing ? (
                                                <div key={idx} className="p-3 border-b border-slate-200 bg-slate-50 space-y-2.5">
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div>
                                                            <label className="text-[9px] font-bold text-slate-500 uppercase">Amount</label>
                                                            <input
                                                                type="number"
                                                                className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-bold"
                                                                value={editPayAmt}
                                                                onChange={(e) => setEditPayAmt(e.target.value)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-bold text-slate-500 uppercase">Mode</label>
                                                            <select
                                                                className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-bold"
                                                                value={editPayMode}
                                                                onChange={(e) => setEditPayMode(e.target.value)}
                                                            >
                                                                <option>KAP Online (RTGS/NEFT)</option>
                                                                <option>Cash</option>
                                                                <option>Cheque</option>
                                                                <option>KAP QR (AXIS)</option>
                                                                <option>Ujjivan QR</option>
                                                                <option>POS - SHS</option>
                                                                <option>SHS Online (RTGS/NEFT)</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-bold text-slate-500 uppercase">Type</label>
                                                            <select
                                                                className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-bold"
                                                                value={editPayType}
                                                                onChange={(e) => setEditPayType(e.target.value)}
                                                            >
                                                                <option value="Installment/Balance">Installment/Balance</option>
                                                                <option value="Token/Booking">Token/Booking</option>
                                                                <option value="REFUND">REFUND</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    {editPayType === 'REFUND' && (
                                                        <div>
                                                            <label className="text-[9px] font-bold text-slate-500 uppercase">Reason for refund</label>
                                                            <input
                                                                type="text"
                                                                className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-medium"
                                                                value={editPayRemarks}
                                                                onChange={(e) => setEditPayRemarks(e.target.value)}
                                                                placeholder="Withdrawal reason..."
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => setEditingPayIdx(null)}
                                                            className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded font-bold transition"
                                                            disabled={loading}
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditPayment(idx)}
                                                            className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold transition"
                                                            disabled={loading}
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div key={idx} className="p-3 border-b border-slate-100 hover:bg-slate-50 transition flex justify-between items-center group">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${pay.amount < 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-700">{pay.type || "Installment"}</p>
                                                            <p className="text-[9px] text-slate-400 font-medium">
                                                                {pay.date?.seconds ? new Date(pay.date.seconds * 1000).toLocaleDateString('en-IN') : 'Recent'} • {pay.mode}
                                                                {pay.remarks && ` • Remarks: ${pay.remarks}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-xs font-bold mr-1 ${pay.amount < 0 ? 'text-rose-650' : 'text-emerald-750'}`}>
                                                            {pay.amount < 0 ? `-₹${Math.abs(pay.amount).toLocaleString()}` : `₹${pay.amount.toLocaleString()}`}
                                                        </p>
                                                        {hasProof(pay, student) ? (
                                                            <button
                                                                onClick={() => openProof(pay)}
                                                                className="p-1 hover:bg-emerald-100 rounded text-emerald-600 transition"
                                                                title="View payment proof"
                                                                aria-label="View payment proof"
                                                            >
                                                                <ImageIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        ) : canRecordPayment && (
                                                            <label
                                                                className="p-1 hover:bg-amber-100 rounded text-amber-500 hover:text-amber-700 transition cursor-pointer"
                                                                title="Attach payment proof"
                                                            >
                                                                {attachingIdx === idx ? <span className="text-[9px] font-bold">...</span> : <Paperclip className="w-3.5 h-3.5" />}
                                                                <input
                                                                    type="file"
                                                                    accept={PROOF_ACCEPT}
                                                                    className="sr-only"
                                                                    aria-label="Attach payment proof"
                                                                    disabled={attachingIdx !== null}
                                                                    onChange={(e) => { handleAttachProof(idx, e.target.files?.[0]); e.target.value = ''; }}
                                                                />
                                                            </label>
                                                        )}
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    await handleGenerateReceipt(pay, idx);
                                                                    if (student.email) {
                                                                        const subject = encodeURIComponent(`Fee Receipt - ${student.studentName}`);
                                                                        const body = encodeURIComponent(`Dear ${student.studentName},\n\nPlease find attached the fee receipt for your recent payment of Rs. ${Number(Math.abs(pay.amount)).toLocaleString()}.\n\nRegards,\nAccounts Team\nUnacademy Nashik`);
                                                                        window.location.href = `mailto:${student.email}?subject=${subject}&body=${body}`;
                                                                        setTimeout(() => alert("Receipt downloaded!\n\nEmail client opened. Please ATTACH the downloaded PDF file to the email before sending."), 1000);
                                                                    } else {
                                                                        alert("Receipt downloaded! (Student has no email address on file)");
                                                                    }
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    alert("Error: " + err.message);
                                                                }
                                                            }}
                                                            className="p-1 hover:bg-blue-100 rounded text-slate-400 hover:text-blue-600 transition"
                                                            title="Email Receipt (Download & Attach)"
                                                        >
                                                            <Mail className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    await handleGenerateReceipt(pay, idx);
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    alert("Error generating receipt: " + err.message);
                                                                }
                                                            }}
                                                            className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-indigo-600 transition"
                                                            title="Reprint Receipt"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                        </button>
                                                        {isDirector && (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditPayAmt(String(Math.abs(pay.amount)));
                                                                        setEditPayMode(pay.mode || 'Cash');
                                                                        setEditPayType(pay.type || 'Installment/Balance');
                                                                        setEditPayRemarks(pay.remarks || '');
                                                                        setEditingPayIdx(idx);
                                                                    }}
                                                                    className="p-1 hover:bg-amber-100 rounded text-slate-400 hover:text-amber-600 transition"
                                                                    title="Edit Transaction"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeletePayment(idx)}
                                                                    className="p-1 hover:bg-rose-100 rounded text-slate-400 hover:text-rose-600 transition"
                                                                    title="Delete Transaction"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {totalPaid === 0 && (!student.payments || student.payments.length === 0) && (
                                            <div className="p-6 text-center text-slate-400 text-xs">No transaction history.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Collect/Refund Form and Director Controls */}
                        {canRecordPayment && (
                            <div className="lg:col-span-5 space-y-6 flex flex-col">
                                {/* Record Payment/Refund Card */}
                                <div className={`p-5 rounded-xl border transition-all duration-300 ${
                                    transactionType === 'REFUND'
                                        ? 'bg-rose-50/50 border-rose-200/80 shadow-sm'
                                        : 'bg-white border-slate-200 shadow-sm'
                                }`}>
                                    <div className="flex items-center justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md transition-all duration-300 ${
                                                transactionType === 'REFUND' 
                                                    ? 'bg-rose-600 shadow-rose-200/50 scale-105' 
                                                    : 'bg-slate-900 shadow-slate-200/30'
                                            }`}>
                                                <CreditCard className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className={`font-black text-xs tracking-tight transition-colors duration-300 ${
                                                    transactionType === 'REFUND' ? 'text-rose-700' : 'text-slate-800'
                                                }`}>
                                                    {transactionType === 'REFUND' ? "Issue Refund" : "Record Payment"}
                                                </h4>
                                                <p className="text-[10px] text-slate-500 font-medium">
                                                    {transactionType === 'REFUND' ? "Deducts paid fee." : "Generates tax receipt."}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Pill Switcher */}
                                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setTransactionType('PAYMENT')}
                                                className={`px-2 py-1 rounded-md text-[10px] font-black tracking-wide transition-all duration-250 ${
                                                    transactionType === 'PAYMENT'
                                                        ? 'bg-white text-indigo-600 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                            >
                                                Payment
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTransactionType('REFUND');
                                                    setPaymentMode('Cash');
                                                }}
                                                className={`px-2 py-1 rounded-md text-[10px] font-black tracking-wide transition-all duration-250 ${
                                                    transactionType === 'REFUND'
                                                        ? 'bg-rose-600 text-white shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                            >
                                                Refund
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {/* Amount */}
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Amount</label>
                                            <div className="relative">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                                                <input
                                                    type="number"
                                                    placeholder="0.00"
                                                    className={`pl-6 pr-3 py-1.5 w-full bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 transition-all ${
                                                        transactionType === 'REFUND' 
                                                            ? 'focus:ring-rose-500 focus:border-rose-400 text-rose-700' 
                                                            : 'focus:ring-indigo-500 focus:border-indigo-400 text-slate-800'
                                                    }`}
                                                    value={payAmount}
                                                    onChange={(e) => setPayAmount(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Method */}
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Method</label>
                                            <select
                                                className={`pl-2.5 pr-8 py-1.5 w-full bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 transition-all cursor-pointer ${
                                                    transactionType === 'REFUND' 
                                                        ? 'focus:ring-rose-500 focus:border-rose-400 text-rose-700' 
                                                        : 'focus:ring-indigo-500 focus:border-indigo-400 text-slate-800'
                                                }`}
                                                value={paymentMode}
                                                onChange={(e) => setPaymentMode(e.target.value)}
                                            >
                                                <option>KAP Online (RTGS/NEFT)</option>
                                                <option>Cash</option>
                                                <option>Cheque</option>
                                                <option>KAP QR (AXIS)</option>
                                                <option>Ujjivan QR</option>
                                                <option>POS - SHS</option>
                                                <option>SHS Online (RTGS/NEFT)</option>
                                            </select>
                                        </div>

                                        {/* Proof (optional): screenshot, cheque photo or PDF, up to 5 MB */}
                                        <div className="flex flex-col gap-1">
                                            <label htmlFor="pay-proof" className="text-[9px] font-black uppercase tracking-wider text-slate-400">Payment proof</label>
                                            <input
                                                id="pay-proof"
                                                type="file"
                                                accept={PROOF_ACCEPT}
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0] || null;
                                                    const problem = checkProofFile(f);
                                                    if (problem) { alert(problem); e.target.value = ''; setProofFile(null); return; }
                                                    setProofFile(f);
                                                }}
                                                className="text-[10px] text-slate-500 file:mr-2 file:px-2 file:py-1 file:rounded-md file:border-0 file:bg-slate-100 file:text-slate-700 file:font-bold"
                                            />
                                        </div>

                                        {/* Reason (Refund only) */}
                                        {transactionType === 'REFUND' && (
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Reason for refund</label>
                                                <input
                                                    type="text"
                                                    placeholder="Withdrawal reason..."
                                                    className="px-2.5 py-1.5 w-full bg-white border border-rose-200/80 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-400 text-rose-700 placeholder-rose-300"
                                                    value={refundRemarks}
                                                    onChange={(e) => setRefundRemarks(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-col gap-3">
                                        <div className="flex-1">
                                            {transactionType === 'REFUND' ? (
                                                <div className="text-[9px] font-bold text-rose-600/90 flex items-center gap-1">
                                                    <span className="px-1 py-0.5 rounded bg-rose-100 text-rose-700 uppercase font-black tracking-wide text-[7px]">Warning</span>
                                                    Deducts Net Paid and logs on CRM.
                                                </div>
                                            ) : (
                                                <div className="text-[9px] font-bold text-slate-400/90 flex items-center gap-1">
                                                    <span className="px-1 py-0.5 rounded bg-slate-100 text-slate-500 uppercase font-black tracking-wide text-[7px]">Notice</span>
                                                    Receipt auto-generated in history.
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={handleAddPayment}
                                            disabled={!payAmount || loading}
                                            className={`w-full px-4 py-2 rounded-lg text-xs font-black transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 active:scale-95 ${
                                                transactionType === 'REFUND'
                                                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200/50'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200/50'
                                            }`}
                                        >
                                            {loading ? "..." : (transactionType === 'REFUND' ? "Confirm Refund" : <>Receive Payment <Printer className="w-3 h-3" /></>)}
                                        </button>
                                    </div>
                                </div>

                                {/* Director Controls */}
                                {isDirector && (
                                    <div className="bg-red-50/50 border border-red-200 rounded-xl p-5 shadow-sm space-y-4">
                                        <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5 text-red-650" /> Director Settings
                                        </p>
                                        
                                        <div className="space-y-3">
                                            {/* Fix Course */}
                                            <div className="flex flex-col gap-1 bg-white border border-red-100 rounded-xl p-3">
                                                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Fix Course Assignment</label>
                                                <div className="flex gap-2">
                                                    <select
                                                        className="flex-1 py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                                                        value={editCourse}
                                                        onChange={(e) => setEditCourse(e.target.value)}
                                                    >
                                                        <option value="">-- Select --</option>
                                                        <optgroup label="JEE (Engineering)">
                                                            <option value="11th JEE (2 Year)">11th JEE (2 Year)</option>
                                                            <option value="11th JEE (1 Year)">11th JEE (1 Year)</option>
                                                            <option value="12th JEE (1 Year)">12th JEE (1 Year)</option>
                                                            <option value="Repeater JEE (1 Year)">Repeater JEE (1 Year)</option>
                                                        </optgroup>
                                                        <optgroup label="NEET (Medical)">
                                                            <option value="11th NEET (2 Year)">11th NEET (2 Year)</option>
                                                            <option value="11th NEET (1 Year)">11th NEET (1 Year)</option>
                                                            <option value="12th NEET (1 Year)">12th NEET (1 Year)</option>
                                                            <option value="Repeater NEET (1 Year)">Repeater NEET (1 Year)</option>
                                                        </optgroup>
                                                        <optgroup label="MHT-CET">
                                                            <option value="MHT CET (1 Year)">MHT CET (1 Year)</option>
                                                            <option value="MHT CET (2 Year)">MHT CET (2 Year)</option>
                                                        </optgroup>
                                                        <optgroup label="Foundation">
                                                            <option value="Class 8 Foundation">Class 8 Foundation</option>
                                                            <option value="Class 9 Foundation">Class 9 Foundation</option>
                                                            <option value="Class 10 Foundation">Class 10 Foundation</option>
                                                            <option value="Foundation (2 Year)">Foundation (2 Year)</option>
                                                            <option value="Foundation (3 Year)">Foundation (3 Year)</option>
                                                        </optgroup>
                                                    </select>
                                                    <button
                                                        onClick={handleUpdateCourse}
                                                        disabled={courseLoading || editCourse === student.standard}
                                                        className="bg-blue-600 hover:bg-blue-705 text-white px-2.5 py-1 rounded-lg text-[10px] font-black transition disabled:opacity-40 whitespace-nowrap"
                                                    >
                                                        {courseLoading ? '...' : 'Fix'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Fix Payment Plan */}
                                            <div className="flex flex-col gap-1 bg-white border border-green-100 rounded-xl p-3">
                                                <label className="text-[9px] font-black uppercase tracking-wider text-green-500">Fix Payment Plan Type</label>
                                                <div className="flex gap-2">
                                                    <select
                                                        className="flex-1 py-1 px-2.5 bg-slate-50 border border-green-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-green-400 cursor-pointer"
                                                        value={editPaymentPlan}
                                                        onChange={(e) => setEditPaymentPlan(e.target.value)}
                                                    >
                                                        <option value="INSTALLMENT">Standard Installment</option>
                                                        <option value="LOAN">Education Loan (Finance)</option>
                                                    </select>
                                                    <button
                                                        onClick={handleUpdatePaymentPlan}
                                                        disabled={planLoading || editPaymentPlan === (student.paymentPlan || 'INSTALLMENT')}
                                                        className="bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-black transition disabled:opacity-40 whitespace-nowrap"
                                                    >
                                                        {planLoading ? '...' : 'Fix'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Transfer Center */}
                                            <div className="flex flex-col gap-1 bg-white border border-indigo-100 rounded-xl p-3">
                                                <label className="text-[9px] font-black uppercase tracking-wider text-indigo-400">Transfer Academic Center</label>
                                                <div className="flex gap-2">
                                                    <select
                                                        className="flex-1 py-1 px-2.5 bg-slate-50 border border-indigo-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                                                        value={editCenter}
                                                        onChange={(e) => setEditCenter(e.target.value)}
                                                    >
                                                        <option value="">-- Select Target Center --</option>
                                                        {Object.entries(CENTERS).map(([id, info]) => (
                                                            <option key={id} value={id}>{info.name}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={handleTransferCenter}
                                                        disabled={transferLoading || !editCenter || editCenter === student.centerId}
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-black transition disabled:opacity-40 whitespace-nowrap"
                                                    >
                                                        {transferLoading ? '...' : 'Transfer'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Correct Total Fee */}
                                            <div className="flex flex-col gap-1 bg-white border border-red-100 rounded-xl p-3">
                                                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Correct Total Fee Amount</label>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                                                        <input
                                                            type="number"
                                                            className="pl-5 pr-2.5 py-1 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-amber-400"
                                                            value={editFee}
                                                            onChange={(e) => setEditFee(e.target.value)}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={handleUpdateFee}
                                                        disabled={editFeeLoading || !editFee}
                                                        className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-black transition disabled:opacity-40"
                                                    >
                                                        {editFeeLoading ? '...' : 'Correct'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Delete Admission */}
                                            <div className="bg-red-100/30 border border-red-200 rounded-xl p-3 flex flex-col gap-1">
                                                <p className="text-[10px] text-red-750 font-bold">Delete Student Admission</p>
                                                <p className="text-[8px] text-red-500 leading-relaxed font-medium">
                                                    Permanently deletes this record from databases.
                                                </p>
                                                <button
                                                    onClick={handleDeleteAdmission}
                                                    className="mt-1 w-full flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white py-1.5 rounded-lg text-[10px] font-black transition shadow-sm"
                                                >
                                                    <X className="w-3 h-3" /> Delete Admission
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* INSTALMENT PROOF MODAL */}
            {proofView && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => setProofView(null)} role="dialog" aria-label="Payment proof">
                    <button className="absolute top-6 right-6 text-white/60 hover:text-white transition p-2 bg-white/10 rounded-full" aria-label="Close proof">
                        <X className="w-8 h-8" />
                    </button>
                    {proofView.isPdf ? (
                        <iframe title="Payment proof" src={proofView.url} className="w-full max-w-3xl h-[85vh] bg-white rounded-lg" onClick={(e) => e.stopPropagation()} />
                    ) : (
                        <img src={proofView.url} alt="Payment proof" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/20" onClick={(e) => e.stopPropagation()} />
                    )}
                    <a href={proofView.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/10 text-white px-4 py-2 rounded-full text-xs font-bold border border-white/20 hover:bg-white/20">
                        Open in new tab
                    </a>
                </div>
            )}

            {/* PROOF PREVIEW MODAL */}
            {showProof && student.proofImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex justify-center items-center p-4 animate-in fade-in duration-200" onClick={() => setShowProof(false)}>
                    <button className="absolute top-6 right-6 text-white/50 hover:text-white transition p-2 bg-white/10 rounded-full">
                        <X className="w-8 h-8" />
                    </button>
                    <img
                        src={student.proofImage}
                        alt="Payment Proof"
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/20"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-xs font-mono border border-white/10">
                        Press ESC or Click Outside to Close
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentManager;
