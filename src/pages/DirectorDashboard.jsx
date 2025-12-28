import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, where, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { Search, FileText, UserCog, RefreshCw, Check, X, Bell, MapPin, Calendar, DollarSign, Filter, TrendingUp, Users, AlertOctagon, Wallet, Download, LayoutDashboard, CheckCircle, UserCheck } from 'lucide-react';
import { generateTokenReceipt } from '../utils/pdfGenerator';
import StudentManager from '../components/StudentManager'; // Import the Modal
import { fetchPendingApprovals, processApproval } from '../services/approvalService';
import { fetchDirectorStats } from '../services/statsService';
import { createCounselorAccount, fetchStaffList, deleteCounselorProfile, fetchPendingUsers, approveUser, rejectUser } from '../services/userService'; // New Imports
import PerformanceReport from '../modules/admin/components/PerformanceReport';
import { exportToCSV, formatAdmissionsForExport } from '../utils/exportUtils';
import { Trash2, UserPlus, Shield, AlertTriangle, Briefcase } from 'lucide-react'; // New Icons
import BDEManager from '../components/BDEManager'; // NEW IMPORT

// Hardened DirectorDashboard.jsx
const DirectorDashboard = ({ center, isManager, userProfile }) => {
    const [admissions, setAdmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [approvals, setApprovals] = useState([]);
    const [pendingUsers, setPendingUsers] = useState([]); // New State
    const [stats, setStats] = useState({ revenue: 0, students: 0, pending: 0 });
    const [viewCenter, setViewCenter] = useState(isManager ? (center?.id || 'UN_COLLEGE') : 'ALL');
    const [teamMembers, setTeamMembers] = useState([]);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [isBDEModalOpen, setIsBDEModalOpen] = useState(false); // NEW STATE
    const [reminders, setReminders] = useState([]); // Reminder State
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '' });
    const [creatingUser, setCreatingUser] = useState(false);
    const [activeTab, setActiveTab] = useState('OVERVIEW');
    const [staffCounts, setStaffCounts] = useState({ total: 0, filtered: 0 }); // Debug State

    // COMPARISON STATE
    const [compC1, setCompC1] = useState('UN_COLLEGE');
    const [compC2, setCompC2] = useState('PRAYAS');
    const [compStats, setCompStats] = useState({ c1: null, c2: null });

    // Safe Data Fetching
    const fetchData = async () => {
        setLoading(true);
        try {
            const currentViewCenter = isManager ? (center?.id || viewCenter) : viewCenter;

            // 1. Fetch Admissions
            // 1. Fetch Admissions (Robust Fix)
            try {
                const transactionsRef = collection(db, "admissions");
                // Fetch ALL admissions ordered by date. 
                // We filter client-side to handle "Center ID" vs "Center Name" mismatches (Legacy Data Issue)
                const q = query(transactionsRef, orderBy("createdAt", "desc"));

                const querySnapshot = await getDocs(q);
                const allData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                window.admissionsAllRaw = allData; // Expose for Diff Detective Debugging

                if (currentViewCenter !== 'ALL') {
                    // 1. FILTER BY CENTER (Raw Data for Financials)
                    const rawCenterData = allData.filter(txn => {
                        const txnCenterId = (txn.centerId || "").trim().toUpperCase();
                        const txnCenterName = (txn.centerName || "").trim().toUpperCase();
                        const viewId = (currentViewCenter || "").trim().toUpperCase();

                        // 1. Strict Match first
                        if (txnCenterId === viewId) return true;

                        // 2. Legacy / Fuzzy Logic (Handle with care)
                        if (viewId === 'UN_COLLEGE') {
                            // Default: If Empty, assume College Road. STRICTLY exclude other markers.
                            return (txnCenterId === "" && !txnCenterName.includes("NASHIK RD") && !txnCenterName.includes("PRAYAS")) ||
                                txnCenterId.includes("COLLEGE") ||
                                txnCenterName.includes("COLLEGE");
                        }

                        if (viewId === 'UN_NASHIK_RD') {
                            return txnCenterId.includes("NASHIK RD") ||
                                txnCenterName.includes("NASHIK RD") ||
                                txnCenterName.includes("NASHIK ROAD") ||
                                txnCenterName.includes("JAIL");
                        }

                        if (viewId === 'PRAYAS') {
                            return txnCenterId.includes("PRAYAS") || txnCenterName.includes("PRAYAS");
                        }

                        // Fallback: If Center Name matches View Name purely
                        const viewName = (center?.name || "").trim().toUpperCase();
                        if (viewName && txnCenterName && txnCenterName.includes(viewName)) return true;

                        return false;
                    });

                    // 2. FILTER BY STATUS (Operational Data for List & Pending)
                    // We only list and count pending for Active/Paid/Completed. Dropped/Cancelled are hidden.
                    const activeData = rawCenterData.filter(txn => ['ACTIVE', 'TOKEN_PAID', 'COMPLETED'].includes(txn.status));

                    setAdmissions(activeData); // Table shows only Active

                    // 3. CALCULATE STATS
                    let totalRev = 0;
                    let todayRev = 0;
                    let pendingSum = 0;
                    const today = new Date();

                    // REVENUE: Calculated from Verified records only
                    rawCenterData.forEach(d => {
                        // FIX: Only Count Verified Inflow
                        if (d.status === 'ACTIVE' || d.status === 'COMPLETED') {
                            const paid = Number(d.totalPaid || 0);
                            totalRev += paid;

                            const txnDate = d.createdAt ? new Date(d.createdAt.seconds * 1000) : null;
                            if (txnDate && txnDate.getDate() === today.getDate() &&
                                txnDate.getMonth() === today.getMonth() &&
                                txnDate.getFullYear() === today.getFullYear()) {
                                todayRev += paid;
                            }
                        }
                    });

                    // PENDING: Calculated ONLY from Active records (so we don't chase dead leads)
                    activeData.forEach(d => {
                        const paid = Number(d.totalPaid || 0);
                        const fee = Number(d.amount || 0);
                        const due = fee - paid;
                        if (due > 0) pendingSum += due;
                    });

                    setStats({
                        revenue: totalRev,
                        todayRevenue: todayRev,
                        students: activeData.length,
                        pending: pendingSum
                    });

                    // DEBUG STATE
                    window.lastFilterStats = {
                        total: allData.length,
                        rawCenter: rawCenterData.length,
                        active: activeData.length,
                        calculatedRev: totalRev,
                        pendingSum: pendingSum
                    };

                } else {
                    // DIRECTOR GLOBAL VIEW
                    // 1. Raw Data (Everything)
                    const rawCenterData = allData;

                    // 2. Active Data
                    const activeData = allData.filter(txn => ['ACTIVE', 'TOKEN_PAID', 'COMPLETED'].includes(txn.status));
                    setAdmissions(activeData);

                    // 3. Stats
                    let totalRev = 0;
                    let todayRev = 0;
                    let pendingSum = 0;
                    const today = new Date();

                    // Revenue from Verified Only
                    rawCenterData.forEach(d => {
                        // FIX: Only Count Verified Inflow
                        if (d.status === 'ACTIVE' || d.status === 'COMPLETED') {
                            const paid = Number(d.totalPaid || 0);
                            totalRev += paid;

                            const txnDate = d.createdAt ? new Date(d.createdAt.seconds * 1000) : null;
                            if (txnDate && txnDate.getDate() === today.getDate() &&
                                txnDate.getMonth() === today.getMonth() &&
                                txnDate.getFullYear() === today.getFullYear()) {
                                todayRev += paid;
                            }
                        }
                    });

                    // Pending from ACTIVE
                    activeData.forEach(d => {
                        const paid = Number(d.totalPaid || 0);
                        const fee = Number(d.amount || 0);
                        const due = fee - paid;
                        if (due > 0) pendingSum += due;
                    });

                    setStats({
                        revenue: totalRev,
                        todayRevenue: todayRev,
                        students: activeData.length,
                        pending: pendingSum
                    });
                }
            } catch (err) { console.error("Error fetching admissions:", err); }

            // 2. Fetch Approvals
            try {
                const pending = await fetchPendingApprovals();
                let filteredApprovals = pending || [];

                // Filter: Managers only see requests <= 70%. Directors see all.
                if (isManager) {
                    filteredApprovals = filteredApprovals.filter(a => {
                        // robustly parse percentage
                        const pct = parseFloat(a.discountPercentage || a.discount || 0);
                        return pct <= 70;
                    });
                }
                setApprovals(filteredApprovals);
            } catch (err) { console.error("Error fetching approvals:", err); }

            // 2b. Fetch Pending USERS
            try {
                const pUsers = await fetchPendingUsers(currentViewCenter);
                setPendingUsers(pUsers || []);
            } catch (err) { console.error("Error fetching pending users:", err); }

            // 4. Fetch Quick Reminders (Top 5 for Dashboard)
            try {
                const admissionsRef = collection(db, "admissions");
                const q = query(admissionsRef, where("status", "==", "ACTIVE"), orderBy("createdAt", "desc")); // Simplified fetch, filter in JS for now
                const snapshot = await getDocs(q);

                const dueList = [];
                const today = new Date();

                snapshot.docs.forEach(doc => {
                    const data = doc.data();

                    // Filter by Center (Robust)
                    const uCenter = (data.centerId || "").trim().toUpperCase();
                    const vCenter = (currentViewCenter || "").trim().toUpperCase();
                    const centerName = (center?.name || "").trim().toUpperCase();

                    const isVisible =
                        vCenter === 'ALL' ||
                        uCenter === vCenter ||
                        (centerName && uCenter.includes(centerName));

                    if (!isVisible) return;

                    const totalFee = data.amount || 0;
                    const paid = data.totalPaid || 0;
                    const balance = totalFee - paid;

                    if (balance > 0) {
                        // Quick Check: Is anything due?
                        // Simplified Logic: If balance > 0, show in list. 
                        // Detailed logic is in FeeRecovery page, here we just show "Top Pending"
                        dueList.push({
                            id: doc.id,
                            name: data.studentName,
                            phone: data.phone,
                            balance: balance,
                            daysLeft: 0 // Placeholder
                        });
                    }
                });
                // Sort by highest balance for now
                setReminders(dueList.sort((a, b) => b.balance - a.balance).slice(0, 5));

            } catch (err) { console.error("Error fetching reminders", err); }

            // 4. Fetch Team (Only if on Team Tab)
            if (activeTab === 'TEAM') {
                try {
                    // Fetch ALL staff
                    const staff = await fetchStaffList(null);

                    if (staff && Array.isArray(staff)) {
                        const filtered = staff.filter(u => {
                            // Fix 1: Include 'STAFF' role
                            const isTeamMember = ['COUNSELOR', 'COUNSELLOR', 'MANAGER', 'ACCOUNTANT', 'DIRECTOR', 'STAFF'].includes(u.role?.toUpperCase());

                            // Robust comparison
                            const uCenter = (u.centerId || "").trim();
                            const vCenter = (currentViewCenter || "").trim();

                            // Fix 2: Allow Accountants to be visible even if Center ID is missing/mismatch
                            // Fix 3: Allow matching against Center Name as well (Legacy Data Support)
                            // If `center` prop is available (which it is for Managers), check against its name.
                            const centerName = center?.name || "";

                            const isVisibleCenter =
                                vCenter === 'ALL' ||
                                uCenter === vCenter ||
                                (centerName && uCenter === centerName) ||
                                (u.role?.toUpperCase() === 'ACCOUNTANT' && uCenter === "");

                            return isTeamMember && isVisibleCenter;
                        });
                        setTeamMembers(filtered);
                        setStaffCounts({ total: staff.length, filtered: filtered.length });
                    } else {
                        setTeamMembers([]);
                        setStaffCounts({ total: 0, filtered: 0 });
                    }
                } catch (err) {
                    console.error("Error fetching team:", err);
                    setTeamMembers([]);
                    setStaffCounts({ total: -1, filtered: 0 }); // -1 indicates error
                }
            }

        } catch (error) {
            console.error("Critical Error in fetchData wrapper:", error);

            // Don't crash the UI, just show empty state
        }
        setLoading(false);
    };

    // COMPARISON LOGIC
    useEffect(() => {
        if (activeTab === 'COMPARE') {
            const calculateCompStats = (centerId) => {
                if (!window.admissionsAllRaw) return { revenue: 0, students: 0, pending: 0 };

                const cData = window.admissionsAllRaw.filter(txn => {
                    const uCenter = (txn.centerId || "").trim().toUpperCase();
                    const uName = (txn.centerName || "").trim().toUpperCase();
                    const vCenter = (centerId || "").trim().toUpperCase();

                    // 1. Strict Match first
                    if (uCenter === vCenter) return true;

                    // 2. Legacy / Fuzzy Logic
                    if (vCenter === 'UN_COLLEGE') {
                        return (uCenter === "" && !uName.includes("NASHIK RD") && !uName.includes("PRAYAS")) ||
                            uCenter.includes("COLLEGE") ||
                            uName.includes("COLLEGE");
                    }

                    if (vCenter === 'UN_NASHIK_RD') {
                        return uCenter.includes("NASHIK RD") ||
                            uName.includes("NASHIK RD") ||
                            uName.includes("NASHIK ROAD") ||
                            uName.includes("JAIL");
                    }

                    if (vCenter === 'PRAYAS') {
                        return uCenter.includes("PRAYAS") || uName.includes("PRAYAS");
                    }

                    // Fallback
                    const cleanName = centerId.replace('UN_', '').replace('_', ' ');
                    if (uName.includes(cleanName)) return true;

                    return false;
                });

                const active = cData.filter(t => ['ACTIVE', 'TOKEN_PAID', 'COMPLETED'].includes(t.status));

                let rev = 0;
                let pending = 0;

                // Revenue (All)
                cData.forEach(d => rev += Number(d.totalPaid || 0));

                // Pending (Active Only)
                active.forEach(d => {
                    const fee = Number(d.amount || 0);
                    const paid = Number(d.totalPaid || 0);
                    if (fee > paid) pending += (fee - paid);
                });

                return {
                    revenue: rev,
                    students: active.length,
                    pending: pending,
                    avgTicket: active.length ? Math.round(rev / active.length) : 0
                };
            };

            setCompStats({
                c1: calculateCompStats(compC1),
                c2: calculateCompStats(compC2)
            });
        }
    }, [activeTab, compC1, compC2, admissions]); // Recalc when tab or selection changes

    const handleDecision = async (id, status) => {
        try {
            await processApproval(id, status, userProfile.name);
            setApprovals(prev => prev.filter(a => a.id !== id));
            alert(`Request ${status} successfully.`);
        } catch (err) {
            console.error("Error processing approval:", err);
            alert("Failed to update status. " + err.message);
        }
    };

    useEffect(() => {
        if (isManager && center?.id && viewCenter !== center.id) {
            setViewCenter(center.id);
        } else {
            fetchData();
        }
    }, [viewCenter, activeTab]);

    // Safety Checks for Rendering
    const safeStats = stats || { revenue: 0, students: 0, pending: 0 };
    const safeAdmissions = admissions || [];
    const filteredData = safeAdmissions.filter(student =>
        (student.studentName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.phone || "").includes(searchTerm)
    );
    const unassignedStudents = safeAdmissions.filter(s => s.status === 'ACTIVE' && !s.batchAssigned);

    const getProgramType = (program) => {
        const p = (program || "").toLowerCase();
        if (p.includes('jee')) return 'JEE';
        if (p.includes('neet')) return 'NEET';
        if (p.includes('mht') || p.includes('cet')) return 'MHT_CET';
        if (p.includes('foundation') || p.includes('8th') || p.includes('9th') || p.includes('10th')) return 'FOUNDATION';
        return 'OTHER';
    };

    const handleAssignBatch = async (studentId, batchName) => {
        if (!batchName) return;
        try {
            const docRef = doc(db, "admissions", studentId);
            await updateDoc(docRef, { batchAssigned: batchName });

            // Optimistic Update
            setAdmissions(prev => prev.map(s => s.id === studentId ? { ...s, batchAssigned: batchName } : s));

            // alert("Batch Assigned!");
        } catch (error) {
            console.error(error);
            alert("Error assigning batch");
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreatingUser(true);
        try {
            const role = 'COUNSELOR'; // Default for Manager adding users
            const centerId = isManager ? center?.id : 'UN_COLLEGE'; // Use manager's center

            await createCounselorAccount(newUser.email, newUser.password, newUser.name, role, centerId);
            setIsAddUserModalOpen(false);
            setNewUser({ name: '', email: '', password: '' });
            alert("Counselor account created successfully!");
            fetchData(); // Refresh list
        } catch (error) {
            console.error("Counselor Creation Error:", error);
            if (error.message && error.message.includes("auth/email-already-in-use")) {
                alert("This email is already registered. Please use a different email or ask the user to login.");
            } else {
                alert("Failed to create account. Reason: " + error.message);
            }
        }
        setCreatingUser(false);
    };

    // Helper for Premium Card Styles
    const getCardStyle = (type) => {
        if (isManager) return "bg-white border-gray-100";
        // Director Premium Styles
        switch (type) {
            case 'revenue': return "bg-gradient-to-br from-white to-blue-50 border-blue-100 shadow-blue-100/50";
            case 'today': return "bg-gradient-to-br from-white to-green-50 border-green-100 shadow-green-100/50";
            case 'students': return "bg-gradient-to-br from-white to-purple-50 border-purple-100 shadow-purple-100/50";
            case 'pending': return "bg-gradient-to-br from-white to-red-50 border-red-100 shadow-red-100/50";
            default: return "bg-white";
        }
    };

    const handleDeleteUser = async (uid) => {
        if (window.confirm("Are you sure you want to remove this user? This cannot be undone.")) {
            try {
                await deleteCounselorProfile(uid);
                setTeamMembers(prev => prev.filter(m => m.uid !== uid));
                alert("User removed.");
            } catch (err) {
                console.error("Delete Error:", err);
                alert("Failed to delete user. Ensure you have network connectivity.");
            }
        }
    };

    const handleUserApproval = async (uid, shouldApprove) => {
        if (!confirm(shouldApprove ? "Approve this user?" : "Reject (delete) this request?")) return;
        try {
            if (shouldApprove) {
                await approveUser(uid);
                alert("User Approved!");
            } else {
                await rejectUser(uid);
                alert("User Request Rejected");
            }
            fetchData();
        } catch (e) {
            console.error(e);
            alert("Action failed");
        }
    };

    // FRONT DESK PASSWORD MANAGER
    const handleUpdateFrontDeskPassword = async () => {
        const newPass = prompt("Enter new password for Front Desk Inquiry Form:");
        if (newPass && newPass.length >= 4) {
            try {
                const docRef = doc(db, "settings", "front_desk");
                // Use setDoc with merge to ensure document exists
                const { setDoc } = await import('firebase/firestore'); // Dynamic import to avoid messing up top imports if not present, but better to add to top. 
                // Wait, DirectorDashboard imports `updateDoc` and `doc`. It usually needs `setDoc` for new docs.
                // Let's assume the doc might not exist.

                await setDoc(docRef, { password: newPass }, { merge: true });
                alert("Front Desk Password Updated Successfully!");
            } catch (err) {
                console.error("Error updating password:", err);
                alert("Failed to update password.");
            }
        } else if (newPass) {
            alert("Password must be at least 4 characters.");
        }
    };

    // Safe Date Render Helper
    const renderDate = (dateVal) => {
        if (!dateVal) return "-";
        try {
            if (dateVal.seconds) return new Date(dateVal.seconds * 1000).toLocaleDateString("en-IN");
            if (dateVal instanceof Date) return dateVal.toLocaleDateString("en-IN");
            const d = new Date(dateVal);
            return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-IN");
        } catch (e) { return "-"; }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 min-h-screen bg-gray-50 font-sans">
            {/* 1. DARK HEADER BLOCK (Glassmorphism Updated) */}
            <div className={`animate-enter rounded-3xl p-6 md:p-8 mb-8 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden group border ${isManager ? 'bg-gradient-to-br from-slate-900 via-orange-950 to-slate-900 border-orange-900/30 shadow-orange-900/20' : 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-indigo-900/30 shadow-indigo-900/20'}`}>
                {/* Decorative & Animation - Themed Blobs */}
                <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none animate-pulse ${isManager ? 'bg-orange-500/10' : 'bg-indigo-500/10'}`}></div>
                <div className={`absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none ${isManager ? 'bg-amber-500/10' : 'bg-purple-500/10'}`}></div>

                <div className="relative z-10 w-full md:w-auto text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-full border text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider backdrop-blur-sm ${isManager ? 'bg-orange-900/50 border-orange-700/50 text-orange-400' : 'bg-indigo-900/50 border-indigo-700/50 text-indigo-400'}`}>
                            <Shield className="w-3 h-3" />
                            {isManager ? 'MANAGER DASHBOARD' : 'DIRECTOR CONTROL'}
                        </span>
                        <span className="text-slate-500 text-xs font-mono">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
                        {new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 18 ? "Good Afternoon" : "Good Evening"}, <span className={`text-transparent bg-clip-text bg-gradient-to-r ${isManager ? 'from-orange-200 to-amber-400' : 'from-indigo-200 to-violet-400'}`}>{(userProfile?.name || "User").split(' ')?.[0] || 'Director'}</span>
                    </h1>
                    <p className="text-slate-400 text-sm max-w-xl">
                        {isManager
                            ? `Here is the latest performance report for ${center?.name || "your center"}.`
                            : "Overview of all centers, revenue, and pending approvals."}
                    </p>
                </div>

                <div className="flex flex-col gap-3 w-full md:w-auto relative z-10">
                    <div className="relative group">
                        <div className="relative flex items-center gap-2 px-3 py-2.5 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-md cursor-pointer shadow-lg shadow-black/20 w-full md:w-72">
                            <Search className="w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search students..."
                                className="bg-transparent border-none text-sm text-white placeholder-slate-500 focus:ring-0 w-full p-0"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={fetchData} className="flex-1 bg-white/5 border border-white/10 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 backdrop-blur-md hover:bg-white/10">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                        <button
                            onClick={() => exportToCSV(formatAdmissionsForExport(filteredData), `admissions_${viewCenter}`)}
                            className="flex-1 bg-green-600 hover:bg-green-500 text-white border border-green-500 px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                        >
                            <Download className="w-4 h-4" /> Export CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* CENTER FILTER TABS (Director Only) */}
            {!isManager && (
                <div className="flex justify-center mb-8">
                    <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-gray-200 inline-flex gap-1">
                        {['ALL', 'UN_COLLEGE', 'UN_NASHIK_RD', 'PRAYAS'].map(c => (
                            <button
                                key={c}
                                onClick={() => setViewCenter(c)}
                                className={`px-6 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all duration-300 ${viewCenter === c ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-lg shadow-slate-900/20 transform scale-105' : 'text-slate-500 hover:bg-white hover:text-slate-700'}`}
                            >
                                {c === 'ALL' ? 'ALL CENTERS' : c.replace('UN_', '').replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* TABS */}
            <div className="flex border-b border-gray-200 mb-6 space-x-6 overflow-x-auto">
                <button onClick={() => setActiveTab('OVERVIEW')} className={`pb-3 text-sm font-bold whitespace-nowrap ${activeTab === 'OVERVIEW' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                    <LayoutDashboard className="w-4 h-4 inline mr-2" /> Overview
                </button>
                {!isManager && (
                    <button onClick={() => setActiveTab('COMPARE')} className={`pb-3 text-sm font-bold whitespace-nowrap ${activeTab === 'COMPARE' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        <TrendingUp className="w-4 h-4 inline mr-2" /> Compare Performance
                    </button>
                )}

                <button onClick={() => setActiveTab('TEAM')} className={`pb-3 text-sm font-bold whitespace-nowrap ${activeTab === 'TEAM' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                    <UserCog className="w-4 h-4 inline mr-2" /> My Team
                </button>
            </div>

            {/* CONTENT */}
            {
                activeTab === 'OVERVIEW' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div className={`${getCardStyle('revenue')} p-6 rounded-2xl border shadow-sm flex items-center gap-4 transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-default`}>
                                <div className="bg-blue-100 p-4 rounded-xl text-blue-600 shadow-inner group-hover:bg-blue-200 transition"><Wallet className="w-8 h-8" /></div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Collection</p>
                                    <h2 className="text-3xl font-black text-slate-800">₹{(safeStats.revenue || 0).toLocaleString()}</h2>
                                </div>
                            </div>
                            <div className={`${getCardStyle('today')} p-6 rounded-2xl border shadow-sm flex items-center gap-4 transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-default`}>
                                <div className="bg-green-100 p-4 rounded-xl text-green-600 shadow-inner group-hover:bg-green-200 transition"><TrendingUp className="w-8 h-8" /></div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Collected Today</p>
                                    <h2 className="text-3xl font-black text-slate-800">₹{(safeStats.todayRevenue || 0).toLocaleString()}</h2>
                                </div>
                            </div>

                            <div className={`${getCardStyle('students')} p-6 rounded-2xl border shadow-sm flex items-center gap-4 transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-default`}>
                                <div className="bg-purple-100 p-4 rounded-xl text-purple-600 shadow-inner group-hover:bg-purple-200 transition"><Users className="w-8 h-8" /></div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Admissions</p>
                                    <h2 className="text-3xl font-black text-slate-800">{safeStats.students || 0}</h2>
                                </div>
                            </div>
                            <div className={`${getCardStyle('pending')} p-6 rounded-2xl border shadow-sm flex items-center gap-4 transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-default`}>
                                <div className="bg-red-100 p-4 rounded-xl text-red-600 shadow-inner group-hover:bg-red-200 transition"><AlertOctagon className="w-8 h-8" /></div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pending Dues</p>
                                    <h2 className="text-3xl font-black text-slate-800">₹{(safeStats.pending || 0).toLocaleString()}</h2>
                                </div>
                            </div>
                        </div>

                        {/* Quick Access Modules */}
                        {/* Quick Access Modules (Vibrant Color Glass) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

                            {/* CRM Shortcut - Vibrant Emerald Glass */}
                            <a href="#/staff/leads" className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 backdrop-blur-xl border border-emerald-400/30 text-white p-5 rounded-xl shadow-xl shadow-emerald-900/30 cursor-pointer hover:shadow-2xl hover:shadow-emerald-900/50 transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] relative overflow-hidden group">
                                <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-400/20 rounded-full blur-3xl -mr-16 -mt-16 transition group-hover:bg-emerald-400/30 animate-pulse"></div>
                                <div className="flex items-center gap-3 mb-2 relative z-10">
                                    <div className="p-2 bg-emerald-800/40 border border-emerald-400/30 rounded-lg backdrop-blur-md group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                                        <UserCog className="w-5 h-5 text-emerald-100 group-hover:text-white" />
                                    </div>
                                    <h3 className="font-bold text-lg tracking-tight text-white">Lead CRM</h3>
                                </div>
                                <p className="text-xs text-emerald-100/80 font-medium relative z-10 pl-1 group-hover:text-white transition-colors">Track leads & counselor storage</p>
                            </a>

                            {/* Fee Recovery Shortcut - Vibrant Red Glass */}
                            <a href="#/staff/recovery" className="bg-gradient-to-br from-red-600 via-red-700 to-red-900 backdrop-blur-xl border border-red-400/30 text-white p-5 rounded-xl shadow-xl shadow-red-900/30 cursor-pointer hover:shadow-2xl hover:shadow-red-900/50 transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] relative overflow-hidden group">
                                <div className="absolute right-0 top-0 w-32 h-32 bg-red-400/20 rounded-full blur-3xl -mr-16 -mt-16 transition group-hover:bg-red-400/30 animate-pulse"></div>
                                <div className="flex items-center gap-3 mb-2 relative z-10">
                                    <div className="p-2 bg-red-800/40 border border-red-400/30 rounded-lg backdrop-blur-md group-hover:bg-red-500 group-hover:text-white transition-colors duration-300">
                                        <Wallet className="w-5 h-5 text-red-100 group-hover:text-white" />
                                    </div>
                                    <h3 className="font-bold text-lg tracking-tight text-white">Fee Recovery</h3>
                                </div>
                                <p className="text-xs text-red-100/80 font-medium relative z-10 pl-1 group-hover:text-white transition-colors">View full dues & send reminders</p>
                            </a>

                            {/* Batch Management Shortcut - Vibrant Indigo Glass */}
                            <a href="#/staff/batches" className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 backdrop-blur-xl border border-indigo-400/30 text-white p-5 rounded-xl shadow-xl shadow-indigo-900/30 cursor-pointer hover:shadow-2xl hover:shadow-indigo-900/50 transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] relative overflow-hidden group">
                                <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-400/20 rounded-full blur-3xl -mr-16 -mt-16 transition group-hover:bg-indigo-400/30 animate-pulse"></div>
                                <div className="flex items-center gap-3 mb-2 relative z-10">
                                    <div className="p-2 bg-indigo-800/40 border border-indigo-400/30 rounded-lg backdrop-blur-md group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
                                        <LayoutDashboard className="w-5 h-5 text-indigo-100 group-hover:text-white" />
                                    </div>
                                    <h3 className="font-bold text-lg tracking-tight text-white">Batch Manager</h3>
                                </div>
                                <p className="text-xs text-indigo-100/80 font-medium relative z-10 pl-1 group-hover:text-white transition-colors">Create & manage student batches</p>
                            </a>

                            {/* Student Records Shortcut - Vibrant Slate Glass */}
                            <a href="#/staff/student-records" className="bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 backdrop-blur-xl border border-slate-500/30 text-white p-5 rounded-xl shadow-xl shadow-slate-900/30 flex flex-col justify-center items-center text-center relative overflow-hidden group transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-slate-900/50">
                                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <div className="flex items-center gap-3 mb-2 relative z-10">
                                    <div className="p-2 bg-slate-600/40 border border-slate-400/30 rounded-lg backdrop-blur-md group-hover:bg-slate-500 group-hover:text-white transition-colors duration-300">
                                        <Users className="w-5 h-5 text-slate-100 group-hover:text-white" />
                                    </div>
                                    <h3 className="font-bold text-lg tracking-tight text-white">Student Records</h3>
                                </div>
                                <p className="text-xs text-slate-300/80 font-medium relative z-10 pl-1 group-hover:text-white transition-colors">View all students & export data</p>
                            </a>
                        </div>



                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                            <div className="lg:col-span-2">
                                <PerformanceReport centerFilter={viewCenter} />
                            </div>
                            <div className="space-y-6">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                    <h3 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
                                        <span>Quick Recoveries</span>
                                        <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">Top 5</span>
                                    </h3>
                                    {reminders.length === 0 ? (
                                        <p className="text-sm text-gray-400 italic">No urgent dues found.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {reminders.map(r => (
                                                <div key={r.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
                                                    <div>
                                                        <p className="font-bold text-gray-800">{r.name}</p>
                                                        <p className="text-xs text-gray-500">{r.phone}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-red-600">₹{r.balance.toLocaleString()}</p>
                                                        <a href={`https://wa.me/91${r.phone}?text=Reminder: Fees Due`} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline">WhatsApp</a>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                    <h3 className="font-bold text-gray-800 mb-4">System Alerts</h3>
                                    <div className="p-3 bg-blue-50 border border-blue-100 rounded text-sm text-blue-800">System running smooth.</div>
                                </div>
                            </div>
                        </div>

                        {/* Approvals */}
                        {(approvals || []).length > 0 && (
                            <div className="mb-8 bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
                                <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-orange-600" /><h2 className="text-lg font-bold text-orange-800">Pending Requests</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-orange-50/50 text-orange-800"><tr><th className="p-4">Staff</th><th className="p-4">Student</th><th className="p-4">Original</th><th className="p-4">Offer</th><th className="p-4">Action</th></tr></thead>
                                        <tbody className="divide-y divide-orange-100">
                                            {approvals.map(req => (
                                                <tr key={req.id}>
                                                    <td className="p-4">{req.requestedBy}</td>
                                                    <td className="p-4 font-bold">{req.studentName}</td>
                                                    <td className="p-4 line-through">₹{req.originalFee?.toLocaleString()}</td>
                                                    <td className="p-4 font-bold">₹{req.offeredFee?.toLocaleString()}</td>
                                                    <td className="p-4 flex gap-2">
                                                        <button onClick={() => handleDecision(req.id, 'APPROVED')} className="bg-green-600 text-white p-2 rounded"><Check className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDecision(req.id, 'REJECTED')} className="bg-red-600 text-white p-2 rounded"><X className="w-4 h-4" /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                    </div>
                )
            }

            {
                activeTab === 'COMPARE' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                            <select value={compC1} onChange={(e) => setCompC1(e.target.value)} className="p-2 border rounded font-bold text-blue-900 bg-blue-50">
                                <option value="UN_COLLEGE">Unacademy College Road</option>
                                <option value="UN_NASHIK_RD">Unacademy Nashik Road</option>
                                <option value="PRAYAS">Prayaas Center</option>
                            </select>
                            <span className="font-bold text-gray-400">VS</span>
                            <select value={compC2} onChange={(e) => setCompC2(e.target.value)} className="p-2 border rounded font-bold text-orange-900 bg-orange-50">
                                <option value="UN_COLLEGE">Unacademy College Road</option>
                                <option value="UN_NASHIK_RD">Unacademy Nashik Road</option>
                                <option value="PRAYAS">Prayaas Center</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Center 1 Card */}
                            <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl border border-blue-100 shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200 rounded-full mix-blend-multiply filter blur-2xl opacity-20"></div>
                                <h3 className="text-xl font-extrabold text-blue-900 mb-6">{compC1.replace('UN_', '').replace('_', ' ')}</h3>

                                <div className="space-y-6 relative z-10">
                                    <div>
                                        <p className="text-xs font-bold text-blue-400 uppercase">Total Revenue</p>
                                        <p className="text-3xl font-black text-blue-900">₹{(compStats.c1?.revenue || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-bold text-blue-400 uppercase">Admissions</p>
                                            <p className="text-xl font-bold text-blue-800">{compStats.c1?.students || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-blue-400 uppercase">Avg. Ticket</p>
                                            <p className="text-xl font-bold text-blue-800">₹{(compStats.c1?.avgTicket || 0).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-red-400 uppercase">Pending Dues</p>
                                        <p className="text-xl font-bold text-red-600">₹{(compStats.c1?.pending || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Center 2 Card */}
                            <div className="bg-gradient-to-br from-orange-50 to-white p-6 rounded-2xl border border-orange-100 shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-200 rounded-full mix-blend-multiply filter blur-2xl opacity-20"></div>
                                <h3 className="text-xl font-extrabold text-orange-900 mb-6">{compC2.replace('UN_', '').replace('_', ' ')}</h3>

                                <div className="space-y-6 relative z-10">
                                    <div>
                                        <p className="text-xs font-bold text-orange-400 uppercase">Total Revenue</p>
                                        <p className="text-3xl font-black text-orange-900">₹{(compStats.c2?.revenue || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-bold text-orange-400 uppercase">Admissions</p>
                                            <p className="text-xl font-bold text-orange-800">{compStats.c2?.students || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-orange-400 uppercase">Avg. Ticket</p>
                                            <p className="text-xl font-bold text-orange-800">₹{(compStats.c2?.avgTicket || 0).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-red-400 uppercase">Pending Dues</p>
                                        <p className="text-xl font-bold text-red-600">₹{(compStats.c2?.pending || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Comparison Bar Chart (Visual) */}
                        {/* Comparison Bar Chart (Visual) */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <h4 className="font-bold text-gray-700 mb-6">Revenue Comparison</h4>

                            {((compStats.c1?.revenue || 0) + (compStats.c2?.revenue || 0)) === 0 ? (
                                <div className="h-48 flex items-center justify-center text-gray-400 italic bg-gray-50 rounded-xl border border-dashed">
                                    No revenue data to compare for selected period.
                                </div>
                            ) : (
                                <div className="flex items-end justify-center h-48 gap-16">
                                    {/* Bar 1 */}
                                    <div className="flex flex-col items-center w-24 group">
                                        <span className="mb-2 font-bold text-blue-600 text-sm transform transition-all duration-300 opacity-0 group-hover:opacity-100 -translate-y-2 group-hover:translate-y-0">
                                            ₹{((compStats.c1?.revenue || 0) / 100000).toFixed(2)}L
                                        </span>
                                        <div className="w-full bg-gray-100 rounded-t-xl h-32 relative flex items-end overflow-hidden shadow-inner border border-gray-100">
                                            <div
                                                className="w-full bg-blue-600 rounded-t-xl hover:bg-blue-500 transition-all duration-1000 ease-out relative shadow-lg shadow-blue-200"
                                                style={{
                                                    height: `${Math.max(5, ((compStats.c1?.revenue || 0) / (Math.max((compStats.c1?.revenue || 0), (compStats.c2?.revenue || 0)) || 1)) * 100)}%`
                                                }}
                                            ></div>
                                        </div>
                                        <span className="mt-3 font-bold text-gray-600 text-xs bg-gray-100 px-3 py-1 rounded-full">{compC1.replace('UN_', '').replace('_', ' ')}</span>
                                    </div>

                                    {/* VS Divider */}
                                    <div className="h-full flex items-center justify-center pb-10">
                                        <div className="w-px h-24 bg-gray-200"></div>
                                    </div>

                                    {/* Bar 2 */}
                                    <div className="flex flex-col items-center w-24 group">
                                        <span className="mb-2 font-bold text-orange-600 text-sm transform transition-all duration-300 opacity-0 group-hover:opacity-100 -translate-y-2 group-hover:translate-y-0">
                                            ₹{((compStats.c2?.revenue || 0) / 100000).toFixed(2)}L
                                        </span>
                                        <div className="w-full bg-gray-100 rounded-t-xl h-32 relative flex items-end overflow-hidden shadow-inner border border-gray-100">
                                            <div
                                                className="w-full bg-orange-500 rounded-t-xl hover:bg-orange-400 transition-all duration-1000 ease-out relative shadow-lg shadow-orange-200"
                                                style={{
                                                    height: `${Math.max(5, ((compStats.c2?.revenue || 0) / (Math.max((compStats.c1?.revenue || 0), (compStats.c2?.revenue || 0)) || 1)) * 100)}%`
                                                }}
                                            ></div>
                                        </div>
                                        <span className="mt-3 font-bold text-gray-600 text-xs bg-gray-100 px-3 py-1 rounded-full">{compC2.replace('UN_', '').replace('_', ' ')}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
            {
                activeTab === 'BATCHES' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {['JEE', 'NEET', 'MHT_CET', 'FOUNDATION'].map(section => {
                            const sectionStudents = unassignedStudents.filter(s => getProgramType(s.program) === section);
                            if (sectionStudents.length === 0) return null;
                            return (
                                <div key={section} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200"><h3 className="font-bold text-gray-800">{section} Batch Allocation</h3></div>
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-white text-gray-500 uppercase text-xs"><tr><th className="p-4">Student</th><th className="p-4">Counselor</th><th className="p-4">Course</th><th className="p-4">Date</th><th className="p-4">Assign</th></tr></thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {sectionStudents.map(s => (
                                                <tr key={s.id}>
                                                    <td className="p-4 font-bold">{s.studentName}</td><td className="p-4 text-gray-500 font-medium">{s.bookedBy || "N/A"}</td><td className="p-4 text-gray-500">{s.program}</td><td className="p-4 text-gray-400">{renderDate(s.createdAt)}</td>
                                                    <td className="p-4 flex gap-2">
                                                        <select id={`batch-select-${s.id}`} className="border rounded p-2 text-xs">
                                                            <option value="">-- Select --</option>
                                                            <option value={`${section}-A (Morning)`}>{section}-A (Morning)</option>
                                                            <option value={`${section}-B (Evening)`}>{section}-B (Evening)</option>
                                                            <option value={`${section}-Repeater`}>{section}-Repeater</option>
                                                        </select>
                                                        <button onClick={() => handleAssignBatch(s.id, document.getElementById(`batch-select-${s.id}`).value)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold">Assign</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        })}
                        {unassignedStudents.length === 0 && (
                            <div className="p-10 text-center text-gray-500 bg-white rounded-xl border border-dashed"><CheckCircle className="w-10 h-10 mx-auto text-green-500 mb-2" /><p>All students have been assigned!</p></div>
                        )}
                    </div>
                )
            }

            {
                activeTab === 'TEAM' && (
                    <div className="animate-in fade-in duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Team Management</h2>
                                <p className="text-gray-500 text-sm">Manage access and pending requests.</p>
                            </div>
                            <div className="flex gap-2">
                                {/* BDE MANAGER BUTTON */}
                                <button
                                    onClick={() => setIsBDEModalOpen(true)}
                                    className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition"
                                >
                                    <Briefcase className="w-4 h-4" /> Manage BDEs
                                </button>

                                {/* PASSWORD MANAGER BUTTON (Added) */}
                                <button
                                    onClick={handleUpdateFrontDeskPassword}
                                    className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition"
                                >
                                    <UserCheck className="w-4 h-4" /> Front Desk Pass
                                </button>
                            </div>
                        </div>

                        {/* Pending Approvals Section */}
                        {pendingUsers.length > 0 && (
                            <div className="mb-8 border border-orange-200 bg-orange-50 rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-orange-200 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                                    <h3 className="font-bold text-orange-800">Pending Registration Requests</h3>
                                </div>
                                <div className="divide-y divide-orange-200">
                                    {pendingUsers.map(u => (
                                        <div key={u.uid} className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                                            <div>
                                                <p className="font-bold text-gray-900">{u.name} <span className="text-xs font-normal text-gray-500">({u.email})</span></p>
                                                <p className="text-xs text-gray-600">Requested Role: <span className="font-bold uppercase">{u.role}</span> &bull; Center: {u.centerId || "Unassigned"}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleUserApproval(u.uid, true)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700">Approve</button>
                                                <button onClick={() => handleUserApproval(u.uid, false)} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700">Reject</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="p-4">Name</th>
                                        <th className="p-4">Role</th>
                                        <th className="p-4">Center</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {teamMembers.length > 0 ? teamMembers.map(member => (
                                        <tr key={member.uid} className="hover:bg-gray-50 transition">
                                            <td className="p-4">
                                                <div className="font-bold text-gray-900">{member.name}</div>
                                                <div className="text-xs text-gray-500">{member.email}</div>
                                            </td>
                                            <td className="p-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">{member.role}</span></td>
                                            <td className="p-4 text-gray-600">{member.centerId || "-"}</td>
                                            <td className="p-4 text-right">
                                                {userProfile?.role === 'DIRECTOR' && (
                                                    <button onClick={() => handleDeleteUser(member.uid)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="4" className="p-4 text-center text-gray-500">No team members found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {
                isAddUserModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                            <div className="bg-slate-900 p-6 text-white flex justify-between items-center"><h3 className="font-bold text-lg">Add Counselor</h3><button onClick={() => setIsAddUserModalOpen(false)}><X className="w-5 h-5" /></button></div>
                            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label><input required className="w-full p-3 border rounded-lg" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} /></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label><input type="email" required className="w-full p-3 border rounded-lg" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} /></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label><input required minLength="6" className="w-full p-3 border rounded-lg" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} /></div>
                                <button type="submit" disabled={creatingUser} className="w-full py-3 bg-slate-900 text-white font-bold rounded-lg">{creatingUser ? 'Creating...' : 'Create Account'}</button>
                            </form>
                        </div>
                    </div>
                )
            }


            {
                isBDEModalOpen && (
                    <BDEManager
                        onClose={() => setIsBDEModalOpen(false)}
                        preselectedCenterId={isManager ? center?.id : null}
                    />
                )
            }

            {selectedStudent && <StudentManager student={selectedStudent} onClose={() => setSelectedStudent(null)} refreshData={fetchData} userProfile={userProfile} />}
        </div >
    );
};
export default DirectorDashboard;
