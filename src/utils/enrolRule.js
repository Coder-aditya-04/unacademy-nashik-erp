// Which enrolment dates a counsellor may pick. The enrolment date is the batch
// start date: the first instalment is collected from that day, so it is often
// in the future (token paid today, batch starts in Feb, pick a Feb date).
// Aditya's rule (22 Nov 2026): batches all start before April, so an admission
// made in the main season can pick any date up to 6 months ahead; an admission
// made after April can pick only within the next 30 days.
// Change the numbers here to change the rule.
export const ENROL_RULE = {
    shortMonths: [5, 6, 7, 8, 9, 10], // May–Oct: admissions "after April", 30-day window
    windowDays: 30,                   // after April: only the next 30 days
    aheadMonths: 6,                   // Nov–Apr: up to 6 months ahead
    backDays: 7,                      // how far back a date may go (late entry of a real admission)
};

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const addMonths = (d, n) => {
    const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(d.getDate(), last));
    return x;
};
const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// { min, max } as YYYY-MM-DD plus a plain sentence for the counsellor.
export const enrolLimits = (today = new Date(), rule = ENROL_RULE) => {
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const min = addDays(t, -rule.backDays);
    if (rule.shortMonths.includes(t.getMonth() + 1)) {
        const max = addDays(t, rule.windowDays);
        return { min: ymd(min), max: ymd(max), note: `Admission after April: pick a batch start date up to ${fmt(max)} (${rule.windowDays} days).` };
    }
    const max = addMonths(t, rule.aheadMonths);
    return { min: ymd(min), max: ymd(max), note: `Pick the batch start date, up to ${fmt(max)}. The first instalment is due from this day.` };
};

// null when fine, otherwise the reason it is blocked.
export const enrolDateProblem = (date, today = new Date(), rule = ENROL_RULE) => {
    if (!date) return 'Pick the enrolment date.';
    const { min, max, note } = enrolLimits(today, rule);
    if (date < min) return `That date is too far back. The earliest allowed is ${min}.`;
    if (date > max) return `That date is too far ahead. ${note}`;
    return null;
};
