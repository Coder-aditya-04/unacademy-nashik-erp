import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, Timestamp, collection, query, getDocs, where, getDoc, limit, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { clearAdmissionsCache } from '../services/cacheService';
import { FileText, CheckCircle, Clock, Printer, CreditCard, X, Calendar, TrendingUp, AlertCircle, ArrowRight, Mail, User, Briefcase, School } from 'lucide-react';
import { CENTERS } from '../utils/centers';
import { generateTaxInvoice, generateTokenReceipt } from '../utils/pdfGenerator';
import { calculateRefunds } from '../utils/calculations';
import { PROGRAMS } from '../utils/feeData';
import { useFeeStructure } from '../hooks/useFeeStructure';

const StudentManager = ({ student, onClose, refreshData, userProfile }) => {
    const { feeStructures } = useFeeStructure();
    const [payAmount, setPayAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [transactionType, setTransactionType] = useState('PAYMENT'); // 'PAYMENT' or 'REFUND'
    const [refundRemarks, setRefundRemarks] = useState('');
    const [loading, setLoading] = useState(false);
    const [showProof, setShowProof] = useState(false); // Proof Modal State

    // Edit Fee State (Director only)
    const [editFee, setEditFee] = useState(String(student.amount || ''));
    const [editFeeLoading, setEditFeeLoading] = useState(false);

    // Course Correction State (Director only)
    const [editCourse, setEditCourse] = useState(student.standard || student.program || '');
    const [courseLoading, setCourseLoading] = useState(false);
    const [recoveredCourse, setRecoveredCourse] = useState('');

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

    const handleUpdateBatch = async () => {
        if (!batchAssigned) return;
        setSavingBatch(true);
        try {
            const docRef = doc(db, "admissions", student.id);
            await updateDoc(docRef, { batchAssigned: batchAssigned });
            clearAdmissionsCache();

            // Sync to CRM Lead Timeline
            if (student.leadId) {
                const leadRef = doc(db, "leads", student.leadId);
                await updateDoc(leadRef, {
                    batchAssigned: batchAssigned,
                    timeline: arrayUnion({
                        type: "BATCH_UPDATE",
                        result: "Batch Assigned",
                        note: `Batch assigned: ${batchAssigned}`,
                        date: new Date(),
                        by: userProfile.name
                    }),
                    lastUpdated: serverTimestamp()
                });
            }

            if (refreshData) refreshData();
            alert("Batch Updated Successfully!");
        } catch (error) {
            console.error(error);
            alert("Error updating batch");
        }
        setSavingBatch(false);
    };

    // Helper: WhatsApp Share
    const shareOnWhatsApp = (student, amount) => {
        const text = `*FEE RECEIPT - UNACADEMY NASHIK*\n\nDear ${student.studentName},\nWe have received a payment of *Rs. ${amount}*.\nTotal Paid: Rs. ${(student.totalPaid || 0) + Number(amount)}\nBalance Pending: Rs. ${(student.amount || 0) - ((student.totalPaid || 0) + Number(amount))}\n\nPlease collect the physical receipt from the office.\nRegards,\nKAP Edutech Accounts Team`;
        const url = `https://wa.me/91${student.phone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    // Helper: Estimate Schedule based on Program Type
    const getEstimatedSchedule = (total, paid, startDate, programName = "", paymentPlan = "") => {
        const balance = total - paid;
        if (balance <= 0) return [];

        // NEW: LOAN PLAN LOGIC
        if (paymentPlan === 'LOAN') {
            const downPayment = Math.round(total * 0.25);
            const loanAmount = total - downPayment;

            // Loan Waterfall
            const schedule = [];
            let remainingPaid = paid;

            // 1. Down Payment
            let dpDue = downPayment;
            if (remainingPaid >= dpDue) {
                remainingPaid -= dpDue;
                dpDue = 0; // Paid
            } else {
                dpDue -= remainingPaid;
                remainingPaid = 0;
            }

            if (dpDue > 0) {
                const dpDate = startDate ? new Date(startDate) : new Date();
                const dpLabel = startDate ? `Due by ${new Date(startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : "Immediate";

                schedule.push({
                    name: "Down Payment (25%)",
                    date: dpDate.toISOString(),
                    label: dpLabel,
                    amount: dpDue,
                    paid: false,
                    isEstimate: true
                });
            }

            // 2. Loan Amount
            let loanDue = loanAmount;
            if (remainingPaid >= loanDue) {
                loanDue = 0; // Everything paid
            } else {
                loanDue -= remainingPaid;
            }

            if (loanDue > 0) {
                schedule.push({ name: "Loan Disbursement (75%)", date: new Date().toISOString(), label: "Upon Approval", amount: loanDue, paid: false, isEstimate: true });
            }

            return schedule;
        }

        // Fetch Custom Config First
        let targetPercents = [];
        let monthOffsets = [];
        const lookupData = feeStructures || PROGRAMS || {};
        let customData = lookupData[programName];

        // Fallback robust search if key is exactly the course's display name instead of the ID key
        if (!customData && Object.keys(lookupData).length > 0) {
            const allSettings = Object.entries(lookupData).map(([k, v]) => ({ _idKey: k, ...v }));
            customData = allSettings.find(f => f.name === programName) ||
                         allSettings.find(f => (f.name || "").toUpperCase() === (programName || "").toUpperCase());
        }

        if (customData && customData.installmentPercents && customData.installmentPercents.length > 0) {
            targetPercents = customData.installmentPercents.map(p => Number(p) / 100);
            const intervals = customData.installmentIntervals || new Array(targetPercents.length).fill(3);
            let currentMonths = 0;
            monthOffsets = intervals.map(gap => {
                currentMonths += Number(gap);
                return currentMonths;
            });
        } else {
            // Check if 2-Year Program (e.g., 11th, 2Y)
            const pNameStr = (programName || "").toUpperCase();
            const isTwoYear = (pNameStr.includes("11TH") || pNameStr.includes("2Y") || pNameStr.includes("TWO") || pNameStr.includes("2 YEAR"));

            // Default Targets (1-Year): 60% - 40%
            targetPercents = [0.60, 0.40];
            monthOffsets = [0, 3]; // Months from start

            // Override for 2-Year: 50% - 25% - 25%
            if (isTwoYear) {
                targetPercents = [0.50, 0.25, 0.25];
                monthOffsets = [0, 3, 9]; // 0, 3 months, 9 months (6 months gap between 2nd & 3rd)
            }
        }

        // Calculate Target Amounts based on percentages
        let targets = targetPercents.map((p, i) => {
            if (i === targetPercents.length - 1) return 0; // Last one calculates remainder
            return Math.round(total * p);
        });
        // Set last target to ensure sum equals total (avoid rounding errors)
        const sumSoFar = targets.reduce((a, b) => a + b, 0);
        targets[targets.length - 1] = total - sumSoFar;

        const schedule = [];
        let remainingPaid = paid;

        targets.forEach((targetAmount, idx) => {
            // Determine Due Date
            const dueDate = new Date(startDate);
            dueDate.setMonth(dueDate.getMonth() + monthOffsets[idx]);

            // Waterfall Deduction
            let amountDue = targetAmount;
            if (remainingPaid >= amountDue) {
                remainingPaid -= amountDue;
                amountDue = 0; // Fully Paid
            } else {
                amountDue -= remainingPaid;
                remainingPaid = 0; // Partial or Full Due
            }

            if (amountDue > 0) {
                schedule.push({
                    name: `${idx + 1}${idx === 0 ? 'st' : idx === 1 ? 'nd' : 'rd'} Installment`,
                    date: dueDate.toISOString(),
                    amount: amountDue,
                    paid: false,
                    isEstimate: true
                });
            }
        });

        return schedule;
    };

    // Derived State
    const totalPaid = student.totalPaid || student.amount || 0;
    const balanceDue = student.status === 'REFUNDED' ? 0 : Math.max(0, (student.amount || 0) - totalPaid);
    const isFullyPaid = balanceDue <= 0;

    // Resolve Schedule: Use Real or Estimate
    let displaySchedule = student.paymentSchedule || [];
    if (displaySchedule.length === 0 && !isFullyPaid) {
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

            const newPayment = {
                amount: isRefund ? -amountVal : amountVal,
                date: Timestamp.now(),
                mode: paymentMode,
                type: isRefund ? "REFUND" : "Installment/Balance",
                ...(isRefund && { remarks: refundRemarks || "Refund processed by Accountant" })
            };

            const updatePayload = {
                payments: arrayUnion(newPayment),
            };

            if (isRefund) {
                updatePayload.refundAmount = (student.refundAmount || 0) + amountVal;
                updatePayload.totalPaid = totalPaid - amountVal;
                updatePayload.status = (totalPaid - amountVal) <= 0 ? 'REFUNDED' : student.status;
            } else {
                updatePayload.totalPaid = totalPaid + amountVal;
            }

            await updateDoc(studentRef, updatePayload);

            clearAdmissionsCache();

            // SYNC TO CRM TIMELINE
            if (student.leadId) {
                const leadRef = doc(db, "leads", student.leadId);
                const timelineEntry = {
                    type: isRefund ? "REFUND_ISSUED" : "PAYMENT",
                    result: isRefund ? "Refund Processed" : "Installment Received",
                    note: isRefund 
                        ? `Refund: ₹${amountVal.toLocaleString()} (${paymentMode}). Remarks: ${refundRemarks || 'N/A'}`
                        : `Amount: ₹${amountVal.toLocaleString()} (${paymentMode})`,
                    date: new Date(),
                    by: userProfile.name
                };

                await updateDoc(leadRef, {
                    timeline: arrayUnion(timelineEntry),
                    lastUpdated: serverTimestamp()
                });
            }

            alert(isRefund ? "Refund Recorded Successfully!" : "Payment Recorded Successfully!");
            setPayAmount('');
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
            if (student.leadId) {
                const leadRef = doc(db, 'leads', student.leadId);
                await updateDoc(leadRef, {
                    timeline: arrayUnion({
                        type: "FEE_UPDATE",
                        result: "Fee Updated",
                        note: `Total Fee corrected from ₹${student.amount?.toLocaleString()} to ₹${newFee.toLocaleString()}`,
                        date: new Date(),
                        by: userProfile.name
                    }),
                    lastUpdated: serverTimestamp()
                });
            }

            alert('Total fee updated successfully!' + (student.paymentPlan === 'LOAN' ? '\n\nDown Payment & Loan Amount recalculated automatically.' : ''));
            onClose();
            if (refreshData) refreshData();
        } catch (err) {
            console.error(err);
            alert('Error updating fee: ' + err.message);
        }
        setEditFeeLoading(false);
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
            if (student.leadId) {
                const leadRef = doc(db, 'leads', student.leadId);
                await updateDoc(leadRef, {
                    timeline: arrayUnion({
                        type: "COURSE_UPDATE",
                        result: "Course Updated",
                        note: `Course changed from "${student.standard || student.program}" to "${editCourse}"`,
                        date: new Date(),
                        by: userProfile.name
                    }),
                    lastUpdated: serverTimestamp()
                });
            }

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

    const handleGenerateReceipt = async (pay, idx) => {
        const center = CENTERS[student.centerId] || CENTERS["UN_COLLEGE"];
        
        const cumulativePaid = (student.payments || []).slice(0, idx + 1).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        const allPaymentsSum = (student.payments || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        const legacyInitial = Math.max(0, (student.totalPaid || 0) - allPaymentsSum);
        const historicalPaid = legacyInitial + cumulativePaid;

        const historicalStudent = { ...student, totalPaid: historicalPaid };
        const startDate = student.enrollmentDate ? new Date(student.enrollmentDate) : (student.createdAt?.seconds ? new Date(student.createdAt.seconds * 1000) : new Date());
        const historicalSchedule = getEstimatedSchedule(student.amount || 0, historicalPaid, startDate, student.program || student.standard, student.paymentPlan);

        await generateTaxInvoice(historicalStudent, {
            amount: pay.amount,
            mode: pay.mode || 'Cash',
            type: pay.type || 'Installment'
        }, center, historicalSchedule, calculateRefunds(student.amount, student.projectedFee || student.amount, student.programKey || student.program, PROGRAMS));
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 font-sans">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* 1. PREMIUM HEADER */}
                <div className="bg-slate-900 text-white p-6 flex justify-between items-start shrink-0">
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

                <div className="p-6 overflow-y-auto custom-scrollbar grow">

                    {/* 2. STATS GRID */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Fee</p>
                            <p className="text-2xl font-black text-slate-800">₹{student.amount?.toLocaleString()}</p>
                        </div>
                        <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100">
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
                                {student.refundAmount > 0 ? "Net Paid" : "Total Paid"}
                            </p>
                            <p className="text-2xl font-black text-emerald-700">₹{totalPaid.toLocaleString()}</p>
                        </div>
                        {student.refundAmount > 0 && (
                            <div className="bg-rose-50 p-5 rounded-xl border border-rose-100">
                                <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Refunded</p>
                                <p className="text-2xl font-black text-rose-700">₹{student.refundAmount.toLocaleString()}</p>
                            </div>
                        )}
                        <div className={`p-5 rounded-xl border ${balanceDue > 0 ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${balanceDue > 0 ? 'text-orange-600' : 'text-slate-400'}`}>Balance Due</p>
                            <p className={`text-2xl font-black ${balanceDue > 0 ? 'text-orange-700' : 'text-slate-400'}`}>₹{balanceDue > 0 ? balanceDue.toLocaleString() : '0'}</p>
                        </div>
                        <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 relative overflow-hidden col-span-2 md:col-span-1">
                            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Next Due</p>
                            {(() => {
                                const nextInst = displaySchedule.find(i => !i.paid && new Date(i.date) > new Date());
                                return nextInst ? (
                                    <>
                                        <p className="text-xl font-bold text-indigo-900">{new Date(nextInst.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                                        <p className="text-xs text-indigo-600 font-medium">₹{nextInst.amount?.toLocaleString()}</p>
                                    </>
                                ) : (
                                    <p className="text-lg font-bold text-slate-400">None</p>
                                );
                            })()}
                            {/* Decorative Icon */}
                            <Calendar className="absolute -bottom-2 -right-2 w-12 h-12 text-indigo-200 opacity-50" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* 3. TIMELINE VIEW (Future) */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-600" /> Installment Timeline
                            </h3>
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                                {displaySchedule.length === 0 ? (
                                    <div className="p-8 text-center bg-slate-50">
                                        <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-50" />
                                        <p className="text-slate-500 font-medium text-sm">Full Payment Received</p>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        {/* Vertical Line */}
                                        <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-100"></div>

                                        {displaySchedule.map((inst, i) => {
                                            const isPast = new Date(inst.date) < new Date();
                                            const isPaid = inst.paid;

                                            // Status Color
                                            let statusColor = "bg-slate-200 text-slate-500"; // Default
                                            if (isPaid) statusColor = "bg-emerald-500 text-white ring-4 ring-emerald-100";
                                            else if (isPast && !isPaid) statusColor = "bg-red-500 text-white ring-4 ring-red-100";
                                            else statusColor = "bg-indigo-500 text-white ring-4 ring-indigo-100";

                                            return (
                                                <div key={i} className="relative pl-14 p-4 hover:bg-slate-50 transition border-b border-slate-50 last:border-0 group">
                                                    {/* Timeline Dot */}
                                                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full ${statusColor} z-10 flex items-center justify-center`}></div>

                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <p className={`text-sm font-bold ${isPaid ? 'text-emerald-700 line-through opacity-70' : 'text-slate-800'}`}>
                                                                {inst.name} {inst.isEstimate && <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded ml-1 font-normal">Est</span>}
                                                            </p>
                                                            <p className="text-xs text-slate-400 font-medium mt-0.5">Due: {inst.label || new Date(inst.date).toLocaleDateString('en-IN')}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className={`font-bold ${isPaid ? 'text-emerald-600' : 'text-slate-800'}`}>₹{inst.amount?.toLocaleString()}</p>
                                                            {isPast && !isPaid && <span className="text-[10px] text-red-600 font-bold uppercase">Overdue</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 4. PAYMENT HISTORY (Past) */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-600" /> Transaction History
                            </h3>
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
                                {/* Synthetic "Token" Entry if History Missing */}
                                {(!student.payments || student.payments.length === 0) && totalPaid > 0 && (
                                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                        <div>
                                            <p className="text-xs font-bold text-slate-700 uppercase">Initial Payment</p>
                                            <p className="text-[10px] text-slate-400">Legacy Record</p>
                                        </div>
                                        <p className="font-bold text-emerald-600">₹{totalPaid.toLocaleString()}</p>
                                    </div>
                                )}

                                {student.payments?.map((pay, idx) => (
                                    <div key={idx} className="p-4 border-b border-slate-100 hover:bg-slate-50 transition flex justify-between items-center group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                                <CheckCircle className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-700">{pay.type || "Installment"}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">
                                                    {pay.date?.seconds ? new Date(pay.date.seconds * 1000).toLocaleDateString('en-IN') : 'Recent'} • {pay.mode}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <p className="font-bold text-emerald-700">₹{pay.amount.toLocaleString()}</p>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        // 1. Generate & Download the PDF
                                                        await handleGenerateReceipt(pay, idx);

                                                        // 2. Open Mail Client (mailto)
                                                        if (student.email) {
                                                            const subject = encodeURIComponent(`Fee Receipt - ${student.studentName}`);
                                                            const body = encodeURIComponent(`Dear ${student.studentName},\n\nPlease find attached the fee receipt for your recent payment of Rs. ${Number(pay.amount).toLocaleString()}.\n\nRegards,\nAccounts Team\nUnacademy Nashik`);
                                                            window.location.href = `mailto:${student.email}?subject=${subject}&body=${body}`;

                                                            // 3. Alert User
                                                            setTimeout(() => alert("Receipt downloaded!\n\nEmail client opened. Please ATTACH the downloaded PDF file to the email before sending."), 1000);
                                                        } else {
                                                            alert("Receipt downloaded! (Student has no email address on file)");
                                                        }
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert("Error: " + err.message);
                                                    }
                                                }}
                                                className="p-1.5 hover:bg-blue-100 rounded text-slate-400 hover:text-blue-600 transition"
                                                title="Email Receipt (Download & Attach)"
                                            >
                                                <Mail className="w-4 h-4" />
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
                                                className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-indigo-600 transition"
                                                title="Reprint Receipt"
                                            >
                                                <Printer className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {totalPaid === 0 && (!student.payments || student.payments.length === 0) && (
                                    <div className="p-8 text-center text-slate-400 text-sm">No transaction history.</div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

                {/* 5. ACTION FOOTER (Sticky Bottom) - PERMISSION GATED */}
                {canRecordPayment && (
                    <div className="bg-white border-t border-slate-200 p-6 shrink-0 z-20 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.08)]">
                        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                            
                            {/* Title & Transaction Type Switcher */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full lg:w-auto">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 ${
                                        transactionType === 'REFUND' 
                                            ? 'bg-rose-600 shadow-rose-200/50 scale-105' 
                                            : 'bg-slate-900 shadow-slate-200/30'
                                    }`}>
                                        <CreditCard className="w-5 h-5 animate-pulse" />
                                    </div>
                                    <div>
                                        <h4 className={`font-black text-sm tracking-tight transition-colors duration-300 ${
                                            transactionType === 'REFUND' ? 'text-rose-700' : 'text-slate-800'
                                        }`}>
                                            {transactionType === 'REFUND' ? "Issue Student Refund" : "Record New Payment"}
                                        </h4>
                                        <p className="text-xs text-slate-500 font-medium">
                                            {transactionType === 'REFUND' ? "Deducts from net paid and logs to timeline." : "Generates tax receipt automatically."}
                                        </p>
                                    </div>
                                </div>

                                {/* Premium Segmented Pill Switcher */}
                                <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 self-start sm:self-auto">
                                    <button
                                        type="button"
                                        onClick={() => setTransactionType('PAYMENT')}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black tracking-wide transition-all duration-250 ${
                                            transactionType === 'PAYMENT'
                                                ? 'bg-white text-indigo-600 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        Record Payment
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTransactionType('REFUND');
                                            setPaymentMode('Cash');
                                        }}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black tracking-wide transition-all duration-250 ${
                                            transactionType === 'REFUND'
                                                ? 'bg-rose-600 text-white shadow-sm'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        Issue Refund
                                    </button>
                                </div>
                            </div>

                            {/* Inputs & Action Controls */}
                            <div className={`flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full lg:w-auto p-2 rounded-2xl border transition-all duration-300 ${
                                transactionType === 'REFUND'
                                    ? 'bg-rose-50/60 border-rose-200/70 shadow-inner'
                                    : 'bg-slate-50/80 border-slate-200'
                            }`}>
                                
                                {/* Amount Input */}
                                <div className="relative flex-1 md:flex-none">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                                    <input
                                        type="number"
                                        placeholder="Amount"
                                        className={`pl-7 pr-3 py-2 w-full md:w-32 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 transition-all ${
                                            transactionType === 'REFUND' 
                                                ? 'focus:ring-rose-500 focus:border-rose-400 text-rose-700' 
                                                : 'focus:ring-indigo-500 focus:border-indigo-400 text-slate-800'
                                        }`}
                                        value={payAmount}
                                        onChange={(e) => setPayAmount(e.target.value)}
                                    />
                                </div>

                                {/* Mode Select Dropdown */}
                                <select
                                    className={`pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 transition-all cursor-pointer ${
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

                                {/* Refund Remarks (Conditional) */}
                                {transactionType === 'REFUND' && (
                                    <input
                                        type="text"
                                        placeholder="Reason for refund..."
                                        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-400 text-rose-700 flex-1 md:w-56"
                                        value={refundRemarks}
                                        onChange={(e) => setRefundRemarks(e.target.value)}
                                    />
                                )}

                                {/* Action Button */}
                                <button
                                    onClick={handleAddPayment}
                                    disabled={!payAmount || loading}
                                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 ${
                                        transactionType === 'REFUND'
                                            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200/50 hover:shadow-md'
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200/50 hover:shadow-md'
                                    }`}
                                >
                                    {loading ? "..." : (transactionType === 'REFUND' ? "Confirm Refund" : <>Receive Payment <Printer className="w-3.5 h-3.5" /></>)}
                                </button>
                            </div>
                        </div>

                        {/* High-Risk Warning banner for Refund operation */}
                        {transactionType === 'REFUND' && (
                            <div className="mt-3 p-2.5 bg-rose-50/40 border border-rose-100 rounded-xl text-[10px] font-bold text-rose-600/90 flex items-center gap-1.5 animate-enter">
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 uppercase font-black tracking-wide text-[8px]">Notice</span>
                                Deleting/deducting fees: This refund transaction will decrease Net Paid and will be permanently logged on the CRM timeline.
                            </div>
                        )}
                    </div>
                )}

                {/* 6. DIRECTOR CONTROLS (Edit Fee + Delete) */}
                {isDirector && (
                    <div className="bg-red-50 border-t-2 border-red-200 p-4 shrink-0">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Director Controls — Use with Caution
                        </p>
                        <div className="flex flex-col md:flex-row items-center gap-4">
                            {/* Course Correction */}
                            <div className="flex items-center gap-2 bg-white border border-red-200 rounded-xl p-2 flex-1 min-w-0">
                                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Fix Course:</span>
                                <select
                                    className="flex-1 py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400"
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
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-40 whitespace-nowrap"
                                >
                                    {courseLoading ? '...' : 'Fix Course'}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-4 mt-3">
                            {/* Edit Total Fee */}
                            <div className="flex items-center gap-2 bg-white border border-red-200 rounded-xl p-2 flex-1 min-w-0">
                                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Correct Total Fee:</span>
                                <div className="relative flex-1">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                                    <input
                                        type="number"
                                        className="pl-6 pr-2 py-1.5 w-full bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-amber-400"
                                        value={editFee}
                                        onChange={(e) => setEditFee(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleUpdateFee}
                                    disabled={editFeeLoading || !editFee}
                                    className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-40 whitespace-nowrap"
                                >
                                    {editFeeLoading ? '...' : (student.paymentPlan === 'LOAN' ? 'Update / Re-sync' : 'Update Fee')}
                                </button>
                            </div>

                            {/* Delete Admission */}
                            <button
                                onClick={handleDeleteAdmission}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition shadow-md whitespace-nowrap"
                            >
                                <X className="w-4 h-4" /> Delete This Admission
                            </button>
                        </div>
                    </div>
                )}

            </div>

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
