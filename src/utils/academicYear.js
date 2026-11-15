// Academic year (session). Runs 1 December to 30 November (Aditya, 15 Nov
// 2026). A session is named by both years, e.g. Dec 2025 - Nov 2026 is
// "2025-26". Roll numbers use the year the session ENDS in (26 for 2025-26),
// so January to November match the old calendar-year rolls and only
// December admissions move to the next series.

export const DEFAULT_SESSION_START = { month: 12, day: 1 };
let sessionStart = DEFAULT_SESSION_START;

// Set from settings/academic_year (AcademicYearProvider) so the start can
// change without a code change.
export const setSessionStart = (start) => {
    const month = Number(start?.month), day = Number(start?.day);
    sessionStart = month >= 1 && month <= 12 && day >= 1 && day <= 28 ? { month, day } : DEFAULT_SESSION_START;
};
export const getSessionStart = () => sessionStart;

const toDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
    if (typeof v === 'string') {
        const dmy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        const d = dmy ? new Date(+dmy[3], +dmy[2] - 1, +dmy[1]) : new Date(`${v.slice(0, 10)}T00:00:00`);
        return isNaN(d) ? null : d;
    }
    const d = new Date(v);
    return isNaN(d) ? null : d;
};

// The session a date falls in: { key: '2025-26', startYear: 2025, endYear: 2026, yy: '26' }.
export const sessionFor = (date = new Date(), start = sessionStart) => {
    const d = toDate(date) || new Date();
    const y = d.getFullYear();
    const onOrAfterStart = d.getMonth() + 1 > start.month
        || (d.getMonth() + 1 === start.month && d.getDate() >= start.day);
    // A session starting on 1 January lives inside one calendar year.
    const startYear = start.month === 1 && start.day === 1 ? y : (onOrAfterStart ? y : y - 1);
    const endYear = start.month === 1 && start.day === 1 ? y : startYear + 1;
    return { key: `${startYear}-${String(endYear).slice(-2)}`, startYear, endYear, yy: String(endYear).slice(-2) };
};

export const currentSessionKey = () => sessionFor(new Date()).key;

// Session of an admission: the saved field, or derived from its dates for
// admissions saved before the field existed.
export const admissionSession = (a) =>
    a?.academicYear || sessionFor(toDate(a?.enrollmentDate) || toDate(a?.createdAt) || new Date()).key;

// Sessions present in a list of admissions, newest first, always including
// the current one.
export const sessionsIn = (admissions = []) => {
    const keys = new Set([currentSessionKey()]);
    admissions.forEach(a => keys.add(admissionSession(a)));
    return [...keys].sort().reverse();
};
