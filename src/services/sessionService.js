import { db } from '../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { UAParser } from 'ua-parser-js';

// Collection Reference Helper
const getSessionsRef = (userId) => collection(db, 'users', userId, 'sessions');

/**
 * Registers a new session for the logged-in user.
 * @param {string} userId - The user's UID.
 * @returns {Promise<string>} - The Session ID (sessionId).
 */
export const registerSession = async (userId) => {
    try {
        const parser = new UAParser();
        const result = parser.getResult();

        // Generate a readable device name
        const os = result.os.name || 'Unknown OS';
        const browser = result.browser.name || 'Unknown Browser';
        const deviceType = result.device.type ? result.device.type : (os === 'iOS' || os === 'Android' ? 'Mobile' : 'Desktop');

        const deviceName = `${os} ${result.os.version || ''} - ${browser}`;

        // Create a unique Session ID (using timestamp + random)
        const sessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // CRITICAL: Set Local Storage IMMEDIATELY to prevent App.jsx from force-logging out
        localStorage.setItem('current_session_id', sessionId);

        const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);

        await setDoc(sessionRef, {
            sessionId,
            deviceName,
            deviceType, // 'mobile', 'tablet', 'desktop'
            browser: browser,
            os: os,
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp(),
            userAgent: navigator.userAgent
        });

        return sessionId;
    } catch (error) {
        console.error("Error registering session:", error);
        // Fallback: If DB write fails, we STILL keep the local ID so user can login.
        if (!localStorage.getItem('current_session_id')) {
            localStorage.setItem('current_session_id', `offline_${Date.now()}`);
        }
        return localStorage.getItem('current_session_id');
    }
};

/**
 * Real-time listener for the CURRENT session.
 * If the session document is deleted (remote logout), this triggers the callback.
 * @param {string} userId 
 * @param {function} onSessionTerminated - Callback to run when logged out.
 * @returns {function} - Unsubscribe function.
 */
export const monitorSession = (userId, onSessionTerminated) => {
    const currentSessionId = localStorage.getItem('current_session_id');
    if (!currentSessionId) return () => { };

    const sessionRef = doc(db, 'users', userId, 'sessions', currentSessionId);

    // Update 'lastActive' on mount? (Optional optimization)
    // For now, we just listen to see if we exist.

    return onSnapshot(sessionRef, (docSnap) => {
        // If the document no longer exists, it means we were logged out remotely.
        if (!docSnap.exists()) {
            console.warn("Session terminated remotely.");
            localStorage.removeItem('current_session_id');
            onSessionTerminated();
        }
    }, (error) => {
        console.error("Session monitor error:", error);
    });
};

/**
 * Fetch all active sessions for a user (to display in Profile).
 * @param {string} userId 
 */
export const fetchActiveSessions = async (userId) => {
    try {
        const q = query(getSessionsRef(userId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching sessions:", error);
        return [];
    }
};

/**
 * Terminate a specific session (Remote Logout).
 * @param {string} userId 
 * @param {string} sessionId 
 */
export const terminateSession = async (userId, sessionId) => {
    try {
        await deleteDoc(doc(db, 'users', userId, 'sessions', sessionId));
        return { success: true };
    } catch (error) {
        console.error("Error terminating session:", error);
        return { success: false, error: error.message };
    }
};
