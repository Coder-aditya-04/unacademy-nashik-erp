// Helpers for the board J screens.
export const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
export const lakh = (n) => {
    const v = Number(n) || 0;
    if (Math.abs(v) >= 1e7) return '₹' + (v / 1e7).toFixed(2) + ' Cr';
    if (Math.abs(v) >= 1e5) return '₹' + (v / 1e5).toFixed(1) + ' L';
    return inr(v);
};
export const cleanPhone = (p) => {
    const d = String(p || '').replace(/\D/g, '');
    if (d.length === 10) return d;
    if (d.length === 12 && d.startsWith('91')) return d.slice(2);
    if (d.length === 11 && d.startsWith('0')) return d.slice(1);
    return d.length >= 10 ? d.slice(-10) : '';
};
export const waLink = (phone, text = '') => {
    const p = cleanPhone(phone);
    return p ? `https://wa.me/91${p}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null;
};
export const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
export const toMs = (v) => {
    if (!v) return null;
    if (typeof v === 'number') return v;
    if (v.seconds != null) return v.seconds * 1000;
    if (v.toMillis) return v.toMillis();
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
};
export const DAY = 86400000;
export const dayStart = (ms = Date.now()) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
