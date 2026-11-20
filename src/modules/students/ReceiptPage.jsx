// Fee receipt (design canvas board "Receipt", approved 20 Nov 2026), route
// /staff/receipt/:id/:n where n is the payment's place in admissions.payments.
// Read-only: it only shows what is already saved. Print / Save as PDF uses the
// browser's print; the official GST invoice is still made from the fee window.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import QRCode from 'qrcode';
import { db } from '../../firebase';
import { CENTERS } from '../../utils/centers';
import { amountInWords } from '../../utils/amountWords';
import { Card, Contact, Empty } from '../../components/j';
import { inr, toMs } from '../../components/j/util';
import { phoneOf, programLabel, dateLabel } from '../j/data';

const longDate = (ms) => dateLabel(ms, { day: 'numeric', month: 'long', year: 'numeric' });

const ReceiptPage = () => {
    const { id, n } = useParams();
    const idx = Number(n) || 0;
    const [a, setA] = useState(undefined);
    const [qr, setQr] = useState('');
    const [err, setErr] = useState('');

    useEffect(() => onSnapshot(doc(db, 'admissions', id),
        (s) => setA(s.exists() ? { id: s.id, ...s.data() } : null),
        (e) => { console.error(e); setErr('You do not have access to this receipt, or the connection dropped.'); setA(null); }), [id]);

    const v = useMemo(() => {
        const raw = Array.isArray(a?.payments) ? a.payments : [];
        const pay = raw[idx];
        if (!a || !pay) return null;
        const fee = Number(a.amount) || 0;
        const listed = raw.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const opening = Math.max(0, (Number(a.totalPaid) || 0) - listed); // paid before payments were itemised
        let running = opening;
        const rows = raw.map((p, i) => {
            running += Number(p.amount) || 0;
            return { i, amount: Number(p.amount) || 0, ms: toMs(p.date), mode: p.mode || '', type: p.type || 'Instalment', paidSoFar: running };
        });
        const me = rows[idx];
        const no = `${a.rollNumber || a.id.slice(0, 6).toUpperCase()}-${String(idx + 1).padStart(2, '0')}`;
        const centre = CENTERS[a.centerId] || CENTERS.UN_COLLEGE;
        return { pay, me, rows, fee, opening, no, centre, balance: Math.max(0, fee - me.paidSoFar) };
    }, [a, idx]);

    useEffect(() => {
        if (!v) return;
        const text = `KAP RECEIPT ${v.no} | ${a.studentName} | Rs ${v.me.amount} | ${longDate(v.me.ms)} | ${v.me.mode || 'mode not noted'}`;
        QRCode.toDataURL(text, { margin: 1, width: 240, color: { dark: '#1F2A24', light: '#FFFFFF' } }).then(setQr).catch(() => setQr(''));
    }, [v, a?.studentName]);

    if (a === undefined) return <div className="jb-sk h-[520px] rounded-3xl max-w-[760px] mx-auto" />;
    if (!v) return <Card className="max-w-[760px] mx-auto"><Empty emoji="🧾">{err || 'This receipt could not be found.'}</Empty></Card>;

    const wa = `Dear Parent, we have received ${inr(v.me.amount)} for ${a.studentName} (Roll no ${a.rollNumber || 'pending'}) on ${longDate(v.me.ms)}. Receipt no ${v.no}. ${v.balance > 0 ? `Balance fee: ${inr(v.balance)}.` : 'All fees are now paid. Thank you!'} – ${v.centre.name}`;

    return (
        <div className="max-w-[760px] mx-auto space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 jb-noprint">
                <Link to={`/staff/student/${a.id}`} className="jb-act jb-act-line">← {a.studentName}</Link>
                <div className="flex flex-wrap items-center gap-2">
                    <Contact name={a.studentName} phone={phoneOf(a)} message={wa} />
                    <button type="button" className="jb-act jb-act-ink" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
                </div>
            </div>

            <section className="jb-card jb-rise jb-receipt" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ height: 6, background: 'var(--ok)' }} />
                <div className="p-6 sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <img src={v.centre.logoPath} alt="" className="h-10 w-auto" />
                            <div className="min-w-0">
                                <p className="font-extrabold text-[15px]">{v.centre.name}</p>
                                <p className="text-[12px] max-w-[340px]" style={{ color: 'var(--muted)' }}>{v.centre.address}</p>
                            </div>
                        </div>
                        <div className="sm:text-right">
                            <p className="jb-h text-[22px]">Fee receipt</p>
                            <p className="text-[13px] font-bold tabular-nums">No {v.no}</p>
                            <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{longDate(v.me.ms)}</p>
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-[1fr_auto] gap-5 mt-6 items-center">
                        <div className="rounded-2xl p-5" style={{ background: 'var(--t-sage)' }}>
                            <p className="text-[12.5px] font-bold" style={{ color: 'var(--sub)' }}>Received with thanks</p>
                            <p className="text-[34px] font-extrabold tracking-[-0.03em] leading-tight tabular-nums jb-pop">{inr(v.me.amount)}</p>
                            <p className="text-[13.5px] font-semibold mt-1">{amountInWords(v.me.amount)}</p>
                            <p className="text-[12.5px] mt-2" style={{ color: 'var(--sub)' }}>By {v.me.mode || 'mode not noted'} · {v.me.type}</p>
                        </div>
                        {qr && (
                            <figure className="text-center">
                                <img src={qr} alt={`QR code for receipt ${v.no}`} width={120} height={120} className="rounded-xl mx-auto" style={{ border: '1px solid var(--line)' }} />
                                <figcaption className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>Scan to check</figcaption>
                            </figure>
                        )}
                    </div>

                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-[13px]">
                        {[['Student', a.studentName], ['Roll no', a.rollNumber || 'Pending'], ['Course', programLabel(a.program || a.standard)], ['Batch', a.batchAssigned || '—']].map(([k, x]) => (
                            <div key={k}><dt style={{ color: 'var(--muted)' }}>{k}</dt><dd className="font-bold break-words">{x}</dd></div>
                        ))}
                    </dl>

                    <div className="mt-6">
                        <p className="text-[12px] font-bold mb-2" style={{ color: 'var(--muted)' }}>INSTALMENTS</p>
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr style={{ color: 'var(--muted)' }} className="text-left">
                                    <th className="font-semibold py-1.5">#</th><th className="font-semibold">Date</th><th className="font-semibold">Mode</th>
                                    <th className="font-semibold text-right">Amount</th><th className="font-semibold text-right">Paid so far</th>
                                </tr>
                            </thead>
                            <tbody>
                                {v.opening > 0 && (
                                    <tr style={{ borderTop: '1px solid var(--line)' }}><td className="py-1.5">–</td><td colSpan={2}>Paid earlier</td><td className="text-right tabular-nums">{inr(v.opening)}</td><td className="text-right tabular-nums">{inr(v.opening)}</td></tr>
                                )}
                                {v.rows.map(r => (
                                    <tr key={r.i} style={{ borderTop: '1px solid var(--line)', background: r.i === idx ? 'var(--okbg)' : undefined, fontWeight: r.i === idx ? 700 : 400, opacity: r.i > idx ? 0.45 : 1 }}>
                                        <td className="py-1.5 pl-1">{r.i + 1}</td>
                                        <td>{r.ms ? dateLabel(r.ms, { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
                                        <td>{r.mode || '—'}</td>
                                        <td className="text-right tabular-nums">{inr(r.amount)}</td>
                                        <td className="text-right tabular-nums pr-1">{inr(r.paidSoFar)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-wrap justify-between gap-4 mt-6 pt-4 text-[13.5px]" style={{ borderTop: '1px dashed var(--line)' }}>
                        <span>Course fee <b className="tabular-nums">{inr(v.fee)}</b></span>
                        <span>Paid till this receipt <b className="tabular-nums">{inr(v.me.paidSoFar)}</b></span>
                        <span>Balance <b className="tabular-nums" style={{ color: v.balance > 0 ? 'var(--late)' : 'var(--ok)' }}>{v.balance > 0 ? inr(v.balance) : 'Nil 🎉'}</b></span>
                    </div>
                    <p className="text-[11.5px] mt-5" style={{ color: 'var(--muted)' }}>This is a computer-made receipt. Fees once paid follow the refund policy given at admission.</p>
                </div>
            </section>
        </div>
    );
};

export default ReceiptPage;
