import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Star, BookOpen, Users, ArrowRight, ShieldCheck } from 'lucide-react';

// Image Imports
import classroomImg from '../assets/classroom.png';
import kapilImg from '../assets/kapil_sir.png';
import pranavImg from '../assets/pranav_sir.png';
import abhishekImg from '../assets/abhishek_sir.png';
import nashikRoadImg from '../assets/nashik_road.png';

const PublicHome = () => {
    return (
        <div className="font-sans text-gray-800">

            {/* 1. NAVBAR (Glassmorphism) */}
            <nav className="fixed w-full z-50 transition-all duration-300 bg-white/90 backdrop-blur-md shadow-sm border-b border-white/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        {/* Logo Area */}
                        <div className="flex items-center gap-2">
                            <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white p-2 rounded-lg font-bold text-xl tracking-tighter shadow-lg">
                                KAP
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 leading-none tracking-tight">Unacademy</h1>
                                <p className="text-xs text-blue-600 font-bold tracking-widest uppercase">Nashik Centre</p>
                            </div>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex space-x-8">
                            <a href="#courses" className="text-gray-600 hover:text-blue-700 font-medium transition-colors">Courses</a>
                            <a href="#faculty" className="text-gray-600 hover:text-blue-700 font-medium transition-colors">Faculty</a>
                            <a href="#centers" className="text-gray-600 hover:text-blue-700 font-medium transition-colors">Centers</a>
                        </div>

                        {/* Staff Login Button */}
                        <div>
                            <Link to="/login" className="flex items-center gap-2 bg-gray-900 hover:bg-blue-800 text-white px-5 py-2.5 rounded-full font-medium transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm">
                                <ShieldCheck className="w-4 h-4" /> Staff Login
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* 2. HERO SECTION */}
            <div className="relative bg-slate-900 text-white overflow-hidden">
                {/* Modern Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900"></div>

                {/* Subtle Glow Effects */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>

                <div className="relative max-w-7xl mx-auto px-4 pt-32 pb-12 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-8">

                    {/* Left Content */}
                    <div className="md:w-1/2 z-10">
                        <div className="inline-flex items-center gap-2 bg-blue-800/50 border border-blue-700 text-blue-200 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider mb-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Admissions Open 2025-26
                        </div>

                        <h1 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight tracking-tight">
                            Crack JEE & NEET <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">with Nashik's Best.</span>
                        </h1>

                        <p className="text-base text-gray-300 mb-6 max-w-lg leading-relaxed">
                            Join the leaders in education. Managed by <span className="font-semibold text-white">KAP Edutech</span>, powered by <span className="font-semibold text-white">Unacademy & Prayaas</span>.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <a href="#contact" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/25 text-center text-sm">
                                Book a Free Demo
                            </a>
                            <a href="#courses" className="px-6 py-3 rounded-lg font-bold border border-gray-600 hover:bg-gray-800 transition-all text-white text-center text-sm">
                                Explore Courses
                            </a>
                        </div>

                        <div className="mt-8 flex items-center gap-4 text-xs text-gray-400">
                            <div className="flex items-center gap-2">
                                <div className="flex -space-x-2">
                                    <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-900"></div>
                                    <div className="w-6 h-6 rounded-full bg-gray-600 border-2 border-gray-900"></div>
                                    <div className="w-6 h-6 rounded-full bg-gray-500 border-2 border-gray-900 flex items-center justify-center text-[10px] text-white font-bold">+</div>
                                </div>
                                <span>1000+ Students</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Image */}
                    <div className="md:w-1/2 relative z-10 flex justify-center">
                        <div className="relative max-w-md w-full rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
                            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent z-10"></div>
                            <img src={classroomImg} alt="Classroom" className="w-full h-auto object-cover" />

                            {/* Floating Stats Card */}
                            <div className="absolute bottom-4 left-4 right-4 bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-xl z-20 flex justify-between items-center">
                                <div>
                                    <p className="text-xl font-bold text-white">100+</p>
                                    <p className="text-[10px] text-blue-200 uppercase tracking-wide">IIT Selections</p>
                                </div>
                                <div className="h-6 w-px bg-white/20"></div>
                                <div>
                                    <p className="text-xl font-bold text-white">50+</p>
                                    <p className="text-[10px] text-blue-200 uppercase tracking-wide">AIIMS/Govt Med</p>
                                </div>
                            </div>
                        </div>
                        {/* Decorative Elements */}
                        <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-600/20 rounded-full blur-2xl -z-10"></div>
                        <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-purple-600/20 rounded-full blur-2xl -z-10"></div>
                    </div>
                </div>
            </div>

            {/* 3. FACULTY SECTION (The Directors) */}
            <div id="faculty" className="py-24 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center mb-16">
                        <span className="text-blue-600 font-bold tracking-wider uppercase text-sm">Expert Guidance</span>
                        <h2 className="text-4xl font-bold text-gray-900 mt-2">Learn from the Masters</h2>
                        <p className="text-gray-600 mt-4 max-w-2xl mx-auto text-lg">Guided by the visionaries of KAP Edutech with a proven track record of producing toppers.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        {/* Faculty 1: Abhishek Sir (Physics) */}
                        <div className="group bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-blue-100 transform hover:-translate-y-2">
                            <div className="relative w-32 h-32 mx-auto mb-6">
                                <div className="absolute inset-0 bg-blue-100 rounded-full transform rotate-3 group-hover:rotate-6 transition-transform"></div>
                                <img src={abhishekImg} alt="Abhishek Sir" className="relative w-32 h-32 rounded-full object-cover border-4 border-white shadow-md" />
                            </div>
                            <h3 className="text-2xl font-bold text-center text-gray-800">Abhishek Rawat Sir</h3>
                            <p className="text-blue-600 text-center text-sm font-bold uppercase tracking-wide mt-1">Director</p>
                            <p className="text-gray-500 text-center mt-6 leading-relaxed">
                                Expert in solving complex problems with simple tricks. A favorite among JEE aspirants.
                            </p>
                        </div>

                        {/* Faculty 2: Kapil Sir (Physics) */}
                        <div className="group bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-blue-100 transform hover:-translate-y-2">
                            <div className="relative w-32 h-32 mx-auto mb-6">
                                <div className="absolute inset-0 bg-blue-100 rounded-full transform rotate-6 group-hover:rotate-12 transition-transform"></div>
                                <img src={kapilImg} alt="Kapil Sir" className="relative w-32 h-32 rounded-full object-cover border-4 border-white shadow-md" />
                            </div>
                            <h3 className="text-2xl font-bold text-center text-gray-800">Kapil Gautam Sir</h3>
                            <p className="text-blue-600 text-center text-sm font-bold uppercase tracking-wide mt-1">Director & HOD Physics</p>
                            <p className="text-gray-500 text-center mt-6 leading-relaxed">
                                Renowned for visualizing concepts. His students consistently score top marks in JEE Advanced Physics.
                            </p>
                        </div>

                        {/* Faculty 3: Pranav Sir (Chemistry) */}
                        <div className="group bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-purple-100 transform hover:-translate-y-2">
                            <div className="relative w-32 h-32 mx-auto mb-6">
                                <div className="absolute inset-0 bg-purple-100 rounded-full transform -rotate-3 group-hover:-rotate-6 transition-transform"></div>
                                <img src={pranavImg} alt="Pranav Sir" className="relative w-32 h-32 rounded-full object-cover border-4 border-white shadow-md" />
                            </div>
                            <h3 className="text-2xl font-bold text-center text-gray-800">Pranav Tripathi Sir</h3>
                            <p className="text-purple-600 text-center text-sm font-bold uppercase tracking-wide mt-1">Director & HOD Chemistry</p>
                            <p className="text-gray-500 text-center mt-6 leading-relaxed">
                                Master of Organic & Inorganic Chemistry. Makes reactions easy to remember and apply.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. OUR CENTERS */}
            <div id="centers" className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-12">
                        <div>
                            <span className="text-blue-600 font-bold tracking-wider uppercase text-sm">Locations</span>
                            <h2 className="text-4xl font-bold text-gray-900 mt-2">Our Centers</h2>
                        </div>
                        <p className="text-gray-500 mt-4 md:mt-0 max-w-md text-right">State-of-the-art infrastructure designed for focused learning.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* College Road */}
                        <div className="group relative overflow-hidden rounded-3xl shadow-lg h-96 cursor-pointer">
                            <div className="absolute inset-0 bg-gray-900">
                                {/* Placeholder Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-900 opacity-80 group-hover:scale-110 transition-transform duration-700"></div>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-white/10 font-black text-6xl transform -rotate-12 select-none">COLLEGE</span>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 p-8 text-white transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                <div className="bg-blue-600 w-12 h-1 mb-4 rounded-full"></div>
                                <h3 className="text-3xl font-bold mb-2">College Road</h3>
                                <p className="text-blue-200 mb-6 font-medium">Unacademy Centre</p>
                                <div className="flex items-start gap-3 text-sm text-gray-300 leading-relaxed">
                                    <MapPin className="w-5 h-5 shrink-0 text-blue-400" />
                                    Platinum Grand Plaza, Near Magnum Hospital, Patil Lane 1
                                </div>
                            </div>
                        </div>

                        {/* Nashik Road */}
                        <div className="group relative overflow-hidden rounded-3xl shadow-lg h-96 cursor-pointer">
                            <img src={nashikRoadImg} alt="Nashik Road" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-purple-900/40 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 p-8 text-white transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                <div className="bg-purple-600 w-12 h-1 mb-4 rounded-full"></div>
                                <h3 className="text-3xl font-bold mb-2">Nashik Road</h3>
                                <p className="text-purple-200 mb-6 font-medium">Unacademy Centre</p>
                                <div className="flex items-start gap-3 text-sm text-gray-300 leading-relaxed">
                                    <MapPin className="w-5 h-5 shrink-0 text-purple-400" />
                                    Mogal Arcade, Jail Rd, behind Mogal Hospital
                                </div>
                            </div>
                        </div>

                        {/* PRAYAS CENTER (New) */}
                        <div className="group relative overflow-hidden rounded-3xl shadow-lg h-96 cursor-pointer">
                            <div className="absolute inset-0 bg-gray-900">
                                {/* Placeholder Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-indigo-900 opacity-80 group-hover:scale-110 transition-transform duration-700"></div>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-white/10 font-black text-6xl transform -rotate-12 select-none">PRAYAS</span>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 p-8 text-white transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                <div className="bg-indigo-500 w-12 h-1 mb-4 rounded-full"></div>
                                <h3 className="text-3xl font-bold mb-2">Prayas Center</h3>
                                <p className="text-indigo-200 mb-6 font-medium">Managed by KAP</p>
                                <div className="flex items-start gap-3 text-sm text-gray-300 leading-relaxed">
                                    <MapPin className="w-5 h-5 shrink-0 text-indigo-400" />
                                    Pokar Arcade, Above Domino's, Opp. Synergy Hospital, Dindori Rd
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. FOOTER */}
            <footer className="bg-gray-900 text-gray-400 py-12">
                <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <h4 className="text-white text-lg font-bold mb-4">Unacademy Nashik</h4>
                        <p className="text-sm">Managed by KAP Edutech Pvt Ltd.</p>
                        <p className="text-sm mt-2">Empowering students to achieve their dreams.</p>
                    </div>
                    <div>
                        <h4 className="text-white text-lg font-bold mb-4">Programs</h4>
                        <ul className="space-y-2 text-sm">
                            <li>IIT JEE (Mains + Adv)</li>
                            <li>NEET UG</li>
                            <li>Foundation (8th - 10th)</li>
                            <li>MHT-CET</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white text-lg font-bold mb-4">Contact</h4>
                        <p className="flex items-center gap-2 text-sm mb-2"><Phone className="w-4 h-4" /> 9272090238</p>
                        <p className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4" /> Nashik, Maharashtra</p>
                    </div>
                </div>
                <div className="text-center mt-12 pt-8 border-t border-gray-800 text-xs">
                    © 2025 KAP Edutech Pvt Ltd. All rights reserved.
                </div>
            </footer>

        </div>
    );
};

export default PublicHome;
