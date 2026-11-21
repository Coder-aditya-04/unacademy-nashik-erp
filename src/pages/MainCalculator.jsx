// Fee calculator, board K2 "Build a fee quote": four numbered cards on the
// left (Student, Course and batch, Discount, Payment plan), the dark quote
// card and "When to pay" on the right, and a Parent view with the
// Unacademy-branded quote. Prices always come from Fee structures and the
// existing calculateFee / calculateInstallments rules.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, doc, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useFeeStructure } from '../hooks/useFeeStructure';
import { calculateFee, calculateInstallments, calculateRefunds } from '../utils/calculations';
import { saveQuoteToHistory } from '../services/leadService';
import { requestDiscount } from '../services/approvalService';
import { fetchBatches, fetchRealBatchEnrollments } from '../services/batchService';
import { courseOptions, batchCodeFor, optionFor, COURSE_GROUPS } from '../utils/courseOptions';
import { Card, Seg, Count, Avatar } from '../components/j';
import { useToast } from '../components/j/context';
import { CENTRE_NAME } from '../modules/j/data';
import unacademyLogo from '../assets/unacademy-logo.png';

const MAX_DISCOUNT_LIMIT = 65; // above this the Director must approve
// "21/2/2027" (en-IN) to "21 Feb 2027"; other text passes through.
const nice = (d) => { const m = String(d || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? new Date(+m[3], +m[2] - 1, +m[1]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : String(d || ''); };
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const CLASSES = ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12', 'Dropper'];
const REASONS = ['Merit', 'Sibling', 'Staff child', 'Tie-up college', 'Hardship', 'Other'];
const PCTS = [0, 10, 25, 40, 50, 70];
const AMTS = [0, 5000, 10000, 20000, 30000, 50000];
const GETS = [['🧑‍🏫', 'Live and offline classes'], ['📝', 'Weekly tests, all-India rank'], ['📚', 'Printed study material'], ['💬', 'Daily doubt sessions'], ['👨‍👩‍👧', 'Monthly parent meet'], ['📱', 'KAP Connect parent app']];
const APP_POINTS = [['📝', 'Test marks and rank after every test'], ['📅', 'Attendance every day'], ['✅', 'Homework given and done'], ['💳', 'Fee due dates and receipts']];

const Step = ({ n, title, hint, children, delay }) => (
    <Card delay={delay} title={<span className="flex items-center gap-2.5"><span className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-extrabold" style={{ background: 'var(--ink)', color: 'var(--on-ink)' }}>{n}</span>{title}</span>}
        right={hint ? <span className="text-[12.5px] hidden sm:inline" style={{ color: 'var(--muted)' }}>{hint}</span> : null}>
        {children}
    </Card>
);

const Chip = ({ on, onClick, children, tone }) => (
    <button type="button" onClick={onClick} aria-pressed={on}
        className="rounded-full px-3.5 py-[7px] text-[13px] font-semibold transition-colors"
        style={on ? { background: tone || 'var(--ink)', color: tone ? 'var(--ink)' : 'var(--on-ink)' } : { background: 'var(--panel)', color: 'var(--ink)', boxShadow: '0 0 0 1px var(--line)' }}>
        {children}
    </button>
);

const Field = ({ label, icon, children }) => (
    <label className="block min-w-0">
        <span className="block text-[12.5px] font-bold mb-1.5">{label}</span>
        <span className="flex items-center gap-2 rounded-[14px] px-3.5 h-[48px]" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}>
            <span aria-hidden="true">{icon}</span>{children}
        </span>
    </label>
);
const bare = { border: 0, boxShadow: 'none', background: 'transparent', outline: 'none' };

// Ring of ticks lit up to `pct` (design: discount dial).
const Dial = ({ pct, size = 120, on = '#F6E7AE', off = 'rgba(255,255,255,.14)', children }) => {
    const n = 40, c = size / 2, r1 = size * 0.44, r2 = size * 0.36;
    const lit = Math.round(n * Math.min(1, Math.max(0, pct) / 100));
    return (
        <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} aria-hidden="true" className="absolute inset-0">
                {Array.from({ length: n }, (_, i) => {
                    const a = (-225 + i * 270 / (n - 1)) * Math.PI / 180;
                    return <line key={i} x1={c + r1 * Math.cos(a)} y1={c + r1 * Math.sin(a)} x2={c + r2 * Math.cos(a)} y2={c + r2 * Math.sin(a)} strokeWidth="3" strokeLinecap="round" style={{ stroke: i < lit ? on : off, transition: 'stroke .25s ease' }} />;
                })}
            </svg>
            <span className="relative text-center leading-tight">{children}</span>
        </span>
    );
};

const MainCalculator = ({ center, userProfile }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const toast = useToast();
    const crm = location.state || {};
    const { feeStructures, loading: feesLoading } = useFeeStructure();
    const isPrayas = center?.id === 'PRAYAS';

    const [view, setView] = useState('staff');
    const [name, setName] = useState(crm.prefillName || '');
    const [phone, setPhone] = useState(crm.prefillPhone || crm.parentPhone || crm.phone || '');
    const [leadId, setLeadId] = useState(crm.leadId || null);
    const [lead, setLead] = useState(crm.leadId ? crm : null);
    const [cls, setCls] = useState('');
    const [enquiries, setEnquiries] = useState([]);
    const [group, setGroup] = useState('NEET');
    const [course, setCourse] = useState(''); // option value
    const [q, setQ] = useState('');
    const [batches, setBatches] = useState([]);
    const [enrolled, setEnrolled] = useState({});
    const [batchId, setBatchId] = useState('');
    const [dmode, setDmode] = useState('pct');
    const [pct, setPct] = useState(0);
    const [amt, setAmt] = useState(0);
    const [reason, setReason] = useState('Merit');
    const [note, setNote] = useState('');
    const [plan, setPlan] = useState('INSTALLMENT');
    const [approvalId, setApprovalId] = useState(null);
    const [approval, setApproval] = useState('IDLE'); // IDLE SENDING SENT APPROVED
    const [saving, setSaving] = useState(false);
    const quoteNo = useRef(`Q-${new Date().toISOString().slice(2, 7).replace('-', '')}-${String(Date.now()).slice(-3)}`);

    const options = useMemo(() => courseOptions(feeStructures, isPrayas), [feeStructures, isPrayas]);
    const groups = COURSE_GROUPS.filter(g => options.some(o => o.group === g));
    const opt = options.find(o => o.value === course) || null;
    const key = opt?.key || '';
    const data = key ? feeStructures?.[key] : null;

    // Prefill the course from the enquiry once fees are loaded.
    useEffect(() => {
        if (!options.length || course) return;
        const o = optionFor(options, crm.prefillCourse || lead?.courseInterest);
        if (o) { setGroup(o.group); setCourse(o.value); }
    }, [options]); // eslint-disable-line react-hooks/exhaustive-deps

    // Today's enquiries for this counsellor, to fill the student in one tap.
    useEffect(() => {
        const uid = userProfile?.uid;
        if (!uid) return;
        getDocs(query(collection(db, 'leads'), where('assignedTo', '==', uid), limit(40))).then(s => {
            const ms = (v) => (v?.seconds ? v.seconds * 1000 : v ? new Date(v).getTime() : 0);
            const open = s.docs.map(d => ({ id: d.id, ...d.data() }))
                .filter(l => !l.admissionId && !['CONVERTED', 'LOST', 'UNDER_VERIFICATION', 'ADMITTED'].includes(String(l.status || '').toUpperCase()))
                .sort((a, b) => ms(b.updatedAt || b.createdAt) - ms(a.updatedAt || a.createdAt)).slice(0, 4);
            setEnquiries(open);
        }).catch(() => setEnquiries([]));
    }, [userProfile?.uid]);

    // Batches and how many seats are taken.
    useEffect(() => {
        let live = true;
        Promise.all([fetchBatches(), fetchRealBatchEnrollments().catch(() => ({}))]).then(([b, e]) => { if (live) { setBatches(b || []); setEnrolled(e || {}); } }).catch(() => {});
        return () => { live = false; };
    }, []);

    // Director's answer on a discount above the limit.
    useEffect(() => {
        if (!approvalId) return undefined;
        return onSnapshot(doc(db, 'approvals', approvalId), (s) => {
            const st = s.data()?.status;
            if (st === 'APPROVED') { setApproval('APPROVED'); toast('✅', 'Director approved the discount'); }
            if (st === 'REJECTED') { setApproval('IDLE'); setApprovalId(null); toast('🚫', 'Director did not approve this discount'); }
        });
    }, [approvalId, toast]);

    const tuition = Number(data?.tuition) || 0;
    const discPct = dmode === 'pct' ? Math.min(100, Math.max(0, pct)) : (tuition ? Math.min(100, (Math.min(amt, tuition) / tuition) * 100) : 0);
    const result = useMemo(() => (key && feeStructures ? calculateFee(key, discPct, 'NONE', feeStructures) : null), [key, discPct, feeStructures]);
    const scheduleFor = (p) => (result && p !== 'FULL' ? calculateInstallments(result.landingFee, key, p, feeStructures) : []);
    const schedule = result ? (plan === 'FULL' ? [{ id: 'Full payment', dueDate: 'Today', amount: result.landingFee }] : scheduleFor(plan)) : [];
    const refunds = result ? calculateRefunds(result.landingFee, result.projectedFee, key, feeStructures) : [];
    const saved = result ? Math.max(0, result.originalTotal - result.landingFee) : 0;
    const needsApproval = discPct > MAX_DISCOUNT_LIMIT && approval !== 'APPROVED';
    const needsNote = discPct > 0 && !note.trim();
    const canQuote = !!result && !needsApproval && !needsNote && name.trim();
    const parts = Number(data?.installments) || 0;

    const code = batchCodeFor(opt?.standard, key);
    const centreBatches = batches.filter(b => !isPrayas ? (b.centerId || '') !== 'PRAYAS' : b.centerId === 'PRAYAS');
    const matching = centreBatches.filter(b => (code && b.course === code) || (key && b.course === key));
    const ql = q.trim().toLowerCase();
    const shownOptions = options.filter(o => o.group === group && (!ql || o.label.toLowerCase().includes(ql)));
    const batch = batches.find(b => b.id === batchId) || null;

    const pickEnquiry = (l) => {
        setName(l.studentName || ''); setPhone(l.parentPhone || l.phone || ''); setLeadId(l.id); setLead(l);
        const o = optionFor(options, l.courseInterest);
        if (o) { setGroup(o.group); setCourse(o.value); setBatchId(''); }
    };
    const setDisc = (v) => {
        const n = Math.max(0, Math.round(Number(v) || 0));
        if (dmode === 'pct') setPct(Math.min(100, n)); else setAmt(Math.min(tuition || n, n));
    };
    const discValue = dmode === 'pct' ? pct : amt;
    const quoteData = () => ({ finalFee: result.landingFee, discount: Math.round(discPct * 100) / 100, discountReason: reason, discountNote: note.trim(), plan, grandTotal: result.grandTotal, selectedProgram: key, standard: opt?.standard || '', batchId: batch?.id || '', batchName: batch?.name || '' });
    const planName = { FULL: 'One shot', INSTALLMENT: `${parts || ''} parts`.trim(), REG_ONLY: 'Registration first', LOAN: 'Loan EMI' }[plan];
    const courseLine = [opt?.label, batch?.name, planName].filter(Boolean).join(' · ');

    const askApproval = async () => {
        if (!name.trim()) { toast('✍️', 'Type the student name first'); return; }
        setApproval('SENDING');
        const res = await requestDiscount({ leadId, studentName: name.trim(), program: data?.name || key, originalFee: result.originalTotal, offeredFee: result.landingFee, discountPercent: Math.round(discPct * 100) / 100, reason, note: note.trim() }, userProfile);
        if (res.success) { setApproval('SENT'); setApprovalId(res.id); toast('📨', 'Sent to the Director. The quote unlocks when they approve.'); }
        else { setApproval('IDLE'); toast('⚠️', 'Could not send: ' + res.error); }
    };
    const pdf = async () => {
        const { generateAdmissionPDF } = await import('../utils/pdfGenerator');
        generateAdmissionPDF({ name: name.trim() }, { ...result, paymentPlan: plan }, plan === 'FULL' ? [] : schedule, center, refunds);
    };
    const waText = () => [
        `Fee plan for ${name.trim()} · ${courseLine}`,
        `Total ${inr(result.landingFee)}${saved ? ` (you save ${inr(saved)})` : ''}`,
        ...schedule.map(r => `${typeof r.id === 'number' ? `Part ${r.id}` : r.id}: ${inr(r.amount)} · ${nice(r.dueDate)}`),
        `Quote ${quoteNo.current} · ${userProfile?.name || 'KAP Edutech'}, Unacademy ${CENTRE_NAME[center?.id] || center?.name || 'Nashik'}`,
    ].join('\n');
    const whatsapp = () => {
        const p = String(phone).replace(/\D/g, '').slice(-10);
        window.open(`https://wa.me/${p.length === 10 ? '91' + p : ''}?text=${encodeURIComponent(waText())}`, '_blank', 'noopener');
    };
    const saveQuote = async () => {
        setSaving(true);
        const r = await saveQuoteToHistory(leadId, quoteData(), userProfile);
        toast(r.success ? '💾' : '⚠️', r.success ? 'Quote saved to the enquiry history' : 'Could not save the quote');
        setSaving(false);
    };
    const startAdmission = () => navigate('/staff/take-admission', {
        state: { lead: { ...(lead || {}), id: leadId || undefined, studentName: name.trim(), parentPhone: phone, currentGrade: cls }, quote: quoteData() },
    });

    if (feesLoading) return <div className="flex flex-col gap-4">{[0, 1, 2].map(i => <div key={i} className="j-sk h-40" />)}</div>;

    const header = (
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
                <h1 className="text-[30px] sm:text-[34px] font-extrabold tracking-tight leading-tight">Build a fee quote</h1>
                <p className="text-[13.5px]" style={{ color: 'var(--muted)' }}>Four steps. The quote on the right updates as you go.</p>
            </div>
            <Seg label="Who is looking" value={view} onChange={setView} pillBg={view === 'parent' ? '#1482D0' : 'var(--ink)'} onInk="#FFFFFF"
                options={[{ value: 'staff', label: 'Staff view' }, { value: 'parent', label: 'Parent view' }]} />
        </div>
    );

    if (view === 'parent') return (
        <div className="flex flex-col gap-4">
            {header}
            {!result ? <Card><p className="text-[14px]" style={{ color: 'var(--muted)' }}>Pick a course in the staff view first.</p></Card> : (
                <ParentView {...{ name: name.trim() || 'Your child', courseLine, result, saved, discPct, reason, schedule, data, center, userProfile, plan, quoteNo: quoteNo.current, whatsapp, pdf }} />
            )}
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            {header}
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 items-start">
                <div className="flex flex-col gap-4 min-w-0">
                    <Step n="1" title="Student" hint="Type a name or pick from today's enquiries" delay={0}>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <Field label="Student name" icon="👤"><input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="flex-1 min-w-0 text-[14.5px]" style={bare} /></Field>
                            <Field label="Parent's phone" icon="📞"><input value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d ]/g, ''))} inputMode="tel" placeholder="10-digit number" className="flex-1 min-w-0 text-[14.5px]" style={bare} /></Field>
                        </div>
                        {enquiries.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>Enquiries:</span>
                                {enquiries.map(l => <Chip key={l.id} on={leadId === l.id} tone="var(--t-sage)" onClick={() => pickEnquiry(l)}>{leadId === l.id ? '✓ ' : ''}{l.studentName || 'No name'}</Chip>)}
                            </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>Studying in:</span>
                            {CLASSES.map(c => <Chip key={c} on={cls === c} onClick={() => setCls(cls === c ? '' : c)}>{c}</Chip>)}
                        </div>
                    </Step>

                    <Step n="2" title="Course and batch" hint={`${shownOptions.length} ${group} courses${matching.length ? ` · ${matching.length} batches` : ''}`} delay={40}>
                        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                            <div className="max-w-full overflow-x-auto"><Seg label="Course group" value={group} onChange={(g) => { setGroup(g); setQ(''); }} pillBg="var(--ink)" onInk="var(--on-ink)" options={groups.map(g => ({ value: g, label: g }))} /></div>
                            <label className="flex items-center gap-2 flex-1 rounded-full px-4 h-[44px]" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}>
                                <span aria-hidden="true">🔎</span><span className="sr-only">Search courses</span>
                                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search course" className="flex-1 min-w-0 text-[14px]" style={bare} />
                            </label>
                        </div>
                        <p className="mt-3 text-[12.5px] font-semibold inline-block rounded-full px-3 py-1" style={{ background: 'var(--t-blue)' }}>📍 {isPrayas ? 'Prayaas fees' : 'College Road and Nashik Road fees'} · change the centre at the top</p>
                        <div className="flex flex-col gap-2 mt-3">
                            {shownOptions.map((o, i) => {
                                const on = o.value === course, f = feeStructures[o.key] || {};
                                return (
                                    <button key={o.value} type="button" onClick={() => { setCourse(o.value); setBatchId(''); }} aria-pressed={on}
                                        className="jb-rise w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-left transition-shadow"
                                        style={{ animationDelay: `${i * 30}ms`, ...(on ? { background: 'var(--panel)', boxShadow: '0 0 0 2px var(--ink), 0 8px 20px rgba(29,42,34,.08)' } : { background: 'var(--cream)' }) }}>
                                        <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ boxShadow: `inset 0 0 0 2px ${on ? 'var(--ink)' : 'var(--line)'}` }}>
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--ink)', transform: `scale(${on ? 1 : 0})`, transition: 'transform .3s cubic-bezier(.34,1.56,.64,1)' }} />
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <b className="block text-[14.5px]">{o.label}</b>
                                            <span className="block text-[12px]" style={{ color: 'var(--muted)' }}>{f.name}{Number(f.installments) ? ` · up to ${f.installments} parts` : ''}</span>
                                        </span>
                                        <b className="text-[15px] whitespace-nowrap">{inr(f.total)}</b>
                                    </button>
                                );
                            })}
                            {shownOptions.length === 0 && <p className="p-3.5 rounded-2xl text-center text-[13px]" style={{ background: 'var(--cream)', color: 'var(--muted)' }}>No course matches. Clear the search or pick another group.</p>}
                        </div>
                        {opt && (
                            <div className="mt-4">
                                <p className="text-[12.5px] font-bold mb-2">Batch <span className="font-medium" style={{ color: 'var(--muted)' }}>· optional, can be set later</span></p>
                                {matching.length === 0 ? <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No batch made for this course yet at this centre.</p> : (
                                    <div className="grid sm:grid-cols-2 gap-2">
                                        {matching.map(b => {
                                            const cap = Number(b.capacity || b.totalSeats) || 0, taken = enrolled[b.name] || 0, left = cap ? cap - taken : null, full = left !== null && left <= 0, on = b.id === batchId;
                                            return (
                                                <button key={b.id} type="button" disabled={full} onClick={() => setBatchId(on ? '' : b.id)} aria-pressed={on}
                                                    className="text-left px-3.5 py-3 rounded-2xl disabled:opacity-55 disabled:cursor-not-allowed"
                                                    style={on ? { background: 'var(--panel)', boxShadow: '0 0 0 2px var(--ink)' } : { background: 'var(--cream)' }}>
                                                    <b className="block text-[13.5px] truncate">{b.name}</b>
                                                    <span className="block text-[11.5px]" style={{ color: 'var(--muted)' }}>{CENTRE_NAME[b.centerId] || b.centerId || ''}{b.startDate ? ` · starts ${new Date(b.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</span>
                                                    {left !== null && (<>
                                                        <span className="block text-[12px] font-bold mt-1.5" style={{ color: full ? 'var(--late)' : left <= 6 ? '#A0620F' : 'var(--ok)' }}>{full ? 'Full · waitlist' : `${left} seats left`}</span>
                                                        <span className="block h-[5px] rounded-md mt-1 overflow-hidden" style={{ background: 'var(--track)' }}><span className="block h-full rounded-md" style={{ width: `${Math.min(100, (taken / cap) * 100)}%`, background: full ? 'var(--late)' : left <= 6 ? '#E0A43A' : 'var(--ok)' }} /></span>
                                                    </>)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </Step>

                    <Step n="3" title="Discount" hint="On tuition only · books, tests and registration stay full" delay={80}>
                        <div className="flex flex-wrap items-center gap-3">
                            <Seg label="Discount in" value={dmode} onChange={setDmode} pillBg="var(--ink)" onInk="var(--on-ink)" options={[{ value: 'pct', label: '%' }, { value: 'amt', label: '₹ amount' }]} />
                            <div className="flex flex-wrap gap-1.5 rounded-full p-1" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}>
                                {(dmode === 'pct' ? PCTS : AMTS).map(v => {
                                    const on = discValue === v;
                                    return <button key={v} type="button" onClick={() => setDisc(v)} aria-pressed={on} className="rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors"
                                        style={on ? { background: discPct > MAX_DISCOUNT_LIMIT ? 'var(--late)' : 'var(--coral)', color: '#FFFFFF' } : {}}>{v === 0 ? 'None' : dmode === 'pct' ? `${v}%` : `${v / 1000}k`}</button>;
                                })}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                            <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>Or type:</span>
                            <span className="inline-flex items-center gap-1 rounded-full p-1" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}>
                                <button type="button" aria-label="Less" onClick={() => setDisc(discValue - (dmode === 'pct' ? 1 : 1000))} className="w-8 h-8 rounded-full font-bold" style={{ background: 'var(--cream)' }}>−</button>
                                {dmode === 'amt' && <span className="pl-2 font-bold">₹</span>}
                                <input aria-label="Discount" inputMode="numeric" value={String(discValue)} onChange={e => setDisc(e.target.value.replace(/\D/g, ''))} className="w-20 text-center text-[16px] font-extrabold" style={bare} />
                                {dmode === 'pct' && <span className="pr-2 font-bold">%</span>}
                                <button type="button" aria-label="More" onClick={() => setDisc(discValue + (dmode === 'pct' ? 1 : 1000))} className="w-8 h-8 rounded-full font-bold" style={{ background: 'var(--cream)' }}>+</button>
                            </span>
                            {result && <span className="rounded-full px-3 py-1.5 text-[13px] font-bold" style={{ background: 'var(--t-sage)' }}>= {inr(saved)} off · {Math.round(discPct * 10) / 10}% of tuition</span>}
                        </div>
                        <p className="text-[12.5px] font-bold mt-4 mb-2">Reason</p>
                        <div className="flex flex-wrap gap-2">{REASONS.map(r => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}</div>
                        <label className="block mt-3">
                            <span className="text-[12.5px] font-bold">Write the reason</span> <span className="text-[12.5px]" style={needsNote ? { color: 'var(--late)', fontWeight: 700 } : { color: 'var(--muted)' }}>· needed for any discount</span>
                            <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Scored 92% in Class 10 boards, sister studies here (NEET 1Y)"
                                className="jb-input mt-1.5" style={needsNote ? { boxShadow: '0 0 0 2px var(--late)' } : {}} />
                        </label>
                        {discPct > MAX_DISCOUNT_LIMIT && (
                            <div className="jb-rise mt-3 flex flex-wrap items-center gap-3 px-3.5 py-3 rounded-2xl" style={{ background: '#FCEDE7', color: '#752A18' }}>
                                <span aria-hidden="true" className="text-[20px]">🔐</span>
                                <span className="flex-1 min-w-[180px]"><b className="block text-[13.5px]">Above {MAX_DISCOUNT_LIMIT}% needs the Director's OK</b><span className="text-[12.5px]">The quote stays locked until it is approved.</span></span>
                                {approval === 'APPROVED' ? <span className="font-bold text-[13px]">✅ Approved</span>
                                    : approval === 'SENT' ? <span className="font-bold text-[13px]">⏳ Waiting for the Director</span>
                                        : <button type="button" onClick={askApproval} disabled={approval === 'SENDING'} className="jb-act jb-act-ink !py-2">{approval === 'SENDING' ? 'Sending…' : 'Ask for approval'}</button>}
                            </div>
                        )}
                    </Step>

                    <Step n="4" title="Payment plan" hint="Click a plan, the totals are for this course and discount" delay={120}>
                        {!result ? <p className="text-[13px]" style={{ color: 'var(--muted)' }}>Pick a course to see the plans.</p> : (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                                {[['FULL', '💰', 'One shot', 'Pay everything today'], ['INSTALLMENT', '🗓️', `${parts || 'In'} parts`, `${scheduleFor('INSTALLMENT').length} payments, dates set in Fee structures`],
                                    ['REG_ONLY', '🧾', 'Registration first', `${inr(data?.reg)} today, rest in parts`], ['LOAN', '🏦', 'Loan EMI', '25% now, rest via bank']].map(([p, e, l, sub]) => {
                                    const on = plan === p, today = p === 'FULL' ? result.landingFee : (scheduleFor(p)[0]?.amount || 0);
                                    return (
                                        <button key={p} type="button" onClick={() => setPlan(p)} aria-pressed={on} className="text-left rounded-[18px] p-3.5 transition-all"
                                            style={on ? { background: 'var(--panel)', boxShadow: '0 0 0 2px var(--ink), 0 8px 20px rgba(29,42,34,.08)', transform: 'translateY(-2px)' } : { background: 'var(--cream)', boxShadow: '0 0 0 1px var(--line)' }}>
                                            <b className="block text-[13.5px]">{e} {l}</b>
                                            <b className="block text-[20px] font-extrabold mt-1.5">{inr(result.landingFee)}</b>
                                            <span className="block text-[12px]" style={{ color: 'var(--muted)' }}>{sub}</span>
                                            <span className="inline-block mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: on ? 'var(--cream2)' : 'var(--t-sage)' }}>{on ? 'Selected' : `Today ${inr(today)}`}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </Step>
                </div>

                <aside className="flex flex-col gap-4 min-w-0 xl:sticky xl:top-4">
                    <section className="jb-rise rounded-[24px] overflow-hidden" style={{ background: 'var(--panel)', boxShadow: 'var(--sh)' }}>
                        <div className="p-5 flex items-center gap-4" style={{ background: '#1F2A22', color: '#FFFFFF' }}>
                            <div className="flex-1 min-w-0">
                                <p className="text-[12px] opacity-80">Quote for</p>
                                <b className="block text-[19px] truncate">{name.trim() || 'Student name'}</b>
                                <p className="text-[12.5px] opacity-80 truncate">{courseLine || 'Pick a course'}</p>
                                <b className="block text-[34px] font-extrabold tracking-tight mt-2"><Count value={result?.landingFee || 0} format={inr} /></b>
                            </div>
                            <Dial pct={discPct} size={110} on={discPct > MAX_DISCOUNT_LIMIT ? '#F0B49D' : '#F6E7AE'}>
                                <b className="block text-[22px]">{Math.round(discPct)}%</b><span className="text-[11px] opacity-80">off tuition</span>
                            </Dial>
                        </div>
                        {result && (
                            <div className="p-5 flex flex-col gap-2 text-[14px]">
                                {[['Tuition', inr(result.tuitionFee)], ['Books and tests', inr((Number(data.tech) || 0) + (Number(data.exam) || 0))], ['Registration', inr(data.reg)]].map(([l, v]) => (
                                    <div key={l} className="flex justify-between pb-2" style={{ borderBottom: '1px dashed var(--line)' }}><span style={{ color: 'var(--muted)' }}>{l}</span><b>{v}</b></div>
                                ))}
                                {saved > 0 && <div className="flex justify-between pb-2" style={{ borderBottom: '1px dashed var(--line)' }}><span style={{ color: 'var(--muted)' }}>Discount · {reason.toLowerCase()}</span><b style={{ color: 'var(--ok)' }}>−{inr(saved)}</b></div>}
                                <div className="flex justify-between pt-1"><b>Total to pay</b><b className="text-[19px]">{inr(result.landingFee)}</b></div>
                            </div>
                        )}
                    </section>

                    {result && (
                        <Card title="When to pay" delay={60}>
                            <div className="flex flex-col gap-2.5">
                                {schedule.map((r, i) => (
                                    <div key={i} className="jb-rise flex items-center gap-3" style={{ animationDelay: `${i * 70}ms` }}>
                                        <span className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[12.5px] font-extrabold shrink-0" style={{ background: i === 0 ? 'var(--ink)' : 'var(--cream2)', color: i === 0 ? 'var(--on-ink)' : 'var(--ink)' }}>{i + 1}</span>
                                        <span className="flex-1 min-w-0"><b className="block text-[14px]">{typeof r.id === 'number' ? (i === 0 ? 'Registration and first part' : `Part ${r.id}`) : r.id}</b><span className="text-[12px]" style={{ color: 'var(--muted)' }}>{nice(r.dueDate)}</span></span>
                                        <b className="text-[15px]">{inr(r.amount)}</b>
                                    </div>
                                ))}
                            </div>
                            {refunds?.length > 0 && <p className="mt-3 text-[12px] px-3 py-2 rounded-xl" style={{ background: 'var(--cream)', color: 'var(--muted)' }}>Refund rule: {refunds[0].period}, {refunds[0].deduction} is kept.</p>}
                        </Card>
                    )}

                    <div className="grid grid-cols-2 gap-2.5">
                        <button type="button" disabled={!result} onClick={() => setView('parent')} className="jb-act jb-act-soft justify-center !py-3 disabled:opacity-50">👨‍👩‍👧 Show parent view</button>
                        <button type="button" disabled={!canQuote} onClick={whatsapp} className="jb-act justify-center !py-3 disabled:opacity-50" style={{ background: '#63B868', color: '#FFFFFF' }}>Send on WhatsApp</button>
                        <button type="button" disabled={!canQuote} onClick={pdf} className="jb-act jb-act-soft justify-center !py-3 disabled:opacity-50">⬇️ Quote PDF</button>
                        <button type="button" disabled={!canQuote || !leadId || saving} onClick={saveQuote} title={leadId ? '' : 'Pick an enquiry to save the quote to it'} className="jb-act jb-act-soft justify-center !py-3 disabled:opacity-50">{saving ? 'Saving…' : '💾 Save to enquiry'}</button>
                        <button type="button" disabled={!canQuote} onClick={startAdmission} className="col-span-2 jb-act jb-act-ink justify-center !py-3.5 disabled:opacity-50">Start admission with this quote →</button>
                    </div>
                    {!canQuote && result && <p className="text-[12.5px] -mt-2" style={{ color: 'var(--muted)' }}>{!name.trim() ? 'Type the student name to send or start the admission.' : needsNote ? 'Write the reason for the discount to unlock the quote.' : needsApproval ? 'Waiting for the Director to approve the discount.' : ''}</p>}
                </aside>
            </div>
        </div>
    );
};

const ParentView = ({ name, courseLine, result, saved, discPct, reason, schedule, data, center, userProfile, quoteNo, whatsapp, pdf }) => {
    const first = name.split(' ')[0];
    const valid = new Date(Date.now() + 6 * 864e5).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const books = (Number(data.tech) || 0) + (Number(data.exam) || 0);
    const split = [['🧑‍🏫', 'Classes (tuition)', result.tuitionFee, '#8DC0E8'], ['📚', 'Books and tests', books, '#A9C1DD'], ['🧾', 'Registration', Number(data.reg) || 0, '#EED585'], ['🎓', 'Scholarship', -saved, '#63B868']].filter(r => r[2] !== 0);
    const max = result.originalTotal || 1;
    return (
        <section className="jb-rise rounded-[28px] overflow-hidden" style={{ background: '#FFFFFF', color: '#1F2A33', boxShadow: 'var(--sh)' }}>
            <header className="flex flex-wrap items-center gap-4 px-5 sm:px-6 py-4" style={{ borderBottom: '1px solid #EEF1F4' }}>
                <img src={unacademyLogo} alt="Unacademy" className="h-7 w-auto" />
                <span className="pl-4" style={{ borderLeft: '1px solid #E3E8EC' }}><b className="block text-[15px]">Nashik Centre</b><span className="text-[12px]" style={{ color: '#5B6770' }}>{CENTRE_NAME[center?.id] || center?.name || 'Nashik'} · run by KAP Edutech</span></span>
                <span className="ml-auto flex gap-2 text-[12.5px] font-bold"><span className="px-3 py-1.5 rounded-full" style={{ background: '#F1F3F5' }}>Quote {quoteNo}</span><span className="px-3 py-1.5 rounded-full" style={{ background: '#E1EFFA', color: '#1467A8' }}>Valid till {valid}</span></span>
            </header>
            <div className="grid lg:grid-cols-2 gap-5 p-5 sm:p-6">
                <div className="flex flex-col gap-4 min-w-0">
                    <div className="rounded-[22px] p-5 flex items-center gap-4" style={{ background: '#EEF6EE' }}>
                        <div className="flex-1 min-w-0">
                            <p className="text-[12.5px]" style={{ color: '#5B6770' }}>Fee plan for</p>
                            <b className="block text-[22px] truncate">{name}</b>
                            <p className="text-[13px]" style={{ color: '#5B6770' }}>{courseLine}</p>
                            <b className="block text-[38px] font-extrabold tracking-tight mt-1"><Count value={result.landingFee} format={inr} /></b>
                            {saved > 0 && <p className="text-[13px]"><s style={{ color: '#8A949B' }}>{inr(result.originalTotal)}</s> · you save <b style={{ color: '#3E8E44' }}>{inr(saved)}</b></p>}
                            {saved > 0 && <span className="inline-block mt-2 text-[12.5px] font-bold px-3 py-1 rounded-full" style={{ background: '#FFFFFF', color: '#3E8E44', boxShadow: '0 0 0 1px #CFE3CF' }}>🎓 {Math.round(discPct)}% {reason.toLowerCase()} scholarship</span>}
                        </div>
                        {saved > 0 && <Dial pct={discPct} size={130} on="#63B868" off="#DCEBDD"><b className="block text-[26px]">{Math.round(discPct)}%</b><span className="text-[12px]" style={{ color: '#5B6770' }}>saved</span></Dial>}
                    </div>
                    <div className="rounded-[22px] p-5" style={{ boxShadow: '0 0 0 1px #EEF1F4' }}>
                        <b className="block text-[15px] mb-3">Where the fee goes</b>
                        {split.map(([e, l, v, c]) => (
                            <div key={l} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] items-center gap-3 py-1.5 text-[13.5px]">
                                <span className="truncate">{e} {l}</span>
                                <span className="h-[8px] rounded-full overflow-hidden" style={{ background: '#EEF1F4' }}><span className="block h-full rounded-full jb-growx" style={{ width: `${Math.abs(v) / max * 100}%`, background: c, transformOrigin: 'left' }} /></span>
                                <b className="text-right" style={{ color: v < 0 ? '#3E8E44' : undefined }}>{v < 0 ? '−' : ''}{inr(Math.abs(v))}</b>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-[22px] p-5" style={{ boxShadow: '0 0 0 1px #EEF1F4' }}>
                        <div className="flex justify-between items-center mb-3"><b className="text-[15px]">When to pay</b><span className="text-[12px]" style={{ color: '#5B6770' }}>🔔 Reminder 2 weeks before each date</span></div>
                        <div className="flex flex-col gap-2">
                            {schedule.map((r, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="w-14 text-[12.5px] font-bold shrink-0">{i === 0 ? 'Today' : nice(r.dueDate).replace(/ \d{4}$/, '')}</span>
                                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={i === 0 ? { background: '#1482D0', boxShadow: '0 0 0 4px #D3E7F7' } : { background: '#FFFFFF', boxShadow: '0 0 0 2px #CFE0EE' }} />
                                    <span className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl min-w-0" style={{ background: i === 0 ? '#E7F2FB' : '#F5F8FB' }}>
                                        <span className="flex-1 min-w-0"><b className="block text-[13.5px] truncate">{typeof r.id === 'number' ? (i === 0 ? 'Registration and first part' : `Part ${r.id}`) : r.id}</b><span className="text-[12px]" style={{ color: '#5B6770' }}>{i === 0 ? 'Pay at the centre or by UPI' : 'We remind you before the date'}</span></span>
                                        <b className="text-[15px]">{inr(r.amount)}</b>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-4 min-w-0">
                    <div className="rounded-[22px] p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-center" style={{ background: '#12263A', color: '#FFFFFF' }}>
                        <div className="w-[190px] shrink-0 rounded-[26px] p-2" style={{ background: '#0B1A28', boxShadow: '0 0 0 2px #2A3E52' }}>
                            <div className="rounded-[20px] p-3 text-[10px]" style={{ background: '#F5F8FB', color: '#1F2A33' }}>
                                <div className="flex justify-between mb-2"><b>KAP Connect</b><span className="px-1.5 rounded-full" style={{ background: '#E3F1E4', color: '#3E8E44' }}>{first}</span></div>
                                {[['📝', 'Test marks and rank'], ['📅', 'Attendance'], ['✅', 'Homework'], ['💳', `Next fee · ${schedule[1] ? inr(schedule[1].amount) : 'paid'}`]].map(([e, t]) => (
                                    <div key={t} className="rounded-xl px-2.5 py-2 mb-1.5" style={{ background: '#FFFFFF' }}>{e} {t}</div>
                                ))}
                                <p className="text-center mt-1" style={{ color: '#8A949B' }}>Sample screen</p>
                            </div>
                        </div>
                        <div>
                            <p className="text-[12px] font-bold tracking-wider" style={{ color: '#7FD08A' }}>FREE FOR PARENTS</p>
                            <b className="block text-[22px] leading-tight mt-1">Know how {first} is doing, every day.</b>
                            <ul className="mt-3 flex flex-col gap-1.5 text-[13.5px]">{APP_POINTS.map(([e, t]) => <li key={t}>{e} {t}</li>)}</ul>
                        </div>
                    </div>
                    <div className="rounded-[22px] p-5" style={{ boxShadow: '0 0 0 1px #EEF1F4' }}>
                        <b className="block text-[15px] mb-3">What {first} gets</b>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">{GETS.map(([e, t]) => <div key={t} className="rounded-2xl p-3 text-[13px]" style={{ background: '#F5F8FB' }}><span className="block text-[20px]">{e}</span>{t}</div>)}</div>
                    </div>
                    <div className="rounded-[22px] p-4 flex flex-wrap items-center gap-3" style={{ boxShadow: '0 0 0 1px #EEF1F4' }}>
                        <Avatar name={userProfile?.name || 'KAP'} />
                        <span className="flex-1 min-w-[140px]"><b className="block text-[14px]">{userProfile?.name || 'Your counsellor'} · your counsellor</b><span className="text-[12px]" style={{ color: '#5B6770' }}>{userProfile?.phone ? `+91 ${userProfile.phone} · call or WhatsApp` : 'Call or WhatsApp the centre'}</span></span>
                        <button type="button" onClick={whatsapp} className="jb-act !py-2.5" style={{ background: '#63B868', color: '#FFFFFF' }}>Send on WhatsApp</button>
                        <button type="button" onClick={pdf} className="jb-act !py-2.5" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #E3E8EC', color: '#1F2A33' }}>PDF</button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default MainCalculator;
