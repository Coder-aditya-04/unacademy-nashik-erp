import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { registerSession } from '../services/sessionService'; // Import Session Service
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ArrowRight, Lock, Mail, Key, Loader2, ChevronLeft, Check } from 'lucide-react';
import '@fontsource/anton/latin-400.css';
import '@fontsource-variable/inter-tight/wght.css';
import KapLogo from '../components/KapLogo';
import heroBg from '../assets/unacademy_center_nashik.webp';
import heroCut from '../assets/hero_nashik_road_cut.webp';

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

    const field = 'w-full bg-white border border-[#E3DFD6] text-[#07130F] pl-12 pr-4 py-3.5 rounded-2xl outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#08BD80] focus:shadow-[0_0_0_4px_rgba(8,189,128,.14)] placeholder:text-slate-400 font-medium';
    return (
        <div className="kap hx-login min-h-[100svh] flex flex-col lg:flex-row items-stretch lg:p-4 lg:gap-4" style={{ background: '#F5F3EE' }}>
            <style>{`
                .hx-login { font-family: 'Inter Tight Variable', 'Inter Tight', 'Plus Jakarta Sans', system-ui, sans-serif; color: #07130F; }
                .hx-login h1, .hx-login h2 { letter-spacing: -0.035em; }
                /* Same scene as the home page hero, sized to this panel. */
                .hx-side { container-type: size; }
                .hx-side .scene { --sw: max(100cqw, 133.2cqh); --sh: calc(var(--sw) * .751); --roof: calc(var(--sh) * .246); --fs: clamp(64px, min(30cqw, calc(var(--sw) * .16)), 260px);
                                  position:absolute; top:0; left:50%; width: var(--sw); height: var(--sh); margin-left: calc(var(--sw) / -2); }
                .hx-band .scene { --sw: max(100cqw, 260cqh); --fs: clamp(60px, 22cqw, 150px); }
                .hx-side .scene img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter: brightness(.66) saturate(1.05) contrast(1.05); }
                .hx-side .giant { position:absolute; left:0; right:0; top: calc(var(--roof) - var(--fs) * .78); text-align:center; font-family: Anton, sans-serif; font-size: var(--fs); line-height:.9; color:#fff; overflow:hidden; white-space:nowrap; padding-top:.04em; }
                .hx-side .giant span { display:inline-block; animation: hxUp 1.2s cubic-bezier(.16,1,.3,1) both; }
                @keyframes hxUp { from { transform: translateY(105%); } to { transform: none; } }
                @media (prefers-reduced-motion: reduce) { .hx-side .giant span { animation: none; } }
            `}</style>
            {/* Left: the home page hero, in a panel */}
            <aside className="hx-side hidden lg:flex flex-col justify-between flex-1 rounded-[28px] p-10 overflow-hidden relative" style={{ background: '#07130F', color: '#fff' }}>
                <div className="scene" aria-hidden="true">
                    <img src={heroBg} alt="" />
                    <div className="giant">{'NASHIK'.split('').map((c, i) => <span key={i} style={{ animationDelay: `${i * 70}ms` }}>{c}</span>)}</div>
                    <img src={heroCut} alt="" />
                </div>
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(7,19,15,.45) 0%, rgba(7,19,15,0) 22%, rgba(7,19,15,.15) 45%, rgba(7,19,15,.85) 80%, rgba(7,19,15,.96) 100%)' }} aria-hidden="true" />
                <div className="relative flex items-center justify-between">
                    <KapLogo tone="light" className="h-9 w-auto" />
                    <span className="text-[12px] font-bold tracking-[.16em] uppercase" style={{ color: '#08BD80' }}>Staff ERP</span>
                </div>
                <div className="relative shell-rise">
                    <h2 className="text-[52px] leading-[0.98] font-bold max-w-lg">The staff room of Nashik's toppers.</h2>
                    <p className="text-[15px] mt-4" style={{ color: 'rgba(255,255,255,.72)' }}>Unacademy Centres · Prayaas · KAP Edutech</p>
                </div>
            </aside>

            {/* Phones and the app: the same scene as a band on top, the form as a sheet under it. */}
            <div className="hx-side hx-band lg:hidden relative h-[36svh] min-h-[230px] overflow-hidden" style={{ background: '#07130F', color: '#fff' }}>
                <div className="scene" aria-hidden="true">
                    <img src={heroBg} alt="" />
                    <div className="giant">{'NASHIK'.split('').map((c, i) => <span key={i} style={{ animationDelay: `${i * 70}ms` }}>{c}</span>)}</div>
                    <img src={heroCut} alt="" />
                </div>
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(7,19,15,.5) 0%, rgba(7,19,15,0) 35%, rgba(7,19,15,.75) 100%)' }} aria-hidden="true" />
                <div className="relative flex items-center justify-between px-5" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
                    <KapLogo tone="light" className="h-8 w-auto" />
                    {!inApp() && (
                        <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(8px)' }}>
                            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Home
                        </button>
                    )}
                </div>
            </div>

            <main className="flex-1 lg:flex-none lg:w-[min(560px,46%)] flex flex-col items-center lg:justify-center relative z-10 -mt-7 lg:mt-0 pt-9 pb-10 lg:py-16 px-5 rounded-t-[28px] lg:rounded-[28px]" style={{ background: '#fff', boxShadow: '0 0 0 1px #E3DFD6' }}>
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="hidden lg:flex absolute top-4 left-4 items-center gap-2 px-4 py-2 rounded-full g4-btn text-sm group"
                >
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" />
                    Back to home
                </button>

                <div className="w-full max-w-[400px]">
                    <h1 className="text-[36px] sm:text-[44px] leading-none font-bold shell-rise">Welcome back.</h1>
                    <p className="mt-2 text-[#5B6761] shell-rise" style={{ animationDelay: '60ms' }}>Sign in to the KAP staff ERP.</p>

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
                            className={`shell-rise w-full font-bold py-4 rounded-full flex items-center justify-center gap-2 group text-white transition-[background-color,transform,box-shadow] duration-300 active:scale-[0.98] ${ok ? 'bg-[#2F7A4F]' : 'bg-[#07130F] hover:bg-[#1A2E26] hover:shadow-[0_10px_24px_rgba(7,19,15,.22)]'}`}
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
