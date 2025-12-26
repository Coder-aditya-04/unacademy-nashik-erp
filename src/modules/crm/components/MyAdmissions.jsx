import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMyAdmissions } from '../../../services/leadService';
import { updatePaymentReminder } from '../../../services/paymentService'; // Import Reminder Service
import { Trophy, Download, Search, CheckCircle, ArrowLeft, Calendar, Calculator, X, Clock, Bell } from 'lucide-react'; // Added Bell icon
import { useFeeStructure } from '../../../hooks/useFeeStructure'; // Import Hook
import { calculateInstallments } from '../../../utils/calculations'; // Import Logic

const MyAdmissions = ({ userProfile }) => {
    const navigate = useNavigate();
    const { feeStructures } = useFeeStructure(); // Get Fee Data
    const [admissions, setAdmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedAdmission, setSelectedAdmission] = useState(null);

    // Reminder State
    const [reminderDate, setReminderDate] = useState("");
    const [savingReminder, setSavingReminder] = useState(false);

    useEffect(() => {
        loadData();
    }, [userProfile]);

    const loadData = async () => {
        setLoading(true);
        const data = await fetchMyAdmissions(userProfile);
        setAdmissions(data);
        setLoading(false);
    };

    const handleSetReminder = async () => {
        if (!reminderDate) return alert("Please select a date");
        setSavingReminder(true);
        await updatePaymentReminder(selectedAdmission.id, reminderDate, userProfile);
        alert("Reminder Set Successfully!");
        setSavingReminder(false);
        setReminderDate("");
        // Opt: Reload data to show updated status if we displayed it
    };

    const filteredAdmissions = admissions.filter(adm =>
        (adm.studentName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(adm.phone || "").includes(searchTerm)
    );

    // Helper: Normalize
    const normalize = (str) => str?.toLowerCase().replace(/[^a-z0-9]/g, '');

    const getRealSchedule = (adm) => {
        const total = adm.amount || 0;
        const paid = adm.totalPaid || 0;
        const balance = total - paid;
        if (balance <= 0) return [];

        // NEW: LOAN PLAN LOGIC
        if (adm.paymentPlan === 'LOAN') {
            const downPayment = Math.round(total * 0.25);
            const loanAmount = total - downPayment;

            const schedule = [];
            let remainingPaid = paid;

            // 1. Down Payment
            let dpDue = downPayment;
            if (remainingPaid >= dpDue) {
                remainingPaid -= dpDue;
                dpDue = 0;
            } else {
                dpDue -= remainingPaid;
                remainingPaid = 0;
            }

            if (dpDue > 0) {
                schedule.push({
                    id: "Down Payment (25%)",
                    amount: dpDue,
                    dueDate: "Immediate",
                    isPaid: false
                });
            }

            // 2. Loan Amount
            let loanDue = loanAmount;
            if (remainingPaid >= loanDue) {
                loanDue = 0;
            } else {
                loanDue -= remainingPaid;
            }

            if (loanDue > 0) {
                schedule.push({
                    id: "Loan Disbursement (75%)",
                    amount: loanDue,
                    dueDate: "Upon Approval",
                    isPaid: false
                });
            }

            return schedule;
        }

        const programName = adm.program || "";
        const isTwoYear = (programName && (programName.includes("11th") || programName.includes("2Y")));
        const startDate = adm.createdAt ? new Date(adm.createdAt.seconds * 1000) : new Date();

        let targetPercents = [0.60, 0.40];
        let dateOffsets = [0, 60];

        if (isTwoYear) {
            targetPercents = [0.50, 0.25, 0.25];
            dateOffsets = [0, 90, 180];
        }

        let targets = targetPercents.map((p, i) => {
            if (i === targetPercents.length - 1) return 0;
            return Math.round(total * p);
        });
        const sumSoFar = targets.reduce((a, b) => a + b, 0);
        targets[targets.length - 1] = total - sumSoFar;

        const schedule = [];
        let remainingPaid = paid;

        targets.forEach((targetAmount, idx) => {
            const dueDate = new Date(startDate);
            dueDate.setDate(dueDate.getDate() + dateOffsets[idx]);

            let amountDue = targetAmount;
            if (remainingPaid >= amountDue) {
                remainingPaid -= amountDue;
                amountDue = 0;
            } else {
                amountDue -= remainingPaid;
                remainingPaid = 0;
            }

            if (amountDue > 0) {
                schedule.push({
                    id: `${idx + 1}${idx === 0 ? 'st' : idx === 1 ? 'nd' : 'rd'} Installment`,
                    amount: amountDue,
                    dueDate: dueDate.toLocaleDateString(),
                    isPaid: false
                });
            }
        });

        return schedule;
    };

    return (
        <div className="max-w-7xl mx-auto p-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <button onClick={() => navigate('/staff/dashboard')} className="flex items-center text-gray-500 hover:text-blue-600 mb-2 transition text-sm">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-yellow-500" /> My Success Board
                    </h1>
                    <p className="text-sm text-gray-500">
                        Showing {admissions.length} Total Admissions by you
                    </p>
                </div>

                {/* Search */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search Student..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="bg-green-100 p-3 rounded-full text-green-600">
                        <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase">Total Converted</p>
                        <h3 className="text-2xl font-bold text-gray-800">{admissions.length}</h3>
                    </div>
                </div>
            </div>

            {/* NEW: FINANCIAL CARDS GRID */}
            {loading ? (
                <div className="text-center py-20">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading your success board...</p>
                </div>
            ) : filteredAdmissions.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed">
                    <p className="text-gray-400">No admissions found matching your search.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAdmissions.map(adm => {
                        const totalFee = adm.amount || 0;
                        const paid = adm.totalPaid || 0;
                        const pending = totalFee - paid;
                        const percentPaid = totalFee > 0 ? Math.round((paid / totalFee) * 100) : 0;

                        // NEW: Find Next Due Installment for Summary Card
                        const schedule = getRealSchedule(adm);
                        const nextDue = schedule.find(i => !i.isPaid);

                        return (
                            <div key={adm.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition group">
                                {/* Header */}
                                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-lg">{adm.studentName}</h3>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" /> {adm.createdAt?.seconds ? new Date(adm.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                                        </p>
                                        {adm.aadhar && (
                                            <p className="text-xs text-gray-500 mt-1 font-mono">
                                                UID: {adm.aadhar}
                                            </p>
                                        )}
                                    </div>
                                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">
                                        {adm.program || "Course"}
                                    </span>
                                </div>

                                {/* Financial Progress */}
                                <div className="p-5 space-y-4">
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-xs font-bold text-gray-400 uppercase">Fee Status</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${pending <= 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {pending <= 0 ? 'FULLY PAID' : `${percentPaid}% Received`}
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                        <div className="bg-green-500 h-full rounded-full transition-all duration-1000" style={{ width: `${percentPaid}%` }}></div>
                                    </div>

                                    {/* Next Due Snippet */}
                                    {pending > 0 && nextDue && (
                                        <div className="bg-indigo-50 border border-indigo-100 p-2 rounded flex justify-between items-center px-3">
                                            <span className="text-xs text-indigo-700 font-bold">Next Due:</span>
                                            <span className="text-sm text-indigo-900 font-bold">₹{nextDue.amount.toLocaleString()} <span className="text-[10px] opacity-75">by {nextDue.dueDate}</span></span>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 py-2">
                                        <div>
                                            <p className="text-xs text-gray-500">Total Paid</p>
                                            <p className="text-lg font-bold text-green-600">₹{paid.toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500">Pending</p>
                                            <p className="text-lg font-bold text-gray-800">₹{pending.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="pt-2 border-t border-gray-50">
                                        <button
                                            onClick={() => setSelectedAdmission(adm)}
                                            className="w-full bg-white border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 flex items-center justify-center gap-2"
                                        >
                                            <Calculator className="w-4 h-4" /> View Financial Plan
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* FINANCIAL OVERVIEW & REMINDER MODAL */}
            {selectedAdmission && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-indigo-900 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">{selectedAdmission.studentName}</h3>
                                <p className="text-indigo-200 text-xs">Financial Overview & Reminders</p>
                            </div>
                            <button onClick={() => { setSelectedAdmission(null); setReminderDate(""); }} className="p-2 hover:bg-white/10 rounded-full"><X /></button>
                        </div>
                        <div className="p-6">
                            <div className="bg-gray-50 p-4 rounded-xl mb-6">
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-500 text-sm">Total Agreed Fee</span>
                                    <span className="font-bold text-gray-800">₹{selectedAdmission.amount?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-500 text-sm">Total Paid (Token)</span>
                                    <span className="font-bold text-green-600">₹{selectedAdmission.totalPaid?.toLocaleString()}</span>
                                </div>
                                <div className="border-t border-gray-200 my-2 pt-2 flex justify-between">
                                    <span className="text-gray-500 font-bold">Balance Due</span>
                                    <span className="font-bold text-red-600">₹{(selectedAdmission.amount - selectedAdmission.totalPaid)?.toLocaleString()}</span>
                                </div>
                            </div>

                            <h4 className="font-bold text-gray-700 text-sm mb-3 uppercase flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Upcoming Installments
                            </h4>
                            <div className="space-y-3">
                                {/* REAL Schedule Logic */}
                                {(selectedAdmission.amount - selectedAdmission.totalPaid) > 0 ? (
                                    <>
                                        {(() => {
                                            const schedule = getRealSchedule(selectedAdmission);

                                            // Fallback if no schedule found
                                            if (schedule.length === 0) {
                                                return <p className="text-xs text-red-500">Schedule data unavailable. Refer to accounts.</p>;
                                            }

                                            return schedule.map((inst, idx) => (
                                                <div key={idx} className={`flex justify-between text-sm p-3 border rounded ${inst.isPaid ? 'bg-green-50 border-green-100 opacity-70' : 'bg-white hover:bg-gray-50'}`}>
                                                    <div className="flex flex-col">
                                                        <span className={`font-bold ${inst.isPaid ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                                                            {inst.id === 'Down Payment (25%)' ? 'Down Payment' : `Installment ${inst.id}`}
                                                        </span>
                                                        <span className="text-xs text-gray-500">{inst.isPaid ? 'Paid' : `Due: ${inst.dueDate}`}</span>
                                                    </div>
                                                    <span className={`font-bold ${inst.isPaid ? 'text-green-700' : 'text-gray-800'}`}>₹{inst.amount.toLocaleString()}</span>
                                                </div>
                                            ));
                                        })()}
                                    </>
                                ) : (
                                    <p className="text-center text-green-600 font-bold py-2">All Fees Paid! 🎉</p>
                                )}
                            </div>

                            {/* REMINDER SECTION */}
                            {(selectedAdmission.amount - selectedAdmission.totalPaid) > 0 && (
                                <div className="mt-6 pt-6 border-t border-gray-100">
                                    <h4 className="font-bold text-gray-700 text-sm mb-3 uppercase flex items-center gap-2">
                                        <Bell className="w-4 h-4 text-indigo-600" /> Set Payment Reminder
                                    </h4>
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            value={reminderDate}
                                            onChange={(e) => setReminderDate(e.target.value)}
                                            className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <button
                                            onClick={handleSetReminder}
                                            disabled={savingReminder}
                                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            {savingReminder ? "..." : "Set"}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                        Setting a date here will highlight this student in your Dashboard Reminders list on that day.
                                    </p>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default MyAdmissions;
