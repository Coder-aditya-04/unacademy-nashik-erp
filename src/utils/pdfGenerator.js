import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CENTERS } from './centers'; // Import central config

// Helper to load image securely with dimensions
const loadImage = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve({ img, width: img.width, height: img.height });
        img.onerror = (e) => resolve(null); // Return null if image fails, don't crash
    });
};

// 1. ADMISSION QUOTE (Redesigned)
export const generateAdmissionPDF = async (studentDetails, feeResult, schedule, centerInfo, refunds) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // --- 1. HEADER SECTION ---
    // Add a top colored bar
    doc.setFillColor(centerInfo.color[0], centerInfo.color[1], centerInfo.color[2]);
    doc.rect(0, 0, pageWidth, 5, 'F');

    // Load Logo
    try {
        const logoData = await loadImage(centerInfo.logoPath);
        if (logoData) {
            // Dynamic Aspect Ratio Calculation
            const maxHeight = 20; // Reduced from 24
            const maxWidth = 80;  // Reduced from 90
            const ratio = logoData.width / logoData.height;
            let finalWidth = maxHeight * ratio;
            let finalHeight = maxHeight;

            if (finalWidth > maxWidth) {
                finalWidth = maxWidth;
                finalHeight = maxWidth / ratio;
            }

            // Logo on Left
            doc.addImage(logoData.img, 'PNG', 14, 10, finalWidth, finalHeight);
        }
    } catch (e) { console.warn("Logo error"); }

    // Center Details (Right Aligned)
    doc.setFontSize(14); // Reduced from 16
    doc.setTextColor(centerInfo.color[0], centerInfo.color[1], centerInfo.color[2]);
    doc.setFont("helvetica", "bold");
    doc.text(centerInfo.name, pageWidth - 14, 18, { align: "right" });

    doc.setFontSize(8); // Reduced from 9
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    const addressLines = doc.splitTextToSize(centerInfo.address, 90);
    doc.text(addressLines, pageWidth - 14, 23, { align: "right" });

    // Divider Line
    doc.setDrawColor(220);
    doc.line(14, 35, pageWidth - 14, 35); // Moved up from 40

    // --- 2. QUOTE META & STUDENT DETAILS ---
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const quoteNo = "QT-" + Math.floor(10000 + Math.random() * 90000);

    doc.setFontSize(18); // Reduced from 22
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.text("OFFICIAL FEE QUOTE", 14, 45); // Moved up from 50

    // Student Box
    doc.setFillColor(248, 250, 252); // Light Gray/Blue Bg
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 48, pageWidth - 28, 20, 3, 3, 'FD'); // Compact Box

    doc.setFontSize(9); // Reduced from 10
    doc.setTextColor(100);
    doc.setFont("helvetica", "bold");
    doc.text("PREPARED FOR:", 20, 54);

    doc.setFontSize(11); // Reduced from 12
    doc.setTextColor(0);
    doc.text(studentDetails.name || "Student Name", 20, 62);

    // Meta Info (Right side of box)
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Date Issued:", 120, 54);
    doc.text("Quote Ref:", 120, 62);

    doc.setTextColor(0);
    doc.text(dateStr, 150, 54);
    doc.text(quoteNo, 150, 62);

    // --- 3. FEE SUMMARY TABLE ---
    const scholarshipAmount = feeResult.originalTotal - feeResult.landingFee;

    const tableRows = [
        ["Program Selected", feeResult.programName],
        ["Payment Plan", feeResult.paymentPlan === 'REG_ONLY' ? "Registration Fee Only" : feeResult.paymentPlan === 'FULL' ? "One Shot Payment" : "Standard Installments"],
        ["Total Program Fee", `Rs. ${feeResult.originalTotal.toLocaleString()}`],
        [{ content: `Scholarship Applied (${feeResult.discountInput || 0}%)`, styles: { textColor: 100 } }, { content: `- Rs. ${scholarshipAmount.toLocaleString()}`, styles: { textColor: 100 } }],
        [{ content: "FINAL PAYABLE FEE", styles: { fontStyle: 'bold', fontSize: 11, textColor: [22, 163, 74] } }, { content: `Rs. ${feeResult.landingFee.toLocaleString()}`, styles: { fontStyle: 'bold', fontSize: 11, textColor: [22, 163, 74] } }]
    ];

    autoTable(doc, {
        startY: 75, // Moved up from 85
        head: [["Description", "Details"]],
        body: tableRows,
        theme: 'grid',
        headStyles: {
            fillColor: centerInfo.color,
            fontSize: 9, // Reduced font
            fontStyle: 'bold',
            halign: 'left'
        },
        styles: {
            fontSize: 9, // Reduced font
            cellPadding: 3, // Reduced padding
            lineColor: [230, 230, 230]
        },
        columnStyles: {
            0: { cellWidth: 110, fontStyle: 'bold', textColor: 80 },
            1: { halign: 'right', fontStyle: 'normal' }
        },
        alternateRowStyles: {
            fillColor: [250, 250, 255]
        }
    });

    let finalY = doc.lastAutoTable.finalY + 8; // Reduced gap

    // --- 4. INSTALLMENT SCHEDULE ---
    if (schedule.length > 0) {
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text("Payment Schedule", 14, finalY);

        const scheduleRows = schedule.map(row => [
            { content: typeof row.id === 'number' ? `Installment ${row.id}` : row.id, styles: { fontStyle: 'bold' } },
            row.dueDate,
            `Rs. ${row.amount.toLocaleString()}`
        ]);

        autoTable(doc, {
            startY: finalY + 4,
            head: [["Installment / Stage", "Due Date", "Amount Payable"]],
            body: scheduleRows,
            theme: 'striped',
            headStyles: { fillColor: [70, 70, 70] },
            styles: { fontSize: 8, cellPadding: 2 }, // Compact
            columnStyles: {
                2: { halign: 'right', fontStyle: 'bold' }
            }
        });
        finalY = doc.lastAutoTable.finalY + 8;
    }

    // --- 5. REFUND POLICY ---
    if (refunds && feeResult.paymentPlan !== 'REG_ONLY') {
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text("Refund Policy (Deduction Rules)", 14, finalY);

        const refundRows = refunds.map(row => [row.period, row.deduction]);

        autoTable(doc, {
            startY: finalY + 4,
            head: [["Time Period (Days from Admission)", "Total Deduction Amount"]],
            body: refundRows,
            theme: 'plain',
            headStyles: {
                fillColor: [220, 220, 220],
                textColor: 50,
                fontStyle: 'bold',
                fontSize: 8
            },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                1: { textColor: [200, 0, 0], fontStyle: 'bold' }
            }
        });
        finalY = doc.lastAutoTable.finalY;
    }

    // --- 6. FOOTER ---
    const footerY = pageHeight - 15;
    doc.setDrawColor(200);
    doc.line(14, footerY, pageWidth - 14, footerY);

    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text("This is not an original receipt. It is just a quote of the fee.", 14, footerY + 5);
    doc.text("This is a computer-generated document. No signature is required.", 14, footerY + 9);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth - 14, footerY + 5, { align: "right" });

    doc.setFontSize(8);
    doc.setTextColor(centerInfo.color[0], centerInfo.color[1], centerInfo.color[2]);
    doc.text(centerInfo.name, 14, footerY + 13);

    doc.save(`${studentDetails.name || 'Student'}_Quote.pdf`);
};

