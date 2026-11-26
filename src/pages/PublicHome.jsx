// Public home page (Aditya, 24 Nov 2026), in the spirit of haearsk.com:
// a full-bleed hero where the giant word NASHIK sits behind our Nashik Road
// centre building, then programmes, the directors' photo in
// a card next to a green panel, six steps with a progress line, centres,
// results, batches, mentors and a closing call to action.
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '@fontsource/anton/latin-400.css';
import '@fontsource-variable/inter-tight/wght.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PublicInquiryForm from '../components/PublicInquiryForm';
import LoginModal from '../components/LoginModal';
import KapLogo from '../components/KapLogo';
import { useUpcomingBatches } from '../hooks/useUpcomingBatches';
import { CENTERS } from '../utils/centers';

import heroBg from '../assets/gen_hero_campus.webp';
import heroCut from '../assets/gen_hero_campus_cut.webp';
import nashikRdImg from '../assets/unacademy_center_nashik.webp';
import collegeRoadImg from '../assets/unacademy_college_road_new.webp';
import prayaasImg from '../assets/nashik_road.webp';
import facultyImg from '../assets/hero_faculty_group_v2.webp';
import kapilImg from '../assets/kapil_sir.webp';
import pranavImg from '../assets/pranav_sir.webp';
import abhishekImg from '../assets/abhishek_sir.webp';
import resultsImg from '../assets/results/final_result_1.webp';
import sideImg from '../assets/gen_prog_jee.webp';
import examImg from '../assets/gen_prog_neet.webp';
import teachImg from '../assets/gen_prog_found.webp';
import smartImg from '../assets/hero_smart_class.webp';

gsap.registerPlugin(ScrollTrigger);

const PHONE = '+91 92720 90238';
const PHONE_RAW = '919272090238';
const WA = (t) => `https://wa.me/${PHONE_RAW}${t ? `?text=${encodeURIComponent(t)}` : ''}`;

const NAV = [['programmes', 'Programmes'], ['centres', 'Centres'], ['results', 'Results'], ['batches', 'Batches'], ['mentors', 'Mentors']];
const EXAMS = [['JEE', 'IIT JEE'], ['NEET', 'NEET UG'], ['MHT-CET', 'MHT-CET'], ['Foundation', 'Foundation (8 to 10)']];
const CENTRE_OPTS = [['UN_COLLEGE', 'College Road'], ['UN_NASHIK_RD', 'Nashik Road'], ['PRAYAS', 'Prayaas']];

const PROGRAMMES = [
    { k: 'JEE', title: 'IIT JEE', line: 'Main and Advanced, for Class 11, 12 and droppers.', img: sideImg, points: ['Physics, Chemistry and Maths', 'Tests in the JEE Main and Advanced pattern', '1-year and 2-year batches'] },
    { k: 'NEET', title: 'NEET UG', line: 'Medical entrance, for Class 11, 12 and droppers.', img: examImg, points: ['Physics, Chemistry and Biology', 'NCERT covered line by line', 'Tests in the NEET pattern'] },
    { k: 'MHT-CET', title: 'MHT-CET', line: 'State engineering and pharmacy entrance.', img: smartImg, points: ['PCM or PCB groups', 'Linked with the state board syllabus', 'CET mock test series'] },
    { k: 'Foundation', title: 'Foundation', line: 'Class 8, 9 and 10, for boards and Olympiads.', img: teachImg, points: ['Maths, Science and mental ability', 'Olympiad and NTSE practice', 'Support for school exams'] },
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
    { id: 'UN_COLLEGE', name: 'College Road', type: 'Unacademy Centre', img: collegeRoadImg, pos: 'center 30%', tags: 'IIT JEE · NEET · Foundation' },
    { id: 'UN_NASHIK_RD', name: 'Nashik Road', type: 'Unacademy Centre', img: nashikRdImg, pos: 'center', tags: 'IIT JEE · NEET' },
    { id: 'PRAYAS', name: 'Prayaas', type: 'Information centre run by KAP', img: prayaasImg, pos: 'center', tags: 'Dropper batches · Library' },
];
const STATS = [[150, '+', 'IIT selections'], [300, '+', 'GMC selections'], [85, '+', 'students above 99 percentile'], [2, ' Cr+', 'scholarships given', '₹']];
const MENTORS = [
    { img: kapilImg, name: 'Kapil Gautam', subject: 'Physics', quote: 'Students learn with love and grow with guidance.' },
    { img: abhishekImg, name: 'Abhishek Rawat', subject: 'Physics', quote: 'Master concepts with visualisation and real-world examples.' },
    { img: pranavImg, name: 'Pranav Tripathi', subject: 'Chemistry', quote: 'Chemistry is the language of the universe.' },
];
const TOGETHER = [
    ['Directors who teach', 'The founders take classes themselves, every week.'],
    ['Tests that teach', 'Weekly tests with analysis of every mistake.'],
    ['A mentor for each student', 'One person who tracks progress and calls home.'],
    ['Parents in the loop', 'Attendance, homework and fees in the parent app.'],
];

