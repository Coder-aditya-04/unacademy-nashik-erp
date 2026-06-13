import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Search, Download, Calendar, Filter, UserCog, ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StudentManager from '../components/StudentManager';
import { exportToCSV, formatAdmissionsForExport } from '../utils/exportUtils';
import { fetchBatches } from '../services/batchService';
import { getCachedAdmissions } from '../services/cacheService';

const StudentRecords = ({ center, isManager, userProfile }) => {
    const navigate = useNavigate();
    const [admissions, setAdmissions] = useState([]);
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [viewCenter, setViewCenter] = useState(isManager ? (center?.id || 'UN_COLLEGE') : 'ALL');
    const [filterBatch, setFilterBatch] = useState("ALL");
    const [lastSynced, setLastSynced] = useState(null);

    // Filters
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    useEffect(() => {
        fetchData();
    }, [viewCenter]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchData(true);
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [viewCenter]);

    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            const currentViewCenter = isManager ? (center?.id || viewCenter) : viewCenter;

            // Fetch both parallelly (Admissions loaded from cache)
            const [allData, fetchedBatches] = await Promise.all([
                getCachedAdmissions(currentViewCenter, forceRefresh),
                fetchBatches()
            ]);
            setLastSynced(new Date());

            // Filter Batches by Center
            const centerBatches = fetchedBatches.filter(b => currentViewCenter === 'ALL' || (b.centerId || "UN_COLLEGE").trim() === currentViewCenter);
            setBatches(centerBatches);

            // 1. FILTER BY CENTER
            let filtered = allData;
            if (currentViewCenter !== 'ALL') {
                filtered = allData.filter(txn => {
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
                        return txnCenterId.includes("NASHIK RD") || txnCenterName.includes("NASHIK RD") || txnCenterName.includes("NASHIK ROAD");
                    }
                    if (viewId === 'PRAYAS') {
                        return txnCenterId.includes("PRAYAS") || txnCenterName.includes("PRAYAS");
                    }
                    const viewName = (center?.name || "").trim().toUpperCase();
                    if (viewName && txnCenterName && txnCenterName.includes(viewName)) return true;
                    return false;
                });
            }

            // 2. Filter by Active Status (Optional: User might want all records?)
            // Usually "Student Records" implies active students, but let's keep it consistent with Dashboard
            const activeData = filtered.filter(txn => ['ACTIVE', 'TOKEN_PAID', 'COMPLETED', 'REFUNDED'].includes(txn.status) || txn.refundAmount > 0);

            setAdmissions(activeData);
        } catch (err) {
            console.error("Error fetching admissions:", err);
            alert("Error loading data");
        }
        setLoading(false);
    };

    // Client-side Filtering
    const filteredData = admissions.filter(student => {
        const matchesSearch = (student.studentName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (student.phone || "").includes(searchTerm);

        // Date Filter
        let matchesDate = true;
        if (startDate || endDate) {
            let recordDate = "";
            if (student.createdAt?.seconds) {
                recordDate = new Date(student.createdAt.seconds * 1000).toLocaleDateString('en-CA');
            } else if (typeof student.createdAt === 'string') {
                recordDate = student.createdAt.split('T')[0]; // Simple string check
            }

            if (recordDate) {
                if (startDate && recordDate < startDate) matchesDate = false;
                if (endDate && recordDate > endDate) matchesDate = false;
            }
        }

        // Batch Filter
        let matchesBatch = true;
        if (filterBatch !== "ALL") {
            const studentBatch = (student.batchAssigned || "").trim();
            if (filterBatch === "UNASSIGNED") {
                matchesBatch = !studentBatch; // Matches null, undefined, or empty string
            } else if (filterBatch === "INVALID") {
                // Has a batch name, but it doesn't match any of the active fetched batches
                matchesBatch = !!studentBatch && !batches.some(b => b.name === studentBatch);
            } else {
                matchesBatch = studentBatch === filterBatch;
            }
        }

        return matchesSearch && matchesDate && matchesBatch;
    });

    const renderDate = (dateVal) => {
        if (!dateVal) return "-";
        try {
            if (dateVal.seconds) return new Date(dateVal.seconds * 1000).toLocaleDateString("en-IN");
            if (dateVal instanceof Date) return dateVal.toLocaleDateString("en-IN");
            return new Date(dateVal).toLocaleDateString("en-IN");
        } catch (e) { return "-"; }
    };

    return (
        <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
            {selectedStudent && (
                <StudentManager
                    student={selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                    refreshData={() => fetchData()}
                    userProfile={userProfile}
                />
            )}

            <div className="flex flex-col gap-6 mb-8">
                <div className="flex justify-between items-center">
                    <div>
                        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2 text-sm font-bold">
                            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                        </button>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <UserCog className="w-6 h-6 text-blue-600" />
                            Student Records
                        </h1>
                        <p className="text-sm text-gray-500">
                            View and manage all student admissions.
                        </p>
                    </div>
                    {/* EXPORT & SYNC */}
                    <div className="flex items-center gap-3">
                        {lastSynced && (
                            <span className="text-[10px] text-gray-400 font-mono hidden md:inline">
                                Last synced: {lastSynced.toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={() => fetchData(true)}
                            disabled={loading}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-gray-200 transition disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            {loading ? 'Refreshing...' : 'Sync Data'}
                        </button>
                        <button
                            onClick={() => exportToCSV(formatAdmissionsForExport(filteredData), 'student_records')}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm transition"
                        >
                            <Download className="w-4 h-4" /> Export Data ({filteredData.length})
                        </button>
                    </div>
                </div>

                {/* FILTERS */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center">
                    {/* Search */}
                    <div className="relative w-full md:w-96 group">
                        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or phone..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-4 items-center">
                        {/* Center Filter (Director Only) */}
                        {!isManager && (
                            <div className="relative">
                                <Filter className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                                <select
                                    value={viewCenter}
                                    onChange={(e) => {
                                        setViewCenter(e.target.value);
                                        setFilterBatch("ALL"); // Reset batch filter when changing center
                                    }}
                                    className="pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 appearance-none outline-none focus:ring-2 focus:ring-blue-500/20"
                                >
                                    <option value="ALL">All Centers</option>
                                    <option value="UN_COLLEGE">College Road</option>
                                    <option value="UN_NASHIK_RD">Nashik Road</option>
                                    <option value="PRAYAS">Prayas</option>
                                </select>
                            </div>
                        )}

                        {/* Batch Filter */}
                        <div className="relative">
                            <Filter className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                            <select
                                value={filterBatch}
                                onChange={(e) => setFilterBatch(e.target.value)}
                                className="pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 appearance-none outline-none focus:ring-2 focus:ring-blue-500/20 max-w-[200px] truncate"
                            >
                                <option value="ALL">All Batches</option>
                                <option value="UNASSIGNED" className="text-orange-600">Unassigned (No Batch)</option>
                                <option value="INVALID" className="text-red-600">Invalid/Deleted Batch</option>
                                {batches.map(b => (
                                    <option key={b.id} value={b.name}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date Filter */}
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                            <span className="text-xs font-bold text-gray-400 uppercase">Date:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent text-sm font-medium outline-none"
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent text-sm font-medium outline-none"
                            />
                            {(startDate || endDate) && (
                                <button onClick={() => { setStartDate(''); setEndDate('') }} className="text-red-500 hover:text-red-700 font-bold ml-1">✕</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-xs tracking-wider">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Student</th>
                                <th className="p-4">Batch</th>
                                <th className="p-4">Course</th>
                                <th className="p-4">Paid/Due</th>
                                <th className="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="6" className="p-8 text-center">Loading Records...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-400">No student records found matching filters.</td></tr>
                            ) : (
                                filteredData.map(s => (
                                    <tr key={s.id} className="hover:bg-blue-50 transition">
                                        <td className="p-4 whitespace-nowrap text-gray-500">{renderDate(s.createdAt)}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-gray-900">{s.studentName}</div>
                                                {(s.status === 'REFUNDED' || s.refundAmount > 0) && (
                                                    <span className="bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0">Refunded</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500">{s.phone}</div>
                                        </td>
                                        <td className="p-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold">{s.batchAssigned || "Unassigned"}</span></td>
                                        <td className="p-4 max-w-xs truncate" title={s.program || s.programKey}>{s.program || s.programKey || '-'}</td>
                                        <td className="p-4">
                                            <div className="text-green-700 font-bold">Pd: ₹{Number(s.totalPaid || 0).toLocaleString()}</div>
                                            <div className="text-red-500 text-xs">
                                                Due: ₹{((s.status === 'REFUNDED' || s.refundAmount > 0) ? 0 : (Number(s.amount || 0) - Number(s.totalPaid || 0))).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="p-4 flex justify-center gap-2">
                                            <button
                                                onClick={() => setSelectedStudent(s)}
                                                className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm"
                                            >
                                                <UserCog className="w-3 h-3" /> Manage
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StudentRecords;
