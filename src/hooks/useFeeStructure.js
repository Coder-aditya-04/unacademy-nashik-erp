import { useState, useEffect } from 'react';
import { fetchFeeStructures, seedInitialFeeData } from '../services/feeService';

export const useFeeStructure = () => {
    const [feeStructures, setFeeStructures] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadFees = async () => {
        setLoading(true);
        try {
            // 1. Try to fetch
            let data = await fetchFeeStructures();

            // 2. If empty, seed automatically (Self-healing)
            if (Object.keys(data).length === 0) {
                await seedInitialFeeData();
                data = await fetchFeeStructures();
            }

            setFeeStructures(data);
        } catch (err) {
            console.error("Failed to load fee structures", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFees();
    }, []);

    // Expose reload function for when updates happen
    return { feeStructures, loading, error, reloadFees: loadFees };
};
