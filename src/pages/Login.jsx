import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Lock } from 'lucide-react';
import classroomImg from '../assets/classroom.png';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const auth = getAuth();
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/staff/dashboard');
        } catch (err) {
            setError("Invalid credentials. Please contact Administrator.");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex bg-white">

            {/* Left: Image Section */}
            <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative justify-center items-center overflow-hidden">
                <img src={classroomImg} alt="Background" className="absolute inset-0 w-full h-full object-cover opacity-20" />
                <div className="relative z-10 p-12 text-white max-w-lg">
                    <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-blue-900/50">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <h1 className="text-5xl font-extrabold mb-6 leading-tight">Secure Staff Portal</h1>
                    <p className="text-lg text-slate-300 leading-relaxed">
                        Manage admissions, generate quotes, and track leads efficiently.
                        Authorized access for KAP Edutech personnel only.
                    </p>
                </div>
            </div>

            {/* Right: Form Section */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
                <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-gray-100">

                    <div className="text-center mb-10">
                        <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
                        <p className="text-gray-500 mt-2 text-sm">Please sign in to your account</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
                                <Lock className="w-4 h-4" /> {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Email Address</label>
                            <input
                                type="email"
                                required
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition font-medium"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="staff@kap.com"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Password</label>
                            <input
                                type="password"
                                required
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition font-medium"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-xl transition shadow-lg flex items-center justify-center gap-2 group"
                        >
                            {loading ? "Verifying..." : "Sign In"}
                            {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-gray-100 text-center">
                        <div className="mt-8 text-center">
                            <p className="text-gray-500 text-xs">
                                &copy; {new Date().getFullYear()} KAP Edutech Pvt Ltd. All rights reserved. <br />
                                <span className="opacity-50">System Version 1.1 (Live)</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
