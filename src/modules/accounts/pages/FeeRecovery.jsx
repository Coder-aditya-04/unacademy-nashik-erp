import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { AlertCircle, MessageCircle, Phone, Search, Filter, Calendar } from 'lucide-react';
import { useFeeStructure } from '../../../hooks/useFeeStructure';
import { calculateInstallments, getEstimatedSchedule } from '../../../utils/calculations';

const FeeRecovery = ({ userProfile }) => {
    const { feeStructures } = useFeeStructure();
    const [defaulters, setDefaulters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showUpcomingOnly, setShowUpcomingOnly] = useState(true);
    const [viewCenter, setViewCenter] = useState('ALL');

    // Permisison Check
    const isDirector = userProfile?.role === 'DIRECTOR';
    const isManager = userProfile?.role === 'MANAGER';
    const userCenterId = userProfile?.centerId || "";

    useEffect(() => {
        if (feeStructures) fetchDefaulters();
    }, [feeStructures]);

    const fetchDefaulters = async () => {
        setLoading(true);
        try {
            // 1. Get all Active Admissions
            const q = query(collection(db, "admissions"), where("status", "==", "ACTIVE"));
            const snapshot = await getDocs(q);

            const list = [];

            // Helper to parse DD/MM/YYYY
            const parseDate = (dStr) => {
                if (!dStr) return null;
                const [d, m, y] = dStr.split('/');
                return new Date(`${y}-${m}-${d}`);
            };

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            snapshot.forEach(doc => {
                const data = doc.data();

                // 1b. Permission Filter (For Managers)
                if (isManager) {
                    // Check both ID and Name
                    const rCenter = (data.centerId || "").trim();
                    // We don't have center Name easily available in userProfile usually, but let's compare ID.
                    // If data.centerId is missing, allow? No, restrict.
                    // Assuming userProfile.centerId is set.
                    if (rCenter !== userCenterId) {
                        // Double check against name logic if needed, but for now strict ID + assumption.
                        // But wait, user had issues with ID mismatch.
                        // Let's rely on loose check if defined.
                        if (userCenterId && rCenter && rCenter !== userCenterId) return;
                    }
                }

                // 2. Calculate Balance Logic
                const totalPaid = data.totalPaid || 0;
                const totalFee = data.amount || 0;
                const balance = totalFee - totalPaid;

                if (balance > 0) {
                    // 3. Determine Next Due Date
                    let nextDue = { date: 'Check Portal', amount: balance, daysLeft: 999, isOverdue: false };

                    // PRIORITY 1: USE SAVED SCHEDULE (If exists)
                    let schedule = data.paymentSchedule || [];

                    // PRIORITY 2: USE ESTIMATED SCHEDULE (If no saved schedule)
                    // This ensures consistency with Student Manager
                    if (!schedule || schedule.length === 0) {
                        const admDate = data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date();

                        // FIX: Detect if Registration Fee is unpaid (Low Payment)
                        // If paid < 2000 (approx Reg Fee), assume "Due Now"
                        // Or if paid < 5% of Total
                        const minThreshold = 2000;

                        if (totalPaid < minThreshold) {
                            // Force Immediate Due for Balance (or at least the Reg Fee gap)
                            // We synthesize a "Down Payment" schedule item
                            schedule = [{
                                id: 'Down Payment',
                                name: 'Admission / Registration Fee',
                                date: new Date().toISOString(), // Due Now
                                amount: (totalFee > 5000 ? 5000 : totalFee) - totalPaid, // Ask for ~5k or balance
                                paid: false
                            }];

                            // If balance is tiny, just ask for balance
                            if (balance < 5000) schedule[0].amount = balance;

                        } else {
                            // Standard Estimate (Starts +30 days)
                            schedule = getEstimatedSchedule(totalFee, totalPaid, admDate);
                        }
                    }

                    if (schedule && schedule.length > 0) {
                        // Find first unpaid installment
                        let cumulative = 0;
                        let found = false;
                        for (let inst of schedule) {
                            // IF ESTIMATE: The schedule amounts ALREADY represent the balance (Total - Paid).
                            // So we do NOT subtract totalPaid again.
                            if (inst.isEstimate) {
                                if (!inst.paid) { // Check if we marked it paid locally or if it's just raw estimate
                                    const dDate = new Date(inst.date);
                                    const diffDays = Math.ceil((dDate - today) / (1000 * 60 * 60 * 24));

                                    nextDue = {
                                        date: (inst.name || `Installment`) + ` (${dDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`,
                                        amount: inst.amount,
                                        daysLeft: diffDays,
                                        isOverdue: diffDays < 0
                                    };
                                    found = true;
                                    break;
                                }
                            } else {
                                // IF REAL SAVED SCHEDULE: Logic is Cumulative Amount vs Total Paid
                                cumulative += Number(inst.amount || 0);
                                // effectivePaid handles the logic where totalPaid covers previous installments
                                // Tolerance of 100rs for minor calc diffs
                                if (cumulative > (totalPaid + 100)) {
                                    const targetDue = cumulative - totalPaid;

                                    let dDate;
                                    try {
                                        // Parse date flexibly
                                        const rawDate = inst.dueDate || inst.date;
                                        if (rawDate && rawDate.includes('/')) {
                                            dDate = parseDate(rawDate);
                                        } else {
                                            dDate = new Date(rawDate);
                                        }

                                        if (!dDate || isNaN(dDate.getTime())) dDate = today;
                                    } catch (e) {
                                        dDate = today;
                                    }

                                    const diffDays = Math.ceil((dDate - today) / (1000 * 60 * 60 * 24));
                                    nextDue = {
                                        date: (inst.name || `Installment ${inst.id || ''}`) + ` (${dDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`,
                                        amount: targetDue,
                                        daysLeft: diffDays,
                                        isOverdue: diffDays < 0
                                    };
                                    found = true;
                                    break;
                                }
                            }

                        } // End of checked block (Estimate vs Real)

                        if (!found && balance > 0) {
                            // All scheduled items paid but balance remains? (e.g. ad-hoc penalty or extra fee)
                            nextDue = { date: 'Immediate (Balance)', amount: balance, daysLeft: 0, isOverdue: true };
                        }
                    } else {
                        // Fallback if No Schedule at all
                        nextDue = { date: 'Immediate', amount: balance, daysLeft: 0, isOverdue: true };
                    }

                    list.push({ id: doc.id, ...data, balance, nextDue });
                }
            });

            // Sort by Days Left (Overdue first)
            list.sort((a, b) => a.nextDue.daysLeft - b.nextDue.daysLeft);

            setDefaulters(list);
        } catch (error) {
            console.error("Error fetching dues:", error);
        }
        setLoading(false);
    };

    const sendWhatsApp = (student) => {
        const message = `Hello ${student.studentName}, this is a gentle reminder from Unacademy Nashik. Your next installment of *₹${student.nextDue.amount.toLocaleString()}* is due on ${student.nextDue.date}. (Total Outstanding: ₹${student.balance.toLocaleString()}). Please clear it to avoid late charges.`;
        const url = `https://wa.me/91${student.phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const filtered = defaulters.filter(s => {
        // 1. Text Search
        const matchesSearch = s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone.includes(searchTerm);

        // 2. Reminder Filter (User Request: "early 7 days")
        // Show if Overdue OR Due in next 7 days
        let matchesTime = true;
        if (showUpcomingOnly) {
            matchesTime = s.nextDue.daysLeft <= 7;
        }

        // 3. Center Filter (Director Only)
        let matchesCenter = true;
        if (isDirector && viewCenter !== 'ALL') {
            matchesCenter = (s.centerId || "").trim() === viewCenter;
        }

        return matchesSearch && matchesTime && matchesCenter;
    });

    return (
        <div className="max-w-7xl mx-auto p-6">

            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <AlertCircle className="w-6 h-6 text-red-600" /> Fee Recovery List
                    </h1>
                    <p className="text-sm text-gray-500">
                        Total Pending (Shown): <span className="font-bold text-red-600">₹{filtered.reduce((sum, item) => sum + item.nextDue.amount, 0).toLocaleString()}</span>
                    </p>
                </div>

                {/* DIRECTOR CENTER FILTER */}
                {isDirector && (
                    <div className="flex-1 flex justify-center">
                        <div className="bg-white/80 backdrop-blur-md p-1 rounded-2xl shadow-sm border border-gray-200 inline-flex gap-1">
                            {['ALL', 'UN_COLLEGE', 'UN_NASHIK_RD', 'PRAYAS'].map(c => (
                                <button
                                    key={c}
                                    onClick={() => setViewCenter(c)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-wide transition-all duration-300 ${viewCenter === c ? 'bg-slate-800 text-white shadow-md transform scale-105' : 'text-slate-500 hover:bg-white hover:text-slate-700'}`}
                                >
                                    {c === 'ALL' ? 'ALL CENTERS' : c.replace('UN_', '').replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* TOGGLE FILTER */}
                    <button
                        onClick={() => setShowUpcomingOnly(!showUpcomingOnly)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition ${showUpcomingOnly ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-gray-600 border-gray-200'}`}
                    >
                        <Filter className="w-4 h-4" />
                        {showUpcomingOnly ? "Showing: Due in 7 Days" : "Showing: All Dues"}
                    </button>

                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <input
                            type="text" placeholder="Search Student..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-red-50 text-red-900 uppercase text-xs font-bold">
                        <tr>
                            <th className="p-4">Student Name</th>
                            <th className="p-4">Adm. Date</th>
                            <th className="p-4">Batch / Course</th>
                            <th className="p-4">Due Date</th>
                            <th className="p-4">Amount Due</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-500">Scanning records & calculating dues...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="6" className="p-8 text-center text-green-600 font-bold">No upcoming dues found for selected filter.</td></tr>
                        ) : filtered.map(student => (
                            <tr key={student.id} className="hover:bg-red-50/30 transition">
                                <td className="p-4 font-bold text-gray-800">
                                    {student.studentName}
                                    <div className="text-xs text-gray-500 font-normal flex items-center gap-1">
                                        <Phone className="w-3 h-3" /> {student.phone}
                                    </div>
                                </td>
                                <td className="p-4 text-xs font-mono text-gray-500">
                                    {student.createdAt ? new Date(student.createdAt.seconds * 1000).toLocaleDateString('en-IN') : '-'}
                                </td>
                                <td className="p-4 text-gray-600">{student.batch || student.program}</td>

                                <td className="p-4 font-mono font-bold">
                                    {student.nextDue.date}
                                    <div className="text-[10px] text-gray-400 font-normal">
                                        {student.nextDue.isOverdue ? "Overdue" : `${student.nextDue.daysLeft} Days Left`}
                                    </div>
                                </td>

                                <td className="p-4 text-red-600 font-extrabold text-base">
                                    ₹{student.nextDue.amount.toLocaleString()}
                                    <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                                        Total Bal: ₹{student.balance.toLocaleString()}
                                    </div>
                                </td>

                                <td className="p-4">
                                    {student.nextDue.isOverdue ? (
                                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Overdue</span>
                                    ) : (
                                        <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">Upcoming</span>
                                    )}
                                </td>

                                <td className="p-4 text-center">
                                    <button
                                        onClick={() => sendWhatsApp(student)}
                                        className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-sm transition transform hover:scale-105"
                                    >
                                        <MessageCircle className="w-4 h-4" /> Remind
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FeeRecovery;
