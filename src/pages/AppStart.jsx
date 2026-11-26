// First screen of the Android app (Aditya, 24 Nov 2026): the app is only the
// staff ERP, so it never shows the public website. Signed in: straight to the
// dashboard. First launch: three short intro slides, then the login.
import React, { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import KapLogo from '../components/KapLogo';
import teamImg from '../assets/hero_faculty_group_v2.webp';
import callImg from '../assets/hero_waiting_area.png';
import classImg from '../assets/hero_teacher_back.webp';

const SEEN = 'kap.appIntro.v1';
const seen = () => { try { return localStorage.getItem(SEEN) === '1'; } catch { return false; } };

const TONES = [['#EAF0FF', '#2B59FF', '📅'], ['#FFEDEA', '#D9482B', '📞'], ['#EAF8F1', '#067A52', '🎓']];
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

    const tone = TONES[i];
    return (
        <div className="kap fixed inset-0 flex flex-col select-none overflow-hidden" style={{ background: '#fff', color: '#14172B', fontFamily: "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif" }}>
            <span className="absolute rounded-full pointer-events-none transition-colors duration-700" style={{ width: 420, height: 420, right: -170, top: -150, filter: 'blur(70px)', opacity: 0.6, background: tone[0] }} aria-hidden="true" />
            <span className="absolute rounded-full pointer-events-none" style={{ width: 300, height: 300, left: -150, bottom: 40, filter: 'blur(70px)', opacity: 0.5, background: '#FFE3B8' }} aria-hidden="true" />
            <div className="relative flex items-center justify-between px-5 shrink-0" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', height: 'calc(64px + env(safe-area-inset-top))' }}>
                <KapLogo tone="dark" className="h-9 w-auto" />
                {!last && <button type="button" onClick={done} className="text-[14px] font-semibold px-3 py-2 rounded-full" style={{ color: '#596080' }}>Skip</button>}
            </div>
            <div ref={track} className="relative flex-1 flex overflow-x-auto snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}
                onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
                aria-roledescription="carousel" aria-label="About the KAP ERP app">
                {SLIDES.map((s, n) => (
                    <section key={s.title} className="w-full shrink-0 snap-center flex flex-col px-5 pb-4" aria-roledescription="slide" aria-label={`${n + 1} of ${SLIDES.length}`}>
                        <div className="flex-1 min-h-0 relative">
                            <div className="absolute inset-0 rounded-[28px] overflow-hidden" style={{ boxShadow: '0 28px 50px -30px rgba(43,60,140,.55)' }}>
                                <img src={s.img} alt="" className="w-full h-full object-cover" draggable="false" />
                            </div>
                            <span className="absolute left-3 -bottom-4 bg-white rounded-2xl pl-2 pr-4 py-2 flex items-center gap-2.5" style={{ boxShadow: '0 18px 36px -18px rgba(20,23,43,.35)' }}>
                                <span className="w-9 h-9 rounded-xl inline-flex items-center justify-center text-[17px]" style={{ background: TONES[n][0] }} aria-hidden="true">{TONES[n][2]}</span>
                                <b className="text-[13px]" style={{ color: TONES[n][1] }}>{String(n + 1).padStart(2, '0')} of {String(SLIDES.length).padStart(2, '0')}</b>
                            </span>
                        </div>
                        <h1 className="mt-10 text-[32px] leading-[1.06] font-extrabold" style={{ letterSpacing: '-0.035em' }}>{s.title}</h1>
                        <p className="mt-3 text-[16px] leading-relaxed" style={{ color: '#596080' }}>{s.text}</p>
                    </section>
                ))}
            </div>
            <div className="relative shrink-0 px-5 flex items-center justify-between gap-4" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))', paddingTop: 8 }}>
                <div className="flex gap-2" aria-hidden="true">
                    {SLIDES.map((s, n) => <span key={s.title} className="h-2 rounded-full transition-all duration-300" style={{ width: n === i ? 26 : 8, background: n === i ? tone[1] : '#DCE0EE' }} />)}
                </div>
                <button type="button" onClick={() => (last ? done() : go(i + 1))}
                    className="rounded-2xl font-bold text-[15px] px-6 py-3.5 text-white transition-transform active:scale-95" style={{ background: '#2B59FF', boxShadow: '0 14px 30px -12px rgba(43,89,255,.6)' }}>
                    {last ? 'Sign in' : 'Next →'}
                </button>
            </div>
        </div>
    );
};

export default AppStart;
