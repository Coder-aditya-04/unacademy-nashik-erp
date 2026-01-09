import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLeadById, addInteraction } from '../../../services/leadService';
import { db } from '../../../firebase';
import { doc, getDoc } from 'firebase/firestore'; // Import Firestore functions
import { Phone, Calendar, User, MessageSquare, Clock, ArrowLeft, Save, MapPin, Calculator, CreditCard } from 'lucide-react';

const LeadDetails = ({ userProfile }) => {
    const { id } = useParams(); // Get Lead ID from URL
    const navigate = useNavigate();

    const [lead, setLead] = useState(null);
    const [loading, setLoading] = useState(true);
    // ... rest of component
    // ... rest of component


    // Interaction Form State
    const [logType, setLogType] = useState('CALL');
    const [logResult, setLogResult] = useState('');
    const [logNote, setLogNote] = useState('');
    const [nextDate, setNextDate] = useState(''); // New State for Date
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    if (loading) return <div className="p-8 text-center">Loading Profile...</div>;
    if (!lead) return <div className="p-8 text-center text-red-500">Lead not found</div>;

    // PRE-RENDER LOGIC: Synthesize Timeline
    let timelineEvents = [
        ...(lead.timeline || []).filter(t => t.type !== 'CREATED'),
        {
            date: lead.createdAt || new Date(),
            type: 'CREATED',
            result: lead.source === 'BDE'
                ? `Created by BDE (${lead.sourceDetails?.enteredBy || 'Unknown'})`
                : 'Created by Front Desk',
            by: 'System',
            note: lead.source === 'BDE'
                ? `School: ${lead.sourceDetails?.school || 'N/A'}, Loc: ${lead.sourceDetails?.location || 'N/A'}`
                : `Source: ${lead.source}`
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

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 bg-gray-50 min-h-screen">

            {/* Back Button */}
            <button onClick={() => navigate('/staff/leads')} className="flex items-center text-gray-500 hover:text-blue-600 mb-6 transition">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Lead Board
            </button>

            {/* PREMIUIM CONTAINER */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">

                {/* DARK HEADER (Like StudentManager) */}
                <div className="bg-slate-800 p-6 text-white flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            {lead.studentName}
                            <span className={`text-xs px-2 py-1 rounded text-white font-bold uppercase tracking-wider ${lead.status === 'NEW' ? 'bg-red-500' :
                                lead.status === 'CONVERTED' ? 'bg-green-500' : 'bg-blue-500'
                                }`}>
                                {lead.status.replace('_', ' ')}
                            </span>
                        </h1>
                        <p className="text-slate-300 text-sm mt-1 flex items-center gap-4">
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> +91 {lead.phone}</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {lead.city || 'Nashik'}</span>
                        </p>
                    </div>
                </div>

                {/* STATS ROW */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50 border-b border-gray-100">
                    <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase font-bold">Course Interest</p>
                        <p className="text-lg font-bold text-gray-800">{lead.courseInterest || "N/A"}</p>
                    </div>
                    <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase font-bold">Board</p>
                        <p className="text-lg font-bold text-gray-800">{lead.board || "N/A"}</p>
                    </div>
                    <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase font-bold">Current Standard</p>
                        <p className="text-lg font-bold text-gray-800">{lead.currentClass || "N/A"}</p>
                    </div>
                    <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase font-bold">Location</p>
                        <p className="text-lg font-bold text-gray-800 truncate" title={lead.address}>{lead.address || lead.city || "N/A"}</p>
                    </div>
                    <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase font-bold">Lead Source</p>
                        <p className="text-lg font-bold text-gray-800">{lead.source || "Walk-In"}</p>
                    </div>
                    <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase font-bold">Budget Quoted</p>
                        <p className="text-lg font-bold text-green-600">₹{lead.budgetQuoted || 0}</p>
                    </div>
                    <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase font-bold">Next Follow-up</p>
                        <p className={`text-lg font-bold ${lead.nextFollowUp === new Date().toISOString().split('T')[0] ? 'text-red-500' : 'text-blue-600'}`}>
                            {lead.nextFollowUp ? new Date(lead.nextFollowUp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : "None"}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase font-bold">Remarks</p>
                        <p className="text-lg font-bold text-gray-800 truncate" title={lead.remarks}>{lead.remarks || "-"}</p>
                    </div>
                </div>


                {/* CONTENT GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:divide-x divide-gray-200">

                    {/* COL 1: ACTIONS & LOGGING */}
                    <div className="lg:col-span-1 p-6 space-y-6 bg-white">

                        {/* Quick Actions */}
                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/staff/calculator', {
                                    state: {
                                        leadId: lead.id,
                                        prefillName: lead.studentName,
                                        prefillCourse: lead.courseInterest,
                                        centerId: lead.centerId
                                    }
                                })}
                                className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
                            >
                                <Calculator className="w-4 h-4" /> Generate Fee Quote
                            </button>

                            <button
                                onClick={() => navigate('/staff/take-admission', {
                                    state: {
                                        lead: { ...lead },
                                        quote: {
                                            finalFee: lead.budgetQuoted || 0,
                                            selectedProgram: lead.courseInterest
                                        }
                                    }
                                })}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition shadow-lg shadow-green-200"
                            >
                                <CreditCard className="w-4 h-4" /> Take Admission
                            </button>
                        </div>

                        <hr className="border-gray-100" />

                        {/* Logger */}
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                                <MessageSquare className="w-4 h-4 text-blue-600" /> Log Activity
                            </h3>

                            <form onSubmit={handleLogSubmit} className="space-y-3">
                                {/* Type Tabs */}
                                <div className="flex bg-white rounded-lg p-1 border">
                                    {['CALL', 'VISIT', 'COUNSELLING', 'WHATSAPP'].map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setLogType(type)}
                                            className={`flex-1 text-[10px] font-bold py-2 rounded transition ${logType === type ? 'bg-slate-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>

                                {/* Result Dropdown */}
                                <select
                                    className="w-full p-2 border rounded text-sm bg-white outline-none focus:border-blue-500"
                                    value={logResult}
                                    onChange={(e) => setLogResult(e.target.value)}
                                    required
                                >
                                    <option value="">-- Select Result --</option>
                                    {logType === 'CALL' && (
                                        <>
                                            <option value="Connected - Interested">Connected - Interested</option>
                                            <option value="Ringing / No Answer">Ringing / No Answer</option>
                                            <option value="Switched Off">Switched Off</option>
                                            <option value="Not Interested">Not Interested</option>
                                            <option value="Visit Scheduled">Visit Scheduled</option>
                                        </>
                                    )}
                                    {logType === 'VISIT' && (
                                        <>
                                            <option value="Visited - Positive">Visited - Positive</option>
                                            <option value="Visited - Negotiating">Visited - Negotiating</option>
                                            <option value="Visited - Converted">Visited - Converted (Token)</option>
                                        </>
                                    )}
                                    {logType === 'COUNSELLING' && (
                                        <>
                                            <option value="Counselling Done - Positive">Counselling Done - Positive</option>
                                            <option value="Counselling - Needs Time">Counselling - Needs Time</option>
                                            <option value="Counselling - Converted">Counselling - Converted</option>
                                        </>
                                    )}
                                    {logType === 'WHATSAPP' && <option value="Brochure Sent">Brochure Sent</option>}
                                </select>

                                {/* Note Textarea */}
                                <textarea
                                    className="w-full p-2 border rounded text-sm outline-none focus:border-blue-500"
                                    placeholder="Add specific notes..."
                                    rows="3"
                                    value={logNote}
                                    onChange={(e) => setLogNote(e.target.value)}
                                />

                                {/* NEW: Follow-up Date Picker */}
                                <div className="bg-white p-2 rounded border border-gray-200">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                        Next Follow-up
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full p-1 text-sm outline-none"
                                        value={nextDate}
                                        onChange={(e) => setNextDate(e.target.value)}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-lg text-sm transition flex justify-center items-center gap-2"
                                >
                                    {isSubmitting ? "Saving..." : <><Save className="w-4 h-4" /> Save Log</>}
                                </button>
                            </form>
                        </div>

                    </div>

                    {/* COL 2: TIMELINE */}
                    <div className="lg:col-span-2 p-6 bg-white min-h-[500px]">
                        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-gray-400" /> Interaction Timeline
                        </h3>

                        <div className="relative border-l-2 border-slate-100 ml-3 space-y-8">
                            {timelineEvents.map((log, idx) => (
                                <div key={idx} className="relative pl-8 group">
                                    {/* Timeline Dot */}
                                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${log.type === 'CALL' ? 'bg-blue-500' :
                                        log.type === 'VISIT' ? 'bg-green-500' :
                                            log.type === 'WHATSAPP' ? 'bg-green-400' :
                                                log.type === 'PAYMENT_APPROVED' ? 'bg-emerald-600' : 'bg-gray-400'
                                        }`}></div>

                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                                                {log.date?.seconds ? new Date(log.date.seconds * 1000).toLocaleString('en-IN') :
                                                    (log.date ? new Date(log.date).toLocaleString('en-IN') : "Just Now")}
                                            </span>
                                        </div>

                                        <div className="bg-slate-50 group-hover:bg-slate-100 rounded-lg p-4 border border-slate-100 transition">
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-bold text-slate-800">
                                                    {log.type} - {log.result || log.message}
                                                </p>
                                                <span className="text-[10px] bg-white border px-2 py-0.5 rounded-full text-slate-500">{log.by}</span>
                                            </div>
                                            {(log.note) && (
                                                <p className="text-sm text-slate-600 mt-2 leading-relaxed">"{log.note}"</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!lead.timeline || lead.timeline.length === 0) && (
                                <div className="text-center py-10 text-gray-400">
                                    <p>No interactions logged yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default LeadDetails;
