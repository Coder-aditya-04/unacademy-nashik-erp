import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

// Shared building blocks for the staff screens, on the KAP design system
// (glass cards, Archivo, KAP blue). Styles live in index.css under .kap.

export const Card = ({ className = '', children, ...rest }) => (
    <div className={`kap-glass rounded-[18px] ${className}`} {...rest}>{children}</div>
);

export const CardHeader = ({ title, icon: Icon, action, subtitle }) => (
    <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 border-b border-slate-200/70">
        <div className="min-w-0">
            <h3 className="kap-title text-slate-900 flex items-center gap-2 text-[15px]">
                {Icon && <Icon className="w-4 h-4 text-blue-600" aria-hidden="true" />}{title}
            </h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
    </div>
);

const TONES = {
    blue: 'bg-blue-600/10 text-blue-700', emerald: 'bg-emerald-600/10 text-emerald-700', violet: 'bg-violet-600/10 text-violet-700',
    rose: 'bg-rose-600/10 text-rose-700', amber: 'bg-amber-600/10 text-amber-700', slate: 'bg-slate-500/10 text-slate-600',
};
const VALUE_TONE = { rose: 'text-rose-700', amber: 'text-amber-700', emerald: 'text-emerald-700' };

// A headline number: eyebrow label, value, hint line and optional click-through.
export const StatCard = ({ label, value, hint, icon: Icon, tone = 'slate', to, delay = 0 }) => {
    const body = (
        <>
            <div className="flex items-start justify-between gap-2">
                <p className="kap-eyebrow">{label}</p>
                {Icon && <span className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 ${TONES[tone]}`}><Icon className="w-4 h-4" aria-hidden="true" /></span>}
            </div>
            <p className={`mt-1 text-[24px] sm:text-[26px] leading-tight font-[750] tracking-[-0.7px] tabular-nums ${VALUE_TONE[tone] || 'text-slate-900'}`}>{value}</p>
            {hint && <p className="mt-0.5 text-[11.5px] text-slate-500">{hint}</p>}
        </>
    );
    const cls = 'block p-4 rounded-[16px] kap-glass shell-rise';
    const style = { animationDelay: `${delay}ms` };
    return to
        ? <Link to={to} className={`${cls} transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_2px_6px_rgba(14,26,29,.07),0_10px_26px_rgba(14,26,29,.08)]`} style={style}>{body}</Link>
        : <div className={cls} style={style}>{body}</div>;
};

// Small tile linking to another screen.
export const QuickLink = ({ to, icon: Icon, title, text, tone = 'slate' }) => (
    <Link to={to} className="group flex items-center gap-3 p-3.5 rounded-[16px] kap-glass transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-blue-300">
        <span className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${TONES[tone]}`}><Icon className="w-5 h-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
            <span className="block font-[650] text-sm text-slate-900">{title}</span>
            <span className="block text-xs text-slate-500 truncate">{text}</span>
        </span>
        <ArrowUpRight className="w-4 h-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-blue-600" aria-hidden="true" />
    </Link>
);

// Segmented control. The white pill stretches toward the new option: the
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
        <div ref={wrap} role="group" aria-label={label} className="relative inline-flex p-1 rounded-[13px] bg-slate-500/10 border border-slate-200/70 max-w-full overflow-x-auto">
            {pill && (
                <span aria-hidden="true" className="kap-pill absolute inset-0 bg-white"
                    style={{ '--pill-l': `${pill.l}px`, '--pill-r': `${pill.r}px`, transition }} />
            )}
            {options.map(o => (
                <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
                    className={`relative z-10 ${pad} rounded-[10px] font-[650] whitespace-nowrap transition-colors duration-200 ${value === o.value ? 'text-blue-800' : 'text-slate-500 hover:text-slate-800'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
};
