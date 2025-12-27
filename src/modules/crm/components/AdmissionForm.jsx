import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../../../firebase';
import { doc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { generateTokenReceipt } from '../../../utils/pdfGenerator';
import { fetchBatches } from '../../../services/batchService';
import { User, Phone, MapPin, Mail, CreditCard, Save, X, School, Users, UserCheck, Lock, Clock } from 'lucide-react';
import { CENTERS } from '../../../utils/centers';
import { useFeeStructure } from '../../../hooks/useFeeStructure';

const AdmissionForm = ({ userProfile, currentCenter }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const leadData = location.state?.lead || {};
    const quoteData = location.state?.quote || {};

    const { feeStructures } = useFeeStructure();

    const [loading, setLoading] = useState(false);

    // Batch State
    const [batches, setBatches] = useState([]);
    const [filteredBatches, setFilteredBatches] = useState([]);
    const [selectedBatchObj, setSelectedBatchObj] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        // Personal
        studentName: leadData.studentName || '',
        dob: '',
        gender: 'Male',
        category: 'General',
        email: '',
        admissionDate: new Date().toISOString().split('T')[0], // Default Today

        // Background Info
        source: leadData.source || 'Walk-in',
        referrer: leadData.referrer || leadData.bdeName || leadData.sourceDetails || '',
        previousSchool: leadData.school || '',
        currentGrade: '',
        tieUpCollege: '',

        // Contact
        phone: leadData.phone || '',
        parentPhone: leadData.parentPhone || '',
        fatherName: leadData.fatherName || '', // New Field
        motherName: leadData.motherName || '', // New Field
        address: leadData.city || '',
        city: 'Nashik',
        pincode: '',

        // Academic
        // NEW: Admission Mode
        admissionMode: 'ONLINE',

        school: '',
        standard: '',
        program: leadData.courseInterest || quoteData.selectedProgram || '',
        batch: '',
        batchName: '',

        // Fee & Token
        totalFee: quoteData.finalFee || '',
        tokenAmount: '',
        paymentMode: 'UPI',
        enrollmentDate: '', // NEW: Custom Start Date
        remarks: '',
        proofImage: null,

        // NEW: Loan Management
        aadhar: leadData.aadhar || '',
        paymentPlan: 'INSTALLMENT', // INSTALLMENT or LOAN
        loanAmount: '',
        downPayment: ''
    });

    // Determine Center
    const isDirector = userProfile?.role?.toUpperCase() === 'DIRECTOR';
    const centerId = (() => {
        if (isDirector) {
            // 1. Lead's Origin (Highest Priority)
            if (leadData.centerId) return leadData.centerId;
            // 2. Navbar Selection (If no lead) - passed via props now
            if (currentCenter?.id) return currentCenter.id;
            // 3. Fallback
            return 'UN_COLLEGE';
        }
        // Managers/Staff: Enforce Profile Center
        return userProfile?.centerId || 'UN_COLLEGE';
    })();

    const centerInfo = CENTERS[centerId] || CENTERS['UN_COLLEGE'];

    // 1. Initial Load of Batches
    useEffect(() => {
        if (userProfile?.centerId) {
            const load = async () => {
                try {
                    const allBatches = await fetchBatches(userProfile.centerId);
                    setBatches(allBatches || []);
                } catch (err) {
                    console.error("Failed to load batches", err);
                }
            };
            load();
        }
    }, [userProfile]);

    // 2. Filtering Logic for Batches
    useEffect(() => {
        if (!formData.standard) {
            setFilteredBatches([]);
            return;
        }

        // Map Standard String to Code
        let code = "";
        if (formData.standard.includes("11th JEE")) code = "JEE_11";
        else if (formData.standard.includes("11th NEET")) code = "NEET_11";
        else if (formData.standard.includes("12th JEE")) code = "JEE_12";
        else if (formData.standard.includes("12th NEET")) code = "NEET_12";
        else if (formData.standard.includes("MHT CET 1 Year")) code = "MHT_CET_12";
        else if (formData.standard.includes("MHT CET 2 Year")) code = "MHT_CET_11";
        else if (formData.standard.includes("8th")) code = "FOUNDATION_8";
        else if (formData.standard.includes("9th")) code = "FOUNDATION_9";
        else if (formData.standard.includes("10th")) code = "FOUNDATION_10";

        if (code) {
            const matches = batches.filter(b => b.course === code);
            setFilteredBatches(matches);
        } else {
            setFilteredBatches([]);
        }
    }, [formData.standard, batches]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userProfile?.uid) {
            alert("Error: User session invalid. Please refresh.");
            return;
        }

        // MANDATORY CHECKS
        if (!formData.proofImage) {
            alert("⚠️ Payment Proof is Mandatory! Please upload a screenshot or photo of the receipt.");
            return;
        }
        if (!formData.enrollmentDate) {
            alert("⚠️ Enrolment Date is Mandatory! Please select the start date.");
            return;
        }

        setLoading(true);

        try {
            // 1. Create Admission Record
            const admissionId = `ADM-${Date.now()}`;
            const admissionRef = doc(db, "admissions", admissionId);

            const admissionData = {
                ...formData,
                id: admissionId,
                leadId: leadData.id || null,
                centerId: centerId,
                centerName: centerInfo?.name || centerId,
                counsellorId: userProfile.uid || userProfile.id,
                counsellorName: userProfile.name,

                // Admission Mode
                admissionMode: formData.admissionMode || 'ONLINE',
                retoolingStatus: (formData.admissionMode === 'ONLINE') ? 'PENDING' : 'NA', // Default Retooling Status for Online

                // Batch Info
                batchId: formData.batch || null,
                batchName: formData.batchName || null,
                batchAssigned: formData.batchName || null, // FIX: Direct Enrollment (Matches BatchDetails Query)

                enrollmentDate: formData.enrollmentDate || null, // SAVE DATE

                // Financials
                amount: Number(formData.totalFee), // Total Agreed Fee
                totalPaid: Number(formData.tokenAmount), // Initial Token
                status: 'PENDING_APPROVAL',

                // Payment History
                payments: [{
                    amount: Number(formData.tokenAmount),
                    date: Timestamp.now(),
                    mode: formData.paymentMode,
                    type: "Token / Booking",
                    proofImage: formData.proofImage || null
                }],

                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),

                // NEW: Loan Fields
                aadhar: formData.aadhar,
                paymentPlan: formData.paymentPlan,
                loanAmount: Number(formData.loanAmount) || 0,
                downPayment: Number(formData.downPayment) || 0
            };

            await setDoc(admissionRef, admissionData);

            // 2. Update Lead Status (if exists)
            if (leadData.id) {
                const leadRef = doc(db, "leads", leadData.id);
                await updateDoc(leadRef, {
                    status: 'CONVERTED',
                    admissionId: admissionId
                });
            }

            alert("✅ Admission Submitted to Accounts for Verification!");
            navigate('/staff/dashboard');

        } catch (error) {
            console.error(error);
            alert("Error processing admission: " + error.message);
        }
        setLoading(false);
    };

    // --- MAIN FORM RENDER ---
    return (
        <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-blue-900 p-6 text-white flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <School className="w-6 h-6 text-blue-300" /> New Admission
                        </h1>
                        <p className="text-blue-200 text-sm opacity-90">Send to Accounts for Verification • {centerInfo?.name}</p>
                    </div>
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition"><X /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                    {/* 1. Student Bio-Data */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">Student Bio-Data</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input required name="studentName" value={formData.studentName} onChange={handleChange} className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Student Name" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="student@example.com" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Aadhar Number</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input
                                        name="aadhar"
                                        value={formData.aadhar}
                                        onChange={handleChange}
                                        className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="12-Digit UID"
                                        maxLength={12}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date of Birth</label>
                                <input name="dob" type="date" value={formData.dob} onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Gender</label>
                                <select name="gender" value={formData.gender} onChange={handleChange} className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option>Male</option>
                                    <option>Female</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* 1.5 Source & Background */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">Background Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Source of Enquiry</label>
                                <select name="source" value={formData.source} onChange={handleChange} className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option>Walk-in</option>
                                    <option>Social Media</option>
                                    <option>UNSAT / Scholarship Exam</option>
                                    <option>Referral</option>
                                    <option>Google / Website</option>
                                    <option>Seminar / Event</option>
                                    <option>Other</option>
                                </select>
                            </div>

                            {(formData.source === 'Referral' || formData.source === 'Other') && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referrer Name / Details</label>
                                    <input name="referrer" value={formData.referrer} onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Who referred?" />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Previous School Name</label>
                                <div className="relative">
                                    <School className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input name="previousSchool" value={formData.previousSchool} onChange={handleChange} className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="School Name" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Grade / Class</label>
                                <select name="currentGrade" value={formData.currentGrade} onChange={handleChange} className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option value="">-- Select Grade --</option>
                                    <option>8th</option>
                                    <option>9th</option>
                                    <option>10th</option>
                                    <option>11th</option>
                                    <option>12th</option>
                                    <option>Repeater</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tie-Up College (Optional)</label>
                                <div className="relative">
                                    <School className="absolute left-3 top-3 w-5 h-5 text-indigo-400" />
                                    <input name="tieUpCollege" value={formData.tieUpCollege} onChange={handleChange} className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="If applicable" />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 2. Academic Preference */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">Academic & Mode</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* ADMISSION MODE */}
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 md:col-span-2 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
                                        <School className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-purple-900 uppercase">Admission Mode</label>
                                        <p className="text-xs text-purple-600">Select if the student will attend Online or Offline.</p>
                                    </div>
                                </div>
                                <select
                                    name="admissionMode"
                                    value={formData.admissionMode}
                                    onChange={handleChange}
                                    className="w-full md:w-48 p-3 border-2 border-purple-200 rounded-lg text-purple-900 font-bold focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer hover:bg-white transition"
                                >
                                    <option value="ONLINE">Online Platform</option>
                                    <option value="OFFLINE">Offline Center</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Standard / Target Exam</label>
                                <select
                                    name="standard"
                                    value={formData.standard}
                                    onChange={(e) => {
                                        const selectedStd = e.target.value;
                                        // Auto-Map Standard to Program Key
                                        let programKey = "";
                                        const isPrayas = centerId === 'PRAYAS';
                                        const prefix = isPrayas ? 'PRAYAS_' : '';

                                        if (selectedStd.includes("11th")) programKey = "NEET_JEE_2Y";
                                        else if (selectedStd.includes("12th")) programKey = "NEET_JEE_1Y";
                                        else if (selectedStd.includes("MHT CET 1 Year")) programKey = "MHT_CET_12";
                                        else if (selectedStd.includes("MHT CET 2 Year")) programKey = "MHT_CET_11";
                                        else if (selectedStd.includes("Repeater")) programKey = "NEET_JEE_1Y";
                                        else if (selectedStd.includes("8th")) programKey = "CLASS_8";
                                        else if (selectedStd.includes("9th")) programKey = "CLASS_9";
                                        else if (selectedStd.includes("10th")) programKey = "CLASS_10";

                                        // Construct Final Key
                                        const finalKey = (prefix + programKey).toUpperCase();

                                        // Update Form: Set Standard AND Linked Program
                                        setFormData(prev => ({
                                            ...prev,
                                            standard: selectedStd,
                                            program: feeStructures?.[finalKey] ? finalKey : ''
                                        }));
                                    }}
                                    className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">-- Select Class --</option>
                                    <optgroup label="Foundation">
                                        <option value="8th Foundation">Class 8 Foundation</option>
                                        <option value="9th Foundation">Class 9 Foundation</option>
                                        <option value="10th Foundation">Class 10 Foundation</option>
                                    </optgroup>
                                    <optgroup label="JEE (Engineering)">
                                        <option value="11th JEE">Class 11 JEE (2 Year)</option>
                                        <option value="12th JEE">Class 12 JEE (1 Year)</option>
                                        <option value="Repeater JEE">Repeater JEE</option>
                                    </optgroup>
                                    <optgroup label="NEET (Medical)">
                                        <option value="11th NEET">Class 11 NEET (2 Year)</option>
                                        <option value="12th NEET">Class 12 NEET (1 Year)</option>
                                        <option value="Repeater NEET">Repeater NEET</option>
                                    </optgroup>
                                    <optgroup label="MHT CET (Engineering/Pharmacy)">
                                        <option value="MHT CET 1 Year">MHT CET (1 Year)</option>
                                        <option value="MHT CET 2 Year">MHT CET (2 Year)</option>
                                    </optgroup>
                                </select>
                            </div>
                            <div className="">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fee Program (Auto-Linked)</label>
                                <input readOnly name="program" value={formData.program} className="w-full p-3 border rounded-lg bg-gray-100 text-gray-500 outline-none cursor-not-allowed" />
                            </div>

                            {/* BATCH SELECTION - ONLY SHOW IF STANDARD SELECTED */}
                            {formData.standard && (
                                <div className="md:col-span-2 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                    <label className="block text-xs font-bold text-indigo-700 uppercase mb-2">Select Batch (Optional)</label>
                                    <select
                                        name="batch"
                                        value={formData.batch}
                                        onChange={(e) => {
                                            const selectedId = e.target.value;
                                            const batchObj = batches.find(b => b.id === selectedId);
                                            setFormData({ ...formData, batch: selectedId, batchName: batchObj?.name || '' });
                                            setSelectedBatchObj(batchObj);
                                        }}
                                        className="w-full p-3 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                    >
                                        <option value="">-- Assign Batch Later --</option>
                                        {filteredBatches.length > 0 ? (
                                            filteredBatches.map(b => (
                                                <option key={b.id} value={b.id}>
                                                    {b.name} (Starts: {b.startDate ? new Date(b.startDate).toLocaleDateString() : 'TBA'})
                                                </option>
                                            ))
                                        ) : <option disabled>No batches found for this class</option>}
                                    </select>

                                    {/* FACULTY PREVIEW CARD */}
                                    {selectedBatchObj && (
                                        <div className="mt-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-start">
                                            {selectedBatchObj.facultyPhotoUrl ? (
                                                <div className="w-full md:w-1/3">
                                                    <img src={selectedBatchObj.facultyPhotoUrl} alt="Faculty Team" className="w-full h-32 object-cover rounded-lg" />
                                                    <p className="text-xs text-center text-gray-500 mt-1">Faculty Team</p>
                                                </div>
                                            ) : (
                                                <div className="w-full md:w-1/3 h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                                                    <Users className="w-8 h-8 mb-1" />
                                                    No Photo
                                                </div>
                                            )}

                                            <div className="flex-1">
                                                <h4 className="font-bold text-gray-800 text-sm mb-2">{selectedBatchObj.name} - Faculty</h4>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {selectedBatchObj.faculty?.map((fac, idx) => (
                                                        <div key={idx} className="text-xs bg-gray-50 p-2 rounded border">
                                                            <span className="block text-gray-500 font-bold">{fac.subject}</span>
                                                            <span className="block text-gray-800">{fac.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-3 text-xs text-green-600 font-bold flex items-center gap-1">
                                                    <UserCheck className="w-3 h-3" /> This batch information will be shared with the parent.
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date of Admission</label>
                                <input
                                    type="date"
                                    name="admissionDate"
                                    value={formData.admissionDate}
                                    onChange={handleChange}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </section>

                    {/* 2. Contact Details */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">Parents & Address</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Father's Name */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Father's Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input required name="fatherName" value={formData.fatherName} onChange={handleChange} className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Father's Full Name" />
                                </div>
                            </div>

                            {/* Father's Phone */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Father's Phone No.</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input required name="parentPhone" value={formData.parentPhone} onChange={handleChange} className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>

                            {/* Mother's Name */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mother's Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input required name="motherName" value={formData.motherName} onChange={handleChange} className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Mother's Name" />
                                </div>
                            </div>

                            {/* City */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">City</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input name="city" value={formData.city} onChange={handleChange} className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="City" />
                                </div>
                            </div>

                            {/* Student Personal Mobile (Moved here for flow or keep separated?) -> User asked for Parent & Address focus. Let's keep Student Mobile but maybe rename section slightly or just keep it. */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Enrollment Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input required name="phone" value={formData.phone} onChange={handleChange} className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enrollment Phone Number" />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Residential Address</label>
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                                    placeholder="Full Residential Address"
                                />
                            </div>
                        </div>
                    </section>

                    {/* 3. Payment & Token */}
                    <section className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                        <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <CreditCard className="w-4 h-4" /> Fee & Token Payment
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Agreed Fee (₹)</label>
                                <input
                                    required
                                    type="number"
                                    name="totalFee"
                                    value={formData.totalFee}
                                    onChange={handleChange}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800"
                                    placeholder="Total Fee"
                                />
                            </div>


                            {/* PAYMENT PLAN SELECTION */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Payment Plan Type</label>
                                <select
                                    name="paymentPlan"
                                    value={formData.paymentPlan}
                                    onChange={(e) => {
                                        const mode = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            paymentPlan: mode,
                                            // Auto-calc defaults if switching to Loan
                                            loanAmount: mode === 'LOAN' ? (Number(prev.totalFee) * 0.75) : '',
                                            downPayment: mode === 'LOAN' ? (Number(prev.totalFee) * 0.25) : '',
                                            tokenAmount: mode === 'LOAN' ? (Number(prev.totalFee) * 0.25) : prev.tokenAmount // Auto-fill token with down payment
                                        }));
                                    }}
                                    className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="INSTALLMENT">Standard Installment</option>
                                    <option value="LOAN">Education Loan (Finance)</option>
                                </select>
                            </div>

                            {/* LOAN SPECIFIC FIELDS */}
                            {formData.paymentPlan === 'LOAN' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-purple-600 uppercase mb-1">Down Payment (Cash/UPI) - 25%</label>
                                        <input
                                            type="number"
                                            name="downPayment"
                                            value={formData.downPayment}
                                            onChange={(e) => {
                                                const dp = Number(e.target.value);
                                                setFormData(prev => ({
                                                    ...prev,
                                                    downPayment: dp,
                                                    tokenAmount: dp, // Sync Token with Down Payment
                                                    loanAmount: Number(prev.totalFee) - dp
                                                }));
                                            }}
                                            className="w-full p-3 border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-bold text-purple-700 bg-purple-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-orange-600 uppercase mb-1">Loan Amount (Finance) - 75%</label>
                                        <input
                                            type="number"
                                            name="loanAmount"
                                            value={formData.loanAmount}
                                            onChange={(e) => setFormData({ ...formData, loanAmount: e.target.value })}
                                            className="w-full p-3 border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-bold text-orange-700 bg-orange-50"
                                            placeholder="Remaining Amount"
                                        />
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Token Amount (Paying Now)</label>
                                <input
                                    required
                                    type="number"
                                    name="tokenAmount"
                                    value={formData.tokenAmount}
                                    onChange={handleChange}
                                    className="w-full p-3 border-2 border-green-400 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold text-green-700 bg-white"
                                    placeholder="Min ₹5000"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Upload Payment Proof <span className="text-red-500">*</span></label>
                                <div className="border border-dashed border-gray-300 rounded-lg p-3 hover:bg-gray-50 transition cursor-pointer relative bg-white">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        required={!formData.proofImage}
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setFormData({ ...formData, proofImage: reader.result });
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    <div className="flex items-center gap-3">
                                        {formData.proofImage ? (
                                            <img src={formData.proofImage} alt="Proof" className="w-10 h-10 object-cover rounded bg-green-50" />
                                        ) : (
                                            <div className="w-10 h-10 bg-indigo-50 rounded flex items-center justify-center text-indigo-400">
                                                <CreditCard className="w-5 h-5" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-xs font-bold text-gray-700">{formData.proofImage ? "Proof Attached" : "Click to Upload"}</p>
                                            <p className="text-[10px] text-gray-400">Screenshot / Receipt</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Payment Mode</label>
                                <select name="paymentMode" value={formData.paymentMode} onChange={handleChange} className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option>UPI</option>
                                    <option>Cash</option>
                                    <option>Cheque</option>
                                    <option>Card</option>
                                    <option>POS-SHS</option>
                                    <option>Ujjivan - QR</option>
                                    <option>KAP-QR</option>
                                </select>
                            </div>

                            {/* NEW: Enrollment Start Date */}
                            <div className="md:col-span-3 bg-white p-4 rounded-xl border border-blue-200">
                                <label className="block text-xs font-bold text-blue-800 uppercase mb-2 flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Enrollment / 1st Installment Date (Start Date) <span className="text-red-500">*</span>
                                </label>
                                <div className="flex flex-col md:flex-row gap-4 items-center">
                                    <input
                                        name="enrollmentDate"
                                        value={formData.enrollmentDate || ''}
                                        onChange={handleChange}
                                        type="date"
                                        required
                                        className="w-full md:w-1/3 p-3 border rounded-lg bg-gray-50 font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <p className="text-xs text-blue-600 flex-1">
                                        <strong>Note:</strong> The Installment Schedule (2nd & 3rd installments) will be automatically calculated starting from this date.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-900 hover:bg-black text-white font-bold py-4 rounded-xl shadow-lg transition flex justify-center items-center gap-2 text-lg"
                        >
                            {loading ? "Processing..." : <><Save className="w-6 h-6" /> Submit to Accounts</>}
                        </button>
                    </div>

                </form>
            </div>
        </div >
    );
};

export default AdmissionForm;
