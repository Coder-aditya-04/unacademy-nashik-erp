import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchLeads, assignLead, deleteLead, subscribeToLeads } from '../../../services/leadService';
import { fetchStaffList } from '../../../services/userService';
import { CENTERS } from '../../../utils/centers'; // Import CENTERS
import { Users, Filter, Search, UserCheck, Clock, AlertCircle, CheckCircle, Trash2, Edit, Download } from 'lucide-react';
import AddLead from './AddLead'; // Import logic-rich form

const LeadDashboard = ({ userProfile }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [leads, setLeads] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    // Initialize state from sessionStorage or defaults
    const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('lead_search') || "");
    const [viewCenter, setViewCenter] = useState(() => sessionStorage.getItem('lead_center') || 'ALL');
    const [editingLead, setEditingLead] = useState(null);
    const [selectedLeads, setSelectedLeads] = useState([]); // NEW STATE


    const [filterStatus, setFilterStatus] = useState(() => sessionStorage.getItem('lead_filterStatus') || "ALL");
    const [filterSource, setFilterSource] = useState(() => sessionStorage.getItem('lead_filterSource') || "ALL");
    const [startDate, setStartDate] = useState(() => sessionStorage.getItem('lead_startDate') || "");
    const [endDate, setEndDate] = useState(() => sessionStorage.getItem('lead_endDate') || "");
    const [selectedCounselor, setSelectedCounselor] = useState(() => location.state?.filterCounsellorId || sessionStorage.getItem('lead_counselor') || "ALL");
    const [filterBDEName, setFilterBDEName] = useState(() => sessionStorage.getItem('lead_filterBDEName') || "ALL");
    const [currentTime, setCurrentTime] = useState(new Date());
    const [visibleCount, setVisibleCount] = useState(10); // Pagination State

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const greeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    // PERSISTENCE EFFECT
    useEffect(() => {
        sessionStorage.setItem('lead_search', searchTerm);
        sessionStorage.setItem('lead_center', viewCenter);
        sessionStorage.setItem('lead_filterStatus', filterStatus);
        sessionStorage.setItem('lead_filterSource', filterSource);
        sessionStorage.setItem('lead_startDate', startDate);
        sessionStorage.setItem('lead_endDate', endDate);
        sessionStorage.setItem('lead_counselor', selectedCounselor);
        sessionStorage.setItem('lead_filterBDEName', filterBDEName);
    }, [searchTerm, viewCenter, filterStatus, filterSource, startDate, endDate, selectedCounselor, filterBDEName]);

    // Reset pagination when filters change
    useEffect(() => {
        setVisibleCount(10);
    }, [searchTerm, viewCenter, filterStatus, filterSource, startDate, endDate, selectedCounselor, filterBDEName]);

    // Handle incoming router state for Counselor Filtering (e.g., from Leaderboard)
    useEffect(() => {
        if (location.state?.filterCounsellorId) {
            setSelectedCounselor(location.state.filterCounsellorId);
            setViewCenter('ALL'); // Ensure we see their leads across centers if applicable
            setFilterStatus('ALL'); // Clear status filter to see everything
            
            // Clear state so a refresh doesn't re-trigger it unnecessarily
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const isDirector = userProfile?.role?.toUpperCase() === 'DIRECTOR';
    const isManager = userProfile?.role?.toUpperCase() === 'MANAGER';
    const canManageLeads = isDirector || isManager;

    // 1. REAL-TIME Data Load (Replaces old loadData on mount)
    useEffect(() => {
        let unsubscribe = () => { };

        const initData = async () => {
            setLoading(true);

            // SETUP LISTENER
            unsubscribe = subscribeToLeads(userProfile, (updatedLeads) => {
                setLeads(updatedLeads);
                setLoading(false);
            });

            // Staff List Population (Keep one-time load)
            if (isDirector) {
                const allStaff = await fetchStaffList(null);
                setStaffList(allStaff);
            } else if (isManager) {
                if (userProfile.centerId) {
                    const centerStaff = await fetchStaffList(userProfile.centerId);
                    setStaffList(centerStaff);
                }
            }
        };

        if (userProfile) {
            initData();
        }

        return () => unsubscribe(); // Cleanup Listener on Unmount
    }, [userProfile]);

    // Legacy manual reload if needed (though real-time makes it redundant)
    const loadData = () => {
        console.log("Data auto-updates via listener.");
    };

    // Auto-Heal: Fix any leads that have an admission but their status is broken
    useEffect(() => {
        if (!isDirector || !leads || leads.length === 0) return;
        
        const fixBrokenLeads = async () => {
            try {
                const { doc, updateDoc, collection, getDocs, query, where } = await import('firebase/firestore');
                const { db } = await import('../../../firebase.js');

                // 1. Fix broken assigned statuses (Whitelist REFUNDED)
                const corruptedLeads = leads.filter(l => 
                    l.admissionId && 
                    !['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN', 'CLOSED', 'LOST', 'REJECTED', 'REFUNDED'].includes(l.status)
                );
                
                if (corruptedLeads.length > 0) {
                    console.log(`Auto-healing ${corruptedLeads.length} corrupted leads...`);
                    await Promise.all(corruptedLeads.map(l => 
                        updateDoc(doc(db, "leads", l.id), { status: "CONVERTED" })
                    ));
                }

                // 2. Restore Refunded Leads (In case they were accidentally overwritten to CONVERTED)
                const admissionsSnap = await getDocs(query(collection(db, "admissions"), where("status", "==", "REFUNDED")));
                const refundedAdmissions = admissionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                
                const leadsToRestore = leads.filter(l => 
                    l.status === 'CONVERTED' && 
                    refundedAdmissions.some(a => a.leadId === l.id || l.admissionId === a.id)
                );

                if (leadsToRestore.length > 0) {
                    console.log(`Restoring ${leadsToRestore.length} refunded leads...`);
                    await Promise.all(leadsToRestore.map(l => 
                        updateDoc(doc(db, "leads", l.id), { status: "REFUNDED" })
                    ));
                }
                
                if (corruptedLeads.length > 0 || leadsToRestore.length > 0) {
                    console.log("Auto-heal complete!");
                }
            } catch (e) {
                console.error("Auto-heal failed:", e);
            }
        };

        fixBrokenLeads();
    }, [leads, isDirector]);

    // 2. Handle Assignment
    const handleAssignChange = async (leadId, staffId) => {
        if (!staffId) return;
        const selectedStaff = staffList.find(s => s.uid === staffId);
        if (window.confirm(`Assign this lead to ${selectedStaff.name}?`)) {
            const result = await assignLead(leadId, selectedStaff, userProfile.name);
            if (result.success) loadData(); // Log only
            else alert(`Assignment Failed: ${result.error}`);
        }
    };

    // 2.5 Handle Delete
    const handleDelete = async (leadId, e) => {
        e.stopPropagation(); // Prevent row click
        
        const leadToDelete = leads.find(l => l.id === leadId);
        if (leadToDelete?.status === 'CONVERTED' && userProfile?.role === 'manager') {
            alert("Managers cannot delete CONVERTED leads. Please contact the Director.");
            return;
        }

        if (window.confirm("Are you sure you want to DELETE this lead? This action cannot be undone.")) {
            const result = await deleteLead(leadId);
            if (result.success) {
                alert("Lead deleted successfully.");
                // loadData(); // Auto updates
            } else {
                alert("Failed to delete lead: " + result.error);
            }
        }
    };

    // 2.6 Handle Edit
    const handleEdit = (lead, e) => {
        e.stopPropagation();
        setEditingLead(lead);
    };

    // 2.7 Bulk Actions
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            // Select all currently filtered leads
            const allIds = filteredLeads.map(l => l.id);
            setSelectedLeads(allIds);
        } else {
            setSelectedLeads([]);
        }
    };

    const handleSelectRow = (e, leadId) => {
        e.stopPropagation();
        if (e.target.checked) {
            setSelectedLeads(prev => [...prev, leadId]);
        } else {
            setSelectedLeads(prev => prev.filter(id => id !== leadId));
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedLeads.length) return;
        
        if (userProfile?.role === 'manager') {
            const hasConverted = selectedLeads.some(id => {
                const l = leads.find(lead => lead.id === id);
                return l?.status === 'CONVERTED';
            });
            if (hasConverted) {
                alert("You have selected one or more CONVERTED leads. Managers cannot delete CONVERTED leads. Please deselect them and try again.");
                return;
            }
        }

        if (window.confirm(`Are you sure you want to DELETE ${selectedLeads.length} selected lead(s)? This action cannot be undone.`)) {
            setLoading(true);
            try {
                await Promise.all(selectedLeads.map(id => deleteLead(id)));
                setSelectedLeads([]);
                alert(`Successfully deleted ${selectedLeads.length} lead(s).`);
            } catch (err) {
                alert(`Error during bulk delete: ${err.message}`);
            }
            setLoading(false);
        }
    };

    const handleBulkAssign = async (staffId) => {
        if (!staffId || !selectedLeads.length) return;
        const selectedStaff = staffList.find(s => s.uid === staffId);
        
        if (window.confirm(`Assign ${selectedLeads.length} lead(s) to ${selectedStaff.name}?`)) {
            setLoading(true);
            try {
                // assignLead requires (leadId, staffObj, assignedBy)
                await Promise.all(selectedLeads.map(id => assignLead(id, selectedStaff, userProfile.name)));
                setSelectedLeads([]);
                alert(`Successfully assigned ${selectedLeads.length} lead(s).`);
            } catch (err) {
                alert(`Error during bulk assignment: ${err.message}`);
            }
            setLoading(false);
        }
    };

    // Helper for Premium Card Styles (Director Theme)
    const getCardStyle = (type) => {
        switch (type) {
            case 'revenue': return "bg-gradient-to-br from-white to-blue-50 border-blue-100 shadow-blue-100/50";
            case 'new': return "bg-gradient-to-br from-white to-green-50 border-green-100 shadow-green-100/50"; // Mapped 'today' to 'new' concept
            case 'students': return "bg-gradient-to-br from-white to-purple-50 border-purple-100 shadow-purple-100/50";
            case 'pending': return "bg-gradient-to-br from-white to-red-50 border-red-100 shadow-red-100/50";
            default: return "bg-white";
        }
    };


    // 3. Filter Leads
    // Defensive check: Ensure leads is an array before filtering
    const safeLeads = Array.isArray(leads) ? leads : [];

    const filteredLeads = safeLeads.filter(l => {
        if (!l) return false; // Skip null leads
        const name = l.studentName ? String(l.studentName).toLowerCase() : "";
        const phone = l.phone ? String(l.phone) : "";

        const matchesSearch = name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm);

        let matchesStatus = true;
        if (filterStatus === "PENDING_ALL") { // NEW: Special Filter for "Pending Follow Ups" Card
            const isConverted = ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN', 'CLOSED', 'LOST', 'REJECTED'].includes(l.status);
            if (isConverted) {
                matchesStatus = false;
            } else {
                // Date Check
                const localDate = new Date();
                const todayStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                // Match if explicitly 'FOLLOW_UP' OR has a due date in past/today
                matchesStatus = l.status === 'FOLLOW_UP' || (l.nextFollowUp && l.nextFollowUp <= todayStr);
            }
        } else {
            // Standard equality check for other statuses
            matchesStatus = filterStatus === "ALL" || l.status === filterStatus;
        }

        const matchesSource = filterSource === "ALL" || l.source === filterSource;

        // Date Filter
        let matchesDate = true;
        if (startDate || endDate) {
            let leadDate = "";
            // Handle Timestamp or String
            if (l.createdAt?.seconds) {
                // Use Local Time (en-CA gives YYYY-MM-DD)
                const d = new Date(l.createdAt.seconds * 1000);
                leadDate = d.toLocaleDateString('en-CA');
            } else if (typeof l.createdAt === 'string') {
                leadDate = l.createdAt.split('T')[0];
            }

            if (leadDate) {
                if (startDate && leadDate < startDate) matchesDate = false;
                if (endDate && leadDate > endDate) matchesDate = false;
            }
        }

        // Counselor Filter (Assigned To)
        let matchesCounselor = true;
        if (canManageLeads && selectedCounselor !== "ALL") {
            const currentStaff = staffList.find(s => s.uid === selectedCounselor);
            const staffName = currentStaff ? currentStaff.name : ""; // Get Name for Fallback Match

            // Helper to check if string is a valid Firebase UID
            const isUid = (str) => str && str.length > 20 && !str.includes(' ');
            const hasValidUid = isUid(l.assignedTo);

            // Match by UID (New System) OR Match by Name (Legacy System)
            matchesCounselor = (l.assignedTo === selectedCounselor) ||
                (!hasValidUid && staffName && l.assignedByName === staffName);
        }

        // Director Center Filter
        // FIX: If a specific counselor is selected, show ALL their leads regardless of Center (to match Staff View)
        let matchesCenter = true;
        if (isDirector && viewCenter !== 'ALL') {
            // If we are filtering by a specific counselor, we allow their leads from ANY center to show
            // Otherwise, we strictly filter by the selected center
            if (selectedCounselor !== "ALL" && matchesCounselor) {
                matchesCenter = true;
            } else {
                matchesCenter = (l.centerId || "").trim() === viewCenter;
            }
        }

        // BDE Name Filter (Source Details)
        let matchesBDEName = true;
        if (filterBDEName !== "ALL") {
            // Check if source matches BDE (optional, but safer) and name matches
            const bdeName = l.bdeName || (typeof l.sourceDetails === 'string' ? l.sourceDetails : (l.sourceDetails?.enteredBy || ""));
            matchesBDEName = (l.source === 'BDE' && bdeName === filterBDEName);
        }

        return matchesSearch && matchesStatus && matchesSource && matchesCenter && matchesDate && matchesCounselor && matchesBDEName;
    });

    // Extract Unique BDE Names for Filter
    const bdeNames = [...new Set(safeLeads
        .filter(l => l.source === 'BDE')
        .map(l => l.bdeName || (typeof l.sourceDetails === 'string' ? l.sourceDetails : l.sourceDetails?.enteredBy))
    )].sort();

    // New: Export to CSV
    const exportToCSV = () => {
        if (filteredLeads.length === 0) return alert("No data to export!");

        const headers = ["Date", "Student Name", "Phone", "Source", "Source Details", "Course", "Status", "Assigned To Name", "Assigned To ID", "Center"];

        const rows = filteredLeads.map(l => {
            const dateStr = l.createdAt?.seconds
                ? new Date(l.createdAt.seconds * 1000).toLocaleDateString('en-IN')
                : (l.createdAt || '-');

            return [
                `"${dateStr}"`,
                `"${l.studentName || ''}"`,
                `"${l.phone || ''}"`,
                `"${l.source || ''}"`,
                `"${l.source || ''}"`,
                `"${l.bdeName || (typeof l.sourceDetails === 'string' ? l.sourceDetails : (l.sourceDetails?.enteredBy || ""))}"`,
                `"${l.courseInterest || ''}"`,
                `"${l.courseInterest || ''}"`,
                `"${l.status || ''}"`,
                `"${l.assignedByName || 'Unassigned'}"`,
                `"${l.assignedTo || ''}"`,
                `"${l.centerId || ''}"`
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `crm_leads_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    // 4. Calculate Stats
    const stats = {
        total: filteredLeads.length,
        followUps: filteredLeads.filter(l => {
            const isConverted = ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN', 'CLOSED', 'LOST', 'REJECTED'].includes(l.status);
            if (isConverted) return false; // Don't count converted/rejected leads as pending

            // Date Check (Local Date String Comparison)
            const localDate = new Date();
            const todayStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

            return l.status === 'FOLLOW_UP' || (l.nextFollowUp && l.nextFollowUp <= todayStr);
        }).length,
        newLeads: filteredLeads.filter(l => l.status === 'NEW').length,
        converted: filteredLeads.filter(l => ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN'].includes(l.status)).length
    };

    return (
        <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen relative font-sans">

            {/* Edit Modal Overlay */}
            {editingLead && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="max-w-2xl w-full">
                        <AddLead
                            userProfile={userProfile}
                            initialData={Object.keys(editingLead).length > 0 ? editingLead : null}
                            onClose={() => setEditingLead(null)}
                            onSuccess={() => {
                                setEditingLead(null);
                                // loadData(); // Auto updates
                            }}
                        />
                    </div>
                </div>
            )}

            {/* HEADER & WELCOME (Dark Theme - Director Style) */}
            <div className="relative overflow-hidden bg-slate-900 rounded-3xl shadow-xl p-8 mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
                {/* Decorative Background Effects */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 rounded-full blur-3xl opacity-20 bg-indigo-500 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 rounded-full blur-3xl opacity-10 bg-purple-500 pointer-events-none"></div>

                <div className="relative z-10 w-full md:w-auto text-left">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider bg-white/10 text-indigo-200 border border-white/10">
                            <Users className="w-3 h-3" /> LEAD CRM & DISTRIBUTION
                        </span>
                        <span className="text-slate-400 text-xs font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </span>
                    </div>
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
                        {greeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{(userProfile?.name || "User").split(' ')?.[0]}</span>
                    </h1>
                    <p className="text-slate-400 text-sm max-w-xl">
                        Manage inquiries for <span className="font-bold text-slate-200">{userProfile?.centerId || "your center"}</span>.
                    </p>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    <button
                        onClick={() => setEditingLead({})} // Empty object signals NEW lead, Modal logic handles it
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-4 rounded-xl font-bold flex items-center gap-3 shadow-lg shadow-emerald-900/20 hover:scale-105 transition-transform"
                    >
                        <div className="bg-white/20 p-1 rounded-lg"><Edit className="w-4 h-4" /></div>
                        <span>Add New Lead</span>
                    </button>

                    <button
                        onClick={exportToCSV}
                        className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-6 py-4 rounded-xl font-bold flex items-center gap-3 transition-all backdrop-blur-md"
                    >
                        <Download className="w-4 h-4" /> Export
                    </button>
                </div>
            </div>

            {/* DIRECTOR CENTER FILTER */}
            {isDirector && (
                <div className="flex justify-center -mt-4 mb-2 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-gray-200 inline-flex gap-1">
                        {['ALL', 'UN_COLLEGE', 'UN_NASHIK_RD', 'PRAYAS'].map(c => (
                            <button
                                key={c}
                                onClick={() => setViewCenter(c)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${viewCenter === c
                                    ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md transform scale-105'
                                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                    }`}
                            >
                                {c === 'ALL' ? 'All Centers' : c.replace('UN_', '').replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* STATS CARDS (Premium Gradient Style) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {/* TOTAL */}
                <div
                    onClick={() => setFilterStatus("ALL")}
                    className={`${getCardStyle('revenue')} p-6 rounded-2xl border shadow-sm flex items-center gap-4 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group cursor-pointer ${filterStatus === 'ALL' ? 'ring-2 ring-blue-500' : ''}`}
                >
                    <div className="bg-blue-100 p-4 rounded-xl text-blue-600 shadow-inner group-hover:bg-blue-200 transition"><Users className="w-8 h-8" /></div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Inquiries</p>
                        <h2 className="text-3xl font-black text-slate-800">{stats.total}</h2>
                    </div>
                </div>

                {/* FOLLOW UPS */}
                <div
                    onClick={() => setFilterStatus("PENDING_ALL")}
                    className={`${getCardStyle('pending')} p-6 rounded-2xl border shadow-sm flex items-center gap-4 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group cursor-pointer ${filterStatus === 'PENDING_ALL' ? 'ring-2 ring-red-500' : ''}`}
                >
                    <div className="bg-amber-100 p-4 rounded-xl text-amber-600 shadow-inner group-hover:bg-amber-200 transition"><Clock className="w-8 h-8" /></div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pending Follow Ups</p>
                        <h2 className="text-3xl font-black text-slate-800">{stats.followUps}</h2>
                    </div>
                </div>

                {/* NEW LEADS */}
                <div
                    onClick={() => setFilterStatus("NEW")}
                    className={`${getCardStyle('pending')} p-6 rounded-2xl border shadow-sm flex items-center gap-4 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group cursor-pointer ${filterStatus === 'NEW' ? 'ring-2 ring-rose-500' : ''}`}
                >
                    <div className="bg-rose-100 p-4 rounded-xl text-rose-600 shadow-inner group-hover:bg-rose-200 transition"><AlertCircle className="w-8 h-8" /></div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">New Leads</p>
                        <h2 className="text-3xl font-black text-slate-800">{stats.newLeads}</h2>
                    </div>
                </div>

                {/* CONVERTED */}
                <div
                    onClick={() => setFilterStatus("CONVERTED")}
                    className={`${getCardStyle('new')} p-6 rounded-2xl border shadow-sm flex items-center gap-4 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group cursor-pointer ${filterStatus === 'CONVERTED' ? 'ring-2 ring-green-500' : ''}`}
                >
                    <div className="bg-green-100 p-4 rounded-xl text-green-600 shadow-inner group-hover:bg-green-200 transition"><CheckCircle className="w-8 h-8" /></div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Converted</p>
                        <h2 className="text-3xl font-black text-slate-800">{stats.converted}</h2>
                    </div>
                </div>
            </div>
            {/* ... (rest of the file until table) ... */}

            {/* Premium Search & Filter Toolbar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">

                {/* Search Bar */}
                <div className="relative w-full md:w-80 group">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search student name or phone..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium text-slate-700"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Filters */}
                <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    {/* Status Filter */}
                    <div className="relative min-w-[150px]">
                        <Filter className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <select
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="PENDING_ALL">Pending (Due & Follow Ups)</option>
                            <option value="NEW">New Leads</option>
                            <option value="FOLLOW_UP">Follow Ups (Only)</option>
                            <option value="CONVERTED">Converted</option>
                            <option value="REFUNDED">Refunded</option>
                            <option value="ASSIGNED">Assigned</option>
                            <option value="VISITED">Visited</option>
                            <option value="COUNSELLING_DONE">Counselling Done</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>

                    {/* Source Filter */}
                    <div className="relative min-w-[150px]">
                        <Users className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <select
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                            value={filterSource}
                            onChange={(e) => setFilterSource(e.target.value)}
                        >
                            <option value="ALL">All Sources</option>
                            <option value="Walk-in">Walk-in</option>
                            <option value="Website">Website</option>
                            <option value="Referral">Referral</option>
                            <option value="Social Media">Social Media</option>
                        </select>
                    </div>

                    {/* NEW: BDE Name Filter (Dynamic) */}
                    <div className="relative min-w-[150px]">
                        <UserCheck className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <select
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                            value={filterBDEName}
                            onChange={(e) => setFilterBDEName(e.target.value)}
                        >
                            <option value="ALL">All BDE Sources</option>
                            {bdeNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>

                    {/* NEW Counselors Filter (Managers/Directors) */}
                    {canManageLeads && (
                        <div className="relative min-w-[180px]">
                            <UserCheck className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <select
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                                value={selectedCounselor}
                                onChange={(e) => setSelectedCounselor(e.target.value)}
                            >
                                <option value="ALL">All Counselors</option>
                                {staffList.map(s => (
                                    <option key={s.uid} value={s.uid}>{s.name} ({s.centerId})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Date Filter Inputs */}
                    <div className="flex gap-2 items-center bg-gray-50 p-1.5 rounded-xl border border-gray-200 flex-shrink-0">
                        <span className="text-xs font-bold text-gray-400 pl-2 uppercase">Date:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="bg-white border text-xs rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="bg-white border text-xs rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {(startDate || endDate) && (
                            <button onClick={() => { setStartDate(''); setEndDate('') }} className="text-xs text-red-500 hover:text-red-700 font-bold px-2">✕</button>
                        )}
                    </div>
                </div>
            </div>

            {/* Bulk Action Bar */}
            {canManageLeads && selectedLeads.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm">
                            {selectedLeads.length}
                        </div>
                        <span className="text-indigo-900 font-bold text-sm">Leads Selected</span>
                        <button 
                            onClick={() => setSelectedLeads([])}
                            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium ml-2 underline"
                        >
                            Clear Selection
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <select
                                className="pl-3 pr-8 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm w-48"
                                value=""
                                onChange={(e) => handleBulkAssign(e.target.value)}
                            >
                                <option value="" disabled>Bulk Assign To...</option>
                                {staffList.map(s => (
                                    <option key={s.uid} value={s.uid}>{s.name} ({s.centerId})</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={handleBulkDelete}
                            className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 border border-red-200 transition-colors shadow-sm"
                        >
                            <Trash2 className="w-4 h-4" /> Delete Selected
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        {/* ... thead ... */}
                        <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-xs">
                            <tr>
                                {canManageLeads && (
                                    <th className="p-4 w-12 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={selectedLeads.length > 0 && selectedLeads.length === filteredLeads.length}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                )}
                                <th className="p-4">Date</th>
                                <th className="p-4">Student</th>
                                <th className="p-4">Source</th>
                                <th className="p-4">Course</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Assigned To</th>
                                {canManageLeads && <th className="p-4">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={canManageLeads ? "8" : "6"} className="p-8 text-center">Loading Data...</td></tr>
                            ) : filteredLeads.slice(0, visibleCount).map(lead => (
                                <tr
                                    key={lead.id}
                                    className="hover:bg-blue-50 transition cursor-pointer"
                                    onClick={() => navigate(`/staff/leads/${lead.id}`)}
                                >
                                    
                                    {/* Bulk Select Checkbox */}
                                    {canManageLeads && (
                                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={selectedLeads.includes(lead.id)}
                                                onChange={(e) => handleSelectRow(e, lead.id)}
                                            />
                                        </td>
                                    )}

                                    {/* Date */}
                                    <td className="p-4 text-gray-500">
                                        {lead.createdAt?.seconds ? new Date(lead.createdAt.seconds * 1000).toLocaleDateString('en-IN') : 'N/A'}
                                    </td>

                                    {/* Student */}
                                    <td className="p-4">
                                        <p className="font-bold text-gray-900">{lead.studentName || "Unknown"}</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs text-gray-500">{lead.phone || "No Phone"}</p>
                                            {/* DUPLICATE INDICATOR (Robust Check) */}
                                            {safeLeads.filter(l => String(l.phone || "").trim() === String(lead.phone || "").trim() && String(lead.phone || "").length > 5).length > 1 && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 border border-red-200 flex items-center gap-1 animate-pulse">
                                                    <AlertCircle className="w-3 h-3" /> Duplicate
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Source - New Column */}
                                    <td className="p-4">
                                        <span className="font-semibold text-gray-700 text-xs block">
                                            {lead.source || "Unknown"}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {lead.bdeName || (typeof lead.sourceDetails === 'string' ? lead.sourceDetails : (lead.sourceDetails?.enteredBy || ""))}
                                        </span>
                                    </td>

                                    {/* Course */}
                                    <td className="p-4">
                                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-semibold">
                                            {lead.courseInterest || "N/A"}
                                        </span>
                                    </td>                                    {/* Status Badge */}
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${lead.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                                            lead.status === 'REFUNDED' ? 'bg-rose-100 text-rose-600' :
                                            lead.status === 'NEW' ? 'bg-purple-100 text-purple-600' :
                                                lead.status === 'FOLLOW_UP' ? 'bg-yellow-100 text-yellow-700' :
                                                    lead.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-600' :
                                                        'bg-green-100 text-green-600'
                                            }`}>
                                            {lead.status}
                                        </span>
                                    </td>

                                    {/* Assignment Column (Complex Logic) */}
                                    <td className="p-4">
                                        {isDirector || isManager ? (
                                            // DIRECTOR & MANAGER: Shows Dropdown to Assign
                                            <div className="relative" onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    className="w-full border border-gray-300 rounded p-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={lead.assignedTo || ""}
                                                    onChange={(e) => handleAssignChange(lead.id, e.target.value)}
                                                >
                                                    <option value="" disabled>-- Assign Staff --</option>
                                                    {/* Fallback if assigned user is not in the list */}
                                                    {lead.assignedTo && !staffList.find(s => s.uid === lead.assignedTo) && (
                                                        <option value={lead.assignedTo} disabled>
                                                            {lead.assignedByName || "Unknown Staff"} (Not in List)
                                                        </option>
                                                    )}
                                                    {staffList.map(staff => (
                                                        <option key={staff.uid} value={staff.uid}>
                                                            {staff.name} ({staff.centerId}) [#{staff.uid.slice(-4)}]
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            // STAFF: Just shows name
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <UserCheck className="w-4 h-4" />
                                                {lead.assignedByName || "Unassigned"}
                                            </div>
                                        )}
                                    </td>

                                    {/* Actions Column (Manager Only) */}
                                    {canManageLeads && (
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => handleEdit(lead, e)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                                                    title="Edit Lead"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(lead.id, e)}
                                                    className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition"
                                                    title="Delete Lead"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    )}

                                </tr>
                            ))}



                            {/* Load More Button Row */}
                            {visibleCount < filteredLeads.length && (
                                <tr>
                                    <td colSpan={canManageLeads ? "8" : "6"} className="p-4 text-center bg-gray-50 border-t border-gray-100">
                                        <button
                                            onClick={() => setVisibleCount(prev => prev + 10)}
                                            className="px-6 py-2 bg-white border border-gray-300 rounded-full shadow-sm text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-all flex items-center gap-2 mx-auto"
                                        >
                                            Show More ({filteredLeads.length - visibleCount} remaining)
                                        </button>
                                    </td>
                                </tr>
                            )}

                            {filteredLeads.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={canManageLeads ? "8" : "6"} className="p-8 text-center text-gray-400">
                                        <div className="font-bold mb-2">No leads found.</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

    );
};

export default LeadDashboard;
