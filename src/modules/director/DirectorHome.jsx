// L1 · Director home (design canvas board, approved 20 Nov 2026).
// Same screen for the Manager, fixed to their own centre.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, query, where, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { subscribeAdmissions, subscribeLeads } from '../../services/cacheService';
import { processApproval } from '../../services/approvalService';
import { approveUser, rejectUser } from '../../services/userService';
import { Money, MoneyToggle } from '../../components/Money';
import { greetingFor } from '../../utils/greeting';
import { Seg, Gauge, Tile, Card, Empty, Contact, Avatar, Count } from '../../components/j';
import { useToast } from '../../components/j/context';
import { inr, lakh, DAY, dayStart } from '../../components/j/util';
import {
    CENTRES, CENTRE_NAME, CENTRE_TONE, centreOf, inCentre, isLive, paymentsOf, createdMs, rangeFor, inRange,
    collectedIn, sparkBuckets, overdueList, phoneOf, balanceOf, programLabel, ago,
} from '../j/data';
import { parseDay } from '../../utils/recovery';

const PERIODS = [{ value: 'TODAY', label: 'Today' }, { value: 'MONTH', label: 'This month' }, { value: 'SESSION', label: 'Session' }];
const DEFAULT_TARGET = { admissions: 60, collection: 3000000 };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// One ask in "Waiting for you": tints, then folds away after a short pause.
const Ask = ({ ask, onDecide }) => {
    const [done, setDone] = useState(null);
    const [busy, setBusy] = useState(false);
    const act = async (yes) => {
        if (busy) return;
        setBusy(true);
        const ok = await onDecide(ask, yes);
        if (ok) setDone(yes ? 'yes' : 'no'); else setBusy(false);
    };
    return (
        <div style={{ display: 'grid', gridTemplateRows: done ? '0fr' : '1fr', opacity: done ? 0 : 1, marginBottom: done ? 0 : 10,
            transition: 'grid-template-rows .45s cubic-bezier(.65,0,.35,1) .9s, opacity .3s ease .9s, margin .45s ease .9s' }}>
            <div style={{ overflow: 'hidden', minHeight: 0, borderRadius: 16, padding: 12, transition: 'background .3s ease',
                background: done === 'yes' ? 'var(--t-sage)' : done === 'no' ? 'var(--cream2)' : 'var(--cream)' }}>
                <div className="flex gap-3">
                    <span aria-hidden="true" className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px] shrink-0" style={{ background: ask.bg }}>{ask.emoji}</span>
                    <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold leading-snug">{ask.title}</p>
                        <p className="text-[12.5px] leading-snug mt-0.5" style={{ color: 'var(--muted)' }}>{ask.sub}</p>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-2.5">
                    {ask.phone && <Contact name={ask.who} phone={ask.phone} size="sm" who={ask.whoLabel || 'parent'} />}
                    <span className="flex-1" />
                    {done ? (
                        <span className="jb-tag jb-tag-ok jb-pop">{done === 'yes' ? '✅ Approved' : '↩️ Declined'}</span>
                    ) : (<>
                        <button type="button" className="jb-act jb-act-line" disabled={busy} onClick={() => act(false)}>Decline</button>
                        <button type="button" className="jb-act jb-act-ink" disabled={busy} onClick={() => act(true)}>{ask.yes || 'Approve'}</button>
                    </>)}
                </div>
            </div>
        </div>
    );
};

