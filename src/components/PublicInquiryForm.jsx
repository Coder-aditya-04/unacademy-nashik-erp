import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { X, Check, Loader2, User, Phone, Building2 } from 'lucide-react';
import { CENTERS } from '../utils/centers';

const PublicInquiryForm = ({ onClose }) => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        center: '',
        studentName: '',
        parentPhone: '',
        board: '',
        currentClass: '',
        courseInterest: '',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return; // Prevent double click
        setLoading(true);

        try {
            if (!formData.center) {
                alert("Please select a Center");
                setLoading(false);
                return;
            }

            if (!/^\d{10}$/.test(formData.parentPhone)) {
                alert("Please enter a valid 10-digit mobile number.");
                setLoading(false);
                return;
            }

            const cleanPhone = String(formData.parentPhone).replace(/\D/g, '').slice(-10);

            // Construct Lead Object
            const leadData = {
                centerId: formData.center,
                studentName: String(formData.studentName || "").trim(),
                phone: cleanPhone,
                parentPhone: cleanPhone,
                board: formData.board || '',
                currentClass: formData.currentClass,
                courseInterest: formData.courseInterest,
                source: 'Website', // Default source for public form
                sourceDetails: {
                    role: 'Student',
                    enteredBy: 'Self',
                    location: 'Website Inquiry'
                },
                createdAt: Timestamp.now(),
                status: 'NEW',
            };

            // DUPLICATE CHECK
            const q = query(collection(db, "leads"), where("phone", "==", cleanPhone));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                alert("This phone number is already registered with us. We will contact you shortly!");
                setLoading(false);
                return;
            }

            await addDoc(collection(db, "leads"), leadData);

            setSuccess(true);
            setTimeout(() => {
                if (onClose) onClose();
            }, 3000);

        } catch (error) {
            console.error("Submission Error:", error);
            alert("Error submitting form: " + error.message);
        }
        setLoading(false);
    };

    if (success) {
        return (
            <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm mx-auto animate-in zoom-in duration-300 relative">
                <button onClick={onClose} className="absolute top-2 right-2 p-2 hover:bg-gray-100 rounded-full transition"><X className="w-5 h-5 text-gray-400" /></button>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Inquiry Sent!</h2>
                <p className="text-gray-500 text-sm">Our academic counselor will call you shortly.</p>
            </div>
        );
    }

    return (
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative">

            {/* Header */}
            <div className="bg-indigo-600 p-6 text-white flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold">Enquire Now</h2>
                    <p className="text-indigo-200 text-xs mt-1">Fill in your details to get a callback.</p>
                </div>
                <button onClick={onClose} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition"><X className="w-5 h-5" /></button>
            </div>

            {/* Form Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar">
                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Center Selection */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Center</label>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <select
                                name="center"
                                value={formData.center}
                                onChange={handleChange}
                                className="w-full pl-9 p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm text-gray-700"
                                required
                            >
                                <option value="">-- Choose Center --</option>
                                {Object.values(CENTERS).map(center => (
                                    <option key={center.id} value={center.id}>{center.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Student Name */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Student Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                name="studentName"
                                value={formData.studentName}
                                onChange={handleChange}
                                className="w-full pl-9 p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                placeholder="Student Full Name"
                                required
                            />
                        </div>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contact Number</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                name="parentPhone"
                                value={formData.parentPhone}
                                onChange={handleChange}
                                className="w-full pl-9 p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                placeholder="10-digit mobile number"
                                type="tel"
                                maxLength="10"
                                required
                            />
                        </div>
                    </div>

                    {/* Course & Class */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Class</label>
                            <select
                                name="currentClass"
                                value={formData.currentClass}
                                onChange={handleChange}
                                className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                required
                            >
                                <option value="">Class</option>
                                <option>8th</option>
                                <option>9th</option>
                                <option>10th</option>
                                <option>11th</option>
                                <option>12th</option>
                                <option>Repeater</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Course</label>
                            <select
                                name="courseInterest"
                                value={formData.courseInterest}
                                onChange={handleChange}
                                className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                required
                            >
                                <option value="">Interest</option>
                                <option>JEE</option>
                                <option>NEET</option>
                                <option>MHT-CET</option>
                                <option>Foundation</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl font-bold text-white shadow-lg bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 transform transition active:scale-95 flex items-center justify-center gap-2 mt-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Request Callback'}
                    </button>

                    <p className="text-center text-[10px] text-gray-400">
                        By submitting, you agree to receive updates via WhatsApp/SMS.
                    </p>
                </form>
            </div>
        </div >
    );
};

export default PublicInquiryForm;
