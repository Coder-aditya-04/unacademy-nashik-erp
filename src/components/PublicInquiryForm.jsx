import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { CENTERS } from '../utils/centers';

const PublicInquiryForm = ({ onClose }) => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        center: '',
        studentName: '',
        parentPhone: '',
        board: '',
        currentClass: '',
        courseInterest: '',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return; // Prevent double click
        setLoading(true);

        try {
            if (!formData.center) {
                alert("Please select a Center");
                setLoading(false);
                return;
            }

            if (!/^\d{10}$/.test(formData.parentPhone)) {
                alert("Please enter a valid 10-digit mobile number.");
                setLoading(false);
                return;
            }

            const cleanPhone = String(formData.parentPhone).replace(/\D/g, '').slice(-10);

            // Construct Lead Object
            const leadData = {
                centerId: formData.center,
                studentName: String(formData.studentName || "").trim(),
                phone: cleanPhone,
                parentPhone: cleanPhone,
                board: formData.board || '',
                currentClass: formData.currentClass,
                courseInterest: formData.courseInterest,
                source: 'Website', // Default source for public form
                sourceDetails: {
                    role: 'Student',
                    enteredBy: 'Self',
                    location: 'Website Inquiry'
                },
                createdAt: Timestamp.now(),
                status: 'NEW',
            };

            // DUPLICATE CHECK — only possible for signed-in staff. Leads are
            // not readable by the public (firestore.rules), so for a website
            // visitor this query is refused; that used to abort the whole
            // submission with "Missing or insufficient permissions", losing
            // every public inquiry. Staff dedupe from the lead dashboard.
            let querySnapshot = null;
            try {
                const q = query(collection(db, "leads"), where("phone", "==", cleanPhone));
                querySnapshot = await getDocs(q);
            } catch (dupErr) {
                if (dupErr?.code !== 'permission-denied') throw dupErr;
            }
            if (querySnapshot && !querySnapshot.empty) {
                alert("This phone number is already registered with us. We will contact you shortly!");
                setLoading(false);
                return;
            }

            await addDoc(collection(db, "leads"), leadData);

            setSuccess(true);
            setTimeout(() => {
                if (onClose) onClose();
            }, 3000);

        } catch (error) {
            console.error("Submission Error:", error);
            alert("Error submitting form: " + error.message);
        }
        setLoading(false);
    };

    const lab = 'block text-[12.5px] font-bold mb-1.5';
    if (success) {
        return (
            <div className="jb-card jb-rise text-center max-w-sm w-full mx-auto relative" style={{ padding: 32 }} role="status">
                <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 jb-act jb-act-soft" style={{ padding: '7px 11px' }}>✕</button>
                <span className="w-16 h-16 rounded-full inline-flex items-center justify-center text-[30px] jb-pop" style={{ background: 'var(--t-sage)' }} aria-hidden="true">✓</span>
                <h2 className="jb-h text-[24px] mt-4">Request sent</h2>
                <p className="text-[14px] mt-1" style={{ color: 'var(--muted)' }}>Our counsellor will call you shortly to fix your demo class.</p>
            </div>
        );
    }

    return (
        <div className="jb-card jb-rise w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] relative" style={{ padding: 0 }}>
            <div className="px-6 pt-6 pb-5 flex justify-between items-start gap-3" style={{ background: 'var(--t-butter)' }}>
                <div>
                    <h2 className="jb-h text-[24px] leading-tight">Book a free demo</h2>
                    <p className="text-[13.5px] mt-1" style={{ color: 'var(--sub)' }}>Leave your details and we'll call you back.</p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="jb-act jb-act-line" style={{ padding: '7px 11px' }}>✕</button>
            </div>

            <div className="p-6 overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block"><span className={lab}>Centre</span>
                        <select name="center" value={formData.center} onChange={handleChange} className="jb-input" required>
                            <option value="">Choose a centre</option>
                            {Object.values(CENTERS).map(center => <option key={center.id} value={center.id}>{center.name}</option>)}
                        </select>
                    </label>
                    <label className="block"><span className={lab}>Student's name</span>
                        <input name="studentName" value={formData.studentName} onChange={handleChange} className="jb-input" placeholder="Full name" autoComplete="name" required />
                    </label>
                    <label className="block"><span className={lab}>Mobile number</span>
                        <input name="parentPhone" value={formData.parentPhone} onChange={handleChange} className="jb-input" placeholder="10-digit mobile number" type="tel" inputMode="numeric" maxLength="10" autoComplete="tel-national" required />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block"><span className={lab}>Class</span>
                            <select name="currentClass" value={formData.currentClass} onChange={handleChange} className="jb-input" required>
                                <option value="">Choose</option>
                                <option>8th</option><option>9th</option><option>10th</option><option>11th</option><option>12th</option><option>Repeater</option>
                            </select>
                        </label>
                        <label className="block"><span className={lab}>Course</span>
                            <select name="courseInterest" value={formData.courseInterest} onChange={handleChange} className="jb-input" required>
                                <option value="">Choose</option>
                                <option>JEE</option><option>NEET</option><option>MHT-CET</option><option>Foundation</option>
                            </select>
                        </label>
                    </div>
                    <button type="submit" disabled={loading} className="jb-act jb-act-ink w-full" style={{ padding: '14px 18px', fontSize: 15 }}>
                        {loading ? 'Sending…' : 'Request a call back'}
                    </button>
                    <p className="text-center text-[11.5px]" style={{ color: 'var(--muted)' }}>We may send updates on WhatsApp or SMS.</p>
                </form>
            </div>
        </div>
    );
};

export default PublicInquiryForm;
