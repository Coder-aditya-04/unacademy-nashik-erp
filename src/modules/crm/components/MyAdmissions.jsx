import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchMyAdmissions } from '../../../services/leadService';
import { updatePaymentReminder } from '../../../services/paymentService'; // Import Reminder Service
import { Trophy, Download, Search, CheckCircle, ArrowLeft, Calendar, Calculator, X, Clock, Bell } from 'lucide-react'; // Added Bell icon
import { useFeeStructure } from '../../../hooks/useFeeStructure'; // Import Hook
import { calculateInstallments } from '../../../utils/calculations'; // Import Logic

const MyAdmissions = ({ userProfile }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { feeStructures } = useFeeStructure(); // Get Fee Data
    const [admissions, setAdmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedAdmission, setSelectedAdmission] = useState(null);
    const [periodFilter, setPeriodFilter] = useState("ALL TIME"); // Default to All Time
    const [filterYear, setFilterYear] = useState(new Date().getFullYear()); // Default to Current Year

    // Reminder State
    const [reminderDate, setReminderDate] = useState("");
    const [savingReminder, setSavingReminder] = useState(false);

    // Sync Reminder Date when Admission is Selected
    useEffect(() => {
        if (selectedAdmission?.nextPaymentDate) {
            setReminderDate(selectedAdmission.nextPaymentDate);
        } else {
            setReminderDate("");
        }
    }, [selectedAdmission]);

    useEffect(() => {
        loadData();
    }, [userProfile]);

    // AUTO-OPEN MODAL Logic (From Dashboard Redirect)
    useEffect(() => {
        if (location.state?.openAdmissionId && admissions.length > 0) {
            const target = admissions.find(a => a.id === location.state.openAdmissionId);
            if (target) {
                setSelectedAdmission(target);
                // Clear state to prevent sticky behavior (optional, but good UX)
                // navigate(location.pathname, { replace: true, state: {} });
            }
        }
    }, [location.state, admissions]);

    const loadData = async () => {
        setLoading(true);
        const data = await fetchMyAdmissions(userProfile);
        setAdmissions(data);
        setLoading(false);
    };

    const handleSetReminder = async () => {
        if (!reminderDate) return alert("Please select a date");
        setSavingReminder(true);

        try {
            const result = await updatePaymentReminder(selectedAdmission.id, reminderDate, userProfile);

            if (result.success) {
                // Update Local State with New Date
                const updatedAdm = { ...selectedAdmission, nextPaymentDate: reminderDate };
                setSelectedAdmission(updatedAdm);

                // Update the list as well so it persists if modal re-opened without reload
                setAdmissions(prev => prev.map(a => a.id === updatedAdm.id ? updatedAdm : a));

                alert("Reminder Set Successfully!");
            } else {
                alert("Failed to set reminder: " + (result.error || "Unknown Error"));
            }
        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        }

        setSavingReminder(false);
        // Do NOT clear the date, so user sees visual confirmation
    };

    const filteredAdmissions = admissions.filter(adm => {
        // 1. Search Query
        const matchesSearch = (adm.studentName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(adm.phone || "").includes(searchTerm);

        // 2. Period Filter
        let matchesPeriod = true;
        if (periodFilter !== "ALL TIME") {
            // Use admissionDate (preferred) or createdAt
            const rawDate = adm.admissionDate ? new Date(adm.admissionDate) : (adm.createdAt?.seconds ? new Date(adm.createdAt.seconds * 1000) : new Date());
            const month = rawDate.getMonth(); // 0-11
            const year = rawDate.getFullYear();
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            if (periodFilter === "THIS MONTH") {
                matchesPeriod = (month === currentMonth && year === currentYear);
            } else if (periodFilter === "LAST MONTH") {
                const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                matchesPeriod = (month === lastMonthDate.getMonth() && year === lastMonthDate.getFullYear());
            } else {
                // Specific Months (JAN ... DEC)
                const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                const targetMonthIndex = monthNames.indexOf(periodFilter);
                if (targetMonthIndex !== -1) {
                    // Use explicitly selected Year
                    matchesPeriod = (month === targetMonthIndex && year === parseInt(filterYear));
                }
            }
        }

        return matchesSearch && matchesPeriod;
    });

    // Helper: Normalize
    const normalize = (str) => str?.toLowerCase().replace(/[^a-z0-9]/g, '');

    const getRealSchedule = (adm) => {
        const total = adm.amount || 0;
        const paid = adm.totalPaid || 0;
        const balance = adm.status === 'REFUNDED' ? 0 : (total - paid);
        if (balance <= 0) return []; // If fully paid, no schedule needed (or could show fulfilled schedule)

        // Determine Start Date (Priority: Enrollment > Created > Today)
        let startDate = new Date();
        if (adm.enrollmentDate) {
            startDate = new Date(adm.enrollmentDate);
        } else if (adm.createdAt) {
            startDate = new Date(adm.createdAt.seconds * 1000);
        }

        // Use Centralized Logic
        // calculateInstallments(landingFee, programKey, paymentPlan, programsData, startDate)
        let baseSchedule = calculateInstallments(
            total,
            adm.program,
            adm.paymentPlan,
            feeStructures,
            startDate
        );

        // FALLBACK: If strict calculation fails (e.g. missing fee structure key), use Legacy Estimation
        if (!baseSchedule || baseSchedule.length === 0) {
            const programName = adm.program || "";
            // Heuristic check for 2 Year program based on key naming conventions
            const isTwoYear = (programName.includes("2Y") || programName.includes("11th") || programName.includes("8th") || programName.includes("9th"));

            let targetPercents = [0.60, 0.40];
            let dateOffsets = [0, 90]; // 3 Months (Standard) or 1 Month + Interval

            if (isTwoYear) {
                targetPercents = [0.50, 0.25, 0.25];
                dateOffsets = [0, 90, 180]; // 0, 3mo, 6mo (approx)
            }

            // Calculate Amounts
            let targets = targetPercents.map((p, i) => {
                if (i === targetPercents.length - 1) return 0;
                return Math.round(total * p);
            });
            const sumSoFar = targets.reduce((a, b) => a + b, 0);
            targets[targets.length - 1] = total - sumSoFar;

            baseSchedule = targets.map((targetAmount, idx) => {
                const dueDate = new Date(startDate);
                dueDate.setDate(dueDate.getDate() + dateOffsets[idx]); // Crude offset

                // Better Offset Logic matching Accounts
                // 1st inst: +1 month? Accounts says "Upon Admission" for first mostly?
                // Let's stick to the "dateOffsets" logic which was working visually for user before

                return {
                    id: `${idx + 1}${idx === 0 ? 'st' : idx === 1 ? 'nd' : 'rd'} Installment`,
                    amount: targetAmount,
                    dueDate: dueDate.toLocaleDateString('en-IN'),
                    status: "Future"
                };
            });
        }

        if (!baseSchedule || baseSchedule.length === 0) return [];

        // Apply "Burn Down" Logic to mark Paid vs Due
        // We simulate paying off the schedule from top to bottom
        let remainingPaid = paid;
        const finalSchedule = baseSchedule.map(inst => {
            let amountDue = inst.amount;
            let isItemPaid = false;

            if (remainingPaid >= amountDue) {
                remainingPaid -= amountDue;
                amountDue = 0;
                isItemPaid = true;
            } else {
                amountDue -= remainingPaid;
                remainingPaid = 0; // Exhausted paid amount
                isItemPaid = false;
            }

            return {
                ...inst,
                isPaid: isItemPaid,
                // If partially paid, we might want to show original amount but mark status? 
                // The UI expects 'amount' to be displayed. 
                // If I return the full amount but `isPaid=true`, it shows correctly.
            };
        });

        return finalSchedule;
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

                <div className="flex gap-2 w-full md:w-auto">
                    {/* PERIOD FILTER */}
                    <div className="relative flex gap-2">
                        {/* Year Selector (Only show if specific month selected) */}
                        {!['ALL TIME', 'THIS MONTH', 'LAST MONTH'].includes(periodFilter) && (
                            <select
                                value={filterYear}
                                onChange={(e) => setFilterYear(parseInt(e.target.value))}
                                className="bg-white border border-gray-200 text-gray-700 text-sm font-bold py-2 px-3 rounded-lg cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
                            >
                                <option value="2024">2024</option>
                                <option value="2025">2025</option>
                                <option value="2026">2026</option>
                                <option value="2027">2027</option>
                            </select>
                        )}

                        <div className="relative">
                            <select
                                value={periodFilter}
                                onChange={(e) => setPeriodFilter(e.target.value)}
                                className="bg-white border border-gray-200 text-gray-700 text-sm font-bold py-2 px-3 pr-8 rounded-lg cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase h-10"
                            >
                                <option value="ALL TIME">All Time</option>
                                <option value="THIS MONTH">This Month</option>
                                <option value="LAST MONTH">Last Month</option>
                                <option disabled>──────────</option>
                                <option value="JAN">January</option>
                                <option value="FEB">February</option>
                                <option value="MAR">March</option>
                                <option value="APR">April</option>
                                <option value="MAY">May</option>
                                <option value="JUN">June</option>
                                <option value="JUL">July</option>
                                <option value="AUG">August</option>
                                <option value="SEP">September</option>
                                <option value="OCT">October</option>
                                <option value="NOV">November</option>
                                <option value="DEC">December</option>
                            </select>
                            <Trophy className="w-3 h-3 text-gray-400 absolute right-3 top-3.5 pointer-events-none" />
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search Student..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="bg-green-100 p-3 rounded-full text-green-600">
                        <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase">
                            {periodFilter === 'ALL TIME' ? 'Total Converted' : `${periodFilter} ${!['THIS MONTH', 'LAST MONTH'].includes(periodFilter) ? filterYear : ''} Converted`}
                        </p>
                        <h3 className="text-2xl font-bold text-gray-800">{filteredAdmissions.length}</h3>
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
                        const pending = adm.status === 'REFUNDED' ? 0 : (totalFee - paid);
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
                                    <span className="font-bold text-red-600">₹{(selectedAdmission.status === 'REFUNDED' ? 0 : (selectedAdmission.amount - selectedAdmission.totalPaid))?.toLocaleString()}</span>
                                </div>
                            </div>

                            <h4 className="font-bold text-gray-700 text-sm mb-3 uppercase flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Upcoming Installments
                            </h4>
                            <div className="space-y-3">
                                {/* REAL Schedule Logic */}
                                {(selectedAdmission.status !== 'REFUNDED' && (selectedAdmission.amount - selectedAdmission.totalPaid) > 0) ? (
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
                            {(selectedAdmission.status !== 'REFUNDED' && (selectedAdmission.amount - selectedAdmission.totalPaid) > 0) && (
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
