import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Phone, MessageCircle, ChevronLeft, ChevronRight, Star, ArrowRight, ShieldCheck, GraduationCap, PlayCircle, BookOpen, Users, MonitorPlay, FileText, Headphones } from 'lucide-react';
import PublicInquiryForm from '../components/PublicInquiryForm';
import LoginModal from '../components/LoginModal';
import UpcomingBatchesPublic from '../components/UpcomingBatchesPublic'; // NEW
import ResultsShowcase from '../components/ResultsShowcase'; // NEW

// Image Imports
import kapLogo from '../assets/kap_edutech_logo.png';
import nashikRoadImg from '../assets/nashik_road.png';
import unacademyNashikRoadImg from '../assets/unacademy_center_nashik.png';
import collegeRoadImg from '../assets/unacademy_college_road.jpg';
import kapilImg from '../assets/kapil_sir.png';
import pranavImg from '../assets/pranav_sir.png';
import abhishekImg from '../assets/abhishek_sir.png';

// Hero Carousel Images
import heroFaculty from '../assets/hero_faculty_group.png';
import heroFacultyGroupV2 from '../assets/hero_faculty_group_v2.jpg';
import heroClassroomSide from '../assets/hero_classroom_side.jpg';
import heroTeacherBoard from '../assets/hero_teacher_board.png';
import heroTeacherBack from '../assets/hero_teacher_back.png';
import heroSeminar from '../assets/hero_seminar.png';
import heroSmartClass from '../assets/hero_smart_class.png';
import heroExamHall from '../assets/hero_exam_hall.png';
import heroClassroomMonitoring from '../assets/hero_classroom_monitoring.png';
import heroTeachersDay from '../assets/hero_teachers_day.png';

