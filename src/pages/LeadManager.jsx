import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserPlus, Phone, Calendar, ArrowRight, CheckCircle, Download, Filter, Search, RefreshCw } from 'lucide-react';
import { checkLeadExists } from '../services/leadService';
import { getCachedLeads, subscribeLeads } from '../services/cacheService';

const LeadManager = ({ userProfile }) => {
    const [leads, setLeads] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [newLead, setNewLead] = useState({ name: '', phone: '', course: '' });
    const [loading, setLoading] = useState(true);
    const [savingLead, setSavingLead] = useState(false);
    const [lastSynced, setLastSynced] = useState(null);

    // Roles
    const isDirector = userProfile?.role === 'DIRECTOR';
    const isManager = userProfile?.role === 'MANAGER';
    const canManage = isDirector || isManager;

    // Filters
    const [viewCenter, setViewCenter] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedCounselor, setSelectedCounselor] = useState('ALL');

    // 1. Fetch Leads based on Role (Legacy compatibility wrapper, now managed by real-time hooks)
    const fetchLeads = (forceRefresh = false) => {
        console.log("🔄 Real-time sync: Leads are synced live from Firestore.");
    };

    // 2. Fetch Staff List (Only for Admin to assign/filter)
    const fetchStaff = async () => {
        if (!canManage) return;
        try {
            // Fetch all known staff/counselors
            const qStaff = query(collection(db, "users"), where("role", "==", "STAFF"));
            const snapshot = await getDocs(qStaff);
            setStaffList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (err) {
            console.error("Error fetching staff:", err);
        }
    };

    useEffect(() => {
        setLoading(true);
        const filter = canManage ? 'ALL' : (userProfile.centerId || 'UN_COLLEGE');
        
        // Subscribe to Leads in real-time
        const unsubLeads = subscribeLeads(filter, (data) => {
            const leadData = [...data];
            leadData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setLeads(leadData);
            setLastSynced(new Date());
            setLoading(false);
        });

        fetchStaff();

        return () => {
            unsubLeads();
        };
    }, []);

    // Filter Logic
    const filteredLeads = leads.filter(l => {
        // 1. Center Filter (Managers/Directors)
        if (canManage && viewCenter !== 'ALL') {
            if ((l.centerId || "").trim() !== viewCenter) return false;
        }

        // 2. Date Filter
        if (startDate && endDate) {
            const leadDate = l.createdAt?.seconds ? new Date(l.createdAt.seconds * 1000) : null;
            if (leadDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // Include end date entirely
                if (leadDate < start || leadDate > end) return false;
            }
        }

        // 3. Counselor Filter (Managers/Directors)
        if (canManage && selectedCounselor !== 'ALL') {
            // Filter by assigned staff ID
            if (l.assignedTo !== selectedCounselor) return false;
        }

        return true;
    });

    // CRM Export
    const exportToCSV = () => {
        if (filteredLeads.length === 0) return alert("No data to export!");

        const headers = ["Student Name", "Phone", "Course", "Center", "Status", "Assigned To", "Remarks", "Date"];

        const rows = filteredLeads.map(l => [
            `"${l.name || ''}"`,
            `"${l.phone || ''}"`,
            `"${l.course || ''}"`,
            `"${l.centerId || ''}"`,
            `"${l.status || ''}"`,
            `"${l.assignedName || 'Unassigned'}"`,
            `"${l.remarks || ''}"`,
            `"${l.createdAt?.seconds ? new Date(l.createdAt.seconds * 1000).toLocaleDateString() : ''}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `crm_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 3. Add New Lead (Manual Entry)
    const handleAddLead = async (e) => {
        e.preventDefault();

        if (savingLead) return; // Prevent double submission
        setSavingLead(true);

        const cleanPhone = String(newLead.phone).replace(/\D/g, '').slice(-10);

        if (cleanPhone.length !== 10) {
            alert("Please enter a valid 10-digit Phone Number.");
            setSavingLead(false);
            return;
        }

        try {
            // DUPLICATE CHECK
            const phoneCheck = await checkLeadExists(cleanPhone, 'PHONE');
            if (phoneCheck.exists) {
                alert(`Cannot save: Phone number already exists for ${phoneCheck.lead.studentName || 'Unknown'} (Assigned to: ${phoneCheck.lead.assignedByName || 'Unassigned'}).`);
                setSavingLead(false);
                return;
            }

            await addDoc(collection(db, "leads"), {
                ...newLead,
                phone: cleanPhone, // Ensure clean phone is saved
                studentName: newLead.name, // Ensure consistency with other components
                courseInterest: newLead.course, // Ensure consistency
                status: "NEW",
                assignedTo: null, // Unassigned initially
                assignedName: "Unassigned",
                centerId: userProfile.centerId || "UN_COLLEGE",
                createdAt: serverTimestamp()
            });
            setNewLead({ name: '', phone: '', course: '' });
            fetchLeads();
            alert("Lead Added Successfully");
        } catch (err) {
            console.error("Error adding lead:", err);
            alert("Failed to add lead");
        }
        setSavingLead(false);
    };

    // 4. Assign Lead Function
    const handleAssign = async (leadId, staffId, staffName) => {
        try {
            const leadRef = doc(db, "leads", leadId);
            await updateDoc(leadRef, {
                assignedTo: staffId,
                assignedName: staffName,
                status: "ASSIGNED"
            });
            fetchLeads(); // Refresh list
        } catch (err) {
            alert("Error assigning lead");
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <UserPlus className="w-6 h-6 text-blue-600" /> Lead Management (CRM)
                    </h1>
                    <p className="text-sm text-gray-500">{canManage ? "Assign, Monitor & Export Data" : "My Assigned Leads"}</p>
                </div>

                {/* GLOBAL ACTION: SYNC & EXPORT */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {lastSynced && (
                        <span className="text-[10px] text-gray-400 font-mono hidden md:inline">
                            Last synced: {lastSynced.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={() => fetchLeads(true)}
                        disabled={loading}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 border border-gray-200 transition disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Refreshing...' : 'Sync Data'}
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition"
                    >
                        <Download className="w-4 h-4" /> Export Filtered Data
                    </button>
                </div>
            </div>

            {/* FILTERS SECTION */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-bold uppercase text-gray-500">Filters</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Date Range */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-500">From Date</label>
                        <input
                            type="date"
                            className="border p-2 rounded-lg text-sm bg-gray-50"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-500">To Date</label>
                        <input
                            type="date"
                            className="border p-2 rounded-lg text-sm bg-gray-50"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>

                    {/* Admin Only Filters */}
                    {canManage && (
                        <>
                            {/* Center Filter */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500">Center</label>
                                <select
                                    className="border p-2 rounded-lg text-sm bg-gray-50"
                                    value={viewCenter}
                                    onChange={(e) => setViewCenter(e.target.value)}
                                >
                                    <option value="ALL">All Centers</option>
                                    <option value="UN_COLLEGE">Unacademy College Road</option>
                                    <option value="UN_NASHIK_RD">Unacademy Nashik Road</option>
                                    <option value="PRAYAS">Prayaas Center</option>
                                </select>
                            </div>

                            {/* Counselor Filter (NEW) */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500">Counselor</label>
                                <select
                                    className="border p-2 rounded-lg text-sm bg-gray-50"
                                    value={selectedCounselor}
                                    onChange={(e) => setSelectedCounselor(e.target.value)}
                                >
                                    <option value="ALL">All Counselors</option>
                                    {staffList.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.centerId})</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Add Lead Form */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-8">
                <h3 className="font-bold text-sm mb-3 uppercase text-gray-500 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" /> Add New Inquiry
                </h3>
                <form onSubmit={handleAddLead} className="flex flex-col md:flex-row gap-4">
                    <input
                        type="text" placeholder="Student Name" required
                        className="border p-2 rounded-lg flex-1 bg-gray-50"
                        value={newLead.name} onChange={e => setNewLead({ ...newLead, name: e.target.value })}
                    />
                    <input
                        type="tel" placeholder="Phone" required
                        className="border p-2 rounded-lg flex-1 bg-gray-50"
                        value={newLead.phone} onChange={e => setNewLead({ ...newLead, phone: e.target.value })}
                    />
                    <input
                        type="text" placeholder="Course Interest" required
                        className="border p-2 rounded-lg flex-1 bg-gray-50"
                        value={newLead.course} onChange={e => setNewLead({ ...newLead, course: e.target.value })}
                    />
                    <button 
                        disabled={savingLead}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-lg transition disabled:opacity-50"
                    >
                        {savingLead ? "Adding..." : "Add Lead"}
                    </button>
                </form>
            </div>

            {/* Leads List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-700">Inquiry List <span className="text-gray-400 text-xs font-normal">({filteredLeads.length} records)</span></h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white text-gray-500 uppercase text-xs border-b border-gray-100">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Name</th>
                                <th className="p-4">Phone</th>
                                <th className="p-4">Remarks</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Assigned To</th>
                                {canManage && <th className="p-4">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredLeads.map(lead => (
                                <tr key={lead.id} className="hover:bg-blue-50/50 transition duration-150">
                                    <td className="p-4 text-xs text-gray-400">
                                        {lead.createdAt?.seconds ? new Date(lead.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="p-4 font-bold text-gray-800">
                                        {lead.name}
                                        <div className="text-xs text-blue-600 font-medium">
                                            {lead.course} {lead.board ? `• ${lead.board}` : ''}
                                        </div>
                                    </td>
                                    <td className="p-4 font-mono text-gray-600">{lead.phone}</td>
                                    <td className="p-4 text-xs text-gray-500 max-w-[200px] truncate" title={lead.remarks}>
                                        {lead.remarks || '-'}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${lead.status === 'NEW' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                                            {lead.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-500">
                                        {lead.assignedName || <span className="text-red-300 italic">Unassigned</span>}
                                    </td>

                                    {/* Admin Actions: Assign Dropdown */}
                                    {canManage && (
                                        <td className="p-4">
                                            <select
                                                className="border border-gray-200 p-1.5 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                                                onChange={(e) => {
                                                    const index = e.target.selectedIndex;
                                                    const label = e.target.options[index].text;
                                                    handleAssign(lead.id, e.target.value, label);
                                                }}
                                                defaultValue=""
                                            >
                                                <option value="" disabled>Assign Staff</option>
                                                {staffList.map(staff => (
                                                    <option key={staff.id} value={staff.id}>{staff.name} ({staff.centerId})</option>
                                                ))}
                                            </select>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {filteredLeads.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
                                        <Search className="w-8 h-8 opacity-20" />
                                        <span>No leads found matching your filters.</span>
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

export default LeadManager;
