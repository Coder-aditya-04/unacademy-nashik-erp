// L5 · Recovery desk (design canvas board, approved 20 Nov 2026), and the
// phone layout P2 for the Recovery role (same screen, stacked).
// Recovery logs calls and promises only: it cannot record payments or change
// fees (Firestore rules allow just the recovery fields).
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { subscribeAdmissions, clearAdmissionsCache } from '../../services/cacheService';
import { buildRecoveryList, dueInfo } from '../../utils/recovery';
import { Seg, Card, Empty, Contact, Avatar, Count } from '../../components/j';
import { useToast } from '../../components/j/context';
import { inr, lakh, toMs, DAY, dayStart } from '../../components/j/util';
import { CENTRES, CENTRE_NAME, centreOf, paymentsOf, phoneOf, programLabel, dateLabel, ago } from '../j/data';

const AGES = [
    { id: 'ALL', label: 'All', test: () => true },
    { id: 'D1_7', label: '1–7 days', test: d => d.daysOverdue <= 7 },
    { id: 'D8_21', label: '8–21 days', test: d => d.daysOverdue >= 8 && d.daysOverdue <= 21 },
    { id: 'D22_45', label: '22–45 days', test: d => d.daysOverdue >= 22 && d.daysOverdue <= 45 },
    { id: 'D45', label: '45+ days', test: d => d.daysOverdue > 45 },
];
const OUTCOMES = [
    { id: 'PROMISED', e: '🤝', label: 'Promised', text: 'Called – will pay' },
    { id: 'PAID', e: '💰', label: 'Paid now', text: 'Paid (tell Accounts)' },
    { id: 'NOANSWER', e: '📵', label: 'No answer', text: 'Not reachable' },
    { id: 'MANAGER', e: '🧑‍💼', label: 'Needs Manager', text: 'Needs Manager' },
];
const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// A simple, explainable risk score from what we know.
const riskOf = (a, d) => {
    const calls = (a.recoveryTimeline || []);
    const missed = calls.filter(c => /not reachable|wrong number/i.test(c.outcome || '')).length;
    const paidPct = (Number(a.totalPaid) || 0) / Math.max(1, Number(a.amount) || 1);
    let r = Math.min(45, d.daysOverdue * 0.9) + (d.promiseBroken ? 20 : 0) + Math.min(20, missed * 7) + (paidPct < 0.3 ? 15 : paidPct < 0.6 ? 7 : 0);
    if (calls.some(c => /discontinue/i.test(c.outcome || ''))) r += 20;
    return Math.max(5, Math.min(98, Math.round(r)));
};
const whyOf = (a, d) => {
    const bits = [`${d.daysOverdue} days late`];
    if (d.promiseBroken) bits.push('missed a promise');
    const missed = (a.recoveryTimeline || []).filter(c => /not reachable/i.test(c.outcome || '')).length;
    if (missed) bits.push(`${missed} unanswered call${missed > 1 ? 's' : ''}`);
    const paidPct = Math.round(((Number(a.totalPaid) || 0) / Math.max(1, Number(a.amount) || 1)) * 100);
    bits.push(`${paidPct}% of the fee paid`);
    return bits.join(' · ');
};

