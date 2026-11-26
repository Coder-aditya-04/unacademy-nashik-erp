import { createContext, useContext } from 'react';

export const THEME_KEY = 'kap-theme';
export const ThemeCtx = createContext({ theme: 'light', toggle: () => {} });
export const ToastCtx = createContext(() => {});
export const useTheme = () => useContext(ThemeCtx);
export const useToast = () => useContext(ToastCtx);
export const readTheme = () => {
    try { const t = localStorage.getItem(THEME_KEY); if (t === 'dark' || t === 'light') return t; } catch { /* storage blocked */ }
    return 'light';
};
