// L4 · Student profile (design canvas board, approved 20 Nov 2026).
// Fees and history come from the ERP. Attendance and tests come
// from KAP Core and KAP Connect once the three apps are linked, so those
// cards say so instead of showing made-up numbers.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import StudentManager from '../../components/StudentManager';
import RecordPayment from '../../components/j/RecordPayment';
import { canRecordPayment } from '../../services/recordPayment';
import { updatePaymentReminder } from '../../services/paymentService';
import { Money, MoneyToggle } from '../../components/Money';
import { Card, Empty, Contact, Count, Layer, Seg } from '../../components/j';
import { useToast } from '../../components/j/context';
import { inr, toMs } from '../../components/j/util';
import { CENTRE_NAME, centreOf, paymentsOf, phoneOf, studentPhone, balanceOf, programLabel, dateLabel } from '../j/data';
import { dueInfo, parseDay } from '../../utils/recovery';
import { normaliseRole } from '../../utils/navItems';
import { FullTimeline, RatingTag } from '../../components/j/LeadBits';
import { buildTimeline } from '../../utils/timeline';
import { rememberRecent } from '../../utils/recent';

const CAN_COLLECT = ['DIRECTOR', 'MANAGER', 'ACCOUNTANT'];

const Ring = ({ pct, size = 132, stroke = 14, color = 'var(--ok)', children }) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'var(--track)' }} strokeWidth={stroke} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={`${c * Math.min(1, pct / 100)} ${c}`} style={{ transition: 'stroke-dasharray 1s cubic-bezier(.22,1,.36,1)' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
        </div>
    );
};

const Later = ({ emoji, text }) => (
    <div className="rounded-2xl p-4 text-[13px] flex items-start gap-2.5" style={{ background: 'var(--cream)', color: 'var(--muted)' }}>
        <span aria-hidden="true" className="text-[18px]">{emoji}</span>
        <span>{text}</span>
    </div>
);

const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';

// Enquiry → Visited → Token → Roll number → Fees paid (design: Moorly stage line).
const StageLine = ({ stages }) => (
    <div className="mt-4">
        <div className="flex items-center">
            {stages.map((st, i) => (
                <div key={st.l} className="flex items-center" style={{ flex: i ? 1 : '0 0 auto' }}>
                    {i > 0 && <span className="h-[3px] flex-1 rounded" style={{ background: st.done ? 'var(--ok)' : 'var(--track)', transition: 'background .4s ease' }} />}
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0" style={{ background: st.done ? 'var(--ok)' : 'var(--cream2)', color: st.done ? 'var(--on-ink)' : 'var(--muted)' }}>{st.done ? '✓' : i + 1}</span>
                </div>
            ))}
        </div>
        <div className="flex justify-between mt-1.5 text-[11px] font-bold" style={{ color: 'var(--muted)' }}>
            {stages.map((st, i) => <span key={st.l} className={i === 0 ? 'text-left' : i === stages.length - 1 ? 'text-right' : 'text-center'} style={{ color: st.done ? 'var(--ink)' : 'var(--muted)' }}>{st.l}<br /><span className="font-medium">{st.ms ? dateLabel(st.ms) : ''}</span></span>)}
        </div>
    </div>
);

const FeesCard = ({ v, onMore, bare = false }) => {
    const body = (
        <>
            <div className="flex items-center gap-5">
                <Ring pct={v.pct} size={120} color="#8FAE7B">
                    <span className="text-[24px] font-extrabold"><Count value={v.pct} />%</span>
                    <span className="text-[11px]" style={{ color: 'var(--muted)' }}>paid</span>
                </Ring>
                <div className="flex flex-col min-w-0">
                    <p className="text-[12px]" style={{ color: 'var(--muted)' }}>Paid</p><b className="text-[20px] mb-1.5"><Money value={v.paid} /></b>
                    <p className="text-[12px]" style={{ color: 'var(--muted)' }}>Still to pay</p><b className="text-[16px]"><Money value={v.bal} /></b>
                </div>
            </div>
            {v.due && (
                <div className="mt-3.5 px-3.5 py-3 rounded-2xl flex items-center gap-2.5" style={{ background: v.due.daysOverdue > 0 ? 'var(--t-coral)' : 'var(--t-butter)' }}>
                    <span aria-hidden="true" className="text-[18px]">⏰</span>
                    <div className="flex-1"><p className="text-[13px] font-extrabold">{v.due.daysOverdue > 0 ? `${v.due.daysOverdue} days late` : `Next part due ${dateLabel(v.due.due)}`}</p>
                        <p className="text-[11.5px]">{v.due.promisedDate ? `Promised ${dateLabel(v.due.promisedDate)}` : 'Parent reminder goes 2 weeks before'}</p></div>
                </div>
            )}
            {!v.due && v.bal <= 100 && <p className="mt-3.5 jb-tag jb-tag-ok">🎉 Fully paid</p>}
        </>
    );
    if (bare) return body;
    return <Card title="💰 Fees" right={onMore && <button type="button" className="text-[12.5px] font-bold" style={{ color: 'var(--muted)' }} onClick={onMore}>Plan ›</button>}>{body}</Card>;
};

