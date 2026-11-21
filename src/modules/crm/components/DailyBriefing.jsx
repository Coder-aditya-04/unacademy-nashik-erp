import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../../../utils/money';
import { Layer } from '../../../components/j';

const fmt = (ymd) => {
    const d = new Date(`${ymd}T00:00:00`);
    return isNaN(d) ? ymd : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const Section = ({ emoji, tone, title, items, render, more }) => {
    if (!items.length) return null;
    return (
        <section>
            <h3 className="flex items-center gap-2 text-[12.5px] font-extrabold uppercase tracking-wide mb-2" style={{ color: tone }}>
                <span aria-hidden="true">{emoji}</span> {title} <span style={{ color: 'var(--muted)' }}>({items.length})</span>
            </h3>
            <ul className="flex flex-col gap-1.5">
                {items.slice(0, 5).map(render)}
            </ul>
            {items.length > 5 && <p className="text-[11.5px] mt-1 pl-1" style={{ color: 'var(--muted)' }}>and {items.length - 5} more {more}</p>}
        </section>
    );
};

// The counsellor's plan for the day, shown first when they open the
// dashboard (once a day) and again from the "Today's plan" button.
const DailyBriefing = ({ briefing, name, onClose }) => {
    const navigate = useNavigate();
    const go = (path) => { onClose(); navigate(path); };
    const row = 'jb-row w-full flex justify-between items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[13.5px]';
    const rowStyle = { background: 'var(--cream)' };
    const b = briefing;

    const leadRow = (t) => (
        <li key={t.id}>
            <button type="button" className={row} style={rowStyle} onClick={() => go(`/staff/leads/${t.id}`)}>
                <span className="font-bold truncate">{t.studentName}</span>
                <span className="text-[11.5px] shrink-0" style={{ color: 'var(--muted)' }}>{t.nextFollowUp === b.today ? t.phone : `since ${fmt(t.nextFollowUp)}`}</span>
            </button>
        </li>
    );
    const feeRow = (i, label) => (
        <li key={i.id} className={row} style={rowStyle}>
            <span className="font-bold truncate">{i.studentName}</span>
            <span className="text-[11.5px] shrink-0 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                {label(i)} · <span className="font-bold" style={{ color: 'var(--late)' }}>{formatINR(i.balance)}</span>
                {(i.parentPhone || i.phone) && <a href={`tel:${i.parentPhone || i.phone}`} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--t-sage)' }} aria-label={`Call about ${i.studentName}`}>📞</a>}
            </span>
        </li>
    );

    return (
        <Layer>
            <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 shell-fade" style={{ background: 'rgba(17,25,21,.4)' }} role="dialog" aria-modal="true" aria-label="Today's plan" onClick={onClose}>
                <div className="jb-rise w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px]" style={{ background: 'var(--panel)', color: 'var(--ink)', boxShadow: '0 30px 70px rgba(29,42,34,.25)' }} onClick={e => e.stopPropagation()}>
                    <div className="p-6 flex justify-between items-start gap-3" style={{ background: 'var(--pine)', color: '#FFFFFF' }}>
                        <div>
                            <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: '#C9D8BC' }}>☀️ Today&apos;s plan · {fmt(b.today)}</p>
                            <h2 className="jb-h text-[24px] mt-1 leading-tight" style={{ color: '#FFFFFF' }}>Hi {name}, {b.count === 0 ? 'nothing is due today' : b.count === 1 ? '1 thing needs you today' : `${b.count} things need you today`}</h2>
                            {b.overdueAmount > 0 && <p className="text-[13px] mt-1" style={{ color: '#DCE8D2' }}>{formatINR(b.overdueAmount)} in fees is overdue on your students.</p>}
                        </div>
                        <button type="button" onClick={onClose} className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,.12)' }} aria-label="Close">✕</button>
                    </div>
                    <div className="p-5 flex flex-col gap-5 overflow-y-auto">
                        <Section emoji="⏰" tone="var(--late)" title="Missed follow-ups" items={b.followUpsMissed} render={leadRow} more="missed calls" />
                        <Section emoji="📞" tone="var(--ink)" title="Follow-up calls today" items={b.followUpsToday} render={leadRow} more="calls" />
                        <Section emoji="🤝" tone="var(--ok)" title="Parents who promised to pay today" items={b.promisesToday} render={(i) => feeRow(i, (x) => x.promisedAmount ? `promised ${formatINR(x.promisedAmount)}` : 'promised today')} more="promises" />
                        <Section emoji="💸" tone="var(--late)" title="Fees overdue" items={b.feesOverdue} render={(i) => feeRow(i, (x) => `${-x.daysLeft} days late`)} more="students" />
                        <Section emoji="🗓️" tone="var(--butter-ink, #8A6A12)" title="Fees due today" items={b.feesToday} render={(i) => feeRow(i, () => 'due today')} more="students" />
                        <Section emoji="📅" tone="var(--sub)" title="Fees due in the next 2 days" items={b.feesSoon} render={(i) => feeRow(i, (x) => `due ${x.dueDate}`)} more="students" />
                        {b.count === 0 && <p className="text-center py-6" style={{ color: 'var(--muted)' }}>No calls or fee dues today. Add new leads or follow up on interested ones.</p>}
                    </div>
                    <div className="p-4 flex justify-end" style={{ borderTop: '1px solid var(--track)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                        <button type="button" onClick={onClose} className="jb-act jb-act-ink" style={{ padding: '11px 22px' }}>Start my day →</button>
                    </div>
                </div>
            </div>
        </Layer>
    );
};

export default DailyBriefing;
