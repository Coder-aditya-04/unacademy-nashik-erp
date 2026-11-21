// "Search students, rolls, phones" pill in the top bar (design L1/L4).
// Roll number and phone are exact matches; names match from the start.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, query, where, orderBy, startAt, endAt } from 'firebase/firestore';
import { db } from '../../firebase';

const SEES_ALL = ['DIRECTOR', 'MANAGER', 'ACCOUNTANT'];
const titleCase = (s) => s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const rows = (snap, kind) => snap.docs.map(d => ({ id: d.id, kind, ...d.data() }));

const runSearch = async (text, role, centerId) => {
    const t = text.trim();
    const digits = t.replace(/\D/g, '');
    const scope = SEES_ALL.includes(role) || !centerId ? [] : [where('centerId', '==', centerId)];
    const adm = collection(db, 'admissions');
    const leads = collection(db, 'leads');
    const jobs = [];
    if (digits.length === 9) jobs.push(getDocs(query(adm, ...scope, where('rollNumber', '==', digits), limit(3))).then(s => rows(s, 'student')));
    if (digits.length === 10) {
        jobs.push(getDocs(query(adm, ...scope, where('phone', '==', digits), limit(3))).then(s => rows(s, 'student')));
        jobs.push(getDocs(query(leads, where('phone', '==', digits), limit(3))).then(s => rows(s, 'lead')));
    }
    if (!digits && t.length >= 2) {
        const name = titleCase(t);
        jobs.push(getDocs(query(adm, ...scope, orderBy('studentName'), startAt(name), endAt(name + ''), limit(5))).then(s => rows(s, 'student')));
        jobs.push(getDocs(query(leads, orderBy('studentName'), startAt(name), endAt(name + ''), limit(5))).then(s => rows(s, 'lead')));
    }
    const all = (await Promise.allSettled(jobs)).flatMap(r => (r.status === 'fulfilled' ? r.value : []));
    // A lead that became a student shows once, as the student.
    const admittedLeads = new Set(all.filter(r => r.kind === 'student' && r.leadId).map(r => r.leadId));
    return all.filter(r => !(r.kind === 'lead' && (admittedLeads.has(r.id) || r.admissionId))).slice(0, 8);
};

const GlobalSearch = ({ role, centerId, className = '' }) => {
    const navigate = useNavigate();
    const [q, setQ] = useState('');
    const [res, setRes] = useState(null);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const input = useRef(null);

    useEffect(() => {
        const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); } };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        if (q.trim().length < 2) { setRes(null); return undefined; }
        let live = true;
        setBusy(true);
        const t = setTimeout(() => runSearch(q, role, centerId).then(r => { if (live) { setRes(r); setBusy(false); } }), 300);
        return () => { live = false; clearTimeout(t); };
    }, [q, role, centerId]);

    const go = (r) => {
        setOpen(false); setQ('');
        navigate(r.kind === 'student' ? `/staff/student/${r.id}` : `/staff/leads/${r.id}`);
    };

    return (
        <div className={`relative ${className}`}>
            <label className="flex items-center gap-2 rounded-full pl-4 pr-2 h-[42px] w-[280px] max-w-full" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}>
                <span className="sr-only">Search students, roll numbers or phones</span>
                <span aria-hidden="true">🔎</span>
                <input ref={input} value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
                    onKeyDown={e => { if (e.key === 'Enter' && res?.[0]) go(res[0]); if (e.key === 'Escape') { setOpen(false); input.current?.blur(); } }}
                    placeholder="Search students, rolls, phones" className="flex-1 min-w-0 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-[13.5px]" style={{ color: "var(--ink)", boxShadow: "none", border: 0 }} />
                <kbd className="text-[11.5px] px-2 py-0.5 rounded-full" style={{ background: 'var(--cream)', color: 'var(--muted)' }}>⌘K</kbd>
            </label>
            {open && q.trim().length >= 2 && (
                <div className="absolute right-0 mt-2 w-[340px] max-w-[90vw] rounded-2xl p-2 shell-fade z-50" style={{ background: 'var(--panel)', boxShadow: 'var(--card-sh, 0 18px 40px rgba(29,42,34,.14))' }} role="listbox">
                    {busy && !res && <p className="px-3 py-2 text-[13px]" style={{ color: 'var(--muted)' }}>Searching…</p>}
                    {res && res.length === 0 && <p className="px-3 py-2 text-[13px]" style={{ color: 'var(--muted)' }}>No student or enquiry found. Try the full roll number or 10-digit phone.</p>}
                    {res?.map(r => (
                        <button key={r.kind + r.id} type="button" role="option" aria-selected="false" onMouseDown={e => e.preventDefault()} onClick={() => go(r)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-[var(--cream)]">
                            <span aria-hidden="true" className="w-8 h-8 rounded-full flex items-center justify-center text-[14px]" style={{ background: r.kind === 'student' ? 'var(--t-lilac)' : 'var(--t-blue)' }}>{r.kind === 'student' ? '🎓' : '📥'}</span>
                            <span className="min-w-0 flex-1">
                                <b className="block text-[13.5px] truncate">{r.studentName || 'No name'}</b>
                                <span className="block text-[11.5px] truncate" style={{ color: 'var(--muted)' }}>{r.kind === 'student' ? ['Student', r.rollNumber, String(r.program || '').replace(/_/g, ' ')].filter(Boolean).join(' · ') : ['Enquiry', r.phone, r.status].filter(Boolean).join(' · ')}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
