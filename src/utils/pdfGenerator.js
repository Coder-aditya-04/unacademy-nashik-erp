import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CENTERS } from './centers'; // Import central config

// Helper to load image securely
const loadImage = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = (e) => resolve(null); // Return null if image fails, don't crash
    });
};

// 1. ADMISSION QUOTE (Existing)
export const generateAdmissionPDF = async (studentDetails, feeResult, schedule, centerInfo, refunds) => {
    const doc = new jsPDF();

    // Load Logo
    try {
        const logoImg = await loadImage(centerInfo.logoPath);
        if (logoImg) doc.addImage(logoImg, 'PNG', 14, 10, 35, 15);
    } catch (e) { console.warn("Logo error"); }

    // Header Details
    doc.setFontSize(10);
    doc.setTextColor(50);
    const dateStr = new Date().toLocaleDateString('en-IN');
    const receiptNo = "QT-" + Math.floor(Math.random() * 100000);

    doc.text(`Date: ${dateStr}`, 140, 15);
    doc.text(`Ref No: ${receiptNo}`, 140, 20);

    // Address Section
    doc.setFontSize(16);
    doc.setTextColor(centerInfo.color[0], centerInfo.color[1], centerInfo.color[2]);
    doc.text(centerInfo.name, 14, 35);

    doc.setFontSize(9);
    doc.setTextColor(100);
    const splitAddress = doc.splitTextToSize(centerInfo.address, 180);
    doc.text(splitAddress, 14, 42);

    doc.setDrawColor(200);
    doc.line(14, 55, 196, 55);

    // Quote Table
    const tableRows = [
        ["Program Selected", feeResult.programName],
        ["Payment Plan", feeResult.paymentPlan === 'INSTALLMENT' ? "Standard Installments" : "Full Payment / One Shot"],
        ["Total Program Fee", `Rs. ${feeResult.originalTotal.toLocaleString()}`],
        [`Scholarship / Discount (${feeResult.discountInput}%)`, `- Rs. ${(feeResult.originalTotal - feeResult.landingFee).toLocaleString()}`],
        [{ content: "FINAL AGREED FEE", styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } }, { content: `Rs. ${feeResult.finalPayable.toLocaleString()}`, styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } }]
    ];

    autoTable(doc, {
        startY: 65,
        head: [["Description", "Details"]],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: centerInfo.color },
    });

    // LOGIC: Only show Installment Table if Plan is INSTALLMENT
    let finalY = doc.lastAutoTable.finalY;

    if (feeResult.paymentPlan === 'INSTALLMENT') {
        doc.text("Projected Installment Schedule", 14, finalY + 15);
        const scheduleRows = schedule.map(row => [`Installment ${row.id}`, row.dueDate, `Rs. ${row.amount.toLocaleString()}`]);
        doc.autoTable({
            startY: finalY + 20,
            head: [["Installment", "Due Date", "Amount"]],
            body: scheduleRows,
            theme: 'striped',
            headStyles: { fillColor: [80, 80, 80] },
        });
        finalY = doc.lastAutoTable.finalY;
    }

    // NEW: Add Refund Policy Table
    if (refunds) {
        doc.text("Refund Policy (Estimated)", 14, finalY + 15);
        const refundRows = refunds.map(row => [row.period, row.deduction, row.refund]);
        doc.autoTable({
            startY: finalY + 20,
            head: [["Time Period", "Deduction Rule", "Refund Amount"]],
            body: refundRows,
            theme: 'plain',
            headStyles: { fillColor: [200, 200, 200], textColor: 0 },
        });
    }

    doc.save(`${studentDetails.name}_Quote.pdf`);
};

