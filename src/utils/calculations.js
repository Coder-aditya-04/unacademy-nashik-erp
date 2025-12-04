import { PROGRAMS } from './feeData';

// 1. FEE CALCULATOR
export const calculateFee = (programKey, discountPercent) => {
    const data = PROGRAMS[programKey];
    if (!data) return null;

    const fixedComponents = data.reg + data.tech + data.exam;
    const discountDecimal = discountPercent / 100;
    const projectedFee = fixedComponents + (data.tuition * (1 - discountDecimal));

    const numerator = (projectedFee - data.fixedAmt) * 100;
    const rawCoupon = 100 - (numerator / data.basePrice);
    const couponCode = Math.floor(rawCoupon);

    const finalCouponPercent = 100 - couponCode;
    const landingFee = (data.basePrice * (finalCouponPercent / 100)) + data.fixedAmt;

    return {
        programName: data.name,
        originalTotal: data.total,
        discountInput: discountPercent,
        projectedFee: Math.round(projectedFee),
        couponApplied: couponCode,
        landingFee: Math.round(landingFee),

        // Export breakdown for UI
        fixedFee: fixedComponents,
        tuitionFee: data.tuition,
        programKey: programKey
    };
};

// 2. REFUND CALCULATOR (New Strict Logic)
export const calculateRefunds = (landingFee, projectedFee, programKey) => {
    const data = PROGRAMS[programKey];
    if (!data) return null;

    // Components
    const regFee = data.reg; // Fixed Deduction Anchor
    const nonRefundableSum = data.reg + data.tech + data.exam; // Used to find Tuition Base

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
        { period: "After 30 Days", deduction: `Rs. ${landingFee.toLocaleString()}`, refund: "No Refund" }
    ];
};

// 3. INSTALLMENT CALCULATOR (Standard + Reg Only Split)
export const calculateInstallments = (landingFee, programKey, paymentPlan) => {
    const data = PROGRAMS[programKey];
    if (!data) return [];

    const schedule = [];
    const totalInstallments = data.installments;

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
        // ... (Keep the exact code I gave you for REG_ONLY previously) ...
        // Copy-paste the REG_ONLY logic from the previous file here
        schedule.push({ id: "Down Pay", dueDate: "Upon Admission", amount: data.reg, status: "Due Now" });
        const balance = landingFee - data.reg;
        let s1, s2, s3;
        if (totalInstallments === 3) {
            s1 = Math.round(balance * 0.50); s2 = Math.round(balance * 0.25); s3 = balance - s1 - s2;
        } else {
            s1 = Math.round(balance * 0.60); s2 = balance - s1;
        }
        const d1 = new Date(); d1.setMonth(d1.getMonth() + 1);
        schedule.push({ id: 1, dueDate: d1.toLocaleDateString('en-IN'), amount: s1, status: "Future" });
        const d2 = new Date(d1); d2.setMonth(d2.getMonth() + data.intervalMonths);
        schedule.push({ id: 2, dueDate: d2.toLocaleDateString('en-IN'), amount: s2, status: "Future" });
        if (totalInstallments === 3) {
            // 3rd Installment is 6 months after 2nd Installment
            const d3 = new Date(d2); d3.setMonth(d3.getMonth() + 6);
            schedule.push({ id: 3, dueDate: d3.toLocaleDateString('en-IN'), amount: s3, status: "Future" });
        }
        return schedule;
    }

    // 3. STANDARD INSTALLMENTS
    // ... (Keep the exact code I gave you for Standard Installments previously) ...
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
            d.setMonth(d.getMonth() + data.intervalMonths + 6);
        } else {
            d.setMonth(d.getMonth() + (i * data.intervalMonths));
        }
        let amt = (i === 0) ? a1 : (i === 1) ? a2 : a3;
        schedule.push({ id: i + 1, dueDate: i === 0 ? "Upon Admission" : d.toLocaleDateString('en-IN'), amount: amt, status: i === 0 ? "Due Now" : "Future" });
    }

    return schedule;
};
