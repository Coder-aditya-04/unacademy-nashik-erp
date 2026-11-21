import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { MapPin, LogOut, Menu, X, MessageSquare, Plus, Trash2, Check, UserCircle2, ArrowRight } from 'lucide-react';
import { CENTERS } from '../../utils/centers';
import { navFor, titleFor, normaliseRole, ROLE_LABEL } from '../../utils/navItems';
import { AcademicYearPicker } from '../AcademicYear';
import { ThemeProvider, ThemeSwitch, ToastProvider } from '../j';
import { useTheme } from '../j/context';
import kapLogo from '../../assets/kap_logo.png';

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'U';

// Sidebar. A white pill slides to the active page: the leading edge moves
// first and the trailing edge catches up, as in the J design.
const Sidebar = ({ groups, onNavigate, center, fold = false, onFold }) => {
    const { pathname } = useLocation();
    const box = useRef(null);
    const [pill, setPill] = useState(null);
    useLayoutEffect(() => {
        const measure = () => {
        const el = box.current?.querySelector('a[aria-current="page"]');
        if (!el) { setPill(null); return; }
        const b = box.current.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const top = r.top - b.top + box.current.scrollTop;
        const bottom = box.current.scrollHeight - top - r.height;
        setPill(prev => (prev && prev.top === top && prev.bottom === bottom ? prev : { top, bottom, down: prev ? top > prev.top : true, first: !prev }));
        };
        measure();
        // Web fonts can shift the list after the first paint: measure again.
        document.fonts?.ready?.then(measure);
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [pathname, groups, fold]);
    const transition = !pill || pill.first ? 'none'
        : pill.down ? 'bottom var(--fast), top var(--slow)' : 'top var(--fast), bottom var(--slow)';
    return (
    <nav aria-label="Main" className={`flex flex-col h-full ${fold ? 'jb-fold' : 'jb-unfold'}`}>
        <div className={`pt-5 pb-2 shrink-0 ${fold ? 'px-2' : 'px-4'}`}>
          <div className={`flex items-center gap-3 ${fold ? 'flex-col px-0' : 'px-2'}`}>
            <span className="jb-fade inline-flex"><img src={kapLogo} alt="KAP Edutech" className="h-8 w-auto max-w-none" /></span>
            {onFold && (
                <button type="button" onClick={onFold} aria-expanded={!fold} aria-label={fold ? 'Show menu' : 'Hide menu'} title={`${fold ? 'Show' : 'Hide'} menu ( [ )`}
                    className="ml-auto shrink-0 w-8 h-8 rounded-[10px] flex items-center justify-center text-[15px] font-extrabold shadow-[0_2px_6px_rgba(29,42,34,.08)]"
                    style={{ background: 'var(--panel)', color: 'var(--ink)', transform: fold ? 'rotate(180deg)' : 'none', transition: 'transform .45s cubic-bezier(.65,0,.35,1)', marginLeft: fold ? 0 : undefined }}>
                    ‹
                </button>
            )}
          </div>
        </div>
        <div ref={box} className="relative flex-1 overflow-y-auto py-4 px-3 space-y-5">
            {pill && <span aria-hidden="true" className="j-navpill !m-0" style={{ top: pill.top, bottom: pill.bottom, left: 12, right: 12, transition }} />}
            {groups.map((g, gi) => (
                <div key={g.label || gi} className="relative z-[1]">
                    {g.label && (fold ? <hr className="mx-3 mb-2 border-[var(--sage2)]" /> : <p className="kap-eyebrow px-3 mb-2 !text-slate-600">{g.label}</p>)}
                    <ul className="space-y-1">
                        {g.items.map(item => (
                            <li key={item.to}>
                                <NavLink
                                    to={item.to}
                                    end={item.to === '/staff/dashboard'}
                                    onClick={onNavigate}
                                    title={fold ? item.label : undefined}
                                    aria-label={fold ? item.label : undefined}
                                    className={({ isActive }) => `group relative flex items-center gap-3 ${fold ? 'justify-center px-0' : 'px-2'} min-h-[44px] rounded-full text-[14.5px] transition-colors duration-200 ${isActive ? 'font-bold text-slate-900' : 'font-medium text-slate-700 hover:bg-white/45'}`}
                                >
                                    {({ isActive }) => (
                                        <>
                                            <span aria-hidden="true" className={`w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${isActive ? 'g4-tile-on' : 'text-slate-800'}`}>
                                                <item.icon className="w-4 h-4" />
                                            </span>
                                            <span className="jb-fade truncate">{item.label}</span>
                                        </>
                                    )}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
        <p className="jb-fade px-5 py-3 text-[11px] text-slate-600">KAP Edutech Pvt. Ltd.</p>
    </nav>
    );
};

// Phone bottom bar (P1): four main places for the role, a marker slides under the active one.
const TABS = {
    DIRECTOR: [['/staff/dashboard', '🏠', 'Home'], ['/staff/leads', '🎓', 'Admissions'], ['/staff/accounts', '🧾', 'Accounts'], ['/staff/student-records', '👥', 'Students']],
    MANAGER: [['/staff/dashboard', '🏠', 'Home'], ['/staff/leads', '🎓', 'Admissions'], ['/staff/recovery-desk', '📞', 'Recovery'], ['/staff/student-records', '👥', 'Students']],
    ACCOUNTANT: [['/staff/dashboard', '🏠', 'Home'], ['/staff/accounts', '🧾', 'Accounts'], ['/staff/recovery', '⏰', 'Dues'], ['/staff/take-admission', '➕', 'Admit']],
    COUNSELLOR: [['/staff/dashboard', '🏠', 'Home'], ['/staff/leads', '🎓', 'Leads'], ['/staff/calculator', '🧮', 'Quote'], ['/staff/my-admissions', '📁', 'Mine']],
    RECOVERY: [['/staff/dashboard', '📞', 'Calls']],
    TELECALLER: [['/staff/tele/queue', '🎧', 'Queue'], ['/staff/my-day', '📅', 'My day']],
    BDE: [['/staff/leads', '🎓', 'Leads'], ['/staff/calculator', '🧮', 'Quote']],
    FRONT_DESK: [['/staff/front-desk', '🛎️', 'Desk'], ['/staff/calculator', '🧮', 'Quote'], ['/staff/token', '🎫', 'Token']],
};
const TabBar = ({ role }) => {
    const { pathname } = useLocation();
    const tabs = TABS[role] || [];
    const bar = useRef(null);
    const [mark, setMark] = useState(null);
    const active = tabs.reduce((best, t, i) => ((pathname === t[0] || pathname.startsWith(t[0] + '/')) && (best < 0 || t[0].length > tabs[best][0].length) ? i : best), -1);
    useLayoutEffect(() => {
        const el = active >= 0 ? bar.current?.querySelectorAll('a')[active] : null;
        setMark(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    }, [active, tabs.length]);
    if (tabs.length < 2) return null;
    return (
        <nav ref={bar} aria-label="Quick" className="jb-tabbar lg:hidden">
            {mark && <span aria-hidden="true" className="jb-mark" style={mark} />}
            {tabs.map(([to, e, label], i) => (
                <Link key={to} to={to} aria-current={i === active ? 'page' : undefined}>
                    <span aria-hidden="true" className="text-[18px] leading-none">{e}</span>{label}
                </Link>
            ))}
        </nav>
    );
};

const FOLD_KEY = 'kap-side-fold';
const readFold = () => { try { return localStorage.getItem(FOLD_KEY) === '1'; } catch { return false; } };

const ShellInner = ({ children, userProfile, handleLogout, currentCenter, setCurrentCenter }) => {
    const role = normaliseRole(userProfile?.role);
    const { theme } = useTheme();
    const [fold, setFold] = useState(readFold);
    const toggleFold = () => setFold(f => { try { localStorage.setItem(FOLD_KEY, f ? '0' : '1'); } catch { /* storage blocked */ } return !f; });
    // "[" hides or shows the menu, unless the person is typing.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return;
            const t = e.target;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            toggleFold();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    const isDirector = role === 'DIRECTOR';
    const groups = useMemo(() => navFor(role), [role]);
    const { pathname } = useLocation();
    const [drawer, setDrawer] = useState(false);
    const [msgTip, setMsgTip] = useState(false);

    useEffect(() => { setDrawer(false); }, [pathname]);

    return (
        <div className={`kap min-h-screen ${fold ? 'lg:pl-[104px]' : 'lg:pl-64'} pb-24 lg:pb-0`} data-theme={theme} style={{ transition: 'padding-left .45s cubic-bezier(.65,0,.35,1), background-color .5s ease' }}>
            <div className="kap-wash" aria-hidden="true" />
            {/* Desktop sidebar: folds into an icon rail with the ‹ button or the [ key */}
            <aside className="jb-side hidden lg:block fixed top-3 bottom-3 left-3 kap-bar rounded-[28px] overflow-hidden z-40" style={{ width: fold ? 84 : 236 }}>
                <Sidebar groups={groups} center={currentCenter} fold={fold} onFold={toggleFold} />
            </aside>

            {/* Phone / tablet drawer */}
            {drawer && (
                <div className="lg:hidden fixed inset-0 z-[60]">
                    <button type="button" className="absolute inset-0 bg-slate-900/50 shell-fade" aria-label="Close menu" onClick={() => setDrawer(false)} />
                    <aside className="relative w-72 max-w-[85%] h-full kap-bar shadow-[0_26px_60px_rgba(15,31,77,.22)] shell-slide-left">
                        <Sidebar groups={groups} center={currentCenter} onNavigate={() => setDrawer(false)} />
                    </aside>
                </div>
            )}

            <header className="sticky top-0 z-30 g4-head">
                <div className="h-[68px] px-4 sm:px-6 flex items-center gap-2.5">
                    <button type="button" className="lg:hidden g4-btn p-2 rounded-lg" onClick={() => setDrawer(true)} aria-label="Open menu">
                        <Menu className="w-5 h-5" />
                    </button>
                    <img src={kapLogo} alt="KAP Edutech" className="lg:hidden h-7 w-auto shrink-0" />
                    <div className="flex-1 sm:hidden" />
                    <div className="min-w-0 flex-1 hidden sm:block lg:pl-0 pl-2.5 lg:border-0 border-l border-slate-200/80">
                        <h1 className="kap-title text-[19px] sm:text-[22px] text-slate-900 truncate">{titleFor(pathname)}</h1>
                        <p className="text-[12px] italic text-slate-500 truncate hidden sm:block">{currentCenter?.name}</p>
                    </div>

                    {isDirector ? (
                        <label className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg g4-btn text-xs">
                            <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
                            <span className="sr-only">Centre</span>
                            <select value={currentCenter.id} onChange={(e) => setCurrentCenter(CENTERS[e.target.value])} className="bg-transparent outline-none cursor-pointer">
                                <option value="UN_COLLEGE">College Road</option>
                                <option value="UN_NASHIK_RD">Nashik Road</option>
                                <option value="PRAYAS">Prayaas</option>
                            </select>
                        </label>
                    ) : (
                        <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg g4-well text-xs font-bold text-slate-700">
                            <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> {currentCenter?.brand === 'PRAYAS' ? 'Prayaas' : (currentCenter?.id === 'UN_NASHIK_RD' ? 'Nashik Road' : 'College Road')}
                        </span>
                    )}
                    <AcademicYearPicker className="hidden md:flex" />
                    <ThemeSwitch className="hidden sm:inline-flex" />

                    <Link to="/staff/my-day" aria-current={pathname.startsWith('/staff/my-day') ? 'page' : undefined} className="g4-btn inline-flex items-center gap-2 px-3.5 min-h-[40px] rounded-[10px] text-[14px]">
                        <span aria-hidden="true">📅</span> <span className="hidden sm:inline">My day</span>
                    </Link>
                    <div className="relative">
                        <button type="button" onClick={() => setMsgTip(v => !v)} className="g4-btn w-10 h-10 rounded-[10px] flex items-center justify-center text-slate-700" aria-label="Messages" aria-expanded={msgTip}>
                            <MessageSquare className="w-5 h-5" />
                        </button>
                        {msgTip && (
                            <div className="absolute right-0 mt-2 w-64 p-4 rounded-xl kap-glass text-sm text-slate-600 shell-fade" role="status">
                                <p className="font-semibold text-slate-900 mb-1">Staff messages</p>
                                Chat with your team here. This arrives in the next update.
                            </div>
                        )}
                    </div>
                    <Link to="/staff/profile" className="hidden sm:flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-white/60" title="Account settings">
                        <span className="text-right leading-tight hidden xl:block">
                            <span className="block text-sm font-semibold text-slate-800">{userProfile?.name}</span>
                            <span className="block text-[11px] text-slate-500">{ROLE_LABEL[role] || role}</span>
                        </span>
                        <span className="w-9 h-9 rounded-full bg-[#D3E0EE] text-slate-900 text-xs font-bold flex items-center justify-center" aria-hidden="true">
                            {initials(userProfile?.name)}
                        </span>
                    </Link>
                    <Link to="/staff/profile" className="sm:hidden g4-btn p-2 rounded-lg" aria-label="Account settings"><UserCircle2 className="w-5 h-5" /></Link>
                    <button type="button" onClick={handleLogout} className="g4-btn p-2 rounded-lg text-slate-600 hover:text-rose-700" aria-label="Log out" title="Log out">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
                {/* Centre and year on small screens */}
                <div className="md:hidden px-4 pb-3 flex gap-2">
                    {isDirector && (
                        <select aria-label="Centre" value={currentCenter.id} onChange={(e) => setCurrentCenter(CENTERS[e.target.value])} className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white">
                            <option value="UN_COLLEGE">College Road</option>
                            <option value="UN_NASHIK_RD">Nashik Road</option>
                            <option value="PRAYAS">Prayaas</option>
                        </select>
                    )}
                    <AcademicYearPicker className="flex-1" />
                </div>
            </header>

            <main key={pathname} className="relative z-[1] px-4 sm:px-6 py-6 max-w-[1320px] mx-auto">
                {/* Page change: blank shapes shimmer, then the new page fills in. */}
                <div aria-hidden="true" className="j-sk-wrap absolute inset-x-4 sm:inset-x-6 top-6 flex flex-col gap-4">
                    <div className="j-sk h-10 w-2/5" />
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><div className="j-sk h-28" /><div className="j-sk h-28" /><div className="j-sk h-28" /><div className="j-sk h-28" /></div>
                    <div className="j-sk h-72" />
                </div>
                <div className="j-page-in" style={{ animationDelay: '200ms' }}>
                    {children}
                </div>
            </main>

            <TabBar role={role} />
        </div>
    );
};

const StaffShell = (props) => (
    <ThemeProvider>
        <ToastProvider>
            <ShellInner {...props} />
        </ToastProvider>
    </ThemeProvider>
);

export default StaffShell;
