// First screen of the Android app (Aditya, 24 Nov 2026): the app is only the
// staff ERP, so it never shows the public website. Signed in: straight to the
// dashboard. First launch: three short intro slides, then the login.
import React, { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import '@fontsource-variable/inter-tight/wght.css';
import KapLogo from '../components/KapLogo';
import teamImg from '../assets/hero_faculty_group_v2.webp';
import callImg from '../assets/hero_waiting_area.png';
import classImg from '../assets/hero_teacher_back.webp';

const SEEN = 'kap.appIntro.v1';
const seen = () => { try { return localStorage.getItem(SEEN) === '1'; } catch { return false; } };

const SLIDES = [
    { img: classImg, title: 'Your whole day, planned.', text: 'Plan my day shows your calls, visits and follow-ups, and rings the phone at each task’s time.' },
    { img: callImg, title: 'Call leads from your own SIM.', text: 'Tap to call. Talk time and the call recording are saved to the lead for you.' },
    { img: teamImg, title: 'Every student, in one place.', text: 'Admissions, fees, receipts and the full timeline of who changed what.' },
];

const AppStart = ({ user }) => {
    const [i, setI] = useState(0);
    const track = useRef(null);
    const navigate = useNavigate();

    if (user) return <Navigate to="/staff/dashboard" replace />;
    if (seen()) return <Navigate to="/login" replace />;

    const done = () => { try { localStorage.setItem(SEEN, '1'); } catch { /* storage blocked */ } navigate('/login', { replace: true }); };
    const go = (n) => { const t = track.current; if (t) t.scrollTo({ left: n * t.clientWidth, behavior: 'smooth' }); };
    const last = i === SLIDES.length - 1;

    return (
        <div className="kap fixed inset-0 flex flex-col text-white select-none" style={{ background: '#07130F', fontFamily: "'Inter Tight Variable', 'Plus Jakarta Sans', system-ui, sans-serif" }}>
            <div className="flex items-center justify-between px-5 shrink-0" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', height: 'calc(64px + env(safe-area-inset-top))' }}>
                <KapLogo tone="light" className="h-8 w-auto" />
                {!last && <button type="button" onClick={done} className="text-[14px] font-semibold px-3 py-2 rounded-full" style={{ color: 'rgba(255,255,255,.75)' }}>Skip</button>}
            </div>
            <div ref={track} className="flex-1 flex overflow-x-auto snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}
                onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
                aria-roledescription="carousel" aria-label="About the KAP ERP app">
                {SLIDES.map((s, n) => (
                    <section key={s.title} className="w-full shrink-0 snap-center flex flex-col px-5 pb-4" aria-roledescription="slide" aria-label={`${n + 1} of ${SLIDES.length}`}>
                        <div className="flex-1 min-h-0 rounded-[28px] overflow-hidden relative">
                            <img src={s.img} alt="" className="absolute inset-0 w-full h-full object-cover" draggable="false" />
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(7,19,15,0) 55%, rgba(7,19,15,.9) 100%)' }} />
                            <span className="absolute left-5 bottom-5 text-[13px] font-bold tracking-[.16em]" style={{ color: '#08BD80' }}>{String(n + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}</span>
                        </div>
                        <h1 className="mt-7 text-[34px] leading-[1.02] font-bold" style={{ letterSpacing: '-0.035em', color: '#fff' }}>{s.title}</h1>
                        <p className="mt-3 text-[16px] leading-relaxed" style={{ color: 'rgba(255,255,255,.72)' }}>{s.text}</p>
                    </section>
                ))}
            </div>
            <div className="shrink-0 px-5 flex items-center justify-between gap-4" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))', paddingTop: 8 }}>
                <div className="flex gap-2" aria-hidden="true">
                    {SLIDES.map((s, n) => <span key={s.title} className="h-2 rounded-full transition-all duration-300" style={{ width: n === i ? 26 : 8, background: n === i ? '#08BD80' : 'rgba(255,255,255,.28)' }} />)}
                </div>
                <button type="button" onClick={() => (last ? done() : go(i + 1))}
                    className="rounded-full font-bold text-[15px] px-6 py-3.5 transition-transform active:scale-95" style={{ background: '#08BD80', color: '#04140D' }}>
                    {last ? 'Sign in' : 'Next'}
                </button>
            </div>
        </div>
    );
};

export default AppStart;
