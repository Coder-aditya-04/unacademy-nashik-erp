import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export const fetchDirectorStats = async (centerFilter = 'ALL') => {
    try {
        const admissionsRef = collection(db, "admissions");
        // STRATEGY CHANGE: Fetch ALL and filter in JS to ensure accuracy
        // Aligning query with DirectorDashboard for consistency
        const q = query(admissionsRef, orderBy("createdAt", "desc"));
        // We will apply the filter inside the loop below

        const snapshot = await getDocs(q);

        // Calculate Loop
        window.statsDebug = { scanned: 0, snapshotSize: snapshot.size, matched: 0, rejected: [], errors: [] };
        let totalRevenue = 0;
        let todayRevenue = 0; // New
        let pendingDues = 0;
        let totalStudents = 0;
        let recentTransactions = [];

        // Calculate Loop
        window.statsDebug = { scanned: 0, matched: 0, rejected: [], errors: [] };

        snapshot.forEach(doc => {
            try {
                window.statsDebug.scanned++;
                const data = doc.data();

                // SAFETY CHECK: Robust Filtering for Manager / Director Stats
                // Convert to string to avoid crash on numbers
                const rCenterId = String(data.centerId || "").trim().toUpperCase();
                const rCenterName = String(data.centerName || "").trim().toUpperCase();
                const filter = (centerFilter || "").trim().toUpperCase();

                // Skip if filter is active AND doesn't match ID or Name
                if (centerFilter !== 'ALL' && filter) {
                    // Check exact match on ID or partial on Name (Bi-directional)
                    const isMatch =
                        rCenterId === filter ||
                        (filter === 'UN_COLLEGE' && (rCenterId === "" || rCenterId === "UN_COLLEGE" || rCenterId.includes("COLLEGE") || rCenterName.includes("COLLEGE"))) ||
                        (filter === 'UN_NASHIK_RD' && (rCenterId === "UN_NASHIK_RD" || rCenterId.includes("NASHIK RD") || rCenterName.includes("NASHIK RD") || rCenterName.includes("JAIL"))) ||
                        (rCenterName && filter && (rCenterName.includes(filter) || filter.includes(rCenterName)));

                    if (!isMatch) {
                        window.statsDebug.rejected.push(doc.id + ":" + rCenterId);
                        return;
                    }
                }

                window.statsDebug.matched++;
                totalStudents++;
                totalRevenue += (data.totalPaid || 0);

                // Calculate Today's Revenue
                const today = new Date();
                const txnDate = data.createdAt ? new Date(data.createdAt.seconds * 1000) : null;
                if (txnDate && txnDate.getDate() === today.getDate() && txnDate.getMonth() === today.getMonth() && txnDate.getFullYear() === today.getFullYear()) {
                    todayRevenue += (data.totalPaid || 0);
                }

                // Calculate Pending
                const agreedFee = data.amount || 0;
                const paid = data.totalPaid || 0;
                if (agreedFee > paid) {
                    pendingDues += (agreedFee - paid);
                }
            } catch (innerErr) {
                window.statsDebug.errors.push(doc.id + ":" + innerErr.message);
            }

            // Add to recent list (if needed)
            if (data.status === 'ACTIVE' || data.status === 'TOKEN_PAID') {
                recentTransactions.push({
                    id: doc.id,
                    name: data.studentName,
                    paid: data.totalPaid,
                    center: data.centerName,
                    date: data.createdAt
                });
            }
        });

        // Sort transactions by date (newest first)
        recentTransactions.sort((a, b) => b.date - a.date);

        return {
            revenue: totalRevenue,
            todayRevenue: todayRevenue, // New Field
            students: totalStudents,
            pending: pendingDues,
            recent: recentTransactions.slice(0, 5) // Top 5 recent
        };

    } catch (error) {
        console.error("Stats Error:", error);
        return { revenue: 0, students: 0, pending: 0, recent: [] };
    }
};

