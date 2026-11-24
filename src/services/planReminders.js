// Plan my day reminders in the Android app: every task with a time on today's
// or tomorrow's plan rings as a phone notification at that time. Plans made
// on the website are picked up too, because the app listens to the planner.
// In a normal browser this does nothing.
import { LocalNotifications } from '@capacitor/local-notifications';
import { subscribePlanner } from './plannerService';
import { inApp } from './phone';
import { remindersFor } from '../utils/planReminderList.js';

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let asked = false;
const allowed = async () => {
    let p = await LocalNotifications.checkPermissions();
    if (p.display === 'prompt' && !asked) { asked = true; p = await LocalNotifications.requestPermissions(); }
    return p.display === 'granted';
};

const sync = async (dayKey, items) => {
    try {
        if (!(await allowed())) return;
        const { notifications = [] } = await LocalNotifications.getPending();
        const old = notifications.filter(n => n.extra?.plan === dayKey).map(n => ({ id: n.id }));
        if (old.length) await LocalNotifications.cancel({ notifications: old });
        const next = remindersFor(dayKey, items);
        if (next.length) await LocalNotifications.schedule({ notifications: next });
    } catch (err) {
        console.error('Plan reminders failed:', err);
    }
};

// Starts listening for the signed-in user. Returns a stop function.
export const startPlanReminders = (uid) => {
    if (!uid || !inApp()) return () => {};
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const stops = [today, tomorrow].map(d => { const k = ymd(d); return subscribePlanner(uid, k, (items) => sync(k, items)); });
    const tap = LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
        const route = e?.notification?.extra?.route;
        if (route) window.location.hash = '#' + route;
    });
    return () => { stops.forEach(s => s && s()); tap.then(h => h.remove()).catch(() => {}); };
};
