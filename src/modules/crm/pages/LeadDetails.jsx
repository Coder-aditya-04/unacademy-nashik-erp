import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLeadById, addInteraction, setLeadRating } from '../../../services/leadService';
import { FullTimeline, RatingPicker, RatingTag } from '../../../components/j/LeadBits';
import { buildTimeline } from '../../../utils/timeline';
import { rememberRecent } from '../../../utils/recent';
import { db } from '../../../firebase';
import { doc, getDoc } from 'firebase/firestore'; // Import Firestore functions
import { Card, Empty, Contact, Layer } from '../../../components/j';
import { CENTRE_NAME, centreOf, programLabel } from '../../j/data';
import AddLead from './AddLead'; // Import logic-rich form

const LeadDetails = ({ userProfile }) => {
    const { id } = useParams(); // Get Lead ID from URL
    const navigate = useNavigate();

    const [lead, setLead] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editingLead, setEditingLead] = useState(null); // Edit Mode State

    // Interaction Form State
    const [logType, setLogType] = useState('CALL');
    const [logResult, setLogResult] = useState('');
    const [logNote, setLogNote] = useState('');
    const [nextDate, setNextDate] = useState(''); // New State for Date
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [ratingBusy, setRatingBusy] = useState(false);

    // Load Lead Data
    useEffect(() => {
        fetchLead();
    }, [id]);

    const fetchLead = async () => {
        let data = await getLeadById(id);

        // RECOVERY LOGIC: Fetch Linked Admission for Timeline Restoration
        if (data?.admissionId) {
            try {
                const admRef = doc(db, 'admissions', data.admissionId);
                const admSnap = await getDoc(admRef);
                if (admSnap.exists()) {
                    data = { ...data, admissionDetails: admSnap.data() };
                }
            } catch (e) { console.error("Error fetching admission linkage", e) }
        }

        setLead(data);
        setLoading(false);
        if (data?.studentName) rememberRecent({ to: `/staff/leads/${id}`, name: data.studentName, sub: ['Enquiry', programLabel(data.courseInterest)].filter(Boolean).join(' · ') });
    };

    // Handle Log Submit
    const handleLogSubmit = async (e) => {
        e.preventDefault();
        if (!logResult) return alert("Please select a result");

        setIsSubmitting(true);

        const interactionData = {
            type: logType,
            result: logResult,
            note: logNote,
            // Logic: Auto-update Status based on Result
            // Logic: Auto-update Status based on Result
            newStatus: (() => {
                // USER REQUEST: Auto-update on Visit/Counseling
                if (logType === 'COUNSELLING') return 'COUNSELLING_DONE';

                // Existing Logic + Visit
                if (logResult.includes('Converted')) return 'CONVERTED';
                if (logResult === 'Visit Scheduled') return 'ATTEMPTED'; // Or VISIT_SCHEDULED if exists
                if (logResult.includes('Visited')) return 'VISITED';
                if (logResult === 'Connected - Interested') return 'FOLLOW_UP';
                if (logResult === 'Not Interested') return 'REJECTED';

                // CRITICAL FIX: IF DATE IS SET, FORCE STATUS TO FOLLOW_UP (Unless Converted/Rejected)
                if (nextDate && !['CONVERTED', 'REJECTED', 'ADMISSION_TAKEN'].includes(lead.status)) {
                    return 'FOLLOW_UP';
                }

                return undefined;
            })(),
            nextFollowUp: nextDate // Pass the date
        };

        const response = await addInteraction(id, interactionData, userProfile);

        if (response.success) {
            // WHATSAPP REDIRECTION LOGIC
            if (logType === 'WHATSAPP') {
                // 1. Clean Phone Number (Remove spaces, dashes, +91 check)
                let phone = lead.phone.replace(/\D/g, ''); // Remove non-digits
                if (phone.length === 10) phone = '91' + phone; // Add India code if missing

                // 2. Prepare Message (Use note or default)
                const text = encodeURIComponent(logNote || `Hello ${lead.studentName}, sending you the brochure as requested.`);

                // 3. Open WhatsApp
                window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
            }

            // Reset Form and Refresh Data
            setLogNote('');
            setLogResult('');
            setNextDate(''); // Reset date
            fetchLead();
        } else {
            alert("Failed to log interaction");
        }
        setIsSubmitting(false);
    };

    if (loading) return <div className="flex flex-col gap-4" aria-busy="true"><div className="jb-sk h-40" /><div className="jb-grid21"><div className="jb-sk h-96" /><div className="jb-sk h-96" /></div></div>;
    if (!lead) return <Card><Empty emoji="🔎">This enquiry was not found.</Empty></Card>;

    // PRE-RENDER LOGIC: Synthesize Timeline
    let timelineEvents = [
        ...(lead.timeline || []).filter(t => t.type !== 'CREATED'),
        lead.source === 'Telecalling' ? {
            date: lead.createdAt || new Date(), type: 'CREATED',
            result: 'Moved to Admissions from telecalling', by: lead.telecaller || 'Telecaller', role: 'Telecaller',
            note: lead.sourceDetails ? `Lead list: ${lead.sourceDetails}` : '',
        } : {
            date: lead.createdAt || new Date(),
            type: 'CREATED',
            result: lead.source === 'BDE'
                ? `Created by BDE (${lead.sourceDetails?.enteredBy || lead.bdeName || 'Unknown'})`
                : `Created by ${lead.source === 'WALK_IN' ? 'FRONT DESK' : (lead.sourceDetails?.role ? lead.sourceDetails.role.replace('_', ' ') : 'System')} (${lead.sourceDetails?.enteredBy || 'Unknown'})`,
            by: lead.source === 'BDE' ? 'BDE' : (lead.source === 'WALK_IN' ? 'FRONT_DESK' : (lead.sourceDetails?.role || 'System')),
            note: lead.source === 'BDE'
                ? `School: ${lead.sourceDetails?.school || 'N/A'}, Loc: ${lead.sourceDetails?.location || 'N/A'}`
                : `Source: ${lead.source}, Location: ${lead.sourceDetails?.location || lead.address || 'N/A'}`
        }
    ];

    // RESTORE MISSING LOGS (For Backward Compatibility)
    if (lead.admissionDetails?.verifiedBy && !timelineEvents.find(e => e.type === 'PAYMENT_APPROVED')) {
        timelineEvents.push({
            type: "PAYMENT_APPROVED",
            result: `Payment Verified: ₹${Number(lead.admissionDetails.totalPaid || lead.admissionDetails.downPayment || 0).toLocaleString()}`,
            note: `Token amount approved. Verified by ${lead.admissionDetails.verifiedBy}. Mode: ${lead.admissionDetails.paymentMode || 'Unknown'} (Log Restored)`,
            date: lead.admissionDetails.verificationDate || lead.admissionDetails.updatedAt || new Date(),
            by: lead.admissionDetails.verifiedBy
        });
    }

    // Sort Newest First
    timelineEvents.sort((a, b) => {
        const dateA = a.date?.seconds ? new Date(a.date.seconds * 1000) : new Date(a.date || 0);
        const dateB = b.date?.seconds ? new Date(b.date.seconds * 1000) : new Date(b.date || 0);
        return dateB - dateA;
    });

    const RESULTS = {
        CALL: ['Connected - Interested', 'Ringing / No Answer', 'Switched Off', 'Not Interested', 'Visit Scheduled'],
        VISIT: ['Visited - Positive', 'Visited - Negotiating', 'Visited - Converted'],
        COUNSELLING: ['Counselling Done - Positive', 'Counselling - Needs Time', 'Counselling - Converted'],
        WHATSAPP: ['Brochure Sent'],
    };
    const TYPES = [['CALL', '📞 Call'], ['VISIT', '🏫 Visit'], ['COUNSELLING', '🗣️ Counselling'], ['WHATSAPP', '💬 WhatsApp']];
    const canEdit = ['DIRECTOR', 'MANAGER', 'ACCOUNTANT'].includes(userProfile?.role) || userProfile?.uid === lead.assignedTo;
    const isBde = userProfile?.role === 'BDE';
    const today = new Date().toISOString().split('T')[0];
    const due = lead.nextFollowUp && lead.nextFollowUp <= today;
    const statusTone = ['CONVERTED', 'ADMISSION_TAKEN', 'TOKEN_PAID'].includes(lead.status) ? 'jb-tag-ok' : ['REFUNDED', 'REJECTED', 'NOT_INTERESTED', 'LOST'].includes(lead.status) ? 'jb-tag-late' : 'jb-tag-next';
    const about = [
        ['📞 Student phone', lead.phone], ['👪 Parent phone', lead.parentPhone], ['🎓 Course', programLabel(lead.courseInterest)],
        ['🏫 Class', lead.currentStandard || lead.currentClass], ['📚 Board', lead.board], ['🏠 Area', lead.address || lead.city],
        ['📥 Source', [lead.source, typeof lead.sourceDetails === 'string' ? lead.sourceDetails : lead.sourceDetails?.location].filter(Boolean).join(' · ')],
        ['🧑‍💼 Counsellor', lead.assignedByName || lead.assignedToName], ['☎️ Telecaller', lead.telecaller],
        ['🧮 Quote', Number(lead.budgetQuoted) ? `₹${Number(lead.budgetQuoted).toLocaleString('en-IN')}` : ''], ['📝 Remarks', lead.remarks],
    ].filter(([, x]) => x);
    const message = `Namaste, this is Unacademy Nashik about ${lead.studentName}'s admission enquiry.`;

    return (
        <div className="flex flex-col gap-4">
            {editingLead && (
                <Layer>
                    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
                        <div className="max-w-2xl w-full">
                            <AddLead userProfile={userProfile} initialData={editingLead} onClose={() => setEditingLead(null)}
                                onSuccess={() => { setEditingLead(null); fetchLead(); }} />
                        </div>
                    </div>
                </Layer>
            )}

            <div className="flex items-center justify-between gap-2">
                <button type="button" className="jb-act jb-act-soft" onClick={() => navigate('/staff/leads')}>← Back</button>
                {lead.admissionId && <button type="button" className="jb-act jb-act-line" onClick={() => navigate(`/staff/student/${lead.admissionId}`)}>🎓 Open student profile</button>}
            </div>

            {/* Header card */}
            <section className="jb-card jb-rise relative overflow-hidden flex flex-col gap-4" style={{ padding: '24px 26px' }}>
                <span aria-hidden="true" className="absolute rounded-full" style={{ right: -60, top: -80, width: 280, height: 280, background: 'var(--t-blue)', opacity: .5 }} />
                <span aria-hidden="true" className="absolute rounded-full" style={{ right: 150, top: -120, width: 200, height: 200, background: 'var(--t-butter)', opacity: .45 }} />
                <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
                    <span className="w-[96px] h-[96px] rounded-[30px] flex items-center justify-center text-[34px] font-extrabold tracking-tight shrink-0" style={{ background: 'var(--t-coral)' }}>{(lead.studentName || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')}</span>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-[28px] sm:text-[36px] font-extrabold tracking-[-.025em] leading-tight">{lead.studentName}</h1>
                        <p className="text-[14px] mt-0.5" style={{ color: 'var(--muted)' }}>{programLabel(lead.courseInterest) || 'Course not set'} · {CENTRE_NAME[centreOf(lead)] || 'Centre not set'}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                            <span className={`jb-tag ${statusTone}`}>{String(lead.status || 'NEW').replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}</span>
                            <RatingTag lead={lead} />
                            {lead.nextFollowUp && <span className={`jb-tag ${due ? 'jb-tag-late' : 'jb-tag-soft'}`}>⏰ Call back {new Date(lead.nextFollowUp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                            {lead.source && <span className="jb-tag jb-tag-soft">📥 {String(lead.source).replace(/_/g, ' ').toLowerCase()}</span>}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Contact name={lead.studentName} phone={lead.parentPhone || lead.phone} labelled who={lead.parentPhone ? 'parent' : 'student'} message={message} />
                        {lead.parentPhone && lead.phone && lead.parentPhone !== lead.phone && <Contact name={lead.studentName} phone={lead.phone} who="student" message={message} />}
                        {canEdit && <button type="button" className="jb-act jb-act-line" onClick={() => setEditingLead(lead)}>✏️ Edit</button>}
                    </div>
                </div>
                <div className="relative flex flex-wrap items-center justify-between gap-3 pt-4" style={{ borderTop: '1px solid var(--track)' }}>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[12px] font-bold" style={{ color: 'var(--muted)' }}>LEAD RATING</span>
                        <RatingPicker value={{ temperature: lead.temperature, stars: lead.stars }} disabled={ratingBusy || userProfile?.role === 'RECOVERY'} onChange={async (r) => {
                            setRatingBusy(true);
                            try { await setLeadRating(lead.id, r, lead, userProfile); await fetchLead(); }
                            catch (e) { console.error(e); alert('Could not save the rating. Try again.'); }
                            setRatingBusy(false);
                        }} />
                    </div>
                    {!isBde && (
                        <div className="flex flex-wrap gap-2">
                            <button type="button" className="jb-act jb-act-line" onClick={() => navigate('/staff/calculator', { state: { leadId: lead.id, prefillName: lead.studentName, prefillCourse: lead.courseInterest, centerId: lead.centerId } })}>🧮 Fee quote</button>
                            {!lead.admissionId && <button type="button" className="jb-act jb-act-ink" onClick={() => navigate('/staff/take-admission', { state: { lead: { ...lead }, quote: { finalFee: lead.budgetQuoted || 0, selectedProgram: lead.courseInterest } } })}>🎓 Take admission</button>}
                        </div>
                    )}
                </div>
            </section>

            <div className="jb-grid21">
                <Card title="🧭 Journey with us" sub="Every call, change, rating and payment, from telecaller to Director" delay={120}>
                    <FullTimeline events={buildTimeline({ lead: { ...lead, timeline: timelineEvents }, admission: lead.admissionDetails })} />
                </Card>

                <div className="flex flex-col gap-4">
                    <Card title="✍️ Log what happened" sub="It goes on the journey for everyone to see" delay={160}>
                        <form onSubmit={handleLogSubmit} className="flex flex-col gap-3">
                            <div className="flex flex-wrap gap-1.5">
                                {TYPES.map(([t, label]) => (
                                    <button key={t} type="button" className={`jb-act ${logType === t ? 'jb-act-ink' : 'jb-act-line'}`} style={{ padding: '6px 11px', fontSize: 13 }} onClick={() => { setLogType(t); setLogResult(''); }}>{label}</button>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Result">
                                {RESULTS[logType].map(r => (
                                    <button key={r} type="button" role="radio" aria-checked={logResult === r} className={`jb-act ${logResult === r ? 'jb-act-ink' : 'jb-act-soft'}`} style={{ padding: '6px 10px', fontSize: 12.5 }} onClick={() => setLogResult(r)}>{r}</button>
                                ))}
                            </div>
                            <textarea className="jb-input" rows={3} placeholder="What did they say?" value={logNote} onChange={(e) => setLogNote(e.target.value)} />
                            <label className="text-[12px] font-bold" style={{ color: 'var(--muted)' }}>NEXT CALL-BACK
                                <input type="date" className="jb-input mt-1" value={nextDate} min={today} onChange={(e) => setNextDate(e.target.value)} />
                            </label>
                            <button type="submit" disabled={isSubmitting || !logResult} className="jb-act jb-act-ink justify-center">{isSubmitting ? 'Saving…' : 'Save'}</button>
                        </form>
                    </Card>

                    <Card title="📋 About" delay={200}>
                        <dl className="flex flex-col">
                            {about.map(([k, x], i) => (
                                <div key={k} className="flex justify-between gap-3 py-2 text-[13.5px]" style={{ borderTop: i ? '1px solid var(--track)' : 'none' }}>
                                    <dt style={{ color: 'var(--muted)' }}>{k}</dt><dd className="font-bold text-right break-words min-w-0">{x}</dd>
                                </div>
                            ))}
                        </dl>
                    </Card>
                </div>
            </div>
        </div>
    );
};
export default LeadDetails;
