// Public home page, direction A (Aditya, 26 Nov 2026): light, bright and
// colourful, made for parents and students. White page with soft colour
// blobs, a blue primary, pastel chips per exam, real photos of our
// centres, directors and results, and calm motion: a load sequence,
// floating badges, count-ups, a stretchy nav pill and a progress line.
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PublicInquiryForm from '../components/PublicInquiryForm';
import LoginModal from '../components/LoginModal';
import KapLogo from '../components/KapLogo';
import { useUpcomingBatches } from '../hooks/useUpcomingBatches';
import { CENTERS } from '../utils/centers';

import nashikRdImg from '../assets/unacademy_center_nashik.webp';
import collegeRoadImg from '../assets/unacademy_college_road_new.webp';
import prayaasImg from '../assets/nashik_road.webp';
import facultyImg from '../assets/hero_faculty_group_v2.webp';
import kapilImg from '../assets/kapil_sir.webp';
import pranavImg from '../assets/pranav_sir.webp';
import abhishekImg from '../assets/abhishek_sir.webp';
import resultsImg from '../assets/results/final_result_1.webp';
import jeeImg from '../assets/gen_prog_jee.webp';
import neetImg from '../assets/gen_prog_neet.webp';
import foundImg from '../assets/gen_prog_found.webp';
import smartImg from '../assets/hero_smart_class.webp';

gsap.registerPlugin(ScrollTrigger);

const PHONE = '+91 92720 90238';
const PHONE_RAW = '919272090238';
const WA = (t) => `https://wa.me/${PHONE_RAW}${t ? `?text=${encodeURIComponent(t)}` : ''}`;

// Four pastel tones, used in turn for chips, icons and tags.
const TONES = [
    { bg: '#EAF0FF', fg: '#2B59FF' }, // blue
    { bg: '#FFEDEA', fg: '#D9482B' }, // coral
    { bg: '#FFF5D6', fg: '#A26B00' }, // yellow
    { bg: '#EAF8F1', fg: '#067A52' }, // green
];

const NAV = [['programmes', 'Courses'], ['results', 'Results'], ['centres', 'Centres'], ['batches', 'Batches'], ['mentors', 'Faculty']];
const CENTRE_OPTS = [['UN_COLLEGE', 'College Road'], ['UN_NASHIK_RD', 'Nashik Road'], ['PRAYAS', 'Prayaas']];

const PROGRAMMES = [
    { k: 'JEE', emoji: '📐', title: 'IIT JEE', sub: 'Main + Advanced', line: 'Class 11, 12 and droppers', img: jeeImg, points: ['Physics, Chemistry and Maths', 'Tests in the JEE Main and Advanced pattern', '1-year and 2-year batches'] },
    { k: 'NEET', emoji: '🧬', title: 'NEET UG', sub: 'Medical entrance', line: 'Class 11, 12 and droppers', img: neetImg, points: ['Physics, Chemistry and Biology', 'NCERT covered line by line', 'Tests in the NEET pattern'] },
    { k: 'MHT-CET', emoji: '🧪', title: 'MHT-CET', sub: 'State entrance', line: 'Engineering and pharmacy', img: smartImg, points: ['PCM or PCB groups', 'Linked with the state board syllabus', 'CET mock test series'] },
    { k: 'Foundation', emoji: '🌱', title: 'Foundation', sub: 'Class 8 to 10', line: 'Boards and Olympiads', img: foundImg, points: ['Maths, Science and mental ability', 'Olympiad and NTSE practice', 'Support for school exams'] },
];
const INCLUDED = [
    ['📘', 'Printed study material', 'Notes and practice books for every chapter.'],
    ['📝', 'Weekly tests', 'With a rank, analysis and a doubt class after.'],
    ['🙋', 'Doubt sessions', 'Ask the faculty in person after class.'],
    ['👨‍👩‍👧', 'Parent meetings', 'Progress shared with parents regularly.'],
    ['📚', 'Library and study hall', 'Quiet seats to study before and after class.'],
    ['📱', 'Parent app', 'Attendance, homework and fees on the phone.'],
];
const FAQ = [
    ['Is the demo class really free?', 'Yes. Come with a parent, sit in a real class and meet the faculty. There is no charge and no pressure to join.'],
    ['Which classes do you teach?', 'Class 8, 9 and 10 in Foundation, and Class 11, 12 and droppers for JEE, NEET and MHT-CET.'],
    ['Can we pay the fees in instalments?', 'Yes. The counsellor gives you a written fee plan with instalment dates before you decide.'],
    ['Do you give scholarships?', 'Yes. Ask the counsellor at your demo class how the scholarship test works this year.'],
    ['Is there a hostel?', 'Yes, for both boys and girls. The counsellor shares the hostel fees and rules.'],
    ['How will we know how our child is doing?', 'Weekly test results, parent meetings, a mentor who calls home, and the parent app.'],
];
const STEPS = [
    ['Visit', 'A free demo class, with a parent.'],
    ['Assess', 'A short test to find the right batch.'],
    ['Enrol', 'A clear fee plan, with instalments.'],
    ['Learn', 'Daily classes by the directors and their team.'],
    ['Practise', 'Weekly tests, doubt sessions and analysis.'],
    ['Achieve', 'Mock exams and mentoring up to exam day.'],
];
const CENTRES = [
    { id: 'UN_COLLEGE', name: 'College Road', type: 'Unacademy Centre', img: collegeRoadImg, pos: 'center 30%', tags: ['IIT JEE', 'NEET', 'Foundation'] },
    { id: 'UN_NASHIK_RD', name: 'Nashik Road', type: 'Unacademy Centre', img: nashikRdImg, pos: 'center', tags: ['IIT JEE', 'NEET'] },
    { id: 'PRAYAS', name: 'Prayaas', type: 'Information centre run by KAP', img: prayaasImg, pos: 'center', tags: ['Dropper batches', 'Library'] },
];
const STATS = [['🏆', 150, '+', 'IIT selections'], ['🩺', 300, '+', 'Government medical seats'], ['📈', 85, '+', 'students above 99 percentile'], ['🎓', 2, ' Cr+', 'in scholarships given', '₹']];
const MENTORS = [
    { img: kapilImg, name: 'Kapil Gautam', subject: 'Physics', quote: 'Students learn with love and grow with guidance.' },
    { img: abhishekImg, name: 'Abhishek Rawat', subject: 'Physics', quote: 'Master concepts with visualisation and real-world examples.' },
    { img: pranavImg, name: 'Pranav Tripathi', subject: 'Chemistry', quote: 'Chemistry is the language of the universe.' },
];
const TOGETHER = [
    ['👨‍🏫', 'Directors who teach', 'The founders take classes themselves, every week.'],
    ['🎯', 'Tests that teach', 'Weekly tests with analysis of every mistake.'],
    ['🤝', 'A mentor for each student', 'One person who tracks progress and calls home.'],
    ['📲', 'Parents in the loop', 'Attendance, homework and fees in the parent app.'],
];

