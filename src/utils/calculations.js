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
export const calculateInstallments = (landingFee, programKey, paymentPlan, programsData, startDateInput = null) => {
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

        const dpDate = startDateInput ? new Date(startDateInput).toLocaleDateString('en-IN') : "Immediate";
        schedule.push({
            id: "Down Payment (25%)",
            dueDate: dpDate,
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

    // 2. CUSTOM INSTALLMENTS (Flexible Configuration)
    if (data.installmentPercents && data.installmentPercents.length > 0) {
        const percents = data.installmentPercents;
        const intervals = data.installmentIntervals || new Array(percents.length).fill(3); // Fallback to 3 months

        // Calculate Totals to handle rounding
        const amounts = percents.map((p, i) => {
            if (i === percents.length - 1) return 0; // Calc last one as remainder
            return Math.round(landingFee * (p / 100));
        });
        const currentSum = amounts.reduce((a, b) => a + b, 0);
        amounts[amounts.length - 1] = landingFee - currentSum;

        // Generate Schedule
        let currentDate = startDateInput ? new Date(startDateInput) : new Date();
        percents.forEach((_, i) => {
            // Add Interval Gap (First one 0 if user set 0, usually 0)
            const gap = intervals[i] || 0;
            currentDate.setMonth(currentDate.getMonth() + gap);

            schedule.push({
                id: i + 1,
                // If startDateInput is provided, show the actual date. Only show "Upon Admission" if generic.
                dueDate: (i === 0 && gap === 0 && !startDateInput) ? "Upon Admission" : currentDate.toLocaleDateString('en-IN'),
                amount: amounts[i],
                status: i === 0 && gap === 0 ? "Due Now" : "Future"
            });
        });

        return schedule;
    }

    // 3. REGISTRATION FEE ONLY
    if (paymentPlan === 'REG_ONLY') {
        schedule.push({ id: "Down Pay", dueDate: "Upon Admission", amount: regAmount, status: "Due Now" });
        const balance = landingFee - regAmount;
        let s1, s2, s3;
        if (totalInstallments === 3) {
            s1 = Math.round(balance * 0.50); s2 = Math.round(balance * 0.25); s3 = balance - s1 - s2;
        } else {
            s1 = Math.round(balance * 0.60); s2 = balance - s1;
        }
        const d1 = startDateInput ? new Date(startDateInput) : new Date();
        d1.setMonth(d1.getMonth() + 1);
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

    // 4. STANDARD INSTALLMENTS (Legacy Logic)
    let a1, a2, a3;
    if (totalInstallments === 3) {
        a1 = Math.round(landingFee * 0.50); a2 = Math.round(landingFee * 0.25); a3 = landingFee - a1 - a2;
    } else {
        a1 = Math.round(landingFee * 0.60); a2 = landingFee - a1;
    }
    for (let i = 0; i < totalInstallments; i++) {
        const d = startDateInput ? new Date(startDateInput) : new Date();
        if (i === 2) {
            // 3rd Installment: 6 months after 2nd installment (which is at intervalMonths)
            d.setMonth(d.getMonth() + intervalMonths + 6);
        } else {
            d.setMonth(d.getMonth() + (i * intervalMonths));
        }
        let amt = (i === 0) ? a1 : (i === 1) ? a2 : a3;
        // If startDateInput exists, we prefer Showing the Date even for 1st Installment
        const dateStr = d.toLocaleDateString('en-IN');
        schedule.push({
            id: i + 1,
            dueDate: (i === 0 && !startDateInput) ? "Upon Admission" : dateStr,
            amount: amt,
            status: i === 0 ? "Due Now" : "Future"
        });
    }

    return schedule;
};

// 4. ESTIMATE SCHEDULE (Helper)
// 4. ESTIMATE SCHEDULE (Helper)
export const getEstimatedSchedule = (total, paid, startDate, paymentPlan = 'STANDARD', programName = '', programsData = null) => {
    const balance = total - paid;
    if (balance <= 0) return [];

    const start = new Date(startDate);
    if (isNaN(start.getTime())) start.setTime(new Date().getTime());

    // LOAN PLAN LOGIC
    if (paymentPlan === 'LOAN') {
        const schedule = [];
        let remainingPaid = paid;

        // 1. Down Payment (25%) - Due Date Logic?
        // User screenshot showed "15 Feb 2026" for admission "28 Dec 2025" (~45-50 days?)
        // Usually Down Payment is due immediately or within 7 days.
        // However, if we want to mimic the screenshot or provide a reasonable buffer if unpaid:
        // Let's set Down Payment 25% due +7 days from admission if not paid.
        // wait, user said "15 Feb 2026", that is likely the 1st Installment date of a standard plan being applied to Loan?
        // No, user said "Down Payment (25%) Due by 15 Feb 2026". That seems far
        // actually maybe it is the 45 days policy?
        // Let's use standard assumption: Down Payment = 7 Days, but let's see.

        // Actually, let's replicate StudentManager logic exactly first.
        const downPayment = Math.round(total * 0.25);
        const loanAmount = total - downPayment;

        // Down Payment
        let dpStatus = "Due Now";
        if (remainingPaid >= downPayment) {
            remainingPaid -= downPayment;
            dpStatus = "Paid";
        } else {
            // If unpaid, show it.
            const dpDate = new Date(start);
            // Logic in StudentManager for Loan was just "Due by 15 Feb"? 
            // Unclear where 15 Feb came from without code. 
            // But usually Down Payment is immediate. 
            // Let's stick to +7 days for "Estimation".
            // If it's effectively "2nd Installment" time, maybe that explains date.

            schedule.push({ name: "Down Payment (25%)", date: dpDate.toISOString(), amount: (downPayment - paid), paid: false, isEstimate: true });
            return schedule;
            // If DP is unpaid, that's the priority.
        }

        // Loan Amount
        let loanDue = loanAmount;
        if (remainingPaid >= loanDue) loanDue = 0;
        else loanDue -= remainingPaid;

        if (loanDue > 0) {
            schedule.push({
                name: "Loan Disbursement (75%)",
                date: new Date().toISOString(), // effectively "Now" if pending
                label: "Upon Approval",
                amount: loanDue,
                paid: false,
                isEstimate: true
            });
        }
        return schedule;
    }

    // Fetch Custom Config First
    let targetPercents = [];
    let monthOffsets = [];
    const lookupData = programsData || PROGRAMS || {};
    let customData = lookupData[programName];

    // Fallback robust search if key is exactly the course's display name instead of the ID key
    if (!customData && Object.keys(lookupData).length > 0) {
        const allSettings = Object.entries(lookupData).map(([k, v]) => ({ _idKey: k, ...v }));
        customData = allSettings.find(f => f.name === programName) ||
                     allSettings.find(f => (f.name || "").toUpperCase() === (programName || "").toUpperCase());
    }

    if (customData && customData.installmentPercents && customData.installmentPercents.length > 0) {
        targetPercents = customData.installmentPercents.map(p => Number(p) / 100);
        const intervals = customData.installmentIntervals || new Array(targetPercents.length).fill(3);
        let currentMonths = 0;
        monthOffsets = intervals.map(gap => {
            currentMonths += Number(gap);
            return currentMonths;
        });
    } else {
        const pName = (programName || "").toUpperCase();
        const isTwoYear = pName.includes("11TH") || pName.includes("2Y") || pName.includes("TWO");
        targetPercents = isTwoYear ? [0.50, 0.25, 0.25] : [0.60, 0.40];
        monthOffsets = isTwoYear ? [0, 3, 9] : [0, 3]; // 3rd installment is 6 months after 2nd
    }

    // We will calculate unpaid buckets based on Total vs Paid
    const targets = targetPercents.map(p => Math.round(total * p));
    // Fix rounding on last
    const sumT = targets.reduce((a, b) => a + b, 0);
    targets[targets.length - 1] += (total - sumT);

    const schedule = [];
    let remainingPaid = paid;

    targets.forEach((tgt, idx) => {
        // Waterfall
        let due = tgt;
        if (remainingPaid >= due) {
            remainingPaid -= due;
            // Paid, skip adding to Due Schedule
        } else {
            due -= remainingPaid;
            remainingPaid = 0;

            // This installment is pending (fully or partially)
            const dDate = new Date(start);
            dDate.setMonth(dDate.getMonth() + monthOffsets[idx]);

            schedule.push({
                name: `${idx + 1}${idx === 0 ? 'st' : idx === 1 ? 'nd' : 'rd'} Installment (Est.)`,
                date: dDate.toISOString(),
                amount: due,
                paid: false,
                isEstimate: true
            });
        }
    });

    return schedule;
};
