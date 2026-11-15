import React, { useEffect, useMemo, useState } from 'react';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { Phone, MessageCircle, Search, AlertTriangle, CalendarCheck, IndianRupee, X, ClipboardList } from 'lucide-react';
import { db } from '../../../firebase';
import { subscribeAdmissions, clearAdmissionsCache } from '../../../services/cacheService';
import { buildRecoveryList, dueInfo, BUCKETS } from '../../../utils/recovery';
import { CENTERS } from '../../../utils/centers';
import { formatINR } from '../../../utils/money';

const OUTCOMES = ['Called – will pay', 'Called – asked for time', 'Not reachable', 'Wrong number', 'Paid (tell Accounts)', 'Wants to discontinue'];
const fmtDay = (ms) => (ms ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—');
const noteDate = (n) => (n?.date?.toDate ? n.date.toDate() : n?.date?.seconds ? new Date(n.date.seconds * 1000) : n?.date ? new Date(n.date) : null);

// Recovery desk: every student with fees overdue, the promises they made,
// and a call log. The Recovery role can log calls and promises; it cannot
// record payments or change fees.
const RecoveryDashboard = ({ userProfile }) => {
    // Director sees every centre; Recovery and Managers their own centre.
    const allCentres = userProfile?.role?.toUpperCase() === 'DIRECTOR';
    const scopeCentre = allCentres ? 'ALL' : (userProfile?.centerId || '');
    const centreName = CENTERS[scopeCentre]?.name || scopeCentre;
    const [admissions, setAdmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bucket, setBucket] = useState('ALL_OVERDUE');
    const [centre, setCentre] = useState('ALL');
    const [search, setSearch] = useState('');
    const [active, setActive] = useState(null); // admission being logged

    useEffect(() => {
        if (!scopeCentre) { setLoading(false); return undefined; }
        const unsub = subscribeAdmissions(scopeCentre, (data) => { setAdmissions(data || []); setLoading(false); }, { allSessions: true });
        return () => unsub && unsub();
    }, [scopeCentre]);

    const scoped = useMemo(() => admissions.filter(a =>
        (centre === 'ALL' || a.centerId === centre) &&
        (!search || `${a.studentName} ${a.phone} ${a.rollNumber || ''}`.toLowerCase().includes(search.toLowerCase()))
    ), [admissions, centre, search]);

    const rows = useMemo(() => buildRecoveryList(scoped, bucket), [scoped, bucket]);
    const overdueAll = useMemo(() => buildRecoveryList(scoped, 'ALL_OVERDUE'), [scoped]);
    const promisesToday = useMemo(() => buildRecoveryList(scoped, 'PROMISED'), [scoped]);
    const overdueAmount = overdueAll.reduce((t, r) => t + r.d.balance, 0);
    const brokenPromises = overdueAll.filter(r => r.d.promiseBroken).length;

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2"><ClipboardList className="w-6 h-6 text-rose-600" /> Recovery Desk</h1>
                    <p className="text-sm text-slate-500">Overdue fees, promises and call notes, {allCentres ? 'all centres' : centreName}.</p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Tile icon={AlertTriangle} tone="rose" label="Students overdue" value={overdueAll.length} />
                <Tile icon={IndianRupee} tone="rose" label="Amount overdue" value={formatINR(overdueAmount)} />
                <Tile icon={CalendarCheck} tone="emerald" label="Promised today" value={promisesToday.length} />
                <Tile icon={X} tone="amber" label="Broken promises" value={brokenPromises} />
            </div>

            <div className="flex flex-wrap gap-3 items-center mb-4">
                <div className="flex flex-wrap gap-1 bg-white border border-slate-200 p-1 rounded-xl" role="group" aria-label="Overdue filter">
                    {BUCKETS.map(b => (
                        <button key={b.id} type="button" aria-pressed={bucket === b.id} onClick={() => setBucket(b.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${bucket === b.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                            {b.label}
                        </button>
                    ))}
                </div>
                {allCentres && (
                    <select aria-label="Centre" value={centre} onChange={e => setCentre(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white">
                        <option value="ALL">All centres</option>
                        {Object.values(CENTERS).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                )}
                <label className="relative flex-1 min-w-[200px]">
                    <span className="sr-only">Search</span>
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, phone or roll no."
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </label>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 font-bold">
                        <tr>
                            <th className="p-3">Student</th>
                            <th className="p-3">Counsellor</th>
                            <th className="p-3 text-right">Balance</th>
                            <th className="p-3">Due</th>
                            <th className="p-3">Promise</th>
                            <th className="p-3">Last note</th>
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && <tr><td colSpan="7" className="p-8 text-center text-slate-400">Loading…</td></tr>}
                        {!loading && rows.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-400">Nobody in this list. Good work.</td></tr>}
                        {rows.map(({ a, d }) => (
                            <tr key={a.id} className="hover:bg-slate-50/70">
                                <td className="p-3">
                                    <p className="font-bold text-slate-800">{a.studentName}</p>
                                    <p className="text-[11px] text-slate-400 font-mono">{a.rollNumber || 'No roll'} · {CENTERS[a.centerId]?.name?.replace('Unacademy ', '') || a.centerId}</p>
                                </td>
                                <td className="p-3 text-slate-600">{a.counsellorName || a.bookedBy || '—'}</td>
                                <td className="p-3 text-right font-bold text-rose-600">{formatINR(d.balance)}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${d.daysOverdue >= 22 ? 'bg-rose-100 text-rose-700' : d.daysOverdue > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {d.daysOverdue > 0 ? `${d.daysOverdue} days late` : d.daysOverdue === 0 ? 'Due today' : `In ${-d.daysOverdue} days`}
                                    </span>
                                    <p className="text-[11px] text-slate-400 mt-1">{fmtDay(d.due)}</p>
                                </td>
                                <td className="p-3 text-xs">
                                    {d.promisedDate ? (
                                        <span className={d.promiseBroken ? 'text-rose-600 font-bold' : d.promiseToday ? 'text-emerald-700 font-bold' : 'text-slate-600'}>
                                            {fmtDay(d.promisedDate)}{a.promisedAmount ? ` · ${formatINR(a.promisedAmount)}` : ''}{d.promiseBroken ? ' (missed)' : ''}
                                        </span>
                                    ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="p-3 text-xs text-slate-500 max-w-[220px] truncate" title={d.lastNote?.message || ''}>
                                    {d.lastNote ? `${d.lastNote.outcome ? d.lastNote.outcome + ': ' : ''}${d.lastNote.message || ''}` : '—'}
                                </td>
                                <td className="p-3">
                                    <div className="flex justify-end gap-1.5">
                                        <a href={`tel:${a.parentPhone || a.phone}`} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700" title="Call" aria-label={`Call ${a.studentName}`}><Phone className="w-4 h-4" /></a>
                                        <a href={`https://wa.me/91${String(a.parentPhone || a.phone || '').slice(-10)}?text=${encodeURIComponent(`Hello, this is a reminder from Unacademy Nashik: a fee balance of ${formatINR(d.balance)} for ${a.studentName} is pending. Please clear it at the earliest.`)}`}
                                            target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700" title="WhatsApp reminder" aria-label={`WhatsApp ${a.studentName}`}><MessageCircle className="w-4 h-4" /></a>
                                        <button type="button" onClick={() => setActive(a)} className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold">Log call</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {active && <CallLog admission={active} userProfile={userProfile} onClose={() => setActive(null)} />}
        </div>
    );
};

const TONES = { rose: 'bg-rose-50 text-rose-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600' };
const Tile = ({ icon: Icon, tone, label, value }) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
        <div className={`p-3 rounded-xl ${TONES[tone]}`}><Icon className="w-5 h-5" /></div>
        <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{label}</p>
            <p className="text-xl font-black text-slate-800">{value}</p>
        </div>
    </div>
);

// Log a call: outcome, note, optional promise (date + amount), next reminder.
const CallLog = ({ admission, userProfile, onClose }) => {
    const d = dueInfo(admission);
    const [outcome, setOutcome] = useState(OUTCOMES[0]);
    const [message, setMessage] = useState('');
    const [promisedDate, setPromisedDate] = useState(admission.promisedDate || '');
    const [promisedAmount, setPromisedAmount] = useState(admission.promisedAmount || '');
    const [saving, setSaving] = useState(false);
    const history = [...(admission.recoveryTimeline || [])].reverse();

    const save = async () => {
        setSaving(true);
        try {
            const entry = { type: 'CALL', outcome, message: message.trim(), date: Timestamp.now(), by: userProfile?.name || 'Recovery', byUid: userProfile?.uid || null };
            const update = { recoveryTimeline: arrayUnion(entry), lastContactAt: Timestamp.now() };
            if (promisedDate) {
                update.promisedDate = promisedDate;
                update.promisedAmount = Number(promisedAmount) || null;
                update.nextPaymentDate = promisedDate;
                update.reminderSetBy = userProfile?.name || 'Recovery';
            }
            await updateDoc(doc(db, 'admissions', admission.id), update);
            clearAdmissionsCache();
            onClose();
        } catch (err) {
            console.error(err);
            alert('Could not save: ' + err.message);
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-label={`Log call for ${admission.studentName}`}>
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-5 border-b border-slate-100 flex justify-between items-start">
                    <div>
                        <h2 className="font-black text-lg text-slate-800">{admission.studentName}</h2>
                        <p className="text-xs text-slate-500">{admission.parentPhone || admission.phone} · Balance {formatINR(d?.balance)} · {d?.daysOverdue > 0 ? `${d.daysOverdue} days late` : 'not late yet'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100" aria-label="Close"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-3 overflow-y-auto">
                    <label className="block text-xs font-bold text-slate-500">Outcome
                        <select value={outcome} onChange={e => setOutcome(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                            {OUTCOMES.map(o => <option key={o}>{o}</option>)}
                        </select>
                    </label>
                    <label className="block text-xs font-bold text-slate-500">Note
                        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="What did the parent say?" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block text-xs font-bold text-slate-500">Promised date
                            <input type="date" value={promisedDate} onChange={e => setPromisedDate(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                        </label>
                        <label className="block text-xs font-bold text-slate-500">Promised amount (₹)
                            <input type="number" min="0" value={promisedAmount} onChange={e => setPromisedAmount(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                        </label>
                    </div>
                    {history.length > 0 && (
                        <div>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">History</p>
                            <ul className="space-y-2">
                                {history.slice(0, 10).map((n, i) => (
                                    <li key={i} className="text-xs bg-slate-50 rounded-lg p-2">
                                        <span className="font-bold text-slate-700">{n.outcome || n.type}</span>{n.message ? `: ${n.message}` : ''}
                                        <span className="block text-[10px] text-slate-400">{noteDate(n)?.toLocaleString('en-IN') || ''} · {n.by}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                    <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save call'}</button>
                </div>
            </div>
        </div>
    );
};

export default RecoveryDashboard;
