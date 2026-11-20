// L2 · Accounts dashboard (design canvas board, approved 20 Nov 2026).
// Checking a payment and giving the roll number still happens on the
// admission page (FinalizeAdmission), so roll numbers keep one code path.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { subscribeAdmissions } from '../../services/cacheService';
import { hasProof, proofUrlFor } from '../../services/proofService';
import { Seg, Tile, Card, Empty, Contact, Avatar, Count, Spark, Layer } from '../../components/j';
import { inr, lakh, DAY, dayStart } from '../../components/j/util';
import {
    CENTRES, CENTRE_NAME, centreOf, inCentre, isLive, paymentsOf, createdMs, rangeFor, inRange,
    collectedIn, sparkBuckets, phoneOf, balanceOf, programLabel, ago, dateLabel,
} from '../j/data';
import { parseDay } from '../../utils/recovery';

const PERIODS = [{ value: 'TODAY', label: 'Today' }, { value: 'MONTH', label: 'This month' }, { value: 'SESSION', label: 'Session' }];
const QUEUE = ['TOKEN_PAID', 'CONVERTED', 'PENDING_APPROVAL'];
const MODES = [
    { key: 'UPI', e: '📱', n: 'UPI', test: m => m.includes('UPI') || m.includes('GPAY') || m.includes('PHONEPE') || m.includes('ONLINE'), c: '#5F86B3', bg: 'var(--t-blue)' },
    { key: 'CASH', e: '💵', n: 'Cash', test: m => m.includes('CASH'), c: 'var(--ok)', bg: 'var(--t-sage)' },
    { key: 'BANK', e: '🏦', n: 'Bank transfer', test: m => /NEFT|RTGS|IMPS|BANK|TRANSFER/.test(m), c: '#7E9CC0', bg: 'var(--t-lilac)' },
    { key: 'CHEQUE', e: '🧾', n: 'Cheque', test: m => m.includes('CHEQUE') || m.includes('CHECK'), c: 'var(--coral)', bg: 'var(--t-coral)' },
    { key: 'CARD', e: '💳', n: 'Card or loan', test: m => /CARD|LOAN|EMI|FINANCE/.test(m), c: '#B08A2E', bg: 'var(--t-butter)' },
];
const modeOf = (m) => MODES.find(x => x.test(String(m || '').toUpperCase())) || { key: 'OTHER', e: '💰', n: 'Other', c: 'var(--muted)', bg: 'var(--cream2)' };
const STAGES = ['Enquiry', 'Quote', 'Paid', 'Verified', 'Admitted'];