// 2. TOKEN RECEIPT (Premium Redesign)
export const generateTokenReceipt = async (studentData) => {
    // Kept similar logic but optimized if needed. Token receipt is usually short enough.
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    const centerInfo = CENTERS[studentData.centerId] || CENTERS["UN_COLLEGE"];

    doc.setFillColor(centerInfo.color[0], centerInfo.color[1], centerInfo.color[2]);
    doc.rect(0, 0, pageWidth, 5, 'F');

    try {
        const logoData = await loadImage(centerInfo.logoPath);
        if (logoData) {
            const maxHeight = 20;
            const maxWidth = 80;
            const ratio = logoData.width / logoData.height;
            let finalWidth = maxHeight * ratio;
            let finalHeight = maxHeight;
            if (finalWidth > maxWidth) { finalWidth = maxWidth; finalHeight = maxWidth / ratio; }
            doc.addImage(logoData.img, 'PNG', 14, 10, finalWidth, finalHeight);
        }
    } catch (e) { console.warn("Logo error"); }

    doc.setFontSize(14);
    doc.setTextColor(centerInfo.color[0], centerInfo.color[1], centerInfo.color[2]);
    doc.setFont("helvetica", "bold");
    doc.text(centerInfo.name, pageWidth - 14, 18, { align: "right" });

    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(centerInfo.address, 90), pageWidth - 14, 23, { align: "right" });

    doc.setDrawColor(220);
    doc.line(14, 35, pageWidth - 14, 35);

    const dateStr = studentData.createdAt
        ? new Date(studentData.createdAt.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN');
    const receiptId = studentData.id ? `REC-${studentData.id.substring(0, 8).toUpperCase()}` : `REC-${Math.floor(1000 + Math.random() * 9000)}`;

    doc.setFontSize(18);
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT RECEIPT", 14, 45);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 48, pageWidth - 28, 20, 3, 3, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("RECEIVED FROM:", 20, 54);
    doc.text("Receipt No:", 120, 54);
    doc.text("Date:", 120, 62);

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(studentData.studentName, 20, 62);

    doc.setTextColor(0);
    doc.text(receiptId, 150, 54);
    doc.text(dateStr, 150, 62);

    const tableRows = [
        ["Program / Course", studentData.program],
        ["Payment Mode", studentData.paymentMode || "Cash/UPI"],
        ["Transaction Status", "Success (Token Confirmed)"],
        [{ content: "AMOUNT RECEIVED", styles: { fontStyle: 'bold', fontSize: 11, textColor: centerInfo.color } }, { content: `Rs. ${Number(studentData.amount).toLocaleString()}/-`, styles: { fontStyle: 'bold', fontSize: 11, textColor: centerInfo.color } }]
    ];

    autoTable(doc, {
        startY: 75,
        head: [["Description", "Details"]],
        body: tableRows,
        theme: 'grid',
        headStyles: {
            fillColor: centerInfo.color,
            fontSize: 9,
            fontStyle: 'bold'
        },
        styles: { fontSize: 9, cellPadding: 3, lineColor: [230, 230, 230] },
        columnStyles: { 0: { cellWidth: 100, fontStyle: 'bold', textColor: 80 }, 1: { halign: 'right' } }
    });

    const finalY = doc.lastAutoTable.finalY + 30;

    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text("Authorized Signature", pageWidth - 50, finalY, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text("For KAP Edutech Pvt Ltd", pageWidth - 50, finalY + 5, { align: 'center' });

    const footerY = pageHeight - 15;
    doc.setDrawColor(200);
    doc.line(14, footerY, pageWidth - 14, footerY);

    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text("* Registration fees are non-refundable.", 14, footerY + 5);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth - 14, footerY + 5, { align: "right" });

    doc.save(`${studentData.studentName}_TokenReceipt.pdf`);
};

