import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STAFF = [
    { href: 'https://kapedutech-platform.vercel.app', emoji: '🏫', title: 'Admin portal', sub: 'Management and settings', tone: 'blue' },
    { href: 'https://kapedutech-syllabus-tracker.vercel.app', emoji: '📚', title: 'Academic portal', sub: 'Teachers and syllabus tracker', tone: 'lilac' },
    { to: '/login', emoji: '🧾', title: 'ERP & CRM', sub: 'Accounts, admissions and leads', tone: 'sage' },
];

const LoginModal = ({ onClose }) => {
    const [staff, setStaff] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="jb-card jb-rise relative w-full mx-auto text-center" style={{ padding: 28, borderRadius: 28 }}>
            <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 jb-act jb-act-soft" style={{ padding: '7px 11px' }}>✕</button>

            {!staff ? (
                <>
                    <span className="w-16 h-16 rounded-full inline-flex items-center justify-center text-[30px] jb-pop" style={{ background: '#EAF0FF' }} aria-hidden="true">🎓</span>
                    <h2 className="text-[26px] font-bold mt-4" style={{ letterSpacing: '-0.03em' }}>Student portal</h2>
                    <p className="text-[14px] mt-1 mb-6" style={{ color: 'var(--muted)' }}>Your classes, study material and test series.</p>
                    <a href="https://prayaaseducation.akamai.net.in/" className="w-full inline-flex justify-center rounded-2xl font-bold text-white bg-[#2B59FF] hover:bg-[#1E45D9] transition-colors" style={{ padding: '15px 18px', fontSize: 15 }}>Open student portal →</a>
                    <button type="button" onClick={() => setStaff(true)} className="mt-6 pt-5 w-full text-[14px] font-semibold" style={{ borderTop: '1px solid var(--line)', color: 'var(--sub)' }}>
                        Staff member? Log in here
                    </button>
                </>
            ) : (
                <>
                    <span className="w-16 h-16 rounded-full inline-flex items-center justify-center text-[30px] jb-pop" style={{ background: '#FFEDEA' }} aria-hidden="true">🔐</span>
                    <h2 className="text-[26px] font-bold mt-4" style={{ letterSpacing: '-0.03em' }}>Staff access</h2>
                    <p className="text-[14px] mt-1 mb-5" style={{ color: 'var(--muted)' }}>Pick where you work.</p>
                    <div className="space-y-2.5 text-left">
                        {STAFF.map(s => {
                            const inner = (
                                <>
                                    <span className="w-11 h-11 rounded-2xl inline-flex items-center justify-center text-[20px] shrink-0" style={{ background: `var(--t-${s.tone})` }} aria-hidden="true">{s.emoji}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-bold text-[15px]">{s.title}</span>
                                        <span className="block text-[12.5px]" style={{ color: 'var(--muted)' }}>{s.sub}</span>
                                    </span>
                                    <span aria-hidden="true" style={{ color: 'var(--muted)' }}>→</span>
                                </>
                            );
                            const cls = 'jb-lift w-full flex items-center gap-3 rounded-[18px] p-3';
                            const st = { background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)', color: 'var(--ink)' };
                            return s.to
                                ? <button key={s.title} type="button" onClick={() => navigate(s.to)} className={cls} style={st}>{inner}</button>
                                : <a key={s.title} href={s.href} className={cls} style={st}>{inner}</a>;
                        })}
                    </div>
                    <button type="button" onClick={() => setStaff(false)} className="mt-5 pt-4 w-full text-[14px] font-semibold" style={{ borderTop: '1px solid var(--line)', color: 'var(--sub)' }}>
                        ← Back to student portal
                    </button>
                </>
            )}
        </div>
    );
};

export default LoginModal;
