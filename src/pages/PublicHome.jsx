import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import PublicInquiryForm from '../components/PublicInquiryForm';
import LoginModal from '../components/LoginModal';
import UpcomingBatchesPublic from '../components/UpcomingBatchesPublic';
import ResultsShowcase from '../components/ResultsShowcase';

import kapLogo from '../assets/kap_edutech_logo.webp';
import nashikRoadImg from '../assets/nashik_road.webp';
import unacademyNashikRoadImg from '../assets/unacademy_center_nashik.webp';
import collegeRoadImg from '../assets/unacademy_college_road_new.webp';
import kapilImg from '../assets/kapil_sir.webp';
import pranavImg from '../assets/pranav_sir.webp';
import abhishekImg from '../assets/abhishek_sir.webp';
import heroFacultyGroupV2 from '../assets/hero_faculty_group_v2.webp';
import heroClassroomSide from '../assets/hero_classroom_side.webp';
import heroTeacherBoard from '../assets/hero_teacher_board.webp';
import heroSmartClass from '../assets/hero_smart_class.webp';
import heroExamHall from '../assets/hero_exam_hall.webp';
import heroTeachersDay from '../assets/hero_teachers_day.webp';

const PHONE = '+91 92720 90238';
const PHONE_RAW = '919272090238';

const HERO = [
    { img: heroFacultyGroupV2, cap: 'Our faculty team' },
    { img: heroTeacherBoard, cap: 'Concept-first teaching' },
    { img: heroClassroomSide, cap: 'Focused classrooms' },
    { img: heroSmartClass, cap: 'Smart classes' },
    { img: heroExamHall, cap: 'Weekly tests in exam conditions' },
    { img: heroTeachersDay, cap: 'Life at the centre' },
];

const WHY = [
    { tone: 'sage', emoji: '🎥', title: 'Daily live classes', sub: 'Interactive, in person and online' },
    { tone: 'butter', emoji: '📝', title: 'Tests, papers & notes', sub: 'Weekly tests in real exam conditions' },
    { tone: 'blue', emoji: '💬', title: 'Doubts solved 24×7', sub: 'Ask anytime, get unstuck fast' },
    { tone: 'coral', emoji: '👥', title: 'Small batches', sub: 'Every student gets noticed' },
];

const CENTRES = [
    { name: 'College Road', type: 'Unacademy Centre', img: collegeRoadImg, tags: ['IIT JEE', 'NEET', 'Foundation'], tone: 'sage' },
    { name: 'Nashik Road', type: 'Unacademy Centre', img: unacademyNashikRoadImg, tags: ['IIT JEE', 'NEET'], tone: 'blue' },
    { name: 'Prayaas', type: 'Information centre run by KAP', img: nashikRoadImg, tags: ['Dropper specialist', 'Library'], tone: 'butter' },
];

const MENTORS = [
    { img: kapilImg, name: 'Kapil Gautam', subject: 'Physics', tone: 'sage', quote: 'KAP Edutech is where students learn with love and grow with guidance.' },
    { img: abhishekImg, name: 'Abhishek Rawat', subject: 'Physics', tone: 'blue', quote: 'Master concepts with visualisation and real-world examples.' },
    { img: pranavImg, name: 'Pranav Tripathi', subject: 'Chemistry', tone: 'lilac', quote: "Chemistry is not just equations, it's the language of the universe." },
];

/* Rises into view once, the first time it scrolls on screen. Content stays
   visible if IntersectionObserver is missing. */
const Reveal = ({ children, delay = 0, className = '', style, as: Tag = 'div' }) => {
    const ref = useRef(null);
    const [seen, setSeen] = useState(typeof IntersectionObserver === 'undefined');
    useEffect(() => {
        if (seen || !ref.current) return undefined;
        const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: '0px 0px -10% 0px' });
        io.observe(ref.current);
        return () => io.disconnect();
    }, [seen]);
    return (
        <Tag ref={ref} className={`${className} ${seen ? 'jb-rise' : 'ph-hide'}`} style={{ ...style, animationDelay: `${delay}ms` }}>
            {children}
        </Tag>
    );
};