const FamilyCard = ({ a, role }) => (
    <Card title="👨‍👩‍👧 Family and papers" delay={220}>
        {[[a.fatherName, 'Father', phoneOf(a)], [a.motherName, 'Mother', a.motherPhone], [a.studentName, 'Student', studentPhone(a) !== phoneOf(a) ? studentPhone(a) : '']].filter(([n, , ph]) => n && (ph || n !== a.studentName)).map(([n, rel, ph], i) => (
            <div key={rel} className="flex items-center gap-2.5 py-2" style={{ borderTop: i ? '1px solid var(--track)' : 'none' }}>
                <span aria-hidden="true" className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0" style={{ background: ['var(--t-blue)', 'var(--t-coral)', 'var(--t-lilac)'][i] }}>{initials(n)}</span>
                <div className="flex-1 min-w-0"><p className="text-[13px] font-bold truncate">{n}</p><p className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{rel}{ph ? ` · ${ph}` : ''}</p></div>
                {ph && <Contact name={a.studentName} phone={ph} size="sm" who={rel === 'Student' ? 'student' : 'parent'} />}
            </div>
        ))}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px] mt-3">
            {[['School', a.school || a.previousSchool], ['Address', [a.address, a.city, a.pincode].filter(Boolean).join(', ')], ['Counsellor', a.counsellorName || a.bookedBy]]
                .filter(([, x]) => x).map(([k, x]) => (<React.Fragment key={k}><dt style={{ color: 'var(--muted)' }}>{k}</dt><dd className="font-semibold break-words">{x}</dd></React.Fragment>))}
        </dl>
        {a.leadId && ['DIRECTOR', 'MANAGER', 'COUNSELLOR', 'BDE'].includes(role) && (
            <Link to={`/staff/leads/${a.leadId}`} className="jb-act jb-act-soft mt-4">Open enquiry ›</Link>
        )}
    </Card>
);

// Date the team will next chase the parent (saved as nextPaymentDate; the
// Accounts and Recovery desks read it).
const ReminderCard = ({ a, userProfile, toast }) => {
    const [d, setD] = useState(a.nextPaymentDate || '');
    const [busy, setBusy] = useState(false);
    useEffect(() => { setD(a.nextPaymentDate || ''); }, [a.nextPaymentDate]);
    const save = async () => {
        if (!d) return;
        setBusy(true);
        const r = await updatePaymentReminder(a.id, d, userProfile);
        setBusy(false);
        if (r.success) toast('🔔', `Reminder set for ${dateLabel(parseDay(d), { day: 'numeric', month: 'short', year: 'numeric' })}`);
        else toast('⚠️', 'Could not save the reminder. Try again.');
    };
    return (
        <Card title="🔔 Payment reminder" sub={a.nextPaymentDate ? `Set for ${dateLabel(parseDay(a.nextPaymentDate), { day: 'numeric', month: 'short', year: 'numeric' })}${a.reminderSetBy ? ` by ${a.reminderSetBy}` : ''}` : 'Pick the day to follow up with the parent'} delay={60}>
            <div className="flex gap-2">
                <input type="date" aria-label="Reminder date" value={d} onChange={(e) => setD(e.target.value)} className="jb-input flex-1 min-w-0" />
                <button type="button" onClick={save} disabled={!d || busy || d === a.nextPaymentDate} className="jb-act disabled:opacity-50" style={{ background: 'var(--ink)', color: 'var(--on-ink)' }}>{busy ? 'Saving…' : 'Set'}</button>
            </div>
        </Card>
    );
};

