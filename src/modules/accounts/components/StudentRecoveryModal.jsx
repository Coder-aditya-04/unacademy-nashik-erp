import React, { useState, useEffect } from 'react';
import { X, Phone, Calendar, Clock, Send, MessageSquare } from 'lucide-react';
import { db } from '../../../firebase';
import { doc, updateDoc, arrayUnion, Timestamp, getDoc } from 'firebase/firestore';
import { clearAdmissionsCache } from '../../../services/cacheService';


const StudentRecoveryModal = ({ student, userProfile, onClose }) => {
    const [remark, setRemark] = useState('');
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch Timeline on Mount
    useEffect(() => {
        const fetchTimeline = async () => {
            if (student?.id) {
                try {
                    const docRef = doc(db, "admissions", student.id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setTimeline(docSnap.data().recoveryTimeline || []);
                    }
                } catch (err) {
                    console.error("Error fetching timeline:", err);
                }
            }
        };
        fetchTimeline();
    }, [student]);

    const handleAddRemark = async () => {
        if (!remark.trim()) return;
        setLoading(true);

        const newEntry = {
            message: remark,
            date: new Date(),
            by: userProfile?.name || userProfile?.role || "Staff",
            type: "REMARK"
        };

        try {
            const docRef = doc(db, "admissions", student.id);
            await updateDoc(docRef, {
                recoveryTimeline: arrayUnion(newEntry)
            });
            clearAdmissionsCache();
            setTimeline([newEntry, ...timeline]); // Optimistic Update
            setRemark('');
        } catch (err) {
            alert("Failed to save remark");
        }
        setLoading(false);
    };

    if (!student) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in duration-200">

                {/* Header */}
                <div className="bg-slate-900 text-white p-4 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold">{student.name}</h2>
                        <div className="flex items-center gap-2 text-slate-300 text-sm mt-1">
                            <span className="bg-slate-800 px-2 py-0.5 rounded text-xs">{student.batch}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {student.phone}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition"><X className="w-5 h-5" /></button>
                </div>

                {/* Due Info Card */}
                <div className="p-4 bg-red-50 border-b border-red-100">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-red-600 uppercase tracking-wide">Pending Due</span>
                        <span className="text-xl font-bold text-red-700">₹{student.amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-red-800 bg-white/50 p-2 rounded-lg border border-red-100">
                        <Calendar className="w-4 h-4 text-red-500" />
                        <span className="font-semibold">{student.dueLabel || "Installment"}</span>
                        <span className="opacity-70">due on</span>
                        <span className="font-bold">{student.dueDate}</span>
                    </div>
                </div>

                {/* Timeline / Remarks */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                        <Clock className="w-3 h-3" /> Interaction History
                    </h3>

                    {timeline.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-sm italic">
                            No remarks yet. Start the conversation.
                        </div>
                    ) : (
                        timeline.map((item, idx) => (
                            <div key={idx} className="flex gap-3 text-sm">
                                <div className="mt-1 min-w-[24px] h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                    {item.by?.[0] || "U"}
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 flex-1">
                                    <p className="text-slate-700">{item.message}</p>
                                    <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                                        <span>{item.by}</span>
                                        <span>{new Date(item.date.seconds ? item.date.seconds * 1000 : item.date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Action */}
                <div className="p-3 bg-white border-t border-slate-100">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="flex-1 border bg-slate-50 border-slate-200 rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Add call remark..."
                            value={remark}
                            onChange={e => setRemark(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddRemark()}
                        />
                        <button
                            onClick={handleAddRemark}
                            disabled={loading || !remark.trim()}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                            onClick={() => window.open(`tel:${student.phone}`)}
                            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-semibold transition"
                        >
                            <Phone className="w-4 h-4" /> Call Now
                        </button>
                        <button
                            onClick={() => {
                                const msg = `Namaste! Reminder: Fee of ₹${student.amount} for ${student.name} is due on ${student.dueDate}.`;
                                window.open(`https://wa.me/91${student.phone}?text=${encodeURIComponent(msg)}`, '_blank');
                            }}
                            className="flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 py-2 rounded-lg text-sm font-semibold transition"
                        >
                            <MessageSquare className="w-4 h-4" /> WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentRecoveryModal;
