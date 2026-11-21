// Hostel fee settings: one doc, settings/hostel_fees. Director and Accounts
// edit it from Fee structures > Hostel; everyone else reads it.
import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { HOSTEL } from '../utils/feeData';

const REF = () => doc(db, 'settings', 'hostel_fees');
const num = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? n : 0; };

export const normaliseHostel = (d) => ({
    deposit: d?.deposit != null ? num(d.deposit) : HOSTEL.deposit,
    includes: typeof d?.includes === 'string' ? d.includes : HOSTEL.includes,
    plans: Array.isArray(d?.plans) && d.plans.length
        ? d.plans.map(p => ({ id: String(p.id), name: String(p.name || p.id), yearly: num(p.yearly), monthly: num(p.monthly) }))
        : HOSTEL.plans,
    updatedBy: d?.updatedBy || null,
    updatedAt: d?.updatedAt || null,
    saved: !!d,
});

// Live hostel fees, falling back to the defaults in feeData until saved.
export const useHostelFees = () => {
    const [fees, setFees] = useState(() => normaliseHostel(null));
    useEffect(() => onSnapshot(REF(), (s) => setFees(normaliseHostel(s.exists() ? s.data() : null)), () => setFees(normaliseHostel(null))), []);
    return fees;
};

export const saveHostelFees = async (data, user) => {
    const clean = normaliseHostel(data);
    await setDoc(REF(), {
        deposit: clean.deposit,
        includes: clean.includes.slice(0, 200),
        plans: clean.plans.map(({ id, name, yearly, monthly }) => ({ id, name, yearly, monthly })),
        updatedBy: user?.name || 'Team',
        updatedById: user?.uid || null,
        updatedAt: serverTimestamp(),
    });
};
