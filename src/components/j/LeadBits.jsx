// Shared lead pieces: the full timeline everyone sees, and the TeleCRM-style
// Hot / Warm / Cold + stars rating.
import { useState } from 'react';
import { TEMPS, TEMP } from '../../utils/timeline';

const FILTERS = [['all', 'All'], ['call', '📞 Calls'], ['change', '✏️ Changes'], ['rating', '⭐ Rating'], ['fee', '💰 Fees']];
const when = (ms) => new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const ROLE = { TELECALLER: 'Telecaller', COUNSELLOR: 'Counsellor', MANAGER: 'Manager', DIRECTOR: 'Director', ACCOUNTANT: 'Accounts', RECOVERY: 'Recovery', BDE: 'BDE', FRONT_DESK: 'Front desk' };
const roleLabel = (r) => ROLE[String(r || '').toUpperCase()] || r || '';

export const FullTimeline = ({ events = [], max = 60 }) => {
    const [f, setF] = useState('all');
    const [more, setMore] = useState(false);
    const list = events.filter(e => f === 'all' || e.kind === f);
    const shown = more ? list : list.slice(0, max);
    return (
        <div>
            <div className="flex flex-wrap gap-1.5 mb-4" role="tablist" aria-label="Filter timeline">
                {FILTERS.map(([id, label]) => {
                    const n = id === 'all' ? events.length : events.filter(e => e.kind === id).length;
                    return <button key={id} type="button" role="tab" aria-selected={f === id} className={`jb-act ${f === id ? 'jb-act-ink' : 'jb-act-line'}`} style={{ padding: '5px 10px', fontSize: 12.5 }} onClick={() => setF(id)}>{label} {n ? <span style={{ opacity: .6 }}>{n}</span> : null}</button>;
                })}
            </div>
            {shown.length === 0 && <p className="text-[13px] py-6 text-center" style={{ color: 'var(--muted)' }}>Nothing here yet.</p>}
            <ol className="relative flex flex-col gap-4 pl-7">
                <span aria-hidden="true" className="absolute left-[10px] top-1 bottom-1 w-[2px] rounded" style={{ background: 'var(--track)' }} />
                {shown.map((e, i) => (
                    <li key={`${e.ms}-${i}`} className="relative jb-rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                        <span aria-hidden="true" className="absolute -left-7 top-0 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px]" style={{ background: 'var(--panel)', boxShadow: '0 0 0 2px var(--track)' }}>{e.emoji}</span>
                        <div className="flex flex-wrap items-baseline gap-x-2">
                            <p className="text-[14px] font-bold">{e.title}</p>
                            {(e.by || e.role) && <span className="jb-tag jb-tag-soft" style={{ fontSize: 11, padding: '1px 8px' }}>{[e.by, roleLabel(e.role)].filter(Boolean).join(' · ')}</span>}
                        </div>
                        {e.detail && <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink)' }}>{e.detail}</p>}
                        <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{when(e.ms)}</p>
                    </li>
                ))}
            </ol>
            {list.length > shown.length && <button type="button" className="jb-act jb-act-soft mt-3" onClick={() => setMore(true)}>Show all {list.length}</button>}
        </div>
    );
};

export const RatingPicker = ({ value = {}, onChange, disabled = false, compact = false }) => {
    const set = (patch) => !disabled && onChange?.({ temperature: value.temperature || null, stars: Number(value.stars) || 0, ...patch });
    return (
        <div className={`flex flex-wrap items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
            <div className="flex gap-1" role="radiogroup" aria-label="Lead temperature">
                {TEMPS.map(t => (
                    <button key={t.id} type="button" role="radio" aria-checked={value.temperature === t.id} disabled={disabled}
                        className={`jb-act ${value.temperature === t.id ? 'jb-act-ink' : 'jb-act-line'}`} style={{ padding: compact ? '4px 9px' : '6px 11px', fontSize: 12.5 }}
                        onClick={() => set({ temperature: value.temperature === t.id ? null : t.id })}>{t.emoji} {t.label}</button>
                ))}
            </div>
            <div className="flex" role="radiogroup" aria-label="Stars">
                {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" role="radio" aria-checked={value.stars === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} disabled={disabled}
                        className="press text-[20px] leading-none px-0.5" style={{ color: n <= (value.stars || 0) ? '#E0A526' : 'var(--track)', background: 'none' }}
                        onClick={() => set({ stars: value.stars === n ? 0 : n })}>★</button>
                ))}
            </div>
        </div>
    );
};

export const RatingTag = ({ lead }) => {
    if (!lead?.temperature && !lead?.stars) return null;
    const t = TEMP[lead.temperature];
    return <span className={`jb-tag ${t?.tag || 'jb-tag-soft'}`} style={{ fontSize: 11, padding: '1px 8px' }}>{t ? `${t.emoji} ${t.label}` : ''}{lead.stars ? ` ${'★'.repeat(lead.stars)}` : ''}</span>;
};
