import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UpcomingDuesWidget from '../modules/accounts/components/UpcomingDuesWidget';
import { Users, UserPlus, ClipboardList, Calendar, MapPin, Clock } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import AddLead from '../modules/crm/pages/AddLead'; // Using Internal Lead Form

// Internal Component for Recent Inquiries
const RecentInquiriesList = ({ centerId }) => {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecent = async () => {
            try {
                // If centerId is missing or "ALL", might want to show all? 
                // Usually Front Desk has a centerId. Fallback to college road if empty.
                const cId = centerId || 'UN_COLLEGE';

                const q = query(
                    collection(db, "leads"),
                    where("centerId", "==", cId),
                    // Note: Requires Index for compound query (centerId + createdAt). 
                    // If index missing, it might error. Safe fallback: client sort if small data?
                    // Let's try orderBy. Users usually have indices or we prompt them.
                    // To avoid index issues for now, we can fetch last 20 and sort JS side if needed?
                    // But "limit" is best. Let's try standard query.
                    // where("centerId", "==", cId),
                    orderBy("createdAt", "desc"),
                    limit(5)
                );
                // Note: Firestore requires index for different fields in where & orderBy
                // If this fails, we will remove desc sort in query and do client side.
                // For safety in this environment without ability to create index easily:

                const leadsRef = collection(db, "leads");
                const qSafe = query(leadsRef, where("centerId", "==", cId));
                // We fetch a bit more and sort client side to avoid index error blocking the user

                const snapshot = await getDocs(qSafe);
                let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

                // Client side sort & limit
                data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setLeads(data.slice(0, 5));

            } catch (e) {
                console.error("Error fetching recent leads", e);
            } finally {
                setLoading(false);
            }
        };
        fetchRecent();
    }, [centerId]);

    if (loading) return <div className="text-xs text-slate-400 p-2">Loading...</div>;
    if (leads.length === 0) return <div className="text-xs text-slate-400 p-2 italic">No inquiries today.</div>;

    return (
        <div className="space-y-3">
            {leads.map(lead => (
                <div key={lead.id} className="p-3 bg-white border border-slate-100 rounded-xl flex justify-between items-center group hover:border-indigo-200 hover:shadow-md transition-all duration-300 cursor-default">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${lead.status === 'NEW' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            {lead.studentName ? lead.studentName.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">{lead.studentName || lead.name}</p>
                            <p className="text-[10px] text-slate-500">{lead.courseInterest || lead.course || 'Inquiry'}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className={`text-[10px] px-2 py-1 rounded-lg font-bold border ${leadingStatusStyle(lead.status)}`}>
                            {lead.status || 'NEW'}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

// Helper for status styles
const leadingStatusStyle = (status) => {
    switch (status) {
        case 'NEW': return 'bg-orange-50 text-orange-600 border-orange-100';
        case 'CONVERTED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
        case 'ASSIGNED': return 'bg-blue-50 text-blue-600 border-blue-100';
        default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
};

const FrontDeskDashboard = ({ userProfile, center }) => {
    const navigate = useNavigate();
    const [showAddLead, setShowAddLead] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

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

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">

            {/* 1. PROFESSIONAL DARK HEADER (Requested Style) */}
            <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 md:p-8 mb-8 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden group border border-emerald-900/30">
                {/* Decorative Pattern - Abstract Hexagons or Blobs */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none animate-pulse"></div>

                <div className="relative z-10 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                        <span className="px-3 py-1 rounded-full bg-emerald-900/50 border border-emerald-700/50 text-[10px] font-bold text-emerald-400 flex items-center gap-1 uppercase tracking-wider backdrop-blur-sm">
                            <Users className="w-3 h-3" /> Front Desk Portal
                        </span>
                        <span className="text-slate-500 text-xs font-mono">{currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
                        {greeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-teal-400">{userProfile?.name}</span>
                    </h1>
                    <p className="text-slate-400 text-sm">
                        Managing inquiries for <span className="font-semibold text-emerald-200">{center?.name || "Center"}</span>.
                    </p>
                </div>

                {/* Clock Card (Dark Theme Integration) */}
                <div className="relative z-10 flex items-center gap-4 bg-white/5 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-lg shadow-black/20">
                    <div className="text-right">
                        <p className="text-3xl font-black text-white leading-none tracking-tight">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mt-1 opacity-80">
                            {currentTime.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}
                        </p>
                    </div>
                    <Clock className="w-8 h-8 text-emerald-400/80" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 2. LEFT COLUMN - ACTIONS */}
                <div className="space-y-6">
                    {/* Quick Stats / Daily Count */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-200 relative overflow-hidden">
                        {/* Overlay Pattern */}
                        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

                        <div className="relative z-10">
                            <h3 className="text-slate-200 font-bold text-xs uppercase tracking-wider mb-6 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                Quick Operations
                            </h3>

                            <div className="grid grid-cols-1 gap-4">
                                <button
                                    onClick={() => setShowAddLead(true)}
                                    className="bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 p-4 rounded-xl text-center transition-all duration-300 group border border-white/5 backdrop-blur-sm"
                                >
                                    <div className="bg-white/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-white/30 transition-colors">
                                        <UserPlus className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="text-xs font-bold tracking-wide">New Inquiry</span>
                                </button>

                                {/* REMOVED 'View List' (CRM Restricted) */}
                            </div>
                        </div>
                    </div>

                    {/* Recent Inquiries Widget */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                                <ClipboardList className="w-4 h-4 text-orange-500" /> Recent Inquiries
                            </h3>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Live Feed</span>
                        </div>
                        <div className="p-4 bg-white min-h-[200px]">
                            <RecentInquiriesList centerId={userProfile?.centerId} />
                        </div>
                    </div>
                </div>

                {/* 3. CENTER & RIGHT - WIDGETS */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* PAYMENT REMINDERS (CRITICAL) */}
                    {/* PAYMENT REMINDERS (CRITICAL) */}
                    <div className="md:col-span-2 h-[400px]">
                        <UpcomingDuesWidget centerId={userProfile?.centerId} userProfile={userProfile} />
                    </div>

                </div>
            </div>

            {/* MODALS */}
            {showAddLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="max-w-2xl w-full">
                        <AddLead
                            userProfile={userProfile}
                            onClose={() => setShowAddLead(false)}
                            onSuccess={() => {
                                setShowAddLead(false);
                                alert("Inquiry Added Successfully!");
                            }}
                        />
                    </div>
                </div>
            )}

        </div>
    );
};

export default FrontDeskDashboard;