const RiskGauge = ({ risk }) => {
    const level = risk >= 65 ? 2 : risk >= 40 ? 1 : 0;
    const ang = (-90 + (risk / 100) * 180) * Math.PI / 180;
    const nx = 100 + Math.sin(ang) * 62, ny = 100 - Math.cos(ang) * 62;
    const segs = [['var(--t-sage)', 0, 60], ['var(--t-butter)', 60, 120], ['var(--t-coral)', 120, 180]];
    const arc = (a0, a1) => {
        const p = (a) => { const r = (180 + a) * Math.PI / 180; return [100 + Math.cos(r) * 80, 100 + Math.sin(r) * 80]; };
        const [x0, y0] = p(a0 + 2), [x1, y1] = p(a1 - 2);
        return `M${x0} ${y0} A80 80 0 0 1 ${x1} ${y1}`;
    };
    return (
        <div className="relative w-[220px] mx-auto" role="img" aria-label={`Risk ${['low', 'medium', 'high'][level]}, score ${risk} of 100`}>
            <svg viewBox="0 0 200 112" width="100%" aria-hidden="true">
                {segs.map(([c, a0, a1]) => <path key={a0} d={arc(a0, a1)} fill="none" stroke={c} strokeWidth="20" strokeLinecap="round" />)}
                <line x1="100" y1="100" x2={nx} y2={ny} style={{ stroke: 'var(--ink)', transition: 'all .8s cubic-bezier(.34,1.56,.64,1)' }} strokeWidth="4" strokeLinecap="round" />
                <circle cx="100" cy="100" r="8" style={{ fill: 'var(--ink)' }} />
            </svg>
            <p className="text-center -mt-1 text-[13px] font-bold" style={{ color: ['var(--ok)', 'var(--butter-ink)', 'var(--late)'][level] }}>
                {['Low', 'Medium', 'High'][level]} chance this stays unpaid · {risk}
            </p>
        </div>
    );
};

