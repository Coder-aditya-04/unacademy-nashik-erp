import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { registerSession } from '../services/sessionService'; // Import Session Service
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, Key, Loader2, ChevronLeft, Check } from 'lucide-react';
import kapLogo from '../assets/kap_logo.png';
import heroImg from '../assets/hero_faculty_group_v2.webp';
import classImg from '../assets/hero_teacher_board.webp';

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
    return (
        <div className="kap bk-login min-h-screen flex items-stretch p-3 sm:p-4 gap-4" style={{ background: '#EDE5D6' }}>
            <style>{`
                .bk-login { --ink:#14201A; }
                .bk-serif { font-family: Fraunces, Georgia, 'Times New Roman', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
                .bk-login main input { background: #FBF8F2 !important; border-color: #DCCFB6 !important; }
            `}</style>
            {/* Left: the book cover */}
            <aside className="hidden lg:flex flex-col justify-between flex-1 rounded-[6px_22px_22px_6px] p-10 overflow-hidden relative j-page-in" style={{ background: '#0E4A36', color: '#F5F0E6', boxShadow: '0 40px 80px -40px rgba(11,59,43,.7)' }}>
                <div className="absolute inset-y-0 left-0 w-8" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,.28), rgba(0,0,0,0))' }} aria-hidden="true" />
                <div className="relative flex items-center justify-between">
                    <span className="rounded-lg bg-white px-2 py-1"><img src={kapLogo} alt="KAP Edutech" className="h-8 w-auto" /></span>
                    <span className="text-[11.5px] font-bold tracking-[.14em] uppercase" style={{ color: '#C49A45' }}>Staff edition</span>
                </div>
                <div className="relative flex-1 flex items-center justify-center py-8">
                    <div className="relative w-full max-w-[420px]">
                        <div className="absolute -right-4 top-6 w-[62%] aspect-[4/5] rounded overflow-hidden rotate-[4deg] shell-rise" style={{ boxShadow: '0 0 0 6px #F5F0E6, 0 24px 40px -18px rgba(0,0,0,.55)', animationDelay: '160ms' }}>
                            <img src={classImg} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="relative w-[78%] aspect-[4/3] rounded overflow-hidden -rotate-[2deg] shell-rise" style={{ boxShadow: '0 0 0 6px #F5F0E6, 0 24px 40px -18px rgba(0,0,0,.55)' }}>
                            <img src={heroImg} alt="" className="w-full h-full object-cover" />
                        </div>
                    </div>
                </div>
                <div className="relative">
                    <h2 className="bk-serif text-[46px] leading-[1] font-semibold max-w-md">The staff room <em className="font-normal" style={{ color: '#C49A45' }}>of every topper's story.</em></h2>
                    <p className="text-[14px] mt-4" style={{ color: 'rgba(245,240,230,.7)' }}>Unacademy Nashik · Prayaas · KAP Edutech</p>
                </div>
            </aside>

            <main className="flex-1 flex flex-col items-center justify-center relative py-16 px-4 rounded-[6px_22px_22px_6px]" style={{ background: '#F5F0E6', boxShadow: '0 30px 60px -30px rgba(20,32,26,.25)' }}>
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
                    <h1 className="bk-serif text-[44px] leading-none font-semibold text-slate-900 shell-rise">Welcome <em className="font-normal" style={{ color: '#0E4A36' }}>back.</em></h1>
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
                            className={`shell-rise w-full font-bold py-4 rounded-full flex items-center justify-center gap-2 group text-white transition-[background-color,transform,box-shadow] duration-300 active:scale-[0.98] ${ok ? 'bg-[#2F7A4F]' : 'bg-[#0E4A36] hover:bg-[#0B3B2B] hover:shadow-[0_10px_24px_rgba(29,42,34,.2)]'}`}
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