const DirectorHome = ({ userProfile, isManager, center, onTab }) => {
    const toast = useToast();
    const [centre, setCentre] = useState(isManager ? (center?.id || 'UN_COLLEGE') : 'ALL');
    const [period, setPeriod] = useState('MONTH');
    const [gaugeOf, setGaugeOf] = useState('admissions');
    const [pickDay, setPickDay] = useState(Math.min(5, Math.max(0, (new Date().getDay() + 6) % 7)));
    const [admissions, setAdmissions] = useState(null);
    const [leads, setLeads] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [pendingUsers, setPendingUsers] = useState([]);
    const [targets, setTargets] = useState({});
    const [editTarget, setEditTarget] = useState(false);
    const now = Date.now();

    useEffect(() => { if (isManager && center?.id) setCentre(center.id); }, [isManager, center?.id]);

    useEffect(() => {
        const sub = isManager ? (center?.id || 'UN_COLLEGE') : 'ALL';
        const u1 = subscribeAdmissions(sub, (d) => setAdmissions(d || []));
        const u2 = subscribeLeads(sub, (d) => setLeads(d || []));
        const u3 = onSnapshot(query(collection(db, 'approvals'), where('status', '==', 'PENDING')),
            (s) => setApprovals(s.docs.map(x => ({ id: x.id, ...x.data() }))), (e) => console.error('Approvals', e));
        const u4 = onSnapshot(query(collection(db, 'users'), where('verified', '==', false)),
            (s) => setPendingUsers(s.docs.map(x => ({ id: x.id, uid: x.id, ...x.data() }))), (e) => console.error('Pending users', e));
        const u5 = onSnapshot(doc(db, 'settings', 'monthly_targets'), (s) => setTargets(s.exists() ? s.data() : {}), () => {});
        return () => { u1?.(); u2?.(); u3(); u4(); u5(); };
    }, [isManager, center?.id]);

    const v = useMemo(() => {
        const all = (admissions || []).filter(a => inCentre(a, centre));
        const live = all.filter(isLive);
        const range = rangeFor(period, now);
        const month = rangeFor('MONTH', now);
        const buckets = sparkBuckets(period, now);
        const centreLeads = leads.filter(l => inCentre(l, centre));

        const collected = collectedIn(live, range);
        const prevRange = [range[0] - (range[1] - range[0]), range[0]];
        const prevCollected = collectedIn(live, prevRange);
        const newAdm = live.filter(a => inRange(createdMs(a), range));
        const waitingDocs = live.filter(a => a.status === 'PENDING_APPROVAL').length;
        const enq = centreLeads.filter(l => inRange(createdMs(l), range));
        const enqJoined = enq.filter(l => l.status === 'CONVERTED' || l.admissionId).length;
        const overdue = overdueList(live, now);
        const overdueSum = overdue.reduce((x, o) => x + o.d.balance, 0);

        const monthAdm = live.filter(a => inRange(createdMs(a), month)).length;
        const monthCol = collectedIn(live, month);
        const d = new Date(now);
        const daysIn = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const t = targets[centre] || {};
        const target = { admissions: Number(t.admissions) || DEFAULT_TARGET.admissions * (centre === 'ALL' ? 1 : 1 / 3), collection: Number(t.collection) || DEFAULT_TARGET.collection * (centre === 'ALL' ? 1 : 1 / 3) };

        // Fees due this week, Monday to Saturday.
        const monday = dayStart(now) - ((d.getDay() + 6) % 7) * DAY;
        const week = DAYS.map((label, i) => {
            const day = monday + i * DAY;
            const due = live.filter(a => balanceOf(a) > 100 && parseDay(a.nextPaymentDate) === day)
                .map(a => ({ a, amount: Number(a.nextInstallmentAmount) || balanceOf(a), tag: day < dayStart(now) ? 'late' : 'due' }));
            const paid = live.flatMap(a => paymentsOf(a).filter(p => p.ms >= day && p.ms < day + DAY && p.type !== 'Token / Booking').map(p => ({ a, amount: p.amount, tag: 'paid' })));
            const rows = [...paid, ...due];
            return { label, day, rows, total: rows.reduce((x, r) => x + r.amount, 0), today: day === dayStart(now) };
        });

        // Collection by centre (All view).
        const byCentre = ['UN_NASHIK_RD', 'UN_COLLEGE', 'PRAYAS'].map(c => ({ c, amount: collectedIn((admissions || []).filter(a => isLive(a) && centreOf(a) === c), range) }));

        // Counsellors by admissions this period.
        const board = {};
        newAdm.forEach(a => {
            const n = a.counsellorName || a.bookedBy || 'Front desk';
            board[n] = board[n] || { name: n, count: 0, amount: 0, centre: centreOf(a) };
            board[n].count += 1; board[n].amount += Number(a.totalPaid) || 0;
        });
        const leaders = Object.values(board).sort((x, y) => y.count - x.count || y.amount - x.amount).slice(0, 5);

        const risk = overdue.filter(o => o.d.daysOverdue >= 15 || o.d.promiseBroken).slice(0, 4);

        const feed = [
            ...live.flatMap(a => paymentsOf(a).filter(p => p.ms >= dayStart(now)).map(p => ({ ms: p.ms, e: '💰', t: `${inr(p.amount)} from ${a.studentName}` }))),
            ...live.filter(a => createdMs(a) >= dayStart(now)).map(a => ({ ms: createdMs(a), e: '🎓', t: `${a.studentName} joined ${programLabel(a.program)}` })),
        ].sort((x, y) => y.ms - x.ms).slice(0, 6);

        return {
            collected, prevCollected, newAdm: newAdm.length, waitingDocs, enq: enq.length, enqJoined, overdue, overdueSum,
            monthAdm, monthCol, pace: d.getDate() / daysIn, dayOf: d.getDate(), daysIn, target, week, byCentre, leaders, risk, feed,
            spark: {
                col: buckets.map(b => collectedIn(live, b)),
                adm: buckets.map(b => live.filter(a => inRange(createdMs(a), b)).length),
                enq: buckets.map(b => centreLeads.filter(l => inRange(createdMs(l), b)).length),
            },
        };
    }, [admissions, leads, centre, period, targets, now]);

    const asks = useMemo(() => {
        const list = approvals
            .filter(a => centre === 'ALL' || inCentre(a, centre))
            .filter(a => !isManager || Number(a.discountPercent || a.discountPercentage || 0) <= 70)
            .map(a => ({
                id: a.id, kind: 'discount', emoji: '🏷️', bg: 'var(--t-butter)', who: a.studentName,
                title: `Discount ${Number(a.discountPercent || 0)}% · ${a.studentName || 'Student'}`,
                sub: `${programLabel(a.program)} · ${inr(a.originalFee)} → ${inr(a.offeredFee)}. Asked by ${a.requestedBy || 'staff'}${a.createdAt?.seconds ? ', ' + ago(a.createdAt.seconds * 1000) : ''}.`,
            }));
        pendingUsers.filter(u => centre === 'ALL' || u.centerId === centre).forEach(u => list.push({
            id: u.uid, kind: 'user', emoji: '🪪', bg: 'var(--t-blue)', who: u.name, phone: u.phone, whoLabel: 'staff member', yes: 'Let in',
            title: `New staff login · ${u.name || u.email}`,
            sub: `${u.role || 'Staff'} at ${CENTRE_NAME[u.centerId] || 'a centre'} wants access to the ERP.`,
        }));
        return list;
    }, [approvals, pendingUsers, centre, isManager]);

    const decide = async (ask, yes) => {
        try {
            if (ask.kind === 'discount') {
                const r = await processApproval(ask.id, yes ? 'APPROVED' : 'REJECTED', userProfile?.name);
                if (!r.success) throw new Error('save failed');
            } else if (yes) {
                await approveUser(ask.id);
            } else {
                if (!window.confirm(`Decline ${ask.who || 'this person'}? Their sign-up request is deleted.`)) return false;
                await rejectUser(ask.id);
            }
            toast(yes ? '✅' : '↩️', yes ? `${ask.title.split(' · ')[0]} approved` : `${ask.title.split(' · ')[0]} declined`);
            return true;
        } catch (e) {
            console.error(e);
            toast('⚠️', 'Could not save. Check the connection and try again.');
            return false;
        }
    };

    const saveTarget = async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const admissionsT = Math.max(1, Math.round(Number(f.get('adm')) || 0));
        const collectionT = Math.max(1, Math.round(Number(f.get('col')) || 0));
        try {
            await setDoc(doc(db, 'settings', 'monthly_targets'), { [centre]: { admissions: admissionsT, collection: collectionT } }, { merge: true });
            setEditTarget(false);
            toast('🎯', 'Target saved');
        } catch (err) { console.error(err); toast('⚠️', 'Only the Director or Manager can change targets.'); }
    };

    const loading = admissions === null;
    const firstName = (userProfile?.name || 'there').split(' ')[0];
    const g = gaugeOf === 'admissions'
        ? { value: v.monthAdm, target: v.target.admissions, label: <><Count value={v.monthAdm} /></>, of: `of ${Math.round(v.target.admissions)} admissions` }
        : { value: v.monthCol, target: v.target.collection, label: <Money value={v.monthCol} format={lakh} />, of: `of ${lakh(v.target.collection)} collected` };
    const expected = g.target * v.pace;
    const ahead = g.value >= expected;
    const behind = gaugeOf === 'admissions' ? `${Math.ceil(expected - g.value)} admissions` : lakh(expected - g.value);
    const growth = v.prevCollected > 0 ? Math.round(((v.collected - v.prevCollected) / v.prevCollected) * 100) : null;
    const pick = v.week[pickDay];
    const centreTotal = v.byCentre.reduce((x, c) => x + c.amount, 0) || 1;
    const maxLead = Math.max(1, ...v.leaders.map(l => l.count));
    const leadTarget = Math.max(1, Math.round(v.target.admissions / Math.max(3, v.leaders.length)));
    const periodWord = { TODAY: 'today', MONTH: 'this month', SESSION: 'this session' }[period];

    return (
        <div className="flex flex-col gap-5">
            {/* Greeting and filters */}
            <div className="flex flex-col 2xl:flex-row 2xl:items-end justify-between gap-4 jb-rise">
                <div>
                    <h2 className="jb-h text-[30px] sm:text-[44px] leading-[1.05]">{greetingFor(new Date())}, {firstName} <span aria-hidden="true">👋</span></h2>
                    <p className="jb-sub text-[14px] mt-1.5">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · day {v.dayOf} of {v.daysIn} · {centre === 'ALL' ? 'all three centres' : CENTRE_NAME[centre]}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {!isManager && <Seg label="Centre" options={CENTRES} value={centre} onChange={setCentre} />}
                    <Seg label="Period" options={PERIODS} value={period} onChange={setPeriod} pillBg="var(--ink)" onInk="var(--on-ink)" />
                    <MoneyToggle />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
                    <div className="jb-grid21"><div className="jb-sk h-[330px]" /><div className="jb-sk h-[330px]" /></div>
                    <div className="jb-sk h-[260px]" />
                </div>
            ) : (<>
                <div className="grid gap-4 xl:grid-cols-3">
                    <div className="xl:col-span-2 flex flex-col gap-4 min-w-0">
                        <div className="grid gap-4 lg:grid-cols-2">
                            {/* Monthly target gauge */}
                            <Card title="Monthly target" right={
                                <Seg size="sm" label="Target for" value={gaugeOf} onChange={setGaugeOf}
                                    options={[{ value: 'admissions', label: 'Admissions' }, { value: 'collection', label: 'Collection' }]}
                                    pillBg="var(--panel)" className="!shadow-none !bg-[var(--cream2)] shrink-0" />
                            }>
                                <Gauge value={g.value} target={g.target} pace={v.pace} color={ahead ? 'var(--ok)' : 'var(--coral)'}>
                                    <div className="text-[40px] font-extrabold leading-none tracking-[-0.03em]">{g.label}</div>
                                    <div className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>{g.of}</div>
                                </Gauge>
                                <div className="text-center mt-3">
                                    <span className={`jb-tag ${ahead ? 'jb-tag-ok' : 'jb-tag-late'}`}>{ahead ? '🚀 Ahead of plan' : `⏳ Behind plan by ${behind}`}</span>
                                    <p className="text-[12.5px] mt-2" style={{ color: 'var(--muted)' }}>
                                        Black mark = where we should be by today ·{' '}
                                        {!isManager || centre !== 'ALL'
                                            ? <button type="button" className="underline font-semibold" onClick={() => setEditTarget(t => !t)}>{editTarget ? 'Close' : 'Set target'}</button>
                                            : null}
                                    </p>
                                    {editTarget && (
                                        <form onSubmit={saveTarget} className="mt-3 flex flex-wrap items-end justify-center gap-2 text-left jb-rise">
                                            <label className="text-[12px] font-semibold">Admissions
                                                <input name="adm" type="number" min="1" defaultValue={Math.round(v.target.admissions)} className="block w-24 mt-1 px-2 py-1.5 rounded-lg border text-[14px]" />
                                            </label>
                                            <label className="text-[12px] font-semibold">Collection (₹)
                                                <input name="col" type="number" min="1" step="1000" defaultValue={Math.round(v.target.collection)} className="block w-32 mt-1 px-2 py-1.5 rounded-lg border text-[14px]" />
                                            </label>
                                            <button type="submit" className="jb-act jb-act-ink">Save</button>
                                        </form>
                                    )}
                                </div>
                            </Card>
                            <div className="grid grid-cols-2 gap-4">
                                <Tile size="sm" tone="sage" title="Collected" emoji="💰" delay={60} spark={v.spark.col}
                                    value={<Money value={v.collected} animate />}
                                    sub={growth == null ? `Fees received ${periodWord}` : `${growth >= 0 ? '▲' : '▼'} ${Math.abs(growth)}% on the period before`} />
                                <Tile size="sm" tone="butter" title="New admissions" emoji="🎓" delay={120} spark={v.spark.adm}
                                    value={<Count value={v.newAdm} />} sub={`${v.waitingDocs} waiting for Accounts`} />
                                <Tile size="sm" tone="blue" title="Enquiries" emoji="📞" delay={180} spark={v.spark.enq}
                                    value={<Count value={v.enq} />} sub={v.enq ? `${Math.round((v.enqJoined / v.enq) * 100)}% joined` : `None ${periodWord}`} />
                                <Tile size="sm" tone="coral" title="Overdue" emoji="⏰" delay={240}
                                    value={<Money value={v.overdueSum} animate />}
                                    sub={v.overdue.length ? `${v.overdue.length} students, oldest ${v.overdue[0].d.daysOverdue} days` : 'Nobody is late 🎉'} />
                            </div>
                        </div>

                        {/* Fees due this week */}
                        <Card title="Fees due this week" sub="Click a day to see who pays" delay={120}
                            right={<p className="text-[13px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>Week total <b className="text-[17px]" style={{ color: 'var(--ink)' }}><Money value={v.week.reduce((x, w) => x + w.total, 0)} format={lakh} /></b></p>}>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {v.week.map((w, i) => {
                                    const on = i === pickDay;
                                    return (
                                        <button key={w.label} type="button" onClick={() => setPickDay(i)} aria-pressed={on}
                                            className="text-left rounded-[18px] p-3 flex flex-col gap-1.5 transition-colors duration-300"
                                            style={{ background: on ? 'var(--ink)' : 'var(--cream)', color: on ? 'var(--on-ink)' : 'var(--ink)' }}>
                                            <span className="text-[12px] font-bold opacity-80">{w.today ? 'Today' : w.label}</span>
                                            <span className="text-[16px] font-extrabold"><Money value={w.total} format={lakh} /></span>
                                            <span className="text-[11.5px] opacity-75">{w.rows.length} {w.rows.length === 1 ? 'family' : 'families'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <ul className="mt-4 flex flex-col gap-1.5" key={pickDay}>
                                {pick.rows.length === 0 && <Empty emoji="🌿">Nothing due on this day.</Empty>}
                                {pick.rows.slice(0, 5).map((r, i) => (
                                    <li key={r.a.id + r.tag + i} className="jb-row jb-rise flex items-center gap-3 px-3 py-2 rounded-2xl" style={{ animationDelay: `${i * 40}ms` }}>
                                        <Avatar name={r.a.studentName} size={34} />
                                        <Link to={`/staff/student/${r.a.id}`} className="min-w-0 flex-1">
                                            <p className="text-[14px] font-bold truncate">{r.a.studentName}</p>
                                            <p className="text-[12px] truncate" style={{ color: 'var(--muted)' }}>{programLabel(r.a.program)} · {CENTRE_NAME[centreOf(r.a)]}</p>
                                        </Link>
                                        <span className="text-[14px] font-bold"><Money value={r.amount} /></span>
                                        <span className={`jb-tag ${r.tag === 'paid' ? 'jb-tag-ok' : r.tag === 'late' ? 'jb-tag-late' : 'jb-tag-next'}`}>{r.tag === 'paid' ? 'Paid' : r.tag === 'late' ? 'Late' : 'Due'}</span>
                                        {r.tag !== 'paid' && <Contact name={r.a.studentName} phone={phoneOf(r.a)} size="sm"
                                            message={`Namaste, a gentle reminder from Unacademy Nashik: ${r.a.studentName}'s fee instalment of ${inr(r.amount)} is due. Thank you.`} />}
                                    </li>
                                ))}
                            </ul>
                            {pick.rows.length > 5 && <p className="text-[12.5px] mt-2 text-center" style={{ color: 'var(--muted)' }}>+{pick.rows.length - 5} more on this day</p>}
                        </Card>
                    </div>

                    {/* Right column */}
                    <div className="flex flex-col gap-4 min-w-0">
                        <Card title="Waiting for you" delay={90}
                            right={<span className={`jb-tag ${asks.length ? 'jb-tag-late' : 'jb-tag-ok'}`}>{asks.length} open</span>}>
                            {asks.length === 0 && <Empty>All clear for today.</Empty>}
                            {asks.slice(0, 6).map(a => <Ask key={a.kind + a.id} ask={a} onDecide={decide} />)}
                            {asks.length > 6 && <p className="text-[12.5px] text-center" style={{ color: 'var(--muted)' }}>+{asks.length - 6} more</p>}
                        </Card>
                        <Card title="Live today" delay={210} right={<span aria-hidden="true" className="jb-pulse w-2.5 h-2.5 rounded-full mt-2" style={{ background: 'var(--ok)' }} />}>
                            {v.feed.length === 0 && <Empty emoji="☕">Quiet so far today.</Empty>}
                            <ul className="flex flex-col gap-3">
                                {v.feed.map((f, i) => (
                                    <li key={i} className="flex gap-2.5 text-[13px] jb-rise" style={{ animationDelay: `${i * 50}ms` }}>
                                        <span aria-hidden="true">{f.e}</span>
                                        <span className="flex-1 min-w-0">{f.t}</span>
                                        <span className="shrink-0" style={{ color: 'var(--muted)' }}>{ago(f.ms, now)}</span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                        {onTab && (
                            <div className="flex flex-wrap gap-2 jb-rise" style={{ animationDelay: '260ms' }}>
                                {!isManager && <button type="button" className="jb-act jb-act-line" onClick={() => onTab('COMPARE')}>⚖️ Compare centres</button>}
                                <button type="button" className="jb-act jb-act-line" onClick={() => onTab('TEAM')}>👥 My team</button>
                                {!isManager && <button type="button" className="jb-act jb-act-line" onClick={() => onTab('DB_TOOLS')}>🛠️ Database tools</button>}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    {centre === 'ALL' && (
                        <Card title="Collection by centre" sub={<><Money value={centreTotal} format={lakh} /> collected {periodWord}</>} delay={150}>
                            <div className="flex h-4 rounded-full overflow-hidden gap-[3px]" role="img"
                                aria-label={v.byCentre.map(c => `${CENTRE_NAME[c.c]} ${Math.round((c.amount / centreTotal) * 100)}%`).join(', ')}>
                                {v.byCentre.map((c, i) => (
                                    <span key={c.c} className="jb-growx h-full" style={{ width: `${(c.amount / centreTotal) * 100}%`, background: CENTRE_TONE[c.c], animationDelay: `${i * 80}ms` }} />
                                ))}
                            </div>
                            <ul className="mt-3 flex flex-col">
                                {v.byCentre.map((c, i) => (
                                    <li key={c.c} style={{ borderTop: i ? '1px solid var(--track)' : 'none' }}>
                                        <button type="button" onClick={() => setCentre(c.c)} className="w-full flex items-center gap-2.5 py-2.5 text-[13.5px] text-left">
                                        <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ background: CENTRE_TONE[c.c] }} />
                                        <span className="flex-1 font-semibold">{CENTRE_NAME[c.c]}</span>
                                        <span className="w-12 text-right tabular-nums" style={{ color: 'var(--muted)' }}>{Math.round((c.amount / centreTotal) * 100)}%</span>
                                        <b className="w-20 text-right"><Money value={c.amount} format={lakh} /></b>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}
                    <Card title="Counsellors this month" right={<span className="text-[12.5px] text-right" style={{ color: 'var(--muted)' }}>admissions vs target</span>} delay={200}>
                        {v.leaders.length === 0 && <Empty emoji="🌱">No admissions {periodWord} yet.</Empty>}
                        <ol className="flex flex-col gap-3.5">
                            {v.leaders.map((l, i) => {
                                const top = Math.max(maxLead, leadTarget) * 1.15;
                                return (
                                    <li key={l.name}>
                                        <div className="flex justify-between gap-2 text-[13.5px]">
                                            <span className="truncate"><b>{i + 1}. {l.name}</b>{l.centre ? <span style={{ color: 'var(--sub)' }}> · {CENTRE_NAME[l.centre]}</span> : null}</span>
                                            <b className="tabular-nums whitespace-nowrap">{l.count} / {leadTarget}</b>
                                        </div>
                                        <div className="relative h-2.5 rounded-full mt-1.5" style={{ background: 'var(--track)' }}>
                                            <div className="jb-growx h-full rounded-full" style={{ width: `${(l.count / top) * 100}%`, background: l.count >= leadTarget ? 'var(--ok)' : '#E0B43C', animationDelay: `${i * 80}ms` }} />
                                            <span aria-hidden="true" className="absolute -top-1 -bottom-1 w-[3px] rounded" style={{ left: `${(leadTarget / top) * 100}%`, background: 'var(--ink)' }} />
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </Card>
                    <Card title="Students at risk" sub="Flagged before they drop out" delay={240}
                        right={<Link to="/staff/recovery-desk" className="jb-act jb-act-soft !py-1.5">Recovery ›</Link>}>
                        {v.risk.length === 0 && <Empty>Nobody at risk right now.</Empty>}
                        <ul className="flex flex-col gap-2">
                            {v.risk.map(({ a, d }) => (
                                <li key={a.id}>
                                    <Link to={`/staff/student/${a.id}`} className="jb-lift flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--cream)' }}>
                                        <span aria-hidden="true" className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-[18px]" style={{ background: d.promiseBroken ? 'var(--t-butter)' : 'var(--t-coral)' }}>{d.promiseBroken ? '🤝' : '💸'}</span>
                                        <span className="min-w-0 flex-1">
                                            <b className="text-[14px] block truncate">{a.studentName} · {programLabel(a.program)}</b>
                                            <span className="text-[12.5px] block truncate" style={{ color: 'var(--sub)' }}>Fee {d.daysOverdue} days late · <Money value={d.balance} />{d.promiseBroken ? ' · promise missed' : ''}</span>
                                        </span>
                                        <span aria-hidden="true" style={{ color: 'var(--muted)' }}>›</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>
            </>)}
        </div>
    );
};

export default DirectorHome;
