import React, { useMemo, useState } from 'react';
import { IndianRupee } from 'lucide-react';
import { Money } from '../../../components/Money';
import { buildCounsellorReport, rangeFor } from '../../../utils/counsellorReport';

const PRESETS = [
    { id: 'TODAY', label: 'Today' },
    { id: 'THIS_MONTH', label: 'This month' },
    { id: 'LAST_MONTH', label: 'Last month' },
    { id: 'ALL', label: 'All time' },
];

// Booked vs collected per counsellor, for the Director and Manager.
// Managers get no total row: they must not see centre collection totals.
const CounsellorCollectionReport = ({ admissions, showTotals = true }) => {
    const [preset, setPreset] = useState('THIS_MONTH');
    const rows = useMemo(() => buildCounsellorReport(admissions, rangeFor(preset)), [admissions, preset]);
    const total = rows.reduce((t, r) => ({
        admissions: t.admissions + r.admissions, booked: t.booked + r.booked,
        collected: t.collected + r.collected, pending: t.pending + r.pending,
    }), { admissions: 0, booked: 0, collected: 0, pending: 0 });

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden mt-6">
            <div className="px-5 py-4 flex flex-wrap gap-3 justify-between items-center border-b border-slate-100">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-[15px]">
                    <IndianRupee className="w-4 h-4 text-emerald-600" /> Collection by counsellor
                </h3>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg" role="group" aria-label="Period">
                    {PRESETS.map(p => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => setPreset(p.id)}
                            aria-pressed={preset === p.id}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition ${preset === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="text-slate-500 text-xs font-medium border-b border-slate-100">
                        <tr>
                            <th className="p-4">Counsellor</th>
                            <th className="p-4 text-center">Admissions</th>
                            <th className="p-4 text-right">Booked</th>
                            <th className="p-4 text-right">Collected</th>
                            <th className="p-4 text-right">Pending dues</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {rows.map(r => (
                            <tr key={r.id} className="hover:bg-emerald-50/50 transition">
                                <td className="p-4 font-bold text-gray-800">{r.name}</td>
                                <td className="p-4 text-center">{r.admissions}</td>
                                <td className="p-4 text-right text-slate-700"><Money value={r.booked} /></td>
                                <td className="p-4 text-right font-bold text-emerald-700"><Money value={r.collected} /></td>
                                <td className="p-4 text-right text-rose-600"><Money value={r.pending} /></td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-400">No admissions or payments in this period.</td></tr>
                        )}
                    </tbody>
                    {showTotals && rows.length > 0 && (
                        <tfoot className="bg-gray-50 font-bold text-slate-800">
                            <tr>
                                <td className="p-4">Total</td>
                                <td className="p-4 text-center">{total.admissions}</td>
                                <td className="p-4 text-right"><Money value={total.booked} /></td>
                                <td className="p-4 text-right text-emerald-700"><Money value={total.collected} /></td>
                                <td className="p-4 text-right text-rose-600"><Money value={total.pending} /></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
            <p className="px-6 py-3 text-[11px] text-slate-400 border-t border-gray-100">
                Booked counts admissions created in the period. Collected counts payments received in the period; refunds are subtracted. Pending dues is today&apos;s balance on that counsellor&apos;s students.
            </p>
        </div>
    );
};

export default CounsellorCollectionReport;
