import React, { useState, useEffect } from 'react';
import { useAsk } from '../../../components/j/Ask';
import { createLead, updateLead, checkLeadExists } from '../../../services/leadService';
import { getCounsellorsByCenter, fetchBDEList } from '../../../services/userService'; // Import Staff Service


// Chip row used in the form (kept outside the component so it is not remade on each render).
const chipStyle = (on) => (on ? { background: 'var(--ink)', color: 'var(--on-ink)' } : { background: 'var(--panel)', boxShadow: '0 0 0 1px var(--line)', color: 'var(--ink)' });
const Chips = ({ label, value, list, onPick }) => (
    <div>
        <span className="block text-[12.5px] font-bold mb-1.5">{label}</span>
        <div className="flex flex-wrap gap-2">
            {list.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onPick(value === v ? '' : v)} className="rounded-full px-3.5 py-[8px] text-[13px] font-semibold transition-colors" style={chipStyle(value === v)}>{l}</button>)}
        </div>
    </div>
);

const AddLead = ({ userProfile, onSuccess, initialData = null, onClose }) => {
    const [loading, setLoading] = useState(false);
    const { ask, sheet } = useAsk();
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
        if (check.exists && !(isEditMode && initialData && check.lead.id === initialData.id)) {
            const src = check.lead.sourceDetails?.enteredBy || check.lead.source || 'Unknown';
            const date = check.lead.createdAt?.seconds ? new Date(check.lead.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown';

            setDuplicateWarning({
                type: type, // 'PHONE' or 'NAME'
                name: check.lead.studentName || 'Unknown Student',
                source: src,
                date: date,
                assignedTo: check.lead.assignedByName || 'Unassigned',
                id: check.lead.id
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
            await ask({ title: "Enter a 10-digit phone number" });
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
                await ask({ title: 'This number is already an enquiry', body: `It belongs to ${phoneCheck.lead.studentName || 'another student'} (counsellor: ${phoneCheck.lead.assignedByName || 'not assigned'}). Open that enquiry instead.` });
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
                    const proceed = await ask({ title: 'This name is already an enquiry', body: `${nameCheck.lead.studentName} is already in the enquiry list. Save this one anyway?`, ok: 'Save anyway', cancel: 'Go back' });
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
                await ask({ title: 'Pick a counsellor', body: 'Every enquiry you add needs a counsellor to follow it up.' });
                setLoading(false);
                return;
            }
            if (!formData.course) {
                await ask({ title: 'Pick the course the student wants' });
                setLoading(false);
                return;
            }
            if (!formData.studentName || formData.studentName.trim().length < 3) {
                await ask({ title: "Enter the student's full name" });
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
            await ask({ title: "Couldn't save the enquiry", body: String(result.error || '') });
        }
        setLoading(false);
    };

    const role = userProfile?.role;
    const strict = role === 'BDE' || role === 'FRONT_DESK';
    const canAssign = role === 'FRONT_DESK' || role === 'BDE' || role === 'MANAGER';
    const set = (k, v) => setFormData(prev => ({ ...prev, [k]: v }));
    const phoneDup = duplicateWarning?.type === 'PHONE';
    const COURSES = [['MHT_CET_12', 'MHT CET (1 Year)'], ['MHT_CET_11', 'MHT CET (2 Year)'], ['NEET_11_1Y', 'NEET 11th (1 Year)'], ['NEET_11', 'NEET 11th (2 Year)'], ['NEET_12', 'NEET 12th (1 Year)'],
        ['JEE_11_1Y', 'JEE 11th (1 Year)'], ['JEE_11', 'JEE 11th (2 Year)'], ['JEE_12', 'JEE 12th (1 Year)'], ['FOUNDATION_8', 'Foundation Class 8'], ['FOUNDATION_9', 'Foundation Class 9'], ['FOUNDATION_10', 'Foundation Class 10']];
    const lbl = (text, req) => <span className="block text-[12.5px] font-bold mb-1.5">{text}{req && <span style={{ color: 'var(--late)' }}> *</span>}</span>;

    return (
        <div className="jb-card flex flex-col max-h-[92vh] overflow-hidden" style={{ padding: 0 }}>
            {sheet}
            <div className="shrink-0 flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--line)' }}>
                <div className="flex items-center gap-3 min-w-0">
                    <span aria-hidden="true" className="w-11 h-11 rounded-2xl flex items-center justify-center text-[20px] shrink-0" style={{ background: isEditMode ? 'var(--t-butter)' : 'var(--t-blue)' }}>{isEditMode ? '✏️' : '📥'}</span>
                    <div className="min-w-0">
                        <h2 className="jb-h text-[21px] leading-tight">{isEditMode ? 'Edit enquiry' : 'New enquiry'}</h2>
                        <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>Phone first: we check it against every enquiry before saving.</p>
                    </div>
                </div>
                {onClose && <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-bold shrink-0" style={{ background: 'var(--cream)' }}>✕</button>}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
                <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 flex flex-col gap-4">
                    <div className="grid sm:grid-cols-2 gap-3">
                        <label className="block">{lbl('Student phone', true)}
                            <input required type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit number" className="jb-input" value={formData.phone}
                                style={phoneDup ? { boxShadow: '0 0 0 2px var(--late)' } : undefined}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    set('phone', val);
                                    if (val.length === 10) checkDuplicate(val, 'PHONE');
                                    else if (phoneDup) setDuplicateWarning(null);
                                }} onBlur={handlePhoneBlur} /></label>
                        <label className="block">{lbl('Parent phone')}
                            <input type="tel" inputMode="numeric" maxLength={10} placeholder="Optional" className="jb-input" value={formData.parentPhone} onChange={(e) => set('parentPhone', e.target.value.replace(/\D/g, ''))} /></label>
                    </div>
                    {phoneDup && (
                        <div role="alert" className="jb-pop flex items-start gap-3 p-3.5 rounded-2xl" style={{ background: 'var(--t-coral)' }}>
                            <span aria-hidden="true" className="text-[20px]">⛔</span>
                            <div className="text-[13px]"><b className="block text-[14px]">This number is already in the system</b>
                                {duplicateWarning.name} · with {duplicateWarning.assignedTo} · added {duplicateWarning.date}. Search the number at the top to open that enquiry instead.</div>
                        </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-3">
                        <label className="block">{lbl('Student name', true)}
                            <input required type="text" placeholder="Full name" className="jb-input" value={formData.studentName} onChange={(e) => set('studentName', e.target.value)} onBlur={handleNameBlur} />
                            {duplicateWarning?.type === 'NAME' && <span className="block mt-1.5 text-[12px] px-3 py-2 rounded-xl" style={{ background: 'var(--t-butter)' }}>⚠️ A {duplicateWarning.name} already exists ({duplicateWarning.source}). Check it is not the same student.</span>}</label>
                        <label className="block">{lbl('Course interest', strict)}
                            <select className="jb-input" value={formData.course} onChange={(e) => set('course', e.target.value)}>
                                <option value="">Pick a course</option>
                                {COURSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select></label>
                    </div>

                    <Chips label="Studying in" value={formData.currentStandard} onPick={(v) => set('currentStandard', v)} list={[['8', 'Class 8'], ['9', 'Class 9'], ['10', 'Class 10'], ['11', 'Class 11'], ['12', 'Class 12'], ['Dropper', 'Dropper']]} />
                    <Chips label="Board" value={formData.board} onPick={(v) => set('board', v)} list={[['STATE', 'State'], ['CBSE', 'CBSE'], ['ICSE', 'ICSE'], ['IB', 'IB / Other']]} />

                    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--cream)' }}>
                        <Chips label="How they heard of us" value={formData.source} onPick={(v) => setFormData(prev => ({ ...prev, source: v || 'WALK_IN', bdeId: role === 'BDE' ? prev.bdeId : '', bdeName: role === 'BDE' ? prev.bdeName : '' }))}
                            list={[['WALK_IN', '🚶 Walk-in'], ['REFERRAL', '🤝 Referral'], ['EVENT', '🎤 Event / seminar'], ['BDE', '🏫 BDE'], ['OTHER', 'Other']]} />
                        {formData.source === 'BDE' && (
                            <label className="block">{lbl('BDE who brought the lead')}
                                {role === 'BDE' ? <input className="jb-input" value={userProfile?.name || ''} readOnly /> : (
                                    <select className="jb-input" value={formData.bdeId} onChange={(e) => {
                                        const id = e.target.value; const b = bdeList.find(x => (x.id || x) === id); const name = b ? (b.name || b) : '';
                                        setFormData(prev => ({ ...prev, bdeId: id, bdeName: name, sourceDetails: name }));
                                    }}>
                                        <option value="">Pick the BDE</option>
                                        {bdeList.map((b, idx) => <option key={(b.id || b) + idx} value={b.id || b}>{b.name || b}{b.centerId ? ` (${b.centerId})` : ''}</option>)}
                                    </select>
                                )}</label>
                        )}
                        <div className="grid sm:grid-cols-2 gap-3">
                            {(formData.source === 'BDE' || formData.source === 'EVENT') && (
                                <label className="block">{lbl('School or coaching')}<input className="jb-input" placeholder="e.g. Fravashi Academy" value={formData.school} onChange={(e) => set('school', e.target.value)} /></label>
                            )}
                            <label className={`block ${formData.source === 'BDE' || formData.source === 'EVENT' ? '' : 'sm:col-span-2'}`}>{lbl(formData.source === 'BDE' ? 'Visit area' : 'Details')}
                                <input className="jb-input" placeholder={formData.source === 'BDE' ? 'e.g. College Road' : formData.source === 'REFERRAL' ? 'Who referred them?' : 'e.g. newspaper ad, friend'} value={formData.location} onChange={(e) => set('location', e.target.value)} /></label>
                        </div>
                    </div>

                    <label className="block">{lbl('Area they live in')}<input className="jb-input" placeholder="e.g. College Road, Nashik" value={formData.address} onChange={(e) => set('address', e.target.value)} /></label>
                    <label className="block">{lbl('Notes')}<textarea rows={2} className="jb-input resize-none" placeholder="Anything the counsellor should know" value={formData.remarks} onChange={(e) => set('remarks', e.target.value)} /></label>

                    {canAssign && (
                        <div>
                            {lbl(strict ? 'Send to counsellor' : 'Send to counsellor (optional)', strict)}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {!strict && <button type="button" onClick={() => set('assignedTo', '')} aria-pressed={!formData.assignedTo} className="rounded-2xl px-3 py-2.5 text-left text-[13px] font-semibold" style={chipStyle(!formData.assignedTo)}>Keep in pool</button>}
                                {counselors.map(c => (
                                    <button key={c.uid} type="button" onClick={() => set('assignedTo', c.uid)} aria-pressed={formData.assignedTo === c.uid}
                                        className="rounded-2xl px-3 py-2.5 text-left text-[13px] font-semibold truncate" style={chipStyle(formData.assignedTo === c.uid)}>{c.name}</button>
                                ))}
                                {counselors.length === 0 && <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>No counsellors found for this centre.</span>}
                            </div>
                        </div>
                    )}
                </div>

                <div className="shrink-0 flex items-center justify-end gap-2 px-5 sm:px-6 py-4" style={{ borderTop: '1px solid var(--line)', background: 'var(--panel)' }}>
                    {onClose && <button type="button" onClick={onClose} className="jb-act jb-act-soft">Cancel</button>}
                    <button type="submit" disabled={loading || phoneDup} className="jb-act jb-act-ink disabled:opacity-50">{loading ? 'Saving…' : isEditMode ? 'Save changes' : 'Save enquiry'}</button>
                </div>
            </form>
        </div>
    );
};

export default AddLead;
