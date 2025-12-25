import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { processTokenPayment } from '../services/paymentService'; // Import new service
import { useFeeStructure } from '../hooks/useFeeStructure'; // Hook
import { Upload, CreditCard, User, Phone, CheckCircle, Loader, AlertTriangle } from 'lucide-react';

const TokenCalculator = ({ center, userProfile }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const crmData = location.state || {}; // Data passed from Lead Profile

    // Dynamic Fees
    const { feeStructures } = useFeeStructure();

    const [loading, setLoading] = useState(false);

    // Pre-fill data if available
    const [formData, setFormData] = useState({
        studentName: crmData.prefillName || '',
        phone: crmData.prefillPhone || '',
        program: crmData.prefillCourse || '',
        totalAgreedFee: crmData.prefillTotalFee || '', // NEW FIELD
        amount: '',
        enrollmentDate: '', // NEW: Custom Start Date
        paymentMode: 'UPI',
    });

    const [base64Image, setBase64Image] = useState("");

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        // ... (keep existing handleFileChange code)
        const file = e.target.files[0];
        if (file) {
            if (file.size > 800000) return alert("File too large (Max 800KB)");
            const reader = new FileReader();
            reader.onloadend = () => setBase64Image(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const paymentData = {
            ...formData,
            proofImage: base64Image,
            leadId: crmData.leadId, // Vital link to CRM
            finalTotalFee: formData.totalAgreedFee // Ensure we send the Total Fee
        };

        // 1. Process Payment in Database
        const result = await processTokenPayment(paymentData, userProfile);
        // ... (rest of handleSubmit)
        if (result.success) {
            // CHANGE: NO PDF GENERATION HERE. Just a success message.
            alert("✅ Payment Recorded Successfully!\n\nPlease inform the Accounts Team to verify and issue the Official Receipt.");

            if (crmData.leadId) {
                navigate(`/staff/leads/${crmData.leadId}`);
            } else {
                // Reset form
                setFormData({ studentName: '', phone: '', program: '', amount: '', paymentMode: 'UPI' });
                setBase64Image("");
            }
        } else {
            alert("Error: " + result.error);
        }
        setLoading(false);
    };

    return (
        <div className="max-w-2xl mx-auto p-4 md:p-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                {/* ... Header ... */}
                <div className="bg-orange-600 p-6 text-white flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <CreditCard className="w-6 h-6" /> Seat Booking
                        </h1>
                        <p className="text-orange-100 text-sm mt-1">Collect Token for {center.name}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">

                    {/* Read-Only Info (If from CRM) */}
                    {crmData.leadId && (
                        <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 text-sm text-orange-800 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            Linked to Lead: <strong>{crmData.prefillName}</strong>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Student Name & Phone Inputs (Keep as is) */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Student Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <input
                                    name="studentName" value={formData.studentName} onChange={handleChange}
                                    type="text" required className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Phone</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <input
                                    name="phone" value={formData.phone} onChange={handleChange}
                                    type="tel" required className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Program Selection</label>
                        <select
                            name="program" value={formData.program} onChange={handleChange}
                            className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-orange-500 outline-none" required
                        >
                            <option value="">-- Select Course --</option>
                            {feeStructures && Object.keys(feeStructures)
                                .filter(key => {
                                    if (center?.id === 'PRAYAS') return key.startsWith('PRAYAS_');
                                    return !key.startsWith('PRAYAS_');
                                })
                                .sort()
                                .map(key => (
                                    <option key={key} value={key}>{feeStructures[key].name}</option>
                                ))
                            }
                        </select>
                    </div>

                    {/* NEW TOTAL FEE INPUT */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Total Agreed Fee (Final Quote)</label>
                        <input
                            name="totalAgreedFee"
                            value={formData.totalAgreedFee}
                            onChange={handleChange}
                            type="number"
                            className="w-full p-3 border rounded-lg bg-gray-50 text-gray-500 font-bold"
                            placeholder="Total Package Cost"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">This is the total amount (Fee + College) decided during counselling.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Token Amount (₹)</label>
                            <input
                                name="amount" value={formData.amount} onChange={handleChange}
                                type="number" required className="w-full p-3 border rounded-lg font-bold text-lg text-gray-800"
                                placeholder="e.g. 5000"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Payment Mode</label>
                            <select
                                name="paymentMode" value={formData.paymentMode} onChange={handleChange}
                                className="w-full p-3 border rounded-lg bg-white"
                            >
                                <option value="UPI">UPI / GPay</option>
                                <option value="CASH">Cash</option>
                                <option value="CHEQUE">Cheque</option>
                                <option value="CARD">Card</option>
                            </select>
                        </div>

                        {/* NEW: Enrollment Start Date */}
                        <div className="md:col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <label className="block text-xs font-bold text-blue-800 uppercase mb-2 flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Enrollment / 1st Installment Date
                            </label>
                            <input
                                name="enrollmentDate"
                                value={formData.enrollmentDate || ''}
                                onChange={handleChange}
                                type="date"
                                className="w-full p-3 border rounded-lg bg-white font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <p className="text-[10px] text-blue-600 mt-1">
                                Installment schedule will be calculated starting from this date. Leave blank for Today.
                            </p>
                        </div>
                    </div>

                    {/* Screenshot Upload */}
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition cursor-pointer relative">
                        <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" />
                        <div className="pointer-events-none">
                            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                            <span className="text-sm text-blue-600 font-semibold">
                                {base64Image ? "Screenshot Selected (Click to change)" : "Upload Payment Screenshot"}
                            </span>
                            {base64Image && <p className="text-xs text-green-600 mt-2">Ready to upload</p>}
                        </div>
                    </div>

                    <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-xs text-yellow-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Note: No receipt will be generated here. The Accounts Department will issue the official receipt after verification.</span>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 shadow-lg transition"
                    >
                        {loading ? <Loader className="animate-spin w-5 h-5" /> : "Confirm & Generate Receipt"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default TokenCalculator;
