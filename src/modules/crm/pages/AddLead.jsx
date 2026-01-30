import React, { useState, useEffect } from 'react';
import { createLead, updateLead, checkLeadExists } from '../../../services/leadService';
import { getCounsellorsByCenter } from '../../../services/userService'; // Import Staff Service

import { UserPlus, Save, X, Edit, UserCheck, AlertTriangle } from 'lucide-react';

const AddLead = ({ userProfile, onSuccess, initialData = null, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState(null); // Warning State
    const [counselors, setCounselors] = useState([]); // Store counselors
    const [formData, setFormData] = useState({
        studentName: '',
        aadhar: '',
        phone: '',
        parentPhone: '',
        course: '',
        source: userProfile?.role === 'BDE' ? 'BDE' : 'WALK_IN',
        location: userProfile?.role === 'BDE' ? (userProfile.name || '') : '', // PRE-FILL for BDE
        assignedTo: '', // New Field
        board: '',
        address: '',
        remarks: ''
    });

    // Fetch Counselors on Mount
    useEffect(() => {
        const loadStaff = async () => {
            if (userProfile?.centerId) {
                const staff = await getCounsellorsByCenter(userProfile.centerId);
                // Filter: Only show "COUNSELOR", "COUNSELLOR", or "STAFF" (Exclude BDE, Manager, Front Desk)
                const realCounselors = (staff || []).filter(s => {
                    const r = s.role?.toUpperCase();
                    return r === 'COUNSELOR' || r === 'COUNSELLOR' || r === 'STAFF';
                });
                setCounselors(realCounselors);
            }
        };
        loadStaff();
    }, [userProfile]);

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
                location: locValue,
                board: initialData.board || '',
                address: initialData.address || '',
                remarks: initialData.remarks || ''
            });
        }
    }, [initialData]);

    // FIX: Auto-fill BDE Name & Source if user is BDE (Handles async userProfile load)
    useEffect(() => {
        if (!isEditMode && userProfile?.role === 'BDE') {
            setFormData(prev => ({
                ...prev,
                source: 'BDE',
                // Only set location if it's empty, preventing overwrite if they typed something (though it's read-only)
                location: prev.location || userProfile.name || ''
            }));
        }
    }, [userProfile, isEditMode]);

    // Generic Duplicate Handler
    const checkDuplicate = async (value, type) => {
        const check = await checkLeadExists(value, type);
        if (check.exists) {
            const src = check.lead.sourceDetails?.enteredBy || check.lead.source || 'Unknown';
            const date = check.lead.createdAt?.seconds ? new Date(check.lead.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown';

            setDuplicateWarning({
                type: type, // 'PHONE' or 'NAME'
                name: check.lead.studentName || 'Unknown Student',
                source: src,
                date: date,
                assignedTo: check.lead.assignedByName || 'Unassigned'
            });
        } else {
            // Only clear warning if it matches the generic type we are checking
            setDuplicateWarning(prev => (prev?.type === type ? null : prev));
        }
    };

    const handlePhoneBlur = () => {
        if (formData.phone && formData.phone.length === 10) {
            checkDuplicate(formData.phone, 'PHONE');
        }
    };

    const handleNameBlur = () => {
        if (formData.studentName && formData.studentName.length > 2) {
            checkDuplicate(formData.studentName, 'NAME');
        }
    };






    const handleSubmit = async (e) => {
        e.preventDefault();

        // STRICT VALIDATION: Phone Number must be 10 digits
        if (formData.phone.length !== 10) {
            alert("Please enter a valid 10-digit Phone Number.");
            return;
        }

        // MANDATORY CHECKS: BDE & FRONT_DESK
        if (userProfile?.role === 'BDE' || userProfile?.role === 'FRONT_DESK') {
            if (!formData.assignedTo) {
                alert(`As a ${userProfile.role.replace('_', ' ')}, you MUST assign this inquiry to a Counselor.`);
                return;
            }
            if (!formData.course) {
                alert(`Please select the Course Interest (Mandatory for ${userProfile.role.replace('_', ' ')}).`);
                return;
            }
            if (!formData.studentName || formData.studentName.trim().length < 3) {
                alert("Please enter a valid Student Name.");
                return;
            }
        }

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

        // Handle Assignment Logic
        if (formData.assignedTo) {
            const assignedStaff = counselors.find(c => c.uid === formData.assignedTo);
            if (assignedStaff) {
                submissionData.assignedTo = formData.assignedTo;
                submissionData.assignedByName = assignedStaff.name; // FIX: Match Service Key
                submissionData.status = 'ASSIGNED'; // Auto-update status
            }
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
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className={`px-6 py-4 flex justify-between items-center ${isEditMode ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    {isEditMode ? <Edit className="w-6 h-6 text-white/90" /> : <UserPlus className="w-6 h-6 text-white/90" />}
                    {isEditMode ? "Edit Inquiry Details" : "New Inquiry Registration"}
                </h2>
                {onClose && (
                    <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition text-white backdrop-blur-sm">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">

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
                                onBlur={handleNameBlur}
                            />
                            {duplicateWarning?.type === 'NAME' && (
                                <div className="mt-1 text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-200 animate-pulse">
                                    <span className="font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Possible Duplicate Name!</span>
                                    Review: {duplicateWarning.name} (Source: {duplicateWarning.source})
                                </div>
                            )}
                        </div>
                        {/* Aadhar Removed from Quick Inquiry - Only for Admissions */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Course Interest</label>
                            <select
                                className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-50 outline-none ${(userProfile?.role === 'BDE' || userProfile?.role === 'FRONT_DESK') && !formData.course ? 'border-red-300 bg-red-50' : ''}`}
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
                                maxLength="10"
                                placeholder="9876543210"
                                className={`w-full p-2 border rounded focus:ring-2 outline-none ${duplicateWarning ? 'border-orange-500 focus:ring-orange-200 bg-orange-50' : 'focus:ring-blue-500'}`}
                                value={formData.phone}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setFormData({ ...formData, phone: val });
                                    if (val.length < 10 && duplicateWarning) setDuplicateWarning(null);
                                }}
                                onBlur={handlePhoneBlur}
                            />
                            {duplicateWarning?.type === 'PHONE' && (
                                <div className="mt-1 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 animate-pulse">
                                    <span className="font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Number Already Exists!</span>
                                    Lead: {duplicateWarning.name}, Assigned To: {duplicateWarning.assignedTo}
                                </div>
                            )}
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
                                    readOnly={formData.source === 'BDE'}
                                />
                            </div>

                        </div>
                    </div>



                    {/* NEW: Additional Info (Board, Address, Remarks) */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Board */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Board</label>
                                <select
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.board}
                                    onChange={(e) => setFormData({ ...formData, board: e.target.value })}
                                >
                                    <option value="">-- Select Board --</option>
                                    <option value="STATE">State Board</option>
                                    <option value="CBSE">CBSE</option>
                                    <option value="ICSE">ICSE</option>
                                    <option value="IB">IB / Other</option>
                                </select>
                            </div>
                            {/* Address / Area */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Residential Area / Address</label>
                                <input
                                    type="text"
                                    placeholder="e.g. College Road, Nashik"
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Remarks */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Remarks / Notes</label>
                            <textarea
                                rows="2"
                                placeholder="Any specific requirements or notes..."
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                value={formData.remarks}
                                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* ASSIGNMENT (Front Desk & BDE) */}
                    {
                        (userProfile?.role === 'FRONT_DESK' || userProfile?.role === 'MANAGER' || userProfile?.role === 'DIRECTOR' || userProfile?.role === 'BDE') && (
                            <div className="mt-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100 animate-in fade-in duration-300">
                                <label className="block text-xs font-bold text-indigo-800 uppercase mb-2 flex items-center gap-1">
                                    <UserCheck className="w-4 h-4" /> Assign to Counselor (Instant)
                                </label>
                                <select
                                    className={`w-full p-2 border border-indigo-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold text-indigo-900 ${(userProfile?.role === 'BDE' || userProfile?.role === 'FRONT_DESK') && !formData.assignedTo ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                                    value={formData.assignedTo}
                                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                                >
                                    <option value="">-- {(userProfile?.role === 'BDE' || userProfile?.role === 'FRONT_DESK') ? 'Select Counselor (Required)' : 'Keep Unassigned (Pool)'} --</option>
                                    {counselors.map(staff => (
                                        <option key={staff.uid} value={staff.uid}>
                                            {staff.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-indigo-400 mt-1">
                                    Selected counselor will see this lead immediately in "My Leads".
                                </p>
                            </div>
                        )
                    }

                    <button
                        type="submit"
                        disabled={loading}
                        className={`${isEditMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 transition w-full md:w-auto justify-center`}
                    >
                        {loading ? "Saving..." : <>{isEditMode ? <Edit className="w-4 h-4" /> : <Save className="w-4 h-4" />} {isEditMode ? "Update Inquiry" : "Save Inquiry"}</>}
                    </button>
                </form >
            </div>
        </div>
    );
};

export default AddLead;
