// Shared pieces for the board J screens (design canvas L1–L5, P1–P2).
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ThemeCtx, ToastCtx, THEME_KEY, readTheme, useTheme } from './context';
import { cleanPhone, waLink, initials } from './util';
import { useCountUp } from '../../hooks/useCountUp';

/* ---------------- Theme (light / dark) ---------------- */

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(readTheme);
    const toggle = useCallback(() => setTheme(t => {
        const next = t === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(THEME_KEY, next); } catch { /* storage blocked */ }
        return next;
    }), []);
    return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
};

export const ThemeSwitch = ({ className = '' }) => {
    const { theme, toggle } = useTheme();
    const dark = theme === 'dark';
    return (
        <button type="button" onClick={toggle} className={`jb-theme ${className}`} role="switch" aria-checked={dark}
            aria-label="Dark theme" title={dark ? 'Switch to light' : 'Switch to dark'}>
            <i aria-hidden="true" style={{ left: dark ? 42 : 4, background: dark ? 'var(--t-lilac)' : 'var(--t-butter)' }} />
            <span aria-hidden="true">☀️</span><span aria-hidden="true">🌙</span>
        </button>
    );
};

/* ---------------- Toast ---------------- */
export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState(null);
    const timer = useRef(null);
    const show = useCallback((emoji, text) => {
        clearTimeout(timer.current);
        setToast({ emoji, text, key: Date.now() });
        timer.current = setTimeout(() => setToast(null), 2600);
    }, []);
    useEffect(() => () => clearTimeout(timer.current), []);
    return (
        <ToastCtx.Provider value={show}>
            {children}
            {toast && (
                <div key={toast.key} className="jb-toast" role="status" aria-live="polite">
                    <span aria-hidden="true">{toast.emoji}</span>{toast.text}
                </div>
            )}
        </ToastCtx.Provider>
    );
};

/* ---------------- Numbers ---------------- */
export const Count = ({ value, format = (v) => Math.round(v).toLocaleString('en-IN') }) => format(useCountUp(value));

