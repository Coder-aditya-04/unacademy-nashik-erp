import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { MapPin, LogOut, Menu, X, MessageSquare, Plus, Trash2, Check, UserCircle2, ArrowRight } from 'lucide-react';
import { CENTERS } from '../../utils/centers';
import { navFor, titleFor, normaliseRole, ROLE_LABEL } from '../../utils/navItems';
import { AcademicYearPicker } from '../AcademicYear';
import { ThemeProvider, ThemeSwitch, ToastProvider } from '../j';
import { useTheme } from '../j/context';
import kapLogo from '../../assets/kap_logo.png';
import GlobalSearch from './GlobalSearch';
import { readRecent, RECENT_EVENT } from '../../utils/recent';

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'U';

// Sidebar. A white pill slides to the active page: the leading edge moves
// first and the trailing edge catches up, as in the J design.
const ROLE_SHORT = { DIRECTOR: 'Director', MANAGER: 'Manager', ACCOUNTANT: 'Accounts', COUNSELLOR: 'Counsellor', FRONT_DESK: 'Front desk', BDE: 'BDE', RECOVERY: 'Recovery', TELECALLER: 'Telecaller' };
const RECENT_TONES = ['var(--t-lilac)', 'var(--t-coral)', 'var(--t-butter)'];
const initialsOf = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';