const Dossier = ({ a, userProfile, onSaved }) => {
    const toast = useToast();
    const d = dueInfo(a);
    const [outcome, setOutcome] = useState(null);
    const [payBy, setPayBy] = useState(a.promisedDate || ymd(Date.now() + 3 * DAY));
    const [amount, setAmount] = useState(a.promisedAmount || '');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => { setOutcome(null); setNote(''); setPayBy(a.promisedDate || ymd(Date.now() + 3 * DAY)); setAmount(a.promisedAmount || ''); }, [a.id, a.promisedDate, a.promisedAmount]);
    if (!d) return <Card><Empty>Nothing due for this student.</Empty></Card>;
    const risk = riskOf(a, d);
    const pays = paymentsOf(a).sort((x, y) => x.ms - y.ms);
    const history = [...(a.recoveryTimeline || [])].reverse().slice(0, 4);

    const save = async () => {
        if (!outcome) return;
        setSaving(true);
        try {
            const o = OUTCOMES.find(x => x.id === outcome);
            const entry = { type: 'CALL', outcome: o.text, message: note.trim(), date: Timestamp.now(), by: userProfile?.name || 'Recovery', byUid: userProfile?.uid || null };
            const update = { recoveryTimeline: arrayUnion(entry), lastContactAt: Timestamp.now() };
            if (outcome === 'PROMISED' && payBy) {
                update.promisedDate = payBy;
                update.promisedAmount = Number(amount) || null;
                update.nextPaymentDate = payBy;
                update.reminderSetBy = userProfile?.name || 'Recovery';
            }
            await updateDoc(doc(db, 'admissions', a.id), update);
            clearAdmissionsCache();
            toast(o.e, outcome === 'PROMISED' ? `Promise saved: pay by ${dateLabel(new Date(payBy).getTime())}` : `${o.label} saved for ${a.studentName}`);
            onSaved?.();
        } catch (err) {
            console.error(err);
            toast('⚠️', 'Could not save. Check the connection and try again.');
        } finally { setSaving(false); }
    };

    return (
        <Card key={a.id} className="!p-5">
            <div className="flex items-center gap-3">
                <Avatar name={a.studentName} size={46} />
                <Link to={`/staff/student/${a.id}`} className="flex-1 min-w-0">
                    <p className="text-[18px] font-extrabold truncate">{a.studentName}</p>
                    <p className="text-[12.5px] truncate" style={{ color: 'var(--muted)' }}>{programLabel(a.program)} · {CENTRE_NAME[centreOf(a)]}{a.rollNumber ? ` · ${a.rollNumber}` : ''}</p>
                </Link>
            </div>
            <div className="flex items-end justify-between mt-4">
                <div><p className="text-[12px]" style={{ color: 'var(--muted)' }}>Overdue</p><p className="text-[30px] font-extrabold leading-none">{inr(d.balance)}</p></div>
                <span className="jb-tag jb-tag-late">{d.daysOverdue} days late</span>
            </div>
            <div className="mt-3"><RiskGauge risk={risk} /></div>
            <p className="text-[12.5px] text-center mt-1" style={{ color: 'var(--muted)' }}>{whyOf(a, d)}</p>

            <p className="mt-4 mb-1.5 text-[12px] font-bold tracking-[.06em] uppercase" style={{ color: 'var(--muted)' }}>Every payment so far</p>
            <div className="flex flex-wrap gap-1.5">
                {pays.map((p, i) => <span key={i} title={`${inr(p.amount)} · ${dateLabel(p.ms)}`} className="jb-pop h-7 px-2 rounded-lg text-[11px] font-bold flex items-center" style={{ background: 'var(--t-sage)', animationDelay: `${i * 60}ms` }}>✓ {dateLabel(p.ms)}</span>)}
                <span className="jb-pop h-7 px-2 rounded-lg text-[11px] font-bold flex items-center" style={{ background: 'var(--t-coral)', animationDelay: `${pays.length * 60}ms` }}>Due {dateLabel(d.due)}</span>
            </div>

            <div className="flex gap-2 mt-4">
                <Contact name={a.studentName} phone={phoneOf(a)} size="lg"
                    message={`Namaste, a reminder from Unacademy Nashik: ${a.studentName}'s fee of ${inr(d.balance)} is pending since ${dateLabel(d.due)}. Please pay at the earliest or call us. Thank you.`} />
                <a href={`tel:+91${String(phoneOf(a)).replace(/\D/g, '').slice(-10)}`} className="jb-act jb-act-ink flex-1 justify-center">📞 Call parent</a>
            </div>

            <p className="mt-5 mb-2 text-[14px] font-extrabold">How did the call go?</p>
            <div className="grid grid-cols-2 gap-2">
                {OUTCOMES.map(o => (
                    <button key={o.id} type="button" aria-pressed={outcome === o.id} onClick={() => setOutcome(o.id)}
                        className="jb-act justify-center !py-2.5" style={{ background: outcome === o.id ? 'var(--ink)' : 'var(--cream2)', color: outcome === o.id ? 'var(--on-ink)' : 'var(--ink)' }}>
                        <span aria-hidden="true">{o.e}</span>{o.label}
                    </button>
                ))}
            </div>
            {outcome === 'PROMISED' && (
                <div className="grid grid-cols-2 gap-2 mt-3 jb-rise">
                    <label className="text-[12px] font-semibold">Pay by<input type="date" value={payBy} min={ymd(Date.now())} onChange={e => setPayBy(e.target.value)} className="block w-full mt-1 px-2 py-2 rounded-xl border text-[14px]" /></label>
                    <label className="text-[12px] font-semibold">Amount (₹)<input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder={String(d.balance)} className="block w-full mt-1 px-2 py-2 rounded-xl border text-[14px]" /></label>
                </div>
            )}
            {outcome && (
                <div className="mt-3 jb-rise">
                    <label className="sr-only" htmlFor="rec-note">Note</label>
                    <textarea id="rec-note" rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder={outcome === 'PAID' ? 'Mode and reference, so Accounts can match it' : 'Short note (optional)'}
                        className="w-full px-3 py-2 rounded-xl border text-[14px]" />
                    <button type="button" className="jb-act jb-act-ink w-full justify-center !py-3 mt-2" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
                    {outcome === 'PAID' && <p className="text-[12px] mt-1.5" style={{ color: 'var(--muted)' }}>Only Accounts records the money. This note tells them to check it.</p>}
                </div>
            )}

            {history.length > 0 && (
                <>
                    <p className="mt-5 mb-1.5 text-[12px] font-bold tracking-[.06em] uppercase" style={{ color: 'var(--muted)' }}>Last calls</p>
                    <ul className="flex flex-col gap-1.5">
                        {history.map((h, i) => (
                            <li key={i} className="text-[12.5px]"><b>{h.outcome}</b>{h.message ? ` · ${h.message}` : ''} <span style={{ color: 'var(--muted)' }}>· {ago(toMs(h.date))} · {h.by}</span></li>
                        ))}
                    </ul>
                </>
            )}
        </Card>
    );
};

