import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../../firebase';
import { doc, getDoc, updateDoc, serverTimestamp, increment, arrayUnion } from 'firebase/firestore';
import { clearAdmissionsCache } from '../../../services/cacheService';
import { saveAdmissionWithRoll, findRollOwner, ROLL_PATTERN } from '../../../services/rollNumberService';
 // Import Helpers
import { PROGRAMS } from '../../../utils/feeData'; // Import Data
import { Upload } from 'lucide-react';
import { Money } from '../../../components/Money';
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

                // Existing roll is kept. Otherwise the field stays empty and the
                // next number is assigned on save (see saveAdmissionWithRoll).
                if (data.rollNumber) {
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

        // Empty = assign the next number on save. Typed = validate and reserve it.
        const cleanRoll = String(formData.rollNumber || "").trim();

        // Validate 9-digit format (starts with 110, 111, or 112)
        if (cleanRoll && !ROLL_PATTERN.test(cleanRoll)) {
            alert("STOP: Roll Number must be exactly a 9-digit number starting with:\n- 111 (College Road)\n- 110 (Nashik Road)\n- 112 (Prayas)");
            return;
        }

        // Check roll number uniqueness in Firestore
        try {
            setSubmitting(true);
            const dupData = cleanRoll ? await findRollOwner(cleanRoll, id) : null;
            if (dupData) {
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
            // Reserve the roll number and activate the admission together, so
            // two people finalizing at once can never both get the same roll.
            const savedRoll = await saveAdmissionWithRoll({
                admissionId: id,
                centerId: fullData?.centerId,
                manualRoll: cleanRoll || null,
                by: userProfile?.name || "Accounts",
                buildUpdate: (roll) => ({
                    ...formData, // Save bio-data updates (includes paymentMode)
                    // Note: Batch is NOT assigned here.
                    status: "ACTIVE", // Confirmed Admission
                    verifiedBy: userProfile?.name || "Accounts",
                    verificationDate: serverTimestamp(),
                    rollNumber: roll,
                    paymentMode: formData.paymentMode // Explicit save
                }),
            });
            setFormData(prev => ({ ...prev, rollNumber: savedRoll }));

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

    if (loading) return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="j-sk h-10 w-72 rounded-2xl" />
            {[0, 1, 2].map(k => <div key={k} className="j-sk h-40 rounded-[24px]" />)}
        </div>
    );

    const onProof = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Img = reader.result;
            setFormData({ ...formData, proofImage: base64Img });
            // Save straight away so it isn't lost on refresh
            try {
                await updateDoc(doc(db, "admissions", id), { proofImage: base64Img });
                clearAdmissionsCache();
            } catch (err) {
                console.error("Auto-save failed:", err);
                alert("Failed to instantly auto-save image to server: " + err.message);
            }
        };
        reader.readAsDataURL(file);
    };
    const counsellor = fullData?.counsellorName || fullData?.counselorName || fullData?.bookedBy || 'Not recorded';

    return (
        <div className="max-w-4xl mx-auto space-y-5 pb-10 relative">

            {showProofModal && (
                <div role="dialog" aria-modal="true" aria-label="Payment proof"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-zoom-out" style={{ background: 'rgba(20,24,20,.82)' }}
                    onClick={() => setShowProofModal(false)}>
                    <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
                        <img src={formData.proofImage || fullData?.proofImage} alt="Payment proof" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
                        <button type="button" onClick={() => setShowProofModal(false)} className="jb-act jb-act-soft mt-4">Close</button>
                    </div>
                </div>
            )}

            <header className="jb-rise">
                <button type="button" onClick={() => navigate('/staff/accounts')} className="jb-act jb-act-line mb-3" style={{ padding: '6px 14px', fontSize: 13 }}>← Accounts</button>
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="jb-h text-[30px] leading-tight">Verify &amp; confirm admission</h1>
                        <p className="jb-sub text-[13px]">Check the details, then confirm the payment to make the student active.</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[12px] font-mono font-bold" style={{ background: 'var(--track)' }}>#{id.substr(0, 8).toUpperCase()}</span>
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="jb-rise rounded-[24px] p-5" style={{ background: 'var(--t-sage)' }}>
                    <p className="text-[13px] font-bold">Token received</p>
                    <p className="jb-h text-[26px] mt-1"><Money value={Number(fullData?.totalPaid || fullData?.amount || 0)} /></p>
                    {fullData?.batchName && <p className="text-[12.5px] mt-1" style={{ color: 'var(--sub)' }}>Batch: {fullData.batchName}</p>}
                </div>
                <div className="jb-rise rounded-[24px] p-5" style={{ background: 'var(--t-blue)', animationDelay: '40ms' }}>
                    <p className="text-[13px] font-bold">Counsellor</p>
                    <p className="jb-h text-[20px] mt-1 break-words">{counsellor}</p>
                </div>
                <div className="jb-rise rounded-[24px] p-5" style={{ background: formData.proofImage ? 'var(--t-sage)' : 'var(--t-coral)', animationDelay: '80ms' }}>
                    <p className="text-[13px] font-bold">Payment proof</p>
                    <p className="jb-h text-[20px] mt-1">{formData.proofImage ? '✓ Uploaded' : 'Missing'}</p>
                    {!formData.proofImage && <p className="text-[12.5px] mt-1" style={{ color: 'var(--sub)' }}>Can't confirm without it</p>}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <section className="jb-card jb-rise" style={{ padding: 20 }}>
                    <h2 className="jb-h text-[18px] mb-4">Student</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="block md:col-span-2"><span className="fa-lab">Full name</span>
                            <input name="studentName" value={formData.studentName} onChange={handleChange} className="jb-input" required /></label>
                        <label className="block"><span className="fa-lab">Date of birth</span>
                            <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="jb-input" required /></label>
                        <label className="block"><span className="fa-lab">Gender</span>
                            <select name="gender" value={formData.gender} onChange={handleChange} className="jb-input"><option>Male</option><option>Female</option><option>Other</option></select></label>
                        <label className="block"><span className="fa-lab">Category</span>
                            <select name="category" value={formData.category} onChange={handleChange} className="jb-input"><option>General</option><option>OBC</option><option>SC/ST</option><option>EWS</option></select></label>
                        <label className="block"><span className="fa-lab">Aadhaar number</span>
                            <input name="aadhar" value={formData.aadhar} onChange={handleChange} className="jb-input" placeholder="12 digits" /></label>
                    </div>
                </section>

                <section className="jb-card jb-rise" style={{ padding: 20 }}>
                    <h2 className="jb-h text-[18px] mb-4">Parents &amp; address</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="block"><span className="fa-lab">Father's name</span>
                            <input name="fatherName" value={formData.fatherName} onChange={handleChange} className="jb-input" required /></label>
                        <label className="block"><span className="fa-lab">Father's phone</span>
                            <input name="fatherPhone" value={formData.fatherPhone} onChange={handleChange} className="jb-input" inputMode="tel" required /></label>
                        <label className="block"><span className="fa-lab">Mother's name</span>
                            <input name="motherName" value={formData.motherName} onChange={handleChange} className="jb-input" /></label>
                        <label className="block"><span className="fa-lab">City</span>
                            <input name="city" value={formData.city} onChange={handleChange} className="jb-input" /></label>
                        <label className="block md:col-span-2"><span className="fa-lab">Home address</span>
                            <textarea name="address" value={formData.address} onChange={handleChange} className="jb-input" rows="2" /></label>
                    </div>
                </section>

                <section className="jb-rise rounded-[24px] p-5" style={{ background: 'var(--t-butter)' }}>
                    <h2 className="jb-h text-[18px] mb-4">Payment check</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="block"><span className="fa-lab">Enrolment date *</span>
                            <input type="date" name="enrollmentDate" value={formData.enrollmentDate} onChange={handleChange} className="jb-input" required /></label>
                        <label className="block"><span className="fa-lab">Payment method</span>
                            <select name="paymentMode" value={formData.paymentMode} onChange={handleChange} className="jb-input font-semibold">
                                <option>KAP Online (RTGS/NEFT)</option>
                                <option>Cash</option>
                                <option>Cheque</option>
                                <option>KAP QR (AXIS)</option>
                                <option>Ujjivan QR</option>
                                <option>POS - SHS</option>
                                <option>SHS Online (RTGS/NEFT)</option>
                            </select></label>
                        <label className="block"><span className="fa-lab">Roll number</span>
                            <input name="rollNumber" value={formData.rollNumber} onChange={handleChange} placeholder="Given on save" className="jb-input font-mono font-bold" />
                            <span className="block text-[11.5px] mt-1" style={{ color: 'var(--sub)' }}>Leave empty for the next number at this centre.</span></label>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-4">
                        {formData.proofImage ? (
                            <button type="button" onClick={() => setShowProofModal(true)} className="w-24 h-24 rounded-2xl overflow-hidden cursor-zoom-in jb-lift" style={{ border: '1px solid var(--line)' }} aria-label="Open payment proof">
                                <img src={formData.proofImage} alt="" className="w-full h-full object-cover" />
                            </button>
                        ) : (
                            <span className="w-24 h-24 rounded-2xl inline-flex items-center justify-center text-[28px]" style={{ background: 'var(--panel)' }} aria-hidden="true">🧾</span>
                        )}
                        <div>
                            <label className="jb-act jb-act-soft cursor-pointer inline-flex items-center gap-2">
                                <Upload className="w-4 h-4" /> {formData.proofImage ? 'Change proof' : 'Upload proof'}
                                <input type="file" accept="image/*" className="hidden" onChange={onProof} />
                            </label>
                            <p className="text-[11.5px] mt-1.5" style={{ color: 'var(--sub)' }}>You can replace a wrong screenshot from the counsellor.</p>
                        </div>
                    </div>
                </section>

                <div className="jb-card jb-rise flex flex-wrap items-center justify-between gap-3" style={{ padding: 20 }}>
                    <p className="text-[13px] max-w-md" style={{ color: 'var(--sub)' }}>Confirming means the token is in the bank or cash drawer. The centre manager places the student in a batch afterwards.</p>
                    <button type="submit" disabled={submitting} className="jb-act jb-act-ink disabled:opacity-50" style={{ padding: '12px 22px' }}>
                        {submitting ? 'Confirming…' : '✓ Confirm payment & activate'}
                    </button>
                </div>
            </form>

            <style>{`.fa-lab{display:block;font-size:12px;font-weight:700;color:var(--sub);margin-bottom:4px}`}</style>
        </div>
    );
};

export default FinalizeAdmission;
