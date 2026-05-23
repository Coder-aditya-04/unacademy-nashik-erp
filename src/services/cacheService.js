// src/services/cacheService.js
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';

const CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache TTL

let admissionsCache = {}; // centerId -> { data, lastFetch }
let leadsCache = {}; // centerFilter -> { data, lastFetch }

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
 * Retrieves admissions collection, utilizing client-side caching.
 * @param {string} centerId - Center ID ('ALL' or specific center ID)
 * @param {boolean} forceRefresh - If true, bypasses the cache and queries Firestore directly.
 */
export const getCachedAdmissions = async (centerId = 'ALL', forceRefresh = false) => {
    const now = Date.now();
    const cacheKey = `admissions_cache_${centerId}`;
    const cacheTimeKey = `${cacheKey}_time`;
    
    // 1. Check in-memory cache
    if (!forceRefresh && admissionsCache[centerId] && (now - admissionsCache[centerId].lastFetch < CACHE_TTL)) {
        console.log(`⚡ [CacheService] admissionsCache (${centerId}) served from in-memory`);
        return admissionsCache[centerId].data;
    }
    
    // 2. Check sessionStorage cache
    if (!forceRefresh) {
        try {
            const stored = sessionStorage.getItem(cacheKey);
            const storedTime = sessionStorage.getItem(cacheTimeKey);
            if (stored && storedTime && (now - parseInt(storedTime) < CACHE_TTL)) {
                console.log(`⚡ [CacheService] admissionsCache (${centerId}) served from sessionStorage`);
                const data = deserializeData(stored);
                admissionsCache[centerId] = { data, lastFetch: parseInt(storedTime) };
                
                // Keep window-level cache updated for legacy/audit scripts compatibility
                if (centerId === 'ALL') {
                    window.admissionsAllRaw = data;
                    window.admissionsLastFetch = parseInt(storedTime);
                }
                return data;
            }
        } catch (e) {
            console.error("Error reading sessionStorage cache", e);
        }
    }
    
    // 3. Fetch fresh from Firestore
    console.log(`🔥 [CacheService] Fetching admissions (${centerId}) fresh from Firestore...`);
    const transactionsRef = collection(db, "admissions");
    let q;
    if (centerId && centerId !== 'ALL') {
        q = query(transactionsRef, where("centerId", "==", centerId), orderBy("createdAt", "desc"));
    } else {
        q = query(transactionsRef, orderBy("createdAt", "desc"));
    }
    
    const querySnapshot = await getDocs(q);
    const allData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Update caches
    admissionsCache[centerId] = { data: allData, lastFetch: now };
    
    try {
        sessionStorage.setItem(cacheKey, serializeData(allData));
        sessionStorage.setItem(cacheTimeKey, now.toString());
    } catch (e) {
        console.error("Error saving sessionStorage cache", e);
    }
    
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
 * Retrieves leads collection, utilizing client-side caching.
 * @param {string} centerFilter - Center filter ('ALL' or specific center ID)
 * @param {boolean} forceRefresh - If true, bypasses the cache and queries Firestore directly.
 */
export const getCachedLeads = async (centerFilter = 'ALL', forceRefresh = false) => {
    const now = Date.now();
    const cacheKey = `leads_cache_${centerFilter}`;
    const cacheTimeKey = `${cacheKey}_time`;
    
    // 1. Check in-memory cache
    if (!forceRefresh && leadsCache[centerFilter] && (now - leadsCache[centerFilter].lastFetch < CACHE_TTL)) {
        console.log(`⚡ [CacheService] ${cacheKey} served from in-memory`);
        return leadsCache[centerFilter].data;
    }
    
    // 2. Check sessionStorage cache
    if (!forceRefresh) {
        try {
            const stored = sessionStorage.getItem(cacheKey);
            const storedTime = sessionStorage.getItem(cacheTimeKey);
            if (stored && storedTime && (now - parseInt(storedTime) < CACHE_TTL)) {
                console.log(`⚡ [CacheService] ${cacheKey} served from sessionStorage`);
                const data = deserializeData(stored);
                leadsCache[centerFilter] = { data, lastFetch: parseInt(storedTime) };
                
                // Keep window-level cache updated for legacy scripts compatibility
                window[cacheKey] = data;
                window[cacheTimeKey] = parseInt(storedTime);
                return data;
            }
        } catch (e) {
            console.error(`Error reading ${cacheKey} from sessionStorage`, e);
        }
    }
    
    // 3. Fetch fresh from Firestore
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
    
    try {
        sessionStorage.setItem(cacheKey, serializeData(data));
        sessionStorage.setItem(cacheTimeKey, now.toString());
    } catch (e) {
        console.error(`Error saving ${cacheKey} to sessionStorage`, e);
    }
    
    // Keep window-level cache updated (mapping to mock a snapshot query list if statsService needs snapshot format)
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
