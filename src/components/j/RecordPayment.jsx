// "Record a payment" card for the Fees tab of the student profile (board J).
// Payment or refund, amount, account, optional proof; saves through paymentService.
import React, { useRef, useState } from 'react';
import { Card, Seg } from './index';
import { useToast } from './context';
import { recordPayment, PAY_MODES } from '../../services/paymentService';
import { PROOF_ACCEPT } from '../../services/proofService';

const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

const RecordPayment = ({ student, userProfile, balance = 0, nextDue = 0, amountRef }) => {
    const toast = useToast();
    const [kind, setKind] = useState('PAY');
    const [amount, setAmount] = useState('');
    const [mode, setMode] = useState('Cash');
    const [remarks, setRemarks] = useState('');
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const fileRef = useRef(null);
    const refund = kind === 'REFUND';
    const quick = [nextDue, balance].filter((x, i, arr) => x > 0 && arr.indexOf(x) === i);

    const save = async () => {
        setErr('');
        if (refund && !remarks.trim()) { setErr('Write why the money is going back.'); return; }
        setBusy(true);
        try {
            await recordPayment({ student, refund, amount, mode, remarks, proofFile: file, userProfile });
            toast(refund ? '↩️' : '🧾', refund ? `Refund of ${inr(amount)} saved` : `${inr(amount)} received · receipt is in the list`);
            setAmount(''); setRemarks(''); setFile(null); setKind('PAY');
            if (fileRef.current) fileRef.current.value = '';
        } catch (e) {
            console.error(e);
            setErr(e.message || 'Could not save. Check the connection and try again.');
        }
        setBusy(false);
    };

    return (
        <Card title={refund ? '↩️ Give a refund' : '🧾 Record a payment'} sub={refund ? 'The amount comes off what the student has paid' : `Still to pay ${inr(balance)}`}
            right={<Seg size="sm" label="Payment or refund" value={kind} onChange={(x) => { setKind(x); setErr(''); }} pillBg="var(--ink)" onInk="var(--on-ink)"
                options={[{ value: 'PAY', label: 'Payment' }, { value: 'REFUND', label: 'Refund' }]} />} delay={60}>
            <div className="flex flex-col gap-3">
                <label className="block">
                    <span className="block text-[12.5px] font-bold mb-1.5">Amount</span>
                    <span className="flex items-center gap-2 rounded-[14px] px-3" style={{ background: 'var(--cream)', boxShadow: '0 0 0 1px var(--line)' }}>
                        <span className="text-[18px] font-extrabold" style={{ color: 'var(--muted)' }}>₹</span>
                        <input ref={amountRef} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} placeholder="0"
                            className="flex-1 min-w-0 !bg-transparent outline-none py-3 text-[20px] font-extrabold" style={{ border: 0, boxShadow: "none", background: "transparent" }} />
                    </span>
                </label>
                {!refund && quick.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {quick.map(q => (
                            <button key={q} type="button" onClick={() => setAmount(String(q))} className="text-[12.5px] font-bold px-3 py-1.5 rounded-full"
                                style={{ background: String(q) === amount ? 'var(--t-sage)' : 'var(--cream)', boxShadow: '0 0 0 1px var(--line)' }}>
                                {q === balance ? `Full balance ${inr(q)}` : `Next part ${inr(q)}`}
                            </button>
                        ))}
                    </div>
                )}
                <label className="block">
                    <span className="block text-[12.5px] font-bold mb-1.5">{refund ? 'Paid back through' : 'Received in'}</span>
                    <select value={mode} onChange={(e) => setMode(e.target.value)} className="jb-input">
                        {PAY_MODES.map(m => <option key={m}>{m}</option>)}
                    </select>
                </label>
                {refund && (
                    <label className="block">
                        <span className="block text-[12.5px] font-bold mb-1.5">Why the refund</span>
                        <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Left after the first month, as per refund rule" className="jb-input" />
                    </label>
                )}
                <div>
                    <span className="block text-[12.5px] font-bold mb-1.5">Proof <span className="font-medium" style={{ color: 'var(--muted)' }}>· screenshot, cheque photo or PDF, up to 5 MB</span></span>
                    <label className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 cursor-pointer" style={{ background: 'var(--cream)', boxShadow: 'inset 0 0 0 1.5px var(--line)' }}>
                        <span aria-hidden="true" className="text-[20px]">📎</span>
                        <span className="flex-1 min-w-0 text-[13px] truncate">{file ? file.name : 'Add proof (optional)'}</span>
                        {file && <button type="button" onClick={(e) => { e.preventDefault(); setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-[12px] font-bold" style={{ color: 'var(--coral)' }}>Remove</button>}
                        <input ref={fileRef} type="file" accept={PROOF_ACCEPT} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    </label>
                </div>
                {err && <p role="alert" className="text-[13px] font-semibold px-3 py-2 rounded-xl" style={{ background: 'var(--t-coral)' }}>{err}</p>}
                <button type="button" disabled={busy || !(Number(amount) > 0)} onClick={save}
                    className="jb-act jb-act-ink justify-center !py-3 disabled:opacity-50">
                    {busy ? 'Saving…' : refund ? `Save refund${Number(amount) > 0 ? ' of ' + inr(amount) : ''}` : `Receive ${Number(amount) > 0 ? inr(amount) : 'payment'}`}
                </button>
                <p className="text-[12px]" style={{ color: 'var(--muted)' }}>A receipt is made straight away and shows in the list below.</p>
            </div>
        </Card>
    );
};

export default RecordPayment;