/* ---------------- Stretchy pill segmented control ---------------- */
// The leading edge moves first and the trailing edge catches up.
export const Seg = ({ options, value, onChange, pillBg = 'var(--sage2)', onInk = 'var(--ink)', label, className = '', size = 'md' }) => {
    const box = useRef(null);
    const [pill, setPill] = useState(null);
    const idx = Math.max(0, options.findIndex(o => o.value === value));
    useLayoutEffect(() => {
        const measure = () => {
            const btn = box.current?.children[idx + 1];
            if (!btn) return;
            const left = btn.offsetLeft, right = box.current.clientWidth - btn.offsetLeft - btn.offsetWidth;
            setPill(p => (p && p.left === left && p.right === right) ? p : { left, right, dir: p ? (left > p.left ? 1 : -1) : 0 });
        };
        measure();
        document.fonts?.ready?.then(measure);
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [idx, options.length]);
    const tr = !pill || pill.dir === 0 ? 'none'
        : pill.dir > 0 ? 'right var(--fast), left var(--slow)' : 'left var(--fast), right var(--slow)';
    const pad = size === 'sm' ? '6px 12px' : '8px 14px';
    return (
        <div ref={box} className={`jb-seg ${className}`} role="radiogroup" aria-label={label}>
            <span aria-hidden="true" className="jb-seg-pill" style={{ left: pill?.left ?? 4, right: pill?.right ?? 4, background: pillBg, transition: tr, opacity: pill ? 1 : 0 }} />
            {options.map(o => {
                const on = o.value === value;
                return (
                    <button key={o.value} type="button" role="radio" aria-checked={on} className="jb-seg-btn"
                        style={{ color: on ? onInk : 'var(--ink)', padding: pad, fontSize: size === 'sm' ? 12.5 : 13.5 }}
                        onClick={() => onChange(o.value)}>
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
};

/* ---------------- Sparkline ---------------- */
export const Spark = ({ points = [], color = 'var(--ink)', w = 84, h = 26 }) => {
    if (points.length < 2) return null;
    const max = Math.max(...points), min = Math.min(...points), span = max - min || 1;
    const d = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - 3 - ((p - min) / span) * (h - 6)}`).join(' ');
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
            <polyline points={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="jb-draw" />
        </svg>
    );
};

/* ---------------- Semicircle gauge with a pace mark ---------------- */
export const Gauge = ({ value, target, pace, children, color = 'var(--ok)', size = 260 }) => {
    const L = Math.PI * 90;
    const frac = target > 0 ? Math.min(1, value / target) : 0;
    const shown = useCountUp(frac * 1000) / 1000;
    const pa = Math.PI * (1 - Math.min(1, Math.max(0, pace)));
    const mx = 110 + Math.cos(pa) * 90, my = 110 - Math.sin(pa) * 90;
    const ox = 110 + Math.cos(pa) * 108, oy = 110 - Math.sin(pa) * 108;
    return (
        <div style={{ position: 'relative', width: size, maxWidth: '100%', margin: '0 auto' }}>
            <svg viewBox="0 0 220 124" width="100%" aria-hidden="true">
                <path d="M20 110 A90 90 0 0 1 200 110" fill="none" style={{ stroke: 'var(--track)' }} strokeWidth="22" strokeLinecap="round" />
                <path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke={color} strokeWidth="22" strokeLinecap="round"
                    strokeDasharray={`${L * shown} ${L}`} />
                <line x1={mx} y1={my} x2={ox} y2={oy} style={{ stroke: 'var(--ink)' }} strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center' }}>{children}</div>
        </div>
    );
};

/* ---------------- KPI tile ---------------- */
export const Tile = ({ tone = 'sage', title, emoji, value, sub, spark, delay = 0, onClick }) => {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag type={onClick ? 'button' : undefined} onClick={onClick}
            className="jb-rise jb-lift text-left"
            style={{ background: `var(--t-${tone})`, borderRadius: 24, padding: 20, border: 0, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 150, animationDelay: `${delay}ms`, cursor: onClick ? 'pointer' : 'default', color: 'var(--ink)' }}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-bold">{title}</span>
                <span aria-hidden="true" className="text-[18px]">{emoji}</span>
            </div>
            <div className="text-[30px] font-extrabold tracking-[-0.03em] leading-none">{value}</div>
            <div className="flex items-end justify-between gap-2 mt-auto">
                <span className="text-[12.5px] leading-snug" style={{ color: 'var(--sub)' }}>{sub}</span>
                {spark && <Spark points={spark} />}
            </div>
        </Tag>
    );
};

/* ---------------- Card ---------------- */
export const Card = ({ title, sub, right, children, className = '', delay = 0, pad = 20, as: Tag = 'section' }) => (
    <Tag className={`jb-card jb-rise ${className}`} style={{ padding: pad, animationDelay: `${delay}ms` }}>
        {(title || right) && (
            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                    {title && <h2 className="jb-h text-[18px] leading-tight">{title}</h2>}
                    {sub && <p className="jb-sub text-[13px] mt-0.5">{sub}</p>}
                </div>
                {right}
            </div>
        )}
        {children}
    </Tag>
);

export const Empty = ({ emoji = '🎉', children }) => (
    <p className="text-center text-[14px] font-semibold py-8" style={{ color: 'var(--muted)' }}><span aria-hidden="true" className="jb-pop mr-1">{emoji}</span>{children}</p>
);

/* ---------------- Call and WhatsApp ---------------- */
const PhoneIcon = () => (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
);
export const WaIcon = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3.5 20.5l1.3-3.9A8.5 8.5 0 1 1 8 19.6z" />
        <path d="M9.2 8.6c.2 2.4 2.2 4.6 4.6 5.2l.9-1 1.5.7-.3 1.4c-3.1.3-6.6-3-6.6-6.1l1.4-.4.7 1.6z" fill="currentColor" strokeWidth="1" />
    </svg>
);

// Call opens the phone dialler (tel:), WhatsApp opens a chat with a ready
// message. Nothing is sent by itself: the person presses send in WhatsApp.
export const Contact = ({ name, phone, message = '', size = '', who = 'parent' }) => {
    const [on, setOn] = useState(false);
    const p = cleanPhone(phone);
    if (!p) return null;
    const cls = size ? ` ${size}` : '';
    return (
        <span className="inline-flex items-center gap-1.5 shrink-0">
            <a href={`tel:+91${p}`} className={`jb-call${cls}${on ? ' on' : ''}`} title={`Call ${who}`}
                aria-label={`Call ${name ? name + "'s " : ''}${who}, ${p}`}
                onClick={(e) => { e.stopPropagation(); setOn(true); setTimeout(() => setOn(false), 2400); }}>
                <PhoneIcon />
            </a>
            <a href={waLink(p, message)} target="_blank" rel="noopener noreferrer" className={`jb-wa${cls}`} title="WhatsApp"
                aria-label={`WhatsApp ${name ? name + "'s " : ''}${who}`} onClick={(e) => e.stopPropagation()}>
                <WaIcon />
            </a>
        </span>
    );
};

/* ---------------- Little helpers ---------------- */
const AV = ['var(--t-sage)', 'var(--t-coral)', 'var(--t-butter)', 'var(--t-blue)', 'var(--t-lilac)'];
export const Avatar = ({ name, size = 38 }) => {
    let h = 0; for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) % 997;
    return (
        <span aria-hidden="true" className="inline-flex items-center justify-center rounded-full font-bold shrink-0"
            style={{ width: size, height: size, background: AV[h % AV.length], fontSize: size * 0.34, color: 'var(--ink)' }}>
            {initials(name)}
        </span>
    );
};


