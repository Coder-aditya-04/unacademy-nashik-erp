import React, { useEffect, useState } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { AlertCircle, Phone, ArrowRight } from 'lucide-react';

const UpcomingDuesWidget = () => {
    const [dueList, setDueList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDues = async () => {
            // 1. Get Active Students
            const q = query(collection(db, "admissions"), where("status", "==", "ACTIVE"));
            const snapshot = await getDocs(q);
            const list = [];

            snapshot.forEach(doc => {
                const s = doc.data();
                const balance = s.amount - s.totalPaid;

                // Simple logic: If balance > 0, assume they are due (Refine this with actual schedule dates if you stored them)
                // For now, we show anyone with balance > 0 to keep cash flow high
                if (balance > 0) {
                    list.push({
                        id: doc.id,
                        name: s.studentName,
                        phone: s.phone,
                        balance: balance,
                        center: s.centerName
                    });
                }
            });
            setDueList(list.slice(0, 5)); // Show top 5
            setLoading(false);
        };
        fetchDues();
    }, []);

    if (loading) return <div className="p-4 text-xs">Loading Dues...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
            <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex justify-between items-center">
                <h3 className="font-bold text-red-800 flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4" /> Fee Recovery Priority
                </h3>
                <span className="text-[10px] bg-white px-2 py-1 rounded text-red-600 font-bold">Top 5</span>
            </div>

            <div className="divide-y divide-red-50">
                {dueList.map(item => (
                    <div key={item.id} className="p-3 flex justify-between items-center hover:bg-red-50/50">
                        <div>
                            <p className="font-bold text-gray-800 text-sm">{item.name}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {item.phone} • {item.center}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-bold text-red-600">₹{item.balance.toLocaleString()}</p>
                            <button
                                onClick={() => window.open(`https://wa.me/91${item.phone}?text=Reminder: Fee Due Rs.${item.balance}`, '_blank')}
                                className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                            >
                                WhatsApp
                            </button>
                        </div>
                    </div>
                ))}
                {dueList.length === 0 && <div className="p-4 text-center text-gray-400 text-sm">No pending dues!</div>}
            </div>
        </div>
    );
};

export default UpcomingDuesWidget;
