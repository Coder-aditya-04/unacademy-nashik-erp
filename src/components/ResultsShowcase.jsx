import React from 'react';
import { Trophy, Star, Award, TrendingUp } from 'lucide-react';
import banner1 from '../assets/results/final_result_1.png';

const ResultsShowcase = () => {

    const stats = [
        { label: "Selections in IITs", value: "150+" },
        { label: "Selections in GMCs", value: "300+" },
        { label: "Students > 99%ile", value: "85+" },
        { label: "Scholarships Awarded", value: "₹2 Cr+" }
    ];

    return (
        <section className="py-20 bg-slate-900 text-white relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-yellow-500 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600 rounded-full blur-[100px]"></div>
            </div>

            <div className="max-w-7xl mx-auto px-4 relative z-10">
                <div className="text-center mb-12">
                    <span className="bg-yellow-500/20 text-yellow-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4 inline-block border border-yellow-500/30">
                        Excellence Delivered
                    </span>
                    <h2 className="text-4xl md:text-5xl font-black mb-6 font-outfit">
                        Our Results <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200">Speak Louder</span>
                    </h2>
                    <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                        Year after year, Unacademy Nashik students prove their mettle in the toughest exams. Be the next success story.
                    </p>
                </div>

                {/* Real Result Banners */}
                <div className="flex flex-col gap-8 mb-20 justify-center items-center">
                    <div className="w-full bg-white/5 p-2 rounded-2xl border border-white/10 shadow-2xl hover:scale-[1.01] transition-transform duration-500">
                        <img src={banner1} alt="IIT JEE & NEET Results 2025" className="w-full h-auto rounded-xl shadow-lg" />
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="bg-indigo-600/20 backdrop-blur-md rounded-3xl p-8 border border-indigo-500/30 grid grid-cols-2 md:grid-cols-4 gap-8">
                    {stats.map((stat, idx) => (
                        <div key={idx} className="text-center">
                            <div className="text-3xl md:text-4xl font-black text-white mb-2">{stat.value}</div>
                            <div className="text-xs md:text-sm font-bold text-indigo-200 uppercase tracking-widest">{stat.label}</div>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    );
};

export default ResultsShowcase;
