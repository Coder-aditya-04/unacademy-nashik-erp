// Public home page in a book format (Aditya, 24 Nov 2026): a cover, then
// chapters that stack like the pages of a book as you scroll, then a back cover.
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import PublicInquiryForm from '../components/PublicInquiryForm';
import LoginModal from '../components/LoginModal';
import { useUpcomingBatches } from '../hooks/useUpcomingBatches';

import kapLogo from '../assets/kap_edutech_logo.webp';
import nashikRoadImg from '../assets/nashik_road.webp';
import unacademyNashikRoadImg from '../assets/unacademy_center_nashik.webp';
import collegeRoadImg from '../assets/unacademy_college_road_new.webp';
import kapilImg from '../assets/kapil_sir.webp';
import pranavImg from '../assets/pranav_sir.webp';
import abhishekImg from '../assets/abhishek_sir.webp';
import facultyImg from '../assets/hero_faculty_group_v2.webp';
import boardImg from '../assets/hero_teacher_board.webp';
import resultsImg from '../assets/results/final_result_1.webp';

const PHONE = '+91 92720 90238';
const PHONE_RAW = '919272090238';
const WA = (t) => `https://wa.me/${PHONE_RAW}${t ? `?text=${encodeURIComponent(t)}` : ''}`;

const STATS = [['150+', 'IIT selections'], ['300+', 'GMC selections'], ['85+', 'students above 99%ile'], ['₹2 Cr+', 'scholarships given']];
const CENTRES = [
    { name: 'College Road', type: 'Unacademy Centre', img: collegeRoadImg, tags: 'IIT JEE · NEET · Foundation', pos: 'center 30%' },
    { name: 'Nashik Road', type: 'Unacademy Centre', img: unacademyNashikRoadImg, tags: 'IIT JEE · NEET', pos: 'center' },
    { name: 'Prayaas', type: 'Information centre run by KAP', img: nashikRoadImg, tags: 'Dropper specialist · Library', pos: 'center' },
];
const MENTORS = [
    { img: kapilImg, name: 'Kapil Gautam', subject: 'Physics', quote: 'KAP Edutech is where students learn with love and grow with guidance.' },
    { img: abhishekImg, name: 'Abhishek Rawat', subject: 'Physics', quote: 'Master concepts with visualisation and real-world examples.' },
    { img: pranavImg, name: 'Pranav Tripathi', subject: 'Chemistry', quote: "Chemistry is not just equations, it's the language of the universe." },
];
const CHAPTERS = [['results', 'Results'], ['centres', 'Centres'], ['batches', 'Batches'], ['mentors', 'Mentors']];

const when = (d) => { const t = new Date(d); return Number.isNaN(t.getTime()) ? 'Starting soon' : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };

/* One page of the book. On large screens pages stick and stack; the page
   underneath dims and shrinks a little as the next one slides over it. */
const Page = ({ id, no, title, children, index, tone = 'paper' }) => (
    <section id={id} className="bk-page" style={{ '--i': index, zIndex: 10 + index }} aria-labelledby={`${id}-h`}>
        <div className={`bk-sheet ${tone === 'ink' ? 'bk-ink' : ''}`}>
            <header className="flex items-center justify-between gap-4 bk-small">
                <span>Chapter {String(no).padStart(2, '0')}</span>
                <span className="hidden sm:inline">KAP Edutech · Nashik</span>
            </header>
            <h2 id={`${id}-h`} className="sr-only">{title}</h2>
            <div className="flex-1 min-h-0 flex flex-col justify-center py-6">{children}</div>
            <footer className="text-center bk-small">— {no} —</footer>
        </div>
    </section>
);

