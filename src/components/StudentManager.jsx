import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, Timestamp, collection, query, getDocs, where } from 'firebase/firestore';
import { FileText, CheckCircle, Clock, Printer, CreditCard, X, Calendar, TrendingUp, AlertCircle, ArrowRight, Mail, User, Briefcase } from 'lucide-react';
import { CENTERS } from '../utils/centers';
import { generateTaxInvoice } from '../utils/pdfGenerator';
import { calculateRefunds } from '../utils/calculations';
import { PROGRAMS } from '../utils/feeData';


const StudentManager = ({ student, onClose, refreshData }) => {
    const [payAmount, setPayAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [loading, setLoading] = useState(false);

    // Batch Management State
    const [batchAssigned, setBatchAssigned] = useState(student.batchAssigned || student.batchName || '');
    const [savingBatch, setSavingBatch] = useState(false);

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

        // Check if 2-Year Program (e.g., 11th, 2Y)
        const isTwoYear = (programName && (programName.includes("11th") || programName.includes("2Y")));

        // Default Targets (1-Year): 60% - 40%
        let targetPercents = [0.60, 0.40];
        let dateOffsets = [0, 60]; // Days from start

        // Override for 2-Year: 50% - 25% - 25%
        if (isTwoYear) {
            targetPercents = [0.50, 0.25, 0.25];
            dateOffsets = [0, 90, 180]; // 0, 3 months, 6 months
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
            dueDate.setDate(dueDate.getDate() + dateOffsets[idx]);

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
    const balanceDue = (student.amount || 0) - totalPaid;
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

    // 2. RECORD NEW PAYMENT
    const handleAddPayment = async () => {
        if (!payAmount) return;
        setLoading(true);

        try {
            const studentRef = doc(db, "admissions", student.id);
            const newPayment = {
                amount: Number(payAmount),
                date: Timestamp.now(),
                mode: paymentMode,
                type: "Installment/Balance"
            };

            await updateDoc(studentRef, {
                payments: arrayUnion(newPayment),
                totalPaid: totalPaid + Number(payAmount)
            });

            // GENERATE PDF
            const center = CENTERS[student.centerId] || CENTERS["UN_COLLEGE"];
            const newTotalPaid = totalPaid + Number(payAmount);

            const updatedStudent = {
                ...student,
                totalPaid: newTotalPaid,
                payments: [...(student.payments || []), { ...newPayment, date: { seconds: Date.now() / 1000 } }]
            };

            // RE-CALCULATE SCHEDULE FOR PDF (Using New Total Paid)
            let pdfSchedule = student.paymentSchedule || [];
            if (pdfSchedule.length === 0) {
                const startDate = student.enrollmentDate
                    ? new Date(student.enrollmentDate)
                    : (student.createdAt?.seconds ? new Date(student.createdAt.seconds * 1000) : new Date());
                pdfSchedule = getEstimatedSchedule(student.amount || 0, newTotalPaid, startDate, student.program || student.standard);
            }

            /* AUTO-RECEIPT DISABLED
            await generateTaxInvoice(updatedStudent, {
                amount: payAmount,
                mode: paymentMode,
                type: "Installment Payment"
            }, center, pdfSchedule, calculateRefunds(student.amount, student.projectedFee || student.amount, student.programKey, PROGRAMS));
            */



            alert("Payment Recorded Successfully!");
            refreshData();
            onClose();

        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        }
        setLoading(false);
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
                                <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> +91 {student.phone}</span>
                                <span className="flex items-center gap-1 text-orange-300 font-bold"><User className="w-3 h-3" /> Counsellor: {student.bookedBy || student.counselorName || 'Team'}</span>
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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Fee</p>
                            <p className="text-2xl font-black text-slate-800">₹{student.amount?.toLocaleString()}</p>
                        </div>
                        <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100">
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Paid</p>
                            <p className="text-2xl font-black text-emerald-700">₹{totalPaid.toLocaleString()}</p>
                        </div>
                        <div className={`p-5 rounded-xl border ${balanceDue > 0 ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${balanceDue > 0 ? 'text-orange-600' : 'text-slate-400'}`}>Balance Due</p>
                            <p className={`text-2xl font-black ${balanceDue > 0 ? 'text-orange-700' : 'text-slate-400'}`}>₹{balanceDue > 0 ? balanceDue.toLocaleString() : '0'}</p>
                        </div>
                        <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 relative overflow-hidden">
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
                                                        const center = CENTERS[student.centerId] || CENTERS["UN_COLLEGE"];
                                                        // 1. Generate & Download the PDF
                                                        await generateTaxInvoice(student, {
                                                            amount: pay.amount,
                                                            mode: pay.mode || 'Cash',
                                                            type: pay.type || 'Installment'
                                                        }, center, displaySchedule, calculateRefunds(student.amount, student.projectedFee || student.amount, student.programKey, PROGRAMS));



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
                                                        const center = CENTERS[student.centerId] || CENTERS["UN_COLLEGE"];
                                                        await generateTaxInvoice(student, {
                                                            amount: pay.amount,
                                                            mode: pay.mode || 'Cash',
                                                            type: pay.type || 'Installment'
                                                        }, center, displaySchedule, calculateRefunds(student.amount, student.projectedFee || student.amount, student.programKey || student.program, PROGRAMS));

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

                {/* 5. ACTION FOOTER (Sticky Bottom) */}
                <div className="bg-white border-t border-slate-200 p-6 shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white shadow-lg">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Record New Payment</h4>
                                <p className="text-xs text-slate-500">Generates receipt automatically.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    className="pl-6 pr-3 py-2 w-32 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                />
                            </div>
                            <select
                                className="pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                value={paymentMode}
                                onChange={(e) => setPaymentMode(e.target.value)}
                            >
                                <option>UPI</option>
                                <option>Cash</option>
                                <option>Cheque</option>
                                <option>Card</option>
                                <option>POS-SHS</option>
                                <option>Ujjivan - QR</option>
                                <option>KAP-QR</option>
                            </select>
                            <button
                                onClick={handleAddPayment}
                                disabled={!payAmount || loading}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {loading ? "..." : <>Receive <Printer className="w-3 h-3" /></>}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default StudentManager;