// Side drawer for one payment: what came in, proof, checks, then open the
// admission to verify and give the roll number.
const Drawer = ({ a, onClose }) => {
    const navigate = useNavigate();
    const [proof, setProof] = useState(null);
    const pays = paymentsOf(a);
    const last = pays[pays.length - 1];
    const m = modeOf(last?.mode);
    const at = a.rollNumber ? 4 : (a.status === 'ACTIVE' || a.status === 'COMPLETED') ? 3 : pays.length ? 2 : 1;
    const proofOk = last && hasProof(last.raw, a);
    useEffect(() => {
        let live = true;
        if (last && proofOk) proofUrlFor(last.raw, a).then(u => { if (live) setProof(u); }).catch(() => {});
        return () => { live = false; };
    }, [a, last, proofOk]);
    useEffect(() => {
        const k = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, [onClose]);
    const checks = [
        [`Amount entered: ${inr(last?.amount)} of ${inr(a.amount)} fee`, !!last],
        [m.key === 'CASH' ? 'Cash counted and entered in the day book' : m.key === 'CHEQUE' ? 'Cheque date and signature look fine' : 'Reference found in the bank statement', m.key === 'CHEQUE' ? null : !!last],
        ['Payment proof attached', proofOk],
        ['Parent phone on file', !!phoneOf(a)],
    ];
    return (
        <Layer>
            <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 z-[70] shell-fade" style={{ background: 'rgba(17,25,21,.32)' }} />
            <aside aria-label="Payment check" role="dialog" aria-modal="true"
                className="fixed z-[71] top-0 right-0 bottom-0 w-full max-w-[440px] overflow-y-auto shell-slide-in p-6"
                style={{ background: 'var(--panel)', color: 'var(--ink)', boxShadow: '-10px 0 30px rgba(29,42,34,.18)' }}>
                <div className="flex items-center gap-3">
                    <Avatar name={a.studentName} size={44} />
                    <div className="flex-1 min-w-0">
                        <p className="text-[18px] font-extrabold truncate">{a.studentName}</p>
                        <p className="text-[12.5px] truncate" style={{ color: 'var(--muted)' }}>{programLabel(a.program)} · {CENTRE_NAME[centreOf(a)]} · by {a.counsellorName || a.bookedBy || 'desk'}</p>
                    </div>
                    <Contact name={a.studentName} phone={phoneOf(a)} />
                    <button type="button" onClick={onClose} aria-label="Close" className="w-[38px] h-[38px] rounded-full" style={{ background: 'var(--cream2)' }}>✕</button>
                </div>

                <ol className="flex items-center mt-5 mb-1" aria-label={`Stage: ${STAGES[at]}`}>
                    {STAGES.map((l, i) => (
                        <li key={l} className="flex items-center" style={{ flex: i ? 1 : '0 0 auto' }}>
                            {i > 0 && <span className="h-[3px] flex-1 rounded" style={{ background: i <= at ? 'var(--ok)' : 'var(--track)' }} />}
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold"
                                style={{ background: i <= at ? 'var(--ok)' : 'var(--track)', color: i <= at ? 'var(--on-ink)' : 'var(--muted)', boxShadow: i === at ? '0 0 0 4px var(--okbg)' : 'none' }}>
                                {i < at ? '✓' : i + 1}
                            </span>
                        </li>
                    ))}
                </ol>
                <div className="flex justify-between text-[11px] font-bold mb-4" style={{ color: 'var(--muted)' }}>{STAGES.map(l => <span key={l}>{l}</span>)}</div>

                <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-2xl p-3" style={{ background: 'var(--t-sage)' }}>
                        <p className="text-[11.5px] font-bold">Amount</p><p className="text-[22px] font-extrabold">{inr(last?.amount)}</p>
                    </div>
                    <div className="rounded-2xl p-3" style={{ background: 'var(--cream)' }}>
                        <p className="text-[11.5px] font-bold" style={{ color: 'var(--muted)' }}>Paid by</p>
                        <p className="text-[14px] font-extrabold">{m.e} {last?.mode || '—'}</p>
                        <p className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{last ? `${dateLabel(last.ms)} · ${ago(last.ms)}` : 'No payment yet'}</p>
                    </div>
                </div>
                {proof ? (
                    <a href={proof} target="_blank" rel="noopener noreferrer" className="mt-2.5 block rounded-2xl overflow-hidden" style={{ background: 'var(--cream)' }}>
                        <img src={proof} alt="Payment proof" className="w-full max-h-[220px] object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        <span className="block text-center text-[12.5px] font-bold py-2">Open proof ↗</span>
                    </a>
                ) : (
                    <div className="jb-proof mt-2.5 rounded-2xl h-[110px] flex items-center justify-center gap-2.5 text-[13px] font-bold">
                        <span aria-hidden="true" className="text-[22px]">🧾</span>{proofOk ? 'Loading proof…' : 'No proof uploaded'}
                    </div>
                )}

                <p className="mt-4 mb-2 text-[12px] font-bold tracking-[.06em] uppercase" style={{ color: 'var(--muted)' }}>Checks</p>
                {checks.map(([l, ok], i) => (
                    <div key={l} className="flex items-center gap-2.5 py-1.5 text-[13.5px]">
                        <span className="jb-pop w-[22px] h-[22px] rounded-[7px] flex items-center justify-center text-[12px] font-extrabold shrink-0"
                            style={{ animationDelay: `${200 + i * 110}ms`, background: ok ? 'var(--ok)' : 'var(--t-butter)', color: ok ? 'var(--on-ink)' : 'var(--butter-ink)' }}>
                            {ok ? '✓' : '!'}
                        </span>
                        <span className="flex-1">{l}{ok === null ? ' (check by hand)' : ''}</span>
                    </div>
                ))}

                <div className="mt-3.5 p-3.5 rounded-[18px] flex items-center gap-3" style={{ background: 'var(--cream)' }}>
                    <span aria-hidden="true" className="text-[20px]">🎫</span>
                    <div className="flex-1">
                        <p className="text-[12px]" style={{ color: 'var(--muted)' }}>Roll number</p>
                        {a.rollNumber
                            ? <p className="text-[20px] font-extrabold tracking-[.08em]">{a.rollNumber}</p>
                            : <p className="text-[14px] font-bold" style={{ color: 'var(--muted)' }}>Given the moment you verify</p>}
                    </div>
                </div>

                <div className="flex gap-2 mt-5">
                    <button type="button" className="jb-act jb-act-ink flex-1 justify-center !py-3" onClick={() => navigate(`/staff/admission/${a.id}`)}>
                        Verify and admit →
                    </button>
                    <Link to={`/staff/student/${a.id}`} className="jb-act jb-act-line !py-3">Profile</Link>
                </div>
                <p className="text-[12px] mt-2 text-center" style={{ color: 'var(--muted)' }}>Opens the admission page, where the payment is verified and the roll number is given.</p>
            </aside>
        </Layer>
    );
};

const AccountsHome = ({ onFullTools }) => {
    const [centre, setCentre] = useState('ALL');
    const [period, setPeriod] = useState('MONTH');
    const [tab, setTab] = useState('VERIFY');
    const [admissions, setAdmissions] = useState(null);
    const [sel, setSel] = useState(null);
    const [month, setMonth] = useState(5);
    const now = Date.now();

    useEffect(() => subscribeAdmissions('ALL', (d) => setAdmissions(d || [])), []);

    const v = useMemo(() => {
        const all = (admissions || []).filter(a => inCentre(a, centre));
        const live = all.filter(isLive);
        const range = rangeFor(period, now);
        const queue = all.filter(a => QUEUE.includes(a.status)).sort((x, y) => (createdMs(x) || 0) - (createdMs(y) || 0));
        const cheques = live.flatMap(a => paymentsOf(a).filter(p => modeOf(p.mode).key === 'CHEQUE' && p.ms > now - 45 * DAY).map(p => ({ a, p })))
            .sort((x, y) => y.p.ms - x.p.ms);
        const refunds = all.filter(a => a.status === 'REFUNDED' || Number(a.refundAmount) > 0);

        const collected = collectedIn(live, range);
        const outstanding = live.reduce((x, a) => x + balanceOf(a), 0);
        const dueInRange = live.filter(a => { const d = parseDay(a.nextPaymentDate); return d != null && d < range[1]; }).reduce((x, a) => x + balanceOf(a), 0);
        const promised = live.filter(a => { const d = parseDay(a.promisedDate); return d != null && d >= dayStart(now); }).reduce((x, a) => x + balanceOf(a), 0);
        const pays = live.flatMap(a => paymentsOf(a).filter(p => inRange(p.ms, range)).map(p => ({ ...p, a })));
        const buckets = sparkBuckets(period, now);

        const by = {};
        pays.forEach(p => {
            const n = p.a.counsellorName || p.a.bookedBy || 'Front desk';
            by[n] = by[n] || { n, v: 0, c: 0 }; by[n].v += p.amount; by[n].c += 1;
        });
        const coun = Object.values(by).sort((x, y) => y.v - x.v).slice(0, 5);

        const landed = {};
        pays.forEach(p => { const m = modeOf(p.mode); landed[m.key] = landed[m.key] || { ...m, v: 0, cnt: 0 }; landed[m.key].v += p.amount; landed[m.key].cnt += 1; });
        const accts = Object.values(landed).sort((x, y) => y.v - x.v).map(m => ({
            ...m, spark: buckets.map(b => live.reduce((x, a) => x + paymentsOf(a).filter(p => modeOf(p.mode).key === m.key && inRange(p.ms, b)).reduce((y, p) => y + p.amount, 0), 0)),
        }));

        const d = new Date(now);
        const months = Array.from({ length: 6 }, (_, i) => {
            const r = [new Date(d.getFullYear(), d.getMonth() - 5 + i, 1).getTime(), new Date(d.getFullYear(), d.getMonth() - 4 + i, 1).getTime()];
            const booked = live.filter(a => inRange(createdMs(a), r)).reduce((x, a) => x + (Number(a.amount) || 0), 0);
            const got = collectedIn(live, r);
            return { l: new Date(r[0]).toLocaleDateString('en-IN', { month: 'short' }), booked, got, n: live.filter(a => inRange(createdMs(a), r)).length };
        });

        return {
            queue, cheques, refunds, collected, outstanding, dueInRange, promised, coun, accts, months, payCount: pays.length,
            spark: buckets.map(b => collectedIn(live, b)),
            todayIn: collectedIn(live, rangeFor('TODAY', now)),
        };
    }, [admissions, centre, period, now]);

    const loading = admissions === null;
    const pctIn = v.collected + v.dueInRange > 0 ? Math.round((v.collected / (v.collected + v.dueInRange)) * 100) : 100;
    const maxCoun = Math.max(1, ...v.coun.map(c => c.v));
    const maxMonth = Math.max(1, ...v.months.map(m => Math.max(m.booked, m.got)));
    const rows = tab === 'VERIFY' ? v.queue : tab === 'CHEQUES' ? v.cheques : v.refunds;
    const periodWord = { TODAY: 'today', MONTH: 'this month', SESSION: 'this session' }[period];
    const TICKS = 40;

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col 2xl:flex-row 2xl:items-end justify-between gap-4 jb-rise">
                <div>
                    <h2 className="jb-h text-[32px] sm:text-[40px] leading-tight">Accounts</h2>
                    <p className="jb-sub text-[14px] mt-1">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {centre === 'ALL' ? 'all centres' : CENTRE_NAME[centre]}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Seg label="Centre" options={CENTRES} value={centre} onChange={setCentre} />
                    <Seg label="Period" options={PERIODS} value={period} onChange={setPeriod} pillBg="var(--ink)" onInk="var(--on-ink)" />
                    {onFullTools && <button type="button" className="jb-act jb-act-line" onClick={onFullTools}>🛠️ Full ledger</button>}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col gap-4" aria-busy="true"><div className="jb-grid4"><div className="jb-sk h-36" /><div className="jb-sk h-36" /><div className="jb-sk h-36" /><div className="jb-sk h-36" /></div><div className="jb-sk h-96" /></div>
            ) : (<>
                <div className="jb-grid4">
                    <Tile tone="sage" title="Collected" emoji="💰" spark={v.spark} value={<Count value={v.collected} format={inr} />} sub={`${v.payCount} payments ${periodWord}`} />
                    <Tile tone="blue" title="Money in today" emoji="📥" delay={60} value={<Count value={v.todayIn} format={inr} />} sub="All modes, all desks" />
                    <Tile tone="coral" title="Still to collect" emoji="⏰" delay={120} value={<Count value={v.outstanding} format={lakh} />} sub="Balance across live admissions" />
                    <div className="jb-rise flex flex-col rounded-[24px] p-5" style={{ background: 'var(--pine)', color: '#FFFFFF', animationDelay: '180ms', minHeight: 150 }}>
                        <div className="flex justify-between items-center"><span className="text-[13px] font-bold" style={{ color: '#C9D8BC' }}>Waiting for you</span><span aria-hidden="true" className="text-[20px]">✅</span></div>
                        <p className="text-[40px] font-extrabold leading-none mt-2"><Count value={v.queue.length} /></p>
                        <p className="text-[12.5px] mt-0.5 mb-3" style={{ color: '#DCE8D2' }}>payments to check before admission</p>
                        <button type="button" className="jb-act mt-auto self-start" style={{ background: '#FFFFFF', color: '#1D2A22' }}
                            disabled={!v.queue.length} onClick={() => { setTab('VERIFY'); setSel(v.queue[0]); }}>
                            {v.queue.length ? 'Start checking →' : 'All clear 🎉'}
                        </button>
                    </div>
                </div>

                <div className="jb-grid21">
                    <Card title="Check and clear" sub="Roll number is given only after you verify the payment" delay={120}
                        right={<Seg size="sm" label="Queues" value={tab} onChange={setTab} pillBg="var(--panel)" className="!shadow-none !bg-[var(--cream2)]"
                            options={[{ value: 'VERIFY', label: `To verify ${v.queue.length}` }, { value: 'CHEQUES', label: `Cheques ${v.cheques.length}` }, { value: 'REFUNDS', label: `Refunds ${v.refunds.length}` }]} />}>
                        <ul className="flex flex-col gap-1 min-h-[300px]" key={tab}>
                            {rows.length === 0 && <Empty>All clear here. Nice work.</Empty>}
                            {rows.slice(0, 12).map((r, i) => {
                                const a = r.a || r;
                                const p = r.p || paymentsOf(a).slice(-1)[0];
                                const m = modeOf(p?.mode);
                                const amt = tab === 'REFUNDS' ? Number(a.refundAmount) || 0 : p?.amount || 0;
                                return (
                                    <li key={a.id + (p?.ms || '') + i} className="jb-row jb-rise flex items-center gap-3 px-2.5 py-2.5 rounded-2xl" style={{ animationDelay: `${i * 40}ms` }}>
                                        <Avatar name={a.studentName} size={38} />
                                        <div className="flex-1 min-w-0">
                                            <b className="text-[14px]">{a.studentName}</b>
                                            <p className="text-[12px] truncate" style={{ color: 'var(--muted)' }}>{programLabel(a.program)} · {CENTRE_NAME[centreOf(a)]} · {a.counsellorName || a.bookedBy || 'desk'}</p>
                                        </div>
                                        <div className="hidden sm:block text-right min-w-[110px]">
                                            <span className="jb-tag" style={{ background: m.bg, color: 'var(--ink)' }}>{m.e} {m.n}</span>
                                            <p className="text-[11.5px] mt-1" style={{ color: 'var(--muted)' }}>{p ? ago(p.ms, now) : ''}</p>
                                        </div>
                                        <b className="text-[15px] min-w-[76px] text-right">{inr(amt)}</b>
                                        <Contact name={a.studentName} phone={phoneOf(a)} size="sm" />
                                        {tab === 'VERIFY' && <button type="button" className="jb-act jb-act-ink" onClick={() => setSel(a)} aria-label={`Review ${a.studentName}`}>Review →</button>}
                                        {tab !== 'VERIFY' && <Link className="jb-act jb-act-soft" to={`/staff/student/${a.id}`}>Open</Link>}
                                    </li>
                                );
                            })}
                        </ul>
                    </Card>

                    <div className="flex flex-col gap-4">
                        <Card title="Collected so far" right={<span className="text-[12px]" style={{ color: 'var(--muted)' }}>{periodWord}</span>} delay={180}>
                            <div className="relative w-[200px] h-[190px] mx-auto">
                                <svg viewBox="0 0 150 150" width="200" height="200" aria-hidden="true" className="absolute -top-1.5 left-0">
                                    {Array.from({ length: TICKS }, (_, i) => {
                                        const ang = (-220 / 2 + (i / (TICKS - 1)) * 220 - 90) * Math.PI / 180;
                                        const on = i / (TICKS - 1) <= pctIn / 100;
                                        return <line key={i} x1={75 + Math.cos(ang) * 52} y1={75 + Math.sin(ang) * 52} x2={75 + Math.cos(ang) * 64} y2={75 + Math.sin(ang) * 64}
                                            strokeWidth="3.2" strokeLinecap="round" className="jb-pop" style={{ stroke: on ? 'var(--ok)' : 'var(--track)', animationDelay: `${i * 18}ms` }} />;
                                    })}
                                </svg>
                                <div role="img" aria-label={`${pctIn}% of what was due came in`} className="absolute inset-0 flex flex-col items-center justify-center pt-1.5">
                                    <p className="text-[38px] font-extrabold tracking-[-.03em]"><Count value={pctIn} />%</p>
                                    <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>of {lakh(v.collected + v.dueInRange)} due</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                                <div className="rounded-[14px] px-2.5 py-2" style={{ background: 'var(--t-sage)' }}><p className="text-[11.5px] font-bold">Collected</p><b className="text-[14px]">{lakh(v.collected)}</b></div>
                                <div className="rounded-[14px] px-2.5 py-2" style={{ background: 'var(--t-coral)' }}><p className="text-[11.5px] font-bold">Still due</p><b className="text-[14px]">{lakh(v.dueInRange)}</b></div>
                                <div className="rounded-[14px] px-2.5 py-2" style={{ background: 'var(--t-butter)' }}><p className="text-[11.5px] font-bold">Promised</p><b className="text-[14px]">{lakh(v.promised)}</b></div>
                            </div>
                        </Card>
                        <Card title="Collected by" right={<span className="text-[12px]" style={{ color: 'var(--muted)' }}>counsellor or desk</span>} delay={240}>
                            {v.coun.length === 0 && <Empty emoji="🌿">No payments {periodWord} yet.</Empty>}
                            <div className="flex flex-col gap-3">
                                {v.coun.map((c, i) => (
                                    <div key={c.n}>
                                        <div className="flex justify-between text-[13px] mb-1"><span>{c.n} <span style={{ color: 'var(--muted)' }}>· {c.c}</span></span><b>{lakh(c.v)}</b></div>
                                        <div className="h-2 rounded-md overflow-hidden" style={{ background: 'var(--cream2)' }}>
                                            <span className="jb-growx block h-full rounded-md" style={{ width: `${(c.v / maxCoun) * 100}%`, background: i ? 'var(--sage2)' : 'var(--ok)', animationDelay: `${i * 70}ms` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>

                <div className="jb-grid21">
                    <Card title="Booked vs collected" sub="Fees booked by new admissions each month, and money that came in" delay={280}
                        right={<div className="flex gap-3.5 text-[12.5px] items-center" style={{ color: 'var(--muted)' }}>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: 'var(--track)' }} />Booked</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: '#8FAE7B' }} />Collected</span>
                        </div>}>
                        <div className="grid grid-cols-6 gap-3.5 items-end h-[200px]">
                            {v.months.map((m, i) => (
                                <button key={m.l} type="button" onClick={() => setMonth(i)} aria-pressed={month === i}
                                    aria-label={`${m.l}: booked ${lakh(m.booked)}, collected ${lakh(m.got)}`}
                                    className="relative h-full flex items-end justify-center gap-1 rounded-xl" style={{ background: month === i ? 'var(--cream)' : 'transparent' }}>
                                    {month === i && <span className="absolute -top-1 left-1/2 -translate-x-1/2 jb-tag jb-tag-soft jb-pop whitespace-nowrap" style={{ background: 'var(--ink)', color: 'var(--on-ink)' }}>{lakh(m.got)}</span>}
                                    <span className="jb-grow w-[38%] rounded-t-md" style={{ height: `${Math.max(2, (m.booked / maxMonth) * 82)}%`, background: 'var(--track)', animationDelay: `${i * 60}ms` }} />
                                    <span className="jb-grow w-[38%] rounded-t-md" style={{ height: `${Math.max(2, (m.got / maxMonth) * 82)}%`, background: '#8FAE7B', animationDelay: `${i * 60 + 80}ms` }} />
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-6 gap-3.5 text-center text-[12px] font-semibold mt-2" style={{ color: 'var(--muted)' }}>
                            {v.months.map(m => <span key={m.l}>{m.l}</span>)}
                        </div>
                    </Card>
                    <Card title="Where money landed" sub={`By payment mode, ${periodWord}`} delay={340}>
                        {v.accts.length === 0 && <Empty emoji="🌿">No payments {periodWord} yet.</Empty>}
                        {v.accts.map(a => (
                            <div key={a.key} className="jb-lift flex items-center gap-3 px-3 py-2.5 rounded-2xl mb-2" style={{ background: 'var(--cream)' }}>
                                <span aria-hidden="true" className="w-9 h-9 rounded-xl flex items-center justify-center text-[17px]" style={{ background: a.bg }}>{a.e}</span>
                                <div className="flex-1 min-w-0"><p className="text-[13.5px] font-bold">{a.n}</p><p className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{a.cnt} payment{a.cnt === 1 ? '' : 's'}</p></div>
                                <Spark points={a.spark} color={a.c} w={64} h={24} />
                                <b className="text-[14px] min-w-[62px] text-right">{lakh(a.v)}</b>
                            </div>
                        ))}
                    </Card>
                </div>
            </>)}

            {sel && <Drawer a={sel} onClose={() => setSel(null)} />}
        </div>
    );
};

export default AccountsHome;
