import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { registerSession } from '../services/sessionService'; // Import Session Service
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ArrowRight, Lock, Mail, Key, Loader2, ChevronLeft, Check } from 'lucide-react';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import KapLogo from '../components/KapLogo';
import photo from '../assets/gen_prog_found.webp';

const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const inApp = () => Capacitor.isNativePlatform();
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

    const field = 'w-full bg-white border border-[#E3E6F0] text-[#14172B] pl-12 pr-4 py-3.5 rounded-2xl outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#2B59FF] focus:shadow-[0_0_0_4px_rgba(43,89,255,.14)] placeholder:text-slate-400 font-medium';
    return (
        <div className="kap ax-login relative min-h-[100svh] flex flex-col lg:flex-row items-stretch lg:p-4 lg:gap-4 overflow-hidden">
            <style>{`
                .ax-login { font-family: 'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif; color: #14172B; background: #fff; }
                .ax-login h1, .ax-login h2 { letter-spacing: -0.035em; font-weight: 800; }
                .ax-blob { position:absolute; border-radius:50%; filter: blur(70px); opacity:.55; pointer-events:none; animation: axDrift 9s ease-in-out infinite alternate; }
                @keyframes axDrift { to { transform: translate(24px, 18px); } }
                .ax-float { position:absolute; background:#fff; border-radius:18px; padding:10px 14px 10px 10px; box-shadow: 0 20px 40px -18px rgba(20,23,43,.3); display:flex; gap:10px; align-items:center; animation: axPop .7s cubic-bezier(.34,1.56,.64,1) both, axBob 3s ease-in-out 1s infinite alternate; }
                .ax-ic { width:40px; height:40px; border-radius:12px; display:inline-flex; align-items:center; justify-content:center; font-size:18px; }
                @keyframes axPop { from { opacity:0; transform: scale(.6) translateY(16px); } }
                @keyframes axBob { to { transform: translateY(-7px); } }
                .ax-mark { background: linear-gradient(transparent 62%, #FFE27A 62%); padding: 0 4px; }
                @media (prefers-reduced-motion: reduce) { .ax-blob, .ax-float { animation: none; } }
            `}</style>
            <span className="ax-blob" style={{ width: 460, height: 460, background: '#BFD3FF', right: -160, top: -160 }} aria-hidden="true" />
            <span className="ax-blob" style={{ width: 340, height: 340, background: '#C8F2DF', left: -140, bottom: -120 }} aria-hidden="true" />

            {/* Desktop: a bright panel with a classroom photo and floating badges */}
            <aside className="hidden lg:flex flex-col justify-between flex-1 rounded-[32px] p-10 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #EAF0FF 0%, #F3EEFF 50%, #FFF1E6 100%)' }}>
                <div className="relative flex items-center justify-between">
                    <KapLogo tone="dark" className="h-10 w-auto" />
                    <span className="text-[13px] font-bold px-3.5 py-1.5 rounded-full" style={{ background: '#fff', color: '#2B59FF' }}>Staff ERP</span>
                </div>
                <div className="relative mx-auto w-full max-w-[520px] my-8">
                    <div className="rounded-[28px] overflow-hidden aspect-[4/3]" style={{ boxShadow: '0 30px 60px -30px rgba(43,60,140,.45)' }}><img src={photo} alt="" className="w-full h-full object-cover" /></div>
                    <div className="ax-float" style={{ left: -24, top: 28, animationDelay: '.3s, 1.3s' }}><span className="ax-ic" style={{ background: '#EAF0FF' }}>📅</span><span><b className="block text-[14px]">Plan my day</b><span className="text-[12px] text-[#596080]">Calls, visits, follow-ups</span></span></div>
                    <div className="ax-float" style={{ right: -20, top: '48%', animationDelay: '.45s, 1.6s' }}><span className="ax-ic" style={{ background: '#FFEDEA' }}>📞</span><span><b className="block text-[14px]">Call from your SIM</b><span className="text-[12px] text-[#596080]">Recorded to the lead</span></span></div>
                    <div className="ax-float" style={{ left: 30, bottom: -22, animationDelay: '.6s, 1.9s' }}><span className="ax-ic" style={{ background: '#EAF8F1' }}>🧾</span><span><b className="block text-[14px]">Fees and receipts</b><span className="text-[12px] text-[#596080]">For every student</span></span></div>
                </div>
                <div className="relative shell-rise">
                    <h2 className="text-[44px] leading-[1.05] max-w-lg">The staff room of Nashik's <span className="ax-mark">toppers.</span></h2>
                    <p className="text-[15px] mt-3 text-[#596080]">Unacademy Centres · Prayaas · KAP Edutech</p>
                </div>
            </aside>

            {/* Phones and the app: logo bar, then the form */}
            <div className="lg:hidden relative flex items-center justify-between px-5" style={{ paddingTop: 'max(18px, env(safe-area-inset-top))' }}>
                <KapLogo tone="dark" className="h-9 w-auto" />
                {!inApp() && (
                    <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-semibold bg-white" style={{ boxShadow: 'inset 0 0 0 1.5px #D9DCEB' }}>
                        <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Home
                    </button>
                )}
            </div>
            <div className="lg:hidden relative px-5 mt-5">
                <div className="relative rounded-[24px] overflow-hidden h-[24svh] min-h-[150px]" style={{ boxShadow: '0 24px 48px -28px rgba(43,60,140,.5)' }}>
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="ax-float" style={{ left: 8, bottom: -18, animationDelay: '.3s, 1.3s' }}><span className="ax-ic" style={{ background: '#EAF0FF' }}>📅</span><span><b className="block text-[13px]">Plan my day</b><span className="text-[11.5px] text-[#596080]">Calls, visits, follow-ups</span></span></div>
            </div>

            <main className="flex-1 lg:flex-none lg:w-[min(560px,46%)] flex flex-col items-center lg:justify-center relative z-10 pt-10 pb-10 lg:py-16 px-5 lg:rounded-[32px]">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="hidden lg:flex absolute top-4 left-4 items-center gap-2 px-4 py-2 rounded-full bg-white text-sm font-semibold group"
                    style={{ boxShadow: 'inset 0 0 0 1.5px #D9DCEB' }}
                >
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" />
                    Back to home
                </button>

                <div className="w-full max-w-[400px]">
                    <h1 className="text-[34px] sm:text-[44px] leading-none shell-rise">Welcome back 👋</h1>
                    <p className="mt-2 text-[#596080] shell-rise" style={{ animationDelay: '60ms' }}>Sign in to the KAP staff ERP.</p>

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
                            className={`shell-rise w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2 group text-white transition-[background-color,transform,box-shadow] duration-300 active:scale-[0.98] ${ok ? 'bg-[#067A52]' : 'bg-[#2B59FF] hover:bg-[#1E45D9] shadow-[0_14px_30px_-12px_rgba(43,89,255,.6)]'}`}
                            style={{ animationDelay: '240ms' }}
                        >
                            {ok ? <span className="j-pop flex items-center gap-2"><Check className="w-5 h-5" aria-hidden="true" /> Signed in</span>
                                : loading ? <Loader2 className="w-5 h-5 animate-spin" aria-label="Signing in" />
                                : <>Sign in <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" /></>}
                        </button>
                    </form>

                    <div className="relative flex py-6 items-center shell-rise" style={{ animationDelay: '300ms' }}>
                        <div className="flex-grow border-t border-[#ECEEF6]"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-semibold">or</span>
                        <div className="flex-grow border-t border-[#ECEEF6]"></div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="shell-rise w-full bg-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-3 transition-colors hover:bg-[#F7F8FC]"
                        
                        style={{ animationDelay: '340ms', boxShadow: 'inset 0 0 0 1.5px #D9DCEB' }}
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
