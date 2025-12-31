import React, { useEffect, useState } from 'react';
import { db } from '../../../firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc, arrayUnion, increment, Timestamp } from 'firebase/firestore';
import {
    Search, CheckCircle, Clock, FileText, TrendingUp, Calendar, School, ArrowRight, Printer,
    Building2, Download, Filter, Wallet, AlertCircle,
    Smartphone, Banknote, FileSignature, QrCode, Landmark, Terminal, MoreHorizontal, CreditCard // New Icons
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StudentManager from '../../../components/StudentManager';
import StudentAcademicProfile from '../../../components/StudentAcademicProfile';
import { CENTERS } from '../../../utils/centers';

const AccountantDashboard = ({ userProfile }) => {
    const [allData, setAllData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('VERIFY'); // 'VERIFY', 'COLLECT', 'TIEUPS', 'REPORTS'
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [viewProfile, setViewProfile] = useState(null); // For Academic Profile View

    // Filters
    const [timeFilter, setTimeFilter] = useState('MONTH'); // TODAY, MONTH, YEAR, CUSTOM_MONTH
    const [selectedDate, setSelectedDate] = useState(new Date()); // For Custom Month Filter
    const [centerFilter, setCenterFilter] = useState('ALL');

    const [modeFilter, setModeFilter] = useState('ALL'); // ALL, CASH, UPI, CHEQUE, OTHER
    const [limitCount, setLimitCount] = useState(20); // Pagination Limit

    const navigate = useNavigate();

    // Stats State
    const [stats, setStats] = useState({
        totalCollection: 0,
        pendingCount: 0,
        activeCount: 0,
        modes: { Cash: 0, UPI: 0, Cheque: 0, KapQR: 0, UjjivanQR: 0, PosSHS: 0, Other: 0 },
        monthlyBreakdown: [],
        centerDistribution: {},
        totalOutstanding: 0,
    });

    // Fetch Data
    const fetchData = async () => {
        setLoading(true);
        const q = query(collection(db, "admissions"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllData(data);
        calculateStats(data, timeFilter, centerFilter, modeFilter);
        setLoading(false);
    };

    // LOAN DISBURSAL LOGIC
    const handleDisburseLoan = async (student) => {
        if (!window.confirm(`Confirm Disbursal of Loan Amount: ₹${student.loanAmount}?`)) return;
        try {
            const ref = doc(db, "admissions", student.id);
            await updateDoc(ref, {
                totalPaid: increment(Number(student.loanAmount)),
                payments: arrayUnion({
                    amount: Number(student.loanAmount),
                    date: Timestamp.now(),
                    mode: 'LOAN_DISBURSAL',
                    type: 'Finance Settlement',
                    remarks: 'Auto-disbursed by Accountant'
                }),
                loanDisbursed: true,
                status: 'COMPLETED' // Mark as completed (or update based on remaining)
            });
            alert("Loan Disbursed Successfully!");
            fetchData(); // Refresh
        } catch (e) {
            console.error(e);
            alert("Error disbursing loan: " + e.message);
        }
    };

    // Filter Loan Queue
    const loanQueue = allData.filter(student =>
        student.paymentPlan === 'LOAN' &&
        (centerFilter === 'ALL' || student.centerId === centerFilter) && // FIX: Apply Center Filter
        (student.amount - student.totalPaid) > 100 && // Tolerance for rounding
        (String(student.studentName || "").toLowerCase().includes(searchTerm.toLowerCase()) || String(student.phone || "").includes(searchTerm)) &&
        // FIX: Only show if Down Payment is Cleared AND Admission is Verified
        (Number(student.totalPaid || 0) >= (Number(student.downPayment || 0) - 100)) &&
        student.status === 'ACTIVE'
    );


    // Re-calculate when filters change
    useEffect(() => {
        if (allData.length > 0) calculateStats(allData, timeFilter, centerFilter, modeFilter);
    }, [timeFilter, centerFilter, modeFilter, allData, selectedDate]);

    const calculateStats = (data, tFilter, cFilter, mFilter) => {
        const now = new Date();
        const todayDate = now.toDateString();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let filteredSum = 0;
        let pending = 0;
        let active = 0;
        let totalOutstanding = 0;
        let modeStats = { Cash: 0, KAPONLINE: 0, SHSONLINE: 0, Cheque: 0, KapQR: 0, UjjivanQR: 0, PosSHS: 0, Other: 0 };
        let centerStats = {};

        // Initialize Center Stats
        Object.keys(CENTERS).forEach(key => centerStats[key] = 0);
        centerStats['UNKNOWN'] = 0;

        // Initialize Monthly Breakdown
        let monthlyData = Array(12).fill(0).map((_, i) => ({
            month: new Date(currentYear, i).toLocaleString('default', { month: 'short' }),
            total: 0,
            cash: 0,
            online: 0
        }));

        // Helper for safe number parsing (handles "1,20,000" strings)
        const safeNum = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            const str = String(val).replace(/,/g, '');
            return parseFloat(str) || 0;
        };

        // Consolidate Loops for Efficiency and Safety
        data.forEach(item => {
            // 1. ROBUST Center Filter check (Matches DirectorDashboard Logic)
            const txnCenterId = (item.centerId || "").trim().toUpperCase();
            const txnCenterName = (item.centerName || "").trim().toUpperCase(); // Ensure centerName exists in data
            const filterId = (cFilter || "ALL").trim().toUpperCase();

            // Match Logic from DirectorDashboard
            const matchesCenter =
                filterId === 'ALL' ||
                txnCenterId === filterId ||
                (filterId === 'UN_COLLEGE' && (txnCenterId === "" || txnCenterId === "UN_COLLEGE" || txnCenterId.includes("COLLEGE") || txnCenterName.includes("COLLEGE"))) ||
                (filterId === 'UN_NASHIK_RD' && (txnCenterId === "UN_NASHIK_RD" || txnCenterId.includes("NASHIK RD") || txnCenterName.includes("NASHIK RD") || txnCenterName.includes("JAIL"))) ||
                (filterId === 'PRAYAS' && (txnCenterId === 'PRAYAS' || txnCenterName.includes('PRAYAS')));

            if (matchesCenter) {
                const status = String(item.status || "").toUpperCase();

                // Pending Count (For Action Required Card)
                if (status === 'TOKEN_PAID' || status === 'PENDING_APPROVAL' || status === 'CONVERTED') pending++;

                // Active Count & Receivables (For Outstanding Card)
                // Now includes TOKEN_PAID and COMPLETED to match Manager Dashboard
                if (status === 'ACTIVE' || status === 'TOKEN_PAID' || status === 'COMPLETED') {
                    active++;

                    // Receivables Calc (Safe Casting)
                    // Logic: Total Fee - Total Paid. If > 0, add to outstanding.
                    const fee = safeNum(item.amount);
                    const paid = safeNum(item.totalPaid);
                    const bal = fee - paid;
                    if (bal > 0) totalOutstanding += bal;
                }
            }

            // 2. Process Payments with PRO-RATA NORMALIZATION
            // Fixes discrepancy where Payment History > Total Paid (e.g. Cancelled txns not deleted)
            let payments = Array.isArray(item.payments) ? item.payments : [];
            const sumHistory = payments.reduce((sum, p) => sum + safeNum(p.amount), 0);
            const realTotal = safeNum(item.totalPaid);

            // If History is inflated (e.g. 43k vs 13k), scale down all payments to match Real Total
            const correctionRatio = (sumHistory > realTotal && sumHistory > 0) ? (realTotal / sumHistory) : 1;

            payments.forEach(pay => {
                const payDateRaw = pay.date;
                if (payDateRaw) {
                    let payDate = null;
                    if (payDateRaw.seconds) payDate = new Date(payDateRaw.seconds * 1000);
                    else payDate = new Date(payDateRaw);

                    if (payDate && !isNaN(payDate.getTime())) {
                        // Apply Correction Ratio
                        const rawAmt = safeNum(pay.amount);
                        const payAmt = rawAmt * correctionRatio; // Normalized Amount

                        let payCategory;
                        const mode = pay.mode ? String(pay.mode).toUpperCase() : 'OTHER';

                        // Determine Category
                        const mUp = mode.toUpperCase();
                        if (mUp.includes('CASH')) payCategory = 'CASH';
                        else if (mUp.includes('CHEQUE')) payCategory = 'CHEQUE';
                        else if (mUp.includes('KAP') || mUp.includes('AXIS')) payCategory = 'KAPQR';
                        else if (mUp.includes('UJJIVAN') || mUp.includes('UJAN')) payCategory = 'UJJIVANQR';
                        else if (mUp.includes('POS') || mUp.includes('SWIPE')) payCategory = 'PosSHS';
                        else if (mUp.includes('CARD') || mUp.includes('SHS') || mUp.includes('NETBANKING')) {
                            payCategory = 'SHSONLINE';
                        }
                        else if (mUp.includes('UPI') || mUp.includes('ONLINE') || mUp.includes('QR') || mUp.includes('GPAY') || mUp.includes('PAYTM') || mUp.includes('PHONEPE')) {
                            // Catch-all for other Online/UPI
                            payCategory = 'KAPONLINE';
                        }
                        else {
                            payCategory = 'OTHER';
                        }

                        // Mode Filter Match (Expanded)
                        const matchesMode = mFilter === 'ALL' ||
                            payCategory === mFilter ||
                            (mFilter === 'UPI' && payCategory === 'UPI');

                        // Time Filter Match
                        let timeMatch = false;
                        if (tFilter === 'TODAY') {
                            if (payDate.toDateString() === todayDate) timeMatch = true;
                        } else if (tFilter === 'MONTH') {
                            if (payDate.getMonth() === currentMonth && payDate.getFullYear() === currentYear) timeMatch = true;
                        } else if (tFilter === 'CUSTOM_MONTH') {
                            const sDate = selectedDate || new Date();
                            if (payDate.getMonth() === sDate.getMonth() && payDate.getFullYear() === sDate.getFullYear()) timeMatch = true;
                        } else if (tFilter === 'YEAR') {
                            if (payDate.getFullYear() === currentYear) timeMatch = true;
                        }

                        // Aggregation
                        if (matchesCenter && matchesMode && timeMatch) {
                            // FIX: Only Count Verified Inflow
                            if (item.status === 'ACTIVE' || item.status === 'COMPLETED') {
                                filteredSum += payAmt;

                                // Center Dist
                                const cKey = item.centerId || 'UNKNOWN';
                                if (centerStats[cKey] !== undefined) centerStats[cKey] += payAmt;
                                else centerStats['UNKNOWN'] += payAmt;

                                // Mode Breakdown
                                if (payCategory === 'CASH') modeStats.Cash += payAmt;
                                else if (payCategory === 'KAPONLINE') modeStats.KAPONLINE += payAmt;
                                else if (payCategory === 'SHSONLINE') modeStats.SHSONLINE += payAmt;
                                else if (payCategory === 'CHEQUE') modeStats.Cheque += payAmt;
                                else if (payCategory === 'KAPQR') modeStats.KapQR += payAmt;
                                else if (payCategory === 'UJJIVANQR') modeStats.UjjivanQR += payAmt;
                                else if (payCategory === 'PosSHS') modeStats.PosSHS += payAmt;
                                else modeStats.Other += payAmt;
                            }
                        }

                        // Monthly Breakdown (Filtered by Center Only)
                        if (matchesCenter && payDate.getFullYear() === currentYear) {
                            const mIndex = payDate.getMonth();
                            if (monthlyData[mIndex]) {
                                monthlyData[mIndex].total += payAmt;
                                if (payCategory === 'CASH') monthlyData[mIndex].cash += payAmt;
                                else monthlyData[mIndex].online += payAmt;
                            }
                        }
                    }
                }
            });
        });

        setStats({
            totalCollection: filteredSum,
            pendingCount: pending,
            activeCount: active,
            modes: modeStats,
            monthlyBreakdown: monthlyData,
            centerDistribution: centerStats,
            totalOutstanding: totalOutstanding
        });
    };

    useEffect(() => { fetchData(); }, []);

    // Filter Logic for Lists
    const filterStudentByMode = (student) => {
        if (modeFilter === 'ALL') return true;
        const payments = Array.isArray(student.payments) ? student.payments : [];
        return payments.some(p => {
            const m = String(p.mode || '').toUpperCase();
            if (modeFilter === 'CASH') return m.includes('CASH');
            if (modeFilter === 'KAPONLINE') return m.includes('UPI') || m.includes('ONLINE') || m.includes('GPAY');
            if (modeFilter === 'SHSONLINE') return m.includes('CARD') || m.includes('SHS') || m.includes('NETBANKING');
            if (modeFilter === 'CHEQUE') return m.includes('CHEQUE');
            if (modeFilter === 'KAPQR') return m.includes('KAP') || m.includes('AXIS');
            if (modeFilter === 'UJJIVANQR') return m.includes('UJJIVAN') || m.includes('UJAN');
            if (modeFilter === 'PosSHS') return m.includes('POS') || m.includes('SWIPE');
            return false;
        });
    };

    // Helper: Safe Date Parser
    const safeDate = (input) => {
        if (!input) return null;
        if (input.seconds) return new Date(input.seconds * 1000); // Firestore Timestamp
        const d = new Date(input);
        return isNaN(d.getTime()) ? null : d;
    };

    // Helper: Time Filter for Created At (Admission Date)
    const filterByTime = (student) => {
        if (timeFilter === 'YEAR') return true; // Default view all for Year or default
        const d = safeDate(student.createdAt);
        if (!d) return false; // If invalid date, skip for Today/Month filter

        const now = new Date();
        const todayDate = now.toDateString();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        if (timeFilter === 'TODAY') return d.toDateString() === todayDate;
        if (timeFilter === 'MONTH') return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        if (timeFilter === 'CUSTOM_MONTH') {
            const sDate = selectedDate || new Date();
            return d.getMonth() === sDate.getMonth() && d.getFullYear() === sDate.getFullYear();
        }
        return true;
    };

    const filteredDataByCenter = allData.filter(item =>
        (centerFilter === 'ALL' || item.centerId === centerFilter) &&
        filterStudentByMode(item)
    );

    const pendingList = filteredDataByCenter.filter(s => {
        const status = String(s.status || "").toUpperCase();
        const matchesStatus = status === 'TOKEN_PAID' || status === 'CONVERTED' || status === 'PENDING_APPROVAL';
        const matchesSearch = String(s.studentName || "").toLowerCase().includes(searchTerm.toLowerCase()) || String(s.phone || "").includes(searchTerm);
        return matchesStatus && matchesSearch;
    });

    // ACTIVE LIST: Restore Filters (Mode & Time) as per user request
    const activeList = filteredDataByCenter.filter(s => {
        // 1. Status (Active OR Completed to show zero balance students)
        const status = String(s.status || "").toUpperCase();
        const isValidStatus = status === 'ACTIVE' || status === 'COMPLETED';

        // 2. Search
        const matchesSearch = String(s.studentName || "").toLowerCase().includes(searchTerm.toLowerCase()) || String(s.phone || "").includes(searchTerm);

        // 3. Time Filter (Restored)
        const matchesTime = filterByTime(s);

        return isValidStatus && matchesSearch && matchesTime;
    });

    const tieUpList = filteredDataByCenter.filter(s => s.tieUpCollege && String(s.tieUpCollege).trim() !== "");

    // NEW: Retooling Queue Logic
    // NEW: Retooling Queue Logic (Multi-Stage)
    const getInstallmentStage = (s) => {
        const paid = Number(s.totalPaid || 0);

        // 1. If Explicit Installments Exist
        if (s.installments && Array.isArray(s.installments) && s.installments.length > 0) {
            let cleared = 0;
            let cumulative = 0;
            for (let i = 0; i < s.installments.length; i++) {
                cumulative += Number(s.installments[i].amount || 0);
                // Tolerance of 500rs for minor adjustments
                if (paid >= (cumulative - 500)) {
                    cleared = i + 1;
                } else {
                    break;
                }
            }
            return cleared;
        }

        // 2. Fallback: Program-Aware Percentage (Smart Fallback)
        const total = Number(s.amount || 1);
        const pct = paid / total;

        // Determine Program Type for Thresholds
        const pName = (s.program || "").toUpperCase();
        const isTwoYear = pName.includes("2Y") || pName.includes("11TH") || pName.includes("TWO");

        // 2 Year Program: 1st Inst is ~50%
        // 1 Year Program: 1st Inst is ~60%
        const threshold1 = isTwoYear ? 0.45 : 0.55; // 5-10% buffer
        const threshold2 = isTwoYear ? 0.70 : 0.95; // 2nd Inst

        if (pct >= 0.98) return 3; // Fully Paid
        if (pct >= threshold2) return 2; // Cleared 2nd Inst
        if (pct >= threshold1) return 1; // Cleared 1st Inst

        return 0; // Not enough for 1st inst
    };

    const retoolingList = activeList
        .filter(s => s.admissionMode === 'ONLINE')
        .map(s => ({ ...s, currentStage: getInstallmentStage(s) }))
        .filter(s => s.currentStage > (s.retoolingProcessedStage || 0) && s.currentStage > 0);

    const handleRetoolingDone = async (id, stage) => {
        if (!window.confirm(`Mark Retooling as DONE for Installment ${stage}?`)) return;
        try {
            const ref = doc(db, "admissions", id);
            await updateDoc(ref, {
                retoolingProcessedStage: stage,
                retoolingStatus: 'DONE' // Keep for legacy compatibility if needed
            });
            alert("Updated Successfully!");
            fetchData();
        } catch (e) { console.error(e); alert("Failed to update."); }
    };

    // EXPORT FUNCTIONS
    const exportToCSV = (data, filename) => {
        if (!data || data.length === 0) return alert("No data to export!");

        const headers = ["Date", "Student Name", "Roll No", "Program", "Center", "Total Fee", "Paid", "Balance", "Tie-Up College", "Status"];
        const csvContent = [
            headers.join(","),
            ...data.map(item => [
                safeDate(item.createdAt) ? safeDate(item.createdAt).toLocaleDateString() : '-',
                `"${item.studentName}"`,
                item.rollNumber || '-',
                `"${item.program}"`,
                item.centerId,
                item.amount,
                item.totalPaid,
                (item.amount - item.totalPaid),
                `"${item.tieUpCollege || '-'}"`,
                item.status
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper for Greeting
    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return "Good Morning";
        if (h < 18) return "Good Afternoon";
        return "Good Evening";
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen font-sans text-slate-800">

            {/* Custom Styles for Simple Animations */}
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-enter { animation: fadeInUp 0.5s ease-out forwards; }
                .delay-100 { animation-delay: 0.1s; }
                .delay-200 { animation-delay: 0.2s; }
                .delay-300 { animation-delay: 0.3s; }
            `}</style>

            {/* PROFESSIONAL HEADER (Premium Finance Theme) */}
            <div className="animate-enter bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 md:p-8 mb-8 shadow-2xl shadow-emerald-900/20 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden group border border-emerald-900/30">
                {/* Decorative & Animation - Finance Themed Blobs */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>

                <div className="relative z-10 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                        <span className="px-3 py-1 rounded-full bg-emerald-900/50 border border-emerald-700/50 text-[10px] font-bold text-emerald-400 flex items-center gap-1 uppercase tracking-wider backdrop-blur-sm">
                            <Wallet className="w-3 h-3" /> Accountant Console
                        </span>
                        <span className="text-slate-500 text-xs font-mono">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
                        {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-teal-400">{userProfile?.name?.split(' ')[0] || 'Finance Team'}</span>
                    </h1>
                    <p className="text-slate-400 text-sm max-w-lg">
                        Managing financial overview for <span className="font-semibold text-emerald-200">{centerFilter === 'ALL' ? 'All Centers' : CENTERS[centerFilter]?.name}</span>.
                    </p>
                </div>

                {/* FILTERS BAR (Glass Style for Dark BG) */}
                <div className="flex flex-wrap justify-center items-center gap-3 relative z-10">
                    {/* Time */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-md cursor-pointer group/filter shadow-lg shadow-black/20">
                        <Calendar className="w-4 h-4 text-emerald-400 group-hover/filter:text-emerald-300 transition-colors" />
                        <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} className="bg-transparent font-bold text-slate-200 outline-none text-xs cursor-pointer [&>option]:text-slate-900 min-w-[80px]">
                            <option value="TODAY">Today</option>
                            <option value="MONTH">This Month</option>
                            <option value="CUSTOM_MONTH">Select Month</option>
                            <option value="YEAR">This Year</option>
                        </select>
                    </div>

                    {/* Custom Month/Year Picker - Only visible if CUSTOM_MONTH is selected */}
                    {timeFilter === 'CUSTOM_MONTH' && (
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-900/40 rounded-xl border border-emerald-500/30 hover:bg-emerald-900/60 transition-colors backdrop-blur-md cursor-pointer group/filter animate-in fade-in slide-in-from-left-2 shadow-lg">
                            <select
                                value={new Date(selectedDate || new Date()).getMonth()}
                                onChange={(e) => {
                                    const d = new Date(selectedDate || new Date());
                                    d.setMonth(parseInt(e.target.value));
                                    setSelectedDate(d);
                                }}
                                className="bg-transparent font-bold text-emerald-100 outline-none text-xs cursor-pointer [&>option]:text-slate-900 w-24"
                            >
                                {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                                ))}
                            </select>
                            <select
                                value={new Date(selectedDate || new Date()).getFullYear()}
                                onChange={(e) => {
                                    const d = new Date(selectedDate || new Date());
                                    d.setFullYear(parseInt(e.target.value));
                                    setSelectedDate(d);
                                }}
                                className="bg-transparent font-bold text-emerald-100 outline-none text-xs cursor-pointer [&>option]:text-slate-900 w-16"
                            >
                                {Array.from({ length: 5 }, (_, i) => (
                                    <option key={i} value={new Date().getFullYear() - 2 + i}>{new Date().getFullYear() - 2 + i}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Center */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-md cursor-pointer group/filter shadow-lg shadow-black/20">
                        <Building2 className="w-4 h-4 text-emerald-400 group-hover/filter:text-emerald-300 transition-colors" />
                        <select value={centerFilter} onChange={(e) => setCenterFilter(e.target.value)} className="bg-transparent font-bold text-slate-200 outline-none text-xs cursor-pointer max-w-[120px] [&>option]:text-slate-900">
                            <option value="ALL">All Centers</option>
                            {Object.values(CENTERS).map(c => <option key={c.id} value={c.id}>{c.brand}</option>)}
                        </select>
                    </div>

                    {/* Mode */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-md cursor-pointer group/filter shadow-lg shadow-black/20">
                        <Wallet className="w-4 h-4 text-emerald-400 group-hover/filter:text-emerald-300 transition-colors" />
                        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className="bg-transparent font-bold text-slate-200 outline-none text-xs cursor-pointer [&>option]:text-slate-900 min-w-[80px]">
                            <option value="ALL">All Modes</option>
                            <option value="KAPONLINE">KAP Online (RTGS/NEFT)</option>
                            <option value="CASH">Cash</option>
                            <option value="CHEQUE">Cheque</option>
                            <option value="KAPQR">KAP QR (AXIS)</option>
                            <option value="UJJIVANQR">Ujjivan QR</option>
                            <option value="PosSHS">POS - SHS</option>
                            <option value="SHSONLINE">SHS Online (RTGS/NEFT)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* DATA INTEGRITY DEBUGGER */}
            {(() => {
                const mismatches = allData.filter(student => (centerFilter === 'ALL' || student.centerId === centerFilter)).map(s => {
                    const sumPayments = (Array.isArray(s.payments) ? s.payments : []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
                    const aggPaid = Number(s.totalPaid || 0);
                    const diff = sumPayments - aggPaid;
                    return { ...s, sumPayments, aggPaid, diff };
                }).filter(r => Math.abs(r.diff) > 1);

                if (mismatches.length === 0) return null;

                return (
                    <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl text-xs font-mono text-orange-900">
                        <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-orange-600" /> Data Integrity Mismatch (Auto-Corrected)
                        </h3>
                        <p className="mb-2">
                            The following students have "Payment History" &gt; "Total Paid".
                            <strong> The dashboard has auto-corrected the stats to match the 'Manager View'</strong>, but you should verify these records in the database.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {mismatches.map(m => (
                                <div key={m.id} className="bg-white p-2 border rounded shadow-sm opacity-75">
                                    <strong>{m.studentName}</strong><br />
                                    Manager Ref: ₹{m.aggPaid}<br />
                                    History Sum: ₹{m.sumPayments}<br />
                                    <span className="font-bold text-red-500">Diff: ₹{m.diff}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* 1. STATS OVERVIEW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 group-stats">

                {/* Total Collection */}
                <div className="animate-enter delay-100 relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/50 rounded-2xl p-6 shadow-sm border border-emerald-100/50 flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-emerald-600/70">Total Inflow</p>
                            <h3 className="text-4xl font-black text-slate-800 mt-2 tracking-tight">₹ {stats.totalCollection.toLocaleString('en-IN')}</h3>
                        </div>
                        <div className="p-3 bg-white shadow-sm text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 relative z-10">
                        <span className="px-2 py-1 bg-white/60 backdrop-blur-sm rounded border border-emerald-100">{timeFilter}</span>
                        <span className="px-2 py-1 bg-white/60 backdrop-blur-sm rounded border border-emerald-100">{modeFilter}</span>
                    </div>
                </div>

                {/* Receivables */}
                <div className="animate-enter delay-200 relative overflow-hidden bg-gradient-to-br from-white to-rose-50/50 rounded-2xl p-6 shadow-sm border border-rose-100/50 flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-100/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-rose-600/70">Outstanding</p>
                            <h3 className="text-4xl font-black text-slate-800 mt-2 tracking-tight">₹ {Number(stats.totalOutstanding || 0).toLocaleString('en-IN')}</h3>
                        </div>
                        <div className="p-3 bg-white shadow-sm text-rose-600 rounded-xl group-hover:scale-110 transition-transform">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                    </div>
                    <p className="text-xs text-rose-600 font-bold mt-2 relative z-10 flex items-center gap-1 group-hover:gap-2 transition-all">
                        Pending from Active <ArrowRight className="w-3 h-3" />
                    </p>
                </div>

                {/* Pending Approvals (Renamed from Queue) */}
                <div
                    onClick={() => setActiveTab('VERIFY')}
                    className="animate-enter delay-300 relative overflow-hidden bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] rounded-2xl p-6 shadow-lg shadow-blue-200 cursor-pointer text-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                >
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-white/20 transition-all pointer-events-none"></div>
                    <div className="flex justify-between items-start h-full relative z-10">
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-blue-100 mb-1">Action Required</p>
                            <h3 className="text-5xl font-black text-white mt-2">{stats.pendingCount}</h3>
                            <p className="text-blue-100 font-bold text-sm mt-1">Pending Approvals</p>

                            <div className="inline-flex items-center gap-2 mt-4 bg-white/20 px-4 py-2 rounded-lg backdrop-blur-md text-xs font-bold hover:bg-white/30 transition-colors">
                                Verify Now <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                        <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl">
                            <Clock className="w-8 h-8 text-white" />
                        </div>
                    </div>
                </div>
            </div>

            {/* 1.5 DETAILED MODE BREAKDOWN (Ungrouped & Animated) */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8 animate-enter delay-300">
                {[
                    { label: 'KAP Online (RTGS/NEFT)', val: stats.modes.KAPONLINE, color: 'text-blue-700 bg-blue-50/50 border-blue-200 hover:bg-blue-100', icon: Smartphone },
                    { label: 'Cash', val: stats.modes.Cash, color: 'text-emerald-700 bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100', icon: Banknote },
                    { label: 'Cheque', val: stats.modes.Cheque, color: 'text-purple-700 bg-purple-50/50 border-purple-200 hover:bg-purple-100', icon: FileSignature },
                    { label: 'KAP QR (AXIS)', val: stats.modes.KapQR, color: 'text-indigo-700 bg-indigo-50/50 border-indigo-200 hover:bg-indigo-100', icon: QrCode },
                    { label: 'Ujjivan QR', val: stats.modes.UjjivanQR, color: 'text-pink-700 bg-pink-50/50 border-pink-200 hover:bg-pink-100', icon: Landmark },
                    { label: 'POS - SHS', val: stats.modes.PosSHS, color: 'text-orange-700 bg-orange-50/50 border-orange-200 hover:bg-orange-100', icon: Terminal },
                    { label: 'SHS Online (RTGS/NEFT)', val: stats.modes.SHSONLINE, color: 'text-teal-700 bg-teal-50/50 border-teal-200 hover:bg-teal-100', icon: CreditCard },
                    { label: 'Other', val: stats.modes.Other, color: 'text-slate-700 bg-slate-100 border-slate-200 hover:bg-slate-200', icon: MoreHorizontal },
                ].map((m, i) => (
                    <div key={i} className={`rounded-xl p-4 border ${m.color} flex flex-col items-center justify-center text-center transition-all duration-300 hover:shadow-md hover:-translate-y-1 cursor-default group`}>
                        <div className="mb-2 p-2 rounded-full bg-white/60 backdrop-blur-sm shadow-sm group-hover:scale-110 transition-transform">
                            <m.icon className="w-5 h-5 opacity-80" />
                        </div>
                        <p className="text-[10px] font-black uppercase opacity-60 mb-1 tracking-wider">{m.label}</p>
                        <p className="text-lg font-black tracking-tight group-hover:scale-105 transition-transform">₹ {(m.val || 0).toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>

            {/* 2. NAVIGATION TABS */}
            <div className="flex items-center gap-8 mb-6 border-b border-slate-200 sticky top-0 bg-slate-50 z-20 pt-2 animate-enter delay-200">
                {[
                    { id: 'VERIFY', label: 'Verifications', icon: CheckCircle },
                    { id: 'COLLECT', label: 'Collections', icon: Wallet },
                    { id: 'RETOOL', label: 'Retooling', icon: Terminal }, // New Tab
                    { id: 'TIEUPS', label: 'Tie-Ups', icon: School },
                    { id: 'LOANS', label: 'Loan Verification', icon: Banknote },
                    { id: 'REPORTS', label: 'Reports', icon: FileText },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === tab.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`
                            .replace('border-primary-500', tab.id === 'VERIFY' ? 'border-[#1E3A8A]' : 'border-slate-800')
                            .replace('text-primary-600', tab.id === 'VERIFY' ? 'text-[#1E3A8A]' : 'text-slate-800')
                        }
                    >
                        <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? (tab.id === 'VERIFY' ? 'text-[#1E3A8A]' : 'text-slate-800') : 'text-slate-400'}`} />
                        {tab.label}
                        {tab.id === 'VERIFY' && stats.pendingCount > 0 && <span className="bg-blue-50 text-[#1E3A8A] text-[10px] px-2 py-0.5 rounded-full border border-blue-100">{stats.pendingCount}</span>}
                        {tab.id === 'LOANS' && loanQueue.length > 0 && <span className="bg-orange-50 text-orange-600 text-[10px] px-2 py-0.5 rounded-full border border-orange-100">{loanQueue.length}</span>}
                        {tab.id === 'RETOOL' && retoolingList.length > 0 && <span className="bg-purple-50 text-purple-600 text-[10px] px-2 py-0.5 rounded-full border border-purple-100">{retoolingList.length}</span>}
                    </button>
                ))}
            </div>

            {/* 3. MAIN CONTENT CONTAINER */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[500px] overflow-hidden animate-enter delay-300">

                {/* TAB: VERIFICATIONS */}
                {activeTab === 'VERIFY' && (
                    <>
                        <div className="p-4 border-b border-slate-100 flex justify-end bg-slate-50/50">
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search by Student Name..."
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        {['Date', 'Student', 'Amount', 'Payment Mode', 'Action'].map(h => (
                                            <th key={h} className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {pendingList.length > 0 ? pendingList.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-5 text-sm font-medium text-slate-500">
                                                {safeDate(item.createdAt) ? safeDate(item.createdAt).toLocaleDateString('en-IN') : '-'}
                                            </td>
                                            <td className="p-5">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-sm">{item.studentName}</span>
                                                    <span className="text-xs text-slate-400">{item.program || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="p-5 font-bold text-slate-700">₹ {item.amount?.toLocaleString()}</td>
                                            <td className="p-5">
                                                <span className="px-3 py-1 rounded text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                    {item.paymentMode || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <button onClick={() => navigate(`/staff/admission/${item.id}`)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm transition-all hover:scale-105 active:scale-95">
                                                    Verify & Admit <ArrowRight className="w-3 h-3" />
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="p-20 text-center">
                                                <div className="flex flex-col items-center justify-center opacity-40">
                                                    <CheckCircle className="w-16 h-16 text-slate-300 mb-4" />
                                                    <p className="text-lg font-bold text-slate-500">All Clear</p>
                                                    <p className="text-sm text-slate-400">No pending payments to verify.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* TAB: RETOOLING QUEUE */}
                {activeTab === 'RETOOL' && (
                    <div className="p-6">
                        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Terminal className="w-5 h-5" /></div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Online Student Retooling</h3>
                                    <p className="text-xs text-slate-400">Students who have paid installments and need account updates.</p>
                                </div>
                            </div>
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search by Student Name..."
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>{['Date', 'Student', 'Center', 'Paid / Stage', 'Status', 'Actions'].map(h => <th key={h} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {retoolingList.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 text-slate-500 text-xs font-medium">{safeDate(item.createdAt) ? safeDate(item.createdAt).toLocaleDateString() : '-'}</td>
                                            <td className="p-4 cursor-pointer group/name" onClick={() => setViewProfile(item)}>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-sm group-hover/name:text-blue-600 transition-colors flex items-center gap-2">
                                                        {item.studentName} <FileText className="w-3 h-3 opacity-0 group-hover/name:opacity-100" />
                                                    </span>
                                                    <span className="text-xs text-slate-400">{item.program}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-400">{item.centerId}</td>
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-emerald-600 text-sm">₹ {(item.totalPaid || 0).toLocaleString()}</span>
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase">
                                                        Cleared Installment {item.currentStage}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded text-[10px] font-bold border border-purple-100 uppercase">
                                                    Action Pending
                                                </span>
                                            </td>
                                            <td className="p-4 flex items-center gap-2">
                                                <button
                                                    onClick={() => setViewProfile(item)}
                                                    className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
                                                    title="View Full Profile"
                                                >
                                                    <Search className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleRetoolingDone(item.id, item.currentStage)}
                                                    className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black shadow-md shadow-purple-100 transition-all hover:scale-105 active:scale-95"
                                                >
                                                    <CheckCircle className="w-3 h-3 text-emerald-400" /> Mark Done
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {retoolingList.length === 0 && (
                                        <tr><td colSpan="6" className="p-12 text-center text-slate-400 font-medium italic">No pending retooling students.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB: COLLECTIONS */}
                {activeTab === 'COLLECT' && (
                    <div className="p-6">
                        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                            <div className="relative w-full md:w-96 flex items-center gap-4">
                                <div className="relative w-full">
                                    <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                    <input
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Search by Name, Phone..."
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-semibold"
                                    />
                                </div>
                                <div className="whitespace-nowrap text-xs font-bold text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                                    Showing <span className="text-indigo-600">{Math.min(activeList.length, limitCount)}</span> of <span className="text-slate-800">{activeList.length}</span>
                                </div>
                            </div>
                            <button onClick={() => exportToCSV(activeList, "Fee_Collection")} className="flex items-center gap-2 px-4 py-2 bg-white text-emerald-700 border border-emerald-200 rounded-lg text-sm font-bold hover:bg-emerald-50 transition shadow-sm hover:scale-105 active:scale-95">
                                <Download className="w-4 h-4" /> Export CSV
                            </button>
                        </div>

                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        {['Roll No', 'Mode', 'Student', 'Center', 'Total Fee', 'Paid', 'Balance', 'Action'].map(h => (
                                            <th key={h} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {activeList.slice(0, limitCount).map(item => {
                                        const balance = (item.amount || 0) - (item.totalPaid || 0);
                                        const isOnline = item.admissionMode === 'ONLINE';
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 text-xs font-mono font-bold text-slate-500">{item.rollNumber || 'PENDING'}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${isOnline ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                        {item.admissionMode || 'OFFLINE'}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-bold text-slate-700 text-sm">{item.studentName}</td>
                                                <td className="p-4 text-xs font-bold text-slate-400">{item.centerId}</td>

                                                <td className="p-4 text-sm font-medium text-slate-600">₹ {(item.amount || 0).toLocaleString()}</td>
                                                <td className="p-4 text-sm font-bold text-emerald-600">₹ {(item.totalPaid || 0).toLocaleString()}</td>
                                                <td className="p-4 text-sm font-bold">
                                                    <span className={balance > 0 ? "text-rose-500" : "text-slate-300"}>₹ {balance.toLocaleString()}</span>
                                                </td>
                                                <td className="p-4">
                                                    <button onClick={() => setSelectedStudent(item)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition hover:scale-110">
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {activeList.length === 0 && (
                                        <tr><td colSpan="7" className="p-12 text-center text-slate-400 font-medium italic">No students found matching filters.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* LOAD MORE PAGINATION */}
                        {activeList.length > limitCount && (
                            <div className="mt-4 flex justify-center pb-4">
                                <button
                                    onClick={() => setLimitCount(prev => prev + 20)}
                                    className="group flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-full text-slate-600 font-bold text-sm shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-all hover:shadow-md animate-enter"
                                >
                                    <span>Load More Students</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: TIE-UPS */}
                {activeTab === 'TIEUPS' && (
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><School className="w-5 h-5" /></div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">College Partnerships</h3>
                                </div>
                            </div>
                            <button onClick={() => exportToCSV(tieUpList, "College_TieUps")} className="flex items-center gap-2 px-3 py-1.5 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-50 transition shadow-sm hover:scale-105 active:scale-95">
                                <Download className="w-3 h-3" /> Export List
                            </button>
                        </div>

                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>{['Date', 'Student', 'College', 'Roll No', 'Status'].map(h => <th key={h} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {tieUpList.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 text-slate-500 text-xs font-medium">{safeDate(item.createdAt) ? safeDate(item.createdAt).toLocaleDateString() : '-'}</td>
                                            <td className="p-4 font-bold text-slate-700">{item.studentName}</td>
                                            <td className="p-4 text-indigo-600 font-bold text-sm">{item.tieUpCollege}</td>
                                            <td className="p-4 font-mono text-xs text-slate-400">{item.rollNumber || '-'}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${item.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB: LOAN VERIFICATION */}
                {activeTab === 'LOANS' && (
                    <div className="p-6">
                        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Banknote className="w-5 h-5" /></div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Loan Disbursal Queue</h3>
                                    <p className="text-xs text-slate-400">Verify and disburse sanctioned loans</p>
                                </div>
                            </div>
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search by Student Name..."
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>{['Date', 'Student', 'Down Payment (Paid)', 'Loan Amount (Pending)', 'Aadhar', 'Action'].map(h => <th key={h} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loanQueue.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 text-slate-500 text-xs font-medium">{item.enrollmentDate || '-'}</td>
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-sm">{item.studentName}</span>
                                                    <span className="text-xs text-slate-400">{item.program}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 font-bold text-emerald-600 text-sm">₹ {(item.downPayment || 0).toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">(RECVD)</span></td>
                                            <td className="p-4 font-black text-orange-600 text-sm">₹ {(item.loanAmount || 0).toLocaleString()}</td>
                                            <td className="p-4 text-xs font-mono text-slate-500">{item.aadhar || 'Pending'}</td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => handleDisburseLoan(item)}
                                                    className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black shadow-lg shadow-orange-100 transition-all hover:scale-105 active:scale-95"
                                                >
                                                    <CheckCircle className="w-3 h-3 text-emerald-400" /> Disburse Loan

                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {loanQueue.length === 0 && (
                                        <tr><td colSpan="6" className="p-12 text-center text-slate-400 font-medium italic">No pending loans found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}


                {/* TAB: REPORTS */}
                {activeTab === 'REPORTS' && (
                    <div className="p-8">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-slate-400" />
                                Monthly Breakdown
                            </h2>
                            <button onClick={() => window.print()} className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition hover:scale-105"><Printer className="w-4 h-4" /> Print Sheet</button>
                        </div>

                        <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-800 text-white uppercase text-[10px] tracking-widest">
                                    <tr>
                                        <th className="p-4">Month</th>
                                        <th className="p-4 text-right">Cash</th>
                                        <th className="p-4 text-right">Online (UPI/QR)</th>
                                        <th className="p-4 text-right bg-slate-900 font-bold text-orange-400">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {stats.monthlyBreakdown.map((m, i) => (
                                        <tr key={i} className={`hover:bg-slate-50 transition ${m.total > 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                                            <td className="p-4 font-bold text-slate-600">{m.month}</td>
                                            <td className="p-4 text-right text-emerald-600 font-mono font-medium opacity-80">₹ {m.cash.toLocaleString()}</td>
                                            <td className="p-4 text-right text-blue-600 font-mono font-medium opacity-80">₹ {m.online.toLocaleString()}</td>
                                            <td className="p-4 text-right font-bold text-slate-800 font-mono bg-slate-50">₹ {m.total.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-100 border-t-2 border-slate-200">
                                        <td className="p-4 font-black text-slate-800 text-xs uppercase tracking-widest">Grand Total</td>
                                        <td className="p-4 text-right font-bold text-emerald-700">₹ {stats.monthlyBreakdown.reduce((a, b) => a + b.cash, 0).toLocaleString()}</td>
                                        <td className="p-4 text-right font-bold text-blue-700">₹ {stats.monthlyBreakdown.reduce((a, b) => a + b.online, 0).toLocaleString()}</td>
                                        <td className="p-4 text-right font-black text-slate-900 text-lg">₹ {stats.monthlyBreakdown.reduce((a, b) => a + b.total, 0).toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL: PAYMENT MANAGER */}
            {
                selectedStudent && (
                    <StudentManager
                        student={selectedStudent}
                        onClose={() => setSelectedStudent(null)}
                        refreshData={fetchData}
                        userProfile={userProfile}
                    />
                )
            }

            {/* MODAL: ACADEMIC PROFILE (Retooling View) */}
            {
                viewProfile && (
                    <StudentAcademicProfile
                        student={viewProfile}
                        onClose={() => setViewProfile(null)}
                    // Optional: onUpdate if needed, but Retooling is mostly about payments triggering status
                    />
                )
            }
        </div >
    );
};

export default AccountantDashboard;
