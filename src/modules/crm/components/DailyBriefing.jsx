import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, PhoneCall, AlertTriangle, CalendarClock, Handshake, IndianRupee, X } from 'lucide-react';
import { formatINR } from '../../../utils/money';

const fmt = (ymd) => {
    const d = new Date(`${ymd}T00:00:00`);
    return isNaN(d) ? ymd : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const Section = ({ icon: Icon, tone, title, items, render, more }) => {
    if (!items.length) return null;
    return (
        <section>
            <h3 className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider mb-2 ${tone}`}>
                <Icon className="w-4 h-4" /> {title} <span className="text-slate-400 font-bold">({items.length})</span>
            </h3>
            <ul className="space-y-1.5">
                {items.slice(0, 5).map(render)}
            </ul>
            {items.length > 5 && <p className="text-[11px] text-slate-400 mt-1 pl-1">and {items.length - 5} more {more}</p>}
        </section>
    );
};

// The counsellor's plan for the day, shown first when they open the
// dashboard (once a day) and again from the "Today's plan" button.
const DailyBriefing = ({ briefing, name, onClose }) => {
    const navigate = useNavigate();
    const go = (path) => { onClose(); navigate(path); };
    const row = 'w-full flex justify-between items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 hover:bg-blue-50 text-left text-sm transition';
    const b = briefing;

    const leadRow = (t) => (
        <li key={t.id}>
            <button type="button" className={row} onClick={() => go(`/staff/leads/${t.id}`)}>
                <span className="font-bold text-slate-700 truncate">{t.studentName}</span>
                <span className="text-[11px] text-slate-500 shrink-0">{t.nextFollowUp === b.today ? t.phone : `since ${fmt(t.nextFollowUp)}`}</span>
            </button>
        </li>
    );
    const feeRow = (i, label) => (
        <li key={i.id} className={row}>
            <span className="font-bold text-slate-700 truncate">{i.studentName}</span>
            <span className="text-[11px] text-slate-500 shrink-0 flex items-center gap-2">
                {label(i)} · <span className="font-bold text-rose-600">{formatINR(i.balance)}</span>
                {(i.parentPhone || i.phone) && <a href={`tel:${i.parentPhone || i.phone}`} className="p-1 rounded-full hover:bg-white" aria-label={`Call about ${i.studentName}`}><PhoneCall className="w-3.5 h-3.5 text-blue-600" /></a>}
            </span>
        </li>
    );

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Today's plan">
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-6 text-white flex justify-between items-start" style={{ background: 'linear-gradient(to right, #1e3a8a, #172554)' }}>
                    <div>
                        <p className="text-blue-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Sun className="w-4 h-4" /> Today&apos;s plan · {fmt(b.today)}</p>
                        <h2 className="text-2xl font-black mt-1">Hi {name}, {b.count === 0 ? 'nothing is due today' : b.count === 1 ? '1 thing needs you today' : `${b.count} things need you today`}</h2>
                        {b.overdueAmount > 0 && <p className="text-blue-200 text-sm mt-1">{formatINR(b.overdueAmount)} in fees is overdue on your students.</p>}
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-5 overflow-y-auto">
                    <Section icon={AlertTriangle} tone="text-red-600" title="Missed follow-ups" items={b.followUpsMissed} render={leadRow} more="missed calls" />
                    <Section icon={PhoneCall} tone="text-blue-700" title="Follow-up calls today" items={b.followUpsToday} render={leadRow} more="calls" />
                    <Section icon={Handshake} tone="text-emerald-700" title="Parents who promised to pay today" items={b.promisesToday} render={(i) => feeRow(i, (x) => x.promisedAmount ? `promised ${formatINR(x.promisedAmount)}` : 'promised today')} more="promises" />
                    <Section icon={IndianRupee} tone="text-rose-700" title="Fees overdue" items={b.feesOverdue} render={(i) => feeRow(i, (x) => `${-x.daysLeft} days late`)} more="students" />
                    <Section icon={CalendarClock} tone="text-amber-700" title="Fees due today" items={b.feesToday} render={(i) => feeRow(i, () => 'due today')} more="students" />
                    <Section icon={CalendarClock} tone="text-slate-600" title="Fees due in the next 2 days" items={b.feesSoon} render={(i) => feeRow(i, (x) => `due ${x.dueDate}`)} more="students" />
                    {b.count === 0 && <p className="text-center text-slate-400 py-6">No calls or fee dues today. Add new leads or follow up on interested ones.</p>}
                </div>
                <div className="p-4 border-t border-slate-100 flex justify-end">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-700 text-white hover:bg-blue-800">Start my day</button>
                </div>
            </div>
        </div>
    );
};

export default DailyBriefing;
