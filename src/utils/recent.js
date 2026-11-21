// "Recently opened" students and enquiries for the sidebar (per device).
const KEY = 'kap-recent';
const EVT = 'kap-recent';

export const readRecent = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]').slice(0, 3); } catch { return []; }
};

export const rememberRecent = ({ to, name, sub = '' }) => {
    if (!to || !name) return;
    try {
        const list = [{ to, name, sub }, ...readRecent().filter(r => r.to !== to)].slice(0, 3);
        localStorage.setItem(KEY, JSON.stringify(list));
        window.dispatchEvent(new Event(EVT));
    } catch { /* storage blocked */ }
};

export const RECENT_EVENT = EVT;
