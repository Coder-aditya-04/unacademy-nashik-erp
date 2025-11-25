import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { FileText, CheckCircle, Clock } from 'lucide-react';
import { CENTERS } from '../utils/centers'; // Import centers
import { generateOfficialInvoice } from '../utils/pdfGenerator';

const StudentManager = ({ student, onClose, refreshData }) => {
    const [payAmount, setPayAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('UPI');
    const [loading, setLoading] = useState(false);

    // 2. RECORD NEW PAYMENT (Installment)
    const handleAddPayment = async () => {
        if (!payAmount) return;
        setLoading(true);

        try {
            const studentRef = doc(db, "admissions", student.id);

            const newPayment = {
                amount: Number(payAmount),
                date: Timestamp.now(),
                mode: paymentMode,
                type: "Installment/Balance"
            };

            // Update Firebase: Add to payment history array
            await updateDoc(studentRef, {
                payments: arrayUnion(newPayment),
                totalPaid: (student.totalPaid || student.amount) + Number(payAmount)
            });

            alert("Payment Recorded!");

            // --- GENERATE PDF ---
            // Get Center Info
            const center = CENTERS[student.centerId] || CENTERS["UN_COLLEGE"];

            // Create a temporary object with updated total for the PDF
            const updatedStudent = {
                ...student,
                totalPaid: (student.totalPaid || student.amount) + Number(payAmount)
            };

            await generateOfficialInvoice(updatedStudent, {
                amount: payAmount,
                mode: paymentMode,
                type: "Installment Payment",
                isNew: true
            }, center);
            // --------------------

            refreshData(); // Refresh Dashboard
            onClose(); // Close Modal

        } catch (error) {
            console.error(error);
            alert("Error saving payment");
        }
        setLoading(false);
    };

    const totalPaid = student.totalPaid || student.amount; // Token + Updates

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden">

                {/* Header */}
                <div className="bg-gray-800 text-white p-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">{student.studentName}</h2>
                        <p className="text-sm opacity-75">{student.program} • {student.phone}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="p-6">

                    {/* Status Cards */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-green-50 p-4 rounded border border-green-200">
                            <p className="text-xs text-green-800 uppercase font-bold">Total Paid So Far</p>
                            <p className="text-2xl font-bold text-green-700">₹{totalPaid.toLocaleString()}</p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded border border-blue-200">
                            <p className="text-xs text-blue-800 uppercase font-bold">Current Status</p>
                            <p className="text-lg font-bold text-blue-900">{student.status}</p>
                        </div>
                    </div>

                    {/* Payment History List */}
                    <div className="mb-6">
                        <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Payment History
                        </h3>
                        <div className="bg-gray-50 rounded border max-h-32 overflow-y-auto p-2 text-sm">
                            {/* Initial Token */}
                            <div className="flex justify-between p-2 border-b border-gray-200">
                                <span>Token (Admission)</span>
                                <span className="font-bold">₹{student.amount}</span>
                            </div>
                            {/* Subsequent Payments */}
                            {student.payments && student.payments.map((p, idx) => (
                                <div key={idx} className="flex justify-between p-2 border-b border-gray-200">
                                    <span>{p.type} ({new Date(p.date.seconds * 1000).toLocaleDateString()})</span>
                                    <span className="font-bold">₹{p.amount}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ADD NEW PAYMENT SECTION */}
                    <div className="bg-yellow-50 p-5 rounded border border-yellow-200">
                        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <FileText className="w-5 h-5" /> Record New Payment (Accountant)
                        </h3>

                        <div className="flex gap-4">
                            <input
                                type="number"
                                placeholder="Amount (₹)"
                                className="flex-1 p-2 border rounded"
                                value={payAmount}
                                onChange={(e) => setPayAmount(e.target.value)}
                            />
                            <select
                                className="p-2 border rounded"
                                value={paymentMode}
                                onChange={(e) => setPaymentMode(e.target.value)}
                            >
                                <option value="UPI">UPI</option>
                                <option value="Cash">Cash</option>
                                <option value="Cheque">Cheque</option>
                            </select>
                            <button
                                onClick={handleAddPayment}
                                disabled={loading}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 rounded shadow flex items-center gap-2"
                            >
                                {loading ? "Saving..." : "Receive & Print"}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default StudentManager;