// HELPER: Find Next Due Date
const getNextDueInfo = (student, schedule = []) => {
    // ... (Keep existing optimal logic)
    const totalPaid = student.totalPaid || 0;
    const totalFee = student.amount || 0;
    if (totalPaid >= totalFee) return { date: "PAID IN FULL", amount: 0 };
    if (schedule && schedule.length > 0) {
        let cumulative = 0;
        for (let inst of schedule) {
            cumulative += Number(inst.amount || 0);
            if (cumulative > (totalPaid + 10)) {
                const pendingNow = cumulative - totalPaid;
                let dStr = inst.dueDate || inst.date;
                if (dStr && dStr.includes('T')) dStr = new Date(dStr).toLocaleDateString();
                return { date: dStr || "Immediate", amount: pendingNow };
            }
        }
    }
    if (student.createdAt) {
        const admDate = new Date(student.createdAt.seconds * 1000);
        admDate.setDate(admDate.getDate() + 30);
        return { date: admDate.toLocaleDateString(), amount: totalFee - totalPaid };
    }
    return { date: "Immediate", amount: totalFee - totalPaid };
};

// 4. FINAL PROFESSIONAL INVOICE (Premium Redesign - COMPACT, SINGLE PAGE OPTIMIZED)
export const generateTaxInvoice = async (student, paymentObj, centerInfo, schedule, refunds) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // --- 1. HEADER (Compact) ---
    doc.setFillColor(centerInfo.color[0], centerInfo.color[1], centerInfo.color[2]);
    doc.rect(0, 0, pageWidth, 5, 'F');

    try {
        const logoData = await loadImage(centerInfo.logoPath);
        if (logoData) {
            const maxHeight = 20; // Reduced from 24
            const ratio = logoData.width / logoData.height;
            doc.addImage(logoData.img, 'PNG', 14, 10, maxHeight * ratio, maxHeight);
        }
    } catch (e) { }

    doc.setFontSize(14); // 16 -> 14
    doc.setTextColor(centerInfo.color[0], centerInfo.color[1], centerInfo.color[2]);
    doc.text("FEE INVOICE", pageWidth - 14, 18, { align: "right" });

    doc.setFontSize(8); // 9 -> 8
    doc.setTextColor(100);
    doc.text(doc.splitTextToSize(centerInfo.address, 90), pageWidth - 14, 23, { align: "right" });

    doc.setDrawColor(220);
    doc.line(14, 35, pageWidth - 14, 35); // 40 -> 35

    // --- 2. META DATA (Compact) ---
    const invNo = `INV-${Date.now().toString().slice(-6)}`;
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    doc.setFontSize(14); // Reduced from 18
    doc.setTextColor(30);
    doc.text("PAYMENT ACKNOWLEDGEMENT", 14, 45); // 52 -> 45

    // Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 48, pageWidth - 28, 20, 3, 3, 'FD'); // 24 height -> 20, Y 58 -> 48

    doc.setFontSize(9); // 10 -> 9
    doc.setTextColor(100);
    doc.text("STUDENT:", 20, 54); // 66 -> 54
    doc.text("Invoice No:", 120, 54);
    doc.text("Date:", 120, 62); // 74 -> 62

    doc.setFontSize(11); // 12 -> 11
    doc.setTextColor(0);
    doc.text(`${student.studentName} (${student.rollNumber || 'No Roll No'})`, 20, 62);

    doc.setTextColor(0);
    doc.text(invNo, 150, 54);
    doc.text(dateStr, 150, 62);

    // --- 3. CURRENT TRANSACTION (Compact) ---
    doc.setFontSize(10); // 11 -> 10
    doc.setTextColor(centerInfo.color[0], centerInfo.color[1], centerInfo.color[2]);
    doc.setFont("helvetica", "bold");
    doc.text("CURRENT TRANSACTION DETAILS", 14, 78); // 92 -> 78

    autoTable(doc, {
        startY: 82, // 96 -> 82
        head: [["Description", "Amount"]],
        body: [[`Payment Towards: ${paymentObj.type} (${paymentObj.mode})`, `Rs. ${Number(paymentObj.amount).toLocaleString()}/-`]],
        theme: 'grid',
        headStyles: { fillColor: centerInfo.color, fontSize: 9 }, // 10 -> 9
        styles: { fontSize: 9, cellPadding: 3 }, // 11 -> 9, 5 -> 3
        columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold', textColor: [22, 163, 74] } }
    });

    // --- 4. ACCOUNT SUMMARY (Compact) ---
    const totalFee = student.amount;
    const totalPaid = student.totalPaid;
    const balance = totalFee - totalPaid;

    const summaryY = doc.lastAutoTable.finalY + 10; // 15 -> 10
    doc.setFontSize(10); // 11 -> 10
    doc.setTextColor(30);
    doc.text("ACCOUNT SUMMARY", 14, summaryY);

    const summaryRows = [
        ["Total Course Fee", `Rs. ${totalFee.toLocaleString()}`],
        ["Total Paid (Including this)", `Rs. ${totalPaid.toLocaleString()}`],
        [{ content: "Balance Pending", styles: { textColor: balance > 0 ? [220, 38, 38] : [22, 163, 74] } }, { content: `Rs. ${balance.toLocaleString()}`, styles: { textColor: balance > 0 ? [220, 38, 38] : [22, 163, 74], fontStyle: 'bold' } }]
    ];

    autoTable(doc, {
        startY: summaryY + 3, // 4 -> 3
        body: summaryRows,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 }, // 10 -> 9, 3 -> 2
        columnStyles: { 0: { cellWidth: 100, fontStyle: 'bold', textColor: 80 }, 1: { halign: 'right' } }
    });

    let finalY = doc.lastAutoTable.finalY;

    // --- 5. PAYMENT SCHEDULE (Dynamic Future Dues Only) ---
    // Shows only what is actually pending, filtering out paid installments
    if (balance > 0 && schedule && schedule.length > 0) {
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text("Future Payment Schedule", 14, finalY + 8);

        const futureRows = [];
        schedule.forEach((inst, index) => {
            const pendingAmt = Number(inst.amount || 0);

            // Logic: Trust the provided schedule (which is already Net Due)
            // If amount is 0, we skip (though calling function usually filters these)
            if (pendingAmt <= 0) return;

            // Simple "Partially Paid" guess if needed, or rely on caller
            // For now, we print what we are given.
            const isPartial = false; // logic removed to prevent confusion, or we can check against total fee if data available.


            // ROBUST LABELING
            let label = `Installment ${index + 1}`;
            if (inst.name && !inst.isEstimate) label = inst.name;
            else if (inst.id && String(inst.id) !== 'undefined' && String(inst.id) !== 'null') {
                label = typeof inst.id === 'string' && inst.id.startsWith('Installment') ? inst.id : `Installment ${inst.id}`;
            } else if (inst.name) label = inst.name;

            if (isPartial) label += " (Partially Paid)";

            // ROBUST DATE
            let dateDisplay = "-";
            if (inst.label) {
                dateDisplay = inst.label;
            } else {
                const rawDate = inst.dueDate || inst.date;
                if (rawDate) {
                    try {
                        const d = new Date(rawDate);
                        if (!isNaN(d.getTime())) dateDisplay = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                        else dateDisplay = rawDate;
                    } catch (e) { dateDisplay = rawDate; }
                }
            }

            futureRows.push([
                { content: label, styles: { fontStyle: 'bold' } },
                dateDisplay,
                { content: `Rs. ${pendingAmt.toLocaleString()}`, styles: { halign: 'right', textColor: [220, 38, 38], fontStyle: 'bold' } }
            ]);
        });

        if (futureRows.length > 0) {
            autoTable(doc, {
                startY: finalY + 12,
                head: [["Installment / Stage", "Due Date", "Pending Amount"]],
                body: futureRows,
                theme: 'striped',
                headStyles: { fillColor: [70, 70, 70] },
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: { 2: { fontStyle: 'bold' } }
            });
            finalY = doc.lastAutoTable.finalY + 5;
        } else {
            // Edge case: Balance > 0 but schedule logic didn't catch it (Misc dues)
            doc.setFontSize(10);
            doc.setTextColor(220, 38, 38);
            doc.text(`Remaining Balance: Rs. ${balance.toLocaleString()}`, 14, finalY + 15);
            finalY += 20;
        }
    } else if (balance <= 0) {
        // Optional: Add a "Paid in Full" note
        doc.setFontSize(10);
        doc.setTextColor(22, 163, 74); // Green
        doc.setFont("helvetica", "bold");
        doc.text("All Dues Cleared - No Future Payments", 14, finalY + 8);
        finalY += 12;
    } else {
        finalY += 5;
    }

    // --- 6. REFUND POLICY TABLE (Compact & No Overlap) ---
    // Minimal gap check
    if (finalY > pageHeight - 50) { // Check if dangerously close
        doc.addPage();
        finalY = 20;
    } else {
        finalY += 5; // Minimal gap
    }

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("Refund Policy (Deduction Rules)", 14, finalY);

    let refundBody = [];
    if (refunds && refunds.length > 0) {
        refundBody = refunds.map(r => [r.period, r.deduction]);
    } else {
        refundBody = [
            ["0-7 Days", "Registration Fee Only"],
            ["8-15 Days", "Reg Fee + 15% Tuition Fee"],
            ["16-30 Days", "Reg Fee + 30% Tuition Fee"],
            ["After 30 Days", "No Refund (100% Deduction)"]
        ];
    }

    autoTable(doc, {
        startY: finalY + 4,
        head: [["Time Period (Days from Admission)", "Total Deduction Amount"]],
        body: refundBody,
        theme: 'plain',
        headStyles: {
            fillColor: [220, 220, 220],
            textColor: 50,
            fontStyle: 'bold',
            fontSize: 8
        },
        styles: { fontSize: 8, cellPadding: 2, lineColor: [200, 200, 200] },
        columnStyles: {
            1: { textColor: [200, 0, 0], fontStyle: 'bold' }
        }
    });

    // --- 7. FOOTER ---
    let finalFooterY = pageHeight - 15;
    // Overlap check - only if table bleeds into footer area
    if (doc.lastAutoTable.finalY > finalFooterY - 10) {
        doc.addPage();
        finalFooterY = pageHeight - 20;
    }

    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text("Authorized Signature", pageWidth - 40, finalFooterY - 5, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(`For ${centerInfo.name}`, pageWidth - 40, finalFooterY, { align: 'center' });

    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, finalFooterY);

    doc.save(`${student.studentName}_Invoice.pdf`);
};
