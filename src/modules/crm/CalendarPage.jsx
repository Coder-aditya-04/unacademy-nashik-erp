// Counsellor calendar · week view (design board L8, approved 20 Nov 2026).
// Blocks come from each open enquiry's call-back date (nextFollowUp, with
// nextFollowUpTime when the telecaller booked a time). The kind is read from
// the enquiry: a booked centre visit is a meeting, a quoted fee is a fee
// quote, anything else is a call. Logging what happened is still done on the
// enquiry, so the history stays in one place.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeToLeads, addInteraction } from '../../services/leadService';
import { Seg, Card, Empty, Contact, Tile, Count } from '../../components/j';
import { useToast } from '../../components/j/context';
import { DAY, dayStart, lakh } from '../../components/j/util';
import { CENTRES, inCentre, programLabel } from '../j/data';
import { normaliseRole } from '../../utils/navItems';

const CLOSED = ['NOT_INTERESTED', 'REJECTED', 'LOST', 'CLOSED', 'REFUNDED', 'CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN'];
const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const mondayOf = (ms) => { const d = new Date(dayStart(ms)); const back = (d.getDay() + 6) % 7; return dayStart(d.getTime() - back * DAY); };
const isHot = (l) => /hot/i.test(l.temperature || l.priority || '') || l.isHot === true;
const START = 9; const END = 19; const ROW = 56; // 9 AM to 7 PM, px per hour

const KINDS = {
    CALL: { e: '📞', l: 'Call', bg: 'var(--t-sage)', verb: 'Call back' },
    MEET: { e: '🤝', l: 'Walk-in or meeting', bg: 'var(--t-blue)', verb: 'Visit' },
    QUOTE: { e: '🧮', l: 'Fee quote', bg: 'var(--t-butter)', verb: 'Fee quote' },
};
const kindOf = (l) => {
    if (['VISIT_SCHEDULED', 'VISIT_RESCHEDULED'].includes(l.teleStage) || l.status === 'VISIT_SCHEDULED') return 'MEET';
    if (Number(l.budgetQuoted) > 0) return 'QUOTE';
    return 'CALL';
};
const timeOf = (l) => {
    const t = String(l.nextFollowUpTime || String(l.nextFollowUp || '').slice(11, 16) || '');
    const m = /^(\d{1,2}):(\d{2})/.exec(t);
    return m ? Number(m[1]) + Number(m[2]) / 60 : null;
};
const clock = (h) => { const hh = Math.floor(h); const mm = Math.round((h - hh) * 60); const d = new Date(2000, 0, 1, hh, mm); return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toUpperCase(); };
const label = (ms, o) => new Date(ms).toLocaleDateString('en-IN', o);

const Block = ({ ev, on, onPick, style }) => (
    <button type="button" onClick={() => onPick(ev.id)} aria-pressed={on}
        className="jb-rise w-full text-left rounded-xl px-2.5 py-1.5 overflow-hidden transition-shadow"
        style={{ background: KINDS[ev.kind].bg, boxShadow: on ? '0 0 0 2px var(--ink)' : 'none', ...style }}>
        <b className="block text-[12.5px] truncate" title={`${KINDS[ev.kind].verb} ${ev.l.studentName || ''}`}>{ev.l.studentName || 'Enquiry'}{ev.hot ? ' 🔥' : ''}</b>
        <span className="block text-[11px] truncate" style={{ color: 'var(--sub)' }}>{KINDS[ev.kind].e} {ev.time != null ? clock(ev.time) : 'Any time'}{ev.late ? ' · missed' : ''}</span>
    </button>
);

