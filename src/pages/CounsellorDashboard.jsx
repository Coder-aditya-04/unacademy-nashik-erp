import { Link, useNavigate } from 'react-router-dom';
import { fetchBatches, fetchRealBatchEnrollments } from '../services/batchService';
import { fetchTodaysTasks, fetchCounsellorStats } from '../services/leadService';
import { fetchUpcomingInstallments } from '../services/paymentService';
import { Calculator, CreditCard, Users, Clock, CheckCircle, PhoneCall, AlertCircle, Trophy, IndianRupee, ArrowRight, UserPlus, X, CalendarX, ChevronDown, Shield, Search, RefreshCw, Download, Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';
import AddLead from '../modules/crm/pages/AddLead';

const CounsellorDashboard = ({ userProfile, center }) => {
    const [tasks, setTasks] = useState([]);
    const [installments, setInstallments] = useState([]);
    const [batches, setBatches] = useState([]);
    const [enrollmentCounts, setEnrollmentCounts] = useState({});
    const [stats, setStats] = useState({ totalAdmissions: 0 });
    const [loading, setLoading] = useState(true);
    const [showAddLead, setShowAddLead] = useState(false);
    const navigate = useNavigate();

    // Calculate Today's Date for Priority Calls (YYYY-MM-DD)
    const localDate = new Date();
    const todayStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

    // PRIORITY CALLS: Include Today AND Overdue (<= todayStr)
    const priorityCalls = tasks
        .filter(t => t.nextFollowUp && t.nextFollowUp <= todayStr)
        .sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp)); // Sort Oldest First (Overdue first)



    useEffect(() => {
        loadData();
    }, [userProfile]);

    const loadData = async () => {
        try {
            if (userProfile?.uid) {
                const [tasksData, statsData, installmentsData, batchesData, enrollmentsData] = await Promise.all([
                    fetchTodaysTasks(userProfile),
                    fetchCounsellorStats(userProfile),
                    fetchUpcomingInstallments(userProfile),
                    fetchBatches(userProfile.centerId),
                    fetchRealBatchEnrollments(userProfile.centerId)
                ]);
                setTasks(tasksData || []);
                setStats(statsData || { totalAdmissions: 0 });
                setInstallments(installmentsData || []);
                setBatches(batchesData || []);
                setEnrollmentCounts(enrollmentsData || {});
            }
        } catch (error) {
            console.error("Dashboard Load Error:", error);
        }
        setLoading(false);
    };

    const [currentTime, setCurrentTime] = useState(new Date());

    // Clock Timer
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
        <div className="min-h-screen bg-slate-50 relative pb-20 font-sans selection:bg-indigo-100 selection:text-indigo-700">

            {/* 1. HEADER & WELCOME (Suhani Style - Size Increase & Brighter Blue) */}
            <div className="relative overflow-hidden rounded-3xl shadow-2xl p-8 mb-8 flex flex-col md:flex-row justify-between items-center gap-6"
                style={{ background: 'linear-gradient(to right, #1e3a8a, #172554, #1e3a8a)' }}>
                {/* Lighter, Richer Blue Gradient (requested "Light Blue" type feel while keeping white text legible) */}

                {/* Subtle sheen */}
                <div className="absolute top-0 right-0 w-[500px] h-full bg-blue-400/10 blur-[80px] pointer-events-none"></div>

                <div className="relative z-10 w-full md:w-auto text-left">
                    <div className="flex items-center gap-4 mb-2">
                        {/* Badge: Blue Pill */}
                        <span className="bg-blue-800/50 text-blue-200 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 border border-blue-500/30 shadow-sm">
                            <Users className="w-3 h-3" />
                            COUNSELLOR DASHBOARD
                        </span>
                        {/* Date: Lighter Slate/Blue Text */}
                        <span className="text-blue-200/80 text-xs font-bold tracking-wide">
                            {currentTime.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </div>

                    {/* Headline: Size Increased to text-4xl (Middle ground) */}
                    <div className="flex flex-col gap-2 mb-2">
                        <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-sm flex flex-wrap items-center gap-3">
                            {greeting()}, <span className="bg-gradient-to-r from-sky-200 to-blue-400 bg-clip-text text-transparent">{(userProfile?.name || "User").split(' ')?.[0] || 'Counsellor'}</span>
                            {stats.totalAdmissions > 100 && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500 rounded-full text-sm font-black text-amber-950 border-2 border-yellow-200 shadow-[0_0_20px_rgba(251,191,36,0.6)] transform hover:scale-105 transition cursor-default">
                                    <Trophy className="w-4 h-4 text-amber-900" />
                                    Century Achiever
                                    <span className="flex h-2 w-2 relative ml-1">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                    </span>
                                </span>
                            )}
                        </h1>
                    </div>

                    {/* Status Line: Center Name now has the SAME gradient style as Counselor Name */}
                    <p className="text-blue-200/70 text-sm font-medium flex items-center gap-2 pl-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
                        Logged into <span className="bg-gradient-to-r from-sky-200 to-blue-400 bg-clip-text text-transparent font-bold tracking-wide">{center?.name || "Unacademy Center"}</span>
                    </p>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    {/* TODAY Card (Suhani Layout: Clock LEFT, Text RIGHT) */}
                    <div className="bg-blue-900/40 border border-blue-400/20 rounded-2xl py-3 px-6 flex items-center gap-5 shadow-xl backdrop-blur-sm">
                        {/* Clock Icon LEFT */}
                        <div className="bg-blue-500/20 p-2 rounded-full border border-blue-300/20">
                            <Clock className="w-5 h-5 text-sky-300" />
                        </div>

                        <div className="h-10 w-[1px] bg-blue-400/30"></div>

                        {/* Text RIGHT */}
                        <div className="text-left">
                            <p className="text-[10px] text-blue-200/60 font-bold uppercase tracking-[0.2em] mb-0.5">TODAY</p>
                            <p className="text-lg font-bold text-white leading-none whitespace-nowrap font-mono">
                                {currentTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-8">

                {/* 2. KEY METRICS ROW (Vibrant Cards with Animation) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Stat 1: Admissions (Hero Card - Premium Blue or Golden for Achievers) */}
                    <div onClick={() => navigate('/staff/my-admissions')} className={`md:col-span-1 p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group relative overflow-hidden text-white transform hover:-translate-y-2 hover:scale-105 animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-forwards ${stats.totalAdmissions > 100 ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 shadow-orange-200 hover:shadow-orange-300 border border-orange-400/50' : 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 shadow-blue-200 hover:shadow-blue-300'}`}>
                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -mr-10 -mt-10 blur-2xl group-hover:scale-125 transition duration-700 animate-pulse ${stats.totalAdmissions > 100 ? 'bg-yellow-300/30' : 'bg-white/10'}`}></div>
                        {stats.totalAdmissions > 100 && (
                            <div className="absolute -bottom-4 -right-4 w-40 h-40 bg-yellow-400/20 rounded-full blur-3xl animate-pulse"></div>
                        )}
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md shadow-inner border border-white/10 group-hover:rotate-6 transition duration-300 flex items-center gap-2">
                                    <Trophy className={`w-6 h-6 ${stats.totalAdmissions > 100 ? 'text-yellow-100' : 'text-yellow-300'}`} />
                                    {stats.totalAdmissions > 100 && <span className="text-[10px] font-black uppercase tracking-widest text-yellow-100 bg-white/20 px-2 py-0.5 rounded-md shadow-sm border border-white/20">Achiever</span>}
                                </div>
                            </div>
                            <h3 className="text-4xl font-black tracking-tighter mb-1 relative inline-block">
                                {stats.totalAdmissions}
                                {stats.totalAdmissions > 100 && (
                                    <span className="absolute -top-1 -right-6 text-2xl animate-bounce">✨</span>
                                )}
                            </h3>
                            <p className="text-blue-100 text-xs font-medium uppercase tracking-wider opacity-80 mb-4">
                                Total Admissions
                            </p>

                            <div className="flex items-center text-[10px] font-bold text-white/90 bg-white/10 px-3 py-2 rounded-lg backdrop-blur-sm w-fit group-hover:bg-white/20 transition">
                                View Details <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition" />
                            </div>
                        </div>
                    </div>

                    {/* Stat 2: Pending Calls */}
                    <div onClick={() => navigate('/staff/leads')} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 cursor-pointer group relative overflow-hidden transform hover:-translate-y-2 hover:scale-105 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 fill-mode-forwards">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-110"></div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex justify-between items-start">
                                <div className="bg-blue-50 p-2.5 rounded-xl group-hover:bg-blue-500 transition-colors duration-300 shadow-sm">
                                    <PhoneCall className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                                </div>
                                {tasks.length > 0 && <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-slate-800 mt-4">{tasks.length}</h3>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1 group-hover:text-blue-600 transition">Pending Calls</p>
                            </div>
                        </div>
                    </div>

                    {/* Stat 3: My Leads */}
                    <div onClick={() => navigate('/staff/leads')} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all duration-300 cursor-pointer group relative overflow-hidden transform hover:-translate-y-2 hover:scale-105 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-forwards">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-110"></div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex justify-between items-start">
                                <div className="bg-emerald-50 p-2.5 rounded-xl group-hover:bg-emerald-500 transition-colors duration-300 shadow-sm">
                                    <Users className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-slate-800 mt-4">CRM</h3>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1 group-hover:text-emerald-600 transition">My Leads</p>
                            </div>
                        </div>
                    </div>

                    {/* Stat 4: Calculator */}
                    <div onClick={() => navigate('/staff/calculator')} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all duration-300 cursor-pointer group relative overflow-hidden transform hover:-translate-y-2 hover:scale-105 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-forwards">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-110"></div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex justify-between items-start">
                                <div className="bg-orange-50 p-2.5 rounded-xl group-hover:bg-orange-500 transition-colors duration-300 shadow-sm">
                                    <Calculator className="w-6 h-6 text-orange-600 group-hover:text-white transition-colors" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-slate-800 mt-4">Fees</h3>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1 group-hover:text-orange-600 transition">Calculator</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* 3. MAIN COLUMN (2/3): BATCH PITCH & TASKS */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* A. BATCH PITCH DECK (Redesigned) */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden group">
                            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                        <Users className="w-5 h-5 text-indigo-600" />
                                        Admission Pitch Deck
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">Show these upcoming batches to parents</p>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50/50 min-h-[300px]">
                                {batches.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-24 h-24 bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                                            <CalendarX className="w-10 h-10 text-slate-300" /> {/* Fixed Icon */}
                                        </div>
                                        <h4 className="text-slate-600 font-bold text-lg">No Active Batches</h4>
                                        <p className="text-slate-400 text-sm max-w-xs mt-2">There are currently no upcoming batches scheduled. Please check with the administrator.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {batches?.map(batch => (
                                            <div key={batch.id} className="relative group rounded-2xl overflow-hidden border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 bg-white transform hover:-translate-y-1">
                                                {/* Hero Image */}
                                                <div className="h-52 bg-slate-800 relative overflow-hidden">
                                                    {batch.facultyPhotoUrl ? (
                                                        <img src={batch.facultyPhotoUrl} className="w-full h-full object-cover object-center opacity-90 transition transform duration-700 group-hover:scale-105" alt="Faculty" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900 to-slate-900"><Users className="w-16 h-16 text-white/20" /></div>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>

                                                    <div className="absolute top-4 right-4 z-10">
                                                        <span className="bg-red-500/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-lg border border-white/10 flex items-center gap-1">
                                                            <Users className="w-3 h-3" />
                                                            {(batch.capacity || 60) - (enrollmentCounts[batch.name] || 0)} Seats Left
                                                        </span>
                                                    </div>

                                                    <div className="absolute bottom-5 left-6 text-white max-w-[85%]">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <span className="px-2.5 py-1 rounded-lg bg-indigo-500 text-[10px] font-bold uppercase tracking-wider shadow-lg">New Batch</span>
                                                            <span className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-bold uppercase tracking-wider">{batch.course}</span>
                                                        </div>
                                                        <h4 className="text-2xl font-bold tracking-tight text-white shadow-sm mb-1">{batch.name}</h4>
                                                        <p className="text-indigo-200 font-medium text-xs flex items-center gap-2">
                                                            <Clock className="w-3.5 h-3.5" /> Starts {new Date(batch.startDate).toLocaleDateString(undefined, { dateStyle: 'long' })}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Faculty Details */}
                                                <div className="p-6 bg-white relative">
                                                    <div className="absolute -top-6 right-6 flex -space-x-3">
                                                        {batch.faculty?.slice(0, 4).map((fac, i) => (
                                                            <div key={i} title={fac.name} className="w-12 h-12 rounded-full border-4 border-white bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shadow-md relative z-10 hover:z-20 hover:scale-110 transition shrink-0 uppercase">
                                                                {fac.name.charAt(0)}
                                                            </div>
                                                        ))}
                                                        {batch.faculty?.length > 4 && (
                                                            <div className="w-12 h-12 rounded-full border-4 border-white bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold shadow-md relative z-0">
                                                                +{batch.faculty.length - 4}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="pt-4">
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Star Faculty</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {batch.faculty?.map((fac, i) => (
                                                                <span key={i} className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-semibold text-slate-700">
                                                                    {fac.name} <span className="text-slate-400 font-normal">({fac.subject})</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-medium text-slate-500">
                                                        <span>Batch ID: <span className="font-mono text-slate-700">{batch.id.slice(0, 8)}</span></span>
                                                        <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded"><CheckCircle className="w-3 h-3" /> Enrollments Open</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* 4. RIGHT COLUMN (1/3): ACTIONS & FEES */}
                    <div className="space-y-8">

                        {/* A. QUICK ACTIONS CARD (Modern Grid) */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
                            <h3 className="font-bold text-slate-800 mb-5 text-sm uppercase tracking-wide flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Quick Actions
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {/* NEW: BOOK INQUIRY (Professional Dark Theme) */}
                                {/* NEW: BOOK INQUIRY (Professional Dark Theme) */}
                                <button onClick={() => setShowAddLead(true)} className="col-span-2 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 rounded-2xl text-white shadow-lg hover:shadow-2xl hover:shadow-indigo-900/20 transition transform hover:-translate-y-1 text-center group relative overflow-hidden border border-indigo-500/20">
                                    <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
                                    <div className="relative z-10 flex flex-col items-center gap-2">
                                        <div className="bg-white/10 p-2 rounded-full group-hover:bg-indigo-500 group-hover:text-white transition duration-300">
                                            <UserPlus className="w-5 h-5 text-indigo-300 group-hover:text-white" />
                                        </div>
                                        <span className="font-bold text-sm tracking-wide text-white/90 group-hover:text-white">New Lead Inquiry</span>
                                    </div>
                                </button>

                                <Link to="/staff/take-admission" className="col-span-1 bg-white border border-slate-100 p-4 rounded-2xl text-slate-700 shadow-sm hover:shadow-md transition hover:border-emerald-200 text-center group flex flex-col items-center justify-center gap-2 h-28">
                                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition">
                                        <Users className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <p className="font-bold text-xs">New Admission</p>
                                </Link>
                                <Link to="/staff/calculator" className="col-span-1 bg-white border border-slate-100 p-4 rounded-2xl text-slate-700 shadow-sm hover:shadow-md transition hover:border-orange-200 text-center group flex flex-col items-center justify-center gap-2 h-28">
                                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center group-hover:scale-110 transition">
                                        <Calculator className="w-5 h-5 text-orange-600" />
                                    </div>
                                    <p className="font-bold text-xs">Fee Calculator</p>
                                </Link>
                            </div>
                        </div>

                        {/* B. FOLLOW UPS */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-white sticky top-0 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                    <PhoneCall className="w-4 h-4 text-blue-600" /> Priority Calls
                                </h3>
                                <Link to="/staff/leads" className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition">View All</Link>
                            </div>
                            <div className="divide-y divide-slate-50 max-h-[350px] overflow-y-auto custom-scrollbar">
                                {priorityCalls.length === 0 ? (
                                    <div className="p-10 text-center">
                                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <CheckCircle className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <p className="text-slate-400 text-sm">No priority calls pending!</p>
                                    </div>
                                ) : (
                                    priorityCalls.map(task => {
                                        const isOverdue = task.nextFollowUp < todayStr;
                                        return (
                                            <div key={task.id} onClick={() => navigate(`/staff/leads/${task.id}`)} className="p-4 flex justify-between items-center hover:bg-slate-50 cursor-pointer transition group border-l-4 border-transparent hover:border-blue-500">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition ${isOverdue ? 'bg-red-50 text-red-600 ring-1 ring-red-100' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700'}`}>
                                                        {task.studentName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-slate-700 text-sm group-hover:text-blue-700 transition">{task.studentName}</p>
                                                            {isOverdue && (
                                                                <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-wide">
                                                                    Overdue
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-mono tracking-tight flex items-center gap-1">
                                                            {task.phone}
                                                            <span className="text-slate-300">•</span>
                                                            <span>{isOverdue ? task.nextFollowUp : 'Today'}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <button className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${isOverdue ? 'border-red-100 text-red-400 bg-red-50' : 'border-slate-200 text-slate-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'}`}>
                                                    <PhoneCall className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>

                        {/* C. FEES WATCHLIST */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-white sticky top-0">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                    <IndianRupee className="w-4 h-4 text-emerald-600" /> Fee Reminders
                                </h3>
                            </div>
                            <div className="divide-y divide-slate-50 max-h-[350px] overflow-y-auto custom-scrollbar">
                                {installments.length === 0 ? (
                                    <div className="p-10 text-center">
                                        <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <CheckCircle className="w-6 h-6 text-emerald-500" />
                                        </div>
                                        <p className="text-slate-500 text-sm font-medium">No Pending Dues</p>
                                    </div>
                                ) : (
                                    installments.map(inst => (
                                        <div
                                            key={inst.id}
                                            onClick={() => navigate('/staff/my-admissions', { state: { openAdmissionId: inst.id } })}
                                            className="p-4 hover:bg-slate-50 transition group cursor-pointer"
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="font-bold text-slate-700 text-xs group-hover:text-blue-600 transition">{inst.studentName}</p>
                                                <p className="font-bold text-emerald-600 text-xs">₹{inst.balance?.toLocaleString()}</p>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <p className="text-[10px] text-slate-400">{inst.phone}</p>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${inst.isOverdue ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                                    {inst.isOverdue ? 'Overdue' : 'Due'} {inst.dueDate}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>

                </div>
            </div>

            {/* ADD LEAD MODAL */}
            {showAddLead && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl relative max-h-[90vh] overflow-y-auto ring-1 ring-white/20">
                        <button onClick={() => setShowAddLead(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-red-50 hover:text-red-500 transition z-10">
                            <X className="w-5 h-5" />
                        </button>
                        <div className="p-6">
                            <AddLead userProfile={userProfile} onSuccess={() => { setShowAddLead(false); loadData(); }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CounsellorDashboard;