const RecoveryDesk = ({ userProfile }) => {
    const allCentres = userProfile?.role?.toUpperCase() === 'DIRECTOR';
    const scope = allCentres ? 'ALL' : (userProfile?.centerId || '');
    const [admissions, setAdmissions] = useState(null);
    const [centre, setCentre] = useState('ALL');
    const [age, setAge] = useState('ALL');
    const [search, setSearch] = useState('');
    const [selId, setSelId] = useState(null);
    const now = Date.now();

    useEffect(() => {
        if (!scope) { setAdmissions([]); return undefined; }
        return subscribeAdmissions(scope, (d) => setAdmissions(d || []), { allSessions: true });
    }, [scope]);

    const v = useMemo(() => {
        const list = (admissions || []).filter(a => (centre === 'ALL' || centreOf(a) === centre)
            && (!search || `${a.studentName} ${a.phone} ${a.parentPhone || ''} ${a.rollNumber || ''}`.toLowerCase().includes(search.toLowerCase())));
        const overdue = buildRecoveryList(list, 'ALL_OVERDUE', now).map(r => ({ ...r, risk: riskOf(r.a, r.d) }));
        const ageTest = AGES.find(x => x.id === age).test;
        const today = dayStart(now);
        const calledToday = (a) => (toMs(a.lastContactAt) || 0) >= today;
        const calls = overdue.filter(r => ageTest(r.d)).sort((x, y) => Number(calledToday(x.a)) - Number(calledToday(y.a)) || y.risk - x.risk || y.d.balance - x.d.balance);
        const left = overdue.filter(r => !calledToday(r.a)).length;
        const weekEnd = today + 7 * DAY;
        const promises = (admissions || []).filter(a => centre === 'ALL' || centreOf(a) === centre)
            .map(a => ({ a, d: dueInfo(a, now) })).filter(r => r.d?.promisedDate && r.d.promisedDate >= today - DAY && r.d.promisedDate < weekEnd)
            .sort((x, y) => x.d.promisedDate - y.d.promisedDate);
        const manager = overdue.filter(r => /needs manager|discontinue/i.test(r.d.lastNote?.outcome || ''));
        const ages = AGES.slice(1).map(g => { const rs = overdue.filter(r => g.test(r.d)); return { ...g, n: rs.length, amt: rs.reduce((x, r) => x + r.d.balance, 0) }; });
        return { overdue, calls, left, promises, manager, ages, total: overdue.reduce((x, r) => x + r.d.balance, 0), called: overdue.length - left, broken: overdue.filter(r => r.d.promiseBroken).length };
    }, [admissions, centre, age, search, now]);

    const sel = v.calls.find(r => r.a.id === selId) || v.calls[0] || null;
    const maxAge = Math.max(1, ...v.ages.map(g => g.amt));

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col 2xl:flex-row 2xl:items-end justify-between gap-4 jb-rise">
                <div>
                    <h2 className="jb-h text-[32px] sm:text-[40px] leading-tight">Recovery desk</h2>
                    <p className="jb-sub text-[14px] mt-1">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {allCentres ? (centre === 'ALL' ? 'all centres' : CENTRE_NAME[centre]) : CENTRE_NAME[scope] || scope}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {allCentres && <Seg label="Centre" options={CENTRES} value={centre} onChange={setCentre} />}
                    <label className="relative">
                        <span className="sr-only">Search</span>
                        <span aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px]">🔎</span>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, phone or roll no."
                            className="pl-10 pr-4 py-2.5 rounded-full text-[14px] w-[240px]" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }} />
                    </label>
                </div>
            </div>

            {admissions === null ? (
                <div className="flex flex-col gap-4" aria-busy="true"><div className="jb-grid4"><div className="jb-sk h-32" /><div className="jb-sk h-32" /><div className="jb-sk h-32" /><div className="jb-sk h-32" /></div><div className="jb-sk h-96" /></div>
            ) : (<>
                <div className="jb-grid4">
                    <div className="jb-rise flex flex-col rounded-[24px] p-5" style={{ background: 'var(--pine)', color: '#FFFFFF', minHeight: 140 }}>
                        <div className="flex justify-between"><span className="text-[13px] font-bold" style={{ color: '#C9D8BC' }}>Calls left today</span><span aria-hidden="true" className="text-[20px]">📞</span></div>
                        <p className="text-[40px] font-extrabold leading-none mt-2"><Count value={v.left} /></p>
                        <p className="text-[12.5px] mt-1" style={{ color: '#DCE8D2' }}>{v.called} done · oldest and biggest first</p>
                        <div className="h-2 rounded-full mt-auto overflow-hidden" style={{ background: 'rgba(255,255,255,.18)' }}>
                            <div className="jb-growx h-full rounded-full" style={{ width: `${v.overdue.length ? (v.called / v.overdue.length) * 100 : 100}%`, background: '#9FD3B0' }} />
                        </div>
                    </div>
                    <div className="jb-rise rounded-[24px] p-5" style={{ background: 'var(--t-coral)', animationDelay: '60ms' }}>
                        <div className="flex justify-between"><span className="text-[13px] font-bold">Overdue</span><span aria-hidden="true" className="text-[20px]">⏰</span></div>
                        <p className="text-[30px] font-extrabold mt-3"><Count value={v.total} format={lakh} /></p>
                        <p className="text-[12.5px]" style={{ color: 'var(--sub)' }}>{v.overdue.length} students</p>
                    </div>
                    <div className="jb-rise rounded-[24px] p-5" style={{ background: 'var(--t-sage)', animationDelay: '120ms' }}>
                        <div className="flex justify-between"><span className="text-[13px] font-bold">Promises this week</span><span aria-hidden="true" className="text-[20px]">🤝</span></div>
                        <p className="text-[30px] font-extrabold mt-3"><Count value={v.promises.length} /></p>
                        <p className="text-[12.5px]" style={{ color: 'var(--sub)' }}>{lakh(v.promises.reduce((x, r) => x + (Number(r.a.promisedAmount) || r.d.balance), 0))} promised</p>
                    </div>
                    <div className="jb-rise rounded-[24px] p-5" style={{ background: 'var(--t-butter)', animationDelay: '180ms' }}>
                        <div className="flex justify-between"><span className="text-[13px] font-bold">Broken promises</span><span aria-hidden="true" className="text-[20px]">💔</span></div>
                        <p className="text-[30px] font-extrabold mt-3"><Count value={v.broken} /></p>
                        <p className="text-[12.5px]" style={{ color: 'var(--sub)' }}>Call these first</p>
                    </div>
                </div>

                <div className="jb-grid21">
                    <div className="flex flex-col gap-4 min-w-0">
                        <Card title="Call list" sub="Not yet called today first, then highest risk" delay={120}
                            right={<Seg size="sm" label="Overdue by" value={age} onChange={setAge} pillBg="var(--panel)" className="!shadow-none !bg-[var(--cream2)] max-w-full overflow-x-auto"
                                options={AGES.map(g => ({ value: g.id, label: g.label }))} />}>
                            <ul className="flex flex-col gap-1" key={age + centre}>
                                {v.calls.length === 0 && <Empty>Nobody left in this group.</Empty>}
                                {v.calls.slice(0, 25).map((r, i) => {
                                    const on = sel && r.a.id === sel.a.id;
                                    const called = (toMs(r.a.lastContactAt) || 0) >= dayStart(now);
                                    return (
                                        <li key={r.a.id} className="jb-row jb-rise flex items-center gap-3 px-2.5 py-2.5 rounded-2xl cursor-pointer"
                                            style={{ animationDelay: `${Math.min(i, 10) * 35}ms`, background: on ? 'var(--cream)' : 'transparent', opacity: called ? .6 : 1 }}
                                            onClick={() => setSelId(r.a.id)}>
                                            <Avatar name={r.a.studentName} size={38} />
                                            <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setSelId(r.a.id)} aria-pressed={on}>
                                                <b className="text-[14px]">{r.a.studentName}</b>{called && <span className="ml-1.5 text-[11.5px] font-bold" style={{ color: 'var(--ok)' }}>✓ called</span>}
                                                <p className="text-[12px] truncate" style={{ color: 'var(--muted)' }}>{programLabel(r.a.program)} · {r.d.lastNote ? `${r.d.lastNote.outcome}` : 'not called yet'}</p>
                                            </button>
                                            <span className={`jb-tag ${r.d.daysOverdue > 21 ? 'jb-tag-late' : 'jb-tag-next'} hidden sm:inline-flex`}>{r.d.daysOverdue} d</span>
                                            <b className="text-[14.5px] min-w-[74px] text-right">{inr(r.d.balance)}</b>
                                            <Contact name={r.a.studentName} phone={phoneOf(r.a)} size="sm"
                                                message={`Namaste, a reminder from Unacademy Nashik: ${r.a.studentName}'s fee of ${inr(r.d.balance)} is pending. Please pay at the earliest or call us. Thank you.`} />
                                        </li>
                                    );
                                })}
                            </ul>
                        </Card>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <Card title="Overdue by age" sub="Click a bar to filter the call list" delay={200}>
                                <div className="flex flex-col gap-3">
                                    {v.ages.map((g, i) => (
                                        <button key={g.id} type="button" onClick={() => setAge(age === g.id ? 'ALL' : g.id)} aria-pressed={age === g.id} className="text-left">
                                            <div className="flex justify-between text-[13px] mb-1"><span className="font-semibold">{g.label} <span style={{ color: 'var(--muted)' }}>· {g.n}</span></span><b>{lakh(g.amt)}</b></div>
                                            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--track)' }}>
                                                <span className="jb-growx block h-full rounded-full" style={{ width: `${(g.amt / maxAge) * 100}%`, background: ['var(--sage2)', 'var(--t-butter)', 'var(--coral)', 'var(--late)'][i], opacity: age === 'ALL' || age === g.id ? 1 : .35, animationDelay: `${i * 70}ms` }} />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </Card>
                            <Card title="Promises this week" delay={260}>
                                {v.promises.length === 0 && <Empty emoji="🌿">No promises this week.</Empty>}
                                <ul className="flex flex-col gap-2">
                                    {v.promises.slice(0, 6).map(({ a, d }) => (
                                        <li key={a.id} className="flex items-center gap-2.5">
                                            <span className={`jb-tag ${d.promiseBroken ? 'jb-tag-late' : d.promiseToday ? 'jb-tag-ok' : 'jb-tag-soft'} w-[64px] justify-center`}>{d.promiseToday ? 'Today' : dateLabel(d.promisedDate)}</span>
                                            <button type="button" className="flex-1 min-w-0 text-left text-[13.5px] font-semibold truncate" onClick={() => setSelId(a.id)}>{a.studentName}</button>
                                            <b className="text-[13px]">{inr(Number(a.promisedAmount) || d.balance)}</b>
                                        </li>
                                    ))}
                                </ul>
                                {v.manager.length > 0 && (
                                    <div className="mt-4 rounded-2xl p-3" style={{ background: 'var(--latebg)' }}>
                                        <p className="text-[13px] font-bold" style={{ color: 'var(--late)' }}>🧑‍💼 Needs Manager · {v.manager.length}</p>
                                        <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>{v.manager.slice(0, 3).map(r => r.a.studentName).join(', ')}{v.manager.length > 3 ? '…' : ''}</p>
                                    </div>
                                )}
                            </Card>
                        </div>
                    </div>

                    <div className="min-w-0 lg:sticky lg:top-[84px]">
                        {sel ? <Dossier a={sel.a} userProfile={userProfile} /> : <Card><Empty>Nobody overdue. 🎉</Empty></Card>}
                    </div>
                </div>
            </>)}
        </div>
    );
};

export default RecoveryDesk;