export const fetchStaffPerformance = async (centerFilter = 'ALL') => {
    try {
        const leadsRef = collection(db, "leads");
        let q;

        if (centerFilter !== 'ALL') {
            q = query(leadsRef, where("centerId", "==", centerFilter));
        } else {
            q = query(leadsRef);
        }

        const snapshot = await getDocs(q);

        // Data Structure: { "Rohan": { leads: 10, converted: 2, revenue: 5000 } }
        const staffStats = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            const staffName = data.assignedByName || "Unassigned";

            // Initialize if new staff found
            if (!staffStats[staffName]) {
                staffStats[staffName] = { name: staffName, leads: 0, counselled: 0, converted: 0, revenue: 0 };
            }

            // 1. Count Total Leads
            staffStats[staffName].leads += 1;

            // 2. Count "Counselled" (Worked) Leads - Status is NOT 'NEW'
            if (data.status !== 'NEW') {
                staffStats[staffName].counselled += 1;
            }

            // 3. Count Conversions
            if (data.status === 'CONVERTED' || data.status === 'ADMITTED' || data.status === 'TOKEN_PAID') {
                staffStats[staffName].converted += 1;

                // 4. Track Revenue (If we saved it in the lead doc, otherwise approx from admission)
                // For accurate revenue, we'd query 'admissions', but for this report, lead count is priority.
                // Let's rely on 'budgetQuoted' if converted, or just count numbers for now.
            }
        });

        // Convert object to array for table
        return Object.values(staffStats)
            .filter(staff => {
                const name = staff.name.toLowerCase();
                // Filter out Admin/Dev names and generic placeholders
                return !name.includes('aditya dhondge') && !name.includes('unknown') && !name.includes('admin');
            })
            .map(staff => {
                // Conversion Rate based on COUNSELLED (Worked) Leads, not Total Assigned
                const denominator = staff.counselled > 0 ? staff.counselled : (staff.leads > 0 ? staff.leads : 1);
                return {
                    ...staff,
                    conversionRate: ((staff.converted / denominator) * 100).toFixed(1)
                };
            })
            .sort((a, b) => b.converted - a.converted); // Sort by highest conversions

    } catch (error) {
        console.error("Performance Error:", error);
        return [];
    }
};

// 3. FETCH BDE PERFORMANCE (Leads Generated)
export const fetchBDEStats = async (centerFilter = 'ALL') => {
    try {
        const leadsRef = collection(db, "leads");
        let q;

        // Query Leads
        if (centerFilter !== 'ALL') {
            q = query(leadsRef, where("centerId", "==", centerFilter));
        } else {
            q = query(leadsRef);
        }

        const snapshot = await getDocs(q);
        const bdeStats = {};

        snapshot.forEach(doc => {
            const data = doc.data();

            // Only count if Source is BDE (or BDE_FORM)
            if (data.source === 'BDE' || data.source === 'BDE_FORM') {
                // HANDLE BOTH STRING AND OBJECT FORMATS
                let bdeName = "Unknown BDE";

                if (data.sourceDetails && typeof data.sourceDetails === 'string') {
                    bdeName = data.sourceDetails.trim();
                } else if (data.sourceDetails?.enteredBy) {
                    bdeName = data.sourceDetails.enteredBy.trim();
                }

                // Skip empty names
                if (!bdeName) return;

                if (!bdeStats[bdeName]) {
                    bdeStats[bdeName] = { name: bdeName, leadsGenerated: 0, visits: 0, converted: 0 };
                }

                // Count Generation
                bdeStats[bdeName].leadsGenerated += 1;

                // Count Visits (Funnel: Visited -> Counselling -> Converted)
                if (['VISITED', 'COUNSELLING_DONE', 'CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN'].includes(data.status)) {
                    bdeStats[bdeName].visits += 1;
                }

                // Count Conversion
                if (['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN'].includes(data.status)) {
                    bdeStats[bdeName].converted += 1;
                }
            }
        });

        // Return Array Sorted by Leads Generated
        return Object.values(bdeStats)
            .filter(item => item.name !== "Unknown BDE") // Hide unknown entries
            .sort((a, b) => b.leadsGenerated - a.leadsGenerated);

    } catch (error) {
        console.error("BDE Stats Error:", error);
        return [];
    }
};
