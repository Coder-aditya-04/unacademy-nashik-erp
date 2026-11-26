// Which phone notifications a day's plan needs (used by services/planReminders).
const hm = (h, m) => `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
// Notification ids must be 32-bit ints; this keeps one id per day + task.
const idFor = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 1) || 1; };

// Pure: which notifications a day's plan should have from now on.
export const remindersFor = (dayKey, items, now = Date.now()) => {
    const [y, mo, d] = dayKey.split('-').map(Number);
    return (items || []).flatMap(i => {
        if (i.done || !i.time) return [];
        const [h, m] = String(i.time).split(':').map(Number);
        if (!Number.isFinite(h)) return [];
        const at = new Date(y, mo - 1, d, h, m || 0, 0, 0);
        if (at.getTime() <= now + 20000) return [];
        const title = i.title || i.text || 'Task';
        return [{
            id: idFor(`${dayKey}|${i.id || title}`),
            title: `⏰ ${title}`.slice(0, 120),
            body: `Planned for ${hm(h, m || 0)}. Tap to open My day.`,
            schedule: { at, allowWhileIdle: true },
            extra: { plan: dayKey, route: '/staff/my-day' },
        }];
    });
};

