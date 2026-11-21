// L7 · Batches: seats and fees (design canvas board, updated 21 Nov 2026).
// Batches and their students come from the ERP (batches + admissions).
// Staff work (homework, attendance, payroll) belongs to KAP Core, so this board
// is about seats and fees only. Late payers already reach the Recovery desk on
// their own (it lists every overdue admission), so nothing extra is written.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeToBatches } from '../../services/batchService';
import { subscribeAdmissions } from '../../services/cacheService';
import { Seg, Card, Empty, Contact, Avatar, Tile, Count } from '../../components/j';
import { CENTRES, CENTRE_NAME, centreOf, isLive, phoneOf, programLabel, dateLabel, balanceOf } from '../j/data';
import { toMs, inr } from '../../components/j/util';
import { dueInfo } from '../../utils/recovery';

const fillTone = (pct) => (pct >= 90 ? 'var(--late)' : pct >= 60 ? 'var(--ok)' : '#C9A646');

// What each seat shows, per lens.
const LENSES = [{ value: 'FEES', label: 'Fees' }, { value: 'DOCS', label: 'Documents' }, { value: 'VIA', label: 'Joined via' }];
const VIA_TONE = ['#7E9BC0', '#9C8FD0', '#E2BE4E', '#D8734F', '#8FAE7B', '#B7A99A'];
const srcOf = (a) => String(a.source || 'Not noted').replace(/_/g, ' ').toLowerCase().replace(/^\w/, x => x.toUpperCase());
const feeState = (a, now) => {
    const d = dueInfo(a, now);
    if (!d) return { k: 'clear', c: 'var(--ok)', l: 'Fees clear' };
    if (d.daysOverdue > 0) return { k: 'late', c: 'var(--late)', l: 'Late', d };
    return { k: 'due', c: '#E2BE4E', l: 'Paying on time', d };
};

const SeatGrid = ({ capacity, students, lens, vias, now }) => {
    const cells = Math.max(capacity, students.length);
    const colour = (a) => {
        if (lens === 'DOCS') return ['ACTIVE', 'COMPLETED'].includes(a.status) ? 'var(--ok)' : '#E2BE4E';
        if (lens === 'VIA') return VIA_TONE[Math.max(0, vias.indexOf(srcOf(a))) % VIA_TONE.length];
        return feeState(a, now).c;
    };
    return (
        <div className="grid gap-[5px]" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }} aria-label={`${students.length} of ${capacity} seats filled`}>
            {Array.from({ length: cells }).map((_, i) => {
                const a = students[i];
                return (
                    <Link key={a?.id || `free-${i}`} to={a ? `/staff/student/${a.id}` : '#'} title={a ? `${a.studentName}` : 'Free seat'}
                        onClick={a ? undefined : (e) => e.preventDefault()} className="jb-pop block"
                        style={{ aspectRatio: '1', borderRadius: 6, animationDelay: `${Math.min(i, 60) * 12}ms`, cursor: a ? 'pointer' : 'default',
                            background: a ? colour(a) : 'var(--track)', outline: i >= capacity ? '2px solid var(--late)' : 'none' }} />
                );
            })}
        </div>
    );
};

const Key = ({ c, children }) => <span className="whitespace-nowrap"><span className="inline-block w-2.5 h-2.5 rounded mr-1 align-middle" style={{ background: c }} />{children}</span>;

