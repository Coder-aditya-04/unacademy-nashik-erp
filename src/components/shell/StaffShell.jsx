import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { MapPin, LogOut, Menu, X, MessageSquare, CalendarCheck2, Plus, Trash2, Check, UserCircle2, ArrowRight } from 'lucide-react';
import { CENTERS } from '../../utils/centers';
import { navFor, titleFor, normaliseRole, ROLE_LABEL } from '../../utils/navItems';
import { localYmd } from '../../utils/dailyBriefing';
import { subscribePlanner, savePlanner } from '../../services/plannerService';
import { AcademicYearPicker } from '../AcademicYear';

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'U';

const Sidebar = ({ groups, onNavigate, center }) => (
    <nav aria-label="Main" className="flex flex-col h-full">
        <div className="px-5 h-16 flex items-center gap-3 border-b border-white/10 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 text-white font-extrabold text-sm" aria-hidden="true">
                {center?.brand === 'PRAYAS' ? 'P' : 'U'}
            </div>
            <div className="min-w-0">
                <p className="text-white font-bold text-sm leading-tight truncate">KAP Staff</p>
                <p className="text-slate-400 text-[11px] truncate">{center?.brand === 'PRAYAS' ? 'Prayaas Education' : 'Unacademy Nashik'}</p>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
            {groups.map((g, gi) => (
                <div key={g.label || gi}>
                    {g.label && <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{g.label}</p>}
                    <ul className="space-y-0.5">
                        {g.items.map(item => (
                            <li key={item.to}>
                                <NavLink
                                    to={item.to}
                                    end={item.to === '/staff/dashboard'}
                                    onClick={onNavigate}
                                    className={({ isActive }) => `group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${isActive ? 'bg-white/10 text-white shadow-[inset_3px_0_0_0_#60a5fa]' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                                >
                                    <item.icon className="w-[18px] h-[18px] shrink-0 opacity-80 group-hover:opacity-100" aria-hidden="true" />
                                    <span className="truncate">{item.label}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    </nav>
);

// Personal plan for the day, for every role.
const MyDay = ({ uid, role, onClose }) => {
    const day = localYmd();
    const [items, setItems] = useState([]);
    const [text, setText] = useState('');
    const [time, setTime] = useState('');
    const inputRef = useRef(null);

    useEffect(() => (uid ? subscribePlanner(uid, day, setItems) : undefined), [uid, day]);
    useEffect(() => { inputRef.current?.focus(); }, []);

    const save = (next) => { setItems(next); savePlanner(uid, day, next).catch(err => console.error('Planner save failed', err)); };
    const add = (e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t) return;
        const id = globalThis.crypto?.randomUUID?.() || String(Date.now());
        save([...items, { id, text: t.slice(0, 200), time: time || null, done: false }]
            .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')));
        setText(''); setTime('');
    };
    const done = items.filter(i => i.done).length;
    const shortcuts = {
        COUNSELLOR: [{ to: '/staff/dashboard?plan=1', label: "Today's calls and fee dues" }, { to: '/staff/leads', label: 'Open my leads' }],
        RECOVERY: [{ to: '/staff/dashboard', label: 'Overdue students and promises' }],
        MANAGER: [{ to: '/staff/recovery-desk', label: 'Recovery desk' }, { to: '/staff/leads', label: 'Team leads' }],
        DIRECTOR: [{ to: '/staff/recovery-desk', label: 'Recovery desk' }, { to: '/staff/dashboard', label: 'Centre overview' }],
        ACCOUNTANT: [{ to: '/staff/recovery', label: 'Fee recovery' }, { to: '/staff/accounts', label: 'Pending approvals' }],
    }[role] || [];

    return (
        <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label="My day">
            <button type="button" className="absolute inset-0 bg-slate-900/40 shell-fade" aria-label="Close" onClick={onClose} />
            <aside className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col shell-slide-in">
                <header className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">My day</p>
                        <h2 className="text-xl font-bold text-slate-900">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                        <p className="text-sm text-slate-500 mt-0.5">{items.length ? `${done} of ${items.length} done` : 'Plan what you will do today.'}</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="w-5 h-5" /></button>
                </header>
                {items.length > 0 && (
                    <div className="px-6 pt-4">
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-[width] duration-500" style={{ width: `${(done / items.length) * 100}%` }} />
                        </div>
                    </div>
                )}
                <form onSubmit={add} className="px-6 pt-4 flex gap-2">
                    <label className="sr-only" htmlFor="myday-text">Task</label>
                    <input id="myday-text" ref={inputRef} value={text} onChange={e => setText(e.target.value)} maxLength={200}
                        placeholder="Add a task, e.g. Call Patil parents"
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <label className="sr-only" htmlFor="myday-time">Time</label>
                    <input id="myday-time" type="time" value={time} onChange={e => setTime(e.target.value)} className="w-[104px] px-2 py-2 rounded-lg border border-slate-200 text-sm" />
                    <button type="submit" className="px-3 rounded-lg bg-slate-900 text-white hover:bg-slate-700" aria-label="Add task"><Plus className="w-4 h-4" /></button>
                </form>
                <ul className="flex-1 overflow-y-auto px-6 py-4 space-y-1.5">
                    {items.map(i => (
                        <li key={i.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-100 hover:border-slate-200">
                            <button type="button" onClick={() => save(items.map(x => x.id === i.id ? { ...x, done: !x.done } : x))}
                                aria-pressed={i.done} aria-label={i.done ? 'Mark not done' : 'Mark done'}
                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${i.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-slate-400'}`}>
                                {i.done && <Check className="w-3.5 h-3.5" />}
                            </button>
                            <span className={`flex-1 text-sm ${i.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{i.text}</span>
                            {i.time && <span className="text-xs font-mono text-slate-500">{i.time}</span>}
                            <button type="button" onClick={() => save(items.filter(x => x.id !== i.id))} className="p-1 rounded text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Delete ${i.text}`}>
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                    {items.length === 0 && <li className="text-sm text-slate-400 text-center py-8">No tasks yet.</li>}
                </ul>
                {shortcuts.length > 0 && (
                    <footer className="px-6 py-4 border-t border-slate-100 space-y-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">From your work</p>
                        {shortcuts.map(s => (
                            <Link key={s.to} to={s.to} onClick={onClose} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                                {s.label} <ArrowRight className="w-4 h-4 text-slate-400" />
                            </Link>
                        ))}
                    </footer>
                )}
            </aside>
        </div>
    );
};

const StaffShell = ({ children, userProfile, handleLogout, currentCenter, setCurrentCenter }) => {
    const role = normaliseRole(userProfile?.role);
    const isDirector = role === 'DIRECTOR';
    const groups = useMemo(() => navFor(role), [role]);
    const { pathname } = useLocation();
    const [drawer, setDrawer] = useState(false);
    const [myDay, setMyDay] = useState(false);
    const [msgTip, setMsgTip] = useState(false);

    useEffect(() => { setDrawer(false); }, [pathname]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 lg:pl-64">
            {/* Desktop sidebar */}
            <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-slate-950 z-40">
                <Sidebar groups={groups} center={currentCenter} />
            </aside>

            {/* Phone / tablet drawer */}
            {drawer && (
                <div className="lg:hidden fixed inset-0 z-[60]">
                    <button type="button" className="absolute inset-0 bg-slate-900/50 shell-fade" aria-label="Close menu" onClick={() => setDrawer(false)} />
                    <aside className="relative w-72 max-w-[85%] h-full bg-slate-950 shell-slide-left">
                        <Sidebar groups={groups} center={currentCenter} onNavigate={() => setDrawer(false)} />
                    </aside>
                </div>
            )}

            <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
                <div className="h-16 px-4 sm:px-6 flex items-center gap-3">
                    <button type="button" className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100" onClick={() => setDrawer(true)} aria-label="Open menu">
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">{titleFor(pathname)}</h1>
                        <p className="text-[11px] text-slate-500 truncate hidden sm:block">{currentCenter?.name}</p>
                    </div>

                    {isDirector ? (
                        <label className="hidden md:flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700">
                            <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
                            <span className="sr-only">Centre</span>
                            <select value={currentCenter.id} onChange={(e) => setCurrentCenter(CENTERS[e.target.value])} className="bg-transparent outline-none cursor-pointer">
                                <option value="UN_COLLEGE">College Road</option>
                                <option value="UN_NASHIK_RD">Nashik Road</option>
                                <option value="PRAYAS">Prayaas</option>
                            </select>
                        </label>
                    ) : (
                        <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                            <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> {currentCenter?.brand === 'PRAYAS' ? 'Prayaas' : (currentCenter?.id === 'UN_NASHIK_RD' ? 'Nashik Road' : 'College Road')}
                        </span>
                    )}
                    <AcademicYearPicker className="hidden md:flex" />

                    <button type="button" onClick={() => setMyDay(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
                        <CalendarCheck2 className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">My day</span>
                    </button>
                    <div className="relative">
                        <button type="button" onClick={() => setMsgTip(v => !v)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Messages" aria-expanded={msgTip}>
                            <MessageSquare className="w-5 h-5" />
                        </button>
                        {msgTip && (
                            <div className="absolute right-0 mt-2 w-64 p-4 rounded-xl bg-white border border-slate-200 shadow-xl text-sm text-slate-600 shell-fade" role="status">
                                <p className="font-semibold text-slate-900 mb-1">Staff messages</p>
                                Chat with your team here. This arrives in the next update.
                            </div>
                        )}
                    </div>
                    <Link to="/staff/profile" className="hidden sm:flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-slate-100" title="Account settings">
                        <span className="text-right leading-tight hidden xl:block">
                            <span className="block text-sm font-semibold text-slate-800">{userProfile?.name}</span>
                            <span className="block text-[11px] text-slate-500">{ROLE_LABEL[role] || role}</span>
                        </span>
                        <span className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold flex items-center justify-center" aria-hidden="true">
                            {initials(userProfile?.name)}
                        </span>
                    </Link>
                    <Link to="/staff/profile" className="sm:hidden p-2 rounded-lg hover:bg-slate-100" aria-label="Account settings"><UserCircle2 className="w-5 h-5" /></Link>
                    <button type="button" onClick={handleLogout} className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50" aria-label="Log out" title="Log out">
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

            <main className="px-4 sm:px-6 py-6 max-w-[1400px] mx-auto shell-page">
                {children}
            </main>

            {myDay && <MyDay uid={userProfile?.uid} role={role} onClose={() => setMyDay(false)} />}
        </div>
    );
};

export default StaffShell;
