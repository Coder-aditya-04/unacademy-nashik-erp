
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Smartphone, ArrowRight, Loader2, ShieldCheck, ArrowLeft, Laptop, BookOpen, Database } from 'lucide-react';

const LoginModal = ({ onClose }) => {
    const [mobile, setMobile] = useState('');
    const [loading, setLoading] = useState(false);
    const [showStaffLinks, setShowStaffLinks] = useState(false);
    const navigate = useNavigate();

    const handleMobileSubmit = (e) => {
        e.preventDefault();
        if (mobile.length < 10) return;
        setLoading(true);
        // Simulate OTP process or Student Login check
        setTimeout(() => {
            setLoading(false);
            alert("Student Portal coming soon. Please use Staff Login if you are a team member.");
        }, 1000);
    };

    return (
        <div className="bg-white w-full max-w-md mx-auto rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 transform transition-all scale-100 relative">

            {/* Close Button */}
            <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10">
                <X className="w-5 h-5 text-gray-400" />
            </button>

            <div className="p-8 pb-12 text-center">

                {!showStaffLinks ? (
                    <>
                        {/* Student Login View */}
                        <div className="relative w-20 h-20 mx-auto mb-6">
                            <div className="absolute inset-0 bg-[#fffbeb] rounded-full animate-ping opacity-75"></div>
                            <div className="relative w-full h-full bg-[#fef3c7] rounded-full flex items-center justify-center border-4 border-[#fffbeb] shadow-inner">
                                <Smartphone className="w-9 h-9 text-yellow-600" />
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Login / Register</h2>
                        <p className="text-slate-500 text-sm mb-8">Enter your registered mobile number</p>

                        <form onSubmit={handleMobileSubmit} className="space-y-6">
                            <div className="flex items-center border border-gray-300 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#5a4bda] focus-within:border-transparent transition-all bg-white shadow-sm hover:shadow-md">
                                <span className="text-slate-500 font-bold border-r border-gray-300 pr-3 mr-3">+91</span>
                                <input
                                    type="tel"
                                    className="flex-1 outline-none text-slate-900 font-semibold placeholder:font-normal placeholder:text-gray-400 text-lg tracking-widest bg-transparent"
                                    placeholder="9876543210"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    maxLength="10"
                                    required
                                    autoFocus
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={mobile.length < 10 || loading}
                                className="w-full bg-[#5a4bda] hover:bg-[#4839c4] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-lg font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                    <>
                                        Get OTP <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <button
                                onClick={() => setShowStaffLinks(true)}
                                className="text-sm font-bold text-slate-600 hover:text-[#5a4bda] flex items-center justify-center gap-2 w-full group transition-colors"
                            >
                                <ShieldCheck className="w-4 h-4 text-gray-400 group-hover:text-[#5a4bda]" />
                                Are you a Staff Member? Login Here
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Staff Portals View */}
                        <div className="relative w-20 h-20 mx-auto mb-6">
                            <div className="absolute inset-0 bg-indigo-50 rounded-full animate-ping opacity-75"></div>
                            <div className="relative w-full h-full bg-indigo-100 rounded-full flex items-center justify-center border-4 border-white shadow-inner">
                                <ShieldCheck className="w-9 h-9 text-[#5a4bda]" />
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Staff Access</h2>
                        <p className="text-slate-500 text-sm mb-6">Select your designated workspace to continue</p>

                        <div className="space-y-3">
                            <a
                                href="https://kapedutech-platform.vercel.app"
                                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-[#5a4bda] text-slate-700 hover:text-white rounded-xl border border-slate-200 hover:border-[#5a4bda] transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg group-hover:text-[#5a4bda] text-slate-500 shadow-sm">
                                        <Laptop className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold">Admin Portal</div>
                                        <div className="text-xs opacity-70">Management & Settings</div>
                                    </div>
                                </div>
                                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                            </a>

                            <a
                                href="https://kapedutech-syllabus-tracker.vercel.app"
                                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-[#5a4bda] text-slate-700 hover:text-white rounded-xl border border-slate-200 hover:border-[#5a4bda] transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg group-hover:text-[#5a4bda] text-slate-500 shadow-sm">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold">Academic Portal</div>
                                        <div className="text-xs opacity-70">Teachers & Syllabus Tracker</div>
                                    </div>
                                </div>
                                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                            </a>

                            <button
                                onClick={() => navigate('/login')}
                                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-[#5a4bda] text-slate-700 hover:text-white rounded-xl border border-slate-200 hover:border-[#5a4bda] transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg group-hover:text-[#5a4bda] text-slate-500 shadow-sm">
                                        <Database className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold">ERP & CRM System</div>
                                        <div className="text-xs opacity-70">Accounts, Admissions & Leads</div>
                                    </div>
                                </div>
                                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                            </button>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <button
                                onClick={() => setShowStaffLinks(false)}
                                className="text-sm font-bold text-slate-600 hover:text-[#5a4bda] flex items-center justify-center gap-2 w-full group transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4 text-gray-400 group-hover:text-[#5a4bda] group-hover:-translate-x-1 transition-transform" />
                                Back to Student Login
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default LoginModal;