const when = (d) => { const t = new Date(d); return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
const Arrow = () => <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Kick = ({ tone = 0, children }) => <span className="a-kick" style={{ background: TONES[tone].bg, color: TONES[tone].fg }}>{children}</span>;

const PublicHome = () => {
    const [demo, setDemo] = useState(null); // null = closed, {} or {center, courseInterest} = open
    const [showLogin, setShowLogin] = useState(false);
    const [menu, setMenu] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [active, setActive] = useState('');
    const { batches } = useUpcomingBatches();
    const root = useRef(null);
    const bar = useRef(null);
    const pill = useRef(null);
    const pillState = useRef({ l: 0, r: 0, on: false });

    const openDemo = (initial = {}) => { setMenu(false); setDemo(initial); };

    useEffect(() => {
        const on = () => setScrolled(window.scrollY > 12);
        on();
        window.addEventListener('scroll', on, { passive: true });
        return () => window.removeEventListener('scroll', on);
    }, []);

    // Which section is on screen, for the nav pill.
    useEffect(() => {
        const ids = NAV.map(([h]) => h);
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
        }, { rootMargin: '-45% 0px -50% 0px' });
        ids.forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
        const top = () => { if (window.scrollY < window.innerHeight * 0.4) setActive(''); };
        window.addEventListener('scroll', top, { passive: true });
        return () => { io.disconnect(); window.removeEventListener('scroll', top); };
    }, []);

    // Stretchy pill: the leading edge moves first, the trailing edge follows.
    useEffect(() => {
        const b = bar.current, p = pill.current;
        if (!b || !p) return;
        const st = pillState.current;
        const paint = () => gsap.set(p, { clipPath: `inset(4px ${st.r}px 4px ${st.l}px round 999px)`, opacity: st.on ? 1 : 0 });
        const tab = active ? b.querySelector(`[data-nav="${active}"]`) : null;
        if (!tab) { st.on = false; gsap.to(p, { opacity: 0, duration: 0.25 }); return; }
        const to = { l: tab.offsetLeft, r: b.clientWidth - tab.offsetLeft - tab.offsetWidth };
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!st.on || reduce) { Object.assign(st, to, { on: true }); paint(); return; }
        const [lead, trail] = to.l > st.l ? ['r', 'l'] : ['l', 'r'];
        gsap.to(st, { [lead]: to[lead], duration: 0.36, ease: 'power3.out', onUpdate: paint, overwrite: 'auto' });
        gsap.to(st, { [trail]: to[trail], duration: 0.55, ease: 'power3.inOut', onUpdate: paint, overwrite: 'auto' });
    }, [active]);

    useEffect(() => {
        const open = demo || showLogin || menu;
        document.documentElement.style.overflow = open ? 'hidden' : '';
        if (!open) return undefined;
        const esc = (e) => { if (e.key === 'Escape') { setDemo(null); setShowLogin(false); setMenu(false); } };
        window.addEventListener('keydown', esc);
        return () => { window.removeEventListener('keydown', esc); document.documentElement.style.overflow = ''; };
    }, [demo, showLogin, menu]);

    // Motion starts from the visible page, so nothing stays hidden if
    // scripts fail. Reduced motion gets a still page with the line filled.
    useLayoutEffect(() => {
        const el = root.current;
        if (!el) return undefined;
        const mm = gsap.matchMedia();
        const ctx = gsap.context(() => {
            mm.add('(prefers-reduced-motion: no-preference)', () => {
                const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
                tl.from('.a-hero-copy > *', { y: 26, opacity: 0, duration: 0.8, stagger: 0.08 })
                    .from('.a-photo-main', { scale: 0.92, opacity: 0, duration: 1, ease: 'expo.out' }, 0.15)
                    .from('.a-float', { scale: 0.6, opacity: 0, y: 20, duration: 0.7, stagger: 0.12, ease: 'back.out(1.6)' }, 0.55)
                    .from('.a-mark-bar', { scaleX: 0, duration: 0.7, ease: 'power2.inOut' }, 0.5);
                // Badges keep a gentle bob.
                gsap.utils.toArray('.a-float').forEach((f, i) => {
                    gsap.to(f, { y: i % 2 ? 8 : -8, duration: 2.6 + i * 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.4 });
                });
                gsap.to('.a-blob', { x: (i) => [30, -24, 18][i] || 0, y: (i) => [20, -18, -26][i] || 0, duration: 7, ease: 'sine.inOut', yoyo: true, repeat: -1 });
                gsap.to('.a-photo-main img', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.a-hero', start: 'top top', end: 'bottom top', scrub: true } });

                gsap.set('[data-rv]', { y: 36, opacity: 0 });
                ScrollTrigger.batch('[data-rv]', {
                    start: 'top 90%', once: true,
                    onEnter: (b) => gsap.to(b, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.08, overwrite: true }),
                });

                ScrollTrigger.create({
                    trigger: '.a-steps', start: 'top 75%', end: 'bottom 55%', scrub: true,
                    onUpdate: (s) => el.querySelector('.a-steps')?.style.setProperty('--p', s.progress.toFixed(3)),
                });

                el.querySelectorAll('[data-count]').forEach((n) => {
                    const end = Number(n.dataset.count);
                    const o = { v: 0 };
                    gsap.to(o, { v: end, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: n, start: 'top 92%', once: true }, onUpdate: () => { n.textContent = Math.round(o.v); } });
                });
            });
            mm.add('(prefers-reduced-motion: reduce)', () => { el.querySelector('.a-steps')?.style.setProperty('--p', '1'); });
        }, el);
        return () => { mm.revert(); ctx.revert(); };
    }, []);

    useEffect(() => { ScrollTrigger.refresh(); }, [batches.length]);

    const batchList = batches.length ? batches : [{ id: 'jee', name: 'IIT JEE · Class 11, 12 and droppers' }, { id: 'neet', name: 'NEET UG · Class 11, 12 and droppers' }, { id: 'fd', name: 'Foundation · Class 8, 9 and 10' }];

    return (
        <div ref={root} className="kap ax min-h-screen overflow-x-clip">
            <style>{`
                .ax { --ink:#14172B; --sub:#596080; --line:#ECEEF6; --soft:#F7F8FC; --blue:#2B59FF; --blued:#1E45D9;
                      font-family: 'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif; background:#fff; color: var(--ink); }
                .ax h1, .ax h2, .ax h3 { letter-spacing: -0.035em; font-weight: 800; }
              @layer components {
                .a-wrap { max-width: 1200px; margin: 0 auto; }
                .a-kick { display:inline-flex; align-items:center; gap:8px; font-weight:700; font-size:13px; padding:7px 14px; border-radius:999px; }
                .a-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:16px; padding:14px 22px; font-weight:700; font-size:15px; white-space:nowrap;
                         transition: transform .2s ease, background-color .2s ease, box-shadow .25s ease, color .2s ease; }
                .a-btn:active { transform: scale(.97); }
                .a-btn svg { transition: transform .2s ease; } .a-btn:hover svg { transform: translateX(3px); }
                .a-btn-blue { background: var(--blue); color:#fff; box-shadow: 0 14px 30px -12px rgba(43,89,255,.6); }
                .a-btn-blue:hover { background: var(--blued); box-shadow: 0 18px 36px -12px rgba(43,89,255,.7); transform: translateY(-1px); }
                .a-btn-line { box-shadow: inset 0 0 0 1.5px #D9DCEB; color: var(--ink); background:#fff; } .a-btn-line:hover { box-shadow: inset 0 0 0 1.5px var(--ink); }
                .a-btn-white { background:#fff; color: var(--blue); } .a-btn-white:hover { transform: translateY(-1px); box-shadow: 0 16px 30px -14px rgba(0,0,0,.35); }
                .a-blob { position:absolute; border-radius:50%; filter: blur(70px); opacity:.55; pointer-events:none; }
                .a-mark { position:relative; white-space:nowrap; }
                .a-mark-bar { position:absolute; left:-4px; right:-4px; bottom:.06em; height:.36em; background:#FFE27A; border-radius:6px; z-index:-1; transform-origin: 0 50%; }
                .a-chip { display:inline-flex; align-items:center; gap:6px; padding:10px 16px; border-radius:14px; font-weight:700; font-size:14px; transition: transform .2s ease; }
                .a-chip:hover { transform: translateY(-2px); }
                .a-photo-main { border-radius: 32px; overflow:hidden; box-shadow: 0 30px 60px -30px rgba(43,60,140,.45); }
                .a-photo-main img { width:100%; height:115%; object-fit:cover; margin-top:-7%; }
                .a-float { position:absolute; background:#fff; border-radius:20px; padding:12px 16px 12px 12px; box-shadow: 0 20px 40px -18px rgba(20,23,43,.3); display:flex; gap:12px; align-items:center; }
                .a-ic { width:44px; height:44px; border-radius:14px; display:inline-flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
                .a-av { width:36px; height:36px; border-radius:50%; border:3px solid #fff; object-fit:cover; object-position:top; margin-left:-10px; background:#EAF0FF; }
                .a-card { background:#fff; border-radius: 26px; box-shadow: 0 0 0 1px var(--line); transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s ease; }
                .a-card:hover { transform: translateY(-5px); box-shadow: 0 0 0 1px var(--line), 0 26px 50px -26px rgba(43,60,140,.35); }
                .a-zoom img { transition: transform .8s cubic-bezier(.22,1,.36,1); } .a-zoom:hover img { transform: scale(1.06); }
                .a-tag { font-size:12px; font-weight:800; padding:5px 10px; border-radius:999px; display:inline-block; }
                .a-navbar { position:relative; display:flex; gap:2px; background:#F3F5FB; border-radius:999px; padding:4px; }
                .a-navbar a { position:relative; z-index:1; padding:9px 16px; border-radius:999px; font-weight:600; font-size:14px; color:#4A5070; transition: color .2s ease; }
                .a-navbar a:hover, .a-navbar a[data-on="true"] { color: var(--ink); }
                .a-pill { position:absolute; inset:0; background:#fff; border-radius:999px; opacity:0; clip-path: inset(4px 100% 4px 0 round 999px); }

                .a-steps { --p: 0; }
                .a-track { position:absolute; background: var(--line); border-radius:4px; }
                .a-fill { position:absolute; inset:0; border-radius:4px; background: linear-gradient(90deg, #2B59FF, #D9482B 40%, #F0B400 70%, #0BA56D); transform-origin: 0 0; }
                .a-node { transition: transform .35s cubic-bezier(.22,1,.36,1), background-color .3s ease, color .3s ease; }
                .a-node[data-on="true"] { transform: scale(1.08); }
                @media (min-width: 1024px) { .a-track { left: 26px; right: calc((100% - 80px) / 6 - 26px); top: 25px; height: 4px; } .a-fill { transform: scaleX(var(--p)); } }
                @media (max-width: 1023.98px) { .a-track { left: 24px; top: 26px; bottom: 26px; width: 4px; } .a-fill { transform: scaleY(var(--p)); background: linear-gradient(180deg, #2B59FF, #D9482B 40%, #F0B400 70%, #0BA56D); } }

                .a-rise { animation: aRise .5s cubic-bezier(.22,1,.36,1) both; }
                @keyframes aRise { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform:none } }
                @media (prefers-reduced-motion: reduce) { .a-rise { animation:none; } .a-card, .a-zoom img, .a-btn, .a-chip { transition:none; } }
                html { scroll-behavior: smooth; scroll-padding-top: 84px; }
                @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
              }
            `}</style>

            {/* Header */}
            <header className="fixed top-0 inset-x-0 z-50 transition-[background-color,box-shadow] duration-300"
                style={{ background: scrolled || menu ? 'rgba(255,255,255,.9)' : 'transparent', backdropFilter: scrolled ? 'blur(14px)' : 'none', boxShadow: scrolled ? '0 1px 0 #ECEEF6' : 'none' }}>
                <nav aria-label="Main" className="a-wrap h-[70px] sm:h-[78px] px-4 sm:px-8 flex items-center justify-between gap-3">
                    <a href="#top" className="shrink-0 inline-flex" aria-label="KAP Edutech home"><KapLogo tone="dark" className="h-9 sm:h-10 w-auto" /></a>
                    <div ref={bar} className="a-navbar hidden lg:flex">
                        <span ref={pill} className="a-pill" aria-hidden="true" />
                        {NAV.map(([h, l]) => <a key={h} data-nav={h} data-on={String(active === h)} href={`#${h}`}>{l}</a>)}
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setShowLogin(true)} className="a-btn a-btn-line hidden sm:inline-flex" style={{ padding: '11px 18px', fontSize: 14 }}>Log in</button>
                        <button type="button" onClick={() => openDemo()} className="a-btn a-btn-blue" style={{ padding: '11px 18px', fontSize: 14 }}>Free demo</button>
                        <button type="button" onClick={() => setMenu(m => !m)} aria-expanded={menu} aria-controls="a-menu" aria-label={menu ? 'Close menu' : 'Open menu'}
                            className="a-btn a-btn-line lg:hidden" style={{ padding: '11px 14px', fontSize: 14 }}>{menu ? '✕' : '☰'}</button>
                    </div>
                </nav>
            </header>
            {menu && (
                <div id="a-menu" className="lg:hidden fixed inset-0 z-40 pt-24 px-5 pb-8 flex flex-col a-rise" style={{ background: '#fff' }}>
                    {NAV.map(([h, l], i) => (
                        <a key={h} href={`#${h}`} onClick={() => setMenu(false)} className="py-3.5 text-[26px] font-extrabold flex items-center gap-4" style={{ borderBottom: '1px solid var(--line)', letterSpacing: '-0.03em' }}>
                            <span className="a-ic" style={{ background: TONES[i % 4].bg, color: TONES[i % 4].fg, width: 36, height: 36, fontSize: 13, borderRadius: 12 }}>{String(i + 1).padStart(2, '0')}</span>{l}
                        </a>
                    ))}
                    <div className="mt-auto grid gap-2">
                        <button type="button" onClick={() => { setMenu(false); setShowLogin(true); }} className="a-btn a-btn-line w-full">Log in</button>
                        <button type="button" onClick={() => openDemo()} className="a-btn a-btn-blue w-full">Book a free demo class</button>
                    </div>
                </div>
            )}

            {/* Hero */}
            <section id="top" className="a-hero relative overflow-hidden pt-[96px] sm:pt-[120px] pb-16 sm:pb-24 px-4 sm:px-8" aria-label="Welcome">
                <span className="a-blob" style={{ width: 520, height: 520, background: '#BFD3FF', right: -140, top: -120 }} aria-hidden="true" />
                <span className="a-blob" style={{ width: 380, height: 380, background: '#C8F2DF', left: -140, top: 300 }} aria-hidden="true" />
                <span className="a-blob" style={{ width: 300, height: 300, background: '#FFE3B8', right: '34%', bottom: -100 }} aria-hidden="true" />
                <div className="a-wrap relative grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-14 items-center">
                    <div className="a-hero-copy">
                        <Kick tone={3}><span aria-hidden="true">●</span> Admissions open for 2026–27</Kick>
                        <h1 className="mt-5 text-[40px] sm:text-[56px] lg:text-[64px] leading-[1.05]">
                            Nashik's classroom for <span className="a-mark"><span className="a-mark-bar" aria-hidden="true" />JEE &amp; NEET</span> toppers.
                        </h1>
                        <p className="mt-5 text-[17px] sm:text-[18px] leading-relaxed max-w-[520px]" style={{ color: 'var(--sub)' }}>Daily classes by the directors, a test every week and a mentor who calls home. At three centres across Nashik.</p>
                        <div className="mt-6 flex flex-wrap gap-2">
                            {PROGRAMMES.map((p, i) => (
                                <button key={p.k} type="button" onClick={() => openDemo({ courseInterest: p.k })} className="a-chip" style={{ background: TONES[i].bg, color: TONES[i].fg }}>
                                    <span aria-hidden="true">{p.emoji}</span>{p.title}
                                </button>
                            ))}
                        </div>
                        <div className="mt-7 flex flex-wrap gap-3">
                            <button type="button" onClick={() => openDemo()} className="a-btn a-btn-blue">Book a free demo class <Arrow /></button>
                            <a href="#results" className="a-btn a-btn-line">See our results</a>
                        </div>
                        <div className="mt-7 flex items-center gap-3.5">
                            <span className="flex pl-2.5">{MENTORS.map(m => <img key={m.name} src={m.img} alt="" className="a-av" />)}</span>
                            <span className="text-[14px]" style={{ color: 'var(--sub)' }}><b style={{ color: 'var(--ink)' }}>Taught by the directors</b> at three centres</span>
                        </div>
                    </div>
                    <div className="relative mx-2 sm:mx-6 lg:mx-0">
                        <div className="a-photo-main aspect-[4/3.2]"><img src={foundImg} alt="Students in a bright KAP classroom" fetchPriority="high" /></div>
                        <div className="a-float left-[-10px] sm:left-[-34px] top-[8%]"><span className="a-ic" style={{ background: TONES[0].bg }} aria-hidden="true">🏆</span><span><b className="block text-[20px] sm:text-[24px] leading-none" style={{ letterSpacing: '-0.03em' }}>150+</b><span className="text-[12.5px]" style={{ color: 'var(--sub)' }}>IIT selections</span></span></div>
                        <div className="a-float right-[-8px] sm:right-[-20px] top-[46%]"><span className="a-ic" style={{ background: TONES[1].bg }} aria-hidden="true">🩺</span><span><b className="block text-[20px] sm:text-[24px] leading-none" style={{ letterSpacing: '-0.03em' }}>300+</b><span className="text-[12.5px]" style={{ color: 'var(--sub)' }}>Government medical seats</span></span></div>
                        <div className="a-float left-[16px] sm:left-[40px] bottom-[-24px]"><span className="a-ic" style={{ background: TONES[3].bg }} aria-hidden="true">📝</span><span><b className="block text-[15px] sm:text-[16px]">Weekly test</b><span className="text-[12.5px]" style={{ color: 'var(--sub)' }}>With rank and analysis</span></span></div>
                    </div>
                </div>
            </section>

            {/* Numbers */}
            <section className="px-4 sm:px-8 pb-16 sm:pb-20" aria-label="Our results in numbers">
                <dl className="a-wrap grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {STATS.map(([e, n, suf, l, pre], i) => (
                        <div key={l} data-rv className="rounded-[24px] p-5 sm:p-6" style={{ background: TONES[i].bg }}>
                            <span className="a-ic" style={{ background: '#fff' }} aria-hidden="true">{e}</span>
                            <dt className="sr-only">{l}</dt>
                            <dd className="mt-4 text-[34px] sm:text-[44px] font-extrabold leading-none" style={{ color: TONES[i].fg, letterSpacing: '-0.04em' }}>{pre}<span data-count={n}>{n}</span>{suf}</dd>
                            <dd className="mt-2 text-[13.5px] sm:text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{l}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            {/* Courses */}
            <section id="programmes" className="px-4 sm:px-8 py-20 sm:py-24" style={{ background: 'var(--soft)' }}>
                <div className="a-wrap">
                    <div className="flex flex-wrap items-end justify-between gap-5">
                        <div>
                            <Kick tone={0}>Courses</Kick>
                            <h2 className="mt-3 text-[32px] sm:text-[44px] leading-[1.08] max-w-[640px]">Pick your goal. We'll plan the rest.</h2>
                        </div>
                        <p className="text-[16px] max-w-[440px]" style={{ color: 'var(--sub)' }}>Every course has classes in person, a weekly test, and a mentor who knows your child by name.</p>
                    </div>
                    <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {PROGRAMMES.map((p, i) => (
                            <button key={p.k} type="button" data-rv onClick={() => openDemo({ courseInterest: p.k })} className="a-card a-zoom text-left overflow-hidden flex flex-col">
                                <div className="aspect-[4/3] overflow-hidden"><img src={p.img} alt="" loading="lazy" className="w-full h-full object-cover" /></div>
                                <div className="p-5 flex-1 flex flex-col">
                                    <span><span className="a-tag" style={{ background: TONES[i].bg, color: TONES[i].fg }}>{p.title}</span></span>
                                    <span className="block text-[19px] font-extrabold mt-2.5" style={{ letterSpacing: '-0.03em' }}>{p.sub}</span>
                                    <span className="block text-[14px] mt-0.5" style={{ color: 'var(--sub)' }}>{p.line}</span>
                                    <ul className="mt-3 space-y-1.5 text-[13.5px]">
                                        {p.points.map(t => <li key={t} className="flex gap-2"><span aria-hidden="true" className="font-bold" style={{ color: TONES[i].fg }}>✓</span>{t}</li>)}
                                    </ul>
                                    <span className="mt-auto pt-4 inline-flex items-center gap-1.5 text-[14px] font-bold" style={{ color: TONES[i].fg }}>Book a demo <Arrow /></span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Why KAP */}
            <section className="px-4 sm:px-8 py-20 sm:py-24" aria-labelledby="a-why">
                <div className="a-wrap grid lg:grid-cols-[1fr_1fr] gap-10 lg:gap-14 items-center">
                    <figure data-rv className="relative">
                        <div className="rounded-[32px] overflow-hidden aspect-[3/2]" style={{ boxShadow: '0 30px 60px -30px rgba(43,60,140,.45)' }}>
                            <img src={facultyImg} alt="The KAP Edutech directors at the Unacademy centre" loading="lazy" className="w-full h-full object-cover" style={{ objectPosition: 'center 40%' }} />
                        </div>
                        <figcaption className="a-float right-[8px] sm:right-[-14px] bottom-[-22px]">
                            <span className="a-ic" style={{ background: TONES[2].bg }} aria-hidden="true">⭐</span>
                            <span><b className="block text-[15px]">The directors teach</b><span className="text-[12.5px]" style={{ color: 'var(--sub)' }}>In the classroom, every week</span></span>
                        </figcaption>
                    </figure>
                    <div>
                        <Kick tone={1}>Why KAP</Kick>
                        <h2 id="a-why" className="mt-3 text-[32px] sm:text-[44px] leading-[1.08]">Coaching works better when every part works together.</h2>
                        <ul className="mt-8 grid sm:grid-cols-2 gap-3">
                            {TOGETHER.map(([e, t, d], i) => (
                                <li key={t} data-rv className="a-card p-5">
                                    <span className="a-ic" style={{ background: TONES[i].bg }} aria-hidden="true">{e}</span>
                                    <b className="block text-[16px] mt-3" style={{ letterSpacing: '-0.02em' }}>{t}</b>
                                    <span className="block text-[14px] mt-1" style={{ color: 'var(--sub)' }}>{d}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* Six steps */}
            <section className="px-4 sm:px-8 py-20 sm:py-24" style={{ background: 'var(--soft)' }} aria-labelledby="a-steps-h">
                <div className="a-wrap">
                    <Kick tone={2}>How it works</Kick>
                    <h2 id="a-steps-h" className="mt-3 text-[32px] sm:text-[44px] leading-[1.08] max-w-[700px]">From first visit to final rank, in six steps.</h2>
                    <ol className="a-steps relative mt-12 grid lg:grid-cols-6 gap-8 lg:gap-4">
                        <span className="a-track" aria-hidden="true"><span className="a-fill" /></span>
                        {STEPS.map(([t, d], i) => (
                            <li key={t} className="relative flex lg:block gap-5">
                                <StepNode i={i} />
                                <div className="lg:mt-5 lg:pr-2">
                                    <b className="block text-[19px]" style={{ letterSpacing: '-0.03em' }}>{t}</b>
                                    <span className="block text-[14.5px] mt-1" style={{ color: 'var(--sub)' }}>{d}</span>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* Included */}
            <section className="px-4 sm:px-8 py-20 sm:py-24" aria-labelledby="a-inc">
                <div className="a-wrap">
                    <Kick tone={3}>Included in every course</Kick>
                    <h2 id="a-inc" className="mt-3 text-[32px] sm:text-[44px] leading-[1.08] max-w-[700px]">Everything a student needs, under one roof.</h2>
                    <ul className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {INCLUDED.map(([e, t, d], i) => (
                            <li key={t} data-rv className="a-card p-5 flex gap-4 items-start">
                                <span className="a-ic" style={{ background: TONES[i % 4].bg, width: 52, height: 52, fontSize: 24, borderRadius: 16 }} aria-hidden="true">{e}</span>
                                <span><b className="block text-[17px]" style={{ letterSpacing: '-0.02em' }}>{t}</b><span className="block text-[14px] mt-1" style={{ color: 'var(--sub)' }}>{d}</span></span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* Results */}
            <section id="results" className="px-4 sm:px-8 py-6 sm:py-10">
                <div className="a-wrap rounded-[32px] overflow-hidden grid lg:grid-cols-[0.85fr_1.15fr] gap-10 items-center p-6 sm:p-12"
                    style={{ background: 'linear-gradient(135deg, #EAF0FF 0%, #F3EEFF 50%, #FFF1E6 100%)' }}>
                    <div>
                        <Kick tone={0}>Results 2025</Kick>
                        <h2 className="mt-3 text-[32px] sm:text-[44px] leading-[1.08]">Results that speak for our students.</h2>
                        <p className="mt-4 text-[16px]" style={{ color: 'var(--sub)' }}>Our students cleared IIT JEE and NEET from the same classrooms, with the same weekly tests your child will take.</p>
                        <ul className="mt-6 grid gap-2.5">
                            {STATS.slice(0, 3).map(([e, n, suf, l], i) => (
                                <li key={l} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3" style={{ boxShadow: '0 10px 24px -18px rgba(20,23,43,.4)' }}>
                                    <span className="a-ic" style={{ background: TONES[i].bg, width: 38, height: 38, fontSize: 17, borderRadius: 12 }} aria-hidden="true">{e}</span>
                                    <span className="text-[15px]"><b style={{ color: TONES[i].fg }}>{n}{suf}</b> {l}</span>
                                </li>
                            ))}
                        </ul>
                        <button type="button" onClick={() => openDemo()} className="a-btn a-btn-blue mt-7">Start your preparation <Arrow /></button>
                    </div>
                    <figure data-rv className="rounded-[24px] overflow-hidden bg-white" style={{ boxShadow: '0 30px 60px -30px rgba(43,60,140,.45)' }}>
                        <img src={resultsImg} alt="IIT JEE and NEET 2025 results of Unacademy Nashik" loading="lazy" className="w-full h-auto block" />
                    </figure>
                </div>
            </section>

            {/* Centres */}
            <section id="centres" className="px-4 sm:px-8 py-20 sm:py-24">
                <div className="a-wrap">
                    <div className="flex flex-wrap items-end justify-between gap-5">
                        <div>
                            <Kick tone={3}>Centres</Kick>
                            <h2 className="mt-3 text-[32px] sm:text-[44px] leading-[1.08]">Three centres across Nashik.</h2>
                        </div>
                        <a href={WA('Hi, I would like to visit a KAP centre.')} target="_blank" rel="noreferrer" className="a-btn a-btn-line">Plan a visit on WhatsApp <Arrow /></a>
                    </div>
                    <div className="mt-10 grid sm:grid-cols-3 gap-4">
                        {CENTRES.map((c, i) => (
                            <button key={c.id} type="button" data-rv onClick={() => openDemo({ center: c.id })} className="a-card a-zoom overflow-hidden text-left flex flex-col">
                                <div className="aspect-[4/3] overflow-hidden"><img src={c.img} alt={`${c.name} centre`} loading="lazy" className="w-full h-full object-cover" style={{ objectPosition: c.pos }} /></div>
                                <div className="p-5 flex-1 flex flex-col">
                                    <span className="text-[12.5px] font-bold" style={{ color: TONES[i].fg }}>{c.type}</span>
                                    <span className="block text-[22px] font-extrabold mt-0.5" style={{ letterSpacing: '-0.03em' }}>{c.name}</span>
                                    {CENTERS[c.id]?.address && <span className="block text-[13.5px] mt-1 leading-snug" style={{ color: 'var(--sub)' }}>📍 {CENTERS[c.id].address}</span>}
                                    <span className="mt-auto pt-4 flex flex-wrap gap-1.5">{c.tags.map(t => <span key={t} className="a-tag" style={{ background: TONES[i].bg, color: TONES[i].fg }}>{t}</span>)}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Batches */}
            <section id="batches" className="px-4 sm:px-8 py-20 sm:py-24" style={{ background: 'var(--soft)' }}>
                <div className="a-wrap grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16 items-start">
                    <div className="lg:sticky lg:top-28">
                        <Kick tone={1}>Batches</Kick>
                        <h2 className="mt-3 text-[32px] sm:text-[44px] leading-[1.08]">Your next batch starts soon.</h2>
                        <p className="mt-4 text-[16px]" style={{ color: 'var(--sub)' }}>Pick a batch and save your seat. Our counsellor calls you back the same day.</p>
                        <button type="button" onClick={() => openDemo()} className="a-btn a-btn-blue mt-7">Reserve a seat <Arrow /></button>
                    </div>
                    <ul className="grid gap-3">
                        {batchList.map((b, i) => {
                            const start = b.startDate && when(b.startDate) ? new Date(b.startDate) : null;
                            const t = TONES[i % 4];
                            return (
                                <li key={b.id}>
                                    <button type="button" data-rv onClick={() => openDemo()} className="a-card w-full text-left p-4 sm:p-5 flex items-center gap-4 sm:gap-5 group">
                                        <span className="w-14 h-14 rounded-2xl shrink-0 inline-flex flex-col items-center justify-center text-center leading-none" style={{ background: t.bg, color: t.fg }}>
                                            {start ? <><b className="text-[20px]">{start.getDate()}</b><span className="text-[11px] font-bold mt-1 uppercase">{start.toLocaleDateString('en-IN', { month: 'short' })}</span></> : <b className="text-[20px]" aria-hidden="true">✦</b>}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[17px] sm:text-[19px] font-extrabold" style={{ letterSpacing: '-0.025em' }}>{b.name}</span>
                                            <span className="block text-[13.5px] mt-0.5" style={{ color: 'var(--sub)' }}>
                                                {[b.program && String(b.program).replace(/_/g, ' '), b.centerName, b.timing].filter(Boolean).join(' · ') || 'All centres'}
                                                {start ? ` · Starts ${when(b.startDate)}` : ' · Admissions open'}
                                            </span>
                                        </span>
                                        <span className="w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0 transition-colors group-hover:text-white group-hover:bg-[var(--blue)]" style={{ boxShadow: 'inset 0 0 0 1.5px #D9DCEB' }}><Arrow /></span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </section>

            {/* Faculty */}
            <section id="mentors" className="px-4 sm:px-8 py-20 sm:py-24">
                <div className="a-wrap">
                    <Kick tone={2}>Faculty</Kick>
                    <h2 className="mt-3 text-[32px] sm:text-[44px] leading-[1.08]">Taught by the directors themselves.</h2>
                    <div className="mt-10 grid sm:grid-cols-3 gap-4">
                        {MENTORS.map((m, i) => (
                            <figure key={m.name} data-rv className="a-card overflow-hidden">
                                <div className="aspect-[4/3.4] overflow-hidden" style={{ background: TONES[i].bg }}><img src={m.img} alt={m.name} loading="lazy" className="w-full h-full object-cover object-top" /></div>
                                <div className="p-5">
                                    <span className="a-tag" style={{ background: TONES[i].bg, color: TONES[i].fg }}>Director · {m.subject}</span>
                                    <blockquote className="mt-3 text-[17px] font-bold leading-snug" style={{ letterSpacing: '-0.02em' }}>“{m.quote}”</blockquote>
                                    <figcaption className="mt-3 text-[14px] font-semibold" style={{ color: 'var(--sub)' }}>{m.name}</figcaption>
                                </div>
                            </figure>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="px-4 sm:px-8 pb-20 sm:pb-24" aria-labelledby="a-faq">
                <div className="a-wrap grid lg:grid-cols-[0.8fr_1.2fr] gap-10">
                    <div>
                        <Kick tone={0}>Questions</Kick>
                        <h2 id="a-faq" className="mt-3 text-[32px] sm:text-[44px] leading-[1.08]">What parents ask us first.</h2>
                        <p className="mt-4 text-[16px]" style={{ color: 'var(--sub)' }}>Something else? Call <a href={`tel:+${PHONE_RAW}`} className="font-bold" style={{ color: 'var(--blue)' }}>{PHONE}</a> or message us on WhatsApp.</p>
                    </div>
                    <div className="grid gap-3">
                        {FAQ.map(([q, a]) => (
                            <details key={q} className="a-card group px-5 py-4 [&_summary::-webkit-details-marker]:hidden" style={{ transform: 'none' }}>
                                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-[16.5px] font-bold" style={{ letterSpacing: '-0.02em' }}>
                                    {q}
                                    <span className="w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0 text-[18px] transition-transform group-open:rotate-45" style={{ background: '#EAF0FF', color: 'var(--blue)' }} aria-hidden="true">+</span>
                                </summary>
                                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: 'var(--sub)' }}>{a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Call to action */}
            <section className="px-4 sm:px-8 pb-6">
                <div className="a-wrap relative overflow-hidden rounded-[32px] px-6 sm:px-14 py-14 sm:py-20 text-white" style={{ background: 'linear-gradient(120deg, #2B59FF 0%, #4C6BFF 45%, #7A5CFF 100%)' }}>
                    <span className="a-blob" style={{ width: 360, height: 360, background: '#7FE3C0', right: -80, top: -140, opacity: 0.45 }} aria-hidden="true" />
                    <span className="a-blob" style={{ width: 280, height: 280, background: '#FFD27A', left: '30%', bottom: -180, opacity: 0.45 }} aria-hidden="true" />
                    <div className="relative grid lg:grid-cols-[1.3fr_1fr] gap-8 items-end">
                        <h2 className="text-[36px] sm:text-[56px] leading-[1.02]">Let's plan your rank, together.</h2>
                        <div>
                            <p className="text-[17px]" style={{ color: 'rgba(255,255,255,.85)' }}>Come for a free demo class with a parent. Meet the faculty, see the classroom and leave with a study plan.</p>
                            <div className="mt-7 flex flex-wrap gap-3">
                                <button type="button" onClick={() => openDemo()} className="a-btn a-btn-white">Book a free demo <Arrow /></button>
                                <a href={`tel:+${PHONE_RAW}`} className="a-btn" style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.7)', color: '#fff' }}>Call {PHONE}</a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="px-4 sm:px-8 pt-12 pb-10">
                <div className="a-wrap grid sm:grid-cols-[1.6fr_1fr_1fr] gap-8">
                    <div>
                        <KapLogo tone="dark" className="h-10 w-auto" />
                        <p className="mt-3 text-[14px] max-w-sm" style={{ color: 'var(--sub)' }}>KAP Edutech Pvt. Ltd. Coaching for JEE, NEET, MHT-CET and Foundation in Nashik, with Unacademy and Prayaas.</p>
                    </div>
                    <div>
                        <p className="text-[13px] font-extrabold mb-3">Explore</p>
                        <ul className="space-y-1.5 text-[14px]" style={{ color: 'var(--sub)' }}>
                            {NAV.map(([h, l]) => <li key={h}><a href={`#${h}`} className="hover:text-[var(--blue)]">{l}</a></li>)}
                            <li><Link to="/login" className="hover:text-[var(--blue)]">Staff login</Link></li>
                        </ul>
                    </div>
                    <div>
                        <p className="text-[13px] font-extrabold mb-3">Contact</p>
                        <ul className="space-y-1.5 text-[14px]" style={{ color: 'var(--sub)' }}>
                            <li><a href={`tel:+${PHONE_RAW}`} className="hover:text-[var(--blue)]">{PHONE}</a></li>
                            <li><a href={WA()} target="_blank" rel="noreferrer" className="hover:text-[var(--blue)]">WhatsApp us</a></li>
                            <li>Nashik, Maharashtra</li>
                        </ul>
                    </div>
                </div>
                <div className="a-wrap mt-10 pt-6 flex flex-wrap justify-between gap-3 text-[12.5px]" style={{ color: 'var(--sub)', borderTop: '1px solid var(--line)' }}>
                    <span>© {new Date().getFullYear()} KAP Edutech Pvt. Ltd. All rights reserved.</span>
                    <a href="#top" className="font-bold hover:text-[var(--blue)]">Back to top ↑</a>
                </div>
            </footer>

            <a href={WA()} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"
                className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-[45] w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                style={{ background: '#128C4A', color: '#fff', boxShadow: '0 10px 30px rgba(18,140,74,.35)' }}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.4-.3z" /></svg>
            </a>

            {showLogin && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Log in">
                    <div className="absolute inset-0 shell-fade" style={{ background: 'rgba(20,23,43,.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowLogin(false)} />
                    <div className="relative z-10 w-full max-w-sm"><LoginModal onClose={() => setShowLogin(false)} /></div>
                </div>
            )}
            {demo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Book a free demo">
                    <div className="absolute inset-0 shell-fade" style={{ background: 'rgba(20,23,43,.5)', backdropFilter: 'blur(4px)' }} onClick={() => setDemo(null)} />
                    <div className="relative z-10 w-full max-w-lg flex justify-center"><PublicInquiryForm initial={demo} onClose={() => setDemo(null)} /></div>
                </div>
            )}
        </div>
    );
};

/* A step's number, in its own colour. It fills once the progress line
   reaches it; the line's progress lives in --p on the list. */
const StepNode = ({ i }) => {
    const ref = useRef(null);
    const t = TONES[i % 4];
    useEffect(() => {
        const node = ref.current;
        const list = node?.closest('.a-steps');
        if (!list) return undefined;
        let raf = 0;
        const check = () => {
            raf = 0;
            const p = Number(getComputedStyle(list).getPropertyValue('--p')) || 0;
            const on = p >= i / (STEPS.length - 1) - 0.001;
            node.dataset.on = String(on);
            node.style.background = on ? t.fg : '#fff';
            node.style.color = on ? '#fff' : t.fg;
        };
        const on = () => { if (!raf) raf = requestAnimationFrame(check); };
        check();
        window.addEventListener('scroll', on, { passive: true });
        return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
    }, [i, t]);
    return (
        <span ref={ref} data-on="false" className="a-node relative z-[1] w-[52px] h-[52px] rounded-2xl inline-flex items-center justify-center shrink-0 text-[15px] font-extrabold"
            style={{ background: '#fff', color: t.fg, boxShadow: `0 0 0 1.5px ${t.bg}, 0 10px 20px -14px rgba(20,23,43,.4)` }}>{String(i + 1).padStart(2, '0')}</span>
    );
};

export default PublicHome;
