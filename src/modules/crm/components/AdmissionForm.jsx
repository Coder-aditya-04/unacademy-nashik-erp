import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../../../firebase';
import { doc, setDoc, updateDoc, Timestamp, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';
import { clearAdmissionsCache } from '../../../services/cacheService';
import { fetchBatches } from '../../../services/batchService';
import { Card, Avatar, Layer } from '../../../components/j';
import { courseOptions, COURSE_GROUPS, optionFor } from '../../../utils/courseOptions';
import { CENTERS } from '../../../utils/centers';
import { useFeeStructure } from '../../../hooks/useFeeStructure';
import { sessionFor } from '../../../utils/academicYear';
import { enrolLimits, enrolDateProblem } from '../../../utils/enrolRule';

// The batch's start date becomes the enrolment date when it is allowed by the rule.
const batchStart = (b, current) => {
    const v = b?.startDate ? String(b.startDate).slice(0, 10) : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(v) && !enrolDateProblem(v) ? v : current;
};
import { HOSTEL_BILLING, hostelAmount } from '../../../utils/feeData';
import { useHostelFees } from '../../../services/hostelService';
import { HostelFeesSheet } from '../../../components/j/HostelFees';

// Form pieces for the K2 admission screen (outside the component so inputs keep focus).
const bare = { border: 0, boxShadow: 'none', background: 'transparent', outline: 'none' };
const Field = ({ label, req, icon, ok, hint, children }) => (
    <label className="block min-w-0">
        <span className="block text-[12.5px] font-bold mb-1.5">{label}{req && <span style={{ color: 'var(--late)' }}> *</span>}</span>
        <span className="flex items-center gap-2.5 rounded-[14px] px-3.5 min-h-[48px]" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}>
            {icon && <span aria-hidden="true">{icon}</span>}{children}{ok && <span aria-hidden="true" className="text-[13px] font-bold" style={{ color: 'var(--ok)' }}>✓</span>}
        </span>
        {hint && <span className="block text-[12px] mt-1 ml-1" style={{ color: 'var(--muted)' }}>{hint}</span>}
    </label>
);