const when = (d) => { const t = new Date(d); return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
const Arrow = () => <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>;

const PublicHome = () => {
    const [demo, setDemo] = useState(null); // null = closed, {} or {center, courseInterest} = open
    const [showLogin, setShowLogin] = useState(false);
    const [menu, setMenu] = useState(false);
    const [solid, setSolid] = useState(false);
    const [exam, setExam] = useState('');
    const [centre, setCentre] = useState('');
    const { batches } = useUpcomingBatches();
    const root = useRef(null);

    const openDemo = (initial = {}) => { setMenu(false); setDemo(initial); };

    // Header turns into a floating pill once the hero is mostly scrolled past.
    useEffect(() => {
        const on = () => setSolid(window.scrollY > window.innerHeight * 0.55);
        on();
        window.addEventListener('scroll', on, { passive: true });
        return () => window.removeEventListener('scroll', on);
    }, []);

    useEffect(() => {
        const open = demo || showLogin || menu;
        document.documentElement.style.overflow = open ? 'hidden' : '';
        if (!open) return undefined;
        const esc = (e) => { if (e.key === 'Escape') { setDemo(null); setShowLogin(false); setMenu(false); } };
        window.addEventListener('keydown', esc);
        return () => { window.removeEventListener('keydown', esc); document.documentElement.style.overflow = ''; };
    }, [demo, showLogin, menu]);

    // Motion. Everything starts from the visible page, so nothing is hidden
    // if scripts fail, and reduced motion gets a still page with the steps
    // line filled.
    useLayoutEffect(() => {
        const el = root.current;
        if (!el) return undefined;
        const mm = gsap.matchMedia();
        const ctx = gsap.context(() => {
            mm.add('(prefers-reduced-motion: no-preference)', () => {
                // Hero: letters rise from behind the building, then the copy.
                const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
                tl.from('.hx-giant .ch', { yPercent: 105, duration: 1.3, stagger: 0.07 })
                    .from('.hx-hero-copy > *', { y: 28, opacity: 0, duration: 1, stagger: 0.08 }, 0.25);
                gsap.to('.hx-giant', { yPercent: -38, ease: 'none', scrollTrigger: { trigger: '.hx-hero', start: 'top top', end: 'bottom top', scrub: true } });
                gsap.to('.hx-scene', { scale: 1.08, yPercent: 5, ease: 'none', scrollTrigger: { trigger: '.hx-hero', start: 'top top', end: 'bottom top', scrub: true } });

                // Card groups rise once.
                gsap.set('[data-rv]', { y: 40, opacity: 0 });
                ScrollTrigger.batch('[data-rv]', {
                    start: 'top 88%', once: true,
                    onEnter: (b) => gsap.to(b, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.09, overwrite: true }),
                });

                // Steps: the line fills as you read down the section.
                ScrollTrigger.create({
                    trigger: '.hx-steps', start: 'top 75%', end: 'bottom 55%', scrub: true,
                    onUpdate: (s) => el.querySelector('.hx-steps')?.style.setProperty('--p', s.progress.toFixed(3)),
                });

                // Numbers count up once.
                el.querySelectorAll('[data-count]').forEach((n) => {
                    const end = Number(n.dataset.count);
                    const o = { v: 0 };
                    gsap.to(o, { v: end, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: n, start: 'top 90%', once: true }, onUpdate: () => { n.textContent = Math.round(o.v); } });
                });
            });

            mm.add('(prefers-reduced-motion: reduce)', () => { el.querySelector('.hx-steps')?.style.setProperty('--p', '1'); });
        }, el);
        return () => { mm.revert(); ctx.revert(); };
    }, []);

    // New batches arrive after the first paint; re-measure scroll positions.
    useEffect(() => { ScrollTrigger.refresh(); }, [batches.length]);

    const headerLight = !solid && !menu;
    return (
        <div ref={root} className="kap hx min-h-screen overflow-x-clip">
            <style>{`
                .hx { --ink:#07130F; --ink2:#0E1F19; --paper:#F5F3EE; --line:#E3DFD6; --sub:#5B6761; --mint:#08BD80; --mintd:#06A06C; --cream:#F7F1E3;
                      font-family: 'Inter Tight Variable', 'Inter Tight', 'Plus Jakarta Sans', system-ui, sans-serif; background: var(--paper); color: var(--ink); }
                .hx h1, .hx h2, .hx h3 { letter-spacing: -0.035em; }
                .hx-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
                .hx-btn { align-items:center; justify-content:center; gap:8px; border-radius:999px; padding:14px 22px; font-weight:700; font-size:15px; white-space:nowrap;
                          transition: transform .2s ease, background-color .2s ease, color .2s ease, box-shadow .2s ease; }
                .hx-btn:active { transform: scale(.97); }
                .hx-btn-mint { background: var(--mint); color: #04140D; } .hx-btn-mint:hover { background: #22CF95; box-shadow: 0 12px 28px -8px rgba(8,189,128,.55); }
                .hx-btn-ink { background: var(--ink); color: #fff; } .hx-btn-ink:hover { background: #1A2E26; }
                .hx-btn-line { box-shadow: inset 0 0 0 1.5px currentColor; } .hx-btn-line:hover { background: rgba(127,127,127,.12); }
                .hx-btn svg { transition: transform .2s ease; } .hx-btn:hover svg { transform: translateX(3px); }

                /* Hero scene: one box with the photo's own shape, so the cut-out,
                   the photo and the word always line up. The roof is 24.6% down. */
                .hx-hero { --sw: max(100vw, 177.9svh); --sh: calc(var(--sw) * .5622); --roof: calc(var(--sh) * .315);
                           --fs: clamp(92px, min(26vw, calc(var(--sw) * .15)), 280px); }
                .hx-scene { position:absolute; top:0; left:50%; width: var(--sw); height: var(--sh); margin-left: calc(var(--sw) / -2); transform-origin: 50% 30%; will-change: transform; }
                .hx-scene img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter: brightness(.82) saturate(1.05); }
                .hx-scene img:first-child { filter: brightness(.6) saturate(1.1); }
                .hx-giant { position:absolute; left:0; right:0; top: calc(var(--roof) - var(--fs) * .78); text-align:center; font-family: Anton, 'Inter Tight', sans-serif; font-size: var(--fs);
                            line-height: .9; letter-spacing: .01em; color: #fff; white-space: nowrap; overflow: hidden; padding-top: .04em; }
                .hx-giant .ch { display:inline-block; }
                .hx-shade { position:absolute; inset:0; background: linear-gradient(180deg, rgba(7,19,15,.45) 0%, rgba(7,19,15,0) 22%, rgba(7,19,15,.18) 42%, rgba(7,19,15,.8) 66%, rgba(7,19,15,.96) 100%); }
                .hx .hx-select { appearance:none; width:100%; background-color: transparent !important; color:#fff !important; border: 0 !important; box-shadow: none !important; font-weight:600; font-size:15px; padding: 2px 22px 2px 0; outline: none; cursor: pointer;
                             background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23fff' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
                             background-repeat:no-repeat; background-position: right center; }
                .hx .hx-select option { color: #07130F; }
                .hx-finder:focus-within { box-shadow: 0 0 0 2px var(--mint); }

                .hx-card { background:#fff; border-radius: 24px; box-shadow: 0 0 0 1px var(--line); transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s ease; }
                .hx-card:hover { transform: translateY(-4px); box-shadow: 0 0 0 1px var(--line), 0 24px 48px -24px rgba(7,19,15,.28); }
                .hx-zoom img { transition: transform .8s cubic-bezier(.22,1,.36,1); } .hx-zoom:hover img { transform: scale(1.06); }


                .hx-steps { --p: 0; }
                .hx-track { position:absolute; background: var(--line); border-radius: 4px; }
                .hx-fill { position:absolute; inset:0; background: var(--mint); border-radius: 4px; transform-origin: 0 0; }
                .hx-node { transition: background-color .3s ease, color .3s ease, box-shadow .3s ease; }
                .hx-node[data-on="true"] { background: var(--mint) !important; color: #04140D; box-shadow: 0 0 0 6px rgba(8,189,128,.18) !important; }
                @media (min-width: 1024px) { .hx-track { left: 24px; right: calc((100% - 80px) / 6 - 24px); top: 23px; height: 3px; } .hx-fill { transform: scaleX(var(--p)); } }
                @media (max-width: 1023.98px) { .hx-track { left: 23px; top: 24px; bottom: 24px; width: 3px; } .hx-fill { transform: scaleY(var(--p)); } }

                .hx-rise { animation: hxRise .6s cubic-bezier(.22,1,.36,1) both; }
                @keyframes hxRise { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform:none } }
                @media (prefers-reduced-motion: reduce) { .hx-scene { will-change:auto; } .hx-rise { animation:none; } .hx-card, .hx-zoom img { transition:none; } }
                html { scroll-behavior: smooth; scroll-padding-top: 88px; }
                @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
            `}</style>

            {/* Header: clear over the hero, a floating pill after it. */}
            <header className="fixed top-0 inset-x-0 z-50 px-3 pt-3">
                <nav aria-label="Main" className="mx-auto flex items-center justify-between gap-3 transition-[max-width,background-color,box-shadow,padding] duration-500"
                    style={{
                        maxWidth: solid ? 1120 : 1280, borderRadius: 999, padding: solid ? '8px 8px 8px 18px' : '6px 6px 6px 10px',
                        background: solid ? 'rgba(255,255,255,.88)' : 'transparent', backdropFilter: solid ? 'blur(14px)' : 'none',
                        boxShadow: solid ? '0 0 0 1px rgba(7,19,15,.06), 0 18px 40px -20px rgba(7,19,15,.35)' : 'none',
                    }}>
                    <a href="#top" className="shrink-0 inline-flex" aria-label="KAP Edutech home"><KapLogo tone={headerLight ? 'light' : 'dark'} className="h-9 w-auto" /></a>
                    <div className="hidden lg:flex items-center gap-1 text-[14.5px] font-semibold" style={{ color: headerLight ? '#fff' : 'var(--ink)' }}>
                        {NAV.map(([h, l]) => <a key={h} href={`#${h}`} className="px-3.5 py-2 rounded-full transition-colors hover:bg-[rgba(127,127,127,.16)]">{l}</a>)}
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setShowLogin(true)} className="hx-btn hx-btn-line hidden sm:inline-flex" style={{ padding: '10px 18px', fontSize: 14, color: headerLight ? '#fff' : 'var(--ink)' }}>Log in</button>
                        <button type="button" onClick={() => openDemo()} className="hx-btn hx-btn-mint inline-flex" style={{ padding: '10px 18px', fontSize: 14 }}>Free demo</button>
                        <button type="button" onClick={() => setMenu(m => !m)} aria-expanded={menu} aria-controls="hx-menu" aria-label={menu ? 'Close menu' : 'Open menu'}
                            className="hx-btn hx-btn-line inline-flex lg:hidden" style={{ padding: '10px 13px', fontSize: 14, color: headerLight ? '#fff' : 'var(--ink)' }}>{menu ? '✕' : '☰'}</button>
                    </div>
                </nav>
            </header>
            {menu && (
                <div id="hx-menu" className="lg:hidden fixed inset-0 z-40 pt-24 px-6 pb-8 flex flex-col hx-rise" style={{ background: 'var(--paper)' }}>
                    {NAV.map(([h, l], i) => (
                        <a key={h} href={`#${h}`} onClick={() => setMenu(false)} className="py-3.5 text-[28px] font-bold flex items-baseline gap-3" style={{ borderBottom: '1px solid var(--line)', letterSpacing: '-0.03em' }}>
                            <span className="text-[13px] font-semibold" style={{ color: 'var(--mintd)' }}>{String(i + 1).padStart(2, '0')}</span>{l}
                        </a>
                    ))}
                    <div className="mt-auto grid gap-2">
                        <button type="button" onClick={() => { setMenu(false); setShowLogin(true); }} className="hx-btn hx-btn-line inline-flex w-full">Log in</button>
                        <button type="button" onClick={() => openDemo()} className="hx-btn hx-btn-mint inline-flex w-full">Book a free demo class</button>
                    </div>
                </div>
            )}

            {/* Hero */}
            <section id="top" className="hx-hero relative h-[100svh] min-h-[640px] overflow-hidden" style={{ background: 'var(--ink)' }} aria-label="Welcome">
                <div className="hx-scene" aria-hidden="true">
                    <img src={heroBg} alt="" fetchPriority="high" />
                    <div className="hx-giant">{'NASHIK'.split('').map((c, i) => <span key={i} className="ch">{c}</span>)}</div>
                    <img src={heroCut} alt="" />
                </div>
                <div className="hx-shade" aria-hidden="true" />
                <div className="relative h-full max-w-[1240px] mx-auto px-5 sm:px-8 flex flex-col justify-end pb-8 sm:pb-12">
                    <div className="hx-hero-copy text-white">
                        <p className="hx-eyebrow" style={{ color: 'var(--mint)' }}>Unacademy Centres · Prayaas · Nashik</p>
                        <h1 className="mt-4 text-[40px] sm:text-[60px] lg:text-[76px] leading-[0.98] font-bold max-w-[920px]">Where Nashik's toppers are made.</h1>
                        <p className="mt-4 text-[16px] sm:text-[18px] max-w-[560px]" style={{ color: 'rgba(255,255,255,.78)' }}>Classroom coaching for JEE, NEET, MHT-CET and Foundation. Taught by the directors, tested every week, mentored to exam day.</p>
                        <form onSubmit={(e) => { e.preventDefault(); openDemo({ courseInterest: exam, center: centre }); }}
                            className="hx-finder mt-7 grid sm:grid-cols-[1fr_1fr_auto] gap-2 sm:gap-0 rounded-[22px] sm:rounded-full p-2 max-w-[760px]"
                            style={{ background: 'rgba(255,255,255,.1)', backdropFilter: 'blur(14px)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.18)' }}>
                            <label className="block px-4 py-2 sm:border-r" style={{ borderColor: 'rgba(255,255,255,.18)' }}>
                                <span className="block text-[11.5px] font-semibold" style={{ color: 'rgba(255,255,255,.65)' }}>Exam</span>
                                <select className="hx-select" value={exam} onChange={(e) => setExam(e.target.value)}>
                                    <option value="">Any exam</option>
                                    {EXAMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                            </label>
                            <label className="block px-4 py-2">
                                <span className="block text-[11.5px] font-semibold" style={{ color: 'rgba(255,255,255,.65)' }}>Centre</span>
                                <select className="hx-select" value={centre} onChange={(e) => setCentre(e.target.value)}>
                                    <option value="">Any centre</option>
                                    {CENTRE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                            </label>
                            <button type="submit" className="hx-btn hx-btn-mint inline-flex">Book a free demo <Arrow /></button>
                        </form>
                        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-semibold" style={{ color: 'rgba(255,255,255,.8)' }}>
                            {PROGRAMMES.map(p => <a key={p.k} href="#programmes" className="inline-flex items-center gap-1.5 hover:text-white">{p.title} <Arrow /></a>)}
                        </div>
                    </div>
                </div>
            </section>

            {/* Programmes */}
            <section id="programmes" className="px-5 sm:px-8 py-20 sm:py-28">
                <div className="max-w-[1240px] mx-auto">
                    <div className="grid lg:grid-cols-[1fr_1fr] gap-6 items-end">
                        <div>
                            <p className="hx-eyebrow" style={{ color: 'var(--mintd)' }}>Programmes</p>
                            <h2 className="mt-3 text-[36px] sm:text-[54px] leading-[1] font-bold">One goal. The right programme for it.</h2>
                        </div>
                        <p className="text-[17px] lg:pb-2 max-w-[520px]" style={{ color: 'var(--sub)' }}>Every programme has the same three things: classes in person, a weekly test, and a mentor who knows your child by name.</p>
                    </div>
                    <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {PROGRAMMES.map((p, i) => (
                            <button key={p.k} type="button" data-rv onClick={() => openDemo({ courseInterest: p.k })} className="hx-card hx-zoom text-left overflow-hidden group">
                                <div className="aspect-[4/3] overflow-hidden"><img src={p.img} alt="" loading="lazy" className="w-full h-full object-cover" /></div>
                                <div className="p-5">
                                    <span className="text-[13px] font-semibold" style={{ color: 'var(--mintd)' }}>{String(i + 1).padStart(2, '0')}</span>
                                    <span className="block text-[22px] font-bold mt-1" style={{ letterSpacing: '-0.03em' }}>{p.title}</span>
                                    <span className="block text-[14.5px] mt-1" style={{ color: 'var(--sub)' }}>{p.line}</span>
                                    <ul className="mt-3 space-y-1.5 text-[13.5px]">
                                        {p.points.map(t => <li key={t} className="flex gap-2"><span aria-hidden="true" style={{ color: 'var(--mintd)' }}>✓</span>{t}</li>)}
                                    </ul>
                                    <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-bold" style={{ color: 'var(--ink)' }}>Book a demo <Arrow /></span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Works together: the directors' photo kept at its own size (sharp), in a card like the mentor cards. */}
            <section className="px-5 sm:px-8 pb-20 sm:pb-28" aria-labelledby="hx-together">
                <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-4 items-stretch">
                    <figure data-rv className="hx-card overflow-hidden flex flex-col">
                        <div className="aspect-[3/2] overflow-hidden"><img src={facultyImg} alt="The KAP Edutech directors at the Unacademy centre" loading="lazy" className="w-full h-full object-cover" style={{ objectPosition: 'center 40%' }} /></div>
                        <figcaption className="p-5 flex items-center justify-between gap-4">
                            <span><b className="block text-[17px]" style={{ letterSpacing: '-0.02em' }}>The directors teach your classes.</b><span className="block text-[14px] mt-0.5" style={{ color: 'var(--sub)' }}>In the classroom, every week. Not just on posters.</span></span>
                            <a href="#mentors" className="w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0 hover:bg-[var(--mint)] transition-colors" style={{ boxShadow: 'inset 0 0 0 1.5px var(--line)' }} aria-label="Meet the mentors"><Arrow /></a>
                        </figcaption>
                    </figure>
                    <div data-rv className="rounded-[24px] p-7 sm:p-10 flex flex-col justify-between gap-8 text-white" style={{ background: 'radial-gradient(120% 140% at 100% 0%, #0C7A55 0%, #07130F 60%)' }}>
                        <h2 id="hx-together" className="text-[32px] sm:text-[44px] leading-[1.02] font-bold">Coaching works better when every part works together.</h2>
                        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
                            {TOGETHER.map(([t, d]) => (
                                <li key={t} className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,.22)' }}>
                                    <b className="block text-[16px]" style={{ letterSpacing: '-0.02em' }}>{t}</b>
                                    <span className="block text-[14px] mt-1" style={{ color: 'rgba(255,255,255,.7)' }}>{d}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* Six steps */}
            <section className="px-5 sm:px-8 py-20 sm:py-28" aria-labelledby="hx-steps-h">
                <div className="max-w-[1240px] mx-auto">
                    <p className="hx-eyebrow" style={{ color: 'var(--mintd)' }}>How it works</p>
                    <h2 id="hx-steps-h" className="mt-3 text-[36px] sm:text-[54px] leading-[1] font-bold max-w-[760px]">From first visit to final rank, in six steps.</h2>
                    <ol className="hx-steps relative mt-14 grid lg:grid-cols-6 gap-8 lg:gap-4">
                        <span className="hx-track" aria-hidden="true"><span className="hx-fill" /></span>
                        {STEPS.map(([t, d], i) => (
                            <li key={t} className="relative flex lg:block gap-5">
                                <StepNode i={i} />
                                <div className="lg:mt-6 lg:pr-2">
                                    <b className="block text-[20px]" style={{ letterSpacing: '-0.03em' }}>{t}</b>
                                    <span className="block text-[14.5px] mt-1" style={{ color: 'var(--sub)' }}>{d}</span>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* What every student gets */}
            <section className="px-5 sm:px-8 pb-20 sm:pb-28" aria-labelledby="hx-inc">
                <div className="max-w-[1240px] mx-auto">
                    <p className="hx-eyebrow" style={{ color: 'var(--mintd)' }}>Included in every course</p>
                    <h2 id="hx-inc" className="mt-3 text-[32px] sm:text-[44px] leading-[1.02] font-bold max-w-[760px]">Everything a student needs, under one roof.</h2>
                    <ul className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {INCLUDED.map(([e, t, d]) => (
                            <li key={t} data-rv className="hx-card p-5 flex gap-4 items-start">
                                <span className="w-12 h-12 rounded-2xl inline-flex items-center justify-center text-[22px] shrink-0" style={{ background: 'var(--cream)' }} aria-hidden="true">{e}</span>
                                <span><b className="block text-[17px]" style={{ letterSpacing: '-0.02em' }}>{t}</b><span className="block text-[14px] mt-1" style={{ color: 'var(--sub)' }}>{d}</span></span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* Centres */}
            <section id="centres" className="px-5 sm:px-8 py-20 sm:py-28" style={{ background: '#fff' }}>
                <div className="max-w-[1240px] mx-auto">
                    <div className="flex flex-wrap items-end justify-between gap-5">
                        <div>
                            <p className="hx-eyebrow" style={{ color: 'var(--mintd)' }}>Centres</p>
                            <h2 className="mt-3 text-[36px] sm:text-[54px] leading-[1] font-bold">Three centres across Nashik.</h2>
                        </div>
                        <a href={WA('Hi, I would like to visit a KAP centre.')} target="_blank" rel="noreferrer" className="hx-btn hx-btn-line inline-flex">Plan a visit on WhatsApp <Arrow /></a>
                    </div>
                    <div className="mt-12 grid sm:grid-cols-3 gap-4">
                        {CENTRES.map(c => (
                            <button key={c.id} type="button" data-rv onClick={() => openDemo({ center: c.id })} className="hx-zoom relative overflow-hidden rounded-[24px] aspect-[4/5] text-left group">
                                <img src={c.img} alt={`${c.name} centre`} loading="lazy" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: c.pos }} />
                                <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(7,19,15,0) 45%, rgba(7,19,15,.88) 100%)' }} aria-hidden="true" />
                                <span className="absolute left-5 right-5 bottom-5 text-white">
                                    <span className="block text-[12.5px] font-semibold" style={{ color: 'var(--mint)' }}>{c.type}</span>
                                    <span className="block text-[28px] font-bold leading-tight" style={{ letterSpacing: '-0.03em' }}>{c.name}</span>
                                    <span className="block text-[12.5px] mt-1 leading-snug" style={{ color: 'rgba(255,255,255,.7)' }}>{CENTERS[c.id]?.address}</span>
                                    <span className="flex items-center justify-between gap-3 mt-1 text-[13.5px]" style={{ color: 'rgba(255,255,255,.78)' }}>{c.tags}<span className="w-9 h-9 rounded-full inline-flex items-center justify-center shrink-0 transition-colors group-hover:bg-[var(--mint)] group-hover:text-[#04140D]" style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.6)' }}><Arrow /></span></span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Results */}
            <section id="results" className="px-5 sm:px-8 py-20 sm:py-28 text-white" style={{ background: 'var(--ink)' }}>
                <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center">
                    <div>
                        <p className="hx-eyebrow" style={{ color: 'var(--mint)' }}>Results</p>
                        <h2 className="mt-3 text-[36px] sm:text-[54px] leading-[1] font-bold">Results that speak for our students.</h2>
                        <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8">
                            {STATS.map(([n, suf, l, pre]) => (
                                <div key={l} className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,.18)' }}>
                                    <dt className="sr-only">{l}</dt>
                                    <dd className="text-[44px] sm:text-[54px] font-bold leading-none" style={{ letterSpacing: '-0.04em' }}>{pre}<span data-count={n}>{n}</span>{suf}</dd>
                                    <dd className="text-[14px] mt-2" style={{ color: 'rgba(255,255,255,.68)' }}>{l}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                    <figure data-rv className="rounded-[24px] overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(255,255,255,.12)' }}>
                        <img src={resultsImg} alt="IIT JEE and NEET 2025 results of Unacademy Nashik" loading="lazy" className="w-full h-auto block" />
                    </figure>
                </div>
            </section>

            {/* Batches */}
            <section id="batches" className="px-5 sm:px-8 py-20 sm:py-28">
                <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16 items-start">
                    <div className="lg:sticky lg:top-28">
                        <p className="hx-eyebrow" style={{ color: 'var(--mintd)' }}>Batches</p>
                        <h2 className="mt-3 text-[36px] sm:text-[54px] leading-[1] font-bold">Your next batch starts soon.</h2>
                        <p className="mt-4 text-[17px]" style={{ color: 'var(--sub)' }}>Pick a batch and save your seat. Our counsellor calls you back the same day.</p>
                        <button type="button" onClick={() => openDemo()} className="hx-btn hx-btn-ink inline-flex mt-7">Reserve a seat <Arrow /></button>
                    </div>
                    <ul className="grid gap-3">
                        {(batches.length ? batches : [{ id: 'jee', name: 'IIT JEE · Class 11, 12 and droppers' }, { id: 'neet', name: 'NEET UG · Class 11, 12 and droppers' }, { id: 'fd', name: 'Foundation · Class 8, 9 and 10' }]).map(b => {
                            const start = b.startDate && when(b.startDate) ? new Date(b.startDate) : null;
                            return (
                                <li key={b.id}>
                                    <button type="button" data-rv onClick={() => openDemo()} className="hx-card w-full text-left p-5 sm:p-6 flex items-center gap-5 group">
                                        <span className="w-14 h-14 rounded-2xl shrink-0 inline-flex flex-col items-center justify-center text-center leading-none" style={{ background: 'var(--cream)' }}>
                                            {start ? <><b className="text-[20px]">{start.getDate()}</b><span className="text-[11px] font-semibold mt-1 uppercase">{start.toLocaleDateString('en-IN', { month: 'short' })}</span></> : <b className="text-[20px]" aria-hidden="true">✦</b>}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[18px] sm:text-[20px] font-bold" style={{ letterSpacing: '-0.025em' }}>{b.name}</span>
                                            <span className="block text-[14px] mt-0.5" style={{ color: 'var(--sub)' }}>
                                                {[b.program && String(b.program).replace(/_/g, ' '), b.centerName, b.timing].filter(Boolean).join(' · ') || 'All centres'}
                                                {start ? ` · Starts ${when(b.startDate)}` : ' · Admissions open'}
                                            </span>
                                        </span>
                                        <span className="w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0 transition-colors group-hover:bg-[var(--mint)]" style={{ boxShadow: 'inset 0 0 0 1.5px var(--line)' }}><Arrow /></span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </section>

            {/* Mentors */}
            <section id="mentors" className="px-5 sm:px-8 py-20 sm:py-28" style={{ background: '#fff' }}>
                <div className="max-w-[1240px] mx-auto">
                    <p className="hx-eyebrow" style={{ color: 'var(--mintd)' }}>Mentors</p>
                    <h2 className="mt-3 text-[36px] sm:text-[54px] leading-[1] font-bold">Taught by the directors themselves.</h2>
                    <div className="mt-12 grid sm:grid-cols-3 gap-4">
                        {MENTORS.map(m => (
                            <figure key={m.name} data-rv className="hx-card overflow-hidden">
                                <div className="aspect-[4/3.4] overflow-hidden" style={{ background: 'var(--cream)' }}><img src={m.img} alt={m.name} loading="lazy" className="w-full h-full object-cover object-top" /></div>
                                <div className="p-5">
                                    <blockquote className="text-[17px] font-semibold leading-snug" style={{ letterSpacing: '-0.02em' }}>“{m.quote}”</blockquote>
                                    <figcaption className="mt-3 text-[14px]"><b>{m.name}</b> <span style={{ color: 'var(--sub)' }}>· Director, {m.subject}</span></figcaption>
                                </div>
                            </figure>
                        ))}
                    </div>
                </div>
            </section>

            {/* Questions parents ask */}
            <section className="px-5 sm:px-8 pb-20 sm:pb-28" style={{ background: '#fff' }} aria-labelledby="hx-faq">
                <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[0.8fr_1.2fr] gap-10">
                    <div>
                        <p className="hx-eyebrow" style={{ color: 'var(--mintd)' }}>Questions</p>
                        <h2 id="hx-faq" className="mt-3 text-[32px] sm:text-[44px] leading-[1.02] font-bold">What parents ask us first.</h2>
                        <p className="mt-4 text-[16px]" style={{ color: 'var(--sub)' }}>Something else? Call <a href={`tel:+${PHONE_RAW}`} className="font-semibold underline">{PHONE}</a> or message us on WhatsApp.</p>
                    </div>
                    <div className="grid gap-3">
                        {FAQ.map(([q, a]) => (
                            <details key={q} className="hx-card group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-[17px] font-bold" style={{ letterSpacing: '-0.02em' }}>
                                    {q}
                                    <span className="w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0 transition-transform group-open:rotate-45" style={{ boxShadow: 'inset 0 0 0 1.5px var(--line)' }} aria-hidden="true">+</span>
                                </summary>
                                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: 'var(--sub)' }}>{a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Call to action */}
            <section className="px-3 sm:px-4 pb-3 sm:pb-4" style={{ background: '#fff' }}>
                <div className="relative overflow-hidden rounded-[28px] px-6 sm:px-14 py-16 sm:py-24 text-white" style={{ background: 'radial-gradient(120% 140% at 100% 0%, #0C7A55 0%, #07130F 55%)' }}>
                    <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.3fr_1fr] gap-8 items-end">
                        <h2 className="text-[40px] sm:text-[64px] leading-[0.98] font-bold">Let's plan your rank, together.</h2>
                        <div>
                            <p className="text-[17px]" style={{ color: 'rgba(255,255,255,.78)' }}>Come for a free demo class with a parent. Meet the faculty, see the classroom and leave with a study plan.</p>
                            <div className="mt-7 flex flex-wrap gap-3">
                                <button type="button" onClick={() => openDemo()} className="hx-btn hx-btn-mint inline-flex">Book a free demo <Arrow /></button>
                                <a href={`tel:+${PHONE_RAW}`} className="hx-btn hx-btn-line inline-flex">Call {PHONE}</a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="px-5 sm:px-8 pt-14 pb-10" style={{ background: '#fff' }}>
                <div className="max-w-[1240px] mx-auto grid sm:grid-cols-[1.6fr_1fr_1fr] gap-8">
                    <div>
                        <KapLogo tone="dark" className="h-10 w-auto" />
                        <p className="mt-3 text-[14px] max-w-sm" style={{ color: 'var(--sub)' }}>KAP Edutech Pvt. Ltd. Coaching for JEE, NEET, MHT-CET and Foundation in Nashik, with Unacademy and Prayaas.</p>
                    </div>
                    <div>
                        <p className="hx-eyebrow mb-3" style={{ color: 'var(--sub)' }}>Explore</p>
                        <ul className="space-y-1.5 text-[14px]">
                            {NAV.map(([h, l]) => <li key={h}><a href={`#${h}`} className="hover:underline">{l}</a></li>)}
                            <li><Link to="/login" className="hover:underline">Staff login</Link></li>
                        </ul>
                    </div>
                    <div>
                        <p className="hx-eyebrow mb-3" style={{ color: 'var(--sub)' }}>Contact</p>
                        <ul className="space-y-1.5 text-[14px]">
                            <li><a href={`tel:+${PHONE_RAW}`} className="hover:underline">{PHONE}</a></li>
                            <li><a href={WA()} target="_blank" rel="noreferrer" className="hover:underline">WhatsApp us</a></li>
                            <li>Nashik, Maharashtra</li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-[1240px] mx-auto mt-10 pt-6 flex flex-wrap justify-between gap-3 text-[12.5px]" style={{ color: 'var(--sub)', borderTop: '1px solid var(--line)' }}>
                    <span>© {new Date().getFullYear()} KAP Edutech Pvt. Ltd. All rights reserved.</span>
                    <a href="#top" className="font-semibold hover:underline">Back to top ↑</a>
                </div>
            </footer>

            <a href={WA()} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"
                className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-[45] w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                style={{ background: '#128C4A', color: '#fff', boxShadow: '0 10px 30px rgba(18,140,74,.35)' }}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.4-.3z" /></svg>
            </a>

            {showLogin && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Log in">
                    <div className="absolute inset-0 shell-fade" style={{ background: 'rgba(7,19,15,.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowLogin(false)} />
                    <div className="relative z-10 w-full max-w-sm"><LoginModal onClose={() => setShowLogin(false)} /></div>
                </div>
            )}
            {demo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Book a free demo">
                    <div className="absolute inset-0 shell-fade" style={{ background: 'rgba(7,19,15,.6)', backdropFilter: 'blur(4px)' }} onClick={() => setDemo(null)} />
                    <div className="relative z-10 w-full max-w-lg flex justify-center"><PublicInquiryForm initial={demo} onClose={() => setDemo(null)} /></div>
                </div>
            )}
        </div>
    );
};

/* A step's number. It lights up once the progress line reaches it; the
   line's progress lives in the --p variable on the list. */
const StepNode = ({ i }) => {
    const ref = useRef(null);
    useEffect(() => {
        const node = ref.current;
        const list = node?.closest('.hx-steps');
        if (!list) return undefined;
        let raf = 0;
        const check = () => {
            raf = 0;
            const p = Number(getComputedStyle(list).getPropertyValue('--p')) || 0;
            node.dataset.on = String(p >= i / (STEPS.length - 1) - 0.001);
        };
        const on = () => { if (!raf) raf = requestAnimationFrame(check); };
        check();
        window.addEventListener('scroll', on, { passive: true });
        return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
    }, [i]);
    return (
        <span ref={ref} data-on="false" className="hx-node relative z-[1] w-12 h-12 rounded-full inline-flex items-center justify-center shrink-0 text-[15px] font-bold"
            style={{ background: '#fff', boxShadow: '0 0 0 1px var(--line)' }}>{String(i + 1).padStart(2, '0')}</span>
    );
};

export default PublicHome;
