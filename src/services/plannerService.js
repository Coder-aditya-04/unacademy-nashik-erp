// Personal day plan for every staff member: users/{uid}/planner/{YYYY-MM-DD}
// holds { items: [{ id, text, time, done }] }. Only the owner reads or writes it.
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const ref = (uid, day) => doc(db, 'users', uid, 'planner', day);

export const subscribePlanner = (uid, day, cb) =>
    onSnapshot(ref(uid, day), (snap) => cb(snap.exists() ? (snap.data().items || []) : []), () => cb([]));

export const savePlanner = (uid, day, items) =>
    setDoc(ref(uid, day), { items: items.slice(0, 50), updatedAt: serverTimestamp() });
