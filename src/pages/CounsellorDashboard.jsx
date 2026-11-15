import { Link, useNavigate, useLocation } from 'react-router-dom';
import { fetchBatches, fetchRealBatchEnrollments } from '../services/batchService';
import { fetchTodaysTasks, fetchCounsellorStats } from '../services/leadService';
import { fetchUpcomingInstallments } from '../services/paymentService';
import { Calculator, Users, CheckCircle, PhoneCall, AlertCircle, Trophy, IndianRupee, ArrowRight, UserPlus, X, CalendarX } from 'lucide-react';
import { useEffect, useState } from 'react';
import AddLead from '../modules/crm/pages/AddLead';
import DailyBriefing from '../modules/crm/components/DailyBriefing';
import { Card, CardHeader, StatCard, QuickLink } from '../components/ui';
import { greetingFor } from '../utils/greeting';
import { formatINR } from '../utils/money';
import { buildDailyBriefing, briefingSeen, markBriefingSeen } from '../utils/dailyBriefing';

const CounsellorDashboard = ({ userProfile, center }) => {
    const [tasks, setTasks] = useState([]);
    const [showBriefing, setShowBriefing] = useState(false);
    const [installments, setInstallments] = useState([]);
    const [batches, setBatches] = useState([]);
    const [enrollmentCounts, setEnrollmentCounts] = useState({});
    const [stats, setStats] = useState({ totalAdmissions: 0 });
    const [, setLoading] = useState(true);
    const [showAddLead, setShowAddLead] = useState(false);
    const navigate = useNavigate();
    // "My day" links here with ?plan=1 to open today's plan.
    const forcePlan = new URLSearchParams(useLocation().search).get('plan') === '1';

    // Calculate Today's Date for Priority Calls (YYYY-MM-DD)
    const localDate = new Date();
    const todayStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

    const briefing = buildDailyBriefing({ tasks, installments, today: todayStr });

    // PRIORITY CALLS: Include Today AND Overdue (<= todayStr)
    const priorityCalls = tasks
        .filter(t => t.nextFollowUp && t.nextFollowUp <= todayStr)
        .sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp)); // Sort Oldest First (Overdue first)



    useEffect(() => {
        loadData();
    }, [userProfile]);

    useEffect(() => { if (forcePlan) setShowBriefing(true); }, [forcePlan]);

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
                // Today's plan comes up first, once a day.
                if (!briefingSeen(userProfile.uid) || forcePlan) setShowBriefing(true);
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


    const promisesToday = briefing.promisesToday.length;
    return (
        <div className="space-y-6">
            <div className="space-y-6">

                {/* Greeting and today's actions */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div>
                        <p className="text-sm text-slate-500">{currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex flex-wrap items-center gap-3">
                            {greetingFor(currentTime)}, {(userProfile?.name || 'there').split(' ')[0]}
                            {stats.totalAdmissions > 100 && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
                                    <Trophy className="w-3.5 h-3.5" /> Century achiever
                                </span>
                            )}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {briefing.count ? `${briefing.count} things need you today.` : 'Nothing is due today. A good day to add new leads.'}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowBriefing(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700">
                            <CheckCircle className="w-4 h-4" /> Today&apos;s plan
                            {briefing.count > 0 && <span className="bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{briefing.count}</span>}
                        </button>
                        <button type="button" onClick={() => setShowAddLead(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            <UserPlus className="w-4 h-4" /> Add lead
                        </button>
                    </div>
                </div>

                {/* Today in numbers */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                    <StatCard label="My admissions" value={stats.totalAdmissions} icon={Trophy} tone="blue" hint="All time" to="/staff/my-admissions" delay={0} />
                    <StatCard label="Calls due" value={priorityCalls.length} icon={PhoneCall} tone="violet" hint={briefing.followUpsMissed.length ? `${briefing.followUpsMissed.length} missed from earlier days` : 'Follow-ups for today'} to="/staff/leads" delay={40} />
                    <StatCard label="Fees overdue" value={briefing.feesOverdue.length} icon={AlertCircle} tone="rose" hint={briefing.overdueAmount ? `${formatINR(briefing.overdueAmount)} to collect` : 'All your students are on time'} delay={80} />
                    <StatCard label="Promised to pay today" value={promisesToday} icon={IndianRupee} tone="emerald" hint={`${briefing.feesToday.length + briefing.feesSoon.length} more due in the next 2 days`} delay={120} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Work lists: calls and fee reminders */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="overflow-hidden">
                            <CardHeader title="Calls to make" icon={PhoneCall}
                                subtitle={priorityCalls.length ? `${priorityCalls.length} due, oldest first` : 'Follow-ups due today and earlier'}
                                action={<Link to="/staff/leads" className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">All leads <ArrowRight className="w-3.5 h-3.5" /></Link>} />
                            {priorityCalls.length === 0 ? (
                                <div className="px-5 py-10 text-center">
                                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" aria-hidden="true" />
                                    <p className="text-sm text-slate-500">No calls due. You are up to date.</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                                    {priorityCalls.map(task => {
                                        const isOverdue = task.nextFollowUp < todayStr;
                                        return (
                                            <li key={task.id}>
                                                <button type="button" onClick={() => navigate(`/staff/leads/${task.id}`)}
                                                    className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                                                    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isOverdue ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                                                        {(task.studentName || '?').charAt(0).toUpperCase()}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-sm font-semibold text-slate-900 truncate">{task.studentName}</span>
                                                        <span className="block text-xs text-slate-500 tabular-nums">{task.phone}</span>
                                                    </span>
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isOverdue ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
                                                        {isOverdue ? `Missed ${new Date(`${task.nextFollowUp}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Today'}
                                                    </span>
                                                    <PhoneCall className="w-4 h-4 text-slate-300" aria-hidden="true" />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </Card>

                        <Card className="overflow-hidden">
                            <CardHeader title="Fee reminders" icon={IndianRupee}
                                subtitle="Your students with an instalment overdue or coming up"
                                action={<Link to="/staff/my-admissions" className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">My admissions <ArrowRight className="w-3.5 h-3.5" /></Link>} />
                            {installments.length === 0 ? (
                                <div className="px-5 py-10 text-center">
                                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" aria-hidden="true" />
                                    <p className="text-sm text-slate-500">No pending dues.</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                                    {installments.map(inst => (
                                        <li key={inst.id}>
                                            <button type="button" onClick={() => navigate('/staff/my-admissions', { state: { openAdmissionId: inst.id } })}
                                                className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-semibold text-slate-900 truncate">{inst.studentName}</span>
                                                    <span className="block text-xs text-slate-500 tabular-nums">{inst.phone}</span>
                                                </span>
                                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${inst.isOverdue ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                                                    {inst.isOverdue ? 'Overdue' : 'Due'} {inst.dueDate}
                                                </span>
                                                <span className="w-24 text-right text-sm font-semibold text-slate-900 tabular-nums">{formatINR(inst.balance || 0)}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    </div>

                    {/* Side: batches to pitch and tools */}
                    <div className="space-y-6">
                        <Card className="overflow-hidden">
                            <CardHeader title="Batches open for admission" icon={Users} subtitle="Show these to parents" />
                            {batches.length === 0 ? (
                                <div className="px-5 py-10 text-center">
                                    <CalendarX className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
                                    <p className="text-sm text-slate-500">No upcoming batches yet.</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {batches.map(batch => {
                                        const cap = batch.capacity || 60;
                                        const taken = enrollmentCounts[batch.name] || 0;
                                        const left = Math.max(0, cap - taken);
                                        const start = batch.startDate ? new Date(batch.startDate) : null;
                                        const startOk = start && !Number.isNaN(start.getTime());
                                        return (
                                            <li key={batch.id} className="px-5 py-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 truncate">{batch.name}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            {batch.course}{startOk && <> · starts {start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</>}
                                                        </p>
                                                    </div>
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${left <= 5 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                        {left} seats left
                                                    </span>
                                                </div>
                                                <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (taken / cap) * 100)}%` }} />
                                                </div>
                                                {batch.faculty?.length > 0 && (
                                                    <p className="text-xs text-slate-500 mt-2 truncate">
                                                        {batch.faculty.map(f => `${f.name}${f.subject ? ` (${f.subject})` : ''}`).join(', ')}
                                                    </p>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </Card>

                        <div className="space-y-3">
                            <QuickLink to="/staff/calculator" icon={Calculator} title="Fee calculator" text="Work out fees and instalments" tone="amber" />
                            <QuickLink to="/staff/leads" icon={PhoneCall} title="Leads CRM" text="Every lead and follow-up" tone="violet" />
                        </div>
                    </div>
                </div>
            </div>

            {showBriefing && (
                <DailyBriefing
                    briefing={briefing}
                    name={(userProfile?.name || 'there').split(' ')[0]}
                    onClose={() => { markBriefingSeen(userProfile?.uid); setShowBriefing(false); }}
                />
            )}

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
