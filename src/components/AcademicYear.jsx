import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { CalendarRange } from 'lucide-react';
import { db } from '../firebase';
import { setSessionFilter } from '../services/cacheService';
import { currentSessionKey, sessionFor, setSessionStart } from '../utils/academicYear';

// Academic session picked in the header. Director, Manager and Accountant
// see the current session by default and can switch; other roles see every
// session (their screens are about their own students and dues).
const YearCtx = createContext({ session: 'ALL', setSession: () => {}, canPick: false });

// Every staff page mounts its own layout, so the choice is kept here to
// survive page changes within the tab.
let lastPicked = null;

export const AcademicYearProvider = ({ canPick, children }) => {
    const [session, setSessionState] = useState(canPick ? (lastPicked || currentSessionKey()) : 'ALL');
    const setSession = (key) => { lastPicked = key; setSessionState(key); };

    // Start date can be changed by the Director in settings/academic_year.
    useEffect(() => {
        let live = true;
        getDoc(doc(db, 'settings', 'academic_year'))
            .then(snap => { if (live && snap.exists()) { setSessionStart(snap.data()); if (canPick && !lastPicked) setSessionState(currentSessionKey()); } })
            .catch(() => { /* not readable yet: keep the 1 December default */ });
        return () => { live = false; };
    }, [canPick]);

    useEffect(() => { setSessionFilter(session); }, [session]);

    return <YearCtx.Provider value={{ session, setSession, canPick }}>{children}</YearCtx.Provider>;
};

// The current session and the three before it, plus "All sessions".
const recentSessions = () => {
    const now = sessionFor(new Date());
    return [0, 1, 2, 3].map(i => `${now.startYear - i}-${String(now.endYear - i).slice(-2)}`);
};

export const AcademicYearPicker = ({ className = '' }) => {
    const { session, setSession, canPick } = useContext(YearCtx);
    if (!canPick) return null;
    const current = currentSessionKey();
    return (
        <label className={`flex items-center gap-1 bg-gray-100 rounded-lg p-1 border text-xs font-bold text-gray-700 ${className}`} title="Academic year (December to November)">
            <CalendarRange className="w-4 h-4 text-gray-500 ml-1" />
            <span className="sr-only">Academic year</span>
            <select value={session} onChange={e => setSession(e.target.value)} className="bg-transparent border-none cursor-pointer py-1 px-1 outline-none">
                {recentSessions().map(k => <option key={k} value={k}>{k}{k === current ? ' (current)' : ''}</option>)}
                <option value="ALL">All sessions</option>
            </select>
        </label>
    );
};
