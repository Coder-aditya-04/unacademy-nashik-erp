// "Hostel fees" sheet for counsellors. Reads the plans from utils/feeData.
import { Layer } from './index';
import { HOSTEL } from '../../utils/feeData';

const inr = (n) => (n == null ? 'to be confirmed' : '₹' + Math.round(Number(n)).toLocaleString('en-IN'));

export const HostelFeesSheet = ({ onClose }) => (
    <Layer>
        <div className="fixed inset-0 z-[70] bg-black/30" onClick={onClose} aria-hidden="true" />
        <div role="dialog" aria-modal="true" aria-label="Hostel fees" className="fixed z-[71] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-[440px] rounded-[24px] p-6 shell-fade"
            style={{ background: 'var(--panel)', boxShadow: 'var(--card-sh)' }}>
            <div className="flex items-start gap-3">
                <span className="text-[28px]" aria-hidden="true">🏠</span>
                <div className="flex-1">
                    <h3 className="jb-h text-[22px]">Hostel fees</h3>
                    <p className="text-[13px]" style={{ color: 'var(--muted)' }}>Separate from the course fee. Tell the parent these with the course quote.</p>
                </div>
                <button type="button" className="jb-act jb-act-soft" onClick={onClose} aria-label="Close">✕</button>
            </div>
            {HOSTEL.pending && <p className="mt-4 rounded-xl px-3 py-2 text-[13px]" style={{ background: 'var(--nextbg)', color: 'var(--butter-ink)' }}>The hostel fee list is not added yet. Ask your Manager for the current amounts.</p>}
            <ul className="mt-4 flex flex-col gap-2">
                {HOSTEL.plans.map(p => (
                    <li key={p.id} className="rounded-2xl px-4 py-3" style={{ background: 'var(--cream)' }}>
                        <b className="text-[15px]">{p.name}</b>
                        <div className="flex justify-between text-[13.5px] mt-1"><span style={{ color: 'var(--muted)' }}>Per year</span><b>{inr(p.yearly)}</b></div>
                        <div className="flex justify-between text-[13.5px]"><span style={{ color: 'var(--muted)' }}>Deposit</span><b>{inr(p.deposit)}</b></div>
                        {p.note && <p className="text-[12.5px] mt-1" style={{ color: 'var(--muted)' }}>{p.note}</p>}
                    </li>
                ))}
            </ul>
        </div>
    </Layer>
);
