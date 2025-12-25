import { PROGRAMS } from './feeData';
import { COLLEGES } from './collegeData'; // Import Colleges

// 1. FEE CALCULATOR
export const calculateFee = (programKey, discountPercent, collegeKey = "NONE", programsData) => {
    // Fallback or Error Handling
    if (!programsData || !programsData[programKey]) {
        console.warn(`Program key "${programKey}" not found in provided data.`);
        return null; // Handle smoothly in UI
    }

    const data = programsData[programKey];
    const collegeData = COLLEGES[collegeKey] || COLLEGES["NONE"];

    // 1. Coaching Math
    const fixedComponents = Number(data.reg) + Number(data.tech) + Number(data.exam);
    const discountDecimal = discountPercent / 100;
    const projectedFee = fixedComponents + (Number(data.tuition) * (1 - discountDecimal));

    const numerator = (projectedFee - Number(data.fixedAmt)) * 100;
    const rawCoupon = 100 - (numerator / Number(data.basePrice));
    const couponCode = Math.floor(rawCoupon);

    const finalCouponPercent = 100 - couponCode;
    const coachingLandingFee = (Number(data.basePrice) * (finalCouponPercent / 100)) + Number(data.fixedAmt);

    // 2. Add College Fee (Pass-through amount)
    const grandTotal = Math.round(coachingLandingFee + collegeData.fee);

    return {
        programName: data.name,
        originalTotal: Number(data.total),
        discountInput: discountPercent,
        projectedFee: Math.round(projectedFee),
        couponApplied: couponCode,
        landingFee: Math.round(coachingLandingFee), // Just Coaching

        // College Data
        collegeName: collegeData.name,
        collegeFee: collegeData.fee,
        grandTotal: grandTotal, // Coaching + College

        fixedFee: fixedComponents,
        tuitionFee: Number(data.tuition),
        programKey: programKey
    };
};

// 2. REFUND CALCULATOR (New Strict Logic)
export const calculateRefunds = (landingFee, projectedFee, programKey, programsData) => {
    // 1. Resolve Data: Robust Match
    let data;
    if (programsData) {
        // Try exact key match
        if (programsData[programKey]) {
            data = programsData[programKey];
        } else {
            // Fallback: Loop to find by name (approximate, case-insensitive, trimmed)
            const targetName = String(programKey || "").trim().toLowerCase();
            const foundKey = Object.keys(programsData).find(k =>
                (programsData[k].name || "").trim().toLowerCase() === targetName
            );

            if (foundKey) data = programsData[foundKey];

            // Second Fallback: If still not found, try to find by Partial Match if simple name fails
            if (!data) {
                const partialKey = Object.keys(programsData).find(k =>
                    (programsData[k].name || "").toLowerCase().includes(targetName)
                );
                if (partialKey) data = programsData[partialKey];
            }
        }
    }

    // FINAL FAIL-SAFE: If still no data found, construct a generic one based on Amount
    if (!data) {
        const isHighFee = landingFee > 100000;
        data = {
            reg: isHighFee ? 30000 : 15000,
            tech: isHighFee ? 20000 : 10000,
            exam: isHighFee ? 10000 : 5000,
            tuition: Math.max(0, landingFee - (isHighFee ? 60000 : 30000))
        };
    }

    if (!data) return [];

    // Components
    const regFee = Number(data.reg); // Fixed Deduction Anchor
    const nonRefundableSum = Number(data.reg) + Number(data.tech) + Number(data.exam); // Used to find Tuition Base

    // "Tuition Portion" = Total Paid - (Reg + Tech + Exam)
    // HYBRID LOGIC: Use Projected Fee for Tuition Base Calculation
    const tuitionPortion = projectedFee - nonRefundableSum;

    // Safety: If fee is too low, no refund
    if (tuitionPortion <= 0) return [{ period: "Any Time", deduction: "100%", refund: "Rs. 0" }];

    // RULE 1: 0-7 Days
    // Logic: Fixed Deduction (Reg Fee) + 0 Variable
    const deduction7 = regFee;
    const refund7 = landingFee - deduction7;

    // RULE 2: 7-15 Days
    // Logic: Fixed Deduction (Reg Fee) + 15% of Tuition Portion
    const variableDed15 = Math.round(tuitionPortion * 0.15);
    const totalDed15 = regFee + variableDed15;
    const refund15 = landingFee - totalDed15;

    // RULE 3: 15-30 Days
    // Logic: Fixed Deduction (Reg Fee) + 30% of Tuition Portion
    const variableDed30 = Math.round(tuitionPortion * 0.30);
    const totalDed30 = regFee + variableDed30;
    const refund30 = landingFee - totalDed30;

    return [
        { period: "0 - 7 Days", deduction: `Rs. ${deduction7.toLocaleString()}`, refund: `Rs. ${refund7.toLocaleString()}` },
        { period: "7 - 15 Days", deduction: `Rs. ${totalDed15.toLocaleString()}`, refund: `Rs. ${refund15.toLocaleString()}` },
        { period: "15 - 30 Days", deduction: `Rs. ${totalDed30.toLocaleString()}`, refund: `Rs. ${refund30.toLocaleString()}` },
        { period: "After 30 Days", deduction: "No Refund (100% Deduction)", refund: "No Refund" }
    ];
};