const BatchesHome = ({ userProfile, onManage }) => {
    const allCentres = userProfile?.role?.toUpperCase() === 'DIRECTOR';
    const scope = allCentres ? 'ALL' : (userProfile?.centerId || '');
    const [batches, setBatches] = useState(null);
    const [admissions, setAdmissions] = useState([]);
    const [centre, setCentre] = useState('ALL');
    const [selId, setSelId] = useState(null);
    const [search, setSearch] = useState('');
    const [lens, setLens] = useState('FEES');
    const [now] = useState(() => Date.now());

    useEffect(() => subscribeToBatches(scope === 'ALL' ? null : scope, (b) => setBatches(b || [])), [scope]);
    useEffect(() => {
        if (!scope) return undefined;
        return subscribeAdmissions(scope, (d) => setAdmissions(d || []), { allSessions: true });
    }, [scope]);

    const v = useMemo(() => {
        const live = admissions.filter(isLive);
        const rows = (batches || [])
            .filter(b => centre === 'ALL' || centreOf({ centerId: b.centerId }) === centre)
            .map(b => {
                const students = live.filter(a => a.batchAssigned === b.name);
                const capacity = Number(b.capacity || b.totalSeats) || 60;
                return { ...b, students, capacity, filled: students.length, pct: Math.round((students.length / capacity) * 100) };
            })
            .sort((a, b) => (a.status === 'ACTIVE' ? 0 : 1) - (b.status === 'ACTIVE' ? 0 : 1) || b.pct - a.pct);
        const names = new Set((batches || []).map(b => b.name));
        const unassigned = live.filter(a => (centre === 'ALL' || centreOf(a) === centre) && (!a.batchAssigned || !names.has(a.batchAssigned)));
        const seats = rows.reduce((s, r) => s + r.capacity, 0);
        const filled = rows.reduce((s, r) => s + Math.min(r.filled, r.capacity), 0);
        return { rows, unassigned, seats, filled, full: rows.filter(r => r.pct >= 90).length };
    }, [batches, admissions, centre]);

    const sel = v.rows.find(r => r.id === selId) || v.rows[0];
    const vias = [...new Set((sel?.students || []).map(srcOf))];
    const fees = (() => {
        const st = (sel?.students || []).map(a => ({ a, f: feeState(a, now) }));
        const late = st.filter(x => x.f.k === 'late').sort((x, y) => y.f.d.daysOverdue - x.f.d.daysOverdue);
        const soon = st.filter(x => x.f.k === 'due' && x.f.d.due - now <= 14 * 86400000).sort((x, y) => x.f.d.due - y.f.d.due);
        return { n: st.length, clear: st.filter(x => x.f.k === 'clear').length, late, soon, lateSum: late.reduce((s2, x) => s2 + x.f.d.balance, 0) };
    })();
    const list = (sel?.students || []).filter(a => !search || `${a.studentName} ${a.rollNumber || ''}`.toLowerCase().includes(search.toLowerCase()));

    if (batches === null) return <div className="jb-sk h-[420px] rounded-3xl" />;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="jb-h text-[26px]">Batches</h1>
                    <p className="jb-sub text-[14px]">Who sits where, how full each batch is, and whose fees are due.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {allCentres && <Seg size="sm" value={centre} onChange={setCentre} options={CENTRES} label="Centre" />}
                    {onManage && <button type="button" className="jb-act jb-act-line" onClick={onManage}>⚙️ Manage batches</button>}
                </div>
            </div>

            <div className="jb-grid4">
                <Tile tone="sage" emoji="🏫" title="Batches" value={<Count value={v.rows.length} />} sub={`${v.rows.filter(r => r.status === 'ACTIVE').length} running now`} />
                <Tile tone="blue" emoji="🪑" title="Seats filled" value={<><Count value={v.filled} /><span className="text-[18px]" style={{ color: 'var(--sub)' }}> / {v.seats}</span></>} sub={v.seats ? `${Math.round((v.filled / v.seats) * 100)}% of all seats` : 'No seats set'} delay={60} />
                <Tile tone="coral" emoji="🔥" title="Almost full" value={<Count value={v.full} />} sub="90% or more taken" delay={120} />
                <Tile tone="butter" emoji="🧭" title="No batch yet" value={<Count value={v.unassigned.length} />} sub="Admitted, batch not given" delay={180} />
            </div>

            {v.rows.length === 0 ? (
                <Card><Empty emoji="🏫">No batches yet. Use Manage batches to add the first one.</Empty></Card>
            ) : (
                <div className="jb-grid21">
                    <div className="space-y-5 min-w-0">
                        <Card title="All batches" sub="Tap a batch to see its seats and students" delay={80}>
                            <div className="space-y-2">
                                {v.rows.map((r, i) => (
                                    <button key={r.id} type="button" onClick={() => setSelId(r.id)}
                                        className="jb-row w-full text-left jb-rise" style={{ animationDelay: `${i * 40}ms`, background: sel?.id === r.id ? 'var(--sage2)' : undefined, borderRadius: 16, padding: '12px 14px' }}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-bold text-[15px] truncate">{r.name}</p>
                                                <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{programLabel(r.course)} · {CENTRE_NAME[centreOf({ centerId: r.centerId })] || r.centerId}{toMs(r.startDate) ? ` · starts ${dateLabel(toMs(r.startDate))}` : ''}</p>
                                            </div>
                                            <span className={`jb-tag ${r.status === 'ACTIVE' ? 'jb-tag-ok' : 'jb-tag-next'}`}>{r.status === 'ACTIVE' ? 'Running' : r.status === 'UPCOMING' ? 'Upcoming' : (r.status || 'Running')}</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-2">
                                            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--track)' }}>
                                                <div className="h-full rounded-full jb-growx" style={{ width: `${Math.min(100, r.pct)}%`, background: fillTone(r.pct) }} />
                                            </div>
                                            <span className="text-[12.5px] font-bold tabular-nums">{r.filled}/{r.capacity}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </Card>

                        {sel && (
                            <Card title={`Students in ${sel.name}`} sub={`${sel.filled} students`} delay={120}
                                right={<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or roll no" className="jb-seg text-[13px] px-3 py-2 rounded-xl" style={{ border: '1px solid var(--line)', background: 'var(--panel)', width: 190 }} />}>
                                {list.length === 0 ? <Empty emoji="🙂">No students here yet.</Empty> : (
                                    <div className="max-h-[560px] overflow-y-auto pr-1">
                                        {list.map(a => (
                                            <div key={a.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: "1px solid var(--line)" }}>
                                                <Avatar name={a.studentName} size={34} />
                                                <Link to={`/staff/student/${a.id}`} className="min-w-0 flex-1">
                                                    <p className="font-bold text-[14px] truncate">{a.studentName}</p>
                                                    <p className="text-[12px]" style={{ color: 'var(--muted)' }}>{a.rollNumber || 'Roll no pending'}{balanceOf(a) > 0 ? ' · fees due' : ' · fees clear'}</p>
                                                </Link>
                                                <Contact name={a.studentName} phone={phoneOf(a)} size="sm" message={`Hello, this is Unacademy Nashik about ${a.studentName} (${sel.name}).`} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        )}
                    </div>

                    <div className="space-y-5 min-w-0">
                        {sel && (
                            <Card title="Seats" sub={`${sel.name} · ${Math.max(0, sel.capacity - sel.filled)} free`} delay={100}>
                                <Seg size="sm" label="Show" options={LENSES} value={lens} onChange={setLens} className="mb-3" />
                                <SeatGrid capacity={sel.capacity} students={sel.students} lens={lens} vias={vias} now={now} />
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px]" style={{ color: 'var(--sub)' }}>
                                    {lens === 'FEES' && <><Key c="var(--ok)">Fees clear</Key><Key c="#E2BE4E">Paying on time</Key><Key c="var(--late)">Late</Key></>}
                                    {lens === 'DOCS' && <><Key c="var(--ok)">Checked by Accounts</Key><Key c="#E2BE4E">Waiting for check</Key></>}
                                    {lens === 'VIA' && vias.map((x, i) => <Key key={x} c={VIA_TONE[i % VIA_TONE.length]}>{x}</Key>)}
                                    <Key c="var(--track)">Free</Key>
                                </div>
                                {Array.isArray(sel.faculty) && sel.faculty.length > 0 && (
                                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
                                        <p className="text-[12px] font-bold mb-2" style={{ color: 'var(--muted)' }}>FACULTY</p>
                                        {sel.faculty.map((f, i) => <p key={i} className="text-[13.5px]"><b>{f.subject}</b> · {f.name}</p>)}
                                    </div>
                                )}
                            </Card>
                        )}

                        {sel && (
                            <Card title="💰 Fees in this batch" sub={`${fees.clear} of ${fees.n} have paid in full`} delay={160}>
                                <div className="h-2.5 rounded-full overflow-hidden mb-4" style={{ background: 'var(--track)' }}>
                                    <div className="h-full rounded-full jb-growx" style={{ width: `${fees.n ? (fees.clear / fees.n) * 100 : 0}%`, background: 'var(--ok)' }} />
                                </div>
                                {fees.late.length === 0 && fees.soon.length === 0 ? <Empty>Nobody late, nothing due in the next 2 weeks.</Empty> : (
                                    <div className="space-y-3">
                                        {[['Late', fees.late, 'var(--latebg)'], ['Due in the next 2 weeks', fees.soon, 'var(--nextbg)']].filter(([, l]) => l.length).map(([t, l, bg]) => (
                                            <div key={t}>
                                                <p className="text-[12px] font-bold mb-1.5" style={{ color: 'var(--muted)' }}>{t.toUpperCase()} · {l.length}</p>
                                                <div className="space-y-1.5">
                                                    {l.slice(0, 6).map(({ a, f }) => (
                                                        <div key={a.id} className="flex items-center gap-2 rounded-xl" style={{ background: bg, padding: '7px 10px' }}>
                                                            <Link to={`/staff/student/${a.id}`} className="flex-1 min-w-0">
                                                                <span className="block font-bold text-[13px] truncate">{a.studentName}</span>
                                                                <span className="block text-[11.5px]" style={{ color: 'var(--sub)' }}>{inr(f.d.balance)} left · {f.k === 'late' ? `${f.d.daysOverdue} days late` : `due ${dateLabel(f.d.due)}`}</span>
                                                            </Link>
                                                            <Contact name={a.studentName} phone={phoneOf(a)} size="sm"
                                                                message={`Dear Parent, a gentle reminder that ${inr(f.d.balance)} of ${a.studentName}'s fee is ${f.k === 'late' ? 'pending' : `due on ${dateLabel(f.d.due)}`}. – Unacademy Nashik`} />
                                                        </div>
                                                    ))}
                                                    {l.length > 6 && <p className="text-[12px]" style={{ color: 'var(--muted)' }}>and {l.length - 6} more</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {fees.late.length > 0 && (
                                    <Link to="/staff/recovery-desk" className="jb-act jb-act-soft mt-4">📞 {fees.late.length} late · {inr(fees.lateSum)} on the Recovery desk ›</Link>
                                )}
                            </Card>
                        )}

                        {v.unassigned.length > 0 && (
                            <Card title="Need a batch" sub="Admitted students with no batch" delay={200}>
                                <div className="space-y-2">
                                    {v.unassigned.slice(0, 8).map(a => (
                                        <Link key={a.id} to={`/staff/student/${a.id}`} className="flex items-center gap-3 jb-row" style={{ padding: '8px 10px', borderRadius: 12 }}>
                                            <Avatar name={a.studentName} size={30} />
                                            <span className="flex-1 min-w-0">
                                                <span className="block font-bold text-[13.5px] truncate">{a.studentName}</span>
                                                <span className="block text-[12px]" style={{ color: 'var(--muted)' }}>{programLabel(a.program)}{a.batchAssigned ? ` · "${a.batchAssigned}" not found` : ''}</span>
                                            </span>
                                        </Link>
                                    ))}
                                    {v.unassigned.length > 8 && <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>and {v.unassigned.length - 8} more</p>}
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BatchesHome;
