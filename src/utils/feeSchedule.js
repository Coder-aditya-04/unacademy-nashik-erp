// Estimated instalment schedule (moved from StudentManager, logic unchanged).
import { PROGRAMS } from './feeData';

// Helper: Estimate Schedule based on Program Type
export const estimateSchedule = (total, paid, startDate, programName = "", paymentPlan = "", feeStructures = null) => {
    const balance = total - paid;
    if (balance <= 0) return [];

    // NEW: LOAN PLAN LOGIC
    if (paymentPlan === 'LOAN') {
        const downPayment = Math.round(total * 0.25);
        const loanAmount = total - downPayment;

        // Loan Waterfall
        const schedule = [];
        let remainingPaid = paid;

        // 1. Down Payment
        let dpDue = downPayment;
        if (remainingPaid >= dpDue) {
            remainingPaid -= dpDue;
            dpDue = 0; // Paid
        } else {
            dpDue -= remainingPaid;
            remainingPaid = 0;
        }

        if (dpDue > 0) {
            const dpDate = startDate ? new Date(startDate) : new Date();
            const dpLabel = startDate ? `Due by ${new Date(startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : "Immediate";

            schedule.push({
                name: "Down Payment (25%)",
                date: dpDate.toISOString(),
                label: dpLabel,
                amount: dpDue,
                paid: false,
                isEstimate: true
            });
        }

        // 2. Loan Amount
        let loanDue = loanAmount;
        if (remainingPaid >= loanDue) {
            loanDue = 0; // Everything paid
        } else {
            loanDue -= remainingPaid;
        }

        if (loanDue > 0) {
            schedule.push({ name: "Loan Disbursement (75%)", date: new Date().toISOString(), label: "Upon Approval", amount: loanDue, paid: false, isEstimate: true });
        }

        return schedule;
    }

    // Fetch Custom Config First
    let targetPercents = [];
    let monthOffsets = [];
    const lookupData = feeStructures || PROGRAMS || {};
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
        // Check if 2-Year Program (e.g., 11th, 2Y)
        const pNameStr = (programName || "").toUpperCase();
        const isTwoYear = (pNameStr.includes("11TH") || pNameStr.includes("2Y") || pNameStr.includes("TWO") || pNameStr.includes("2 YEAR"));

        // Default Targets (1-Year): 60% - 40%
        targetPercents = [0.60, 0.40];
        monthOffsets = [0, 3]; // Months from start

        // Override for 2-Year: 50% - 25% - 25%
        if (isTwoYear) {
            targetPercents = [0.50, 0.25, 0.25];
            monthOffsets = [0, 3, 9]; // 0, 3 months, 9 months (6 months gap between 2nd & 3rd)
        }
    }

    // Calculate Target Amounts based on percentages
    let targets = targetPercents.map((p, i) => {
        if (i === targetPercents.length - 1) return 0; // Last one calculates remainder
        return Math.round(total * p);
    });
    // Set last target to ensure sum equals total (avoid rounding errors)
    const sumSoFar = targets.reduce((a, b) => a + b, 0);
    targets[targets.length - 1] = total - sumSoFar;

    const schedule = [];
    let remainingPaid = paid;

    targets.forEach((targetAmount, idx) => {
        // Determine Due Date
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + monthOffsets[idx]);

        // Waterfall Deduction
        let amountDue = targetAmount;
        if (remainingPaid >= amountDue) {
            remainingPaid -= amountDue;
            amountDue = 0; // Fully Paid
        } else {
            amountDue -= remainingPaid;
            remainingPaid = 0; // Partial or Full Due
        }

        if (amountDue > 0) {
            schedule.push({
                name: `${idx + 1}${idx === 0 ? 'st' : idx === 1 ? 'nd' : 'rd'} Installment`,
                date: dueDate.toISOString(),
                amount: amountDue,
                paid: false,
                isEstimate: true
            });
        }
    });

    return schedule;
};
