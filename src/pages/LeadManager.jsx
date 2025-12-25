import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { UserPlus, Phone, Calendar, ArrowRight, CheckCircle } from 'lucide-react';

const LeadManager = ({ userProfile }) => {
    const [leads, setLeads] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [newLead, setNewLead] = useState({ name: '', phone: '', course: '' });
    const [loading, setLoading] = useState(true);

    const isDirector = userProfile?.role === 'DIRECTOR';
    const [viewCenter, setViewCenter] = useState('ALL');

    // Filter Logic
    const filteredLeads = leads.filter(l => {
        if (!isDirector) return true; // Staff already filtered by query
        if (viewCenter === 'ALL') return true;
        return (l.centerId || "").trim() === viewCenter;
    });

    // 1. Fetch Leads based on Role
    const fetchLeads = async () => {
        setLoading(true);
        let q;

        if (isDirector) {
            // Director sees ALL leads
            q = query(collection(db, "leads"));
        } else {
            // Staff sees ONLY assigned leads
            // Assuming we have the current user's UID (you might need to pass currentUser.uid prop)
            // For now, filtering by center as a proxy or assignedTo
            // Let's filter by Center for now as a simple step
            q = query(collection(db, "leads"), where("centerId", "==", userProfile.centerId));
        }

        const snapshot = await getDocs(q);
        const leadData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLeads(leadData);
        setLoading(false);
    };

    // 2. Fetch Staff List (Only for Director to assign)
    const fetchStaff = async () => {
        if (!isDirector) return;
        const q = query(collection(db, "users"), where("role", "==", "STAFF"));
        const snapshot = await getDocs(q);
        setStaffList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    useEffect(() => {
        fetchLeads();
        fetchStaff();
    }, []);

    // 3. Add New Lead (Manual Entry)
    const handleAddLead = async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "leads"), {
            ...newLead,
            status: "NEW",
            assignedTo: null, // Unassigned initially
            assignedName: "Unassigned",
            centerId: userProfile.centerId || "UN_COLLEGE",
            createdAt: serverTimestamp()
        });
        setNewLead({ name: '', phone: '', course: '' });
        fetchLeads();
        alert("Lead Added");
    };

    // 4. Assign Lead Function
    const handleAssign = async (leadId, staffId, staffName) => {
        const leadRef = doc(db, "leads", leadId);
        await updateDoc(leadRef, {
            assignedTo: staffId,
            assignedName: staffName,
            status: "ASSIGNED"
        });
        fetchLeads(); // Refresh list
    };

    return (
        <div className="max-w-6xl mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Lead Management (CRM)</h1>
                    <p className="text-sm text-gray-500">{isDirector ? "Assign & Monitor" : "My Assigned Leads"}</p>
                </div>
            </div>

            {/* DIRECTORS FILTER */}
            {isDirector && (
                <div className="flex justify-center mb-6">
                    <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-gray-200 inline-flex gap-1">
                        {['ALL', 'UN_COLLEGE', 'UN_NASHIK_RD', 'PRAYAS'].map(c => (
                            <button
                                key={c}
                                onClick={() => setViewCenter(c)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all duration-300 ${viewCenter === c ? 'bg-slate-800 text-white shadow-md transform scale-105' : 'text-slate-500 hover:bg-white hover:text-slate-700'}`}
                            >
                                {c === 'ALL' ? 'ALL CENTERS' : c.replace('UN_', '').replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Add Lead Form */}
            <div className="bg-white p-4 rounded-lg shadow mb-8 border border-gray-200">
                <h3 className="font-bold text-sm mb-3 uppercase text-gray-500">Add New Inquiry</h3>
                <form onSubmit={handleAddLead} className="flex flex-col md:flex-row gap-4">
                    <input
                        type="text" placeholder="Student Name" required
                        className="border p-2 rounded flex-1"
                        value={newLead.name} onChange={e => setNewLead({ ...newLead, name: e.target.value })}
                    />
                    <input
                        type="tel" placeholder="Phone" required
                        className="border p-2 rounded flex-1"
                        value={newLead.phone} onChange={e => setNewLead({ ...newLead, phone: e.target.value })}
                    />
                    <input
                        type="text" placeholder="Course Interest" required
                        className="border p-2 rounded flex-1"
                        value={newLead.course} onChange={e => setNewLead({ ...newLead, course: e.target.value })}
                    />
                    <button className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700">Add Lead</button>
                </form>
            </div>

            {/* Leads List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">Phone</th>
                            <th className="p-4">Remarks</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Assigned To</th>
                            {isDirector && <th className="p-4">Action</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filteredLeads.map(lead => (
                            <tr key={lead.id} className="hover:bg-gray-50">
                                <td className="p-4 font-bold">
                                    {lead.name}
                                    <br />
                                    <span className="text-xs text-gray-400 font-normal">
                                        {lead.course} {lead.board ? `• ${lead.board}` : ''}
                                    </span>
                                </td>
                                <td className="p-4 font-mono">{lead.phone}</td>
                                <td className="p-4 text-xs text-gray-500 max-w-[200px] truncate" title={lead.remarks}>
                                    {lead.remarks || '-'}
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${lead.status === 'NEW' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                        {lead.status}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-500">
                                    {lead.assignedName || "Unassigned"}
                                </td>

                                {/* Director Actions: Assign Dropdown */}
                                {isDirector && (
                                    <td className="p-4">
                                        <select
                                            className="border p-1 rounded text-xs"
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
                        {leads.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-400">No leads found.</td></tr>}
                    </tbody>
                </table>
            </div>

        </div>
    );
};

export default LeadManager;
