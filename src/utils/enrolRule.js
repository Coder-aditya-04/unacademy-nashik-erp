// Which enrolment (start) dates a counsellor may pick. Academic year runs
// Dec–Nov. Change the numbers here to change the rule.
export const ENROL_RULE = {
    cutoffMonth: 4,   // April
    cutoffDay: 30,    // up to 30 April: any date in Dec–Apr
    windowDays: 30,   // from May: only within the next 30 days
    graceDays: 60,    // and never more than 60 days after 30 April (29 June)
    backDays: 7,      // how far back a date may go (late entry of a real admission)
};

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// { min, max } as YYYY-MM-DD plus a plain sentence for the counsellor.
export const enrolLimits = (today = new Date(), rule = ENROL_RULE) => {
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const m = t.getMonth() + 1;
    const cutoffYear = m === 12 ? t.getFullYear() + 1 : t.getFullYear();
    const cutoff = new Date(cutoffYear, rule.cutoffMonth - 1, rule.cutoffDay);
    const graceEnd = addDays(cutoff, rule.graceDays);
    const min = addDays(t, -rule.backDays);
    if (t <= cutoff) {
        return { min: ymd(min), max: ymd(cutoff), note: `Pick any date up to ${fmt(cutoff)}.` };
    }
    const win = addDays(t, rule.windowDays);
    if (t <= graceEnd) {
        const max = win < graceEnd ? win : graceEnd;
        return { min: ymd(min), max: ymd(max), note: `After ${fmt(cutoff)} you can pick only up to ${fmt(max)} (${rule.windowDays} days ahead, and not after ${fmt(graceEnd)}).` };
    }
    // Late admissions (after the grace end): next 30 days only.
    return { min: ymd(min), max: ymd(win), note: `Late admission: pick a date up to ${fmt(win)}.` };
};

// null when fine, otherwise the reason it is blocked.
export const enrolDateProblem = (date, today = new Date(), rule = ENROL_RULE) => {
    if (!date) return 'Pick the enrolment date.';
    const { min, max, note } = enrolLimits(today, rule);
    if (date < min) return `That date is too far back. The earliest allowed is ${min}.`;
    if (date > max) return `That date is too far ahead. ${note}`;
    return null;
};
