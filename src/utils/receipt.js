// The official fee receipt: the same PDF the current software prints
// (generateTaxInvoice), used from Student records and the receipt page.
import { CENTERS } from './centers';
import { calculateRefunds } from './calculations';
import { PROGRAMS } from './feeData';
import { estimateSchedule } from './feeSchedule';

export const downloadOfficialReceipt = async (student, idx, feeStructures = null) => {
    const pays = student.payments || [];
    const pay = pays[idx];
    if (!pay) throw new Error('Payment not found');
    const center = CENTERS[student.centerId] || CENTERS.UN_COLLEGE;
    const cumulativePaid = pays.slice(0, idx + 1).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const allPaymentsSum = pays.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const legacyInitial = Math.max(0, (student.totalPaid || 0) - allPaymentsSum);
    const historicalPaid = legacyInitial + cumulativePaid;
    const historicalStudent = { ...student, totalPaid: historicalPaid };
    const startDate = student.enrollmentDate ? new Date(student.enrollmentDate) : (student.createdAt?.seconds ? new Date(student.createdAt.seconds * 1000) : new Date());
    const schedule = estimateSchedule(student.amount || 0, historicalPaid, startDate, student.program || student.standard, student.paymentPlan, feeStructures);
    // jsPDF is large; load it only when a receipt is printed.
    const { generateTaxInvoice } = await import('./pdfGenerator');
    await generateTaxInvoice(historicalStudent, { amount: pay.amount, mode: pay.mode || 'Cash', type: pay.type || 'Installment' },
        center, schedule, calculateRefunds(student.amount, student.projectedFee || student.amount, student.programKey || student.program, PROGRAMS));
};
