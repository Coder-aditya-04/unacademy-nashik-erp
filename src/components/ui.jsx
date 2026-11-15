import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

// Shared building blocks for the redesigned staff screens.

export const Card = ({ className = '', children, ...rest }) => (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`} {...rest}>{children}</div>
);

export const CardHeader = ({ title, icon: Icon, action, subtitle }) => (
    <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100">
        <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-[15px]">
                {Icon && <Icon className="w-4 h-4 text-slate-400" aria-hidden="true" />}{title}
            </h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
    </div>
);

const TONES = {
    blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600', amber: 'bg-amber-50 text-amber-600', slate: 'bg-slate-100 text-slate-600',
};

// A headline number: label, value, optional hint line and click-through.
export const StatCard = ({ label, value, hint, icon: Icon, tone = 'slate', to, delay = 0 }) => {
    const body = (
        <>
            <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                {Icon && <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${TONES[tone]}`}><Icon className="w-[18px] h-[18px]" aria-hidden="true" /></span>}
            </div>
            <p className="mt-2 text-2xl sm:text-[28px] leading-tight font-bold text-slate-900 tabular-nums tracking-tight">{value}</p>
            {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </>
    );
    const cls = 'block p-4 sm:p-5 shell-rise';
    const style = { animationDelay: `${delay}ms` };
    return to
        ? <Link to={to} className={`${cls} bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-sm transition`} style={style}>{body}</Link>
        : <Card className={cls} style={style}>{body}</Card>;
};

// Small tile linking to another screen.
export const QuickLink = ({ to, icon: Icon, title, text, tone = 'slate' }) => (
    <Link to={to} className="group flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-sm transition">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${TONES[tone]}`}><Icon className="w-5 h-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
            <span className="block font-semibold text-sm text-slate-900">{title}</span>
            <span className="block text-xs text-slate-500 truncate">{text}</span>
        </span>
        <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" aria-hidden="true" />
    </Link>
);

// Segmented control whose highlight slides to the chosen option.
export const Segmented = ({ options, value, onChange, label, size = 'md' }) => {
    const wrap = useRef(null);
    const [pill, setPill] = useState(null);
    useLayoutEffect(() => {
        const el = wrap.current?.querySelector('[aria-pressed="true"]');
        if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
    }, [value, options.length]);
    const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
    return (
        <div ref={wrap} role="group" aria-label={label} className="relative inline-flex p-1 rounded-xl bg-slate-100 max-w-full overflow-x-auto">
            {pill && (
                <span aria-hidden="true" className="absolute top-1 bottom-1 left-0 rounded-lg bg-white shadow-sm transition-[transform,width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
                    style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} />
            )}
            {options.map(o => (
                <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
                    className={`relative z-10 ${pad} rounded-lg font-semibold whitespace-nowrap transition-colors ${value === o.value ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
};