// 3. INSTALLMENT CALCULATOR (Standard + Reg Only Split)
export const calculateInstallments = (landingFee, programKey, paymentPlan, programsData) => {
    if (!programsData || !programsData[programKey]) return [];
    const data = programsData[programKey];

    const schedule = [];
    const totalInstallments = Number(data.installments);
    const regAmount = Number(data.reg);
    const intervalMonths = Number(data.intervalMonths);

    // 1. LOAN MODE (New)
    if (paymentPlan === 'LOAN') {
        const downPayment = Math.round(landingFee * 0.25); // 25%
        const loanAmount = landingFee - downPayment;       // 75%

        schedule.push({
            id: "Down Payment (25%)",
            dueDate: "Immediate",
            amount: downPayment,
            status: "Due Now"
        });

        schedule.push({
            id: "Loan Amount (75%)",
            dueDate: "Disbursed by Bank",
            amount: loanAmount,
            status: "Financed"
        });

        return schedule;
    }

    // 2. REGISTRATION FEE ONLY
    if (paymentPlan === 'REG_ONLY') {
        schedule.push({ id: "Down Pay", dueDate: "Upon Admission", amount: regAmount, status: "Due Now" });
        const balance = landingFee - regAmount;
        let s1, s2, s3;
        if (totalInstallments === 3) {
            s1 = Math.round(balance * 0.50); s2 = Math.round(balance * 0.25); s3 = balance - s1 - s2;
        } else {
            s1 = Math.round(balance * 0.60); s2 = balance - s1;
        }
        const d1 = new Date(); d1.setMonth(d1.getMonth() + 1);
        schedule.push({ id: 1, dueDate: d1.toLocaleDateString('en-IN'), amount: s1, status: "Future" });
        const d2 = new Date(d1); d2.setMonth(d2.getMonth() + intervalMonths);
        schedule.push({ id: 2, dueDate: d2.toLocaleDateString('en-IN'), amount: s2, status: "Future" });
        if (totalInstallments === 3) {
            // 3rd Installment is 6 months after 2nd Installment
            const d3 = new Date(d2); d3.setMonth(d3.getMonth() + 6);
            schedule.push({ id: 3, dueDate: d3.toLocaleDateString('en-IN'), amount: s3, status: "Future" });
        }
        return schedule;
    }

    // 3. STANDARD INSTALLMENTS
    let a1, a2, a3;
    if (totalInstallments === 3) {
        a1 = Math.round(landingFee * 0.50); a2 = Math.round(landingFee * 0.25); a3 = landingFee - a1 - a2;
    } else {
        a1 = Math.round(landingFee * 0.60); a2 = landingFee - a1;
    }
    for (let i = 0; i < totalInstallments; i++) {
        const d = new Date();
        if (i === 2) {
            // 3rd Installment: 6 months after 2nd installment (which is at intervalMonths)
            d.setMonth(d.getMonth() + intervalMonths + 6);
        } else {
            d.setMonth(d.getMonth() + (i * intervalMonths));
        }
        let amt = (i === 0) ? a1 : (i === 1) ? a2 : a3;
        schedule.push({ id: i + 1, dueDate: i === 0 ? "Upon Admission" : d.toLocaleDateString('en-IN'), amount: amt, status: i === 0 ? "Due Now" : "Future" });
    }

    return schedule;
};

// 4. ESTIMATE SCHEDULE (Helper)
export const getEstimatedSchedule = (total, paid, startDate) => {
    const balance = total - paid;
    if (balance <= 0) return [];

    const d2 = new Date(startDate);
    // Safety check for invalid date
    if (isNaN(d2.getTime())) {
        const now = new Date();
        d2.setTime(now.getTime());
    }
    d2.setDate(d2.getDate() + 30);

    const d3 = new Date(d2); // Base 3rd off 2nd date base roughly? Or similar logic
    // Actually StudentManager logic was: startDate + 30, startDate + 90
    d3.setTime(d2.getTime());
    d3.setDate(d3.getDate() + 60); // +60 days from d2 = +90 from start

    const i2 = Math.round(balance * 0.60);
    const i3 = balance - i2;

    return [
        { name: "2nd Installment (Est.)", date: d2.toISOString(), amount: i2, paid: false, isEstimate: true },
        { name: "3rd Installment (Est.)", date: d3.toISOString(), amount: i3, paid: false, isEstimate: true }
    ];
};