const PublicHome = () => {
    const [showInquiryForm, setShowInquiryForm] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [activeDirector, setActiveDirector] = useState(0);
    const navigate = useNavigate();

    // Director Rotation Data
    const directors = [
        {
            id: 1,
            name: "Kapil Gautam",
            role: "Physics Expert",
            img: kapilImg,
            quote: "KAP Edutech is where students learn with love and can grow with guidance.",
            bubble: {
                title: "Expert Guidance?",
                subtitle: "Ask anytime!",
                icon: pranavImg // Shows Pranav Sir in bubble when Kapil Sir is main
            }
        },
        {
            id: 2,
            name: "Abhishek Rawat",
            role: "Physics Wizard",
            img: abhishekImg,
            quote: "Master concepts with visualization and real-world examples.",
            bubble: {
                title: "Doubt Solving",
                subtitle: "24x7 Support",
                icon: kapilImg // Shows Kapil Sir in bubble
            }
        },
        {
            id: 3,
            name: "Pranav Tripathi",
            role: "Chemistry Guru",
            img: pranavImg,
            quote: "Chemistry is not just equations, it's the language of the universe.",
            bubble: {
                title: "Exam Strategy",
                subtitle: "Top Ranks",
                icon: abhishekImg // Shows Abhishek Sir in bubble
            }
        }
    ];

    const rotateDirector = () => {
        setActiveDirector((prev) => (prev + 1) % directors.length);
    };

    // Carousel Data
    const slides = [
        {
            id: 1,
            bg: "bg-[#0f172a]", // Dark Navy
            image: heroFacultyGroupV2,
            title: "Achieve Your JEE/NEET Aim With Us!",
            subtitle: "Jee Batches for Class 11th, 12th & Droppers",
            cta: "Explore Batches",
            accent: "from-blue-600 to-indigo-600"
        },
        {
            id: 2,
            bg: "bg-[#1e1b4b]", // Dark Indigo
            image: heroTeacherBack,
            title: "Learn from the Best Faculty",
            subtitle: "Experience world-class mentorship & doubt solving",
            cta: "Meet Our Team",
            accent: "from-purple-600 to-pink-600"
        },
        {
            id: 3,
            bg: "bg-[#022c22]", // Dark Green
            image: heroClassroomSide,
            title: "State-of-the-Art Infrastructure",
            subtitle: "Modern classrooms designed for focus & learning",
            cta: "Visit Center",
            accent: "from-emerald-600 to-teal-600"
        },
        {
            id: 4,
            bg: "bg-[#3f2020]", // Dark Red/Brown
            image: heroTeacherBoard,
            title: "Concept-Based Learning",
            subtitle: "Master the fundamentals with visual teaching methods",
            cta: "Book Demo",
            accent: "from-orange-600 to-red-600"
        },
        {
            id: 5,
            bg: "bg-[#172554]", // Dark Blue
            image: heroSeminar,
            title: "Expert Guidance Seminars",
            subtitle: "Regular motivation & strategy sessions by toppers",
            cta: "Join Us",
            accent: "from-blue-500 to-cyan-500"
        },
        {
            id: 6,
            bg: "bg-[#4c1d95]", // Deep Purple
            image: heroSmartClass,
            title: "Digital Smart Classrooms",
            subtitle: "Interactive learning with cutting-edge technology",
            cta: "Explore",
            accent: "from-violet-600 to-fuchsia-600"
        },
        {
            id: 7,
            bg: "bg-[#881337]", // Rose Dark
            image: heroExamHall,
            title: "Simulation Exam Environment",
            subtitle: "Weekly tests to build exam temperament",
            cta: "Test Series",
            accent: "from-rose-600 to-pink-600"
        },
        {
            id: 8,
            bg: "bg-[#0f172a]", // Slate Dark
            image: heroClassroomMonitoring,
            title: "Personalized Attention",
            subtitle: "Small batch sizes for individual focus",
            cta: "Enquire Now",
            accent: "from-slate-600 to-gray-500"
        },
        {
            id: 9,
            bg: "bg-[#ea580c]", // Orange Dark
            image: heroTeachersDay,
            title: "Vibrant Campus Life",
            subtitle: "Celebrating success and building memories together",
            cta: "Gallery",
            accent: "from-yellow-500 to-orange-600"
        }
    ];

    // Auto Scroller
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 5000); // 5 seconds
        return () => clearInterval(timer);
    }, [slides.length]);

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

    return (
        <div className="font-sans text-slate-900 bg-white">

            {/* 1. HEADER (PW Style - Clean White) */}
            <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm h-16 sm:h-20">
                <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">

                    {/* Left: Logo & Dropdown */}
                    <div className="flex items-center gap-4 sm:gap-6">
                        <div className="flex items-center gap-2 cursor-pointer">
                            <img src={kapLogo} alt="KAP Edutech" className="h-10 sm:h-12 w-auto object-contain" />
                        </div>

                        <div className="hidden md:flex items-center px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors">
                            All Courses <ChevronRight className="w-4 h-4 rotate-90 ml-2 text-gray-400" />
                        </div>
                    </div>

                    {/* Middle: Nav Links (Desktop) */}
                    <div className="hidden lg:flex items-center space-x-8 text-sm font-bold text-gray-600">
                        <a href="#centers" className="hover:text-blue-600 transition-colors">Centers</a>
                        <a href="#results" className="hover:text-blue-600 transition-colors">Results</a>
                        <a href="#faculty" className="hover:text-blue-600 transition-colors">Faculty</a>
                        <div className="flex items-center gap-1 text-orange-600 cursor-pointer hover:text-orange-700">
                            <Star className="w-4 h-4 fill-orange-600" /> Power Batch
                        </div>
                    </div>

                    {/* Right: Login/Register CTA */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowInquiryForm(true)}
                            className="hidden sm:flex items-center gap-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                        >
                            <BookOpen className="w-4 h-4 text-orange-600" /> Book Demo
                        </button>
                        <button onClick={() => setShowLoginModal(true)} className="bg-[#5a4bda] hover:bg-[#4839c4] text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md hover:shadow-lg active:scale-95 animate-pulse">
                            Login / Register
                        </button>
                    </div>
                </div>
            </nav>

            {/* 2. HERO CAROUSEL (Auto Scroller) */}
            <div className="relative w-full h-[400px] md:h-[500px] overflow-hidden bg-gray-900">
                {slides.map((slide, index) => (
                    <div
                        key={slide.id}
                        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                    >
                        {/* Background Container */}
                        <div className={`absolute inset-0 ${slide.bg}`}>
                            {/* Abstract Pattern overlay */}
                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(white_1px,transparent_1px)] [background-size:20px_20px]"></div>
                        </div>

                        {/* Content Grid */}
                        <div className="relative z-10 max-w-7xl mx-auto px-4 h-full flex items-center">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full items-center">

                                {/* Left Text */}
                                <div className="text-white space-y-6 animate-in slide-in-from-left duration-700 md:pl-8">
                                    <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight">
                                        {slide.title}
                                    </h1>
                                    <div className={`inline-block px-4 py-1 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm text-sm font-bold tracking-wider uppercase mb-2`}>
                                        {slide.subtitle}
                                    </div>
                                    <div>
                                        <button
                                            onClick={() => setShowLoginModal(true)}
                                            className="bg-white text-slate-900 hover:bg-gray-100 px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-[0_4px_14px_0_rgba(255,255,255,0.39)] transition-all hover:-translate-y-1"
                                        >
                                            {slide.cta}
                                        </button>
                                    </div>
                                </div>

                                {/* Right Image (Cutout Style) */}
                                <div className="hidden md:flex justify-end relative animate-in slide-in-from-bottom duration-1000">
                                    <div className={`absolute inset-0 bg-gradient-to-r ${slide.accent} opacity-30 blur-[100px] rounded-full`}></div>
                                    <img
                                        src={slide.image}
                                        alt={slide.title}
                                        className="relative z-10 h-[450px] w-auto object-cover rounded-tl-[100px] rounded-br-[40px] shadow-2xl border-4 border-white/10"
                                    />
                                    {/* Unacademy Logo Watermark */}
                                    <div className="absolute top-4 right-4 z-20 opacity-80">
                                        {/* <img src={kapLogo} className="w-12 h-12 bg-white rounded-full p-1" /> */}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Carousel Controls */}
                <button onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all">
                    <ChevronLeft className="w-8 h-8" />
                </button>
                <button onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all">
                    <ChevronRight className="w-8 h-8" />
                </button>

                {/* Indicators */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                    {slides.map((_, idx) => (
                        <div
                            key={idx}
                            onClick={() => setCurrentSlide(idx)}
                            className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${idx === currentSlide ? 'bg-white w-8' : 'bg-white/40 hover:bg-white/60'}`}
                        ></div>
                    ))}
                </div>
            </div>

            {/* 2.5 STATS BAR (Floating / Overlapping) */}
            <div className="relative z-20 -mt-16 px-4 mb-16">
                <div className="max-w-5xl mx-auto flex flex-wrap md:flex-nowrap justify-center gap-6">

                    {/* Stat Block 1 */}
                    <div className="flex-1 min-w-[250px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-6 flex flex-col items-center text-center hover:-translate-y-2 transition-transform duration-300 border border-red-100 animate-in zoom-in spin-in-3 duration-500">
                        <div className="bg-red-50 p-4 rounded-full mb-3 shadow-inner">
                            <MonitorPlay className="w-8 h-8 text-red-500 animate-pulse" />
                        </div>
                        <h3 className="font-bold text-slate-900 text-xl">Daily Live</h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">Interactive classes</p>
                    </div>

                    {/* Stat Block 2 */}
                    <div className="flex-1 min-w-[250px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-6 flex flex-col items-center text-center hover:-translate-y-2 transition-transform duration-300 border border-blue-100 animate-in zoom-in spin-in-3 duration-700">
                        <div className="bg-blue-50 p-4 rounded-full mb-3 shadow-inner">
                            <FileText className="w-8 h-8 text-blue-500 animate-bounce" />
                        </div>
                        <h3 className="font-bold text-slate-900 text-xl">10 Million +</h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">Tests, sample papers & notes</p>
                    </div>

                    {/* Stat Block 3 */}
                    <div className="flex-1 min-w-[250px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-6 flex flex-col items-center text-center hover:-translate-y-2 transition-transform duration-300 border border-purple-100 animate-in zoom-in spin-in-3 duration-1000">
                        <div className="bg-purple-50 p-4 rounded-full mb-3 shadow-inner">
                            <Headphones className="w-8 h-8 text-purple-500 animate-pulse" />
                        </div>
                        <h3 className="font-bold text-slate-900 text-xl">24 x 7</h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">Doubt solving sessions</p>
                    </div>

                </div>
            </div>

            {/* NEW: RESULTS SHOWCASE SECTION */}
            <div id="results">
                <ResultsShowcase />
            </div>

            {/* 3. TRUST BANNER (Like Reference) */}
            <div className="bg-[#f8faff] py-16 sm:py-24">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-12">

                        {/* Text Block */}
                        <div className="md:w-1/2 space-y-6">
                            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
                                Nashik's <span className="text-[#5a4bda]">Trusted & Result-Oriented</span> Educational Platform
                            </h2>
                            <p className="text-lg text-slate-500 font-medium leading-relaxed max-w-lg">
                                Unlock your potential by signing up with <span className="text-slate-900 font-bold">KAP Edutech</span>.
                                The most comprehensive learning solution powered by Unacademy & Prayaas.
                            </p>

                            <div className="flex gap-4 pt-4">
                                <button onClick={() => setShowLoginModal(true)} className="bg-[#5a4bda] hover:bg-[#4839c4] text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all hover:-translate-y-1">
                                    Get Started
                                </button>
                                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-bold text-slate-700">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Admissions Open
                                </div>
                            </div>
                        </div>

                        {/* Visual Visual Block */}
                        <div className="md:w-1/2 relative">
                            {/* Circle BG */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-dashed border-indigo-200 rounded-full animate-[spin_60s_linear_infinite]"></div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-50 rounded-full"></div>

                            {/* Dynamic Director Content */}
                            <div key={activeDirector} className="animate-in fade-in zoom-in duration-500">
                                {/* Main Image - Clickable to Rotate */}
                                <div
                                    className="relative z-10 cursor-pointer group"
                                    onClick={rotateDirector}
                                >
                                    <img
                                        src={directors[activeDirector].img}
                                        className="w-48 h-48 rounded-full border-4 border-white shadow-2xl object-cover mx-auto -translate-x-12 transition-transform duration-300 group-hover:scale-105"
                                        alt={directors[activeDirector].name}
                                    />
                                    <div className="absolute top-0 right-1/4 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                        Click to Rotate
                                    </div>
                                </div>

                                {/* Floating Bubble */}
                                <div className="absolute top-10 right-10 bg-white p-3 rounded-xl shadow-xl flex items-center gap-3 animate-bounce duration-[3000ms]">
                                    <img src={directors[activeDirector].bubble.icon} className="w-10 h-10 rounded-full object-cover" />
                                    <div className="text-xs">
                                        <p className="font-bold text-slate-900">{directors[activeDirector].bubble.title}</p>
                                        <p className="text-slate-500">{directors[activeDirector].bubble.subtitle}</p>
                                    </div>
                                </div>

                                {/* Bottom Quote Card */}
                                <div className="absolute -bottom-4 left-0 z-20 bg-[#1e1b4b] text-white p-4 rounded-xl shadow-xl text-xs max-w-[200px] animate-in slide-in-from-left duration-700">
                                    <p className="font-semibold mb-1">{directors[activeDirector].quote}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">- {directors[activeDirector].name}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. CENTERS GRID */}
            <div id="centers" className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-black text-slate-900 mb-2">Our Centers</h2>
                        <p className="text-slate-500">World-class infrastructure for focused learning</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { name: 'College Road', type: 'Unacademy Centre', img: collegeRoadImg, tags: ['IIT JEE', 'NEET', 'Foundation'] },
                            { name: 'Nashik Road', type: 'Unacademy Centre', img: unacademyNashikRoadImg, tags: ['IIT JEE', 'NEET'] },
                            { name: 'Prayaas information center for unacademy', type: 'Managed by KAP', img: nashikRoadImg, tags: ['Dropper Specialist', 'Library'] }
                        ].map((center, i) => (
                            <div key={i} className="group cursor-pointer">
                                <div className="relative overflow-hidden rounded-2xl mb-4 aspect-[4/3]">
                                    <img src={center.img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
                                    <div className="absolute bottom-4 left-4 text-white">
                                        <h3 className="text-xl font-bold">{center.name}</h3>
                                        <p className="text-xs font-medium opacity-80">{center.type}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {center.tags.map(tag => (
                                        <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wide rounded">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* NEW: UPCOMING BATCHES SECTION */}
            <UpcomingBatchesPublic />

            {/* 5. FACULTY SECTION (Compact Modern Cards) */}
            <div id="faculty" className="py-20 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex justify-between items-end mb-12">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900">Your Mentors</h2>
                            <p className="text-slate-500 mt-1">Learn from the experts behind top ranks.</p>
                        </div>
                        <button onClick={() => setShowLoginModal(true)} className="hidden md:block text-[#5a4bda] font-bold text-sm hover:underline">View All Faculty</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { img: abhishekImg, name: 'Abhishek Rawat', role: 'Director', subject: 'Physics', color: 'bg-blue-600' },
                            { img: kapilImg, name: 'Kapil Gautam', role: 'Director', subject: 'Physics', color: 'bg-purple-600' },
                            { img: pranavImg, name: 'Pranav Tripathi', role: 'Director', subject: 'Chemistry', color: 'bg-indigo-600' }
                        ].map((fac, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                                <div className="mb-4 relative">
                                    <div className={`absolute inset-0 rounded-full blur-lg opacity-20 ${fac.color}`}></div>
                                    <img src={fac.img} alt={fac.name} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg relative z-10" />
                                </div>
                                <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold text-white mb-3 ${fac.color}`}>
                                    {fac.subject}
                                </div>
                                <h3 className="font-bold text-slate-900 text-lg mb-1">{fac.name}</h3>
                                <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{fac.role}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 6. FOOTER */}
            <footer className="bg-[#0f172a] text-white pt-16 pb-8">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 border-b border-gray-800 pb-12">
                        <div className="col-span-1 md:col-span-2">
                            <img src={kapLogo} className="h-12 bg-white/10 rounded-lg p-1 w-auto mb-6" alt="KAP" />
                            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
                                KAP Edutech Pvt. Ltd. provides the best coaching for JEE, NEET, and Foundation in Nashik with Unacademy & Prayaas.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold text-lg mb-4">Quick Links</h4>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Results</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                                <li><a href="/login" className="hover:text-white transition-colors">Staff Portal</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-lg mb-4">Contact</h4>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li className="flex items-center gap-2"><Phone className="w-4 h-4" /> +91 9272090238</li>
                                <li className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Nashik, Maharashtra</li>
                            </ul>
                        </div>
                    </div>
                    <div className="pt-8 text-center text-gray-500 text-xs">
                        &copy; 2025 KAP Edutech Pvt. Ltd. All Rights Reserved.
                    </div>
                </div>
            </footer>

            {/* FLOATING ACTION BUTTON */}
            <div className="fixed bottom-6 right-6 z-40">
                <button onClick={() => setShowLoginModal(true)} className="bg-[#5a4bda] hover:bg-[#4839c4] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform active:scale-95 group">
                    <MessageCircle className="w-6 h-6" />
                </button>
            </div>

            {/* LOGIN MODAL */}
            {
                showLoginModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowLoginModal(false)}></div>
                        <div className="relative z-10 w-full max-w-sm">
                            <LoginModal onClose={() => setShowLoginModal(false)} />
                        </div>
                    </div>
                )
            }

            {/* INQUIRY MODAL */}
            {
                showInquiryForm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowInquiryForm(false)}></div>
                        <div className="relative z-10 w-full max-w-lg">
                            <PublicInquiryForm onClose={() => setShowInquiryForm(false)} />
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default PublicHome;
