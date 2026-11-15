import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { formatINR } from '../utils/money';

// Money masking for the Director: amounts show as ₹ •••••• until the eye
// button is pressed, and hide again on every page change. For other roles
// amounts are shown as before (maskable = false).
const MoneyCtx = createContext({ maskable: false, visible: true, toggle: () => {} });

export const MoneyVisibilityProvider = ({ maskable, children }) => {
    const [visible, setVisible] = useState(!maskable);
    const { pathname } = useLocation();

    // Hide again whenever the page changes (or the role changes).
    useEffect(() => { setVisible(!maskable); }, [pathname, maskable]);

    return (
        <MoneyCtx.Provider value={{ maskable, visible, toggle: () => setVisible(v => !v) }}>
            {children}
        </MoneyCtx.Provider>
    );
};

// <Money value={1234} /> → ₹1,234, or ₹ •••••• while hidden.
export const Money = ({ value, format = formatINR, className }) => {
    const { visible } = useContext(MoneyCtx);
    return (
        <span className={className} aria-label={visible ? undefined : 'Amount hidden'}>
            {visible ? format(value) : '₹ ••••••'}
        </span>
    );
};

// Eye button; renders nothing for roles that are not masked.
export const MoneyToggle = ({ className = '' }) => {
    const { maskable, visible, toggle } = useContext(MoneyCtx);
    if (!maskable) return null;
    return (
        <button
            type="button"
            onClick={toggle}
            title={visible ? 'Hide amounts' : 'Show amounts'}
            aria-pressed={visible}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 transition ${className}`}
        >
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {visible ? 'Hide amounts' : 'Show amounts'}
        </button>
    );
};
