// "Hostel fees" sheet for counsellors, plus the editor used in Fee structures.
import { useEffect, useState } from 'react';
import { Layer } from './index';
import { useHostelFees, saveHostelFees } from '../../services/hostelService';

const inr = (n) => (n ? '₹' + Math.round(Number(n)).toLocaleString('en-IN') : 'not set');

export const HostelFeesSheet = ({ onClose }) => {
    const fees = useHostelFees();
    return (
        <Layer>
            <div className="fixed inset-0 z-[70] bg-black/30" onClick={onClose} aria-hidden="true" />
            <div role="dialog" aria-modal="true" aria-label="Hostel fees" className="fixed z-[71] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-[460px] rounded-[24px] p-6 shell-fade"
                style={{ background: 'var(--panel)', color: 'var(--ink)', boxShadow: 'var(--card-sh)' }}>
                <div className="flex items-start gap-3">
                    <span className="text-[28px]" aria-hidden="true">🏠</span>
                    <div className="flex-1">
                        <h3 className="jb-h text-[22px]">Hostel fees</h3>
                        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>Separate from the course fee. Tell the parent these with the course quote.</p>
                    </div>
                    <button type="button" className="jb-act jb-act-soft" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <div className="mt-4 rounded-2xl px-4 py-3 flex justify-between items-center" style={{ background: 'var(--t-butter)' }}>
                    <span className="text-[13.5px] font-semibold">🔐 Security deposit (once)</span><b className="text-[16px] tabular-nums">{inr(fees.deposit)}</b>
                </div>
                <ul className="mt-2 grid grid-cols-2 gap-2">
                    {fees.plans.map(p => (
                        <li key={p.id} className="rounded-2xl px-4 py-3" style={{ background: p.id === 'GIRLS' ? 'var(--t-lilac)' : 'var(--t-blue)' }}>
                            <b className="text-[15px]">{p.id === 'GIRLS' ? '👧 ' : p.id === 'BOYS' ? '👦 ' : ''}{p.name}</b>
                            <p className="text-[12px] mt-2" style={{ color: 'var(--sub)' }}>Per year</p>
                            <p className="text-[19px] font-extrabold tabular-nums leading-tight">{inr(p.yearly)}</p>
                            <p className="text-[12px] mt-1.5" style={{ color: 'var(--sub)' }}>Per month</p>
                            <p className="text-[15px] font-bold tabular-nums">{inr(p.monthly)}</p>
                        </li>
                    ))}
                </ul>
                {fees.includes && <p className="text-[12.5px] mt-3" style={{ color: 'var(--muted)' }}>Includes {fees.includes}.</p>}
            </div>
        </Layer>
    );
};

// Editor for Director / Accounts (Fee structures > Hostel).
export const HostelFeesEditor = ({ userProfile }) => {
    const fees = useHostelFees();
    const [form, setForm] = useState(null);
    const [state, setState] = useState(null); // saving | saved | error
    useEffect(() => { if (!form) setForm(fees); }, [fees, form]);
    if (!form) return null;
    const setPlan = (i, k, v) => setForm(f => ({ ...f, plans: f.plans.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
    const save = async () => {
        setState('saving');
        try { await saveHostelFees(form, userProfile); setState('saved'); setTimeout(() => setState(null), 2500); }
        catch (e) { console.error(e); setState('error'); }
    };
    const field = 'w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 font-bold text-slate-800 tabular-nums';
    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 max-w-3xl">
            <h2 className="text-xl font-bold text-slate-800">🏠 Hostel fees</h2>
            <p className="text-sm text-slate-500">Counsellors see these from the Hostel fees button, and the admission form uses them. Changes show up at once.</p>
            {!fees.saved && <p className="mt-3 text-sm rounded-lg px-3 py-2 bg-amber-50 text-amber-800">Showing the starting amounts. Press Save once to keep them.</p>}
            <label className="block mt-5 text-xs font-bold text-slate-500 uppercase">Security deposit, paid once (₹)
                <input type="number" min="0" inputMode="numeric" className={field} value={form.deposit} onChange={e => setForm(f => ({ ...f, deposit: e.target.value }))} />
            </label>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
                {form.plans.map((p, i) => (
                    <fieldset key={p.id} className="rounded-xl border border-slate-200 p-4">
                        <legend className="px-1 text-sm font-bold text-slate-700">{p.name}</legend>
                        <label className="block text-xs font-bold text-slate-500 uppercase">Name
                            <input className={field} value={p.name} maxLength={40} onChange={e => setPlan(i, 'name', e.target.value)} />
                        </label>
                        <label className="block mt-3 text-xs font-bold text-slate-500 uppercase">Per year (₹)
                            <input type="number" min="0" inputMode="numeric" className={field} value={p.yearly} onChange={e => setPlan(i, 'yearly', e.target.value)} />
                        </label>
                        <label className="block mt-3 text-xs font-bold text-slate-500 uppercase">Per month (₹)
                            <input type="number" min="0" inputMode="numeric" className={field} value={p.monthly} onChange={e => setPlan(i, 'monthly', e.target.value)} />
                        </label>
                    </fieldset>
                ))}
            </div>
            <label className="block mt-4 text-xs font-bold text-slate-500 uppercase">What the fee includes
                <input className={field.replace('font-bold', 'font-medium')} value={form.includes} maxLength={200} onChange={e => setForm(f => ({ ...f, includes: e.target.value }))} />
            </label>
            <div className="flex items-center gap-3 mt-5">
                <button type="button" onClick={save} disabled={state === 'saving'} className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-black disabled:opacity-60">{state === 'saving' ? 'Saving…' : 'Save hostel fees'}</button>
                {state === 'saved' && <span className="text-sm font-bold text-green-700">✅ Saved</span>}
                {state === 'error' && <span className="text-sm font-bold text-red-700">Could not save. Only Director and Accounts can change fees.</span>}
                {fees.updatedBy && <span className="text-xs text-slate-400 ml-auto">Last changed by {fees.updatedBy}</span>}
            </div>
        </div>
    );
};
