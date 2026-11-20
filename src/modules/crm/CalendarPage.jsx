// Calendar · counsellor week view (design canvas board, approved 20 Nov 2026).
// Built from the call-back date (nextFollowUp) on each enquiry. Read-only here:
// moving a call-back is done by logging the call on the enquiry, as today.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeToLeads } from '../../services/leadService';
import { Seg, Card, Empty, Contact, Tile, Count } from '../../components/j';
import { DAY, dayStart } from '../../components/j/util';
import { CENTRES, inCentre, programLabel } from '../j/data';
import { normaliseRole } from '../../utils/navItems';

const CLOSED = ['NOT_INTERESTED', 'REJECTED', 'LOST', 'CLOSED', 'REFUNDED', 'CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN'];
const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const mondayOf = (ms) => { const d = new Date(dayStart(ms)); const back = (d.getDay() + 6) % 7; return dayStart(d.getTime() - back * DAY); };
const isHot = (l) => /hot/i.test(l.temperature || l.priority || '') || l.isHot === true;

const LeadChip = ({ l, late }) => (
    <div className="jb-row jb-rise" style={{ padding: '8px 10px', borderRadius: 14, background: late ? 'var(--latebg)' : 'var(--panel)', border: '1px solid var(--line)' }}>
        <Link to={`/staff/leads/${l.id}`} className="block min-w-0">
            <span className="block font-bold text-[13px] truncate">{isHot(l) ? '🔥 ' : ''}{l.studentName || l.name || 'Enquiry'}</span>
            <span className="block text-[11.5px] truncate" style={{ color: 'var(--muted)' }}>{programLabel(l.courseInterest || l.program) || 'Course not noted'} · {l.assignedByName || l.assignedToName || 'Unassigned'}</span>
        </Link>
        <div className="mt-1.5"><Contact name={l.studentName} phone={l.parentPhone || l.phone} size="sm" who="parent" message={`Hello, this is Unacademy Nashik about ${l.studentName || 'your enquiry'}.`} /></div>
    </div>
);

const CalendarPage = ({ userProfile }) => {
    const role = normaliseRole(userProfile?.role);
    const lead = ['DIRECTOR', 'MANAGER'].includes(role);
    const [leads, setLeads] = useState(null);
    const [centre, setCentre] = useState('ALL');
    const [who, setWho] = useState('ALL');
    const [week, setWeek] = useState(() => mondayOf(Date.now()));

    useEffect(() => subscribeToLeads(userProfile, (d) => setLeads(Array.isArray(d) ? d : [])), [userProfile]);

    const v = useMemo(() => {
        const today = ymd(Date.now());
        const open = (leads || []).filter(l => !CLOSED.includes(l.status) && inCentre(l, centre)
            && (lead ? (who === 'ALL' || l.assignedTo === who) : l.assignedTo === userProfile?.uid));
        const people = {};
        (leads || []).forEach(l => { if (l.assignedTo) people[l.assignedTo] = l.assignedByName || l.assignedToName || 'Counsellor'; });
        const days = Array.from({ length: 7 }, (_, i) => {
            const ms = week + i * DAY; const key = ymd(ms);
            return { ms, key, today: key === today, past: key < today, list: open.filter(l => l.nextFollowUp === key).sort((a, b) => Number(isHot(b)) - Number(isHot(a))) };
        }).filter((d, i) => i < 6 || d.list.length > 0); // Sunday shows only when something is booked
        const missed = open.filter(l => l.nextFollowUp && l.nextFollowUp < today);
        const none = open.filter(l => !l.nextFollowUp);
        return { days, missed, none, todayN: open.filter(l => l.nextFollowUp === today).length, weekN: days.reduce((s, d) => s + d.list.length, 0), people: Object.entries(people) };
    }, [leads, centre, who, week, lead, userProfile?.uid]);

    if (leads === null) return <div className="jb-sk h-[480px] rounded-3xl" />;
    const label = (ms, o) => new Date(ms).toLocaleDateString('en-IN', o);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="jb-h text-[26px]">Calendar</h1>
                    <p className="jb-sub text-[14px]">Call-backs booked on enquiries, week by week.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {role === 'DIRECTOR' && <Seg size="sm" label="Centre" options={CENTRES} value={centre} onChange={setCentre} />}
                    {lead && v.people.length > 0 && (
                        <select value={who} onChange={e => setWho(e.target.value)} className="jb-act jb-act-line" aria-label="Counsellor">
                            <option value="ALL">All counsellors</option>
                            {v.people.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
                        </select>
                    )}
                </div>
            </div>

            <div className="jb-grid4">
                <Tile tone="sage" emoji="📞" title="Today" value={<Count value={v.todayN} />} sub="Call-backs due today" />
                <Tile tone="blue" emoji="🗓️" title="This week" value={<Count value={v.weekN} />} sub="Booked in the week shown" delay={60} />
                <Tile tone="coral" emoji="⏰" title="Missed" value={<Count value={v.missed.length} />} sub="Date passed, still open" delay={120} />
                <Tile tone="butter" emoji="❔" title="No date" value={<Count value={v.none.length} />} sub="Open, no call-back set" delay={180} />
            </div>

            <Card title={`${label(week, { day: 'numeric', month: 'short' })} – ${label(v.days[v.days.length - 1].ms, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                right={<div className="flex gap-2">
                    <button type="button" className="jb-act jb-act-line" onClick={() => setWeek(w => w - 7 * DAY)} aria-label="Previous week">‹</button>
                    <button type="button" className="jb-act jb-act-soft" onClick={() => setWeek(mondayOf(Date.now()))}>This week</button>
                    <button type="button" className="jb-act jb-act-line" onClick={() => setWeek(w => w + 7 * DAY)} aria-label="Next week">›</button>
                </div>}>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:var(--cols)]" style={{ '--cols': `repeat(${v.days.length}, minmax(0, 1fr))` }}>
                    {v.days.map(d => (
                        <div key={d.key} className="rounded-2xl p-2.5 lg:min-h-[160px]" style={{ background: d.today ? 'var(--sage2)' : 'var(--cream)', opacity: d.past && !d.today ? 0.75 : 1 }}>
                            <p className="text-[12.5px] font-extrabold mb-2 px-1 flex justify-between">
                                <span>{label(d.ms, { weekday: 'short' })} {label(d.ms, { day: 'numeric' })}{d.today ? ' · Today' : ''}</span>
                                <span style={{ color: 'var(--muted)' }}>{d.list.length || ''}</span>
                            </p>
                            <div className="space-y-2">
                                {d.list.length === 0 ? <p className="text-[12px] px-1" style={{ color: 'var(--muted)' }}>Nothing booked</p>
                                    : d.list.map(l => <LeadChip key={l.id} l={l} late={d.past && !d.today} />)}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <Card title="⏰ Missed call-backs" sub="The date passed and the enquiry is still open" delay={120}>
                {v.missed.length === 0 ? <Empty>No missed call-backs.</Empty> : (
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                        {v.missed.slice(0, 24).map(l => <LeadChip key={l.id} l={l} late />)}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default CalendarPage;
