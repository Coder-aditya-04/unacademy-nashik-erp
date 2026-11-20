import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { registerSession } from '../services/sessionService'; // Import Session Service
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, Key, Loader2, ChevronLeft, Check } from 'lucide-react';
import kapLogo from '../assets/kap_logo.png';

const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const pause = (ms) => new Promise(r => setTimeout(r, calm() ? 0 : ms));

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [ok, setOk] = useState(false);
    const navigate = useNavigate();
    const auth = getAuth();
    const db = getFirestore();

    const checkUserProfile = async (uid) => {
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();

                // AUDIT LOG: Record Login
                try {
                    const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
                    await addDoc(collection(db, "login_audit_logs"), {
                        uid: uid,
                        email: userData.email || email, // Fallback to state email
                        name: userData.name || 'Unknown',
                        role: userData.role || 'Unknown',
                        centerId: userData.centerId || 'Unknown',
                        timestamp: serverTimestamp(),
                        userAgent: navigator.userAgent
                    });
                } catch (logErr) {
                    console.error("Failed to log login:", logErr);
                    // Don't block login if logging fails
                }

                // REGISTER SESSION (New Device Tracking)
                try {
                    await registerSession(uid);
                } catch (sessionErr) {
                    console.error("Failed to register session:", sessionErr);
                }

                // Signed in: show the tick for a moment, then open the app.
                setOk(true);
                await pause(650);

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
            setError("Google Sign-In failed: " + err.message);
            setLoading(false);
        }
    };

    const field = 'w-full bg-white border border-[#ECE6DA] text-slate-900 pl-12 pr-4 py-3.5 rounded-2xl outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#2F5D45] focus:shadow-[0_0_0_4px_rgba(47,93,69,.10)] placeholder:text-slate-400 font-medium';
    const tiles = [
        { label: 'Collected today', value: '₹3,19,500', bg: '#DCE8D2', d: 300 },
        { label: 'New admissions', value: '26', bg: '#F8D5C6', d: 420 },
        { label: 'Fees due this week', value: '₹4,82,000', bg: '#F6E7AE', d: 540 },
        { label: 'Calls done', value: '14 of 22', bg: '#D3E0EE', d: 660 },
    ];

    return (
        <div className="kap min-h-screen flex items-stretch p-3 sm:p-4 gap-4">
            {/* Left: brand panel with a calm preview of the app */}
            <aside className="hidden lg:flex flex-col justify-between flex-1 rounded-[32px] p-10 bg-[#E3EBDB] overflow-hidden relative j-page-in">
                <img src={kapLogo} alt="KAP Edutech" className="h-10 w-auto self-start" />
                <div>
                    <h2 className="text-[44px] leading-[1.05] font-extrabold tracking-[-0.03em] text-slate-900 max-w-md">Every fee, call and admission in one calm place.</h2>
                    <div className="grid grid-cols-2 gap-3 mt-8 max-w-md">
                        {tiles.map(t => (
                            <div key={t.label} className="rounded-[22px] p-4 shell-rise" style={{ background: t.bg, animationDelay: `${t.d}ms` }}>
                                <p className="text-[12.5px] font-bold text-slate-800">{t.label}</p>
                                <p className="mt-2 text-[24px] font-extrabold tracking-[-0.02em] text-slate-900">{t.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <p className="text-xs text-slate-600">Unacademy Nashik · Prayaas Education</p>
            </aside>

            {/* Right: sign in */}
            <main className="flex-1 flex flex-col items-center justify-center relative py-16">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="absolute top-2 left-2 sm:top-4 sm:left-4 flex items-center gap-2 px-4 py-2 rounded-full g4-btn text-sm group"
                >
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" />
                    Back to home
                </button>

                <div className="w-full max-w-[400px]">
                    <img src={kapLogo} alt="KAP Edutech" className="lg:hidden h-9 w-auto mb-8 shell-rise" />
                    <h1 className="text-[36px] font-extrabold tracking-[-0.03em] text-slate-900 shell-rise">Welcome back 👋</h1>
                    <p className="mt-1 text-slate-600 shell-rise" style={{ animationDelay: '60ms' }}>Sign in to the KAP staff ERP.</p>

                    {error && (
                        <div role="alert" className="mt-6 bg-[#FCEDE7] text-[#93351F] p-4 rounded-2xl text-sm font-semibold flex items-center gap-3 shell-rise">
                            <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="mt-8 space-y-4">
                        <div className="shell-rise" style={{ animationDelay: '120ms' }}>
                            <label htmlFor="login-email" className="block text-[13px] font-bold text-slate-800 mb-1.5 ml-1">Email address</label>
                            <div className="relative">
                                <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                <input id="login-email" type="email" required autoComplete="username" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@kapedutech.com" />
                            </div>
                        </div>
                        <div className="shell-rise" style={{ animationDelay: '180ms' }}>
                            <label htmlFor="login-password" className="block text-[13px] font-bold text-slate-800 mb-1.5 ml-1">Password</label>
                            <div className="relative">
                                <Key className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                <input id="login-password" type="password" required autoComplete="current-password" className={field} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            aria-live="polite"
                            className={`shell-rise w-full font-bold py-4 rounded-full flex items-center justify-center gap-2 group text-white transition-[background-color,transform,box-shadow] duration-300 active:scale-[0.98] ${ok ? 'bg-[#2F7A4F]' : 'bg-[#1D2A22] hover:bg-[#2A3B31] hover:shadow-[0_10px_24px_rgba(29,42,34,.2)]'}`}
                            style={{ animationDelay: '240ms' }}
                        >
                            {ok ? <span className="j-pop flex items-center gap-2"><Check className="w-5 h-5" aria-hidden="true" /> Signed in</span>
                                : loading ? <Loader2 className="w-5 h-5 animate-spin" aria-label="Signing in" />
                                : <>Sign in <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" /></>}
                        </button>
                    </form>

                    <div className="relative flex py-6 items-center shell-rise" style={{ animationDelay: '300ms' }}>
                        <div className="flex-grow border-t border-[#ECE6DA]"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-semibold">or</span>
                        <div className="flex-grow border-t border-[#ECE6DA]"></div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="shell-rise w-full g4-btn py-3.5 rounded-full flex items-center justify-center gap-3"
                        style={{ animationDelay: '340ms' }}
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
                        Continue with Google
                    </button>

                    <p className="text-center text-slate-500 text-xs mt-10">&copy; {new Date().getFullYear()} KAP Edutech Pvt Ltd · Staff access only</p>
                </div>
            </main>
        </div>
    );
};

export default Login;
