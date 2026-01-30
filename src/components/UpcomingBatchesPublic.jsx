import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Calendar, MapPin, ArrowRight, BookOpen, Clock } from 'lucide-react';

const UpcomingBatchesPublic = () => {
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBatches = async () => {
            try {
                // Fetch UPCOMING or ACTIVE batches that started recently
                // Ideally, we filter by 'status' == 'UPCOMING'
                const q = query(
                    collection(db, "batches"),
                    where("status", "in", ["UPCOMING", "ACTIVE"]),
                    limit(6) // Limit to 6 cards
                );

                const snapshot = await getDocs(q);
                const list = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Client-side filter for dates (if needed) and sorting
                // Sort by Start Date
                list.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

                setBatches(list);
            } catch (error) {
                console.error("Error loading batches:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBatches();
    }, []);

    if (loading) return null; // Don't show anything while loading to act as "skeleton" or just simple fade in
    if (batches.length === 0) return null;

    return (
        <section className="py-20 bg-slate-50">
            <div className="max-w-7xl mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-black text-slate-800 mb-4 font-outfit">
                        Upcoming <span className="text-indigo-600">Batches</span>
                    </h2>
                    <p className="text-slate-600 max-w-2xl mx-auto">
                        Don't miss out! Secure your seat in our next commencing batches for JEE, NEET, and Foundation courses.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {batches.map(batch => (
                        <div key={batch.id} className="bg-white rounded-2xl p-6 shadow-xl shadow-slate-200 hover:shadow-2xl hover:-translate-y-1 transition-all group border border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                    {batch.program || "Course"}
                                </span>
                                {batch.status === 'UPCOMING' && (
                                    <span className="flex items-center gap-1 text-orange-600 font-bold text-xs animate-pulse">
                                        <Clock className="w-3 h-3" /> Closing Soon
                                    </span>
                                )}
                            </div>

                            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
                                {batch.name}
                            </h3>

                            <div className="space-y-3 text-sm text-slate-600 mb-6">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-indigo-400" />
                                    <span>Starts: <span className="font-bold text-slate-800">{batch.startDate}</span></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-indigo-400" />
                                    <span>Time: {batch.timing || "To be announced"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-indigo-400" />
                                    <span>{batch.centerName || "Unacademy Center"}</span>
                                </div>
                            </div>

                            <button className="w-full py-3 rounded-xl bg-slate-50 text-indigo-600 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors flex items-center justify-center gap-2">
                                Reserve Seat <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default UpcomingBatchesPublic;
