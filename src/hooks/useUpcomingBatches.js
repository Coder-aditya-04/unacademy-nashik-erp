import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

// Upcoming and running batches for the public home page.
export const useUpcomingBatches = () => {
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

    return { batches, loading };
};

