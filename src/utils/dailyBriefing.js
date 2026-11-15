// What a counsellor should do today, built from the follow-ups and fee dues
// the dashboard already loads. Shown once a day at login (DailyBriefing).

export const localYmd = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const byDate = (a, b) => (a.nextFollowUp || '').localeCompare(b.nextFollowUp || '');

export const buildDailyBriefing = ({ tasks = [], installments = [], today = localYmd() }) => {
    const followUpsToday = tasks.filter(t => t.nextFollowUp === today);
    const followUpsMissed = tasks.filter(t => t.nextFollowUp && t.nextFollowUp < today).sort(byDate);
    const promisesToday = installments.filter(i => i.promisedDate === today);
    const promiseIds = new Set(promisesToday.map(i => i.id));
    const rest = installments.filter(i => !promiseIds.has(i.id));
    const feesOverdue = rest.filter(i => i.daysLeft < 0).sort((a, b) => a.daysLeft - b.daysLeft);
    const feesToday = rest.filter(i => i.daysLeft === 0);
    const feesSoon = rest.filter(i => i.daysLeft > 0 && i.daysLeft <= 2);
    const sum = (list) => list.reduce((t, i) => t + (Number(i.balance) || 0), 0);
    return {
        today,
        followUpsToday, followUpsMissed,
        promisesToday, feesOverdue, feesToday, feesSoon,
        overdueAmount: sum(feesOverdue),
        count: followUpsToday.length + followUpsMissed.length + promisesToday.length
            + feesOverdue.length + feesToday.length + feesSoon.length,
    };
};

// Seen-today flag, per user. Storage can be blocked (private mode): then the
// briefing simply shows on every visit to the dashboard.
const seenKey = (uid, today) => `briefing_seen_${uid}_${today}`;
export const briefingSeen = (uid, today = localYmd()) => {
    try { return localStorage.getItem(seenKey(uid, today)) === '1'; } catch { return false; }
};
export const markBriefingSeen = (uid, today = localYmd()) => {
    try { localStorage.setItem(seenKey(uid, today), '1'); } catch { /* storage blocked */ }
};
