import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Lock, Mail, Key, Loader2, Home, ChevronLeft } from 'lucide-react';

import PublicHome from './PublicHome';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const auth = getAuth();
    const db = getFirestore();

    const checkUserProfile = async (uid) => {
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.verified === false) {
                    navigate('/pending-approval');
                } else {
                    navigate('/staff/dashboard');
                }
            } else {
                navigate('/register-details');
            }
        } catch (err) {
            console.error("Profile check failed:", err);
            setError("Login failed. System error.");
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            await checkUserProfile(userCredential.user.uid);
        } catch (err) {
            console.error("Login Error:", err);
            setError("Invalid credentials. Please contact Administrator.");
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            await checkUserProfile(result.user.uid);
        } catch (err) {
            console.error("Google Login Error:", err);
            setError("Google Sign-In failed. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans selection:bg-blue-500/30">

            {/* BACK TO HOME BUTTON */}
            <button
                onClick={() => navigate('/')}
                className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/10 transition-all hover:scale-105 group"
            >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-bold">Back to Home</span>
            </button>

            {/* 1. AMBIENT BACKGROUND EFFECTS */}
            {/* 1. DYNAMIC BACKGROUND (Blurred Home Page) */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                {/* The Home Page Content */}
                <div className="absolute inset-0 filter blur-[6px] scale-[1.02] opacity-70">
                    <div className="h-full w-full overflow-y-hidden">
                        <PublicHome />
                    </div>
                </div>
                {/* Dark Overlay for Readability */}
                <div className="absolute inset-0 bg-slate-900/60 transition-all duration-500"></div>

                {/* Optional Subtle Blobs on top of the blur for depth */}
                <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-overlay animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-overlay animate-pulse delay-1000"></div>
            </div>

            {/* 2. MAIN CARD */}
            <div className="relative z-10 w-full max-w-md p-6">
                <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-500">

                    {/* Header Section */}
                    <div className="p-8 text-center border-b border-white/5 bg-white/5">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg shadow-blue-900/50 mb-6 group hover:scale-110 transition-transform duration-300">
                            <ShieldCheck className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Staff Portal</h1>
                        <p className="text-slate-400 text-sm font-medium">Secure Access for KAP Edutech</p>
                    </div>

                    {/* Form Section */}
                    <div className="p-8 space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-bold flex items-center gap-3 animate-in slide-in-from-top-2">
                                <div className="p-1 bg-red-500/20 rounded-full"><Lock className="w-3 h-3" /></div>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-1 group">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 group-focus-within:text-blue-400 transition-colors">Email Address</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        className="w-full bg-slate-900/50 border border-slate-700 text-white pl-12 pr-4 py-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600 font-medium"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="admin@kap.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1 group">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 group-focus-within:text-blue-400 transition-colors">Password</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors">
                                        <Key className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        className="w-full bg-slate-900/50 border border-slate-700 text-white pl-12 pr-4 py-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600 font-medium"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50 flex items-center justify-center gap-2 group transform active:scale-[0.98]"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Sign In <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
                            </button>
                        </form>

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-white/10"></div>
                            <span className="flex-shrink-0 mx-4 text-slate-500 text-[10px] uppercase font-bold tracking-widest">Or Continue With</span>
                            <div className="flex-grow border-t border-white/10"></div>
                        </div>

                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full bg-white text-slate-800 font-bold py-3.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-3 relative overflow-hidden group border-2 border-transparent hover:border-blue-100"
                        >
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                            <span className="group-hover:text-blue-700 transition-colors">Google Account</span>
                        </button>
                    </div>

                    {/* Footer Section */}
                    <div className="py-4 bg-slate-950/30 text-center border-t border-white/5">
                        <p className="text-slate-500 text-xs">
                            Secure System v1.3 &bull; <span className="text-slate-400">Restricted Access</span>
                        </p>
                    </div>
                </div>

                <p className="text-center text-slate-600 text-xs mt-8 font-medium">
                    &copy; {new Date().getFullYear()} KAP Edutech Pvt Ltd.
                </p>
            </div>
        </div>
    );
};

export default Login;