// 2. TOKEN RECEIPT (New & Improved)
export const generateTokenReceipt = async (studentData) => {
    const doc = new jsPDF();

    // Identify Center to get correct Logo/Colors
    // Default to College Rd if centerId is missing
    const centerInfo = CENTERS[studentData.centerId] || CENTERS["UN_COLLEGE"];

    // 1. Logo & Header
    try {
        const logoImg = await loadImage(centerInfo.logoPath);
        if (logoImg) doc.addImage(logoImg, 'PNG', 14, 10, 35, 15);
    } catch (e) { console.warn("Logo error"); }

    // Right Side Meta
    doc.setFontSize(10);
    doc.setTextColor(50);
    const dateStr = studentData.createdAt
        ? new Date(studentData.createdAt.seconds * 1000).toLocaleDateString('en-IN')
        : new Date().toLocaleDateString('en-IN');
    const receiptId = studentData.id ? studentData.id.substring(0, 8).toUpperCase() : "REC-001";

    doc.text(`Date: ${dateStr}`, 140, 15);
    doc.text(`Receipt No: ${receiptId}`, 140, 20);
    doc.text("PAYMENT RECEIPT", 140, 28);

    // Center Address
    doc.setFontSize(14);
    doc.setTextColor(centerInfo.color[0], centerInfo.color[1], centerInfo.color[2]);
    doc.text(centerInfo.name, 14, 35);

    doc.setFontSize(9);
    doc.setTextColor(100);
    const splitAddress = doc.splitTextToSize(centerInfo.address, 120);
    doc.text(splitAddress, 14, 42);

    // 2. "Received From" Box
    doc.setDrawColor(200);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(14, 60, 182, 25, 3, 3, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Received with thanks from:", 20, 68);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(studentData.studentName, 20, 76);
    doc.setFont("helvetica", "normal");
    doc.text(`(Phone: ${studentData.phone})`, 80, 76);

    // 3. Payment Details Table
    const tableRows = [
        ["Course / Program", studentData.program],
        ["Payment Mode", studentData.paymentMode || "Cash/UPI"],
        ["Transaction Status", "Success (Token Received)"],
        [{ content: "AMOUNT RECEIVED", styles: { fontStyle: 'bold', fontSize: 12 } }, { content: `Rs. ${studentData.amount}/-`, styles: { fontStyle: 'bold', fontSize: 12 } }]
    ];

    autoTable(doc, {
        startY: 95,
        head: [["Description", "Value"]],
        body: tableRows,
        theme: 'grid',
        headStyles: {
            fillColor: centerInfo.color,
            textColor: 255,
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 82, halign: 'right' }
        }
    });

    // 4. Footer & Signature
    const finalY = doc.lastAutoTable.finalY + 40;

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Authorized Signature", 150, finalY);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("For KAP Edutech Pvt Ltd", 150, finalY + 5);

    doc.text("* This is a computer generated receipt.", 14, finalY + 20);
    doc.text("* Registration fees are non-refundable.", 14, finalY + 25);

    doc.save(`${studentData.studentName}_Receipt.pdf`);
};

// 3. OFFICIAL TAX INVOICE (Accountant)
export const generateOfficialInvoice = async (student, paymentDetails, centerInfo) => {
    const doc = new jsPDF();

    // 1. Logo & Header
    try {
        const logoImg = await loadImage(centerInfo.logoPath);
        if (logoImg) doc.addImage(logoImg, 'PNG', 14, 10, 35, 15);
    } catch (e) { console.warn("Logo error"); }

    // Invoice Meta Data
    doc.setFontSize(10);
    doc.setTextColor(50);
    const dateStr = new Date().toLocaleDateString('en-IN');
    const receiptNo = "TAX-" + Math.floor(Math.random() * 1000000);

    doc.text(`Date: ${dateStr}`, 140, 15);
    doc.text(`Invoice No: ${receiptNo}`, 140, 20);
    doc.setFontSize(14);
    doc.setTextColor(centerInfo.color[0], centerInfo.color[1], centerInfo.color[2]);
    doc.text("OFFICIAL FEE RECEIPT", 140, 30);

    // Center Address
    doc.setFontSize(12);
    doc.text(centerInfo.name, 14, 35);
    doc.setFontSize(9);
    doc.setTextColor(100);
    const splitAddress = doc.splitTextToSize(centerInfo.address, 100);
    doc.text(splitAddress, 14, 42);

    // 2. Student Details Box
    doc.setDrawColor(200);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 55, 182, 25, 3, 3, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Received with thanks from:", 20, 63);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(student.studentName, 20, 71);
    doc.setFont("helvetica", "normal");
    doc.text(`(Course: ${student.program})`, 80, 71);

    // 3. Payment Details Table
    const tableRows = [
        ["Payment Towards", paymentDetails.type],
        ["Payment Mode", paymentDetails.mode],
        ["Transaction Date", dateStr],
        [{ content: "CURRENT AMOUNT PAID", styles: { fontStyle: 'bold', fontSize: 12 } }, { content: `Rs. ${Number(paymentDetails.amount).toLocaleString()}/-`, styles: { fontStyle: 'bold', fontSize: 12 } }]
    ];

    doc.autoTable({
        startY: 85,
        head: [["Description", "Details"]],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: centerInfo.color, textColor: 255 },
        columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 82, halign: 'right' }
        }
    });

    // 4. Financial Summary (The "Balance" Section)
    // Calculate Totals
    const totalPaidSoFar = (student.totalPaid || student.amount) + (paymentDetails.isNew ? 0 : 0);
    // Note: logic depends on if we updated DB before or after generating PDF. 
    // Assuming 'student.totalPaid' is already updated in the database.

    doc.setFontSize(10);
    doc.text("Account Summary:", 14, doc.lastAutoTable.finalY + 10);

    const summaryRows = [
        ["Total Paid to Date", `Rs. ${totalPaidSoFar.toLocaleString()}`],
        // We can add Balance here if we stored 'Final Agreed Fee' in database.
        // ["Balance Pending", "Refer to Portal"] 
    ];

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 15,
        body: summaryRows,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 100 }, 1: { halign: 'right' } }
    });

    // Footer
    const finalY = doc.lastAutoTable.finalY + 30;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Authorized Signature", 150, finalY);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(centerInfo.name, 150, finalY + 5);

    doc.save(`${student.studentName}_Invoice.pdf`);
};
