import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { School, Search, ArrowLeft, Filter, Phone, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CollegeTieUps = ({ userProfile }) => {
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [collegeFilter, setCollegeFilter] = useState("ALL");

    // Fetch Tie-Up Students
    const fetchTieUps = async () => {
        setLoading(true);
        try {
            // Basic query for all active students (we filter by college locally or via compound query)
            const q = query(collection(db, "admissions"), where("status", "==", "ACTIVE"));
            const snap = await getDocs(q);

            // Filter only those with tieUpCollege set
            const tieUpData = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(s => s.tieUpCollege && s.tieUpCollege.trim() !== "");

            setStudents(tieUpData);
        } catch (error) {
            console.error("Error fetching tie-ups:", error);
        }
        setLoading(false);
    };

    useEffect(() => { fetchTieUps(); }, []);

    // Unique Colleges for Dropdown
    const colleges = ["ALL", ...new Set(students.map(s => s.tieUpCollege))];

    // Filter Logic
    const filteredList = students.filter(s => {
        const matchesSearch = s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.phone?.includes(searchTerm) ||
            s.rollNumber?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCollege = collegeFilter === "ALL" || s.tieUpCollege === collegeFilter;
        return matchesSearch && matchesCollege;
    });

    return (
        <div className="max-w-7xl mx-auto p-6 bg-slate-50 min-h-screen font-sans">

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate('/staff/accounts')} className="bg-white p-2 rounded-full shadow-sm hover:shadow-md transition text-slate-500">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <School className="w-6 h-6 text-indigo-600" /> College Tie-Up Management
                    </h1>
                    <p className="text-slate-500 text-sm">Track students admitted via college partnerships.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-1/3">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                        className="w-full pl-10 pr-4 py-2 border rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm"
                        placeholder="Search student, roll no, phone..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <select
                        className="p-2 border rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-700 min-w-[200px]"
                        value={collegeFilter}
                        onChange={e => setCollegeFilter(e.target.value)}
                    >
                        {colleges.map(c => <option key={c} value={c}>{c === "ALL" ? "All Colleges" : c}</option>)}
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-indigo-50 text-indigo-900 uppercase text-[11px] tracking-wider font-semibold border-b border-indigo-100">
                        <tr>
                            <th className="p-4">Student Name</th>
                            <th className="p-4">College</th>
                            <th className="p-4">Contact</th>
                            <th className="p-4">Roll Number</th>
                            <th className="p-4">Admission Date</th>
                            <th className="p-4 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="6" className="p-8 text-center text-slate-400">Loading records...</td></tr>
                        ) : filteredList.length === 0 ? (
                            <tr><td colSpan="6" className="p-10 text-center text-slate-400">No tie-up students found matching your filters.</td></tr>
                        ) : (
                            filteredList.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 transition">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">{item.studentName}</div>
                                        <div className="text-xs text-slate-400">{item.program}</div>
                                    </td>
                                    <td className="p-4">
                                        <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold border border-indigo-200">
                                            {item.tieUpCollege}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-600 flex items-center gap-2">
                                        <Phone className="w-3 h-3 text-slate-400" /> {item.phone}
                                    </td>
                                    <td className="p-4 font-mono text-xs font-bold text-slate-600">
                                        {item.rollNumber || "Not Assigned"}
                                    </td>
                                    <td className="p-4 text-slate-500 text-xs">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('en-IN') : '-'}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-green-200">
                                            ACTIVE
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 text-right text-xs text-slate-400">
                Showing {filteredList.length} records
            </div>
        </div>
    );
};

export default CollegeTieUps;
