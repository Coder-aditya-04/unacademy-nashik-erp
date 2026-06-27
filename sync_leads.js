import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

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
    console.log("Fetching leads...");
    const leadsRef = collection(db, "leads");
    const snapshot = await getDocs(leadsRef);
    
    let fixedCount = 0;
    
    for (const d of snapshot.docs) {
        const lead = d.data();
        const currentStatus = String(lead.status || "").trim().toUpperCase();
        const isConvertedState = ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN', 'CLOSED', 'LOST', 'REJECTED'].includes(currentStatus);
        
        if (lead.admissionId && !isConvertedState) {
            console.log(`Fixing lead ${d.id} (${lead.name || lead.studentName}). Status was: ${lead.status}`);
            await updateDoc(doc(db, "leads", d.id), {
                status: "CONVERTED"
            });
            fixedCount++;
        }
    }
    
    console.log(`Finished! Fixed ${fixedCount} leads.`);
    process.exit(0);
}

run().catch(console.error);
