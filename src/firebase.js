// src/firebase.js
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
export const firebaseConfig = {
    apiKey: "AIzaSyAsOpWl7gfo6gd3D-dQ1C44GyaX52xLkng",
    authDomain: "unacademy-nashik-erp.firebaseapp.com",
    projectId: "unacademy-nashik-erp",
    storageBucket: "unacademy-nashik-erp.firebasestorage.app",
    messagingSenderId: "50828920916",
    appId: "1:50828920916:web:27b086d4780481c04845c1",
    measurementId: "G-10WWD1H4XT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export Database (Firestore) with Persistent Caching for Speed
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});
export const storage = getStorage(app);
export const auth = getAuth(app);
