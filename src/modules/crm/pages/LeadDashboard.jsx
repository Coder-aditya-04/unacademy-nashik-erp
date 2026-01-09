import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLeads, assignLead, deleteLead } from '../../../services/leadService';
import { fetchStaffList } from '../../../services/userService';
import { Users, Filter, Search, UserCheck, Clock, AlertCircle, CheckCircle, Trash2, Edit, Download } from 'lucide-react';
import AddLead from './AddLead'; // Import logic-rich form

const LeadDashboard = ({ userProfile }) => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    // Initialize state from sessionStorage or defaults
    const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('lead_search') || "");
    const [viewCenter, setViewCenter] = useState(() => sessionStorage.getItem('lead_center') || 'ALL');
    const [editingLead, setEditingLead] = useState(null);

    const [filterStatus, setFilterStatus] = useState(() => sessionStorage.getItem('lead_filterStatus') || "ALL");
    const [filterSource, setFilterSource] = useState(() => sessionStorage.getItem('lead_filterSource') || "ALL");
    const [startDate, setStartDate] = useState(() => sessionStorage.getItem('lead_startDate') || "");
    const [endDate, setEndDate] = useState(() => sessionStorage.getItem('lead_endDate') || "");
    const [selectedCounselor, setSelectedCounselor] = useState(() => sessionStorage.getItem('lead_counselor') || "ALL");
    const [filterBDEName, setFilterBDEName] = useState(() => sessionStorage.getItem('lead_filterBDEName') || "ALL");

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

    const isDirector = userProfile?.role?.toUpperCase() === 'DIRECTOR';
    const isManager = userProfile?.role?.toUpperCase() === 'MANAGER';
    const canManageLeads = isDirector || isManager;

    // 1. Initial Data Load
    useEffect(() => {
        loadData();
    }, [userProfile]);

    const loadData = async () => {
        setLoading(true);
        // Get Leads
        try {
            const leadData = await fetchLeads(userProfile);
            setLeads(leadData);
            if (leadData.length === 0) console.log("Fetch returned 0 leads");
        } catch (err) {
            console.error(err);
            alert("Error Loading Leads: " + err.message);
        }

        // Staff List Population
        if (isDirector) {
            // Director: Fetch ALL staff (Global access)
            const allStaff = await fetchStaffList(null);
            setStaffList(allStaff);
        } else if (isManager) {
            // Manager: Fetch ONLY staff from their center
            if (userProfile.centerId) {
                const centerStaff = await fetchStaffList(userProfile.centerId);
                setStaffList(centerStaff);
            }
        }
        setLoading(false);
    };

    // 2. Handle Assignment
    const handleAssignChange = async (leadId, staffId) => {
        if (!staffId) return;
        const selectedStaff = staffList.find(s => s.uid === staffId);
        if (window.confirm(`Assign this lead to ${selectedStaff.name}?`)) {
            const result = await assignLead(leadId, selectedStaff, userProfile.name);
            if (result.success) loadData();
            else alert(`Assignment Failed: ${result.error}`);
        }
    };

    // 2.5 Handle Delete
    const handleDelete = async (leadId, e) => {
        e.stopPropagation(); // Prevent row click
        if (window.confirm("Are you sure you want to DELETE this lead? This action cannot be undone.")) {
            const result = await deleteLead(leadId);
            if (result.success) {
                alert("Lead deleted successfully.");
                loadData();
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
            const isConverted = ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN', 'CLOSED', 'LOST'].includes(l.status);
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

        // Director Center Filter
        let matchesCenter = true;
        if (isDirector && viewCenter !== 'ALL') {
            matchesCenter = (l.centerId || "").trim() === viewCenter;
        }

        // Counselor Filter (Assigned To)
        let matchesCounselor = true;
        if (canManageLeads && selectedCounselor !== "ALL") {
            matchesCounselor = l.assignedTo === selectedCounselor;
        }

        // BDE Name Filter (Source Details)
        let matchesBDEName = true;
        if (filterBDEName !== "ALL") {
            // Check if source matches BDE (optional, but safer) and name matches
            const bdeName = typeof l.sourceDetails === 'string' ? l.sourceDetails : (l.sourceDetails?.enteredBy || "");
            matchesBDEName = (l.source === 'BDE' && bdeName === filterBDEName);
        }

        return matchesSearch && matchesStatus && matchesSource && matchesCenter && matchesDate && matchesCounselor && matchesBDEName;
    });

    // Extract Unique BDE Names for Filter
    const bdeNames = [...new Set(safeLeads
        .filter(l => l.source === 'BDE' && l.sourceDetails)
        .map(l => typeof l.sourceDetails === 'string' ? l.sourceDetails : l.sourceDetails.enteredBy)
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
                `"${typeof l.sourceDetails === 'string' ? l.sourceDetails : (l.sourceDetails?.enteredBy || "")}"`,
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
            const isConverted = ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN', 'CLOSED', 'LOST'].includes(l.status);
            if (isConverted) return false; // Don't count converted leads as pending

            // Date Check (Local Date String Comparison)
            const localDate = new Date();
            const todayStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

            return l.status === 'FOLLOW_UP' || (l.nextFollowUp && l.nextFollowUp <= todayStr);
        }).length,
        newLeads: filteredLeads.filter(l => l.status === 'NEW').length,
        converted: filteredLeads.filter(l => ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN'].includes(l.status)).length
    };

    return (
        <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen relative">

            {/* Edit Modal Overlay */}
            {editingLead && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="max-w-2xl w-full">
                        <AddLead
                            userProfile={userProfile}
                            initialData={editingLead}
                            onClose={() => setEditingLead(null)}
                            onSuccess={() => {
                                setEditingLead(null);
                                loadData();
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Users className="w-6 h-6 text-blue-600" />
                            {isDirector ? "Lead Distribution Center" : isManager ? `Center Manager Portal (${userProfile?.centerId || 'N/A'})` : `My Lead Board`}
                        </h1>
                        <p className="text-sm text-gray-500">
                            Manage your inquiries and follow-ups efficiently.
                        </p>
                    </div>

                    {/* EXPORT BUTTON */}
                    <button
                        onClick={exportToCSV}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm transition transform hover:scale-105"
                    >
                        <Download className="w-4 h-4" /> Export Data ({filteredLeads.length})
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {/* TOTAL */}
                {/* TOTAL */}
                <div
                    onClick={() => setFilterStatus("ALL")}
                    className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group cursor-pointer ${filterStatus === 'ALL' ? 'ring-2 ring-blue-500' : ''}`}
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">Total Inquiries</p>
                            <p className="text-3xl font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors">{stats.total}</p>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                {/* FOLLOW UPS */}
                <div
                    onClick={() => setFilterStatus("PENDING_ALL")}
                    className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group cursor-pointer ${filterStatus === 'PENDING_ALL' ? 'ring-2 ring-orange-500' : ''}`}
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">Pending Follow Ups</p>
                            <p className="text-3xl font-extrabold text-slate-800 group-hover:text-orange-500 transition-colors">{stats.followUps}</p>
                        </div>
                        <div className="p-3 bg-orange-50 text-orange-500 rounded-xl group-hover:bg-orange-500 group-hover:text-white transition-all shadow-sm">
                            <Clock className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                {/* NEW LEADS */}
                {/* NEW LEADS */}
                <div
                    onClick={() => setFilterStatus("NEW")}
                    className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group cursor-pointer ${filterStatus === 'NEW' ? 'ring-2 ring-rose-500' : ''}`}
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">New Leads</p>
                            <p className="text-3xl font-extrabold text-slate-800 group-hover:text-rose-500 transition-colors">{stats.newLeads}</p>
                        </div>
                        <div className="p-3 bg-rose-50 text-rose-500 rounded-xl group-hover:bg-rose-500 group-hover:text-white transition-all shadow-sm">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                {/* CONVERTED */}
                {/* CONVERTED */}
                <div
                    onClick={() => setFilterStatus("CONVERTED")}
                    className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group cursor-pointer ${filterStatus === 'CONVERTED' ? 'ring-2 ring-emerald-500' : ''}`}
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">Converted</p>
                            <p className="text-3xl font-extrabold text-slate-800 group-hover:text-emerald-500 transition-colors">{stats.converted}</p>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                            <CheckCircle className="w-6 h-6" />
                        </div>
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

            {/* Table */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        {/* ... thead ... */}
                        <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-xs">
                            <tr>
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
                                <tr><td colSpan={canManageLeads ? "6" : "5"} className="p-8 text-center">Loading Data...</td></tr>
                            ) : filteredLeads.map(lead => (
                                <tr
                                    key={lead.id}
                                    className="hover:bg-blue-50 transition cursor-pointer"
                                    onClick={() => navigate(`/staff/leads/${lead.id}`)}
                                >

                                    {/* Date */}
                                    <td className="p-4 text-gray-500">
                                        {lead.createdAt?.seconds ? new Date(lead.createdAt.seconds * 1000).toLocaleDateString('en-IN') : 'N/A'}
                                    </td>

                                    {/* Student */}
                                    <td className="p-4">
                                        <p className="font-bold text-gray-900">{lead.studentName || "Unknown"}</p>
                                        <p className="text-xs text-gray-500">{lead.phone || "No Phone"}</p>
                                    </td>

                                    {/* Source - New Column */}
                                    <td className="p-4">
                                        <span className="font-semibold text-gray-700 text-xs block">
                                            {lead.source || "Unknown"}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {typeof lead.sourceDetails === 'string' ? lead.sourceDetails : (lead.sourceDetails?.enteredBy || "")}
                                        </span>
                                    </td>

                                    {/* Course */}
                                    <td className="p-4">
                                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-semibold">
                                            {lead.courseInterest || "N/A"}
                                        </span>
                                    </td>

                                    {/* Status Badge */}
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${lead.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
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

                            {filteredLeads.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={canManageLeads ? "6" : "5"} className="p-8 text-center text-gray-400">
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
