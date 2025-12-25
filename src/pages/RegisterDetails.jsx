import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { User, Phone, MapPin, Briefcase, ChevronRight, Lock } from 'lucide-react';
import { CENTERS } from '../utils/centers';

const RegisterDetails = () => {
    const auth = getAuth();
    const db = getFirestore();
    const navigate = useNavigate();
    const user = auth.currentUser;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: user?.displayName || '',
        phone: '',
        role: 'COUNSELOR', // Default
        centerId: '',
    });

    // If not logged in, redirect to login
    if (!user) {
        navigate('/login');
        return null;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!formData.centerId) {
            setError("Please select a center.");
            setLoading(false);
            return;
        }

        try {
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                id: user.uid,
                name: formData.name,
                email: user.email,
                phone: formData.phone,
                role: formData.role.toUpperCase(),
                centerId: formData.centerId,
                verified: false, // Critical: Starts as false
                createdAt: new Date(),
                photoURL: user.photoURL || '',
                isActive: true
            });

            // Redirect to Pending Page
            navigate('/pending-approval');

        } catch (err) {
            console.error("Error saving profile:", err);
            setError("Failed to create profile. Please try again.");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-blue-600 p-6 text-center">
                    <h2 className="text-2xl font-bold text-white">Complete Your Profile</h2>
                    <p className="text-blue-100 text-sm mt-1">One last step to join the portal</p>
                </div>

                <div className="p-8">
                    {error && (
                        <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                            <Lock className="w-4 h-4" /> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Name */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                            <div className="relative">
                                <User className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Aditya Dhondge"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mobile Number</label>
                            <div className="relative">
                                <Phone className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                                <input
                                    type="tel"
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="9876543210"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Center Selection */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Center</label>
                            <div className="relative">
                                <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                                <select
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                    value={formData.centerId}
                                    onChange={(e) => setFormData({ ...formData, centerId: e.target.value })}
                                >
                                    <option value="">-- Choose Center --</option>
                                    {Object.values(CENTERS).map(center => (
                                        <option key={center.id} value={center.id}>{center.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Role Selection */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role</label>
                            <div className="relative">
                                <Briefcase className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                                <select
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="COUNSELOR">Counselor</option>
                                    <option value="MANAGER">Center Manager</option>
                                    <option value="ACCOUNTANT">Accountant</option>
                                </select>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                * Manager/Accountant roles require additional Directors approval.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition"
                        >
                            {loading ? "Creating Profile..." : "Submit for Verification"}
                            <ChevronRight className="w-4 h-4" />
                        </button>

                    </form>
                </div>
            </div>
        </div>
    );
};

export default RegisterDetails;
