import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../../../firebase';
import { doc, setDoc, updateDoc, Timestamp, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';
import { clearAdmissionsCache } from '../../../services/cacheService';
import { generateTokenReceipt } from '../../../utils/pdfGenerator';
import { fetchBatches } from '../../../services/batchService';
import { User, Phone, MapPin, Mail, CreditCard, Save, X, School, Users, UserCheck, Lock, Clock, AlertCircle } from 'lucide-react';
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

    // Duplicate Check State
    const [existingLead, setExistingLead] = useState(null);

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
        paymentMode: 'Cash',
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
    
    // NEW: Selected Center State for Cross-Center Admissions
    const [selectedCenterId, setSelectedCenterId] = useState(() => {
        if (isDirector) {
            if (leadData.centerId) return leadData.centerId;
            if (currentCenter?.id) return currentCenter.id;
            return 'UN_COLLEGE';
        }
        return userProfile?.centerId || 'UN_COLLEGE';
    });

    // Alias centerId to selectedCenterId so rest of code works as-is
    const centerId = selectedCenterId;
    const centerInfo = CENTERS[selectedCenterId] || CENTERS['UN_COLLEGE'];

    // 1. Initial Load of Batches (Now reacts to selectedCenterId)
    useEffect(() => {
        if (selectedCenterId) {
            const load = async () => {
                try {
                    const allBatches = await fetchBatches(selectedCenterId);
                    setBatches(allBatches || []);
                    // Reset selected batch if center changes
                    setFormData(prev => ({ ...prev, batch: '', batchName: '' }));
                    setSelectedBatchObj(null);
                } catch (err) {
                    console.error("Failed to load batches", err);
                }
            };
            load();
        }
    }, [selectedCenterId]);

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

    // Check for Existing Lead (Enhanced: Name & Phones)
    const checkLeadExistence = async (e) => {
        const { name, value } = e.target;
        if (!value || value.length < 3) return;

        // Skip check if we already have lead data passed in (Proper Conversion)
        if (leadData?.id) return;

        try {
            const leadsRef = collection(db, "leads");
            let potentialLead = null;

            if (name === 'phone' || name === 'parentPhone') {
                if (value.length < 10) return; // Min length for phone

                // Check BOTH phone fields in DB for this number
                // (e.g. Father's number might be saved as primary phone in lead)
                const q1 = query(leadsRef, where("phone", "==", value));
                const q2 = query(leadsRef, where("parentPhone", "==", value));

                const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

                if (!snap1.empty) potentialLead = { id: snap1.docs[0].id, ...snap1.docs[0].data() };
                else if (!snap2.empty) potentialLead = { id: snap2.docs[0].id, ...snap2.docs[0].data() };

            } else if (name === 'studentName') {
                // Exact Name Match
                const qName = query(leadsRef, where("studentName", "==", value));
                const snapName = await getDocs(qName);
                if (!snapName.empty) potentialLead = { id: snapName.docs[0].id, ...snapName.docs[0].data() };
            }

            if (potentialLead) {
                setExistingLead(potentialLead);
            }
        } catch (error) {
            console.error("Error checking for existing lead:", error);
        }
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
            const admissionId = `ADM-${Date.now()}`;
            const admissionRef = doc(db, "admissions", admissionId);

            // 1. Resolve or Auto-Create CRM Lead
            let finalLeadId = leadData.id || null;
            let isNewLeadCreated = false;
            let resolvedLeadData = leadData.id ? leadData : null; // Keep track of the lead's existing data

            if (!finalLeadId && formData.phone) {
                const q = query(collection(db, "leads"), where("phone", "==", formData.phone));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    finalLeadId = snap.docs[0].id;
                    resolvedLeadData = snap.docs[0].data(); // Capture the existing lead data
                } else {
                    const newLeadRef = doc(collection(db, "leads"));
                    finalLeadId = newLeadRef.id;
                    isNewLeadCreated = true;
                    await setDoc(newLeadRef, {
                        id: finalLeadId,
                        studentName: formData.studentName,
                        phone: formData.phone,
                        parentPhone: formData.parentPhone,
                        centerId: centerId,
                        counsellorId: userProfile.uid || userProfile.id,
                        counsellorName: userProfile.name,
                        status: 'CONVERTED',
                        admissionId: admissionId,
                        courseInterest: formData.program,
                        createdAt: Timestamp.now(),
                        timeline: [{
                            type: "DIRECT_ADMISSION",
                            result: "Lead Created (Direct Admission)",
                            note: `Direct Admission Taken by ${userProfile.name}. Token: ₹${Number(formData.tokenAmount).toLocaleString()}`,
                            date: new Date(),
                            by: userProfile.name
                        }]
                    });
                }
            }

            const admissionData = {
                ...formData,
                id: admissionId,
                leadId: finalLeadId,
                centerId: centerId,
                centerName: centerInfo?.name || centerId,
                
                // INHERIT Counsellor from Lead (If it exists), otherwise use current user
                counsellorId: resolvedLeadData?.assignedTo || userProfile.uid || userProfile.id,
                counsellorName: resolvedLeadData?.assignedByName || userProfile.name,
                
                // Track who actually filled the form (e.g., Manager)
                bookedById: userProfile.uid || userProfile.id,
                bookedBy: userProfile.name,

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
            clearAdmissionsCache();

            // 2. Update Lead Status (if exists and not newly created)
            if (finalLeadId && !isNewLeadCreated) {
                const leadRef = doc(db, "leads", finalLeadId);
                const timelineEntry = {
                    type: "ADMISSION_TAKEN",
                    result: `Admission Created`,
                    note: `Admission Taken by ${userProfile.name}. Token: ₹${Number(formData.tokenAmount).toLocaleString()}. Mode: ${formData.paymentMode}`,
                    date: new Date(),
                    by: userProfile.name
                };

                await updateDoc(leadRef, {
                    status: 'CONVERTED',
                    admissionId: admissionId,
                    timeline: arrayUnion(timelineEntry)
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
                {existingLead && (
                    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-red-100">
                            <div className="bg-amber-50 p-6 border-b border-amber-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                                        <AlertCircle className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-amber-900">Lead Already Exists!</h3>
                                </div>
                                <p className="text-amber-700 text-sm leading-relaxed">
                                    This phone number is already registered in the CRM. Please take admission through the CRM to maintain history.
                                </p>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Student Name</span>
                                        <span className="font-bold text-slate-800">{existingLead.studentName}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Status</span>
                                        <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs uppercase">{existingLead.status}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Assigned To</span>
                                        <span className="font-bold text-slate-800">{existingLead.assignedByName || "Unassigned"}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 mt-4">
                                    <button
                                        onClick={() => navigate(`/staff/leads/${existingLead.id}`)}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md hover:shadow-lg transform active:scale-95"
                                    >
                                        <Users className="w-4 h-4" /> View Existing Lead
                                    </button>

                                    <button
                                        onClick={() => setExistingLead(null)}
                                        className="w-full py-2 text-slate-400 hover:text-slate-600 text-xs font-semibold hover:underline transition"
                                    >
                                        Ignore & Create Duplicate (Not Recommended)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Modal Overlay */}
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

                            {/* ACADEMIC CENTER SELECTION */}
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 md:col-span-2 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                                        <MapPin className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-blue-900 uppercase">Academic Center</label>
                                        <p className="text-xs text-blue-600">Where will this student actually study? (Changes batch list)</p>
                                    </div>
                                </div>
                                <select
                                    value={selectedCenterId}
                                    onChange={(e) => setSelectedCenterId(e.target.value)}
                                    className="w-full md:w-64 p-3 border-2 border-blue-200 rounded-lg text-blue-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:bg-white transition"
                                >
                                    {Object.entries(CENTERS).map(([id, info]) => (
                                        <option key={id} value={id}>{info.name}</option>
                                    ))}
                                </select>
                            </div>

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

                            {/* DYNAMIC COURSE SELECTION */}
                            <div className="">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Standard / Target Exam</label>
                                <select
                                    name="program"
                                    value={
                                        // Construct the Value to match the Option's value
                                        // If Standard is one of our special split names, append it
                                        (formData.standard && (formData.standard.includes("11th") || formData.standard.includes("12th") || formData.standard.includes("Repeater")))
                                            ? `${formData.program}|${formData.standard}`
                                            : formData.program
                                    }
                                    onChange={(e) => {
                                        const rawValue = e.target.value;
                                        if (!rawValue) {
                                            setFormData(prev => ({ ...prev, program: '', standard: '', totalFee: '' }));
                                            return;
                                        }

                                        // HANDLE SPLIT LOGIC (11th/12th/Repeater)
                                        const [realKey, splitType] = rawValue.includes('|') ? rawValue.split('|') : [rawValue, null];
                                        const courseObj = feeStructures?.[realKey];

                                        if (courseObj) {
                                            let displayName = courseObj.name;

                                            // LOGIC FOR STANDARD NAME (Critical for Batch Filter)
                                            // The filter checks for "11th JEE", "Repeater", etc.
                                            if (splitType) {
                                                displayName = splitType; // Use the explicit label we generated (e.g., "11th JEE (2 Year)")
                                            }

                                            setFormData(prev => ({
                                                ...prev,
                                                program: realKey, // Fee Key remains same (e.g. NEET_JEE_2Y)
                                                standard: displayName, // Name matches Dropdown Label exactly
                                                totalFee: courseObj.total,
                                                batch: '',
                                                batchName: ''
                                            }));
                                        }
                                    }}
                                    className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">-- Select Class --</option>

                                    {/* Filter and Map Courses with Categories & Split Logic */}
                                    {(() => {
                                        const isPrayas = centerId === 'PRAYAS';
                                        const rawKeys = Object.keys(feeStructures || {})
                                            .filter(key => isPrayas ? key.startsWith('PRAYAS_') : !key.startsWith('PRAYAS_'));

                                        // Categories
                                        const groups = {
                                            "Foundation (8-10)": [],
                                            "JEE (Engineering)": [],
                                            "NEET (Medical)": [],
                                            "MHT-CET": [],
                                            "Other": []
                                        };

                                        rawKeys.forEach(key => {
                                            const course = feeStructures[key];
                                            const name = course.name.toUpperCase();

                                            // EXPANDED MAPPING LOGIC
                                            // 1. NEET/JEE 2 Year -> 11th JEE & 11th NEET
                                            if (key.includes("NEET_JEE_2Y")) {
                                                groups["JEE (Engineering)"].push({ label: "11th JEE (2 Year)", value: `${key}|11th JEE (2 Year)`, type: 'JEE' });
                                                groups["NEET (Medical)"].push({ label: "11th NEET (2 Year)", value: `${key}|11th NEET (2 Year)`, type: 'NEET' });
                                                return;
                                            }

                                            // 2. NEET/JEE 1 Year -> 11th, 12th & Repeater
                                            if (key.includes("NEET_JEE_1Y")) {
                                                // 11th (1 Year)
                                                groups["JEE (Engineering)"].push({ label: "11th JEE (1 Year)", value: `${key}|11th JEE (1 Year)`, type: 'JEE' });
                                                groups["NEET (Medical)"].push({ label: "11th NEET (1 Year)", value: `${key}|11th NEET (1 Year)`, type: 'NEET' });
                                                // 12th
                                                groups["JEE (Engineering)"].push({ label: "12th JEE (1 Year)", value: `${key}|12th JEE (1 Year)`, type: 'JEE' });
                                                groups["NEET (Medical)"].push({ label: "12th NEET (1 Year)", value: `${key}|12th NEET (1 Year)`, type: 'NEET' });
                                                // Repeater
                                                groups["JEE (Engineering)"].push({ label: "Repeater JEE (1 Year)", value: `${key}|Repeater JEE (1 Year)`, type: 'JEE' });
                                                groups["NEET (Medical)"].push({ label: "Repeater NEET (1 Year)", value: `${key}|Repeater NEET (1 Year)`, type: 'NEET' });
                                                return;
                                            }

                                            // 3. MHT CET (Check for specific years if needed, or pass through)
                                            if (key.includes("MHT_CET")) {
                                                groups["MHT-CET"].push({ label: course.name, value: key, type: 'STANDARD' });
                                                return;
                                            }

                                            // 4. Default Pass Through
                                            let dest = "Other";
                                            if (name.includes("FOUNDATION") || name.includes("8") || name.includes("9") || name.includes("10")) dest = "Foundation (8-10)";
                                            else if (name.includes("JEE")) dest = "JEE (Engineering)";
                                            else if (name.includes("NEET")) dest = "NEET (Medical)";
                                            else if (name.includes("MHT")) dest = "MHT-CET";

                                            groups[dest].push({
                                                label: course.name,
                                                value: key,
                                                type: 'STANDARD'
                                            });
                                        });

                                        return Object.entries(groups).map(([category, options]) => {
                                            if (options.length === 0) return null;
                                            return (
                                                <optgroup key={category} label={category}>
                                                    {options.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </optgroup>
                                            );
                                        });
                                    })()}
                                </select>
                            </div>
                            <div className="">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fee Program Code</label>
                                <input readOnly name="program" value={formData.program} className="w-full p-3 text-xs border rounded-lg bg-gray-100 text-gray-400 font-mono outline-none cursor-not-allowed" />
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
                                    <input
                                        name="parentPhone"
                                        value={formData.parentPhone}
                                        onChange={handleChange}
                                        onBlur={checkLeadExistence} // Trigger Check
                                        className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
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
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        onBlur={checkLeadExistence} // Trigger Check
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                                        placeholder="Student's Mobile Number"
                                        required
                                    />
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
                                <select
                                    name="paymentMode"
                                    value={formData.paymentMode}
                                    onChange={handleChange}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800"
                                >
                                    <option>KAP Online (RTGS/NEFT)</option>
                                    <option>Cash</option>
                                    <option>Cheque</option>
                                    <option>KAP QR (AXIS)</option>
                                    <option>Ujjivan QR</option>
                                    <option>POS - SHS</option>
                                    <option>SHS Online (RTGS/NEFT)</option>
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
