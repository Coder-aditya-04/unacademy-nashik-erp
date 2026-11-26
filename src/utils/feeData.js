export const PROGRAMS = {
    "CLASS_8": {
        name: "Class 8 Foundation",
        reg: 15000,
        tech: 10000,
        exam: 5000,
        tuition: 50000,
        total: 80000,
        basePrice: 80000,  // UPDATED: Matches Total Fee
        fixedAmt: 7500,
        installments: 2,
        intervalMonths: 3
    },
    "CLASS_9": {
        name: "Class 9 Foundation",
        reg: 15000,
        tech: 10000,
        exam: 5000,
        tuition: 55000,
        total: 85000,
        basePrice: 85000,  // UPDATED: Matches Total Fee
        fixedAmt: 7500,
        installments: 2,
        intervalMonths: 3
    },
    "CLASS_10": {
        name: "Class 10 Foundation",
        reg: 15000,
        tech: 10000,
        exam: 5000,
        tuition: 60000,
        total: 90000,
        basePrice: 90000,  // UPDATED: Matches Total Fee
        fixedAmt: 7500,
        installments: 2,
        intervalMonths: 3
    },
    "NEET_JEE_1Y": {
        name: "NEET/JEE 1 Year",
        reg: 20000,
        tech: 10000,
        exam: 5000,
        tuition: 135000,
        total: 170000,
        basePrice: 170000, // UPDATED: Matches Total Fee
        fixedAmt: 7500,
        installments: 2,
        intervalMonths: 3
    },
    "NEET_JEE_2Y": {
        name: "NEET/JEE 2 Year",
        reg: 30000,
        tech: 20000,
        exam: 10000,
        tuition: 240000,
        total: 300000,
        basePrice: 300000, // UPDATED: Matches Total Fee
        fixedAmt: 15000,
        installments: 3,
        intervalMonths: 3
    },
    // NEW: Explicit MHT CET Structures (Mirroring NEET/JEE)
    "MHT_CET_12": {
        name: "MHT CET (1 Year)",
        reg: 20000,
        tech: 10000,
        exam: 5000,
        tuition: 135000,
        total: 170000,
        basePrice: 170000,
        fixedAmt: 7500,
        installments: 2,
        intervalMonths: 3
    },
    "MHT_CET_11": {
        name: "MHT CET (2 Year)",
        reg: 30000,
        tech: 20000,
        exam: 10000,
        tuition: 240000,
        total: 300000,
        basePrice: 300000,
        fixedAmt: 15000,
        installments: 3,
        intervalMonths: 3
    }
};

// Hostel fees (sent by Aditya, 21 Nov 2026). These are only the starting
// values: Director and Accounts change them in Fee structures > Hostel, which
// saves to settings/hostel_fees. Kept separate from the course fee.
export const HOSTEL = {
    deposit: 15000, // fixed security deposit, paid once
    includes: '3 meals a day, Wi-Fi and all hostel facilities',
    plans: [
        { id: 'GIRLS', name: 'Girls hostel', yearly: 160000, monthly: 14500 },
        { id: 'BOYS', name: 'Boys hostel', yearly: 145000, monthly: 13000 },
    ],
};
export const HOSTEL_BILLING = [{ value: 'YEARLY', label: 'Yearly' }, { value: 'MONTHLY', label: 'Monthly' }];
// Amount for one plan and billing, or null when not set.
export const hostelAmount = (fees, planId, billing = 'YEARLY') => {
    const p = (fees?.plans || []).find(x => x.id === planId) || fees?.plans?.[0];
    if (!p) return null;
    const n = Number(billing === 'MONTHLY' ? p.monthly : p.yearly);
    return Number.isFinite(n) && n > 0 ? n : null;
};
