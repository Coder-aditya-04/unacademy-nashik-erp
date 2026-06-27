import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../../firebase';
import { doc, getDoc, updateDoc, serverTimestamp, increment, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';
import { clearAdmissionsCache } from '../../../services/cacheService';
import { generateTaxInvoice } from '../../../utils/pdfGenerator';
import { calculateRefunds, calculateInstallments, getEstimatedSchedule } from '../../../utils/calculations'; // Import Helpers
import { PROGRAMS } from '../../../utils/feeData'; // Import Data
import { User, MapPin, Users, CheckCircle, Save, ArrowLeft, Printer, AlertCircle, Upload } from 'lucide-react';
import { CENTERS } from '../../../utils/centers'; // Import centers

const FinalizeAdmission = ({ userProfile }) => {
    const { id } = useParams(); // Admission ID
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [fullData, setFullData] = useState(null); // Store full doc for receipt

    // Form State
    const [formData, setFormData] = useState({
        studentName: '',
        dob: '',
        gender: 'Male',
        category: 'General',
        aadhar: '',

        fatherName: '',
        fatherPhone: '',
        motherName: '',
        address: '',
        city: 'Nashik',
        pincode: '',

        rollNumber: '',    // Auto-generated 
        // NO BATCH ASSIGNMENT HERE (Manager does it)
        enrollmentDate: '', // Mandatory Field
        paymentMode: 'Cash', // NEW: Editable Payment Mode
        proofImage: ''       // NEW: Editable Proof Image
    });

    // 1. Load Existing Data
    useEffect(() => {
        const fetchData = async () => {
            const docRef = doc(db, "admissions", id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setFullData({ id: docSnap.id, ...data });

                setFormData(prev => ({
                    ...prev,
                    studentName: data.studentName || '',
                    dob: data.dob || '',
                    gender: data.gender || 'Male',
                    category: data.category || 'General', // FIXED: Load Category
                    aadhar: data.aadhar || '',             // FIXED: Load Aadhar
                    fatherName: data.fatherName || '',
                    fatherPhone: data.parentPhone || '',
                    motherName: data.motherName || '',
                    city: data.city || 'Nashik',
                    address: data.address || '',
                    enrollmentDate: data.enrollmentDate || '', // Load if exists
                    paymentMode: (() => {
                        const m = (data.paymentMode || (data.payments?.[0]?.mode) || 'Cash');
                        if (m === 'KAP-QR' || m === 'KAP QR') return 'KAP QR (AXIS)';
                        if (m === 'Ujjivan - QR') return 'Ujjivan QR';
                        if (m === 'PosSHS' || m === 'POS-SHS') return 'POS - SHS';
                        // Keep other matches or default to partial match check if needed, but for now specific mapping:
                        return m;
                    })(),
                    proofImage: data.proofImage || ''
                }));

                // Auto-Generate Roll Number if not present (9-digit whole integer format)
                if (!data.rollNumber) {
                    const prefix = data.centerId === 'UN_NASHIK_RD' ? '110' : data.centerId === 'PRAYAS' ? '112' : '111';
                    const year = new Date().getFullYear().toString().substr(-2);
                    
                    let roll = "";
                    let isUnique = false;
                    let attempts = 0;
                    while (!isUnique && attempts < 25) {
                        const random = Math.floor(1000 + Math.random() * 9000);
                        roll = `${prefix}${year}${random}`;
                        const qCheck = query(collection(db, "admissions"), where("rollNumber", "==", roll));
                        const checkSnap = await getDocs(qCheck);
                        if (checkSnap.empty) {
                            isUnique = true;
                        }
                        attempts++;
                    }
                    setFormData(prev => ({ ...prev, rollNumber: roll }));
                } else {
                    setFormData(prev => ({ ...prev, rollNumber: data.rollNumber }));
                }
            }
            setLoading(false);
        };
        fetchData();
    }, [id]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // 2. Submit & Finalize
    const handleSubmit = async (e) => {
        e.preventDefault();

        // 2a. MANDATORY CHECKS (User Request)
        if (!formData.proofImage && !fullData?.proofImage) {
            alert("STOP: Proof of Token (Screenshot) is MISSING. Please upload it.");
            return;
        }
        if (!formData.enrollmentDate) {
            alert("STOP: Enrolment Date is COMPULSORY. Please select a date.");
            return;
        }

        if (!formData.rollNumber || String(formData.rollNumber).trim() === "") {
            alert("STOP: Roll Number is required.");
            return;
        }

        const cleanRoll = String(formData.rollNumber).trim();

        // Validate 9-digit format (starts with 110, 111, or 112)
        if (!/^(110|111|112)\d{6}$/.test(cleanRoll)) {
            alert("STOP: Roll Number must be exactly a 9-digit number starting with:\n- 111 (College Road)\n- 110 (Nashik Road)\n- 112 (Prayas)");
            return;
        }

        // Check roll number uniqueness in Firestore
        try {
            setSubmitting(true);
            const q = query(collection(db, "admissions"), where("rollNumber", "==", cleanRoll));
            const querySnapshot = await getDocs(q);
            const duplicate = querySnapshot.docs.find(d => d.id !== id);
            if (duplicate) {
                const dupData = duplicate.data();
                alert(`STOP: The roll number "${cleanRoll}" is already assigned to student "${dupData.studentName || 'another student'}" (Status: ${dupData.status}). All roll numbers must be unique.`);
                setSubmitting(false);
                return;
            }
        } catch (err) {
            console.error("Roll number validation failed:", err);
            alert("Error checking roll number uniqueness: " + err.message);
            setSubmitting(false);
            return;
        }

        if (!window.confirm("Verify: Are you sure all payment details and documents are verified? This will activate the student.")) {
            setSubmitting(false);
            return;
        }

        try {
            const docRef = doc(db, "admissions", id);

            // Update with Status ACTIVE and Verified By
            await updateDoc(docRef, {
                ...formData, // Save bio-data updates (includes paymentMode)
                // Note: Batch is NOT assigned here.
                status: "ACTIVE", // Confirmed Admission
                verifiedBy: userProfile?.name || "Accounts",
                verificationDate: serverTimestamp(),
                rollNumber: cleanRoll,
                paymentMode: formData.paymentMode // Explicit save
            });

            clearAdmissionsCache();

            // LOG TO LEAD TIMELINE
            if (fullData.leadId) {
                try {
                    const leadRef = doc(db, "leads", fullData.leadId);
                    await updateDoc(leadRef, {
                        status: 'CONVERTED',
                        timeline: arrayUnion({
                            type: "PAYMENT_APPROVED",
                            result: `Payment Verified: ₹${Number(fullData.totalPaid).toLocaleString()}`,
                            note: `Token amount approved. Verified by ${userProfile?.name || "Accounts"}. Mode: ${formData.paymentMode}`,
                            date: new Date(),
                            by: userProfile?.name || "Accounts"
                        })
                    });
                } catch (lErr) { console.error("Lead log failed", lErr); }
            }

            // Generate Official Fee Receipt
            const centerInfo = CENTERS[fullData?.centerId] || CENTERS['UN_COLLEGE'];
            // Create a payment object for the receipt (assuming most recent payment is the token)
            // Or use the total paid so far
            const paymentObj = {
                mode: formData.paymentMode, // USE EDITED MODE
                type: 'Admission Verification / Token',
                amount: fullData?.totalPaid || 0
            };

            // Calculate Schedule & Refunds for PDF
            let schedule = fullData.paymentSchedule || [];
            if (schedule.length === 0) {
                // Determine Plan (Default to Standard if missing)
                const plan = fullData.paymentPlan || 'INSTALLMENT';
                // Try strictly calculated first
                if (fullData.program && PROGRAMS[fullData.program]) {
                    schedule = calculateInstallments(Number(fullData.amount), fullData.program, plan, PROGRAMS);
                }

                // Fallback to Estimate if still empty
                if (!schedule || schedule.length === 0) {
                    // NEW: Force Loan Schedule if Plan is Loan
                    if (plan === 'LOAN') {
                        const paid = Number(fullData.totalPaid || 0);
                        const total = Number(fullData.amount || 0);
                        schedule = [
                            { id: "Down Payment (Paid)", dueDate: "Immediate", amount: paid, status: "Paid" },
                            { id: "Loan Financed", dueDate: "Upon Disbursal", amount: total - paid, status: "Financed" }
                        ];
                    } else {
                        const startDate = fullData.enrollmentDate
                            ? new Date(fullData.enrollmentDate)
                            : (fullData.createdAt?.seconds ? new Date(fullData.createdAt.seconds * 1000) : new Date());
                        schedule = getEstimatedSchedule(Number(fullData.amount), Number(fullData.totalPaid), startDate);
                    }
                }
            }

            // Calculate Refunds
            // Use feeDetails if available, otherwise estimate tuition base
            const fees = fullData.feeDetails || {};
            const refunds = calculateRefunds(
                Number(fullData.amount),
                Number(fees.projectedFee || fullData.amount), // Fallback
                fullData.program,
                PROGRAMS
            );

            // Generate Invoice (User requested to disable auto-download)
            // await generateTaxInvoice(
            //     { ...fullData, ...formData, rollNumber: formData.rollNumber },
            //     paymentObj,
            //     centerInfo,
            //     schedule,  // Passed Calculated Schedule
            //     refunds    // Passed Calculated Refunds
            // );

            // 3. Update Batch Capacity (Decrement Seats Left)
            // Note: In this system, 'capacity' is treated as 'Remaining Seats'.
            if (fullData.batchId) {
                const batchRef = doc(db, "batches", fullData.batchId);
                // We execute this blindly; if it fails (e.g. batch deleted), we catch it but don't block
                try {
                    await updateDoc(batchRef, {
                        capacity: increment(-1)
                    });
                } catch (bErr) {
                    console.error("Failed to update batch count:", bErr);
                }
            }

            alert("✅ Verification Complete! Student Activated.");
            navigate('/staff/accounts');

        } catch (error) {
            console.error("Error:", error);
            alert("Failed to finalize admission: " + error.message);
        }
        setSubmitting(false);
    };

    // 3. Modal State
    const [showProofModal, setShowProofModal] = useState(false);

    if (loading) return <div className="p-10 text-center">Loading Verification Data...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 relative">

            {/* IMAGE PREVIEW MODAL */}
            {showProofModal && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setShowProofModal(false)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
                        <img
                            src={formData.proofImage || fullData?.proofImage}
                            alt="Full Proof"
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        />
                        <p className="text-white mt-4 text-sm font-mono">Click anywhere to close</p>
                        <button
                            onClick={() => setShowProofModal(false)}
                            className="absolute -top-10 right-0 text-white hover:text-red-400 p-2"
                        >
                            <span className="text-xl font-bold">✕ Close</span>
                        </button>
                    </div>
                </div>
            )}

            <button onClick={() => navigate('/staff/accounts')} className="flex items-center text-gray-500 hover:text-blue-600 mb-6">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </button>

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-green-700 p-6 text-white flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2"><CheckCircle className="w-6 h-6" /> Verify & Confirm Admission</h1>
                        <p className="text-green-100 text-sm">Accountant Verification Portal</p>
                    </div>
                    <div className="bg-green-800 px-3 py-1 rounded text-sm font-mono">
                        ID: {id.substr(0, 8).toUpperCase()}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8">

                    {/* Section 1: Student Details */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4 border-b pb-2">
                            <User className="w-5 h-5 text-blue-600" /> Verify Student Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-3 bg-blue-50 p-3 rounded-lg border border-blue-100 mb-2">
                                <label className="label text-blue-800">Admission Counsellor</label>
                                <div className="font-bold text-blue-900 text-lg">{fullData?.counsellorName || fullData?.counselorName || fullData?.bookedBy || "N/A"}</div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="label">Full Name</label>
                                <input name="studentName" value={formData.studentName} onChange={handleChange} className="input-field" required />
                            </div>
                            <div>
                                <label className="label">Date of Birth</label>
                                <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="input-field" required />
                            </div>
                            <div>
                                <label className="label">Gender</label>
                                <select name="gender" value={formData.gender} onChange={handleChange} className="input-field">
                                    <option>Male</option><option>Female</option><option>Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Category</label>
                                <select name="category" value={formData.category} onChange={handleChange} className="input-field">
                                    <option>General</option><option>OBC</option><option>SC/ST</option><option>EWS</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Aadhar Number</label>
                                <input name="aadhar" value={formData.aadhar} onChange={handleChange} className="input-field" placeholder="12 Digit ID" />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Parent Details */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4 border-b pb-2">
                            <Users className="w-5 h-5 text-blue-600" /> Parents & Address
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="label">Father's Name</label>
                                <input name="fatherName" value={formData.fatherName} onChange={handleChange} className="input-field" required />
                            </div>
                            <div>
                                <label className="label">Father's Phone</label>
                                <input name="fatherPhone" value={formData.fatherPhone} onChange={handleChange} className="input-field" required />
                            </div>
                            <div>
                                <label className="label">Mother's Name</label>
                                <input name="motherName" value={formData.motherName} onChange={handleChange} className="input-field" />
                            </div>
                            <div>
                                <label className="label">City</label>
                                <input name="city" value={formData.city} onChange={handleChange} className="input-field" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="label">Residential Address</label>
                                <textarea name="address" value={formData.address} onChange={handleChange} className="input-field" rows="2"></textarea>
                            </div>
                        </div>
                    </div>

                    {/* Section 2.5: Mandatory Checks */}
                    <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                        <h3 className="text-lg font-bold text-yellow-800 flex items-center gap-2 mb-4 border-b border-yellow-200 pb-2">
                            <AlertCircle className="w-5 h-5" /> Mandatory Requirements
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="label text-yellow-900">Enrolment Date <span className="text-red-600">*</span></label>
                                <input
                                    type="date"
                                    name="enrollmentDate"
                                    value={formData.enrollmentDate}
                                    onChange={handleChange}
                                    className="input-field border-yellow-300 focus:ring-yellow-500 bg-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="label text-yellow-900">Token Proof Status <span className="text-red-600">*</span></label>
                                {formData.proofImage ? (
                                    <div className="flex items-center gap-2 text-green-700 font-bold text-sm h-10 bg-white px-3 rounded-lg border border-green-200">
                                        <CheckCircle className="w-5 h-5" /> Uploaded & Verified
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-red-600 font-bold text-sm h-10 bg-white px-3 rounded-lg border border-red-200 animate-pulse">
                                        <AlertCircle className="w-5 h-5" /> MISSING - Cannot Finalize
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Accounts Verification (Replaced Office Use) */}
                    <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                        <h3 className="text-lg font-bold text-green-800 flex items-center gap-2 mb-4">
                            <CheckCircle className="w-5 h-5" /> Account Verification
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs text-green-600 uppercase font-bold mb-1">Token Amount Received</p>
                                <div className="text-2xl font-bold text-green-800">₹{fullData?.totalPaid || fullData?.amount || 0}</div>
                                {fullData?.batchName && (
                                    <div className="mt-3 inline-block bg-white px-3 py-1 rounded border border-green-200 text-xs font-bold text-green-700">
                                        BATCH: {fullData.batchName}
                                    </div>
                                )}
                                {/* PROOF PREVIEW */}
                                {formData.proofImage && (
                                    <div className="mt-4 flex items-start gap-4">
                                        <div>
                                            <p className="text-xs text-green-600 uppercase font-bold mb-1">Attached Proof</p>
                                            <div
                                                className="relative group cursor-zoom-in w-24 h-24"
                                                onClick={() => setShowProofModal(true)}
                                            >
                                                <img src={formData.proofImage} alt="Payment Proof" className="w-full h-full object-cover rounded-lg border border-green-200 shadow-sm" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition">
                                                    <span className="text-white text-[10px] font-bold uppercase tracking-wide">Click to Zoom</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 mt-5">
                                            <label className="cursor-pointer bg-white border border-green-200 hover:bg-green-50 text-green-700 px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition shadow-sm">
                                                <Upload className="w-3 h-3" /> Change Proof Image
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="hidden" 
                                                    onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onloadend = async () => {
                                                                const base64Img = reader.result;
                                                                // Update local form immediately
                                                                setFormData({ ...formData, proofImage: base64Img });
                                                                
                                                                // AUTO-SAVE to DB instantly so it doesn't get lost on refresh
                                                                try {
                                                                    await updateDoc(doc(db, "admissions", id), {
                                                                        proofImage: base64Img
                                                                    });
                                                                    clearAdmissionsCache();
                                                                } catch (err) {
                                                                    console.error("Auto-save failed:", err);
                                                                    alert("Failed to instantly auto-save image to server: " + err.message);
                                                                }
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                />
                                            </label>
                                            <p className="text-[10px] text-green-600 mt-2 opacity-80">Accountants can override incorrect screenshots uploaded by counsellors.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="label text-green-700">Assign Roll Number</label>
                                <input
                                    name="rollNumber"
                                    value={formData.rollNumber}
                                    onChange={handleChange}
                                    className="input-field border-green-300 focus:ring-green-500 font-mono font-bold text-green-900"
                                    required
                                />
                            </div>

                            {/* NEW: Payment Mode Editor */}
                            <div>
                                <label className="label text-green-700">Payment Method (Verify)</label>
                                <select
                                    name="paymentMode"
                                    value={formData.paymentMode}
                                    onChange={handleChange}
                                    className="input-field border-green-300 focus:ring-green-500 font-bold text-green-900 bg-white"
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
                        </div>

                        <div className="mt-4 p-3 bg-white rounded border border-green-100 text-sm text-gray-500">
                            <p><strong>Note:</strong> By clicking finalize, you confirm that the Token Amount has been received in the bank/cash drawer.</p>
                            <p className="mt-1">Batch Allocation will be handled by the <strong>Center Manager</strong> separately.</p>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end p-4 bg-gray-50 rounded-lg">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-lg shadow-lg flex items-center gap-2 transition transform hover:-translate-y-1"
                        >
                            {submitting ? "Processing..." : <><CheckCircle className="w-6 h-6" /> Confirm Payment & Active Student</>}
                        </button>
                    </div>

                </form>
            </div>

            {/* CSS Helper for cleaner code */}
            <style>{`
        .label { display: block; font-size: 0.75rem; font-weight: 700; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem; }
        .input-field { width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; outline: none; transition: all; }
        .input-field:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2); }
      `}</style>
        </div>
    );
};

export default FinalizeAdmission;
