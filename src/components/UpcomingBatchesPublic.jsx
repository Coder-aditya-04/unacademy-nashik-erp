import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

const UpcomingBatchesPublic = ({ onReserve }) => {
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

    const TONES = ['sage', 'blue', 'butter', 'lilac', 'coral', 'sage'];
    const when = (d) => { const t = new Date(d); return isNaN(t) ? (d || 'Soon') : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }); };
    return (
        <section className="max-w-6xl mx-auto px-4 sm:px-5 py-16 sm:py-20">
            <div className="mb-8">
                <p className="kap-eyebrow">Upcoming batches</p>
                <h2 className="jb-h text-[32px] sm:text-[40px] leading-tight mt-1">Pick your batch, save your seat</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {batches.map((batch, i) => (
                    <article key={batch.id} className="jb-card jb-lift jb-rise overflow-hidden flex flex-col" style={{ padding: 0, animationDelay: `${i * 60}ms` }}>
                        <div className="px-5 pt-5 pb-4" style={{ background: `var(--t-${TONES[i % TONES.length]})` }}>
                            <div className="flex items-center justify-between gap-2">
                                <span className="jb-tag" style={{ background: 'var(--panel)' }}>{String(batch.program || 'Course').replace(/_/g, ' ')}</span>
                                {batch.status === 'UPCOMING' && <span className="text-[12px] font-bold">Filling fast</span>}
                            </div>
                            <h3 className="jb-h text-[20px] mt-3 leading-tight">{batch.name}</h3>
                        </div>
                        <ul className="px-5 py-4 space-y-2 text-[14px] flex-1" style={{ color: 'var(--sub)' }}>
                            <li>📅 Starts <b style={{ color: 'var(--ink)' }}>{when(batch.startDate)}</b></li>
                            <li>⏰ {batch.timing || 'Timing to be announced'}</li>
                            <li>📍 {batch.centerName || 'Unacademy centre'}</li>
                        </ul>
                        <div className="px-5 pb-5">
                            <button type="button" onClick={onReserve} className="jb-act jb-act-ink w-full" style={{ padding: '12px 16px', fontSize: 14 }}>Reserve a seat →</button>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
};

export default UpcomingBatchesPublic;
