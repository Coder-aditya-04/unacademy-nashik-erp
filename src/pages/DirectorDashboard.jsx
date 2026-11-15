import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Search, FileText, UserCog, RefreshCw, Check, X, Bell, MapPin, Calendar, DollarSign, Filter, TrendingUp, Users, AlertOctagon, Wallet, Download, LayoutDashboard, CheckCircle, UserCheck, Clock, PhoneCall } from 'lucide-react';
import StudentManager from '../components/StudentManager'; // Import the Modal
import { processApproval } from '../services/approvalService';
import { subscribeAdmissions } from '../services/cacheService';
import { createCounselorAccount, deleteCounselorProfile, approveUser, rejectUser } from '../services/userService'; // New Imports
import PerformanceReport from '../modules/admin/components/PerformanceReport';
import CounsellorCollectionReport from '../modules/admin/components/CounsellorCollectionReport';
import { exportToCSV, formatAdmissionsForExport } from '../utils/exportUtils';
import { Trash2, UserPlus, Shield, AlertTriangle, Briefcase } from 'lucide-react'; // New Icons
import BDEManager from '../components/BDEManager';
import { Money, MoneyToggle } from '../components/Money';
import { StatCard, QuickLink, Segmented } from '../components/ui';
import { greetingFor } from '../utils/greeting'; // NEW IMPORT

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
    const [, setStaffCounts] = useState({ total: 0, filtered: 0 }); // Debug State
    const [lastSynced, setLastSynced] = useState(null);

    // COMPARISON STATE
    const [compC1, setCompC1] = useState('UN_COLLEGE');
    const [compC2, setCompC2] = useState('PRAYAS');
    const [compStats, setCompStats] = useState({ c1: null, c2: null });




    // Safe Data Fetching (Legacy compatibility wrapper, now managed by real-time hooks)
    const fetchData = (forceRefresh = false) => {
        console.log("🔄 Real-time sync: Data is synced live from Firestore.");
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
            return;
        }

        setLoading(true);
        const currentViewCenter = isManager ? (center?.id || viewCenter) : viewCenter;
        
        // Directors subscribe to 'ALL' to support comparison tab, and filter locally. Managers subscribe to their center only.
        const subscriptionCenterId = isManager ? (center?.id || 'UN_COLLEGE') : 'ALL';

        // 1. Subscribe to Admissions
        const unsubAdmissions = subscribeAdmissions(subscriptionCenterId, (allData) => {
            setLastSynced(new Date());

            // 1a. Filter by Center
            let rawCenterData = allData;
            if (currentViewCenter !== 'ALL') {
                rawCenterData = allData.filter(txn => {
                    const txnCenterId = (txn.centerId || "").trim().toUpperCase();
                    const txnCenterName = (txn.centerName || "").trim().toUpperCase();
                    const viewId = (currentViewCenter || "").trim().toUpperCase();

                    if (txnCenterId === viewId) return true;

                    if (viewId === 'UN_COLLEGE') {
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

                    const viewName = (center?.name || "").trim().toUpperCase();
                    if (viewName && txnCenterName && txnCenterName.includes(viewName)) return true;

                    return false;
                });
            }

            // 1b. Filter by Active Status (Operational Data for List & Pending)
            const activeData = rawCenterData.filter(txn => ['ACTIVE', 'TOKEN_PAID', 'COMPLETED'].includes(txn.status));

            setAdmissions(activeData);

            // 1c. Calculate Stats
            let totalRev = 0;
            let todayRev = 0;
            let pendingSum = 0;
            const today = new Date();

            rawCenterData.forEach(d => {
                if (['ACTIVE', 'COMPLETED'].includes(d.status)) {
                    totalRev += Number(d.totalPaid || 0);

                    if (d.payments && Array.isArray(d.payments)) {
                        d.payments.forEach(p => {
                            const pDate = p.date?.seconds ? new Date(p.date.seconds * 1000) : new Date(p.date);
                            if (pDate.getDate() === today.getDate() &&
                                pDate.getMonth() === today.getMonth() &&
                                pDate.getFullYear() === today.getFullYear()) {
                                todayRev += Number(p.amount || 0);
                            }
                        });
                    } else {
                        const txnDate = d.createdAt ? new Date(d.createdAt.seconds * 1000) : null;
                        if (txnDate && txnDate.getDate() === today.getDate() &&
                            txnDate.getMonth() === today.getMonth() &&
                            txnDate.getFullYear() === today.getFullYear()) {
                            todayRev += Number(d.totalPaid || 0);
                        }
                    }
                }
            });

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

            // 1d. Calculate Quick Reminders
            const dueList = [];
            allData.forEach(data => {
                if (data.status !== 'ACTIVE') return;
                
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
                    dueList.push({
                        id: data.id,
                        name: data.studentName,
                        phone: data.phone,
                        balance: balance,
                        daysLeft: 0
                    });
                }
            });
            setReminders(dueList.sort((a, b) => b.balance - a.balance).slice(0, 5));
            setLoading(false);
        });

        // 2. Subscribe to Approvals
        const approvalsRef = collection(db, "approvals");
        const qApprovals = query(approvalsRef, where("status", "==", "PENDING"));
        const unsubApprovals = onSnapshot(qApprovals, (snapshot) => {
            let pending = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            pending.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            if (isManager) {
                pending = pending.filter(a => {
                    const pct = parseFloat(a.discountPercentage || a.discount || 0);
                    return pct <= 70;
                });
            }
            setApprovals(pending);
        }, (err) => {
            console.error("Approvals subscription error:", err);
        });

        // 3. Subscribe to Pending Users
        const usersRef = collection(db, "users");
        const qUsers = query(usersRef, where("verified", "==", false));
        const unsubUsers = onSnapshot(qUsers, (snapshot) => {
            let pendingUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (currentViewCenter !== 'ALL') {
                pendingUsers = pendingUsers.filter(u => u.centerId === currentViewCenter);
            }
            setPendingUsers(pendingUsers);
        }, (err) => {
            console.error("Pending users subscription error:", err);
        });

        // 4. Subscribe to Team List (only when Team tab is active)
        let unsubTeam = null;
        if (activeTab === 'TEAM') {
            const qTeam = query(usersRef);
            unsubTeam = onSnapshot(qTeam, (snapshot) => {
                const staff = snapshot.docs
                    .map(doc => {
                        const data = doc.data();
                        const rawCenterId = data.centerId || data.CenterId || data.CentreId || "";
                        return {
                            uid: doc.id,
                            ...data,
                            centerId: rawCenterId.trim()
                        };
                    })
                    .filter(user => user.verified !== false);

                const filtered = staff.filter(u => {
                    const isTeamMember = ['COUNSELLOR', 'COUNSELOR', 'MANAGER', 'ACCOUNTANT', 'DIRECTOR', 'STAFF', 'BDE', 'FRONT_DESK', 'RECOVERY'].includes(u.role?.toUpperCase());
                    const uCenter = (u.centerId || "").trim();
                    const vCenter = (currentViewCenter || "").trim();
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
            }, (err) => {
                console.error("Team subscription error:", err);
            });
        }

        // Return unsubscribe cleanup function
        return () => {
            if (unsubAdmissions) unsubAdmissions();
            if (unsubApprovals) unsubApprovals();
            if (unsubUsers) unsubUsers();
            if (unsubTeam) unsubTeam();
        };
    }, [viewCenter, activeTab, center, isManager]);

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
            // Use selected role or default to COUNSELOR
            const role = newUser.role || 'COUNSELOR';
            const centerId = isManager ? center?.id : (newUser.centerId || 'UN_COLLEGE');

            await createCounselorAccount(newUser.email, newUser.password, newUser.name, role, centerId);
            setIsAddUserModalOpen(false);
            setNewUser({ name: '', email: '', password: '', role: 'COUNSELOR', centerId: 'UN_COLLEGE' });
            alert(`${role} account created successfully!`);
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

    const [currentTime, setCurrentTime] = useState(new Date());

    // Clock Timer
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);


    // DEBUG: EARLY RETURN
    // console.log("DirectorDashboard: PRE-RENDER CHECK");
    // console.log("Stats:", safeStats);
    // console.log("Admissions Count:", safeAdmissions.length);

    // UNCOMMENT TO DEBUG RENDER CRASH
    // return <div className="p-10 text-xl font-bold text-red-600">SAFE MODE: HOOKS OK, CRASH IN JSX</div>;
    // return <div className="p-10 text-xl font-bold text-red-600">SAFE MODE: HOOKS OK, CRASH IN JSX</div>;
    const firstName = (userProfile?.name || 'there').split(' ')[0];
    return (
        <div className="space-y-6">

            {/* Greeting and actions */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <p className="text-sm text-slate-500">{currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    <h2 className="kap-title text-[24px] sm:text-[28px] tracking-[-0.9px] text-slate-900">{greetingFor(currentTime)}, {firstName}</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {isManager ? `How ${center?.name || 'your centre'} is doing today.` : 'Admissions, collections and dues across your centres.'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="relative flex items-center w-full sm:w-64">
                        <span className="sr-only">Search students</span>
                        <Search className="w-4 h-4 text-slate-400 absolute left-3" aria-hidden="true" />
                        <input type="text" placeholder="Search students" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 min-h-[40px] rounded-full kap-glass text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </label>
                    <MoneyToggle />
                    <button onClick={() => fetchData(true)} disabled={loading} title={lastSynced ? `Last synced ${lastSynced.toLocaleTimeString()}` : 'Sync'}
                        className="inline-flex items-center gap-2 px-4 min-h-[40px] rounded-full kap-glass text-xs font-[650] text-slate-600 hover:border-blue-300 hover:text-blue-800 active:scale-[.97] transition-[border-color,color,transform] duration-150 disabled:opacity-50">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Syncing' : 'Sync'}
                    </button>
                    <button onClick={() => exportToCSV(formatAdmissionsForExport(filteredData), `admissions_${viewCenter}`)}
                        className="inline-flex items-center gap-2 px-4 min-h-[40px] rounded-full bg-blue-600 text-white text-xs font-[650] shadow-[0_6px_16px_rgba(44,134,208,.28)] hover:bg-blue-700 active:scale-[.97] transition-[background,transform] duration-150">
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                </div>
            </div>

            {/* Centre and section switches */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <Segmented
                    label="Section"
                    value={activeTab}
                    onChange={setActiveTab}
                    options={[
                        { value: 'OVERVIEW', label: 'Overview' },
                        ...(!isManager ? [{ value: 'COMPARE', label: 'Compare centres' }] : []),
                        { value: 'TEAM', label: 'My team' },
                        ...(!isManager ? [{ value: 'DB_TOOLS', label: 'Database tools' }] : []),
                    ]}
                />
                {!isManager && (
                    <Segmented
                        label="Centre"
                        size="sm"
                        value={viewCenter}
                        onChange={setViewCenter}
                        options={[
                            { value: 'ALL', label: 'All centres' },
                            { value: 'UN_COLLEGE', label: 'College Rd' },
                            { value: 'UN_NASHIK_RD', label: 'Nashik Rd' },
                            { value: 'PRAYAS', label: 'Prayaas' },
                        ]}
                    />
                )}
            </div>

            {/* CONTENT */}
            {
                activeTab === 'OVERVIEW' && (
                    <div className="space-y-6">
                        <div className={`grid grid-cols-2 ${isManager ? '' : 'xl:grid-cols-4'} gap-4`}>
                            {/* Managers do not see collection totals (Aditya, Nov 2026). */}
                            {!isManager && (<>
                                <StatCard label="Total collection" value={<Money value={safeStats.revenue} />} icon={Wallet} tone="blue" hint="All payments received in this view" delay={0} />
                                <StatCard label="Collected today" value={<Money value={safeStats.todayRevenue} />} icon={TrendingUp} tone="emerald" hint="Since midnight" delay={40} />
                            </>)}
                            <StatCard label="Admissions" value={safeStats.students || 0} icon={Users} tone="violet" hint="Students in this view" to="/staff/student-records" delay={80} />
                            <StatCard label="Pending dues" value={<Money value={safeStats.pending} />} icon={AlertOctagon} tone="rose" hint="Balance still to collect" to="/staff/recovery-desk" delay={120} />
                        </div>

                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                            <QuickLink to="/staff/leads" icon={UserCog} title="Leads CRM" text="Leads and counsellor follow-ups" tone="emerald" />
                            <QuickLink to="/staff/recovery-desk" icon={PhoneCall} title="Recovery desk" text="Overdue fees, calls and promises" tone="rose" />
                            <QuickLink to="/staff/batches" icon={LayoutDashboard} title="Batches" text="Create and manage batches" tone="violet" />
                            <QuickLink to="/staff/student-records" icon={Users} title="Student records" text="All students and exports" tone="slate" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <div className="lg:col-span-2">
                                    <PerformanceReport centerFilter={viewCenter} />
                                    <CounsellorCollectionReport admissions={safeAdmissions} showTotals={!isManager} />
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="kap-glass rounded-[18px] p-5">
                                    <h3 className="font-semibold text-slate-900 text-[15px] mb-4 flex items-center justify-between">
                                        <span>Biggest dues to chase</span>
                                        <span className="text-xs font-medium bg-rose-50 text-rose-600 px-2 py-1 rounded-md">Top 5</span>
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
                                                        <p className="font-bold text-red-600"><Money value={r.balance} /></p>
                                                        <a href={`https://wa.me/91${r.phone}?text=Reminder: Fees Due`} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline">WhatsApp</a>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
                                                    <td className="p-4 line-through"><Money value={req.originalFee} /></td>
                                                    <td className="p-4 font-bold"><Money value={req.offeredFee} /></td>
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
                                        <p className="text-3xl font-black text-blue-900"><Money value={compStats.c1?.revenue} /></p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-bold text-blue-400 uppercase">Admissions</p>
                                            <p className="text-xl font-bold text-blue-800">{compStats.c1?.students || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-blue-400 uppercase">Avg. Ticket</p>
                                            <p className="text-xl font-bold text-blue-800"><Money value={compStats.c1?.avgTicket} /></p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-red-400 uppercase">Pending Dues</p>
                                        <p className="text-xl font-bold text-red-600"><Money value={compStats.c1?.pending} /></p>
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
                                        <p className="text-3xl font-black text-orange-900"><Money value={compStats.c2?.revenue} /></p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-bold text-orange-400 uppercase">Admissions</p>
                                            <p className="text-xl font-bold text-orange-800">{compStats.c2?.students || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-orange-400 uppercase">Avg. Ticket</p>
                                            <p className="text-xl font-bold text-orange-800"><Money value={compStats.c2?.avgTicket} /></p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-red-400 uppercase">Pending Dues</p>
                                        <p className="text-xl font-bold text-red-600"><Money value={compStats.c2?.pending} /></p>
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
                                            <Money value={compStats.c1?.revenue} format={(v) => `₹${(Number(v || 0) / 100000).toFixed(2)}L`} />
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
                                            <Money value={compStats.c2?.revenue} format={(v) => `₹${(Number(v || 0) / 100000).toFixed(2)}L`} />
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
                                <div key={section} className="kap-glass rounded-[18px] overflow-hidden">
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
                                {/* ADD STAFF BUTTON (Restored) */}
                                {userProfile?.role === 'DIRECTOR' && (
                                    <button
                                        onClick={() => setIsAddUserModalOpen(true)}
                                        className="bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition"
                                    >
                                        <UserPlus className="w-4 h-4" /> Add Staff
                                    </button>
                                )}
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

                        <div className="kap-glass rounded-[18px] overflow-hidden">
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
                activeTab === 'DB_TOOLS' && !isManager && (
                    <div className="kap-glass rounded-[18px] p-6 animate-in fade-in duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Shield className="w-6 h-6 animate-pulse" /></div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 font-sans">Database & Roll Number Reconciler</h2>
                                <p className="text-slate-500 text-xs mt-1">How roll numbers are assigned and kept unique.</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl max-w-xl space-y-2">
                            <h3 className="font-bold text-sm text-slate-700 uppercase">Roll numbers are permanent</h3>
                            <p className="text-xs text-slate-500 leading-relaxed font-sans">
                                A roll number is also the student&apos;s enrollment number in KAP Connect, so it is never rewritten in bulk.
                                New roll numbers are handed out in order per centre and year, and the system refuses to give one number to two students.
                                To check existing records for duplicates, ask your developer to run the roll-number scan.
                            </p>
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
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role</label>
                                    <select
                                        className="w-full p-3 border rounded-lg bg-white"
                                        value={newUser.role || 'COUNSELOR'}
                                        onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                    >
                                        <option value="COUNSELOR">Counselor</option>
                                        <option value="FRONT_DESK">Front Desk</option>
                                        <option value="BDE">BDE</option>
                                        <option value="ACCOUNTANT">Accountant</option>
                                        <option value="RECOVERY">Recovery</option>
                                        <option value="MANAGER">Manager</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Center</label>
                                    <select
                                        className="w-full p-3 border rounded-lg bg-white"
                                        value={newUser.centerId || 'UN_COLLEGE'}
                                        onChange={e => setNewUser({ ...newUser, centerId: e.target.value })}
                                        disabled={isManager} // Mangers can only add to their center
                                    >
                                        <option value="UN_COLLEGE">College Road</option>
                                        <option value="UN_NASHIK_RD">Nashik Road</option>
                                        <option value="PRAYAS">Prayaas Center</option>
                                    </select>
                                </div>
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
