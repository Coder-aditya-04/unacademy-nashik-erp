// L4 · Student profile (design canvas board, approved 20 Nov 2026).
// Fees and history come from the ERP. Attendance and tests come
// from KAP Core and KAP Connect once the three apps are linked, so those
// cards say so instead of showing made-up numbers.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import StudentManager from '../../components/StudentManager';
import { Money, MoneyToggle } from '../../components/Money';
import { Card, Empty, Contact, Avatar, Count, Layer } from '../../components/j';
import { inr } from '../../components/j/util';
import { CENTRE_NAME, centreOf, paymentsOf, phoneOf, studentPhone, balanceOf, programLabel, dateLabel } from '../j/data';
import { dueInfo, parseDay } from '../../utils/recovery';
import { normaliseRole } from '../../utils/navItems';
import { FullTimeline, RatingTag } from '../../components/j/LeadBits';
import { buildTimeline } from '../../utils/timeline';

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

const StudentProfile = ({ userProfile }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const role = normaliseRole(userProfile?.role);
    const [a, setA] = useState(undefined);
    const [lead, setLead] = useState(null);
    const [collect, setCollect] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => onSnapshot(doc(db, 'admissions', id),
        (s) => setA(s.exists() ? { id: s.id, ...s.data() } : null),
        (e) => { console.error(e); setErr('You do not have access to this student, or the connection dropped.'); setA(null); }), [id]);
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
        return { fee, paid, bal: balanceOf(a), pct: fee ? Math.round((paid / fee) * 100) : 0, pays, due, disc, original, parts, events };
    }, [a, lead]);

    if (a === undefined) return <div className="flex flex-col gap-4" aria-busy="true"><div className="jb-sk h-40" /><div className="jb-grid3"><div className="jb-sk h-72" /><div className="jb-sk h-72" /><div className="jb-sk h-72" /></div></div>;
    if (!a) return <Card><Empty emoji="🔎">{err || 'This student was not found.'}</Empty><div className="text-center"><button type="button" className="jb-act jb-act-line" onClick={() => navigate(-1)}>← Back</button></div></Card>;

    const active = ['ACTIVE', 'COMPLETED'].includes(a.status);
    const statusTag = a.status === 'REFUNDED' || Number(a.refundAmount) > 0 ? ['jb-tag-late', 'Refunded']
        : active ? ['jb-tag-ok', '● Active'] : ['jb-tag-next', 'Waiting for Accounts'];
    const parentName = a.fatherName || a.motherName || a.parentName || 'Parent';
    const reminder = `Namaste ${parentName}, this is Unacademy Nashik about ${a.studentName}.`;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2"><button type="button" className="jb-act jb-act-soft" onClick={() => navigate(-1)}>← Back</button><MoneyToggle /></div>

            {/* Header card */}
            <section className="jb-card jb-rise p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-5">
                <Avatar name={a.studentName} size={72} />
                <div className="flex-1 min-w-0">
                    <h2 className="jb-h text-[28px] sm:text-[34px] leading-tight">{a.studentName}</h2>
                    <p className="text-[14px] mt-0.5" style={{ color: 'var(--muted)' }}>{programLabel(a.program)}{a.batchAssigned ? ` · ${a.batchAssigned}` : ''} · {CENTRE_NAME[centreOf(a)]}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <span className="jb-tag jb-tag-soft">🎫 {a.rollNumber ? String(a.rollNumber).replace(/^(\d{3})(\d{2})(\d+)$/, '$1 $2 $3') : 'Roll number after verification'}</span>
                        <span className={`jb-tag ${statusTag[0]}`}>{statusTag[1]}</span>
                        {v.disc > 0 && <span className="jb-tag jb-tag-next">🏅 {inr(v.disc)} off</span>}
                        {a.admissionMode && <span className="jb-tag jb-tag-soft">{a.admissionMode === 'ONLINE' ? '💻 Online' : '🏫 Classroom'}</span>}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Contact name={a.studentName} phone={phoneOf(a)} size="lg" message={reminder} />
                    {studentPhone(a) && studentPhone(a) !== phoneOf(a) && <Contact name={a.studentName} phone={studentPhone(a)} who="student" />}
                    {CAN_COLLECT.includes(role) && <button type="button" className="jb-act jb-act-ink !py-3" onClick={() => setCollect(true)}>🧾 Collect fee</button>}
                </div>
            </section>
            <p className="text-[12.5px] -mt-1 px-1" style={{ color: 'var(--muted)' }}>Fees from the ERP. Attendance and tests will come from KAP Core, the same data parents see in KAP Connect.</p>

            <div className="jb-grid3">
                {/* Fees */}
                <Card title="💰 Fees" delay={60}>
                    <div className="flex items-center gap-5">
                        <Ring pct={v.pct}>
                            <span className="text-[26px] font-extrabold"><Count value={v.pct} />%</span>
                            <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>paid</span>
                        </Ring>
                        <div className="flex flex-col gap-2 min-w-0">
                            <div><p className="text-[12px]" style={{ color: 'var(--muted)' }}>Paid</p><b className="text-[18px]"><Money value={v.paid} /></b></div>
                            <div><p className="text-[12px]" style={{ color: 'var(--muted)' }}>Still to pay</p><b className="text-[18px]"><Money value={v.bal} /></b></div>
                        </div>
                    </div>
                    {v.due && (
                        <p className={`mt-4 jb-tag ${v.due.daysOverdue > 0 ? 'jb-tag-late' : 'jb-tag-next'}`}>
                            ⏰ {v.due.daysOverdue > 0 ? `${v.due.daysOverdue} days late` : `Next due ${dateLabel(v.due.due)}`}
                            {v.due.promisedDate ? ` · promised ${dateLabel(v.due.promisedDate)}` : ''}
                        </p>
                    )}
                    {!v.due && v.bal <= 100 && <p className="mt-4 jb-tag jb-tag-ok">🎉 Fully paid</p>}
                </Card>

                {/* Attendance */}
                <Card title="🗓️ Attendance" delay={120}>
                    <Later emoji="🔗" text="Attendance comes from KAP Core once the ERP and KAP Core are linked. The last 14 class days will show here as squares, like the parent app." />
                    <div className="grid grid-cols-7 gap-1.5 mt-3" aria-hidden="true">
                        {Array.from({ length: 14 }, (_, i) => <span key={i} className="aspect-square rounded-md" style={{ background: 'var(--track)' }} />)}
                    </div>
                </Card>

                {/* Tests */}
                <Card title="📝 Tests" delay={180}>
                    <Later emoji="🔗" text="Test marks and rank come from the test system through KAP Core. They appear here after the link is made." />
                </Card>
            </div>

            <div className="jb-grid21">
                <Card title="🧭 Journey with us" sub="Every call, change, rating and payment, from telecaller to Director" right={<RatingTag lead={lead} />} delay={220}>
                    <FullTimeline events={v.events} max={20} />
                </Card>

                <div className="flex flex-col gap-4">
                    <Card title="🧾 Receipts" sub="Tap one to open, print or WhatsApp it" delay={260}>
                        {v.pays.length === 0 && <Empty emoji="🌱">No payments yet.</Empty>}
                        <ul className="flex flex-col gap-2">
                            {v.pays.slice().reverse().map((p, i) => (
                                <li key={i}><Link to={`/staff/receipt/${a.id}/${(a.payments || []).indexOf(p.raw)}`} className="jb-lift flex items-center gap-3 px-3 py-2.5 rounded-2xl" style={{ background: 'var(--cream)' }}>
                                    <span aria-hidden="true">🧾</span>
                                    <div className="flex-1 min-w-0"><b className="text-[14px]"><Money value={p.amount} /></b><p className="text-[12px] truncate" style={{ color: 'var(--muted)' }}>{dateLabel(p.ms, { day: 'numeric', month: 'short', year: 'numeric' })} · {p.mode || 'mode not noted'}</p></div>
                                    <span className="jb-tag jb-tag-soft">{p.type?.split('/')[0] || 'Payment'}</span>
                                    <span aria-hidden="true" style={{ color: 'var(--muted)' }}>›</span>
                                </Link></li>
                            ))}
                        </ul>
                    </Card>

                    {v.parts && (
                        <Card title={`Payment plan · ${v.parts.length} parts`} sub={v.original > v.fee ? `Course fee ${inr(v.original)} − ${inr(v.original - v.fee)} = ${inr(v.fee)}` : `Course fee ${inr(v.fee)}`} delay={300}>
                            <ol className="flex flex-col gap-2">
                                {v.parts.map(p => (
                                    <li key={p.n} className="flex items-center gap-3 text-[13.5px]">
                                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold" style={{ background: p.done ? 'var(--ok)' : 'var(--track)', color: p.done ? 'var(--on-ink)' : 'var(--muted)' }}>{p.done ? '✓' : p.n}</span>
                                        <span className="flex-1">Part {p.n}{p.due ? ` · ${dateLabel(p.due)}` : ''}</span>
                                        <b><Money value={p.amount} /></b>
                                    </li>
                                ))}
                            </ol>
                        </Card>
                    )}

                    <Card title="👨‍👩‍👧 Family and papers" delay={340}>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13.5px]">
                            {[['Father', a.fatherName], ['Mother', a.motherName], ['Parent phone', phoneOf(a)], ['Student phone', studentPhone(a) !== phoneOf(a) ? studentPhone(a) : ''],
                                ['School', a.school || a.previousSchool], ['Address', [a.address, a.city, a.pincode].filter(Boolean).join(', ')], ['Counsellor', a.counsellorName || a.bookedBy]]
                                .filter(([, x]) => x).map(([k, x]) => (<React.Fragment key={k}><dt style={{ color: 'var(--muted)' }}>{k}</dt><dd className="font-semibold break-words">{x}</dd></React.Fragment>))}
                        </dl>
                        {a.leadId && ['DIRECTOR', 'MANAGER', 'COUNSELLOR', 'BDE'].includes(role) && (
                            <Link to={`/staff/leads/${a.leadId}`} className="jb-act jb-act-soft mt-4">Open enquiry ›</Link>
                        )}
                    </Card>
                </div>
            </div>

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
