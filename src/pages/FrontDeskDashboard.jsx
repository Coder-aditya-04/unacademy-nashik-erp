// Front desk, board L11. The parent's phone comes first and is checked
// against the ERP straight away (strict one-number rule). A new family is
// saved as an enquiry, handed to a counsellor and put in today's walk-in
// queue; the counsellor sees them on the Admissions board.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { createLead } from '../services/leadService';
import { getCounsellorsByCenter } from '../services/userService';
import { getCachedAdmissions } from '../services/cacheService';
import { useHostelFees } from '../services/hostelService';
import { dueInfo } from '../utils/recovery';
import { Card, Tile, Count, Avatar, Contact, Empty } from '../components/j';
import { useToast } from '../components/j/context';
import { CENTRE_NAME, programLabel, phoneOf } from '../modules/j/data';

const CLASSES = ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12', 'Dropper'];
const INTEREST = ['NEET', 'JEE', 'Foundation', 'MHT-CET'];
const SOURCES = [['WALK_IN', 'Walk-in'], ['PHONE_CALL', 'Phone call'], ['WEBSITE', 'Website'], ['EVENT', 'School talk'], ['REFERRAL', 'Friend'], ['SOCIAL_MEDIA', 'Instagram']];
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ms = (v) => (v?.seconds ? v.seconds * 1000 : v?.toMillis ? v.toMillis() : v ? new Date(v).getTime() : 0);
const hhmm = (t) => (t ? new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');
const bare = { border: 0, boxShadow: 'none', background: 'transparent', outline: 'none' };

// Course code the rest of the ERP uses, from class + interest.
const courseFor = (cls, interest) => {
    const n = { 'Class 8': 8, 'Class 9': 9, 'Class 10': 10, 'Class 11': 11, 'Class 12': 12, Dropper: 12 }[cls];
    if (!n || !interest) return '';
    if (interest === 'Foundation' || n <= 10) return n <= 10 ? `FOUNDATION_${Math.min(10, Math.max(8, n))}` : '';
    if (interest === 'MHT-CET') return n === 11 ? 'MHT_CET_11' : 'MHT_CET_12';
    return `${interest}_${n === 11 ? '11' : '12'}`;
};

const Chips = ({ label, list, value, onPick, disabled, note }) => (
    <div>
        <span className="block text-[12.5px] font-bold mb-1.5">{label}</span>
        <div className="flex flex-wrap items-center gap-2">
            {list.map(([v, l]) => (
                <button key={v} type="button" disabled={disabled} aria-pressed={value === v} onClick={() => onPick(v)}
                    className="rounded-full px-3.5 py-[8px] text-[13px] font-semibold transition-colors disabled:cursor-not-allowed"
                    style={value === v ? { background: 'var(--ink)', color: 'var(--on-ink)' } : { background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}>{l}</button>
            ))}
            {note && <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{note}</span>}
        </div>
    </div>
);

const FrontDeskDashboard = ({ userProfile, center }) => {
    const navigate = useNavigate();
    const toast = useToast();
    const hostel = useHostelFees();
    const centreId = center?.id && center.id !== 'ALL' ? center.id : (userProfile?.centerId || 'UN_COLLEGE');
    const [now, setNow] = useState(new Date());
    const [phone, setPhone] = useState('');
    const [check, setCheck] = useState({ state: 'idle' }); // idle | checking | new | dup
    const [f, setF] = useState({ student: '', parent: '', cls: '', interest: '', source: 'WALK_IN', hostel: '' });
    const [counsellors, setCounsellors] = useState([]);
    const [pick, setPick] = useState('');
    const [saving, setSaving] = useState(false);
    const [queue, setQueue] = useState([]);
    const [todayCount, setTodayCount] = useState(0);
    const [dues, setDues] = useState([]);

    useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
    useEffect(() => { getCounsellorsByCenter(centreId).then(list => setCounsellors((list || []).filter(c => ['COUNSELLOR', 'COUNSELOR', 'STAFF', 'MANAGER'].includes(String(c.role || '').toUpperCase())))).catch(() => setCounsellors([])); }, [centreId]);

    // Today's walk-in queue at this centre.
    useEffect(() => onSnapshot(query(collection(db, 'leads'), where('walkInDay', '==', today())), (s) => {
        setQueue(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => (l.centerId || 'UN_COLLEGE') === centreId).sort((a, b) => (a.walkIn?.at || 0) - (b.walkIn?.at || 0)));
    }, (e) => console.error('queue', e)), [centreId]);

    // Enquiries created today at this centre.
    useEffect(() => {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        getDocs(query(collection(db, 'leads'), where('createdAt', '>=', Timestamp.fromDate(start))))
            .then(s => setTodayCount(s.docs.filter(d => (d.data().centerId || 'UN_COLLEGE') === centreId).length)).catch(() => setTodayCount(0));
    }, [centreId, queue.length]);

    // Fees due today or overdue (Accounts takes and verifies the payment).
    useEffect(() => {
        getCachedAdmissions(centreId, false, { allSessions: true }).then(list => {
            const rows = (list || []).map(a => ({ a, d: dueInfo(a) })).filter(x => x.d && x.d.daysOverdue >= 0).sort((x, y) => y.d.daysOverdue - x.d.daysOverdue);
            setDues(rows.slice(0, 6));
        }).catch(() => setDues([]));
    }, [centreId]);

    // Check the number as soon as it has 10 digits.
    const digits = phone.replace(/\D/g, '').slice(-10);
    useEffect(() => {
        if (digits.length !== 10) { setCheck({ state: 'idle' }); return undefined; }
        let live = true;
        setCheck({ state: 'checking' });
        const leads = collection(db, 'leads');
        const safe = (p) => p.then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))).catch(() => []);
        Promise.all([
            safe(getDocs(query(leads, where('phone', '==', digits)))),
            safe(getDocs(query(leads, where('parentPhone', '==', digits)))),
            safe(getDocs(query(collection(db, 'admissions'), where('phone', '==', digits)))),
        ]).then(([a, b, c]) => {
            if (!live) return;
            const lead = a[0] || b[0];
            const adm = c.find(x => !['REFUNDED', 'CANCELLED', 'REJECTED'].includes(String(x.status || '').toUpperCase()));
            if (lead || adm) setCheck({ state: 'dup', lead, adm });
            else setCheck({ state: 'new' });
        });
        return () => { live = false; };
    }, [digits]);

    const busy = useMemo(() => new Set(queue.filter(q => q.walkIn?.status === 'WITH').map(q => q.walkIn?.counsellorUid)), [queue]);
    const waiting = queue.filter(q => q.walkIn?.status === 'WAITING');
    const withC = queue.filter(q => q.walkIn?.status === 'WITH');
    const doneN = queue.filter(q => q.walkIn?.status === 'DONE').length;
    const chosen = counsellors.find(c => c.uid === pick) || null;
    const dup = check.state === 'dup';
    const course = courseFor(f.cls, f.interest);
    const canSave = check.state === 'new' && f.student.trim() && course && chosen && !saving;
    const greet = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
    const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

    const walkIn = (counsellorUid, counsellorName, status = 'WAITING') => ({ status, at: Date.now(), counsellorUid: counsellorUid || '', counsellorName: counsellorName || '', by: userProfile?.name || 'Front desk' });

    const save = async () => {
        if (!canSave) return;
        setSaving(true);
        const res = await createLead({
            studentName: f.student.trim(), phone: digits, parentPhone: digits, course, currentStandard: f.cls, source: f.source,
            sourceDetails: { enteredBy: userProfile?.name || 'Front desk', role: userProfile?.role || 'FRONT_DESK', location: 'Front desk' },
            assignedTo: chosen.uid, assignedByName: chosen.name,
            remarks: f.hostel === 'YES' ? 'Asked about the hostel' : '',
            extra: { centerId: chosen.centerId || centreId, status: 'ASSIGNED', parentName: f.parent.trim(), hostelInterest: f.hostel === 'YES', walkInDay: today(), walkIn: walkIn(chosen.uid, chosen.name) },
        }, userProfile);
        setSaving(false);
        if (!res.success) { toast('⚠️', res.error || 'Could not save'); return; }
        toast('🛎️', `Saved · ${chosen.name} can see ${f.student.trim()} is waiting`);
        setPhone(''); setF({ student: '', parent: '', cls: '', interest: '', source: 'WALK_IN', hostel: '' }); setPick('');
    };

    const tellCounsellor = async (lead) => {
        if (!lead?.id) return;
        try {
            await updateDoc(doc(db, 'leads', lead.id), {
                walkInDay: today(), walkIn: walkIn(lead.assignedTo, lead.assignedByName),
                timeline: arrayUnion({ type: 'VISIT', result: 'Came to the centre', note: `Front desk told ${lead.assignedByName || 'the counsellor'}`, date: new Date(), by: userProfile?.name || 'Front desk', role: 'Front desk' }),
                lastUpdated: serverTimestamp(),
            });
            toast('🛎️', `${lead.assignedByName || 'The counsellor'} can see ${lead.studentName || 'them'} is here`);
            setPhone('');
        } catch (e) { console.error(e); toast('⚠️', 'Could not update. This enquiry may belong to another centre.'); }
    };

    const move = async (l, status) => {
        try { await updateDoc(doc(db, 'leads', l.id), { 'walkIn.status': status, [`walkIn.${status === 'WITH' ? 'calledAt' : 'doneAt'}`]: Date.now(), lastUpdated: serverTimestamp() }); }
        catch (e) { console.error(e); toast('⚠️', 'Could not update the queue'); }
    };

    const lastCall = (l) => { const c = (l?.timeline || []).filter(t => /CALL/i.test(t.type || '')).slice(-1)[0]; if (!c) return ''; const days = Math.floor((Date.now() - ms(c.date || c.at)) / 864e5); return days <= 0 ? 'last call today' : `last call ${days} day${days > 1 ? 's' : ''} ago`; };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-[30px] sm:text-[36px] font-extrabold tracking-tight leading-tight">{greet}, {String(userProfile?.name || '').split(' ')[0] || 'there'}</h1>
                    <p className="text-[13.5px]" style={{ color: 'var(--muted)' }}>Front desk · {CENTRE_NAME[centreId] || centreId} · {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {hhmm(now)}</p>
                </div>
                <button type="button" onClick={() => { document.getElementById('fd-phone')?.focus(); document.getElementById('fd-phone')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="jb-act jb-act-ink !py-3 !px-5">＋ New enquiry</button>
            </div>

            <div className="jb-grid4">
                <Tile tone="butter" emoji="📝" title="Enquiries today" value={<Count value={todayCount} />} sub="walk-in and phone" />
                <Tile tone="coral" emoji="🚶" title="Waiting now" value={<Count value={waiting.length} />} sub="in the lobby" delay={60} />
                <Tile tone="blue" emoji="🤝" title="With counsellors" value={<Count value={withC.length} />} sub="right now" delay={120} />
                <Tile tone="sage" emoji="✅" title="Seen today" value={<Count value={doneN} />} sub="met a counsellor" delay={180} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-4 items-start">
                <section className="jb-rise rounded-[24px] p-5 sm:p-6 min-w-0" style={{ background: 'var(--panel)', boxShadow: 'var(--sh)' }}>
                    <div className="flex items-center gap-3 mb-4">
                        <span aria-hidden="true" className="w-11 h-11 rounded-2xl flex items-center justify-center text-[22px]" style={{ background: 'var(--t-butter)' }}>📝</span>
                        <div><h2 className="text-[20px] font-extrabold leading-tight">New enquiry</h2><p className="text-[13px]" style={{ color: 'var(--muted)' }}>Start with the phone number. The ERP checks it before anything else.</p></div>
                    </div>

                    <span className="block text-[12.5px] font-bold mb-1.5">Parent's phone <span style={{ color: 'var(--late)' }}>*</span></span>
                    <label className="flex items-center gap-3 rounded-[16px] px-4 h-[56px]" style={{ background: 'var(--panel)', boxShadow: `0 0 0 2px ${dup ? 'var(--coral)' : check.state === 'new' ? 'var(--ok)' : 'var(--line)'}`, transition: 'box-shadow .25s ease' }}>
                        <span aria-hidden="true">📞</span><span className="font-bold">+91</span>
                        <input id="fd-phone" value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d ]/g, '').slice(0, 12))} inputMode="tel" placeholder="10-digit number" aria-label="Parent's phone" className="flex-1 min-w-0 text-[18px] font-bold tracking-wide" style={bare} />
                        {check.state === 'checking' && <span className="text-[12px] font-bold" style={{ color: 'var(--muted)' }}>Checking…</span>}
                        {check.state === 'new' && <span className="text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'var(--t-sage)' }}>✓ New number</span>}
                        {dup && <span className="text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'var(--t-coral)' }}>Already exists</span>}
                    </label>

                    {dup && (
                        <div className="jb-rise mt-4 rounded-[18px] p-4" style={{ background: 'var(--t-coral)' }} role="alert">
                            <b className="block text-[15px]">⛔ This number is already in the ERP</b>
                            <p className="text-[13px] mt-1">
                                {check.adm ? `${check.adm.studentName || 'A student'} · ${programLabel(check.adm.program) || 'admitted'}${check.adm.rollNumber ? ` · roll ${check.adm.rollNumber}` : ''} · already admitted.`
                                    : `${check.lead.studentName || 'An enquiry'} · ${programLabel(check.lead.courseInterest) || 'course not set'} · counsellor ${check.lead.assignedByName || 'not assigned'}${lastCall(check.lead) ? ` · ${lastCall(check.lead)}` : ''}.`}
                                {' '}A second record can't be made with the same number.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <button type="button" onClick={() => navigate(check.adm ? `/staff/student/${check.adm.id}` : `/staff/leads/${check.lead.id}`)} className="jb-act jb-act-ink !py-2.5">Open {String((check.adm || check.lead).studentName || '').split(' ')[0] || 'the'}'s record</button>
                                {check.lead && <button type="button" onClick={() => tellCounsellor(check.lead)} className="jb-act !py-2.5" style={{ background: 'var(--panel)', color: 'var(--ink)' }}>Tell {String(check.lead.assignedByName || 'the counsellor').split(' ')[0]} they're here</button>}
                            </div>
                        </div>
                    )}

                    <fieldset disabled={dup || check.state !== 'new'} className="mt-4 flex flex-col gap-4 transition-opacity" style={{ opacity: check.state === 'new' ? 1 : 0.45 }}>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <label className="block"><span className="block text-[12.5px] font-bold mb-1.5">Student name <span style={{ color: 'var(--late)' }}>*</span></span>
                                <span className="flex items-center gap-2.5 rounded-[14px] px-3.5 h-[48px]" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}><span aria-hidden="true">🧑‍🎓</span><input value={f.student} onChange={e => set('student', e.target.value)} placeholder="Full name" className="flex-1 min-w-0 text-[14.5px]" style={bare} /></span></label>
                            <label className="block"><span className="block text-[12.5px] font-bold mb-1.5">Parent name</span>
                                <span className="flex items-center gap-2.5 rounded-[14px] px-3.5 h-[48px]" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}><span aria-hidden="true">👨</span><input value={f.parent} onChange={e => set('parent', e.target.value)} placeholder="Parent's name" className="flex-1 min-w-0 text-[14.5px]" style={bare} /></span></label>
                        </div>
                        <Chips label="Class now" list={CLASSES.map(c => [c, c])} value={f.cls} onPick={v => set('cls', v)} />
                        <Chips label="Interested in" list={INTEREST.map(c => [c, c])} value={f.interest} onPick={v => set('interest', v)} note={f.cls && f.interest && !course ? 'Pick a class that fits this course' : ''} />
                        <Chips label="How did they hear of us?" list={SOURCES} value={f.source} onPick={v => set('source', v)} />
                        <Chips label="Needs hostel?" list={[['YES', 'Yes, hosteller'], ['NO', 'No, day scholar']]} value={f.hostel} onPick={v => set('hostel', v)} note={f.hostel === 'YES' ? '' : 'Hostel fees show when they say yes'} />
                        {f.hostel === 'YES' && (
                            <div className="jb-rise rounded-[18px] p-4" style={{ background: 'var(--t-lilac)' }}>
                                <b className="block text-[14.5px] mb-2.5">🏨 Hostel fees</b>
                                <div className="grid sm:grid-cols-3 gap-2.5">
                                    {hostel.plans.map(p => (
                                        <div key={p.id} className="rounded-2xl p-3" style={{ background: 'var(--panel)' }}>
                                            <span className="block text-[12px] font-bold">{p.id === 'GIRLS' ? '👧' : '👦'} {p.name}</span>
                                            <b className="block text-[17px]">{inr(p.yearly)} a year</b>
                                            <span className="text-[12px]" style={{ color: 'var(--muted)' }}>or {inr(p.monthly)} a month</span>
                                        </div>
                                    ))}
                                    <div className="rounded-2xl p-3" style={{ background: 'var(--panel)' }}>
                                        <span className="block text-[12px] font-bold">🔒 Security deposit</span>
                                        <b className="block text-[17px]">{inr(hostel.deposit)}</b>
                                        <span className="text-[12px]" style={{ color: 'var(--muted)' }}>one time, fixed</span>
                                    </div>
                                </div>
                                <p className="text-[12px] mt-2.5" style={{ color: 'var(--muted)' }}>{hostel.includes ? `Includes ${hostel.includes}.` : 'All facilities included.'} The counsellor adds this to the fee quote. Director or Accounts change these amounts in Fee structures › Hostel.</p>
                            </div>
                        )}
                        <div>
                            <span className="block text-[12.5px] font-bold mb-1.5">Hand to a counsellor <span style={{ color: 'var(--late)' }}>*</span></span>
                            {counsellors.length === 0 ? <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No counsellors found for this centre.</p> : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {counsellors.map(c => {
                                        const on = pick === c.uid, isBusy = busy.has(c.uid);
                                        return (
                                            <button key={c.uid} type="button" aria-pressed={on} onClick={() => setPick(c.uid)} className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left"
                                                style={on ? { background: 'var(--panel)', boxShadow: '0 0 0 2px var(--ink)' } : { background: 'var(--cream)' }}>
                                                <Avatar name={c.name} size={34} />
                                                <span className="min-w-0"><b className="block text-[13.5px] truncate">{c.name}</b><span className="text-[11.5px]" style={{ color: 'var(--muted)' }}><span style={{ color: isBusy ? 'var(--coral)' : 'var(--ok)' }}>●</span> {isBusy ? 'with a family' : 'free now'}</span></span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <button type="button" onClick={save} disabled={!canSave} className="jb-act jb-act-ink justify-center !py-3.5 text-[15px] disabled:opacity-50">
                            {saving ? 'Saving…' : chosen ? `Save and send to ${chosen.name.split(' ')[0]} →` : 'Save and send to a counsellor →'}
                        </button>
                    </fieldset>
                </section>

                <div className="flex flex-col gap-4 min-w-0">
                    <Card title="Walk-ins right now" right={<span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{waiting.length} waiting · {withC.length} with counsellors</span>} delay={60}>
                        {queue.length === 0 ? <Empty emoji="🛋️">Nobody in the lobby yet today.</Empty> : (
                            <ul className="flex flex-col gap-2">
                                {queue.slice().sort((a, b) => ({ WITH: 0, WAITING: 1, DONE: 2 }[a.walkIn?.status] ?? 3) - ({ WITH: 0, WAITING: 1, DONE: 2 }[b.walkIn?.status] ?? 3)).map(l => {
                                    const w = l.walkIn || {}, st = w.status;
                                    const mins = Math.max(0, Math.round((Date.now() - (w.at || Date.now())) / 60000));
                                    return (
                                        <li key={l.id} className="jb-rise flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: 'var(--cream)', opacity: st === 'DONE' ? 0.6 : 1 }}>
                                            <Avatar name={l.studentName} size={38} />
                                            <span className="flex-1 min-w-[120px]"><b className="block text-[14px] truncate">{l.studentName}</b>
                                                <span className="block text-[12px] truncate" style={{ color: 'var(--muted)' }}>{[programLabel(l.courseInterest), l.hostelInterest ? 'hostel' : '', st === 'WAITING' ? `waiting ${mins} min` : st === 'WITH' ? `since ${hhmm(w.calledAt || w.at)}` : `met at ${hhmm(w.doneAt || w.at)}`].filter(Boolean).join(' · ')}</span></span>
                                            <span className="text-[11.5px] font-bold px-2.5 py-1 rounded-full" style={{ background: st === 'WAITING' ? 'var(--t-butter)' : st === 'WITH' ? 'var(--t-blue)' : 'var(--cream2)' }}>{st === 'WAITING' ? 'Waiting' : st === 'WITH' ? `With ${String(w.counsellorName || 'counsellor').split(' ')[0]}` : 'Done'}</span>
                                            {st === 'WAITING' && <button type="button" onClick={() => move(l, 'WITH')} className="jb-act jb-act-ink !py-2">Call in</button>}
                                            {st === 'WITH' && <button type="button" onClick={() => move(l, 'DONE')} className="jb-act !py-2" style={{ background: 'var(--panel)', color: 'var(--ink)' }}>Done</button>}
                                            <Contact name={l.studentName} phone={phoneOf(l)} />
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Card>

                    <Card title="Fees due today" right={<span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>Accounts takes and verifies every payment</span>} delay={120}>
                        {dues.length === 0 ? <Empty emoji="🎉">No fees due today.</Empty> : (
                            <ul className="flex flex-col gap-2">
                                {dues.map(({ a, d }) => (
                                    <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: 'var(--cream)' }}>
                                        <span className="flex-1 min-w-[120px]"><b className="block text-[14px] truncate">{a.studentName}</b><span className="block text-[12px]" style={{ color: d.daysOverdue > 0 ? 'var(--late)' : 'var(--muted)' }}>{programLabel(a.program)} · {d.daysOverdue > 0 ? `${d.daysOverdue} days late` : 'due today'}</span></span>
                                        <b className="text-[15px]">{inr(d.balance)}</b>
                                        <Contact name={a.studentName} phone={phoneOf(a)} message={`Namaste! Gentle reminder from Unacademy Nashik: the fee for ${a.studentName} is due. Please pay at the centre or ask us for the UPI details.`} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default FrontDeskDashboard;
