// src/firebase.js
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// Live project. A staging build (VITE_FIREBASE_ENV=staging) uses the
// separate staging project instead, so testers never touch live data.
const LIVE_CONFIG = {
    apiKey: "AIzaSyAsOpWl7gfo6gd3D-dQ1C44GyaX52xLkng",
    authDomain: "unacademy-nashik-erp.firebaseapp.com",
    projectId: "unacademy-nashik-erp",
    storageBucket: "unacademy-nashik-erp.firebasestorage.app",
    messagingSenderId: "50828920916",
    appId: "1:50828920916:web:27b086d4780481c04845c1",
    measurementId: "G-10WWD1H4XT"
};

// Staging web config (not secret: it ships in the page). Paste it here once
// the staging project exists, or pass it as JSON in VITE_STAGING_FIREBASE_CONFIG.
const STAGING_CONFIG_IN_CODE = null;

export const FIREBASE_ENV = import.meta.env.VITE_FIREBASE_ENV === 'staging' ? 'staging' : 'live';

const stagingConfig = () => {
    const fromEnv = import.meta.env.VITE_STAGING_FIREBASE_CONFIG;
    const cfg = fromEnv ? JSON.parse(fromEnv) : STAGING_CONFIG_IN_CODE;
    if (!cfg?.projectId) throw new Error('Staging build without a staging Firebase config.');
    if (cfg.projectId === LIVE_CONFIG.projectId) throw new Error('Staging config points at the live project.');
    return cfg;
};

export const firebaseConfig = FIREBASE_ENV === 'staging' ? stagingConfig() : LIVE_CONFIG;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Local test mode: `npm run dev:local` talks to the Firebase emulators
// (seeded by scripts/seed-staging.mjs) and never touches live data.
export const USE_EMULATOR = import.meta.env.VITE_USE_EMULATOR === 'true';
if (!USE_EMULATOR && FIREBASE_ENV === 'live') getAnalytics(app);

// Export Database (Firestore) with Persistent Caching for Speed
export const db = initializeFirestore(app, USE_EMULATOR ? {} : {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});
export const storage = getStorage(app);
export const auth = getAuth(app);

if (USE_EMULATOR) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
