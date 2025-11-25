import React, { useState } from 'react';
import { db, storage } from '../firebase'; // Import Firebase
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { PROGRAMS } from '../utils/feeData';
import { Upload, CheckCircle, Loader, CreditCard } from 'lucide-react';

const TokenCalculator = ({ center }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        studentName: '',
        phone: '',
        program: '',
        amount: '',
        paymentMode: 'UPI', // Default
    });
    const [file, setFile] = useState(null);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            let fileUrl = "";

            // 1. Upload Image (if exists) - Resilient
            if (file) {
                try {
                    const storageRef = ref(storage, `payment_proofs/${Date.now()}_${file.name}`);
                    const snapshot = await uploadBytes(storageRef, file);
                    fileUrl = await getDownloadURL(snapshot.ref);
                } catch (uploadError) {
                    console.error("Image upload failed (likely CORS/Permissions):", uploadError);
                    alert("Warning: Image upload failed due to Cloud Permissions. Saving Token Data only.");
                    // Continue without image, fileUrl remains ""
                }
            }

            // 2. Save Data to Firestore (Database)
            await addDoc(collection(db, "admissions"), {
                ...formData,
                amount: Number(formData.amount),
                proofUrl: fileUrl, // Will be empty string if upload failed
                centerId: center.id,       // Which center (Unacademy/Prayas)
                centerName: center.name,
                status: "TOKEN_RECEIVED",  // Initial Status
                createdAt: serverTimestamp()
            });

            alert("Success! Token recorded. Sent to Accounts.");
            // Reset Form
            setFormData({ studentName: '', phone: '', program: '', amount: '', paymentMode: 'UPI' });
            setFile(null);

        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Error saving data. Please check Firebase Console Rules.");
        }
        setLoading(false);
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
            <div className={`bg-white rounded-xl shadow-lg border-t-4 p-6 ${center.brand === 'PRAYAS' ? 'border-red-600' : 'border-orange-500'}`}>
                <div className="flex items-center gap-3 mb-6">
                    <div className={`p-3 rounded-full ${center.brand === 'PRAYAS' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                        <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Token Booking Form</h2>
                        <p className="text-sm text-gray-500">
                            For Counsellor Use Only. Recording payment for <strong>{center.name}</strong>.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Student Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Student Name</label>
                            <input
                                name="studentName" value={formData.studentName} onChange={handleChange}
                                type="text" required className="w-full p-2 border rounded focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                            <input
                                name="phone" value={formData.phone} onChange={handleChange}
                                type="tel" required className="w-full p-2 border rounded focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Interested Course</label>
                        <select
                            name="program" value={formData.program} onChange={handleChange}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-orange-500 outline-none" required
                        >
                            <option value="">-- Select Course --</option>
                            {Object.keys(PROGRAMS).map(key => (
                                <option key={key} value={key}>{PROGRAMS[key].name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Payment Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Token Amount (₹)</label>
                            <input
                                name="amount" value={formData.amount} onChange={handleChange}
                                type="number" required className="w-full p-2 border rounded font-mono focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Payment Mode</label>
                            <select
                                name="paymentMode" value={formData.paymentMode} onChange={handleChange}
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-orange-500 outline-none"
                            >
                                <option value="UPI">UPI / GPay / PhonePe</option>
                                <option value="CASH">Cash</option>
                                <option value="CHEQUE">Cheque</option>
                                <option value="CARD">Credit/Debit Card</option>
                            </select>
                        </div>
                    </div>

                    {/* File Upload */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition">
                        <label className="cursor-pointer block">
                            <Upload className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                            <span className="text-sm text-blue-600 font-semibold">Upload Payment Screenshot</span>
                            <input type="file" onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                        </label>
                        {file && <p className="text-xs text-green-600 mt-2 flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3" /> {file.name}</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 ${center.brand === 'PRAYAS' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                    >
                        {loading ? <Loader className="animate-spin w-5 h-5" /> : "Confirm Booking & Save"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default TokenCalculator;
