import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { CENTERS } from '../utils/centers';

const PublicInquiryForm = ({ onClose, initial = {} }) => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [already, setAlready] = useState(false);
    const [err, setErr] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        center: initial.center || '',
        studentName: '',
        parentPhone: '',
        board: '',
        currentClass: '',
        courseInterest: initial.courseInterest || '',
    });

    const handleChange = (e) => {
        setErr('');
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return; // Prevent double click
        setLoading(true);

        try {
            if (!formData.center) {
                setErr('Please choose a centre.');
                setLoading(false);
                return;
            }

            if (!/^\d{10}$/.test(formData.parentPhone)) {
                setErr('Please enter a 10-digit mobile number.');
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

            // One website lead per number: the id is web_<phone>. The public may
            // create a lead but not change one (firestore.rules), so a second
            // request from the same number is refused and we say we have it.
            try {
                await setDoc(doc(db, 'leads', `web_${cleanPhone}`), leadData);
            } catch (dupErr) {
                if (dupErr?.code !== 'permission-denied') throw dupErr;
                setAlready(true);
            }

            setSuccess(true);
            setTimeout(() => {
                if (onClose) onClose();
            }, 3000);

        } catch (error) {
            console.error("Submission Error:", error);
            setErr('Could not send your request. Please check your internet and try again, or call us.');
        }
        setLoading(false);
    };

    const lab = 'block text-[12.5px] font-bold mb-1.5';
    if (success) {
        return (
            <div className="jb-card jb-rise text-center max-w-sm w-full mx-auto relative" style={{ padding: 32 }} role="status">
                <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 jb-act jb-act-soft" style={{ padding: '7px 11px' }}>✕</button>
                <span className="w-16 h-16 rounded-full inline-flex items-center justify-center text-[30px] jb-pop" style={{ background: '#EAF8F1', color: '#067A52' }} aria-hidden="true">✓</span>
                <h2 className="jb-h text-[24px] mt-4">{already ? 'We already have your request' : 'Request sent'}</h2>
                <p className="text-[14px] mt-1" style={{ color: 'var(--muted)' }}>{already ? 'This number is already with us. Our counsellor will call you shortly.' : 'Our counsellor will call you shortly to fix your demo class.'}</p>
            </div>
        );
    }

    return (
        <div className="jb-card jb-rise w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] relative" style={{ padding: 0, borderRadius: 28 }}>
            <div className="px-6 pt-6 pb-6 flex justify-between items-start gap-3 text-white" style={{ background: 'linear-gradient(120deg, #2B59FF 0%, #4C6BFF 50%, #7A5CFF 100%)' }}>
                <div>
                    <p className="text-[11.5px] font-bold tracking-[.16em] uppercase" style={{ color: '#FFE27A' }}>Free · No obligation</p>
                    <h2 className="text-[28px] leading-tight font-bold mt-1" style={{ letterSpacing: '-0.03em', color: '#fff' }}>Book a free demo class</h2>
                    <p className="text-[13.5px] mt-1" style={{ color: 'rgba(255,255,255,.72)' }}>Leave your details and our counsellor calls you back today.</p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 w-9 h-9 rounded-full inline-flex items-center justify-center" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>✕</button>
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
                    {err && <p role="alert" className="rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold" style={{ background: 'var(--t-coral)' }}>{err}</p>}
                    <button type="submit" disabled={loading} className="w-full rounded-2xl font-bold text-white transition-[background-color,transform] active:scale-[.98] bg-[#2B59FF] hover:bg-[#1E45D9] shadow-[0_14px_30px_-12px_rgba(43,89,255,.6)] disabled:opacity-60" style={{ padding: '15px 18px', fontSize: 15 }}>
                        {loading ? 'Sending…' : 'Request a call back'}
                    </button>
                    <p className="text-center text-[11.5px]" style={{ color: 'var(--muted)' }}>We may send updates on WhatsApp or SMS.</p>
                </form>
            </div>
        </div>
    );
};

export default PublicInquiryForm;
