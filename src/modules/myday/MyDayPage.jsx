// L6 · Plan my day (design canvas board, 20 Nov 2026), for every role.
// One plan per person per day in users/{uid}/planner/{YYYY-MM-DD} (only the
// owner can read or write it). Older items ({ text, time }) still show.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribePlanner, savePlanner } from '../../services/plannerService';
import { subscribeAdmissions, subscribeLeads } from '../../services/cacheService';
import { Card, Empty, Contact, Seg } from '../../components/j';
import { useToast } from '../../components/j/context';
import { lakh, DAY, dayStart } from '../../components/j/util';
import { normaliseRole, ROLE_LABEL } from '../../utils/navItems';
import { isLive, collectedIn, rangeFor, createdMs, inRange, overdueList, inCentre } from '../j/data';
import { toMs } from '../../components/j/util';

const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const toMin = (t) => { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };
const hm = (m) => { const h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const TYPE_BG = { call: 'var(--t-sage)', money: 'var(--t-butter)', meet: 'var(--t-blue)', field: 'var(--t-coral)', class: 'var(--t-lilac)' };

// Quick adds per role: [emoji, label, title, type, minutes].
const QUICK = {
    DIRECTOR: [['🧑‍💼', 'Meeting', 'Meeting with centre heads', 'meet', 45], ['🏫', 'Centre visit', 'Visit a centre', 'field', 60], ['✅', 'Approvals', 'Clear pending approvals', 'money', 30], ['📞', 'Call back', 'Call back a parent', 'call', 15]],
    MANAGER: [['💰', 'Collection', "Check yesterday's collection", 'money', 15], ['🪑', 'Seats', 'Review seats in new batches', 'class', 20], ['📣', 'Campaigns', 'Review campaign results', 'meet', 20], ['📞', 'Call back', 'Call back a parent', 'call', 15]],
    COUNSELLOR: [['📞', 'Call back', 'Call back a lead', 'call', 15], ['🧮', 'Fee quote', 'Send a fee quote', 'money', 15], ['🏫', 'Demo class', 'Book a demo class', 'class', 30], ['🤝', 'Walk-in', 'Meet a walk-in', 'meet', 30]],
    ACCOUNTANT: [['🧾', 'Verify', 'Verify payments', 'money', 30], ['🏦', 'Bank', 'Bank deposit', 'field', 45], ['↩️', 'Refund', 'Pay a refund', 'money', 15], ['📒', 'Day book', 'Close the day book', 'money', 30]],
    RECOVERY: [['📞', 'Calls', 'Call overdue parents', 'call', 60], ['🏠', 'Home visit', 'Home visit', 'field', 60], ['💬', 'Reminders', 'Send WhatsApp reminders', 'call', 15], ['🧑‍💼', 'Escalate', 'Talk to the Manager', 'meet', 15]],
    BDE: [['🏫', 'School visit', 'School visit', 'field', 60], ['🎤', 'Seminar', 'Seminar', 'field', 60], ['📞', 'Call', 'Call a principal', 'call', 10], ['📝', 'Leads', 'Upload leads', 'meet', 20]],
    FRONT_DESK: [['🤝', 'Walk-ins', 'Walk-ins at the desk', 'meet', 60], ['📞', 'Call', 'Call a parent', 'call', 10], ['🎫', 'Token', 'Take a token payment', 'money', 15], ['📋', 'Visitors', 'Update the visitor list', 'meet', 15]],
};

const normal = (i) => ({ id: i.id, title: i.title || i.text || 'Task', sub: i.sub || '', time: i.time || null, mins: Number(i.mins) || 30,
    emoji: i.emoji || '📌', type: i.type || 'meet', done: !!i.done, contact: i.contact || null, by: i.by || '', from: i.from || '' });

const Ring = ({ pct }) => {
    const r = 54, c = 2 * Math.PI * r;
    return (
        <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="66" cy="66" r={r} fill="none" style={{ stroke: 'var(--track)' }} strokeWidth="14" />
            {pct > 0 && <circle cx="66" cy="66" r={r} fill="none" stroke="var(--ok)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} style={{ transition: 'stroke-dasharray .8s cubic-bezier(.22,1,.36,1)' }} />}
        </svg>
    );
};

// Work numbers for the role, from ERP data.
const useTargets = (role, userProfile) => {
    const [adm, setAdm] = useState([]);
    const [leads, setLeads] = useState([]);
    const scope = role === 'DIRECTOR' ? 'ALL' : (userProfile?.centerId || 'ALL');
    useEffect(() => {
        if (!['DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'RECOVERY', 'COUNSELLOR'].includes(role)) return undefined;
        return subscribeAdmissions(scope, (d) => setAdm(d || []));
    }, [role, scope]);
    useEffect(() => {
        if (!['DIRECTOR', 'MANAGER', 'COUNSELLOR', 'BDE'].includes(role)) return undefined;
        return subscribeLeads(scope, (d) => setLeads(d || []));
    }, [role, scope]);
    return useMemo(() => {
        const live = adm.filter(a => isLive(a) && inCentre(a, scope));
        const today = rangeFor('TODAY'), month = rangeFor('MONTH');
        const t = ymd(Date.now());
        const mine = (l) => l.assignedTo === userProfile?.uid;
        const touchedToday = (l) => (l.timeline || []).some(x => (toMs(x.date) || 0) >= today[0] && (x.byId === userProfile?.uid || x.by === userProfile?.name));
        const overdue = overdueList(live);
        switch (role) {
            case 'DIRECTOR': case 'MANAGER': return [
                ['Fees in today', lakh(collectedIn(live, today))],
                ['Admissions this month', String(live.filter(a => inRange(createdMs(a), month)).length)],
                ['Waiting for Accounts', String(live.filter(a => a.status === 'PENDING_APPROVAL' || a.status === 'TOKEN_PAID').length)],
            ];
            case 'COUNSELLOR': return [
                ['Leads touched today', String(leads.filter(l => mine(l) && touchedToday(l)).length)],
                ['Follow-ups due', String(leads.filter(l => mine(l) && l.nextFollowUp && l.nextFollowUp <= t && !['CONVERTED', 'NOT_INTERESTED'].includes(l.status)).length)],
                ['My admissions this month', String(live.filter(a => a.counsellorId === userProfile?.uid && inRange(createdMs(a), month)).length)],
            ];
            case 'ACCOUNTANT': return [
                ['Payments to verify', String(live.filter(a => ['TOKEN_PAID', 'PENDING_APPROVAL'].includes(a.status)).length)],
                ['Fees in today', lakh(collectedIn(live, today))],
                ['Fees this month', lakh(collectedIn(live, month))],
            ];
            case 'RECOVERY': return [
                ['Parents to call', String(overdue.filter(o => (toMs(o.a.lastContactAt) || 0) < today[0]).length)],
                ['Called today', String(overdue.filter(o => (toMs(o.a.lastContactAt) || 0) >= today[0]).length)],
                ['Overdue', lakh(overdue.reduce((x, o) => x + o.d.balance, 0))],
            ];
            case 'BDE': return [['Leads added today', String(leads.filter(l => inRange(createdMs(l), today) && (l.createdBy === userProfile?.uid || l.bdeName === userProfile?.name)).length)]];
            default: return [];
        }
    }, [adm, leads, role, scope, userProfile?.uid, userProfile?.name]);
};

const MyDayPage = ({ userProfile }) => {
    const toast = useToast();
    const role = normaliseRole(userProfile?.role);
    const uid = userProfile?.uid;
    const todayMs = dayStart();
    const monday = todayMs - ((new Date().getDay() + 6) % 7) * DAY;
    const [day, setDay] = useState(todayMs);
    const [items, setItems] = useState([]);
    const [yest, setYest] = useState([]);
    const [nowMin, setNowMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
    const [text, setText] = useState('');
    const [time, setTime] = useState('');
    const [fresh, setFresh] = useState(null);
    const targets = useTargets(role, userProfile);
    const inputRef = useRef(null);

    const isToday = day === todayMs, past = day < todayMs, sunday = new Date(day).getDay() === 0;
    useEffect(() => (uid ? subscribePlanner(uid, ymd(day), (x) => setItems(x.map(normal))) : undefined), [uid, day]);
    useEffect(() => (uid ? subscribePlanner(uid, ymd(todayMs - DAY), (x) => setYest(x.map(normal))) : undefined), [uid, todayMs]);
    useEffect(() => { const t = setInterval(() => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()); }, 60000); return () => clearInterval(t); }, []);

    const sorted = useMemo(() => [...items].sort((a, b) => (toMin(a.time) ?? 9999) - (toMin(b.time) ?? 9999)), [items]);
    const done = items.filter(i => i.done).length;
    const leftover = isToday ? yest.filter(i => !i.done && !items.some(x => x.from === i.id)) : [];

    const save = (next) => {
        setItems(next);
        savePlanner(uid, ymd(day), next).catch(err => { console.error(err); toast('⚠️', 'Could not save the plan.'); });
    };
    const nextSlot = (mins) => {
        const end = items.reduce((m, i) => { const s = toMin(i.time); return s == null ? m : Math.max(m, s + i.mins); }, 9 * 60);
        const start = Math.max(isToday ? Math.ceil((nowMin + 5) / 15) * 15 : 9 * 60, Math.ceil(end / 15) * 15);
        return Math.min(start, 22 * 60 - mins);
    };
    const add = (it) => {
        const id = globalThis.crypto?.randomUUID?.() || String(Date.now());
        const mins = it.mins || 30;
        const t = it.time || fromMin(nextSlot(mins));
        save([...items, { ...normal({ ...it, id }), time: t, mins }]);
        setFresh(id);
        toast('📌', `Added at ${hm(toMin(t))}`);
    };
    const submit = (e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t) return;
        add({ title: t.slice(0, 200), time: time || null, mins: 30 });
        setText(''); setTime('');
        inputRef.current?.focus();
    };

    const DAYS = Array.from({ length: 7 }, (_, i) => monday + i * DAY);
    const pct = items.length ? done / items.length : 0;

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col 2xl:flex-row 2xl:items-end justify-between gap-4 jb-rise">
                <div>
                    <h2 className="jb-h text-[32px] sm:text-[40px] leading-tight">My day</h2>
                    <p className="jb-sub text-[14px] mt-1">{userProfile?.name} · {ROLE_LABEL[role] || role}</p>
                </div>
                <div className="flex gap-1.5 overflow-x-auto jb-scroll pb-1" role="tablist" aria-label="Day">
                    {DAYS.map(d => {
                        const on = d === day, dt = new Date(d), sun = dt.getDay() === 0;
                        return (
                            <button key={d} type="button" role="tab" aria-selected={on} disabled={sun} onClick={() => setDay(d)}
                                className="rounded-[18px] px-3.5 py-2 min-w-[62px] text-center transition-colors duration-300"
                                style={{ background: on ? 'var(--ink)' : 'var(--panel)', color: on ? 'var(--on-ink)' : 'var(--ink)', boxShadow: on ? 'none' : '0 0 0 1px var(--line)', opacity: sun ? .45 : 1 }}>
                                <span className="block text-[11.5px] font-bold opacity-75">{d === todayMs ? 'Today' : dt.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                                <span className="block text-[17px] font-extrabold">{dt.getDate()}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="jb-grid21">
                <Card title={isToday ? `Today · ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}` : new Date(day).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                    sub={sunday ? 'Sunday is off.' : past ? 'A past day. You can look but not change it.' : day > todayMs ? 'Planning ahead.' : `${done} of ${items.length} done`}
                    right={isToday ? <span className="jb-tag jb-tag-ok">Now · {hm(nowMin)}</span> : null}>
                    {!past && !sunday && (
                        <form onSubmit={submit} className="flex gap-2 mb-4">
                            <label className="sr-only" htmlFor="md-text">Task</label>
                            <input id="md-text" ref={inputRef} value={text} onChange={e => setText(e.target.value)} maxLength={200} placeholder="Add a task, e.g. Call Patil parents"
                                className="flex-1 min-w-0 px-3.5 py-2.5 rounded-full text-[14px]" style={{ background: 'var(--cream)', border: 0 }} />
                            <label className="sr-only" htmlFor="md-time">Time</label>
                            <input id="md-time" type="time" value={time} onChange={e => setTime(e.target.value)} className="w-[112px] px-2 py-2 rounded-full text-[14px]" style={{ background: 'var(--cream)', border: 0 }} />
                            <button type="submit" className="jb-act jb-act-ink">＋ Add</button>
                        </form>
                    )}
                    {sorted.length === 0 && <Empty emoji={sunday ? '🌿' : '📝'}>{sunday ? 'Rest day.' : past ? 'Nothing was planned.' : 'Nothing planned yet. Add a task or use a quick add.'}</Empty>}
                    <ol className="relative flex flex-col gap-2">
                        {sorted.map((i, k) => {
                            const s = toMin(i.time);
                            const late = isToday && !i.done && s != null && s + i.mins < nowMin;
                            const showNow = isToday && s != null && s <= nowMin && (k === sorted.length - 1 || (toMin(sorted[k + 1].time) ?? 9999) > nowMin);
                            return (
                                <React.Fragment key={i.id}>
                                    <li className={`jb-row flex items-center gap-3 p-2.5 rounded-2xl ${fresh === i.id ? 'jb-pop' : 'jb-rise'}`}
                                        style={{ background: i.done ? 'var(--cream)' : 'transparent', animationDelay: `${Math.min(k, 8) * 35}ms` }}>
                                        <span className="w-[68px] text-[12.5px] font-bold shrink-0" style={{ color: 'var(--muted)' }}>{s != null ? hm(s) : 'Any time'}</span>
                                        <span aria-hidden="true" className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px] shrink-0" style={{ background: TYPE_BG[i.type] || 'var(--cream2)' }}>{i.emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[14px] font-bold ${i.done ? 'line-through' : ''}`} style={{ color: i.done ? 'var(--muted)' : 'var(--ink)' }}>{i.title}</p>
                                            <p className="text-[12px] truncate" style={{ color: 'var(--muted)' }}>
                                                {[i.sub, `${i.mins} min`].filter(Boolean).join(' · ')}
                                                {i.by && <span className="jb-tag jb-tag-next ml-1.5 !py-0">{i.by}</span>}
                                                {i.from && <span className="jb-tag jb-tag-soft ml-1.5 !py-0">from yesterday</span>}
                                                {late && <span className="jb-tag jb-tag-late ml-1.5 !py-0">running late</span>}
                                            </p>
                                        </div>
                                        {i.contact?.phone && <Contact name={i.contact.who} phone={i.contact.phone} size="sm" />}
                                        <button type="button" disabled={past} onClick={() => save(items.map(x => x.id === i.id ? { ...x, done: !x.done } : x))}
                                            aria-pressed={i.done} aria-label={i.done ? `Mark ${i.title} not done` : `Mark ${i.title} done`}
                                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[14px] font-extrabold transition-colors"
                                            style={{ background: i.done ? 'var(--ok)' : 'var(--panel)', color: 'var(--on-ink)', boxShadow: i.done ? 'none' : 'inset 0 0 0 2px var(--track)' }}>
                                            {i.done && <span className="jb-pop">✓</span>}
                                        </button>
                                        {!past && (
                                            <button type="button" onClick={() => save(items.filter(x => x.id !== i.id))} aria-label={`Delete ${i.title}`} className="text-[13px] px-1 opacity-50 hover:opacity-100">✕</button>
                                        )}
                                    </li>
                                    {showNow && <li aria-hidden="true" className="flex items-center gap-2 text-[11.5px] font-bold" style={{ color: 'var(--late)' }}><span className="w-2 h-2 rounded-full jb-pulse" style={{ background: 'var(--late)' }} />Now<span className="flex-1 h-[2px] rounded" style={{ background: 'var(--late)', opacity: .5 }} /></li>}
                                </React.Fragment>
                            );
                        })}
                    </ol>
                </Card>

                <div className="flex flex-col gap-4">
                    <Card title="Progress" delay={80}>
                        <div className="flex items-center gap-5">
                            <div className="relative"><Ring pct={pct} /><div className="absolute inset-0 flex flex-col items-center justify-center"><b className="text-[26px]">{Math.round(pct * 100)}%</b><span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>done</span></div></div>
                            <div className="flex flex-col gap-2 flex-1 min-w-0">
                                {targets.map(([l, val]) => (
                                    <div key={l}><p className="text-[12px]" style={{ color: 'var(--muted)' }}>{l}</p><b className="text-[17px]">{val}</b></div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {!past && !sunday && (
                        <Card title="Quick add" sub="Goes into the next free slot" delay={140}>
                            <div className="grid grid-cols-2 gap-2">
                                {(QUICK[role] || QUICK.COUNSELLOR).map(([e, l, title, type, mins]) => (
                                    <button key={l} type="button" onClick={() => add({ title, emoji: e, type, mins })}
                                        className="jb-lift text-left rounded-2xl p-3" style={{ background: TYPE_BG[type] }}>
                                        <span aria-hidden="true" className="text-[18px]">{e}</span>
                                        <p className="text-[13.5px] font-bold mt-1">{l}</p>
                                        <p className="text-[11.5px]" style={{ color: 'var(--sub)' }}>{mins} min</p>
                                    </button>
                                ))}
                            </div>
                        </Card>
                    )}

                    {leftover.length > 0 && (
                        <Card title="Left from yesterday" delay={200}>
                            <ul className="flex flex-col gap-2">
                                {leftover.map(i => (
                                    <li key={i.id} className="flex items-center gap-2.5">
                                        <span aria-hidden="true">{i.emoji}</span>
                                        <span className="flex-1 min-w-0 text-[13.5px] font-semibold truncate">{i.title}</span>
                                        <button type="button" className="jb-act jb-act-soft !py-1.5" onClick={() => add({ ...i, time: null, done: false, from: i.id })}>Move to today</button>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}

                    <Card title="From your work" delay={260}>
                        <div className="flex flex-col gap-2">
                            {({
                                DIRECTOR: [['/staff/dashboard', 'Approvals and centre numbers'], ['/staff/recovery-desk', 'Recovery desk']],
                                MANAGER: [['/staff/recovery-desk', 'Recovery escalations'], ['/staff/batches', 'Seats in batches'], ['/staff/campaigns', 'Campaign results'], ['/staff/leads', 'Team pipeline']],
                                COUNSELLOR: [['/staff/leads', 'Follow-ups and pipeline'], ['/staff/calculator', 'Fee calculator']],
                                ACCOUNTANT: [['/staff/accounts', 'Payments to verify'], ['/staff/recovery', 'Fee recovery']],
                                RECOVERY: [['/staff/dashboard', "Today's call list"]],
                                BDE: [['/staff/leads', 'My leads']],
                                FRONT_DESK: [['/staff/front-desk', 'Front desk']],
                            }[role] || []).map(([to, l]) => (
                                <Link key={to} to={to} className="jb-lift flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-[13.5px] font-semibold" style={{ background: 'var(--cream)' }}>{l}<span aria-hidden="true">›</span></Link>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default MyDayPage;
