import React, { useState, useEffect } from 'react';
import { createLead, updateLead, checkLeadExists } from '../../../services/leadService';
import { getCounsellorsByCenter, fetchBDEList } from '../../../services/userService'; // Import Staff Service

import { UserPlus, Save, X, Edit, UserCheck, AlertTriangle } from 'lucide-react';

const AddLead = ({ userProfile, onSuccess, initialData = null, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState(null); // Warning State
    const [counselors, setCounselors] = useState([]); // Store counselors
    const [bdeList, setBdeList] = useState([]); // Store BDEs

    // Define isEditMode early so it can be used in state initialization if needed, 
    // though usually better to rely on initialData check.
    const isEditMode = !!initialData;

    const [formData, setFormData] = useState({
        studentName: '',
        aadhar: '',
        phone: '',
        parentPhone: '',
        course: '',
        source: userProfile?.role === 'BDE' ? 'BDE' : 'WALK_IN',
        location: userProfile?.role === 'BDE' ? '' : '', // Default empty, decoupled override
        school: '', // NEW: School Name for BDE/Events
        assignedTo: '',
        board: '',
        currentStandard: '',
        address: '',
        remarks: '',
        bdeId: '', // NEW
        bdeName: '' // NEW
    });

    const [rawSourceDetails, setRawSourceDetails] = useState(null); // Preserve original object

    // Fetch Counselors on Mount
    useEffect(() => {
        const loadStaff = async () => {
            if (userProfile?.centerId) {
                const staff = await getCounsellorsByCenter(userProfile.centerId);
                // Filter: Allow "COUNSELOR", "COUNSELLOR", "STAFF", "MANAGER", "DIRECTOR"
                const realCounselors = (staff || []).filter(s => {
                    const r = s.role?.toUpperCase();
                    return r === 'COUNSELOR' || r === 'COUNSELLOR' || r === 'STAFF' || r === 'MANAGER' || r === 'DIRECTOR';
                });
                setCounselors(realCounselors);
            }

            // LOAD BDE List (for Non-BDE users)
            if (userProfile?.role !== 'BDE') {
                const bdes = await fetchBDEList();

                // FILTER: 
                // 1. Director sees ALL keys.
                // 2. Front Desk / Manager sees ONLY their center's BDEs.
                if (userProfile.role === 'DIRECTOR') {
                    setBdeList(bdes);
                } else {
                    const myCenter = (userProfile.centerId || '').trim().toUpperCase();
                    const filtered = bdes.filter(b => {
                        // Handle Legacy String (Show all? Or Hide? Let's hide to be safe/clean)
                        if (typeof b === 'string') return false;

                        // Handle Object (Standard)
                        const bCenter = (b.centerId || '').trim().toUpperCase();
                        return bCenter === myCenter;
                    });
                    setBdeList(filtered);
                }
            }
        };
        loadStaff();
    }, [userProfile]);

    useEffect(() => {
        if (initialData) {
            setRawSourceDetails(initialData.sourceDetails);

            // Robust Data Parsing
            let locValue = '';
            let schoolValue = '';
            if (initialData.sourceDetails) {
                if (typeof initialData.sourceDetails === 'object') {
                    locValue = initialData.sourceDetails.location || '';
                    schoolValue = initialData.sourceDetails.school || '';
                } else {
                    locValue = String(initialData.sourceDetails); // Legacy string fallback
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
                school: schoolValue,
                board: initialData.board || '',
                currentStandard: initialData.currentStandard || '',
                address: initialData.address || '',
                remarks: initialData.remarks || '',
                bdeId: initialData.bdeId || '',
                bdeName: initialData.bdeName || ''
            });
        }
    }, [initialData]);

    // FIX: Only auto-set Source to BDE, do NOT overwrite location
    // Also auto-set BDE ID/Name if they are a BDE.
    useEffect(() => {
        if (!isEditMode && userProfile?.role === 'BDE') {
            setFormData(prev => ({
                ...prev,
                source: 'BDE',
                bdeId: userProfile?.uid || '',
                bdeName: userProfile?.name || ''
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
        
        if (loading) return; // Prevent double submission
        setLoading(true);

        // STRICT VALIDATION: Phone Number must be 10 digits
        if (formData.phone.length !== 10) {
            alert("Please enter a valid 10-digit Phone Number.");
            setLoading(false);
            return;
        }

        // ==========================================
        // ROBUST DUPLICATE CHECK (Async)
        // ==========================================

        // 1. PHONE CHECK (Strict Block)
        // We re-verify with server to ensure no "state mismatch" allows a duplicate through.
        const phoneCheck = await checkLeadExists(formData.phone, 'PHONE');
        if (phoneCheck.exists) {
            // Allow if it's the SAME lead (Edit Mode)
            const isSameLead = isEditMode && initialData && phoneCheck.lead.id === initialData.id;

            if (!isSameLead) {
                alert(`Cannot save: Phone number already exists for ${phoneCheck.lead.studentName || 'Unknown'} (Assigned to: ${phoneCheck.lead.assignedByName || 'Unassigned'}).`);
                setLoading(false);
                return;
            }
        }

        // 2. NAME CHECK (Confirmation)
        if (formData.studentName && formData.studentName.length > 2) {
            const nameCheck = await checkLeadExists(formData.studentName, 'NAME');
            if (nameCheck.exists) {
                const isSameLead = isEditMode && initialData && nameCheck.lead.id === initialData.id;

                if (!isSameLead) {
                    const proceed = window.confirm(`A student with this name (${nameCheck.lead.studentName}) already exists. Do you want to proceed?`);
                    if (!proceed) {
                        setLoading(false);
                        return;
                    }
                }
            }
        }

        // MANDATORY CHECKS: BDE & FRONT_DESK
        if (userProfile?.role === 'BDE' || userProfile?.role === 'FRONT_DESK') {
            if (!formData.assignedTo) {
                alert(`As a ${userProfile.role.replace('_', ' ')}, you MUST assign this inquiry to a Counselor.`);
                setLoading(false);
                return;
            }
            if (!formData.course) {
                alert(`Please select the Course Interest (Mandatory for ${userProfile.role.replace('_', ' ')}).`);
                setLoading(false);
                return;
            }
            if (!formData.studentName || formData.studentName.trim().length < 3) {
                alert("Please enter a valid Student Name.");
                setLoading(false);
                return;
            }
            // Mandatory School/Location check for BDE
            if (userProfile?.role === 'BDE' && (!formData.location || !formData.school)) {
                // Info: We allow lenient save based on user request but warn if needed.
            }
        }

        const submissionData = { ...formData };
        const existingDetails = (typeof rawSourceDetails === 'object') ? rawSourceDetails : {};

        let enteredByVal = (formData.source === 'BDE' && formData.bdeName) 
            ? formData.bdeName 
            : (isEditMode && existingDetails.enteredBy ? existingDetails.enteredBy : (userProfile?.name || 'System'));
            
        let roleVal = isEditMode && existingDetails.role ? existingDetails.role : userProfile?.role; // Preserve original or set new

        submissionData.sourceDetails = {
            ...existingDetails,
            enteredBy: enteredByVal,
            role: roleVal,
            location: formData.location,
            school: formData.school // Save School
        };

        // Handle Assignment Logic
        if (formData.assignedTo) {
            const assignedStaff = counselors.find(c => c.uid === formData.assignedTo);
            if (assignedStaff) {
                submissionData.assignedTo = formData.assignedTo;
                submissionData.assignedByName = assignedStaff.name;
                
                // Automatically move the lead to the assignee's center
                if (assignedStaff.centerId) {
                    submissionData.centerId = assignedStaff.centerId;
                }
                
                // Preserve 'CONVERTED' or other final statuses during edits
                const currentStatus = String(initialData?.status || "").trim().toUpperCase();
                const isConverted = isEditMode && ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN', 'CLOSED', 'LOST', 'REJECTED'].includes(currentStatus);
                
                if (!isConverted) {
                    submissionData.status = 'ASSIGNED';
                } else {
                    submissionData.status = initialData.status; // Keep original
                }
            }
        }

        let result;
        if (isEditMode) {
            // Prevent accidentally overwriting the `source` string if the original had a different source
            if (initialData && initialData.source && formData.source === initialData.source) {
                submissionData.source = initialData.source;
            }
            
            result = await updateLead(initialData.id, submissionData, userProfile);
        } else {
            result = await createLead(submissionData, userProfile);
        }

        if (result.success) {
            if (!isEditMode) setFormData({
                studentName: '', aadhar: '', phone: '', parentPhone: '', course: '',
                source: userProfile?.role === 'BDE' ? 'BDE' : 'WALK_IN',
                location: '', school: '', // Reset
                assignedTo: '', board: '', currentStandard: '', address: '', remarks: ''
            });
            if (onSuccess) onSuccess();
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
                    {/* ... (Keep Student Name & Phone Inputs same) ... */}
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
                                <option value="NEET_11_1Y">NEET 11th (1 Year)</option>
                                <option value="NEET_11">NEET 11th (2 Year)</option>
                                <option value="NEET_12">NEET 12th (1 Year)</option>
                                <option value="JEE_11_1Y">JEE 11th (1 Year)</option>
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

                    {/* UPDATED: Source & Location Tracking */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lead Source</label>
                                <select
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.source}
                                    onChange={(e) => {
                                        // Reset BDE fields when source changes to prevent pollution
                                        setFormData({
                                            ...formData,
                                            source: e.target.value,
                                            bdeId: '',
                                            bdeName: ''
                                        });
                                    }}
                                >
                                    <option value="WALK_IN">Walk-in</option>
                                    <option value="REFERRAL">Referral</option>
                                    <option value="EVENT">Event / Seminar</option>
                                    <option value="BDE">BDE (Business Development)</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>

                            {/* BDE Name Show Only */}
                            {formData.source === 'BDE' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">BDE Name</label>
                                    {/* LOGIC: If I am BDE, force my name. If I am Director/FrontDesk, allow Selection. */}
                                    {userProfile?.role === 'BDE' ? (
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded bg-gray-200 text-gray-600 cursor-not-allowed"
                                            value={userProfile?.name || "Current User"}
                                            readOnly
                                        />
                                    ) : (
                                        <select
                                            className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none ${!formData.bdeId ? 'border-orange-300 bg-orange-50' : ''}`}
                                            value={formData.bdeId}
                                            onChange={(e) => {
                                                const selectedId = e.target.value;
                                                const selectedBDE = bdeList.find(b => (b.id || b) === selectedId);
                                                // Handle legacy string vs new object format
                                                const name = selectedBDE ? (selectedBDE.name || selectedBDE) : '';
                                                setFormData({
                                                    ...formData,
                                                    bdeId: selectedId,
                                                    bdeName: name,
                                                    sourceDetails: name // Legacy Compatibility
                                                });
                                            }}
                                        >
                                            <option value="">-- Select BDE Who Generated Lead --</option>
                                            {bdeList.map((bde, idx) => {
                                                const id = bde.id || bde; // Handle object or string
                                                const name = bde.name || bde;
                                                const center = bde.centerId ? `(${bde.centerId})` : '';
                                                return (
                                                    <option key={id + idx} value={id}>
                                                        {name} {center}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Dynamic Location Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* School Name - Relevant for BDE & Events */}
                            {(formData.source === 'BDE' || formData.source === 'EVENT') && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">School Name / Coaching</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Fravashi Academy"
                                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.school}
                                        onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                                    />
                                </div>
                            )}

                            {/* Location - Relevant for All */}
                            <div className={formData.source === 'WALK_IN' ? "md:col-span-2" : ""}>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                    {formData.source === 'BDE' ? 'Visit Location / Area' : 'Source Location / Details'}
                                </label>
                                <input
                                    type="text"
                                    placeholder={formData.source === 'BDE' ? "e.g. College Road, City Center" : "e.g. Newspaper Ad, Friend"}
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* NEW: Additional Info (Board, Standard, Address, Remarks) */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Board */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Board</label>
                                <select
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.board}
                                    onChange={(e) => setFormData({ ...formData, board: e.target.value })}
                                >
                                    <option value="">-- Select --</option>
                                    <option value="STATE">State Board</option>
                                    <option value="CBSE">CBSE</option>
                                    <option value="ICSE">ICSE</option>
                                    <option value="IB">IB / Other</option>
                                </select>
                            </div>

                            {/* Current Standard (New) */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Standard</label>
                                <select
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.currentStandard}
                                    onChange={(e) => setFormData({ ...formData, currentStandard: e.target.value })}
                                >
                                    <option value="">-- Select --</option>
                                    <option value="8">8th</option>
                                    <option value="9">9th</option>
                                    <option value="10">10th</option>
                                    <option value="11">11th</option>
                                    <option value="12">12th</option>
                                    <option value="Dropper">Dropper</option>
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

                    {/* ASSIGNMENT (Front Desk & BDE ONLY - Removed Director) */}
                    {
                        (userProfile?.role === 'FRONT_DESK' || userProfile?.role === 'BDE' || userProfile?.role === 'MANAGER') && (
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
