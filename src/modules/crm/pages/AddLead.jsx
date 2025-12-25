import React, { useState, useEffect } from 'react';
import { createLead, updateLead } from '../../../services/leadService';

import { UserPlus, Save, X, Edit } from 'lucide-react';

const AddLead = ({ userProfile, onSuccess, initialData = null, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        studentName: '',
        aadhar: '',
        phone: '',
        parentPhone: '',
        course: '',
        source: userProfile ? 'WALK_IN' : 'WALK_IN',
        location: userProfile?.name || ''
    });

    const [rawSourceDetails, setRawSourceDetails] = useState(null); // Preserve original object

    const isEditMode = !!initialData;

    useEffect(() => {
        if (initialData) {
            // Save raw details to preserve extra fields (like school, date)
            setRawSourceDetails(initialData.sourceDetails);

            // Robust Data Parsing
            let locValue = '';
            if (initialData.sourceDetails) {
                if (typeof initialData.sourceDetails === 'object') {
                    // Check all possible keys for the name
                    locValue = initialData.sourceDetails.enteredBy ||
                        initialData.sourceDetails.bdeName ||
                        initialData.sourceDetails.name ||
                        initialData.sourceDetails.specificSource || '';
                } else {
                    locValue = String(initialData.sourceDetails);
                }
            }

            setFormData({
                studentName: initialData.studentName || '',
                aadhar: initialData.aadhar || '',
                phone: initialData.phone || '',
                parentPhone: initialData.parentPhone || '',
                course: initialData.courseInterest || '',
                source: initialData.source || 'WALK_IN',
                location: locValue
            });
        }
    }, [initialData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Prepare Data for Service
        const submissionData = { ...formData };

        // Fix for BDE Data Loss: Reconstruct the Object
        if (formData.source === 'BDE') {
            // If we have raw details, merge them. Otherwise create new.
            const existingDetails = (typeof rawSourceDetails === 'object') ? rawSourceDetails : {};

            submissionData.sourceDetails = {
                ...existingDetails, // Keep school, date, etc.
                enteredBy: formData.location // Update name
            };
            // Remove flat location to avoid service confusion
            delete submissionData.location;
        }

        let result;
        if (isEditMode) {
            result = await updateLead(initialData.id, submissionData, userProfile);
        } else {
            result = await createLead(submissionData, userProfile);
        }

        if (result.success) {
            // alert(isEditMode ? "Lead Updated Successfully!" : "Lead Added Successfully!");
            // Silent success is better for modals, parent handles alert if needed
            if (!isEditMode) setFormData({ studentName: '', aadhar: '', phone: '', parentPhone: '', course: '' });
            if (onSuccess) onSuccess(); // Refresh parent list if needed
        } else {
            alert("Error: " + result.error);
        }
        setLoading(false);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative">
            {onClose && (
                <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-full transition">
                    <X className="w-5 h-5 text-slate-400" />
                </button>
            )}

            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                {isEditMode ? <Edit className="w-5 h-5 text-orange-600" /> : <UserPlus className="w-5 h-5 text-blue-600" />}
                {isEditMode ? "Edit Inquiry" : "Add New Inquiry"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Student Name</label>
                        <input
                            required
                            type="text"
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.studentName}
                            onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                        />
                    </div>
                    {/* Aadhar Removed from Quick Inquiry - Only for Admissions */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Course Interest</label>
                        <select
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.course}
                            onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                        >
                            <option value="">-- Select --</option>
                            <option value="MHT_CET_12">MHT CET (1 Year)</option>
                            <option value="MHT_CET_11">MHT CET (2 Year)</option>
                            <option value="NEET_11">NEET 11th (2 Year)</option>
                            <option value="NEET_12">NEET 12th (1 Year)</option>
                            <option value="JEE_11">JEE 11th (2 Year)</option>
                            <option value="JEE_12">JEE 12th (1 Year)</option>
                            <option value="FOUNDATION_8">Foundation Class 8</option>
                            <option value="FOUNDATION_9">Foundation Class 9</option>
                            <option value="FOUNDATION_10">Foundation Class 10</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Student Phone</label>
                        <input
                            required
                            type="tel"
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Parent Phone (Optional)</label>
                        <input
                            type="tel"
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.parentPhone}
                            onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                        />
                    </div>
                </div>

                {/* NEW: Source & Location Tracking */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lead Source</label>
                        <select
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.source}
                            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                        >
                            <option value="WALK_IN">Walk-in</option>
                            <option value="REFERRAL">Referral</option>
                            <option value="EVENT">Event / Seminar</option>
                            <option value="BDE">BDE (Business Development)</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </div>
                    <div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                {formData.source === 'BDE' ? 'BDE Name' : 'Source Details / Location'}
                            </label>
                            <input
                                type="text"
                                placeholder={formData.source === 'BDE' ? "Enter BDE Name" : "e.g. Science Fair, City Center Mall"}
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className={`${isEditMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 transition w-full md:w-auto justify-center`}
                >
                    {loading ? "Saving..." : <>{isEditMode ? <Edit className="w-4 h-4" /> : <Save className="w-4 h-4" />} {isEditMode ? "Update Inquiry" : "Save Inquiry"}</>}
                </button>
            </form>
        </div>
    );
};

export default AddLead;
