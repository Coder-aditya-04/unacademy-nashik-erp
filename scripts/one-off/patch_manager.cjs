const fs = require('fs');
const file = 'src/components/StudentManager.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state for editCenter
const stateInjectionPoint = `    // Course Correction State (Director only)`;
const stateToAdd = `    // Transfer Center State (Director only)
    const [editCenter, setEditCenter] = useState('');
    const [transferLoading, setTransferLoading] = useState(false);

    // Course Correction State (Director only)`;
content = content.replace(stateInjectionPoint, stateToAdd);

// 2. Add handleTransferCenter logic
const logicInjectionPoint = `    // UPDATE COURSE/STANDARD (Director Only)`;
const logicToAdd = `    // TRANSFER ACADEMIC CENTER (Director Only)
    const handleTransferCenter = async () => {
        if (!editCenter || editCenter === student.centerId) return;
        const targetCenterName = CENTERS[editCenter]?.name || editCenter;
        
        if (!window.confirm(\`Transfer student to \${targetCenterName}?\\n\\nThis will re-generate their roll number, remove them from their current batch, and move them to the target center's database.\`)) return;
        
        setTransferLoading(true);
        try {
            // 1. Generate new roll number
            const prefix = editCenter === 'UN_NASHIK_RD' ? '110' : editCenter === 'PRAYAS' ? '112' : '111';
            const year = new Date().getFullYear().toString().substr(-2);
            let newRoll = "";
            let isUnique = false;
            let attempts = 0;
            while (!isUnique && attempts < 25) {
                const random = Math.floor(1000 + Math.random() * 9000);
                newRoll = \`\${prefix}\${year}\${random}\`;
                const qCheck = query(collection(db, "admissions"), where("rollNumber", "==", newRoll));
                const checkSnap = await getDocs(qCheck);
                if (checkSnap.empty) {
                    isUnique = true;
                }
                attempts++;
            }

            // 2. Update Admission Document
            await updateDoc(doc(db, 'admissions', student.id), { 
                centerId: editCenter,
                centerName: targetCenterName,
                rollNumber: newRoll,
                batchAssigned: null,
                batchId: null,
                batchName: null
            });

            // 3. Update Lead Document
            if (student.leadId) {
                const leadRef = doc(db, 'leads', student.leadId);
                await updateDoc(leadRef, {
                    centerId: editCenter,
                    batchAssigned: null,
                    timeline: arrayUnion({
                        type: "CENTER_TRANSFER",
                        result: "Center Transferred",
                        note: \`Student transferred to \${targetCenterName}. New Roll No: \${newRoll}. Batch unassigned.\`,
                        date: new Date(),
                        by: userProfile.name
                    }),
                    lastUpdated: serverTimestamp()
                });
            }

            clearAdmissionsCache();
            alert(\`Student successfully transferred to \${targetCenterName}!\\nNew Roll Number: \${newRoll}\\nBatch has been cleared.\`);
            if (refreshData) refreshData();
            onClose(); 
        } catch (err) {
            console.error(err);
            alert('Error transferring center: ' + err.message);
        }
        setTransferLoading(false);
    };

    // UPDATE COURSE/STANDARD (Director Only)`;
content = content.replace(logicInjectionPoint, logicToAdd);

// 3. Add UI
const uiInjectionPoint = `                                            {/* Correct Total Fee */}`;
const uiToAdd = `                                            {/* Transfer Center */}
                                            <div className="flex flex-col gap-1 bg-white border border-indigo-100 rounded-xl p-3">
                                                <label className="text-[9px] font-black uppercase tracking-wider text-indigo-400">Transfer Academic Center</label>
                                                <div className="flex gap-2">
                                                    <select
                                                        className="flex-1 py-1 px-2.5 bg-slate-50 border border-indigo-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                                                        value={editCenter}
                                                        onChange={(e) => setEditCenter(e.target.value)}
                                                    >
                                                        <option value="">-- Select Target Center --</option>
                                                        {Object.entries(CENTERS).map(([id, info]) => (
                                                            <option key={id} value={id}>{info.name}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={handleTransferCenter}
                                                        disabled={transferLoading || !editCenter || editCenter === student.centerId}
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-black transition disabled:opacity-40 whitespace-nowrap"
                                                    >
                                                        {transferLoading ? '...' : 'Transfer'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Correct Total Fee */}`;
content = content.replace(uiInjectionPoint, uiToAdd);

fs.writeFileSync(file, content, 'utf8');
console.log('StudentManager patched successfully!');