const PublicHome = () => {
    const [showInquiryForm, setShowInquiryForm] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [menu, setMenu] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const { batches } = useUpcomingBatches();
    const root = useRef(null);

    // Page-turn depth for the stacked pages (large screens, motion allowed).
    useEffect(() => {
        const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
        let raf = 0;
        const paint = () => {
            raf = 0;
            setScrolled(window.scrollY > 24);
            if (calm || !root.current) return;
            const stack = matchMedia('(min-width: 1024px) and (min-height: 700px)').matches;
            const pages = [...root.current.querySelectorAll('.bk-page')];
            pages.forEach((el, i) => {
                const sheet = el.firstElementChild;
                const next = pages[i + 1];
                if (!stack || !next) { sheet.style.transform = ''; sheet.style.filter = ''; return; }
                const p = Math.min(1, Math.max(0, 1 - next.getBoundingClientRect().top / window.innerHeight));
                sheet.style.transform = `scale(${1 - p * 0.05}) translateY(${-p * 12}px)`;
                sheet.style.filter = `brightness(${1 - p * 0.18})`;
            });
        };
        const on = () => { if (!raf) raf = requestAnimationFrame(paint); };
        paint();
        window.addEventListener('scroll', on, { passive: true });
        window.addEventListener('resize', on);
        return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
    }, []);

    useEffect(() => {
        const open = showInquiryForm || showLoginModal;
        document.documentElement.style.overflow = open ? 'hidden' : '';
        if (!open) return undefined;
        const esc = (e) => { if (e.key === 'Escape') { setShowInquiryForm(false); setShowLoginModal(false); } };
        window.addEventListener('keydown', esc);
        return () => { window.removeEventListener('keydown', esc); document.documentElement.style.overflow = ''; };
    }, [showInquiryForm, showLoginModal]);

    const demo = () => { setMenu(false); setShowInquiryForm(true); };

    return (
        <div ref={root} className="kap bk min-h-screen overflow-x-clip">
            <style>{`
                .bk { --paper:#F5F0E6; --paper2:#EDE5D6; --ink:#14201A; --sub:#4B564F; --rule:#D8CCB6; --green:#0E4A36; --green2:#0B3B2B; --gold:#C49A45; --mint:#08BD80;
                      background: var(--paper2); color: var(--ink); }
                .bk-serif { font-family: Fraunces, Georgia, 'Times New Roman', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
                .bk-small { font-size: 11.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--sub); }
                .bk-ink .bk-small { color: rgba(245,240,230,.7); }
                .bk-btn { align-items:center; justify-content:center; gap:8px; border-radius:999px; padding:14px 24px; font-weight:700; font-size:15px; transition: transform .2s ease, background-color .2s ease, box-shadow .2s ease; white-space:nowrap; }
                .bk-btn:active { transform: scale(.97); }
                .bk-btn-gold { background: var(--gold); color: #1B1307; } .bk-btn-gold:hover { background:#D3AA55; box-shadow: 0 10px 24px rgba(196,154,69,.35); }
                .bk-btn-ink { background: var(--ink); color: var(--paper); } .bk-btn-ink:hover { background:#24342B; }
                .bk-btn-line { box-shadow: inset 0 0 0 1.5px currentColor; }
                .bk-page { position: relative; padding: 0 12px 12px; }
                .bk-sheet { position: relative; display:flex; flex-direction:column; max-width: 1240px; margin: 0 auto; background: var(--paper); border-radius: 6px 22px 22px 6px; padding: 28px 22px 18px;
                            box-shadow: -6px 0 0 -1px #E4DAC6, -10px 0 0 -2px #DCCFB6, 0 30px 60px -30px rgba(20,32,26,.35), 0 1px 0 rgba(20,32,26,.05); transform-origin: 50% 0; will-change: transform; }
                .bk-sheet::before { content:''; position:absolute; inset:0 auto 0 0; width: 26px; border-radius: 6px 0 0 6px; background: linear-gradient(90deg, rgba(20,32,26,.10), rgba(20,32,26,0)); pointer-events:none; }
                .bk-ink { background: var(--green); color: #F5F0E6; }
                @media (min-width: 640px) { .bk-sheet { padding: 34px 48px 22px; } }
                @media (min-width: 1024px) and (min-height: 700px) {
                    .bk-page { position: sticky; top: calc(76px + var(--i) * 8px); height: calc(100vh - 76px - var(--i) * 8px); padding-bottom: 16px; }
                    .bk-sheet { height: 100%; }
                    .bk-page + .bk-page { margin-top: 18vh; }
                }
                .bk-plate { border-radius: 4px; overflow: hidden; box-shadow: 0 0 0 6px #fff, 0 0 0 7px var(--rule), 0 18px 34px -16px rgba(20,32,26,.4); background:#fff; }
                .bk-leader { flex:1; border-bottom: 2px dotted var(--rule); transform: translateY(-5px); min-width: 24px; }
                .bk-cover-edge { background: repeating-linear-gradient(90deg, #F5F0E6 0 2px, #E0D4BE 2px 3px); }
                .bk-rise { animation: bkRise .9s cubic-bezier(.22,1,.36,1) both; }
                @keyframes bkRise { from { opacity:0; transform: translateY(18px) } to { opacity:1; transform:none } }
                @media (prefers-reduced-motion: reduce) { .bk-rise { animation: none; } .bk-sheet { will-change: auto; } }
                html { scroll-behavior: smooth; scroll-padding-top: 80px; }
            `}</style>

            {/* Top bar */}
            <header className="sticky top-0 z-50 transition-[background-color,box-shadow] duration-300"
                style={{ background: scrolled || menu ? 'rgba(237,229,214,.92)' : 'transparent', backdropFilter: scrolled ? 'blur(10px)' : 'none', boxShadow: scrolled ? '0 1px 0 var(--rule)' : 'none' }}>
                <nav className="max-w-[1264px] mx-auto h-[68px] px-4 flex items-center justify-between gap-3" aria-label="Main">
                    <a href="#top" className="shrink-0 rounded-lg bg-white px-2 py-1"><img src={kapLogo} alt="KAP Edutech" className="h-8 w-auto" /></a>
                    <div className="hidden lg:flex items-center gap-7 text-[14px] font-semibold">
                        {CHAPTERS.map(([h, l], i) => <a key={h} href={`#${h}`} className="hover:text-[var(--green)]"><span className="bk-serif italic mr-1" style={{ color: 'var(--gold)' }}>{i + 1}.</span>{l}</a>)}
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setShowLoginModal(true)} className="bk-btn bk-btn-line hidden sm:inline-flex" style={{ padding: '10px 18px', fontSize: 14 }}>Log in</button>
                        <button type="button" onClick={demo} className="bk-btn bk-btn-ink inline-flex" style={{ padding: '10px 18px', fontSize: 14 }}>Book a free demo</button>
                        <button type="button" onClick={() => setMenu(m => !m)} aria-expanded={menu} aria-label="Chapters" className="inline-flex lg:hidden bk-btn bk-btn-line" style={{ padding: '10px 13px', fontSize: 14 }}>{menu ? '✕' : '☰'}</button>
                    </div>
                </nav>
                {menu && (
                    <div className="lg:hidden px-4 pb-4 grid gap-1">
                        {CHAPTERS.map(([h, l], i) => <a key={h} href={`#${h}`} onClick={() => setMenu(false)} className="py-2.5 text-[16px] font-semibold" style={{ borderBottom: '1px solid var(--rule)' }}><span className="bk-serif italic mr-2" style={{ color: 'var(--gold)' }}>{i + 1}.</span>{l}</a>)}
                        <button type="button" onClick={() => { setMenu(false); setShowLoginModal(true); }} className="text-left py-2.5 text-[16px] font-semibold">Log in</button>
                    </div>
                )}
            </header>

            {/* Cover */}
            <section id="top" className="px-3 pb-6 -mt-[68px] pt-[80px]">
                <div className="max-w-[1240px] mx-auto relative">
                    <div className="absolute top-3 bottom-3 -right-2 w-3 rounded-r-md bk-cover-edge hidden sm:block" aria-hidden="true" />
                    <div className="relative grid lg:grid-cols-[1.05fr_1fr] rounded-[6px_22px_22px_6px] overflow-hidden" style={{ background: 'var(--green)', color: '#F5F0E6', boxShadow: '0 40px 80px -40px rgba(11,59,43,.7)' }}>
                        <div className="absolute inset-y-0 left-0 w-8 hidden sm:block" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,.28), rgba(0,0,0,0))' }} aria-hidden="true" />
                        <div className="relative px-6 sm:px-14 py-10 sm:py-16 flex flex-col justify-between gap-10 min-h-[560px] lg:min-h-[calc(100vh-110px)]">
                            <p className="bk-small bk-rise" style={{ color: 'var(--gold)' }}>Unacademy Nashik · Prayaas · Edition 2026–27</p>
                            <div>
                                <h1 className="bk-serif bk-rise text-[46px] sm:text-[68px] lg:text-[80px] leading-[0.98] font-semibold" style={{ animationDelay: '80ms' }}>
                                    Where Nashik's <em className="font-normal" style={{ color: 'var(--gold)' }}>toppers</em> begin their story.
                                </h1>
                                <p className="bk-rise mt-6 text-[17px] leading-relaxed max-w-[460px]" style={{ color: 'rgba(245,240,230,.8)', animationDelay: '160ms' }}>
                                    Classroom coaching for JEE, NEET and Foundation. Class 11, 12 and droppers, at three centres across Nashik.
                                </p>
                                <div className="bk-rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
                                    <button type="button" onClick={demo} className="bk-btn bk-btn-gold inline-flex">Book a free demo class →</button>
                                    <a href="#results" className="bk-btn bk-btn-line inline-flex" style={{ color: '#F5F0E6' }}>Open the book</a>
                                </div>
                            </div>
                            <dl className="bk-rise grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 pt-6" style={{ borderTop: '1px solid rgba(245,240,230,.2)', animationDelay: '320ms' }}>
                                {STATS.map(([v, l]) => (
                                    <div key={l}><dt className="sr-only">{l}</dt><dd className="bk-serif text-[30px] font-semibold leading-none">{v}</dd><dd className="text-[12.5px] mt-1.5" style={{ color: 'rgba(245,240,230,.7)' }}>{l}</dd></div>
                                ))}
                            </dl>
                        </div>
                        <div className="relative min-h-[340px] lg:min-h-0">
                            <img src={facultyImg} alt="The KAP Edutech faculty" className="absolute inset-0 w-full h-full object-cover" fetchPriority="high" />
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(14,74,54,.55) 0%, rgba(14,74,54,0) 35%), linear-gradient(0deg, rgba(11,59,43,.65) 0%, rgba(11,59,43,0) 45%)' }} aria-hidden="true" />
                            <div className="absolute left-6 right-6 bottom-6 flex items-end justify-between gap-4">
                                <p className="bk-serif italic text-[20px] sm:text-[24px] leading-snug max-w-[340px]">“Taught by the directors themselves.”</p>
                                <div className="flex -space-x-3 shrink-0">
                                    {MENTORS.map(m => <img key={m.name} src={m.img} alt="" className="w-12 h-12 rounded-full object-cover" style={{ border: '3px solid var(--green)' }} />)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Chapters */}
            <Page id="results" no={1} title="Results" index={0}>
                <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-12 items-center">
                    <div>
                        <p className="bk-serif text-[40px] sm:text-[56px] leading-[1] font-semibold">Our results <em className="font-normal" style={{ color: 'var(--green)' }}>speak.</em></p>
                        <p className="mt-4 text-[16px] leading-relaxed" style={{ color: 'var(--sub)' }}>Year after year, Unacademy Nashik students clear the toughest exams in the country.</p>
                        <dl className="mt-6 grid grid-cols-2 gap-px rounded-lg overflow-hidden" style={{ background: 'var(--rule)' }}>
                            {STATS.map(([v, l]) => (
                                <div key={l} className="p-4" style={{ background: 'var(--paper)' }}><dt className="sr-only">{l}</dt><dd className="bk-serif text-[30px] font-semibold leading-none" style={{ color: 'var(--green)' }}>{v}</dd><dd className="text-[13px] mt-1" style={{ color: 'var(--sub)' }}>{l}</dd></div>
                            ))}
                        </dl>
                    </div>
                    <figure>
                        <div className="bk-plate"><img src={resultsImg} alt="IIT JEE and NEET 2025 results of Unacademy Nashik" loading="lazy" className="w-full h-auto block" /></div>
                        <figcaption className="bk-serif italic text-[14px] mt-4 text-center" style={{ color: 'var(--sub)' }}>Plate I. Our 2025 JEE and NEET toppers.</figcaption>
                    </figure>
                </div>
            </Page>

            <Page id="centres" no={2} title="Centres" index={1}>
                <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
                    <p className="bk-serif text-[36px] sm:text-[50px] leading-[1] font-semibold">Three centres, <em className="font-normal" style={{ color: 'var(--green)' }}>one family.</em></p>
                    <a href={WA('Hi, I would like to visit a KAP centre.')} target="_blank" rel="noreferrer" className="bk-btn bk-btn-line inline-flex" style={{ padding: '11px 18px', fontSize: 14 }}>Plan a visit on WhatsApp</a>
                </div>
                <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
                    {CENTRES.map((c, i) => (
                        <figure key={c.name}>
                            <div className="bk-plate aspect-[4/3.6] lg:aspect-[4/3.9]" style={{ transform: `rotate(${[-1.2, 0.8, -0.6][i]}deg)` }}>
                                <img src={c.img} alt={`${c.name} centre`} loading="lazy" className="w-full h-full object-cover" style={{ objectPosition: c.pos }} />
                            </div>
                            <figcaption className="mt-5">
                                <span className="bk-serif text-[24px] font-semibold block leading-tight">{c.name}</span>
                                <span className="text-[13.5px] block" style={{ color: 'var(--sub)' }}>{c.type}</span>
                                <span className="text-[12px] font-bold tracking-wide block mt-1.5" style={{ color: 'var(--green)' }}>{c.tags}</span>
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </Page>

            <Page id="batches" no={3} title="Batches" index={2}>
                <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-14 items-start">
                    <div>
                        <p className="bk-serif text-[36px] sm:text-[50px] leading-[1] font-semibold">Contents: <em className="font-normal" style={{ color: 'var(--green)' }}>your next batch.</em></p>
                        <p className="mt-4 text-[16px] leading-relaxed" style={{ color: 'var(--sub)' }}>Pick a batch and save your seat. Our counsellor calls you back the same day.</p>
                        <button type="button" onClick={demo} className="bk-btn bk-btn-ink mt-6 inline-flex">Reserve a seat →</button>
                    </div>
                    <ol className="space-y-1">
                        {(batches.length ? batches : [{ id: 'jee', name: 'JEE (Class 11, 12, droppers)' }, { id: 'neet', name: 'NEET (Class 11, 12, droppers)' }, { id: 'fd', name: 'Foundation (Class 8, 9, 10)' }]).map((b, i) => (
                            <li key={b.id}>
                                <button type="button" onClick={demo} className="w-full text-left py-3.5 group" style={{ borderBottom: '1px solid var(--rule)' }}>
                                    <span className="flex items-baseline gap-3">
                                        <span className="bk-serif italic text-[18px] w-7 shrink-0" style={{ color: 'var(--gold)' }}>{String(i + 1).padStart(2, '0')}</span>
                                        <span className="bk-serif text-[20px] sm:text-[22px] font-semibold group-hover:text-[var(--green)] transition-colors">{b.name}</span>
                                        <span className="bk-leader hidden sm:block" aria-hidden="true" />
                                        <span className="text-[13.5px] font-semibold shrink-0 hidden sm:block" style={{ color: 'var(--sub)' }}>{b.startDate ? `Starts ${when(b.startDate)}` : 'Admissions open'}</span>
                                    </span>
                                    <span className="block pl-10 text-[13px] mt-0.5" style={{ color: 'var(--sub)' }}>
                                        {[b.program && String(b.program).replace(/_/g, ' '), b.centerName, b.timing].filter(Boolean).join(' · ') || 'All centres'}
                                        <span className="sm:hidden">{b.startDate ? ` · Starts ${when(b.startDate)}` : ''}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ol>
                </div>
            </Page>

            <Page id="mentors" no={4} title="Mentors" index={3}>
                <p className="bk-serif text-[36px] sm:text-[50px] leading-[1] font-semibold mb-8">Your <em className="font-normal" style={{ color: 'var(--green)' }}>mentors.</em></p>
                <div className="grid sm:grid-cols-3 gap-8">
                    {MENTORS.map(m => (
                        <figure key={m.name}>
                            <div className="bk-plate aspect-square max-w-[260px]"><img src={m.img} alt={m.name} loading="lazy" className="w-full h-full object-cover object-top" /></div>
                            <blockquote className="bk-serif italic text-[19px] leading-snug mt-6">“{m.quote}”</blockquote>
                            <figcaption className="mt-3 text-[14px]"><b>{m.name}</b> <span style={{ color: 'var(--sub)' }}>· Director, {m.subject}</span></figcaption>
                        </figure>
                    ))}
                </div>
            </Page>

            <Page id="visit" no={5} title="Begin your chapter" index={4} tone="ink">
                <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
                    <div>
                        <p className="bk-serif text-[44px] sm:text-[64px] leading-[0.98] font-semibold">Begin <em className="font-normal" style={{ color: 'var(--gold)' }}>your</em> chapter.</p>
                        <p className="mt-5 text-[17px] leading-relaxed max-w-[480px]" style={{ color: 'rgba(245,240,230,.8)' }}>Come for a free demo class with a parent. Meet the faculty, see the classroom and get a study plan for your exam.</p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <button type="button" onClick={demo} className="bk-btn bk-btn-gold inline-flex">Book a free demo →</button>
                            <a href={`tel:+${PHONE_RAW}`} className="bk-btn bk-btn-line inline-flex" style={{ color: '#F5F0E6' }}>Call {PHONE}</a>
                        </div>
                    </div>
                    <div className="bk-plate hidden lg:block aspect-[4/3]" style={{ transform: 'rotate(1.5deg)', boxShadow: '0 0 0 6px #F5F0E6, 0 24px 40px -18px rgba(0,0,0,.5)' }}>
                        <img src={boardImg} alt="A class at KAP Edutech" loading="lazy" className="w-full h-full object-cover" />
                    </div>
                </div>
            </Page>

            {/* Colophon */}
            <footer className="px-4 pt-14 pb-10" style={{ background: 'var(--paper2)' }}>
                <div className="max-w-[1240px] mx-auto grid sm:grid-cols-[1.6fr_1fr_1fr] gap-8">
                    <div>
                        <span className="inline-block rounded-lg bg-white px-2 py-1"><img src={kapLogo} alt="KAP Edutech" className="h-9 w-auto" /></span>
                        <p className="mt-3 text-[14px] max-w-sm" style={{ color: 'var(--sub)' }}>KAP Edutech Pvt. Ltd. Coaching for JEE, NEET and Foundation in Nashik with Unacademy and Prayaas.</p>
                    </div>
                    <div>
                        <p className="bk-small mb-3">Chapters</p>
                        <ul className="space-y-1.5 text-[14px]">
                            {CHAPTERS.map(([h, l]) => <li key={h}><a href={`#${h}`} className="hover:underline">{l}</a></li>)}
                            <li><Link to="/login" className="hover:underline">Staff login</Link></li>
                        </ul>
                    </div>
                    <div>
                        <p className="bk-small mb-3">Contact</p>
                        <ul className="space-y-1.5 text-[14px]">
                            <li><a href={`tel:+${PHONE_RAW}`} className="hover:underline">{PHONE}</a></li>
                            <li><a href={WA()} target="_blank" rel="noreferrer" className="hover:underline">WhatsApp us</a></li>
                            <li>Nashik, Maharashtra</li>
                        </ul>
                    </div>
                </div>
                <p className="max-w-[1240px] mx-auto mt-10 pt-6 text-[12.5px]" style={{ color: 'var(--sub)', borderTop: '1px solid var(--rule)' }}>© {new Date().getFullYear()} KAP Edutech Pvt. Ltd. All rights reserved.</p>
            </footer>

            <a href={WA()} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"
                className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                style={{ background: '#128C4A', color: '#fff', boxShadow: '0 10px 30px rgba(18,140,74,.35)' }}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.4-.3z" /></svg>
            </a>

            {showLoginModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Log in">
                    <div className="absolute inset-0 shell-fade" style={{ background: 'rgba(11,30,22,.55)', backdropFilter: 'blur(4px)' }} onClick={() => setShowLoginModal(false)} />
                    <div className="relative z-10 w-full max-w-sm"><LoginModal onClose={() => setShowLoginModal(false)} /></div>
                </div>
            )}
            {showInquiryForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Book a free demo">
                    <div className="absolute inset-0 shell-fade" style={{ background: 'rgba(11,30,22,.55)', backdropFilter: 'blur(4px)' }} onClick={() => setShowInquiryForm(false)} />
                    <div className="relative z-10 w-full max-w-lg flex justify-center"><PublicInquiryForm onClose={() => setShowInquiryForm(false)} /></div>
                </div>
            )}
        </div>
    );
};

export default PublicHome;