const StudentProfile = ({ userProfile }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const role = normaliseRole(userProfile?.role);
    const toast = useToast();
    const [a, setA] = useState(undefined);
    const [lead, setLead] = useState(null);
    const [collect, setCollect] = useState(false);
    const amountRef = useRef(null);
    const canPay = canRecordPayment(userProfile?.role);
    const goCollect = () => { setTab('fees'); setTimeout(() => { amountRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); amountRef.current?.focus({ preventScroll: true }); }, 450); };
    const location = useLocation();
    const [tab, setTab] = useState(location.state?.tab || 'over');
    const [err, setErr] = useState('');

    useEffect(() => onSnapshot(doc(db, 'admissions', id),
        (s) => setA(s.exists() ? { id: s.id, ...s.data() } : null),
        (e) => { console.error(e); setErr('You do not have access to this student, or the connection dropped.'); setA(null); }), [id]);
    useEffect(() => {
        if (a?.studentName) rememberRecent({ to: `/staff/student/${a.id}`, name: a.studentName, sub: [programLabel(a.program), a.rollNumber ? String(a.rollNumber).replace(/^(\d{3})(\d{2})(\d+)$/, '$1 $2 $3') : ''].filter(Boolean).join(' · ') });
    }, [a?.id, a?.studentName, a?.program, a?.rollNumber]);
    useEffect(() => {
        if (!a?.leadId) return;
        getDoc(doc(db, 'leads', a.leadId)).then(s => setLead(s.exists() ? s.data() : null)).catch(() => setLead(null));
    }, [a?.leadId]);

    const v = useMemo(() => {
        if (!a) return null;
        const fee = Number(a.amount) || 0;
        const paid = Number(a.totalPaid) || 0;
        const pays = paymentsOf(a).sort((x, y) => x.ms - y.ms);
        const due = dueInfo(a);
        const original = Number(a.originalFee || a.totalFee || a.baseFee) || 0;
        const disc = original > fee ? original - fee : 0;
        const plan = Array.isArray(a.installments) && a.installments.length
            ? a.installments.map((x, i) => ({ n: i + 1, amount: Number(x.amount) || 0, due: parseDay(x.dueDate || x.date) }))
            : null;
        let cum = 0;
        const parts = plan?.map(p => { cum += p.amount; return { ...p, done: paid >= cum - 500 }; });
        const events = buildTimeline({ lead, admission: a });
        const tl = lead?.timeline || [];
        const firstOf = (re) => { const t = tl.filter(x => re.test(String(x.type || '') + ' ' + String(x.result || ''))).map(x => toMs(x.date)).filter(Boolean).sort((p, q) => p - q)[0]; return t || null; };
        const verifiedMs = a.rollNumber ? (toMs(a.verifiedAt) || toMs(a.approvedAt) || null) : null;
        const stages = [
            { l: 'Enquiry', ms: toMs(lead?.createdAt) || null, done: true },
            { l: 'Visited', ms: firstOf(/VISIT|COUNSELLING/i), done: !!firstOf(/VISIT|COUNSELLING/i) || !!pays.length },
            { l: 'Token paid', ms: pays[0]?.ms || null, done: pays.length > 0 },
            { l: 'Roll number', ms: verifiedMs, done: !!a.rollNumber },
            { l: 'Fees paid', ms: null, done: balanceOf(a) <= 100 },
        ];
        return { stages, fee, paid, bal: balanceOf(a), pct: fee ? Math.round((paid / fee) * 100) : 0, pays, due, disc, original, parts, events };
    }, [a, lead]);

    if (a === undefined) return <div className="flex flex-col gap-4" aria-busy="true"><div className="jb-sk h-40" /><div className="jb-grid3"><div className="jb-sk h-72" /><div className="jb-sk h-72" /><div className="jb-sk h-72" /></div></div>;
    if (!a) return <Card><Empty emoji="🔎">{err || 'This student was not found.'}</Empty><div className="text-center"><button type="button" className="jb-act jb-act-line" onClick={() => navigate(-1)}>← Back</button></div></Card>;

    const active = ['ACTIVE', 'COMPLETED'].includes(a.status);
    const statusTag = a.status === 'REFUNDED' || Number(a.refundAmount) > 0 ? ['jb-tag-late', 'Refunded']
        : active ? ['jb-tag-ok', '● Active'] : ['jb-tag-next', 'Waiting for Accounts'];
    const parentName = a.fatherName || a.motherName || a.parentName || 'Parent';
    const reminder = `Namaste ${parentName}, this is Unacademy Nashik about ${a.studentName}.`;
    const roll = a.rollNumber ? String(a.rollNumber).replace(/^(\d{3})(\d{2})(\d+)$/, '$1 $2 $3') : '';
    const bookedMs = toMs(a.createdAt) || toMs(a.enrollmentDate);
    const admittedLine = bookedMs ? `admitted ${dateLabel(bookedMs, { day: 'numeric', month: 'short', year: 'numeric' })} by ${a.counsellorName || a.bookedBy || 'desk'}` : '';
    const feeTag = v.bal <= 100 ? ['🎉 Fees fully paid', 'var(--t-sage)'] : v.due?.daysOverdue > 0 ? [`⏰ Fee ${v.due.daysOverdue} days late`, 'var(--t-coral)'] : v.due ? [`💳 Next fee ${dateLabel(v.due.due)}`, 'var(--t-butter)'] : null;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2"><button type="button" className="jb-act jb-act-soft" onClick={() => navigate(-1)}>← Back</button><MoneyToggle /></div>

            {/* Hero card (design L4) */}
            <section className="jb-card jb-rise relative overflow-hidden" style={{ padding: '24px 26px' }}>
                <span aria-hidden="true" className="absolute rounded-full" style={{ right: -60, top: -80, width: 280, height: 280, background: 'var(--t-sage)', opacity: .55 }} />
                <span aria-hidden="true" className="absolute rounded-full" style={{ right: 150, top: -120, width: 200, height: 200, background: 'var(--t-butter)', opacity: .45 }} />
                <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
                    <div className="relative w-[96px] h-[96px] shrink-0">
                        <span className="w-[96px] h-[96px] rounded-[30px] flex items-center justify-center text-[34px] font-extrabold tracking-tight" style={{ background: 'var(--t-lilac)' }}>{initials(a.studentName)}</span>
                        <span title={statusTag[1]} className="absolute -right-1 -bottom-1 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[13px] font-extrabold" style={{ background: active ? 'var(--ok)' : statusTag[0] === 'jb-tag-late' ? 'var(--late)' : '#E0A526', color: 'var(--on-ink)', boxShadow: '0 0 0 3px var(--panel)' }}>{active ? '✓' : statusTag[0] === 'jb-tag-late' ? '↩' : '…'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-[28px] sm:text-[36px] font-extrabold tracking-[-.025em] leading-tight">{a.studentName}</h1>
                            {a.rollNumber && <button type="button" onClick={() => { try { navigator.clipboard?.writeText(String(a.rollNumber)); } catch { /* clipboard blocked */ } toast('📋', 'Roll number copied'); }}
                                aria-label={`Copy roll number ${roll}`} className="rounded-full px-3 py-1.5 text-[13px] font-extrabold tabular-nums" style={{ background: 'var(--ink)', color: 'var(--on-ink)' }}>🎫 {roll}</button>}
                        </div>
                        <p className="text-[14px] mt-1.5" style={{ color: 'var(--muted)' }}>{[programLabel(a.program), a.batchAssigned, CENTRE_NAME[centreOf(a)], admittedLine].filter(Boolean).join(' · ')}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                            <span className="text-[12px] font-bold px-[11px] py-[5px] rounded-full" style={{ background: statusTag[0] === 'jb-tag-ok' ? 'var(--t-sage)' : statusTag[0] === 'jb-tag-late' ? 'var(--t-coral)' : 'var(--t-butter)', color: statusTag[0] === 'jb-tag-ok' ? 'var(--ok)' : 'var(--ink)' }}>{statusTag[1]}</span>
                            {feeTag && <span className="text-[12px] font-bold px-[11px] py-[5px] rounded-full" style={{ background: feeTag[1] }}>{feeTag[0]}</span>}
                            {v.disc > 0 && <span className="text-[12px] font-bold px-[11px] py-[5px] rounded-full" style={{ background: 'var(--t-butter)' }}>🏅 {inr(v.disc)} off</span>}
                            {a.admissionMode && <span className="text-[12px] font-bold px-[11px] py-[5px] rounded-full" style={{ background: 'var(--t-blue)' }}>{a.admissionMode === 'ONLINE' ? '💻 Online' : '🏫 Classroom'}</span>}
                            {a.hosteller && <span className="text-[12px] font-bold px-[11px] py-[5px] rounded-full" style={{ background: 'var(--t-lilac)' }}>🏠 Hosteller{a.hostelFee ? ` · ${inr(a.hostelFee)}${a.hostelBilling === 'MONTHLY' ? '/month' : '/yr'}` : ''}</span>}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Contact name={a.studentName} phone={phoneOf(a)} labelled message={reminder} />
                        {studentPhone(a) && studentPhone(a) !== phoneOf(a) && <Contact name={a.studentName} phone={studentPhone(a)} who="student" />}
                        {canPay && <button type="button" className="jb-act jb-act-ink !py-3" onClick={goCollect}>🧾 Collect fee</button>}
                        {role === 'DIRECTOR' && <button type="button" className="jb-act jb-act-soft !py-3" onClick={() => setCollect(true)}>✏️ Edit fee, course, batch</button>}
                    </div>
                </div>
            </section>

            <div className="jb-rise flex justify-between items-center gap-3 flex-wrap" style={{ animationDelay: '80ms' }}>
                <div className="max-w-full overflow-x-auto -mx-1 px-1 pb-1"><Seg label="Profile sections" value={tab} onChange={setTab} pillBg="var(--ink)" onInk="var(--on-ink)"
                    options={[{ value: 'over', label: 'Overview' }, { value: 'fees', label: 'Fees' }, { value: 'att', label: 'Attendance' }, { value: 'tests', label: 'Tests' }, { value: 'hist', label: 'History' }]} /></div>
                <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>Fees from ERP · attendance and tests from KAP Core · same data parents see in KAP Connect</p>
            </div>

            {tab === 'over' && (
                <div key="over" className="flex flex-col gap-4">
                    <div className="jb-grid3">
                        <FeesCard v={v} onMore={() => setTab('fees')} />
                        <Card title="🗓️ Attendance" right={<button type="button" className="text-[12.5px] font-bold" style={{ color: 'var(--muted)' }} onClick={() => setTab('att')}>More ›</button>} delay={60}>
                            <Later emoji="🔗" text="Comes from KAP Core once the apps are linked. The last 14 class days will show as squares, like the parent app." />
                            <div className="grid grid-cols-7 gap-1.5 mt-3" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <span key={i} className="aspect-square rounded-md" style={{ background: 'var(--track)' }} />)}</div>
                        </Card>
                        <Card title="📝 Tests" right={<button type="button" className="text-[12.5px] font-bold" style={{ color: 'var(--muted)' }} onClick={() => setTab('tests')}>More ›</button>} delay={120}>
                            <Later emoji="🔗" text="Marks and rank come from the test system through KAP Core. They appear here after the link is made." />
                        </Card>
                    </div>
                    <div className="jb-grid21">
                        <Card title="🧭 Journey with us" right={<button type="button" className="text-[12.5px] font-bold" style={{ color: 'var(--muted)' }} onClick={() => setTab('hist')}>Full history ›</button>} delay={180}>
                            <StageLine stages={v.stages} />
                            <div className="mt-4 flex flex-col gap-2">
                                {v.events.slice(0, 3).map((e, i) => (
                                    <div key={i} className="jb-rise flex items-center gap-3 px-3 py-2.5 rounded-[14px]" style={{ background: 'var(--cream)' }}>
                                        <span aria-hidden="true" className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--panel)' }}>{e.emoji}</span>
                                        <div className="flex-1 min-w-0"><p className="text-[13px] font-bold truncate">{e.title}</p><p className="text-[11.5px] truncate" style={{ color: 'var(--muted)' }}>{[e.detail, e.by].filter(Boolean).join(' · ')}</p></div>
                                        <span className="text-[11.5px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>{dateLabel(e.ms)}</span>
                                    </div>
                                ))}
                                {v.events.length === 0 && <Empty emoji="🌱">Nothing recorded yet.</Empty>}
                            </div>
                        </Card>
                        <FamilyCard a={a} role={role} />
                    </div>
                </div>
            )}

            {tab === 'fees' && (
                <div key="fees" className="jb-grid21">
                    <Card title={v.parts ? `Payment plan · ${v.parts.length} parts` : 'Payment plan'} sub={v.original > v.fee ? `Course fee ${inr(v.original)} − ${inr(v.original - v.fee)} = ${inr(v.fee)}` : `Course fee ${inr(v.fee)}`} delay={40}>
                        {v.parts ? (
                            <>
                                <div className="flex h-[14px] rounded-lg overflow-hidden gap-[3px] mt-1 mb-3">
                                    {v.parts.map(p => <span key={p.n} style={{ flex: p.amount || 1, background: p.done ? 'var(--ok)' : 'var(--track)' }} />)}
                                </div>
                                <div className="flex flex-col gap-2">
                                    {v.parts.map((p, i) => {
                                        const next = !p.done && (i === 0 || v.parts[i - 1].done);
                                        return (
                                            <div key={p.n} className="jb-rise flex items-center gap-3 px-3 py-2.5 rounded-2xl" style={{ background: next ? 'var(--nextbg)' : 'var(--cream)' }}>
                                                <span className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[13px] font-extrabold shrink-0" style={{ background: p.done ? 'var(--ok)' : next ? 'var(--t-butter)' : 'var(--cream2)', color: p.done ? 'var(--on-ink)' : 'var(--ink)' }}>{p.done ? '✓' : p.n}</span>
                                                <div className="flex-1 min-w-0"><p className="text-[14px] font-extrabold">Part {p.n}</p><p className="text-[12px]" style={{ color: 'var(--muted)' }}>{p.done ? 'Paid' : p.due ? `Due ${dateLabel(p.due, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Date not set'}</p></div>
                                                <b className="text-[15px]"><Money value={p.amount} /></b>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : <FeesCard v={v} bare />}
                    </Card>
                    <div className="flex flex-col gap-4 min-w-0">
                    {v.bal > 0 && !(a.status === 'REFUNDED' || Number(a.refundAmount) > 0) && ['DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'ADMIN', 'COUNSELLOR', 'BDE'].includes(role) && <ReminderCard a={a} userProfile={userProfile} toast={toast} />}
                    {canPay && <RecordPayment student={a} userProfile={userProfile} balance={v.bal} nextDue={(v.parts || []).find(p => !p.done)?.amount || 0} amountRef={amountRef} />}
                    <Card title="Receipts" sub="Tap one to open, download the official PDF, or WhatsApp it" delay={80}>
                        {v.pays.length === 0 && <Empty emoji="🌱">No payments yet.</Empty>}
                        <div className="flex flex-col gap-2">
                            {v.pays.slice().reverse().map((p, i) => (
                                <Link key={i} to={`/staff/receipt/${a.id}/${(a.payments || []).indexOf(p.raw)}`} className="jb-lift flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--cream)' }}>
                                    <span aria-hidden="true" className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px]" style={{ background: 'var(--t-sage)' }}>🧾</span>
                                    <div className="flex-1 min-w-0"><b className="text-[14px]"><Money value={p.amount} /></b><p className="text-[12px] truncate" style={{ color: 'var(--muted)' }}>{dateLabel(p.ms, { day: 'numeric', month: 'short', year: 'numeric' })} · {p.mode || 'mode not noted'} · {p.type?.split('/')[0] || 'Payment'}</p></div>
                                    <span aria-hidden="true" style={{ color: 'var(--muted)' }}>›</span>
                                </Link>
                            ))}
                        </div>
                    </Card>
                    </div>
                </div>
            )}

            {tab === 'att' && <Card key="att" title="🗓️ Attendance"><Later emoji="🔗" text="Attendance is managed in KAP Core. Once the ERP and KAP Core are linked, the month view and the last 14 class days show here, the same as in the parent app." /></Card>}
            {tab === 'tests' && <Card key="tests" title="📝 Tests"><Later emoji="🔗" text="Tests run in the CBT system and reach the ERP through KAP Core. Scores, subject split and rank in batch show here after the link." /></Card>}
            {tab === 'hist' && (
                <Card key="hist" title="🧭 Full history" sub="Every call, change, rating and payment, from telecaller to Director" right={<RatingTag lead={lead} />}>
                    <FullTimeline events={v.events} />
                </Card>
            )}

            {collect && (
                <Layer>
                    <div className="kap-modal-host">
                        <StudentManager student={a} onClose={() => setCollect(false)} refreshData={() => {}} userProfile={userProfile} />
                    </div>
                </Layer>
            )}
        </div>
    );
};

export default StudentProfile;
