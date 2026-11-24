import React from 'react';
import banner1 from '../assets/results/final_result_1.webp';

const ResultsShowcase = () => {

    const stats = [
        { label: "Selections in IITs", value: "150+", tone: 'sage' },
        { label: "Selections in GMCs", value: "300+", tone: 'blue' },
        { label: "Students above 99%ile", value: "85+", tone: 'butter' },
        { label: "Scholarships awarded", value: "₹2 Cr+", tone: 'coral' }
    ];

    return (
        <section className="px-4 sm:px-5 py-6">
            <div className="max-w-6xl mx-auto rounded-[36px] px-5 sm:px-10 py-12 sm:py-16" style={{ background: 'var(--sage)' }}>
                <div className="text-center mb-10">
                    <p className="kap-eyebrow">Results</p>
                    <h2 className="jb-h text-[32px] sm:text-[44px] leading-tight mt-1">Our results speak for us</h2>
                    <p className="mt-3 max-w-xl mx-auto text-[16px]" style={{ color: 'var(--sub)' }}>
                        Year after year, Unacademy Nashik students clear the toughest exams. Be the next success story.
                    </p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
                    {stats.map((stat) => (
                        <div key={stat.label} className="rounded-[24px] p-5 text-center jb-lift" style={{ background: 'var(--panel)' }}>
                            <div className="jb-h text-[30px] sm:text-[38px]">{stat.value}</div>
                            <div className="text-[13px] font-semibold mt-1" style={{ color: 'var(--muted)' }}>{stat.label}</div>
                        </div>
                    ))}
                </div>
                <div className="rounded-[24px] overflow-hidden" style={{ background: 'var(--panel)', boxShadow: 'var(--card-sh)' }}>
                    <img src={banner1} alt="IIT JEE and NEET results 2025" loading="lazy" className="w-full h-auto" />
                </div>
            </div>
        </section>
    );
};

export default ResultsShowcase;
