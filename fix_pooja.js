import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });
dotenv.config({ path: join(__dirname, '.env.local') });

const firebaseConfig = {
  apiKey: process.env.VITE_APP_FIREBASE_API_KEY || "AIzaSy...",
  authDomain: process.env.VITE_APP_FIREBASE_AUTH_DOMAIN || "antigravity-unacademy.firebaseapp.com",
  projectId: process.env.VITE_APP_FIREBASE_PROJECT_ID || "antigravity-unacademy",
  storageBucket: process.env.VITE_APP_FIREBASE_STORAGE_BUCKET || "antigravity-unacademy.appspot.com",
  messagingSenderId: process.env.VITE_APP_FIREBASE_MESSAGING_SENDER_ID || "227318765457",
  appId: process.env.VITE_APP_FIREBASE_APP_ID || "1:227318765457:web:8c5b60288863fbafe5b4c1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fix() {
    try {
        console.log("Searching for Pooja kanade...");
        const q = query(collection(db, "admissions"), where("studentName", "==", "Pooja kanade"));
        const snapshot = await getDocs(q);
        
        let docs = snapshot.docs;
        if (docs.length === 0) {
            const q2 = query(collection(db, "admissions"), where("studentName", "==", "pooja kanade"));
            const snap2 = await getDocs(q2);
            docs = snap2.docs;
        }
        
        if (docs.length === 0) {
            console.log("Not found.");
            process.exit(1);
        }
        
        for (const d of docs) {
            const data = d.data();
            console.log("Found:", d.id, "TotalPaid:", data.totalPaid);
            if (data.payments && Array.isArray(data.payments)) {
                let changed = false;
                let sum = 0;
                const newPayments = data.payments.map(p => {
                    const amt = Number(p.amount);
                    if (amt === 185000) {
                        console.log("Found 185000 payment. Fixing to 18500.");
                        p.amount = 18500;
                        changed = true;
                    }
                    sum += Number(p.amount);
                    return p;
                });
                
                if (changed) {
                    await updateDoc(doc(db, "admissions", d.id), {
                        payments: newPayments,
                        totalPaid: sum
                    });
                    console.log("Fixed! New TotalPaid =", sum);
                } else {
                    console.log("No 185000 payments found. Sum is", sum);
                }
            }
        }
    } catch(err) {
        console.error("Error:", err);
    }
    process.exit(0);
}

fix();