const Sidebar = ({ groups, onNavigate, center, fold = false, onFold, role }) => {
    const { pathname } = useLocation();
    const [recent, setRecent] = useState(readRecent);
    useEffect(() => {
        const on = () => setRecent(readRecent());
        window.addEventListener(RECENT_EVENT, on);
        return () => window.removeEventListener(RECENT_EVENT, on);
    }, []);
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
          <div className={`flex items-center gap-2.5 ${fold ? 'justify-center' : 'px-1'}`}>
            <span className="inline-flex overflow-hidden" style={{ maxWidth: fold ? 32 : 120, transition: 'max-width .55s cubic-bezier(.65,0,.35,1)' }}><img src={kapLogo} alt="KAP Edutech" className="h-7 w-auto max-w-none" /></span>
            {!fold && ROLE_SHORT[role] && <span className="jb-fade text-[11.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: 'var(--panel)', color: 'var(--ink)' }}>{ROLE_SHORT[role]}</span>}
          </div>
        </div>
        <div ref={box} className="relative flex-1 overflow-y-auto py-3 px-3 space-y-3.5">
            {pill && <span aria-hidden="true" className="j-navpill !m-0" style={{ top: pill.top, bottom: pill.bottom, left: 12, right: 12, transition }} />}
            {groups.map((g, gi) => (
                <div key={g.label || gi} className="relative z-[1]">
                    {(g.label || gi === 0) && (fold ? (gi ? <hr className="mx-3 mb-2 border-[var(--sage2)]" /> : null) : <p className="px-3 mb-2 text-[11.5px] font-bold tracking-[.1em] uppercase" style={{ color: 'var(--muted)' }}>{g.label || `${ROLE_SHORT[role] || 'My'} workspace`}</p>)}
                    <ul className="space-y-1">
                        {g.items.map(item => (
                            <li key={item.to}>
                                <NavLink
                                    to={item.to}
                                    end={item.to === '/staff/dashboard'}
                                    onClick={onNavigate}
                                    title={fold ? item.label : undefined}
                                    aria-label={fold ? item.label : undefined}
                                    className={({ isActive }) => `group relative flex items-center gap-3 ${fold ? 'justify-center px-0' : 'px-2'} min-h-[40px] rounded-full text-[14.5px] transition-colors duration-200 ${isActive ? 'font-bold text-slate-900' : 'font-medium text-slate-700 hover:bg-white/45'}`}
                                >
                                    {({ isActive }) => (
                                        <>
                                            <span aria-hidden="true" className="w-[30px] h-[30px] flex items-center justify-center shrink-0 text-[17px] leading-none" style={{ filter: isActive ? 'none' : 'saturate(.85)' }}>
                                                {item.emoji || <item.icon className="w-4 h-4" />}
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
        {!fold && recent.length > 0 && (
            <div className="jb-fade mx-3 mb-2 rounded-[20px] px-4 py-3" style={{ background: 'var(--panel)' }}>
                <p className="text-[11px] font-bold tracking-[.08em] uppercase mb-1" style={{ color: 'var(--muted)' }}>Recently opened</p>
                {recent.map((r, i) => (
                    <NavLink key={r.to} to={r.to} onClick={onNavigate} className="flex items-center gap-2.5 py-1.5" style={{ borderTop: i ? '1px solid var(--track)' : 'none' }}>
                        <span aria-hidden="true" className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0" style={{ background: RECENT_TONES[i % 3], color: 'var(--ink)' }}>{initialsOf(r.name)}</span>
                        <span className="min-w-0"><b className="block text-[12.5px] truncate" style={{ color: 'var(--ink)' }}>{r.name}</b>{r.sub && <span className="block text-[11px] truncate" style={{ color: 'var(--muted)' }}>{r.sub}</span>}</span>
                    </NavLink>
                ))}
            </div>
        )}
        {onFold ? (
            <div className={`pb-3 ${fold ? 'px-2' : 'px-3'}`}>
                <button type="button" onClick={onFold} aria-expanded={!fold} aria-label={fold ? 'Show menu' : 'Hide menu'} title={`${fold ? 'Show' : 'Hide'} menu ( [ )`}
                    className={`flex items-center gap-2.5 h-[42px] rounded-full text-[13px] font-bold w-full ${fold ? 'justify-center' : 'px-4'}`} style={{ background: 'var(--glass, rgba(255,255,255,.55))', color: 'var(--ink)' }}>
                    <span aria-hidden="true" className="inline-block text-[20px] leading-none w-4 text-center" style={{ transform: fold ? 'rotate(180deg)' : 'none', transition: 'transform .55s cubic-bezier(.65,0,.35,1)' }}>‹</span>
                    {!fold && <span className="jb-fade">Hide menu</span>}
                </button>
            </div>
        ) : <p className="jb-fade px-5 py-3 text-[11px] text-slate-600">KAP Edutech Pvt. Ltd.</p>}
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

    useEffect(() => { setDrawer(false); }, [pathname]);

    return (
        <div className={`kap min-h-screen ${fold ? 'lg:pl-[104px]' : 'lg:pl-64'} pb-24 lg:pb-0`} data-theme={theme} style={{ transition: 'padding-left .45s cubic-bezier(.65,0,.35,1), background-color .5s ease' }}>
            <div className="kap-wash" aria-hidden="true" />
            {/* Desktop sidebar: folds into an icon rail with the ‹ button or the [ key */}
            <aside className="jb-side hidden lg:block fixed top-3 bottom-3 left-3 kap-bar rounded-[28px] overflow-hidden z-40" style={{ width: fold ? 84 : 236 }}>
                <Sidebar groups={groups} center={currentCenter} fold={fold} onFold={toggleFold} role={role} />
            </aside>

            {/* Phone / tablet drawer */}
            {drawer && (
                <div className="lg:hidden fixed inset-0 z-[60]">
                    <button type="button" className="absolute inset-0 bg-slate-900/50 shell-fade" aria-label="Close menu" onClick={() => setDrawer(false)} />
                    <aside className="relative w-72 max-w-[85%] h-full kap-bar shadow-[0_26px_60px_rgba(15,31,77,.22)] shell-slide-left">
                        <Sidebar groups={groups} center={currentCenter} onNavigate={() => setDrawer(false)} role={role} />
                    </aside>
                </div>
            )}

            <header className="sticky top-0 z-30" style={{ background: 'color-mix(in srgb, var(--cream) 82%, transparent)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
                <div className="min-h-[68px] px-4 sm:px-6 py-3 flex items-center gap-2.5 max-w-[1320px] mx-auto">
                    <button type="button" className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }} onClick={() => setDrawer(true)} aria-label="Open menu">
                        <Menu className="w-5 h-5" />
                    </button>
                    <img src={kapLogo} alt="KAP Edutech" className="lg:hidden h-7 w-auto shrink-0" />
                    <p className="min-w-0 flex-1 hidden sm:block text-[13.5px] truncate" style={{ color: 'var(--muted)' }}>
                        KAP ERP <span aria-hidden="true">›</span> <b style={{ color: 'var(--ink)' }}>{titleFor(pathname)}</b>
                    </p>
                    <div className="flex-1 sm:hidden" />

                    <GlobalSearch role={role} centerId={userProfile?.centerId} className="hidden xl:block" />
                    {isDirector ? (
                        <label className="hidden md:flex items-center gap-1.5 px-3 h-[42px] rounded-full text-[13px] font-semibold" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}>
                            <span aria-hidden="true">📍</span>
                            <span className="sr-only">Centre</span>
                            <select value={currentCenter.id} onChange={(e) => setCurrentCenter(CENTERS[e.target.value])} className="bg-transparent outline-none cursor-pointer">
                                <option value="UN_COLLEGE">College Road</option>
                                <option value="UN_NASHIK_RD">Nashik Road</option>
                                <option value="PRAYAS">Prayaas</option>
                            </select>
                        </label>
                    ) : (
                        <span className="hidden md:inline-flex items-center gap-1.5 px-3 h-[42px] rounded-full text-[13px] font-semibold" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}>
                            <span aria-hidden="true">📍</span> {currentCenter?.brand === 'PRAYAS' ? 'Prayaas' : (currentCenter?.id === 'UN_NASHIK_RD' ? 'Nashik Road' : 'College Road')}
                        </span>
                    )}
                    <AcademicYearPicker className="hidden md:flex" />
                    <ThemeSwitch className="hidden sm:inline-flex" />
                    <Link to="/staff/my-day" aria-current={pathname.startsWith('/staff/my-day') ? 'page' : undefined} className="inline-flex items-center gap-2 px-3.5 h-[42px] rounded-full text-[13.5px] font-semibold" style={{ background: pathname.startsWith('/staff/my-day') ? 'var(--ink)' : 'var(--panel)', color: pathname.startsWith('/staff/my-day') ? 'var(--on-ink)' : 'var(--ink)', boxShadow: '0 0 0 1px var(--line)' }}>
                        <span aria-hidden="true">🗓️</span> <span className="hidden sm:inline">My day</span>
                    </Link>
                    <Link to="/staff/profile" className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-[14px] font-bold shrink-0" style={{ background: 'var(--t-blue)', color: 'var(--ink)' }} title={`${userProfile?.name || ''} · ${ROLE_LABEL[role] || role} · Account settings`} aria-label="Account settings">
                        {initials(userProfile?.name)}
                    </Link>
                    <button type="button" onClick={handleLogout} className="w-[42px] h-[42px] rounded-full flex items-center justify-center hover:text-rose-700" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)', color: 'var(--muted)' }} aria-label="Log out" title="Log out">
                        <LogOut className="w-[18px] h-[18px]" />
                    </button>
                </div>
                {/* Search, centre and year on small screens */}
                <div className="xl:hidden px-4 sm:px-6 pb-3 flex gap-2 max-w-[1320px] mx-auto">
                    <GlobalSearch role={role} centerId={userProfile?.centerId} className="flex-1 min-w-0" />
                    {isDirector && (
                        <select aria-label="Centre" value={currentCenter.id} onChange={(e) => setCurrentCenter(CENTERS[e.target.value])} className="md:hidden px-3 h-[42px] rounded-full text-[13px] font-semibold" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)', color: 'var(--ink)' }}>
                            <option value="UN_COLLEGE">College Road</option>
                            <option value="UN_NASHIK_RD">Nashik Road</option>
                            <option value="PRAYAS">Prayaas</option>
                        </select>
                    )}
                    <AcademicYearPicker className="md:hidden" />
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