const CalendarPage = ({ userProfile }) => {
    const toast = useToast();
    const role = normaliseRole(userProfile?.role);
    const lead = ['DIRECTOR', 'MANAGER'].includes(role);
    const [leads, setLeads] = useState(null);
    const [centre, setCentre] = useState('ALL');
    const [who, setWho] = useState('ALL');
    const [week, setWeek] = useState(() => mondayOf(Date.now()));
    const [sel, setSel] = useState(null);

    useEffect(() => subscribeToLeads(userProfile, (d) => setLeads(Array.isArray(d) ? d : [])), [userProfile]);

    const v = useMemo(() => {
        const today = ymd(Date.now());
        const people = {};
        (leads || []).forEach(l => { if (l.assignedTo && !CLOSED.includes(l.status)) people[l.assignedTo] = l.assignedByName || l.assignedToName || 'Counsellor'; });
        const open = (leads || []).filter(l => !CLOSED.includes(l.status) && inCentre(l, centre)
            && (lead ? (who === 'ALL' || l.assignedTo === who) : l.assignedTo === userProfile?.uid));
        const toEv = (l) => { const key = String(l.nextFollowUp || '').slice(0, 10); return { id: l.id, l, key, kind: kindOf(l), time: timeOf(l), hot: isHot(l), late: key < today }; };
        const days = Array.from({ length: 7 }, (_, i) => {
            const ms = week + i * DAY; const key = ymd(ms);
            const evs = open.filter(l => String(l.nextFollowUp || '').slice(0, 10) === key).map(toEv)
                .sort((a, b) => (a.time ?? -1) - (b.time ?? -1) || Number(b.hot) - Number(a.hot));
            return { ms, key, today: key === today, past: key < today, evs };
        }).filter((d, i) => i < 6 || d.evs.length > 0); // Sunday only when something is booked
        const all = days.flatMap(d => d.evs);
        const missed = open.filter(l => l.nextFollowUp && String(l.nextFollowUp).slice(0, 10) < today).map(toEv);
        const kinds = Object.keys(KINDS).map(k => ({ k, n: all.filter(e => e.kind === k).length }));
        return { days, all, missed, kinds, none: open.filter(l => !l.nextFollowUp).length, people: Object.entries(people).sort((a, b) => a[1].localeCompare(b[1])) };
    }, [leads, centre, who, week, lead, userProfile?.uid]);

    if (leads === null) return <div className="jb-sk h-[480px] rounded-3xl" />;

    const cur = v.all.find(e => e.id === sel) || v.missed.find(e => e.id === sel) || v.all.find(e => !e.late) || v.all[0] || null;
    const whoName = lead ? (who === 'ALL' ? 'the team' : (v.people.find(p => p[0] === who)?.[1] || 'the counsellor')) : (userProfile?.name || 'you').split(' ')[0];
    const last = v.days[v.days.length - 1].ms;
    const nowH = new Date().getHours() + new Date().getMinutes() / 60;

    const moveNext = async (ev) => {
        const next = ymd(Math.max(dayStart(Date.now()), new Date(ev.key).getTime()) + DAY + 3 * 3600000);
        const r = await addInteraction(ev.id, { type: 'NOTE', result: `Call-back moved to ${label(new Date(next).getTime(), { weekday: 'short', day: 'numeric', month: 'short' })}`, nextFollowUp: next }, userProfile);
        toast(r.success ? '➡️' : '⚠️', r.success ? `${ev.l.studentName} moved to the next day` : 'Could not save. Try again.');
    };

    const options = [{ value: 'ALL', label: 'Everyone' }, ...v.people.slice(0, 5).map(([id, n]) => ({ value: id, label: n.split(' ')[0] }))];

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 jb-rise">
                <div>
                    <h2 className="jb-h text-[32px] sm:text-[42px] leading-tight">Counsellor calendar</h2>
                    <p className="jb-sub text-[14.5px] mt-1">{label(week, { day: 'numeric' })} to {label(last, { day: 'numeric', month: 'long' })} · {v.all.length} {v.all.length === 1 ? 'block' : 'blocks'} planned for {whoName}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {role === 'DIRECTOR' && <Seg size="sm" label="Centre" options={CENTRES} value={centre} onChange={setCentre} />}
                    {lead && v.people.length > 0 && <Seg label="Counsellor" options={options} value={who} onChange={setWho} pillBg="var(--ink)" onInk="var(--on-ink)" />}
                </div>
            </div>

            <div className="jb-grid4">
                <Tile tone="sage" emoji="📞" title="Calls this week" value={<Count value={v.kinds[0].n} />} sub={v.days.find(d => d.today) ? `${v.days.find(d => d.today).evs.length} today` : 'In the week shown'} />
                <Tile tone="blue" emoji="🤝" title="Walk-ins and meetings" value={<Count value={v.kinds[1].n} />} sub="Centre visits booked" delay={60} />
                <Tile tone="butter" emoji="🧮" title="Fee quotes" value={<Count value={v.kinds[2].n} />} sub="Parents deciding on a quote" delay={120} />
                <Tile tone="coral" emoji="⏰" title="Missed" value={<Count value={v.missed.length} />} sub={v.none ? `${v.none} more with no date set` : 'Date passed, still open'} delay={180} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <Card pad={20} delay={80}>
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <b className="text-[15px]">{label(week, { day: 'numeric', month: 'short' })} – {label(last, { day: 'numeric', month: 'short', year: 'numeric' })}</b>
                        <div className="flex gap-2">
                            <button type="button" className="jb-act jb-act-line" onClick={() => setWeek(w => w - 7 * DAY)} aria-label="Previous week">‹</button>
                            <button type="button" className="jb-act jb-act-soft" onClick={() => setWeek(mondayOf(Date.now()))}>This week</button>
                            <button type="button" className="jb-act jb-act-line" onClick={() => setWeek(w => w + 7 * DAY)} aria-label="Next week">›</button>
                        </div>
                    </div>

                    {/* Wide screens: hour grid */}
                    <div className="hidden md:grid gap-2" style={{ gridTemplateColumns: `48px repeat(${v.days.length}, minmax(0, 1fr))` }}>
                        <span />
                        {v.days.map(d => (
                            <div key={d.key} className="rounded-2xl py-1.5 text-center" style={{ background: d.today ? 'var(--ink)' : 'var(--cream)', color: d.today ? 'var(--on-ink)' : 'var(--ink)' }}>
                                <span className="block text-[11.5px] font-semibold opacity-80">{label(d.ms, { weekday: 'short' })}</span>
                                <b className="block text-[19px] leading-tight">{label(d.ms, { day: 'numeric' })}</b>
                            </div>
                        ))}
                        {/* Untimed row */}
                        <span className="text-[11px] text-right pr-1 pt-2" style={{ color: 'var(--muted)' }}>Any time</span>
                        {v.days.map(d => (
                            <div key={d.key} className="rounded-xl p-1 flex flex-col gap-1 min-h-[44px]" style={{ background: d.today ? 'var(--t-sage)' : 'var(--cream)', opacity: d.past && !d.today ? 0.7 : 1 }}>
                                {d.evs.filter(e => e.time == null).slice(0, 4).map(e => <Block key={e.id} ev={e} on={cur?.id === e.id} onPick={setSel} />)}
                                {d.evs.filter(e => e.time == null).length > 4 && <span className="text-[11px] px-1" style={{ color: 'var(--muted)' }}>+{d.evs.filter(e => e.time == null).length - 4} more</span>}
                            </div>
                        ))}
                        {/* Hour grid */}
                        <div className="relative" style={{ height: (END - START) * ROW }}>
                            {Array.from({ length: END - START }, (_, i) => (
                                <span key={i} className="absolute right-1 text-[11px] -translate-y-1/2" style={{ top: i * ROW + 6, color: 'var(--muted)' }}>{clock(START + i).replace(':00', '')}</span>
                            ))}
                        </div>
                        {v.days.map(d => (
                            <div key={d.key} className="relative rounded-xl" style={{ height: (END - START) * ROW, background: d.today ? 'var(--t-sage)' : 'var(--cream)', opacity: d.past && !d.today ? 0.7 : 1 }}>
                                {Array.from({ length: END - START - 1 }, (_, i) => <span key={i} aria-hidden="true" className="absolute left-0 right-0 h-px" style={{ top: (i + 1) * ROW, background: 'var(--track)' }} />)}
                                {d.today && nowH > START && nowH < END && <span aria-hidden="true" className="absolute -left-1 -right-1 h-[2px] z-[2]" style={{ top: (nowH - START) * ROW, background: 'var(--coral)' }} />}
                                {d.evs.filter(e => e.time != null).map((e, i) => {
                                    const t = Math.min(Math.max(e.time, START), END - 0.75);
                                    return <Block key={e.id} ev={e} on={cur?.id === e.id} onPick={setSel} style={{ position: 'absolute', top: (t - START) * ROW + 3, left: 4, right: 4, width: 'auto', height: ROW * 0.9 - 6, zIndex: 1, animationDelay: `${i * 30}ms` }} />;
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Phones: day list */}
                    <div className="md:hidden flex flex-col gap-3">
                        {v.days.map(d => (
                            <div key={d.key} className="rounded-2xl p-2.5" style={{ background: d.today ? 'var(--t-sage)' : 'var(--cream)' }}>
                                <p className="text-[13px] font-extrabold px-1 mb-1.5">{label(d.ms, { weekday: 'short', day: 'numeric' })}{d.today ? ' · Today' : ''}</p>
                                {d.evs.length === 0 ? <p className="text-[12px] px-1" style={{ color: 'var(--muted)' }}>Nothing booked</p>
                                    : <div className="flex flex-col gap-1.5">{d.evs.map(e => <Block key={e.id} ev={e} on={cur?.id === e.id} onPick={setSel} />)}</div>}
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="flex flex-col gap-4 min-w-0">
                    <Card delay={120}>
                        {!cur ? <Empty emoji="🌿">Nothing planned this week.</Empty> : (
                            <div key={cur.id} className="jb-rise">
                                <span className="inline-block text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: KINDS[cur.kind].bg }}>{KINDS[cur.kind].e} {KINDS[cur.kind].l}</span>
                                <h3 className="jb-h text-[20px] mt-2 leading-tight">{KINDS[cur.kind].verb} {cur.l.studentName}{cur.hot ? ' 🔥' : ''}</h3>
                                <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
                                    {label(new Date(cur.key).getTime(), { weekday: 'short', day: 'numeric', month: 'short' })} · {cur.time != null ? clock(cur.time) : 'any time'}{cur.late ? ' · missed' : ''}
                                </p>
                                <p className="text-[13px] mt-2">{programLabel(cur.l.courseInterest) || 'Course not noted'}{Number(cur.l.budgetQuoted) ? ` · quote ${lakh(cur.l.budgetQuoted)}` : ''}{cur.l.telecaller ? ` · from ${cur.l.telecaller}` : ''}</p>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <Link to={`/staff/leads/${cur.id}`} className="jb-act jb-act-ink">Open and log</Link>
                                    <button type="button" className="jb-act jb-act-soft" onClick={() => moveNext(cur)}>Move to next day →</button>
                                </div>
                                <div className="mt-3"><Contact labelled name={cur.l.studentName} phone={cur.l.parentPhone || cur.l.phone} who="parent" message={`Hello, this is Unacademy Nashik about ${cur.l.studentName || 'your enquiry'}.`} /></div>
                            </div>
                        )}
                    </Card>
                    <Card title="Kinds of work" delay={160}>
                        <ul className="flex flex-col gap-2">
                            {v.kinds.map(({ k, n }) => (
                                <li key={k} className="flex items-center gap-2.5 text-[13.5px]">
                                    <span aria-hidden="true" className="w-3.5 h-3.5 rounded" style={{ background: KINDS[k].bg }} />
                                    <span className="flex-1">{KINDS[k].e} {KINDS[k].l}</span><b className="tabular-nums">{n}</b>
                                </li>
                            ))}
                        </ul>
                    </Card>
                    <Card title="⏰ Missed" sub="Date passed, enquiry still open" delay={200}>
                        {v.missed.length === 0 ? <Empty>No missed call-backs.</Empty> : (
                            <div className="flex flex-col gap-1.5">
                                {v.missed.slice(0, 8).map(e => <Block key={e.id} ev={e} on={cur?.id === e.id} onPick={setSel} />)}
                                {v.missed.length > 8 && <p className="text-[12px] text-center" style={{ color: 'var(--muted)' }}>+{v.missed.length - 8} more</p>}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default CalendarPage;
