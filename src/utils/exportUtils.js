/**
 * Converts an array of objects to CSV format and triggers a download.
 * @param {Array} data - Array of objects to export.
 * @param {string} filename - Name of the file (without extension).
 */
export const exportToCSV = (data, filename = 'export') => {
    if (!data || !data.length) {
        alert("No data to export!");
        return;
    }

    // 1. Extract Headers (Keys from the first object)
    // We filter out complex objects like arrays or firestore timestamps for simplicity initially,
    // or we can manually map them before passing 'data' to this function.
    const headers = Object.keys(data[0]);

    // 2. Convert to CSV String
    const csvContent = [
        headers.join(','), // Header Row
        ...data.map(row =>
            headers.map(fieldName => {
                let value = row[fieldName];

                // Handle null/undefined
                if (value === null || value === undefined) return '';

                // Handle Strings with commas (wrap in quotes)
                if (typeof value === 'string') {
                    value = `"${value.replace(/"/g, '""')}"`; // Escape quotes
                }

                // Handle Dates/Timestamps (Simple check)
                if (value && value.seconds) { // Firestore Timestamp
                    value = new Date(value.seconds * 1000).toLocaleDateString();
                }

                return value;
            }).join(',')
        )
    ].join('\n');

    // 3. Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

/**
 * Prepares Admission Data for Export (Flattens objects)
 */
export const formatAdmissionsForExport = (admissions) => {
    return admissions.map(a => ({
        ID: a.id,
        Date: a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000).toLocaleDateString() : '',
        Name: a.studentName,
        Phone: a.phone,
        Center: a.centerName || 'Unacademy', // Handle legacy
        Course: a.program,
        'Total Fee': a.amount,
        'Paid So Far': a.totalPaid,
        'Pending': (a.amount - a.totalPaid) > 0 ? (a.amount - a.totalPaid) : 0,
        Status: a.status,
        'Booked By': a.bookedBy
    }));
};