const Chips = ({ label, value, onPick, list }) => (
    <div className="min-w-0">
        <span className="block text-[12.5px] font-bold mb-1.5">{label}</span>
        <div className="flex flex-wrap gap-2">
            {list.map(([v, l]) => (
                <button key={v} type="button" aria-pressed={value === v} onClick={() => onPick(v)} className="rounded-full px-3.5 py-[9px] text-[13px] font-semibold transition-colors"
                    style={value === v ? { background: 'var(--ink)', color: 'var(--on-ink)' } : { background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}>{l}</button>
            ))}
        </div>
    </div>
);

const Row = ({ label, icon, text }) => (
    <div className="min-w-0"><span className="block text-[12.5px] font-bold mb-1.5">{label}</span>
        <div className="flex items-center gap-2.5 rounded-[14px] px-3.5 py-3 text-[14px]" style={{ background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}><span aria-hidden="true">{icon}</span><span className="flex-1 min-w-0 break-words">{text}</span><span style={{ color: 'var(--ok)' }} className="font-bold">✓</span></div></div>
);

const AdmissionForm = ({ userProfile, currentCenter }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const leadData = location.state?.lead || {};
    const quoteData = location.state?.quote || {};

    const { feeStructures } = useFeeStructure();

    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0);
    const [stepErr, setStepErr] = useState('');
    const [showHostel, setShowHostel] = useState(false);
    const hostel = useHostelFees();

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
        currentGrade: leadData.currentGrade || '',
        board: '',
        marks10: '',
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
        hosteller: false,
        hostelPlan: '',
        hostelBilling: 'YEARLY',

        school: '',
        standard: quoteData.standard || '',
        program: quoteData.selectedProgram || leadData.courseInterest || '',
        batch: quoteData.batchId || '',
        batchName: quoteData.batchName || '',
        // From the fee quote, kept with the admission for Accounts.
        quoteDiscount: quoteData.discount || 0,
        discountReason: quoteData.discountReason || '',
        discountNote: quoteData.discountNote || '',

        // Fee & Token
        totalFee: quoteData.finalFee || '',
        tokenAmount: '',
        paymentMode: 'Cash',
        enrollmentDate: '', // NEW: Custom Start Date
        remarks: '',
        proofImage: null,

        // NEW: Loan Management
        aadhar: leadData.aadhar || '',
        paymentPlan: quoteData.plan === 'LOAN' ? 'LOAN' : 'INSTALLMENT', // INSTALLMENT or LOAN
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
                    // Reset the batch when the centre changes (keep the quote's batch if it belongs here)
                    setFormData(prev => ((allBatches || []).some(b => b.id === prev.batch) ? prev : { ...prev, batch: '', batchName: '' }));
                    setSelectedBatchObj((allBatches || []).find(b => b.id === quoteData.batchId) || null);
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
        const enrolProblem = enrolDateProblem(formData.enrollmentDate);
        if (enrolProblem) {
            alert(`⚠️ Enrolment date not allowed. ${enrolProblem}`);
            return;
        }

        // STRICT: one admission per student phone number (refunded or cancelled ones don't count).
        setLoading(true);
        try {
            // Student phone only: siblings may share a parent's number.
            const p = String(formData.phone || '').replace(/\D/g, '').slice(-10);
            const snaps = p.length === 10 ? [await getDocs(query(collection(db, "admissions"), where("phone", "==", p)))] : [];
            const clash = snaps.flatMap(sn => sn.docs.map(d => ({ id: d.id, ...d.data() })))
                .find(a => !['REFUNDED', 'CANCELLED', 'REJECTED'].includes(String(a.status || '').toUpperCase()) && !(Number(a.refundAmount) > 0));
            if (clash) {
                alert(`Cannot save: this number already has an admission for ${clash.studentName || 'a student'}${clash.rollNumber ? ` (roll no ${clash.rollNumber})` : ''}, booked by ${clash.bookedBy || clash.counsellorName || 'someone'}. Open that student instead, or ask the Director if this is a sibling.`);
                setLoading(false);
                return;
            }
        } catch (err) {
            console.error('Duplicate admission check failed', err);
            alert('Could not check for duplicate admissions. Check the connection and try again.');
            setLoading(false);
            return;
        }

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
                        counsellorId: userProfile?.uid || userProfile?.id || "unknown",
                        counsellorName: userProfile?.name || "Team",
                        status: 'CONVERTED',
                        admissionId: admissionId,
                        courseInterest: formData.program,
                        createdAt: Timestamp.now(),
                        timeline: [{
                            type: "DIRECT_ADMISSION",
                            result: "Lead Created (Direct Admission)",
                            note: `Direct Admission Taken by ${userProfile?.name || "Team"}. Token: ₹${Number(formData.tokenAmount).toLocaleString()}`,
                            date: new Date(),
                            by: userProfile?.name || "Team"
                        }]
                    });
                }
            }

            const admissionData = {
                ...formData,
                id: admissionId,
                leadId: finalLeadId || null,
                centerId: centerId || null,
                centerName: centerInfo?.name || centerId || null,
                
                // INHERIT Counsellor from Lead (If it exists), otherwise use current user
                counsellorId: resolvedLeadData?.assignedTo || userProfile.uid || userProfile.id || "Unknown",
                counsellorName: resolvedLeadData?.assignedByName || userProfile.name || "Team",
                
                // Track who actually filled the form (e.g., Manager)
                bookedById: userProfile.uid || userProfile.id || "Unknown",
                bookedBy: userProfile.name || "Team",

                // Admission Mode
                admissionMode: formData.admissionMode || 'ONLINE',
                hosteller: !!formData.hosteller,
                ...(formData.hosteller ? {
                    hostelPlan: formData.hostelPlan || hostel.plans[0]?.id || null,
                    hostelBilling: formData.hostelBilling || 'YEARLY',
                    hostelFee: hostelAmount(hostel, formData.hostelPlan || hostel.plans[0]?.id, formData.hostelBilling),
                    hostelDeposit: hostel.deposit || null,
                } : {}),
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
                academicYear: sessionFor(new Date()).key,

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
                    note: `Admission Taken by ${userProfile.name || "Team"}. Token: ₹${Number(formData.tokenAmount).toLocaleString()}. Mode: ${formData.paymentMode}`,
                    date: new Date(),
                    by: userProfile.name || "Team"
                };

                await updateDoc(leadRef, {
                    status: 'UNDER_VERIFICATION',
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

    // --- RENDER (board K2: five steps, summary on the right) ---
    const STEPS = [['Student', '🧑‍🎓', 'Who is joining'], ['Parents', '👨‍👩‍👧', 'Contact and address'], ['Course', '📚', 'Batch from the quote'], ['Fees', '💳', 'Token and proof'], ['Review', '✅', 'Check and send']];
    const digits = (v) => String(v || '').replace(/\D/g, '');
    const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
    const options = courseOptions(feeStructures, centerId === 'PRAYAS');
    // An enquiry stores the course by name; turn it into the fee course once fees load.
    useEffect(() => {
        if (!feeStructures || feeStructures[formData.program]) return;
        const o = optionFor(courseOptions(feeStructures, centerId === 'PRAYAS'), formData.program);
        if (o) setFormData(prev => ({ ...prev, program: o.key, standard: o.standard, totalFee: prev.totalFee || feeStructures[o.key]?.total || '' }));
    }, [feeStructures, centerId]); // eslint-disable-line react-hooks/exhaustive-deps
    const optValue = formData.standard && options.some(o => o.value === `${formData.program}|${formData.standard}`) ? `${formData.program}|${formData.standard}` : formData.program;
    const problems = [
        !formData.studentName.trim() ? 'Type the student\'s full name.' : '',
        !formData.fatherName.trim() || !formData.motherName.trim() ? 'Type both parents\' names.' : digits(formData.phone).length !== 10 ? 'Type the student\'s 10-digit phone number.' : '',
        !formData.program || !feeStructures?.[formData.program] ? 'Pick the course.' : '',
        !(Number(formData.totalFee) > 0) ? 'Type the agreed fee.' : !(Number(formData.tokenAmount) > 0) ? 'Type the token paid now.' : !formData.proofImage ? 'Add the payment proof.' : !formData.enrollmentDate ? 'Pick the enrolment date.' : (enrolDateProblem(formData.enrollmentDate) || ''),
        '',
    ];
    const done = problems.map(p => !p);
    const ROLL_PREFIX = { UN_NASHIK_RD: '110', UN_COLLEGE: '111', PRAYAS: '112' };
    const rollPreview = `${ROLL_PREFIX[centerId] || '1··'} ${String(new Date().getFullYear() + (new Date().getMonth() === 11 ? 1 : 0)).slice(-2)} ····`;
    const courseName = formData.standard || feeStructures?.[formData.program]?.name || '';
    const next = () => {
        const p = problems[step];
        if (p) { setStepErr(p); return; }
        setStepErr(''); setStep(s => Math.min(4, s + 1)); window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const goStep = (i) => {
        const block = problems.slice(0, i).findIndex(Boolean);
        if (block !== -1 && block < i) { setStep(block); setStepErr(problems[block]); return; }
        setStepErr(''); setStep(i);
    };
    const pickCourse = (value) => {
        const o = options.find(x => x.value === value);
        if (!o) { setFormData(prev => ({ ...prev, program: '', standard: '', totalFee: '' })); return; }
        const courseObj = feeStructures?.[o.key];
        setFormData(prev => ({ ...prev, program: o.key, standard: o.standard, totalFee: quoteData.selectedProgram === o.key && quoteData.finalFee ? quoteData.finalFee : courseObj?.total, batch: '', batchName: '' }));
        setSelectedBatchObj(null);
    };
    const set = (k, v) => setFormData(prev => ({ ...prev, [k]: v }));
    const input = (name, props = {}) => <input name={name} value={formData[name] ?? ''} onChange={handleChange} className="flex-1 min-w-0 py-3 text-[14.5px]" style={bare} {...props} />;

    return (
        <div className="flex flex-col gap-4">
            {existingLead && (
                <Layer>
                    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(29,42,34,.45)' }}>
                        <div className="kap jb-rise w-full max-w-md rounded-[24px] p-5" style={{ background: 'var(--panel)', color: 'var(--ink)', boxShadow: '0 24px 60px rgba(29,42,34,.25)' }}>
                            <div className="rounded-2xl p-4" style={{ background: 'var(--t-coral)' }}>
                                <b className="block text-[16px]">⚠️ This number is already an enquiry</b>
                                <p className="text-[13px] mt-1">Take the admission from that enquiry so its full history stays together.</p>
                            </div>
                            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13.5px] mt-4">
                                <dt style={{ color: 'var(--muted)' }}>Student</dt><dd className="font-bold">{existingLead.studentName}</dd>
                                <dt style={{ color: 'var(--muted)' }}>Stage</dt><dd className="font-bold">{String(existingLead.status || '').replace(/_/g, ' ').toLowerCase()}</dd>
                                <dt style={{ color: 'var(--muted)' }}>Counsellor</dt><dd className="font-bold">{existingLead.assignedByName || 'Not assigned'}</dd>
                            </dl>
                            <div className="flex flex-col gap-2 mt-4">
                                <button type="button" onClick={() => navigate(`/staff/leads/${existingLead.id}`)} className="jb-act jb-act-ink justify-center !py-3">Open the enquiry</button>
                                <button type="button" onClick={() => setExistingLead(null)} className="jb-act jb-act-soft justify-center !py-3">Continue here (links to that enquiry)</button>
                            </div>
                        </div>
                    </div>
                </Layer>
            )}
            {showHostel && <HostelFeesSheet onClose={() => setShowHostel(false)} />}

            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-[30px] sm:text-[34px] font-extrabold tracking-tight leading-tight">New admission</h1>
                    <p className="text-[13.5px]" style={{ color: 'var(--muted)' }}>Goes to Accounts to verify · {centerInfo?.name}</p>
                </div>
                {quoteData.finalFee ? <span className="rounded-full px-3.5 py-2 text-[13px] font-bold" style={{ background: 'var(--t-sage)' }}>✓ Filled from the fee quote{courseName ? ` · ${courseName}` : ''}</span> : null}
            </div>

            <section className="jb-rise rounded-[24px] px-4 sm:px-6 py-4" style={{ background: 'var(--panel)', boxShadow: 'var(--sh)' }}>
                <ol className="relative flex justify-between">
                    <span aria-hidden="true" className="absolute left-[22px] right-[22px] sm:left-[55px] sm:right-[55px] top-[19px] h-1 rounded" style={{ background: 'var(--track)' }} />
                    <span aria-hidden="true" className="absolute left-[22px] sm:left-[55px] top-[19px] h-1 rounded" style={{ background: 'var(--ok)', width: `calc((100% - 110px) * ${step / 4})`, transition: 'width .6s cubic-bezier(.65,0,.35,1)' }} />
                    {STEPS.map(([l, , sub], i) => {
                        const on = step === i, past = i < step && done[i];
                        return (
                            <li key={l} className="relative z-[1] flex flex-col items-center text-center w-[44px] sm:w-[110px]">
                                <button type="button" onClick={() => goStep(i)} aria-current={on ? 'step' : undefined} aria-label={`Step ${i + 1}: ${l}`}
                                    className="w-[40px] h-[40px] rounded-full flex items-center justify-center text-[14px] font-extrabold"
                                    style={{ transition: 'background .35s ease, color .35s ease, transform .3s ease, box-shadow .35s ease', ...(on ? { background: 'var(--ink)', color: 'var(--on-ink)', transform: 'scale(1.1)', boxShadow: '0 0 0 6px rgba(29,42,34,.08)' } : past ? { background: 'var(--ok)', color: '#FFFFFF' } : { background: 'var(--panel)', color: 'var(--muted)', boxShadow: '0 0 0 2px var(--line)' }) }}>
                                    {past ? '✓' : i + 1}
                                </button>
                                <b className="hidden sm:block text-[13.5px] mt-2" style={{ fontWeight: on ? 800 : 600 }}>{l}</b>
                                <span className="hidden sm:block text-[11.5px]" style={{ color: 'var(--muted)' }}>{sub}</span>
                            </li>
                        );
                    })}
                </ol>
                <p className="sm:hidden text-center text-[13px] font-bold mt-2">Step {step + 1} · {STEPS[step][0]}</p>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 items-start">
                <form onSubmit={(e) => { if (step < 4) { e.preventDefault(); return; } handleSubmit(e); }} noValidate className="rounded-[24px] p-5 sm:p-6 min-w-0" style={{ background: 'var(--panel)', boxShadow: 'var(--sh)' }}>
                    <div key={step} className="jb-rise">
                        <div className="flex items-center gap-3 mb-5">
                            <span aria-hidden="true" className="w-11 h-11 rounded-2xl flex items-center justify-center text-[22px]" style={{ background: 'var(--t-butter)' }}>{STEPS[step][1]}</span>
                            <div><h2 className="text-[20px] font-extrabold leading-tight">{['Student details', 'Parents and address', 'Course and batch', 'Fees and token', 'Review and send'][step]}</h2>
                                <p className="text-[13px]" style={{ color: 'var(--muted)' }}>{['As written on the Aadhaar card.', 'We call and WhatsApp these numbers.', 'Where and what the student will study.', 'Accounts checks the proof before the roll number is given.', 'Check once, then send to Accounts for verification.'][step]}</p></div>
                        </div>

                        {step === 0 && (
                            <div className="grid sm:grid-cols-2 gap-4">
                                <Field label="Full name" req icon="👤" ok={!!formData.studentName.trim()}>{input('studentName', { onBlur: checkLeadExistence, placeholder: 'Student name' })}</Field>
                                <Field label="Date of birth" icon="🎂">{input('dob', { type: 'date' })}</Field>
                                <Chips label="Gender" value={formData.gender} onPick={(v) => set('gender', v)} list={[['Female', 'Female'], ['Male', 'Male'], ['Other', 'Other']]} />
                                <Field label="Aadhaar number" icon="🪪" ok={digits(formData.aadhar).length === 12} hint="12 digits">{input('aadhar', { inputMode: 'numeric', maxLength: 12, placeholder: '12-digit number', onChange: (e) => set('aadhar', digits(e.target.value).slice(0, 12)) })}</Field>
                                <Field label="School or college" icon="🏫">{input('previousSchool', { placeholder: 'School name' })}</Field>
                                <Chips label="Board" value={formData.board} onPick={(v) => set('board', v)} list={[['CBSE', 'CBSE'], ['State', 'State'], ['ICSE', 'ICSE']]} />
                                <Field label="Class 10 marks" icon="📈" hint="Used for the merit discount">{input('marks10', { placeholder: 'e.g. 92%' })}</Field>
                                <Chips label="Studying in" value={formData.currentGrade} onPick={(v) => set('currentGrade', v)} list={['8th', '9th', '10th', '11th', '12th', 'Repeater'].map(x => [x, x])} />
                                <Field label="Email" icon="✉️">{input('email', { type: 'email', placeholder: 'student@example.com' })}</Field>
                            </div>
                        )}

                        {step === 1 && (
                            <div className="grid sm:grid-cols-2 gap-4">
                                <Field label="Father's name" req icon="👨" ok={!!formData.fatherName.trim()}>{input('fatherName', { placeholder: 'Father\'s full name' })}</Field>
                                <Field label="Father's phone" icon="📞" ok={digits(formData.parentPhone).length === 10}>{input('parentPhone', { inputMode: 'tel', placeholder: '10-digit number', onBlur: checkLeadExistence })}</Field>
                                <Field label="Mother's name" req icon="👩" ok={!!formData.motherName.trim()}>{input('motherName', { placeholder: 'Mother\'s full name' })}</Field>
                                <Field label="Student's phone" req icon="📱" ok={digits(formData.phone).length === 10} hint="One admission per student number">{input('phone', { inputMode: 'tel', placeholder: '10-digit number', onBlur: checkLeadExistence })}</Field>
                                <Field label="City" icon="📍">{input('city', { placeholder: 'City' })}</Field>
                                <Field label="Pincode" icon="🏷️">{input('pincode', { inputMode: 'numeric', placeholder: '422001' })}</Field>
                                <label className="block sm:col-span-2"><span className="block text-[12.5px] font-bold mb-1.5">Home address</span>
                                    <textarea name="address" rows={2} value={formData.address} onChange={handleChange} placeholder="House, street, area" className="jb-input" /></label>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="grid sm:grid-cols-2 gap-4">
                                <label className="block"><span className="block text-[12.5px] font-bold mb-1.5">Centre <span className="font-medium" style={{ color: 'var(--muted)' }}>· where the student studies</span></span>
                                    <select value={selectedCenterId} onChange={(e) => setSelectedCenterId(e.target.value)} className="jb-input">{Object.entries(CENTERS).map(([id, info]) => <option key={id} value={id}>{info.name}</option>)}</select></label>
                                <Chips label="Mode" value={formData.admissionMode} onPick={(v) => set('admissionMode', v)} list={[['OFFLINE', '🏫 Classroom'], ['ONLINE', '💻 Online']]} />
                                <label className="block sm:col-span-2"><span className="block text-[12.5px] font-bold mb-1.5">Course <span style={{ color: 'var(--late)' }}>*</span></span>
                                    <select value={optValue} onChange={(e) => pickCourse(e.target.value)} className="jb-input">
                                        <option value="">Pick the course</option>
                                        {COURSE_GROUPS.map(g => { const list = options.filter(o => o.group === g); return list.length ? <optgroup key={g} label={g}>{list.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup> : null; })}
                                    </select></label>
                                {formData.standard && (
                                    <div className="sm:col-span-2">
                                        <span className="block text-[12.5px] font-bold mb-1.5">Batch <span className="font-medium" style={{ color: 'var(--muted)' }}>· optional, can be set later</span></span>
                                        <div className="flex flex-wrap gap-2">
                                            <button type="button" onClick={() => { set('batch', ''); set('batchName', ''); setSelectedBatchObj(null); }} aria-pressed={!formData.batch} className="rounded-full px-3.5 py-[9px] text-[13px] font-semibold" style={!formData.batch ? { background: 'var(--ink)', color: 'var(--on-ink)' } : { background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}>Set later</button>
                                            {filteredBatches.map(b => (
                                                <button key={b.id} type="button" aria-pressed={formData.batch === b.id} onClick={() => { setFormData(prev => ({ ...prev, batch: b.id, batchName: b.name || '', enrollmentDate: batchStart(b, prev.enrollmentDate) })); setSelectedBatchObj(b); }}
                                                    className="rounded-full px-3.5 py-[9px] text-[13px] font-semibold" style={formData.batch === b.id ? { background: 'var(--ink)', color: 'var(--on-ink)' } : { background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}>
                                                    {b.name}{b.startDate ? ` · ${new Date(b.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                                                </button>
                                            ))}
                                            {filteredBatches.length === 0 && <span className="text-[13px] py-2" style={{ color: 'var(--muted)' }}>No batch made for this course at this centre yet.</span>}
                                        </div>
                                        {selectedBatchObj?.faculty?.length > 0 && (
                                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">{selectedBatchObj.faculty.map((f, i) => <div key={i} className="rounded-xl px-3 py-2 text-[12.5px]" style={{ background: 'var(--cream)' }}><b className="block">{f.subject}</b>{f.name}</div>)}</div>
                                        )}
                                    </div>
                                )}
                                <div className="sm:col-span-2 rounded-2xl p-4" style={{ background: 'var(--t-lilac)' }}>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <b className="text-[14px] mr-auto">🏠 Hosteller?</b>
                                        {[[false, 'Day scholar'], [true, 'Hosteller']].map(([val, label]) => (
                                            <button key={label} type="button" aria-pressed={formData.hosteller === val} onClick={() => set('hosteller', val)} className="rounded-full px-3.5 py-2 text-[13px] font-semibold" style={formData.hosteller === val ? { background: 'var(--ink)', color: 'var(--on-ink)' } : { background: 'var(--panel)' }}>{label}</button>
                                        ))}
                                        <button type="button" onClick={() => setShowHostel(true)} className="text-[13px] font-bold underline px-2">See hostel fees</button>
                                    </div>
                                    {formData.hosteller && (
                                        <div className="flex flex-wrap items-center gap-2 mt-3">
                                            <select name="hostelPlan" aria-label="Hostel" value={formData.hostelPlan || hostel.plans[0]?.id} onChange={handleChange} className="jb-input !w-auto">{hostel.plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                                            <select name="hostelBilling" aria-label="Hostel billing" value={formData.hostelBilling || 'YEARLY'} onChange={handleChange} className="jb-input !w-auto">{HOSTEL_BILLING.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}</select>
                                            <b className="text-[13.5px]">{inr(hostelAmount(hostel, formData.hostelPlan || hostel.plans[0]?.id, formData.hostelBilling))}{formData.hostelBilling === 'MONTHLY' ? '/month' : '/year'} + {inr(hostel.deposit)} deposit</b>
                                        </div>
                                    )}
                                    <p className="text-[12px] mt-2" style={{ color: 'var(--muted)' }}>Hostel fee is kept separate from the course fee.</p>
                                </div>
                                <label className="block"><span className="block text-[12.5px] font-bold mb-1.5">How they heard of us</span>
                                    <select name="source" value={formData.source} onChange={handleChange} className="jb-input">{['Walk-in', 'Social Media', 'UNSAT / Scholarship Exam', 'Referral', 'Google / Website', 'Seminar / Event', 'Telecalling', 'Other'].map(x => <option key={x}>{x}</option>)}</select></label>
                                {(formData.source === 'Referral' || formData.source === 'Other') ? <Field label="Referred by" icon="🤝">{input('referrer', { placeholder: 'Who referred?' })}</Field> : <Field label="Tie-up college" icon="🏛️">{input('tieUpCollege', { placeholder: 'If any' })}</Field>}
                            </div>
                        )}

                        {step === 3 && (
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2"><Field label="Agreed fee" req icon="🧾" ok={Number(formData.totalFee) > 0}
                                    hint={formData.quoteDiscount ? `Includes the ${formData.quoteDiscount}% ${String(formData.discountReason || '').toLowerCase()} discount from the quote${formData.discountNote ? `: ${formData.discountNote}` : ''}.` : ''}>
                                    <span className="font-bold">₹</span>{input('totalFee', { inputMode: 'numeric', placeholder: 'Total fee', onChange: (e) => set('totalFee', digits(e.target.value)) })}</Field></div>
                                <Chips label="Plan" value={formData.paymentPlan} onPick={(mode) => setFormData(prev => ({ ...prev, paymentPlan: mode, loanAmount: mode === 'LOAN' ? Number(prev.totalFee) * 0.75 : '', downPayment: mode === 'LOAN' ? Number(prev.totalFee) * 0.25 : '', tokenAmount: mode === 'LOAN' ? Number(prev.totalFee) * 0.25 : prev.tokenAmount }))}
                                    list={[['INSTALLMENT', '🗓️ Instalments'], ['LOAN', '🏦 Education loan']]} />
                                {formData.paymentPlan === 'LOAN' ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Down payment (25%)" icon="💵">{input('downPayment', { inputMode: 'numeric', onChange: (e) => { const dp = Number(digits(e.target.value)); setFormData(prev => ({ ...prev, downPayment: dp, tokenAmount: dp, loanAmount: Number(prev.totalFee) - dp })); } })}</Field>
                                        <Field label="Loan amount (75%)" icon="🏦">{input('loanAmount', { inputMode: 'numeric', onChange: (e) => set('loanAmount', digits(e.target.value)) })}</Field>
                                    </div>
                                ) : <div />}
                                <div>
                                    <span className="block text-[12.5px] font-bold mb-1.5">Token paid now <span style={{ color: 'var(--late)' }}>*</span></span>
                                    <div className="flex flex-wrap gap-2 mb-2">{[2000, 5000, 10000].map(v => (
                                        <button key={v} type="button" aria-pressed={Number(formData.tokenAmount) === v} onClick={() => set('tokenAmount', v)} className="rounded-full px-3.5 py-[9px] text-[13px] font-semibold" style={Number(formData.tokenAmount) === v ? { background: 'var(--ink)', color: 'var(--on-ink)' } : { background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)' }}>{inr(v)}</button>
                                    ))}</div>
                                    <Field label="" icon="₹">{input('tokenAmount', { inputMode: 'numeric', placeholder: 'Or type the amount', onChange: (e) => set('tokenAmount', digits(e.target.value)) })}</Field>
                                </div>
                                <label className="block"><span className="block text-[12.5px] font-bold mb-1.5">Into account</span>
                                    <select name="paymentMode" value={formData.paymentMode} onChange={handleChange} className="jb-input">{['KAP Online (RTGS/NEFT)', 'Cash', 'Cheque', 'KAP QR (AXIS)', 'Ujjivan QR', 'POS - SHS', 'SHS Online (RTGS/NEFT)'].map(x => <option key={x}>{x}</option>)}</select></label>
                                <div className="sm:col-span-2">
                                    <span className="block text-[12.5px] font-bold mb-1.5">Payment proof <span style={{ color: 'var(--late)' }}>*</span></span>
                                    <label className="flex items-center gap-3 rounded-[14px] px-3.5 py-3 cursor-pointer" style={{ background: 'var(--cream)', boxShadow: 'inset 0 0 0 1.5px var(--line)' }}>
                                        {formData.proofImage ? <img src={formData.proofImage} alt="Proof" className="w-10 h-10 object-cover rounded-lg" /> : <span aria-hidden="true" className="text-[22px]">📎</span>}
                                        <span className="flex-1 min-w-0"><b className="block text-[13.5px]">{formData.proofImage ? 'Proof added' : 'Add a screenshot or photo of the receipt'}</b><span className="text-[12px]" style={{ color: 'var(--muted)' }}>JPG or PNG</span></span>
                                        {formData.proofImage && <span className="font-bold" style={{ color: 'var(--ok)' }}>✓</span>}
                                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => set('proofImage', reader.result); reader.readAsDataURL(file); } }} />
                                    </label>
                                </div>
                                <div className="sm:col-span-2"><Field label="Enrolment date (first instalment from here)" req icon="📆" ok={!!formData.enrollmentDate && !enrolDateProblem(formData.enrollmentDate)} hint={enrolLimits().note}>
                                    {input('enrollmentDate', { type: 'date', min: enrolLimits().min, max: enrolLimits().max })}</Field></div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="grid sm:grid-cols-2 gap-4">
                                <Row label="Student" icon="🧑‍🎓" text={[formData.studentName, formData.currentGrade && `Class ${formData.currentGrade}`, formData.phone && `+91 ${formData.phone}`].filter(Boolean).join(' · ')} />
                                <Row label="Parents" icon="👨‍👩‍👧" text={[formData.fatherName, formData.motherName, formData.parentPhone && `+91 ${formData.parentPhone}`].filter(Boolean).join(' · ')} />
                                <Row label="Course" icon="📚" text={[courseName, formData.batchName || 'batch later', CENTERS[selectedCenterId]?.name, formData.admissionMode === 'ONLINE' ? 'Online' : 'Classroom', formData.hosteller ? 'Hosteller' : ''].filter(Boolean).join(' · ')} />
                                <Row label="Fee" icon="🧾" text={`${inr(formData.totalFee)} · ${formData.paymentPlan === 'LOAN' ? 'education loan' : 'instalments'} · from ${formData.enrollmentDate || '—'}`} />
                                <div className="sm:col-span-2"><Row label="Token" icon="💳" text={`${inr(formData.tokenAmount)} into ${formData.paymentMode}${formData.proofImage ? ' · proof attached' : ''}`} /></div>
                            </div>
                        )}

                        {stepErr && <p role="alert" className="mt-4 text-[13px] font-semibold px-3.5 py-2.5 rounded-xl" style={{ background: 'var(--t-coral)' }}>{stepErr}</p>}
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-6 pt-5" style={{ borderTop: '1px solid var(--track)' }}>
                        <button type="button" onClick={() => { setStepErr(''); if (step === 0) navigate(-1); else setStep(step - 1); }} className="jb-act jb-act-soft !py-3 !px-5">← {step === 0 ? 'Cancel' : 'Back'}</button>
                        <span className="text-[12.5px] hidden sm:inline" style={{ color: 'var(--muted)' }}>Step {step + 1} of 5</span>
                        {step < 4
                            ? <button key="next" type="button" onClick={next} className="jb-act jb-act-ink !py-3 !px-5">Next →</button>
                              : <button key="send" type="submit" disabled={loading || problems.some(Boolean)} className="jb-act jb-act-ink !py-3 !px-5 disabled:opacity-50">{loading ? 'Sending…' : 'Send to Accounts ✓'}</button>}
                    </div>
                </form>

                <aside className="flex flex-col gap-4 min-w-0 lg:sticky lg:top-4">
                    <Card delay={60}>
                        <div className="flex items-center gap-3">
                            <Avatar name={formData.studentName || '?'} size={48} />
                            <div className="min-w-0"><b className="block text-[16px] truncate">{formData.studentName || 'New student'}</b><span className="block text-[12.5px] truncate" style={{ color: 'var(--muted)' }}>{[courseName, formData.batchName].filter(Boolean).join(' · ') || 'Course not picked yet'}</span></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 mt-4">
                            <div className="rounded-2xl p-3" style={{ background: 'var(--t-sage)' }}><span className="block text-[12px] font-bold">Final fee</span><b className="text-[20px] font-extrabold">{inr(formData.totalFee)}</b></div>
                            <div className="rounded-2xl p-3" style={{ background: 'var(--t-butter)' }}><span className="block text-[12px] font-bold">Token today</span><b className="text-[20px] font-extrabold">{inr(formData.tokenAmount)}</b></div>
                        </div>
                        <div className="flex items-center gap-3 mt-2.5 rounded-2xl px-3 py-2.5" style={{ background: 'var(--cream)' }}>
                            <span aria-hidden="true">🎫</span>
                            <span className="flex-1"><span className="block text-[12px]" style={{ color: 'var(--muted)' }}>Roll number</span><b className="tracking-wider">{rollPreview}</b></span>
                            <span className="text-[11.5px] text-right" style={{ color: 'var(--muted)' }}>given after<br />Accounts verifies</span>
                        </div>
                    </Card>
                    <Card title="Checklist" delay={100}>
                        <ul className="flex flex-col gap-2.5">
                            {['Student details', 'Parents and address', 'Course and batch', 'Fees and token', 'Sent to Accounts'].map((l, i) => {
                                const ok = i < 4 && done[i];
                                return (
                                    <li key={l} className="flex items-center gap-3 text-[14px]">
                                        <span className="w-6 h-6 rounded-md flex items-center justify-center text-[12px] font-bold" style={{ background: ok ? 'var(--ok)' : 'var(--cream2)', color: '#FFFFFF', transition: 'background .3s ease' }}>{ok ? '✓' : ''}</span>{l}
                                    </li>
                                );
                            })}
                        </ul>
                    </Card>
                </aside>
            </div>
        </div>
    );
};

export default AdmissionForm;