const PublicHome = () => {
    const [showInquiryForm, setShowInquiryForm] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [slide, setSlide] = useState(0);
    const [menu, setMenu] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
        const t = setInterval(() => setSlide(s => (s + 1) % HERO.length), 4500);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const on = () => setScrolled(window.scrollY > 12);
        on();
        window.addEventListener('scroll', on, { passive: true });
        return () => window.removeEventListener('scroll', on);
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
    const NAV = [['#results', 'Results'], ['#centres', 'Centres'], ['#batches', 'Batches'], ['#mentors', 'Mentors']];

    return (
        <div className="kap min-h-screen overflow-x-clip" style={{ background: 'var(--cream)', color: 'var(--ink)' }}>
            <style>{`
                .ph-hide { opacity: 0; }
                @media (prefers-reduced-motion: reduce) { .ph-hide { opacity: 1; } }
                .ph-fade { transition: opacity 1s ease, transform 6s ease-out; }
                .ph-float { animation: phFloat 6s ease-in-out infinite; }
                @keyframes phFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
                @media (prefers-reduced-motion: reduce) { .ph-float { animation: none; } .ph-fade { transition: none; } }
                html { scroll-behavior: smooth; scroll-padding-top: 88px; }
            `}</style>

            {/* Header */}
            <header className="sticky top-0 z-50 px-3 sm:px-5 pt-3">
                <nav className="max-w-6xl mx-auto flex items-center justify-between gap-3 rounded-full pl-4 pr-2 py-2 transition-[background-color,box-shadow] duration-300"
                    style={{ background: scrolled || menu ? 'var(--panel)' : 'transparent', boxShadow: scrolled || menu ? 'var(--card-sh)' : 'none' }} aria-label="Main">
                    <a href="#top" className="shrink-0"><img src={kapLogo} alt="KAP Edutech" className="h-9 sm:h-10 w-auto" /></a>
                    <div className="hidden lg:flex items-center gap-1">
                        {NAV.map(([h, l]) => <a key={h} href={h} className="px-4 py-2 rounded-full text-[14px] font-semibold hover:bg-[var(--cream2)] transition-colors">{l}</a>)}
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setShowLoginModal(true)} className="jb-act jb-act-line hidden sm:inline-flex" style={{ padding: '10px 18px', fontSize: 14 }}>Log in</button>
                        <button type="button" onClick={demo} className="jb-act jb-act-ink" style={{ padding: '10px 18px', fontSize: 14 }}>Book a free demo</button>
                        <button type="button" onClick={() => setMenu(m => !m)} aria-expanded={menu} aria-label="Menu" className="lg:hidden jb-act jb-act-soft" style={{ padding: '10px 13px', fontSize: 15 }}>{menu ? '✕' : '☰'}</button>
                    </div>
                </nav>
                {menu && (
                    <div className="lg:hidden max-w-6xl mx-auto mt-2 jb-card jb-rise p-3 grid gap-1">
                        {NAV.map(([h, l]) => <a key={h} href={h} onClick={() => setMenu(false)} className="px-4 py-3 rounded-2xl font-semibold hover:bg-[var(--cream2)]">{l}</a>)}
                        <button type="button" onClick={() => { setMenu(false); setShowLoginModal(true); }} className="text-left px-4 py-3 rounded-2xl font-semibold hover:bg-[var(--cream2)]">Log in</button>
                    </div>
                )}
            </header>

            {/* Hero */}
            <section id="top" className="max-w-6xl mx-auto px-4 sm:px-5 pt-8 sm:pt-14 pb-12 grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center">
                <div>
                    <span className="jb-tag jb-rise" style={{ background: 'var(--t-sage)', fontSize: 13, padding: '6px 14px' }}>
                        <span className="w-2 h-2 rounded-full jb-pulse" style={{ background: 'var(--ok)' }} aria-hidden="true" /> Admissions open for 2026–27
                    </span>
                    <h1 className="jb-h jb-rise mt-5 text-[40px] sm:text-[56px] leading-[1.02] tracking-[-0.035em]" style={{ animationDelay: '60ms' }}>
                        Crack JEE &amp; NEET<br />with Nashik's <span className="relative inline-block">most loved
                            <svg viewBox="0 0 300 18" className="absolute left-0 -bottom-2 w-full h-[14px]" aria-hidden="true"><path className="jb-draw" d="M3 13 C 80 3, 200 3, 297 11" fill="none" stroke="var(--coral)" strokeWidth="5" strokeLinecap="round" /></svg>
                        </span> mentors.
                    </h1>
                    <p className="jb-rise mt-6 text-[17px] leading-relaxed max-w-lg" style={{ color: 'var(--sub)', animationDelay: '120ms' }}>
                        Unacademy Nashik and Prayaas by KAP Edutech. Classroom coaching for Class 11, 12, droppers and Foundation, at three centres across Nashik.
                    </p>
                    <div className="jb-rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: '180ms' }}>
                        <button type="button" onClick={demo} className="jb-act jb-act-ink" style={{ padding: '15px 26px', fontSize: 16 }}>Book a free demo class →</button>
                        <a href="#batches" className="jb-act jb-act-line" style={{ padding: '15px 26px', fontSize: 16 }}>See upcoming batches</a>
                    </div>
                    <div className="jb-rise mt-9 flex items-center gap-4" style={{ animationDelay: '240ms' }}>
                        <div className="flex -space-x-3">
                            {MENTORS.map(m => <img key={m.name} src={m.img} alt="" className="w-11 h-11 rounded-full object-cover" style={{ border: '3px solid var(--cream)' }} />)}
                        </div>
                        <p className="text-[14px] leading-snug" style={{ color: 'var(--sub)' }}><b style={{ color: 'var(--ink)' }}>Taught by the directors themselves</b><br />Physics and Chemistry experts</p>
                    </div>
                </div>

                {/* Photo stack */}
                <div className="relative jb-rise" style={{ animationDelay: '120ms' }}>
                    <div className="absolute -inset-3 sm:-inset-5 rounded-[40px] rotate-[-3deg]" style={{ background: 'var(--t-butter)' }} aria-hidden="true" />
                    <div className="relative aspect-[4/3.4] rounded-[32px] overflow-hidden" style={{ background: 'var(--sage)' }}>
                        {HERO.map((h, i) => (
                            <img key={h.cap} src={h.img} alt={i === slide ? h.cap : ''} aria-hidden={i !== slide}
                                className="ph-fade absolute inset-0 w-full h-full object-cover"
                                style={{ opacity: i === slide ? 1 : 0, transform: i === slide ? 'scale(1.06)' : 'scale(1)' }}
                                loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : undefined} />
                        ))}
                        <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-3" style={{ background: 'linear-gradient(transparent, rgba(17,25,21,.55))' }}>
                            <span className="text-white text-[14px] font-semibold">{HERO[slide].cap}</span>
                            <span className="flex gap-1.5" role="tablist" aria-label="Photos">
                                {HERO.map((h, i) => (
                                    <button key={h.cap} type="button" role="tab" aria-selected={i === slide} aria-label={h.cap} onClick={() => setSlide(i)}
                                        className="h-2 rounded-full transition-all duration-300" style={{ width: i === slide ? 22 : 8, background: i === slide ? '#fff' : 'rgba(255,255,255,.5)' }} />
                                ))}
                            </span>
                        </div>
                    </div>
                    <div className="ph-float absolute -left-3 sm:-left-8 top-8 rounded-[20px] px-4 py-3" style={{ background: 'var(--panel)', boxShadow: 'var(--card-sh)' }}>
                        <p className="text-[12px] font-bold" style={{ color: 'var(--muted)' }}>Selections in IITs</p>
                        <p className="jb-h text-[24px]">150+</p>
                    </div>
                    <div className="ph-float absolute -right-2 sm:-right-6 bottom-16 rounded-[20px] px-4 py-3" style={{ background: 'var(--t-sage)', boxShadow: 'var(--card-sh)', animationDelay: '-3s' }}>
                        <p className="text-[12px] font-bold" style={{ color: 'var(--sub)' }}>Selections in GMCs</p>
                        <p className="jb-h text-[24px]">300+</p>
                    </div>
                </div>
            </section>

            {/* Why us */}
            <section className="max-w-6xl mx-auto px-4 sm:px-5 pb-16">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {WHY.map((w, i) => (
                        <Reveal key={w.title} delay={i * 70} className="jb-lift rounded-[24px] p-5" style={{ background: `var(--t-${w.tone})` }}>
                                <span className="text-[28px]" aria-hidden="true">{w.emoji}</span>
                                <p className="jb-h text-[17px] mt-3 leading-tight">{w.title}</p>
                                <p className="text-[13.5px] mt-1" style={{ color: 'var(--sub)' }}>{w.sub}</p>
                        </Reveal>
                    ))}
                </div>
            </section>

            <div id="results"><ResultsShowcase /></div>

            {/* Centres */}
            <section id="centres" className="max-w-6xl mx-auto px-4 sm:px-5 py-16 sm:py-20">
                <Reveal className="flex flex-wrap items-end justify-between gap-3 mb-8">
                    <div>
                        <p className="kap-eyebrow">Visit us</p>
                        <h2 className="jb-h text-[32px] sm:text-[40px] leading-tight mt-1">Three centres across Nashik</h2>
                    </div>
                    <a href={`https://wa.me/${PHONE_RAW}?text=${encodeURIComponent('Hi, I would like to visit a KAP centre.')}`} target="_blank" rel="noreferrer" className="jb-act jb-act-line" style={{ padding: '11px 18px', fontSize: 14 }}>Plan a visit on WhatsApp</a>
                </Reveal>
                <div className="grid md:grid-cols-3 gap-5">
                    {CENTRES.map((c, i) => (
                        <Reveal key={c.name} delay={i * 80} className="jb-card jb-lift overflow-hidden group" as="article">
                            <div className="aspect-[4/3] overflow-hidden" style={{ background: `var(--t-${c.tone})` }}>
                                <img src={c.img} alt={`${c.name} centre`} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                            </div>
                            <div className="p-5">
                                <h3 className="jb-h text-[20px]">{c.name}</h3>
                                <p className="text-[13.5px]" style={{ color: 'var(--muted)' }}>{c.type}</p>
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    {c.tags.map(t => <span key={t} className="jb-tag" style={{ background: `var(--t-${c.tone})` }}>{t}</span>)}
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            <div id="batches"><UpcomingBatchesPublic onReserve={demo} /></div>

            {/* Mentors */}
            <section id="mentors" className="max-w-6xl mx-auto px-4 sm:px-5 py-16 sm:py-20">
                <Reveal className="mb-8">
                    <p className="kap-eyebrow">Your mentors</p>
                    <h2 className="jb-h text-[32px] sm:text-[40px] leading-tight mt-1">Learn from the people behind the ranks</h2>
                </Reveal>
                <div className="grid md:grid-cols-3 gap-5">
                    {MENTORS.map((m, i) => (
                        <Reveal key={m.name} delay={i * 80} className="rounded-[28px] p-6 jb-lift flex flex-col" as="article" style={{ background: `var(--t-${m.tone})` }}>
                                <div className="flex items-center gap-4">
                                    <img src={m.img} alt={m.name} loading="lazy" className="w-20 h-20 rounded-full object-cover" style={{ border: '4px solid var(--panel)' }} />
                                    <div>
                                        <h3 className="jb-h text-[19px] leading-tight">{m.name}</h3>
                                        <p className="text-[13px] font-semibold" style={{ color: 'var(--sub)' }}>Director · {m.subject}</p>
                                    </div>
                                </div>
                                <p className="mt-5 text-[15.5px] leading-relaxed font-medium">“{m.quote}”</p>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* Closing call to action */}
            <section className="px-4 sm:px-5 pb-16">
                <Reveal className="max-w-6xl mx-auto rounded-[36px] px-6 sm:px-12 py-12 sm:py-16 relative overflow-hidden" >
                    <div className="absolute inset-0" style={{ background: 'var(--pine)' }} aria-hidden="true" />
                    <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full" style={{ background: 'rgba(220,232,210,.12)' }} aria-hidden="true" />
                    <div className="absolute right-24 -bottom-24 w-56 h-56 rounded-full" style={{ background: 'rgba(246,231,174,.12)' }} aria-hidden="true" />
                    <div className="relative grid md:grid-cols-[1.4fr_1fr] gap-8 items-center" style={{ color: '#F5F8F4' }}>
                        <div>
                            <h2 className="text-[32px] sm:text-[42px] font-extrabold leading-[1.05] tracking-[-0.03em]">Come for a free demo class. Bring a parent.</h2>
                            <p className="mt-3 text-[16px]" style={{ color: 'rgba(245,248,244,.75)' }}>Meet the faculty, see the classroom and get a study plan for your exam, all in one visit.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row md:flex-col gap-3">
                            <button type="button" onClick={demo} className="jb-act" style={{ background: '#F6E7AE', color: '#1D2A22', padding: '15px 22px', fontSize: 16 }}>Book a free demo →</button>
                            <a href={`tel:+${PHONE_RAW}`} className="jb-act text-center" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', padding: '15px 22px', fontSize: 16 }}>Call {PHONE}</a>
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* Footer */}
            <footer className="px-4 sm:px-5 pb-10">
                <div className="max-w-6xl mx-auto grid sm:grid-cols-[1.6fr_1fr_1fr] gap-8 pt-10" style={{ borderTop: '1px solid var(--line)' }}>
                    <div>
                        <img src={kapLogo} alt="KAP Edutech" className="h-10 w-auto" />
                        <p className="mt-3 text-[14px] max-w-sm" style={{ color: 'var(--muted)' }}>KAP Edutech Pvt. Ltd. Coaching for JEE, NEET and Foundation in Nashik with Unacademy and Prayaas.</p>
                    </div>
                    <div>
                        <p className="font-bold text-[14px] mb-2">Explore</p>
                        <ul className="space-y-1.5 text-[14px]" style={{ color: 'var(--muted)' }}>
                            {NAV.map(([h, l]) => <li key={h}><a href={h} className="hover:underline">{l}</a></li>)}
                            <li><Link to="/login" className="hover:underline">Staff login</Link></li>
                        </ul>
                    </div>
                    <div>
                        <p className="font-bold text-[14px] mb-2">Contact</p>
                        <ul className="space-y-1.5 text-[14px]" style={{ color: 'var(--muted)' }}>
                            <li><a href={`tel:+${PHONE_RAW}`} className="hover:underline">📞 {PHONE}</a></li>
                            <li><a href={`https://wa.me/${PHONE_RAW}`} target="_blank" rel="noreferrer" className="hover:underline">💬 WhatsApp us</a></li>
                            <li>📍 Nashik, Maharashtra</li>
                        </ul>
                    </div>
                </div>
                <p className="max-w-6xl mx-auto mt-8 text-[12.5px]" style={{ color: 'var(--muted)' }}>© {new Date().getFullYear()} KAP Edutech Pvt. Ltd. All rights reserved.</p>
            </footer>

            {/* WhatsApp button */}
            <a href={`https://wa.me/${PHONE_RAW}`} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"
                className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center text-[26px] jb-lift"
                style={{ background: 'var(--wa)', color: '#fff', boxShadow: '0 10px 30px rgba(18,140,74,.35)' }}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.4-.3z" /></svg>
            </a>

            {showLoginModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Log in">
                    <div className="absolute inset-0 shell-fade" style={{ background: 'rgba(17,25,21,.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowLoginModal(false)} />
                    <div className="relative z-10 w-full max-w-sm"><LoginModal onClose={() => setShowLoginModal(false)} /></div>
                </div>
            )}
            {showInquiryForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Book a free demo">
                    <div className="absolute inset-0 shell-fade" style={{ background: 'rgba(17,25,21,.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowInquiryForm(false)} />
                    <div className="relative z-10 w-full max-w-lg flex justify-center"><PublicInquiryForm onClose={() => setShowInquiryForm(false)} /></div>
                </div>
            )}
        </div>
    );
};

export default PublicHome;
