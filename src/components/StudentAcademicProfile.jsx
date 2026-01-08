import React, { useState } from 'react';
import { Phone, Mail, User, MapPin, Edit } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';

const StudentAcademicProfile = ({ student, onClose, onUpdate }) => {
    const [localStudent, setLocalStudent] = useState(student);

    // DEEP FETCH: Recover Missing Counsellor Name from Original Lead
    React.useEffect(() => {
        const fetchDeepInfo = async () => {
            // Only fetch if name is missing or generic 'Team' or looks like a UID
            let currentName = localStudent.counsellorName || localStudent.counsellor || localStudent.bookedBy || localStudent.enteredBy || localStudent.createdBy || 'Team';

            // Check if current name is actually a UID (no spaces, long string, 20+ chars)
            const isUid = (name) => name && name.length > 20 && !name.includes(' ');

            if (!currentName || currentName === 'Team' || isUid(currentName)) {
                let recoveredName = null;

                try {
                    // Strategy 1: Fetch by Lead ID (if linked)
                    if (localStudent.leadId) {
                        const leadRef = doc(db, 'leads', localStudent.leadId);
                        const leadSnap = await getDoc(leadRef);
                        if (leadSnap.exists()) {
                            const leadData = leadSnap.data();
                            // Prefer explicit name field, then assignedTo (which might be UID), then enteredBy
                            recoveredName = leadData.assignedByName || leadData.assignedTo || leadData.sourceDetails?.enteredBy;
                        }
                    }

                    // Strategy 2: Fetch by Phone (Fallback if Strategy 1 failed or no Lead ID)
                    if ((!recoveredName || isUid(recoveredName)) && localStudent.phone) {
                        try {
                            const q = query(collection(db, 'leads'), where('phone', '==', localStudent.phone), limit(1));
                            const querySnap = await getDocs(q);
                            if (!querySnap.empty) {
                                const leadData = querySnap.docs[0].data();
                                recoveredName = leadData.assignedByName || leadData.assignedTo || leadData.sourceDetails?.enteredBy;
                            }
                        } catch (phoneErr) {
                            console.error("Phone Fetch Error:", phoneErr);
                        }
                    }

                    // Strategy 3: Resolve UID to Name (if we found a UID)
                    if (recoveredName && isUid(recoveredName)) {
                        try {
                            const userRef = doc(db, 'users', recoveredName);
                            // We need to fetch user doc. Note: 'users' collection access might require permission.
                            // Assuming 'users' collection stores user profiles by UID.
                            const userSnap = await getDoc(userRef);
                            if (userSnap.exists()) {
                                const userData = userSnap.data();
                                recoveredName = userData.name || userData.displayName || userData.email || 'Team';
                            }
                        } catch (uidErr) {
                            console.error("UID Resolve Error:", uidErr);
                        }
                    }

                    if (recoveredName && !isUid(recoveredName)) {
                        setLocalStudent(prev => ({
                            ...prev,
                            counsellorName: recoveredName // Update local state for display
                        }));
                    }
                } catch (err) {
                    console.error("Deep Fetch Error (Profile):", err);
                }
            }
        };

        fetchDeepInfo();
    }, [student]); // Run when student prop changes

    const handleChangeBatch = async () => {
        const newBatchName = prompt(`Enter new batch name for ${localStudent.studentName}:`, localStudent.batchAssigned || localStudent.batchName);

        if (newBatchName && newBatchName !== localStudent.batchAssigned) {
            try {
                const docRef = doc(db, "admissions", localStudent.id);
                await updateDoc(docRef, {
                    batchAssigned: newBatchName,
                    batchId: null // Reset Linked Batch ID since we are manually overriding text
                });

                // Update Local & Parent
                const updated = { ...localStudent, batchAssigned: newBatchName };
                setLocalStudent(updated);
                if (onUpdate) onUpdate(updated);

                alert("Batch Updated Successfully!");
            } catch (err) {
                console.error("Batch Update Error:", err);
                alert("Failed to update batch.");
            }
        }
    };

    if (!localStudent) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b flex justify-between items-start bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{localStudent.studentName}</h2>
                        <p className="text-slate-500 text-sm">Roll No: {localStudent.rollNumber || 'PENDING'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition">X</button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-2 bg-indigo-50 p-4 rounded-xl border border-indigo-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-xs uppercase font-bold text-indigo-400 mb-1">Current Course</p>
                            <p className="font-bold text-indigo-900 text-sm truncate">{localStudent.program}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase font-bold text-indigo-400 mb-1">Standard</p>
                            <p className="font-bold text-indigo-900 text-sm">{localStudent.standard || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase font-bold text-indigo-400 mb-1">Counsellor</p>
                            <p className="font-bold text-indigo-900 text-sm truncate" title={localStudent.counsellorName || localStudent.bookedBy}>
                                {localStudent.counsellorName || localStudent.counsellor || localStudent.bookedBy || localStudent.enteredBy || localStudent.createdBy || 'Team'}
                            </p>
                        </div>
                        <div className="md:text-right">
                            <p className="text-xs uppercase font-bold text-indigo-400 mb-1">Batch</p>
                            <div className="flex items-center md:justify-end gap-2">
                                <p className="font-bold text-indigo-900 text-sm">{localStudent.batchAssigned || localStudent.batchName || 'Not Assigned'}</p>
                                <button onClick={handleChangeBatch} className="text-indigo-600 hover:text-indigo-800" title="Change Batch">
                                    <Edit className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-800 border-b pb-2">Personal Details</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-400">DOB:</span> <span className="font-medium">{localStudent.dob || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">Gender:</span> <span className="font-medium">{localStudent.gender || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">Category:</span> <span className="font-medium">{localStudent.category || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">Aadhar:</span> <span className="font-medium">{localStudent.aadhar || 'N/A'}</span></div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-800 border-b pb-2">Contact Info</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /> <span className="font-medium">{localStudent.phone}</span></div>
                            <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /> <span className="font-medium">{localStudent.email || 'N/A'}</span></div>
                            <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-400" /> <span className="font-medium">Dad: {localStudent.parentPhone}</span></div>
                            <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-slate-400 mt-0.5" /> <span className="font-medium">{localStudent.address}, {localStudent.city}</span></div>
                        </div>
                    </div>

                    <div className="col-span-2 space-y-4">
                        <h4 className="font-bold text-slate-800 border-b pb-2">Background Info</h4>
                        <div className="grid grid-cols-2 text-sm gap-4">
                            <div>
                                <p className="text-xs text-slate-400 mb-1">Previous School</p>
                                <p className="font-medium">{localStudent.previousSchool || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 mb-1">Source</p>
                                <p className="font-medium">{localStudent.source || 'Walk-in'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900">Close</button>
                </div>
            </div>
        </div>
    );
};

export default StudentAcademicProfile;
