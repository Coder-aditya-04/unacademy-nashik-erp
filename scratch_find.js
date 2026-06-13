import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAsOpWl7gfo6gd3D-dQ1C44GyaX52xLkng",
    authDomain: "unacademy-nashik-erp.firebaseapp.com",
    projectId: "unacademy-nashik-erp",
    storageBucket: "unacademy-nashik-erp.firebasestorage.app",
    messagingSenderId: "50828920916",
    appId: "1:50828920916:web:27b086d4780481c04845c1",
    measurementId: "G-10WWD1H4XT"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    console.log("Searching for Sarthak Bhausaheb Jadhav...");
    const q = query(collection(db, "admissions"), where("studentName", "==", "Sarthak Bhausaheb Jadhav"));
    const snap = await getDocs(q);
    if (snap.empty) {
        console.log("Not found!");
        return;
    }
    snap.forEach(d => {
        console.log("Found student ID:", d.id);
        console.log("Data:", JSON.stringify(d.data(), null, 2));
    });
}
run().catch(console.error);
