// src/services/cacheService.js
import { collection, query, orderBy, getDocs, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const CACHE_TTL = 15 * 1000; // 15 seconds cache TTL for fast initial load and fresh navigation

let admissionsCache = {}; // centerId -> { data, lastFetch }
let leadsCache = {}; // centerFilter -> { data, lastFetch }

let admissionsListeners = {}; // centerId -> { unsubscribe, callbacks: Set, lastData }
let leadsListeners = {}; // centerFilter -> { unsubscribe, callbacks: Set, lastData }

// Helper to serialize Firestore data to handle Timestamps properly
const serializeData = (data) => {
    return JSON.stringify(data, (key, value) => {
        if (value && typeof value === 'object' && value.seconds !== undefined && value.nanoseconds !== undefined) {
            return { __type: 'FirestoreTimestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
        }
        return value;
    });
};

// Helper to deserialize Firestore data and reconstruct Timestamp-like objects
const deserializeData = (jsonStr) => {
    return JSON.parse(jsonStr, (key, value) => {
        if (value && typeof value === 'object' && value.__type === 'FirestoreTimestamp') {
            return {
                seconds: value.seconds,
                nanoseconds: value.nanoseconds,
                toDate: function() { return new Date(this.seconds * 1000); }
            };
        }
        return value;
    });
};

/**
 * Subscribes to real-time updates for the admissions collection.
 * @param {string} centerId - Center ID ('ALL' or specific center ID)
 * @param {function} callback - Callback function with fresh data
 * @returns {function} Unsubscribe function
 */
export const subscribeAdmissions = (centerId = 'ALL', callback) => {
    if (!admissionsListeners[centerId]) {
        admissionsListeners[centerId] = {
            callbacks: new Set(),
            unsubscribe: null,
            lastData: null
        };
    }
    
    admissionsListeners[centerId].callbacks.add(callback);
    
    if (admissionsListeners[centerId].lastData) {
        callback(admissionsListeners[centerId].lastData);
    }
    
    if (!admissionsListeners[centerId].unsubscribe) {
        const transactionsRef = collection(db, "admissions");
        let q;
        if (centerId && centerId !== 'ALL') {
            q = query(transactionsRef, where("centerId", "==", centerId));
        } else {
            q = query(transactionsRef);
        }
        
        admissionsListeners[centerId].unsubscribe = onSnapshot(q, (snapshot) => {
            const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            allData.sort((a, b) => {
                const timeA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
                const timeB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
                return timeB - timeA;
            });
            
            admissionsListeners[centerId].lastData = allData;
            admissionsCache[centerId] = { data: allData, lastFetch: Date.now() };
            
            if (centerId === 'ALL') {
                window.admissionsAllRaw = allData;
                window.admissionsLastFetch = Date.now();
            }
            
            admissionsListeners[centerId].callbacks.forEach(cb => {
                try { cb(allData); } catch (err) { console.error(err); }
            });
        }, (error) => {
            console.error(`Error in admissions subscription for ${centerId}:`, error);
        });
    }
    
    return () => {
        const listener = admissionsListeners[centerId];
        if (listener) {
            listener.callbacks.delete(callback);
            if (listener.callbacks.size === 0) {
                if (listener.unsubscribe) listener.unsubscribe();
                delete admissionsListeners[centerId];
            }
        }
    };
};

/**
 * Retrieves admissions collection, utilizing client-side caching.
 * @param {string} centerId - Center ID ('ALL' or specific center ID)
 * @param {boolean} forceRefresh - If true, bypasses the cache and queries Firestore directly.
 */
export const getCachedAdmissions = async (centerId = 'ALL', forceRefresh = false) => {
    // If there is active subscription data, serve it instantly
    if (!forceRefresh && admissionsListeners[centerId]?.lastData) {
        return admissionsListeners[centerId].lastData;
    }

    const now = Date.now();
    
    // 1. Check in-memory cache
    if (!forceRefresh && admissionsCache[centerId] && (now - admissionsCache[centerId].lastFetch < CACHE_TTL)) {
        console.log(`⚡ [CacheService] admissionsCache (${centerId}) served from in-memory`);
        return admissionsCache[centerId].data;
    }
    
    // 2. Fetch fresh from Firestore
    console.log(`🔥 [CacheService] Fetching admissions (${centerId}) fresh from Firestore...`);
    const transactionsRef = collection(db, "admissions");
    let q;
    if (centerId && centerId !== 'ALL') {
        q = query(transactionsRef, where("centerId", "==", centerId));
    } else {
        q = query(transactionsRef);
    }
    
    const querySnapshot = await getDocs(q);
    const allData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort client-side by createdAt desc to avoid requiring composite indexes
    allData.sort((a, b) => {
        const timeA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
        const timeB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
        return timeB - timeA;
    });
    
    // Update caches
    admissionsCache[centerId] = { data: allData, lastFetch: now };
    
    // Keep window-level cache updated
    if (centerId === 'ALL') {
        window.admissionsAllRaw = allData;
        window.admissionsLastFetch = now;
    }
    
    return allData;
};

/**
 * Clears the admissions cache.
 * @param {string} centerId - Center ID to clear, or 'ALL' to clear all admissions cache.
 */
export const clearAdmissionsCache = (centerId = 'ALL') => {
    console.log(`🗑️ [CacheService] Clearing admissions cache for: ${centerId}`);
    if (centerId === 'ALL') {
        admissionsCache = {};
        try {
            const keysToRemove = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith('admissions_cache_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => sessionStorage.removeItem(key));
        } catch (e) {}
        window.admissionsAllRaw = null;
        window.admissionsLastFetch = 0;
    } else {
        delete admissionsCache[centerId];
        try {
            sessionStorage.removeItem(`admissions_cache_${centerId}`);
            sessionStorage.removeItem(`admissions_cache_${centerId}_time`);
        } catch (e) {}
        
        // Also clear 'ALL' cache since a write in one center changes the 'ALL' list
        delete admissionsCache['ALL'];
        try {
            sessionStorage.removeItem(`admissions_cache_ALL`);
            sessionStorage.removeItem(`admissions_cache_ALL_time`);
        } catch (e) {}
        window.admissionsAllRaw = null;
        window.admissionsLastFetch = 0;
    }
};

/**
 * Subscribes to real-time updates for the leads collection.
 * @param {string} centerFilter - Center filter ('ALL' or specific center ID)
 * @param {function} callback - Callback function with fresh data
 * @returns {function} Unsubscribe function
 */
export const subscribeLeads = (centerFilter = 'ALL', callback) => {
    if (!leadsListeners[centerFilter]) {
        leadsListeners[centerFilter] = {
            callbacks: new Set(),
            unsubscribe: null,
            lastData: null
        };
    }
    
    leadsListeners[centerFilter].callbacks.add(callback);
    
    if (leadsListeners[centerFilter].lastData) {
        callback(leadsListeners[centerFilter].lastData);
    }
    
    if (!leadsListeners[centerFilter].unsubscribe) {
        const leadsRef = collection(db, "leads");
        let q;
        if (centerFilter !== 'ALL') {
            q = query(leadsRef, where("centerId", "==", centerFilter));
        } else {
            q = query(leadsRef);
        }
        
        leadsListeners[centerFilter].unsubscribe = onSnapshot(q, (snapshot) => {
            const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            leadsListeners[centerFilter].lastData = allData;
            leadsCache[centerFilter] = { data: allData, lastFetch: Date.now() };
            
            const cacheKey = `leads_cache_${centerFilter}`;
            window[cacheKey] = allData;
            window[`${cacheKey}_time`] = Date.now();
            
            leadsListeners[centerFilter].callbacks.forEach(cb => {
                try { cb(allData); } catch (err) { console.error(err); }
            });
        }, (error) => {
            console.error(`Error in leads subscription for ${centerFilter}:`, error);
        });
    }
    
    return () => {
        const listener = leadsListeners[centerFilter];
        if (listener) {
            listener.callbacks.delete(callback);
            if (listener.callbacks.size === 0) {
                if (listener.unsubscribe) listener.unsubscribe();
                delete leadsListeners[centerFilter];
            }
        }
    };
};

/**
 * Retrieves leads collection, utilizing client-side caching.
 * @param {string} centerFilter - Center filter ('ALL' or specific center ID)
 * @param {boolean} forceRefresh - If true, bypasses the cache and queries Firestore directly.
 */
export const getCachedLeads = async (centerFilter = 'ALL', forceRefresh = false) => {
    // If there is active subscription data, serve it instantly
    if (!forceRefresh && leadsListeners[centerFilter]?.lastData) {
        return leadsListeners[centerFilter].lastData;
    }

    const now = Date.now();
    const cacheKey = `leads_cache_${centerFilter}`;
    const cacheTimeKey = `${cacheKey}_time`;
    
    // 1. Check in-memory cache
    if (!forceRefresh && leadsCache[centerFilter] && (now - leadsCache[centerFilter].lastFetch < CACHE_TTL)) {
        console.log(`⚡ [CacheService] ${cacheKey} served from in-memory`);
        return leadsCache[centerFilter].data;
    }
    
    // 2. Fetch fresh from Firestore
    console.log(`🔥 [CacheService] Fetching leads (${centerFilter}) fresh from Firestore...`);
    const leadsRef = collection(db, "leads");
    let q;
    
    if (centerFilter !== 'ALL') {
        q = query(leadsRef, where("centerId", "==", centerFilter));
    } else {
        q = query(leadsRef);
    }
    
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Update caches
    leadsCache[centerFilter] = { data, lastFetch: now };
    
    // Keep window-level cache updated
    window[cacheKey] = data;
    window[cacheTimeKey] = now;
    
    return data;
};

/**
 * Clears the leads cache.
 * @param {string} centerFilter - Center filter to clear, or 'ALL' to clear all leads cache.
 */
export const clearLeadsCache = (centerFilter = 'ALL') => {
    console.log(`🗑️ [CacheService] Clearing leads cache for: ${centerFilter}`);
    if (centerFilter === 'ALL') {
        leadsCache = {};
        // Clear all sessionStorage keys starting with leads_cache_
        try {
            const keysToRemove = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith('leads_cache_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => sessionStorage.removeItem(key));
        } catch (e) {}
        
        // Clear window variables
        Object.keys(window).forEach(key => {
            if (key.startsWith('leads_cache_')) {
                window[key] = null;
            }
        });
    } else {
        delete leadsCache[centerFilter];
        try {
            sessionStorage.removeItem(`leads_cache_${centerFilter}`);
            sessionStorage.removeItem(`leads_cache_${centerFilter}_time`);
        } catch (e) {}
        window[`leads_cache_${centerFilter}`] = null;
        window[`leads_cache_${centerFilter}_time`] = null;
    }
};
