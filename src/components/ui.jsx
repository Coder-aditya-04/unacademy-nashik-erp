import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useCountUp } from '../hooks/useCountUp';

// Shared building blocks for the staff screens, in the G4 design (light
// tactile: linen cards, raised buttons, brass accents, Georgia serif).
// Styles live in index.css under .kap.

export const Card = ({ className = '', children, ...rest }) => (
    <div className={`kap-glass rounded-[22px] ${className}`} {...rest}>{children}</div>
);

export const CardHeader = ({ title, icon: Icon, action, subtitle }) => (
    <div className="px-4 sm:px-5 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
            <h3 className="kap-title text-slate-900 flex items-center gap-2 text-[17px]">
                {Icon && <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[#F4EFE6] text-slate-900"><Icon className="w-4 h-4" aria-hidden="true" /></span>}{title}
            </h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
    </div>
);

const TONES = {
    blue: 'bg-[#D3E0EE] text-slate-900', emerald: 'bg-[#DCE8D2] text-slate-900', violet: 'bg-[#E4E0F0] text-slate-900',
    rose: 'bg-[#F8D5C6] text-slate-900', amber: 'bg-[#F6E7AE] text-slate-900', slate: 'bg-[#F4EFE6] text-slate-900',
};

// A whole number that counts up when it appears.
export const CountUp = ({ value }) => Math.round(useCountUp(value)).toLocaleString('en-IN');

// A headline number: eyebrow label, value, hint line and optional click-through.
export const StatCard = ({ label, value, hint, icon: Icon, tone = 'slate', to, delay = 0 }) => {
    const body = (
        <>
            <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-bold text-slate-900">{label}</p>
                {Icon && <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 j-ico"><Icon className="w-4 h-4" aria-hidden="true" /></span>}
            </div>
            <p className="mt-3 text-[26px] sm:text-[30px] leading-tight font-extrabold tracking-[-0.02em] tabular-nums text-slate-900">{typeof value === 'number' ? <CountUp value={value} /> : value}</p>
            {hint && <p className="mt-0.5 text-[12.5px] text-slate-700">{hint}</p>}
        </>
    );
    const cls = `block p-4 sm:p-5 j-tile j-tile-${TONES[tone] ? tone : 'slate'} shell-rise`;
    const style = { animationDelay: `${delay}ms` };
    return to
        ? <Link to={to} className={`${cls} transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(29,42,34,.10)] active:scale-[.98]`} style={style}>{body}</Link>
        : <div className={cls} style={style}>{body}</div>;
};

// Small tile linking to another screen.
export const QuickLink = ({ to, icon: Icon, title, text, tone = 'slate' }) => (
    <Link to={to} className="group flex items-center gap-3 p-3.5 rounded-[14px] kap-glass transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-blue-200 active:translate-y-0.5">
        <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${TONES[tone]}`}><Icon className="w-5 h-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
            <span className="block font-bold text-[15px] text-slate-900">{title}</span>
            <span className="block text-[13px] text-slate-600 truncate">{text}</span>
        </span>
        <ArrowUpRight className="w-4 h-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-900" aria-hidden="true" />
    </Link>
);

// Segmented control in a recessed track. The raised pill stretches toward the new option: the
// leading edge moves first and the trailing edge catches up.
export const Segmented = ({ options, value, onChange, label, size = 'md' }) => {
    const wrap = useRef(null);
    const [pill, setPill] = useState(null);
    useLayoutEffect(() => {
        const box = wrap.current;
        const el = box?.querySelector('[aria-pressed="true"]');
        if (!el) return;
        const l = el.offsetLeft;
        const r = box.scrollWidth - el.offsetLeft - el.offsetWidth;
        setPill(prev => ({ l, r, toRight: prev ? l > prev.l : true, first: !prev }));
    }, [value, options.length]);
    const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-[13px]';
    const fast = '340ms cubic-bezier(.2,.8,.2,1)';
    const slow = '560ms cubic-bezier(.65,0,.35,1)';
    const transition = !pill || pill.first ? 'none'
        : pill.toRight ? `--pill-r ${fast}, --pill-l ${slow}` : `--pill-l ${fast}, --pill-r ${slow}`;
    return (
        <div ref={wrap} role="group" aria-label={label} className="relative inline-flex p-1 rounded-full bg-white shadow-[0_0_0_1px_#ECE6DA] max-w-full overflow-x-auto">
            {pill && (
                <span aria-hidden="true" className="kap-pill absolute inset-0 bg-[#1D2A22]"
                    style={{ '--pill-l': `${pill.l}px`, '--pill-r': `${pill.r}px`, transition }} />
            )}
            {options.map(o => (
                <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
                    className={`relative z-10 ${pad} rounded-full font-semibold whitespace-nowrap transition-colors duration-300 ${value === o.value ? 'text-white' : 'text-slate-700 hover:text-slate-900'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
};
