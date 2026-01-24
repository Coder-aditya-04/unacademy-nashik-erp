import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { X, Check, Loader2, User, Phone, MapPin, School, Calendar, FileText, Briefcase, UserCheck, Building2 } from 'lucide-react';
import { fetchStaffList, fetchBDEList } from '../services/userService';
import { CENTERS } from '../utils/centers';

const PublicInquiryForm = ({ onClose }) => {
    // TABS: 'front_desk' | 'field_work'
    const [activeTab, setActiveTab] = useState('field_work'); // Default to BDE (Public)
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // Security State
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [storedPassword, setStoredPassword] = useState('1234'); // Default Fallback

    // Dropdown Data
    const [staffList, setStaffList] = useState([]);
    const [bdeList, setBdeList] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        center: '', // Center ID
        studentName: '',
        parentPhone: '', // Primary Contact
        board: '',
        currentClass: '',
        courseInterest: '',
        address: '',
        remarks: '',

        // Front Desk Specific
        source: 'Walk-in',
        assignedTo: '', // Counselor ID

        // BDE Specific
        bdeName: '',
        eventLocation: '',
        eventDate: new Date().toISOString().split('T')[0],
        schoolName: ''
    });

    // 0. Fetch Password Protection Settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, "settings", "front_desk");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().password) {
                    setStoredPassword(docSnap.data().password);
                }
            } catch (err) {
                console.error("Error fetching settings:", err);
            }
        };
        fetchSettings();
    }, []);

    // 1. Fetch Staff Lists on Mount
    useEffect(() => {
        const loadStaff = async () => {

            try {
                // Fetch Counselors for "Front Desk" Assignment
                const staff = await fetchStaffList(null);
                setStaffList(staff.filter(u => ['COUNSELOR', 'STAFF'].includes(u.role?.toUpperCase())));
            } catch (err) {
                console.error("Error loading staff", err);
            }
        };
        loadStaff();
    }, []);

    // 2. Fetch BDE List when switching to BDE Tab (Ensures fresh list)
    useEffect(() => {
        if (activeTab === 'field_work') {
            const loadBDEs = async () => {
                try {
                    const bdes = await fetchBDEList();
                    const formattedBDEs = Array.isArray(bdes) ? bdes.map(b => typeof b === 'string' ? { name: b } : b) : [];
                    setBdeList(formattedBDEs);
                } catch (err) {
                    console.error("Error loading BDEs", err);
                }
            };
            loadBDEs();
        }
    }, [activeTab]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Validate Center
            if (!formData.center) {
                alert("Please select a Center");
                setLoading(false);
                return;
            }

            // VALIDATE PHONE NUMBER (10 Digits)
            if (!/^\d{10}$/.test(formData.parentPhone)) {
                alert("⚠️ INVALID PHONE NUMBER!\n\nPlease enter a correct 10-digit mobile number.");
                setLoading(false);
                return;
            }

            // DUPLICATE CHECK: REMOVED FOR SECURITY (Prevent Data Leak)
            // To allow "Check", we would need to allow "Public List", which lets hackers dump the DB.
            // Safe approach on Free Tier: Fail open or backend check (not available on Spark).
            /* 
            try {
                const q = query(collection(db, "leads"), where("phone", "==", formData.parentPhone), limit(1));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    alert(`⚠️ DUPLICATE LEAD DETECTED!\n\nA lead with the number ${formData.parentPhone} already exists in the system.\nPlease check the existing record instead of creating a new one.`);
                    setLoading(false);
                    return;
                }
            } catch (err) {
               // ...
            } 
            */

            // Construct Lead Object
            const leadData = {
                centerId: formData.center, // Save Center ID
                // Shared Fields
                studentName: formData.studentName,
                phone: formData.parentPhone,
                parentPhone: formData.parentPhone,
                board: formData.board,
                currentClass: formData.currentClass,
                courseInterest: formData.courseInterest,
                address: formData.address,
                remarks: formData.remarks,
                createdAt: Timestamp.now(),
                status: 'NEW',

                // Fields depending on Tab
                ...(activeTab === 'front_desk' ? {
                    source: formData.source,
                    assignedTo: formData.assignedTo,
                    assignedByName: staffList.find(s => s.uid === formData.assignedTo)?.name || 'Unassigned'
                } : {
                    source: 'BDE',
                    assignedTo: formData.assignedTo, // NOW INCLUDED FOR BDE
                    assignedByName: staffList.find(s => s.uid === formData.assignedTo)?.name || 'Unassigned',
                    sourceDetails: {
                        enteredBy: formData.bdeName,
                        location: formData.eventLocation,
                        date: formData.eventDate,
                        school: formData.schoolName
                    }
                })
            };

            await addDoc(collection(db, "leads"), leadData);

            setSuccess(true);
            setTimeout(() => {
                if (onClose) onClose();
            }, 2000);

        } catch (error) {
            console.error("Submission Error:", error);
            alert("Error submitting form: " + error.message);
        }
        setLoading(false);
    };

    // Filter Counselors based on selected Center
    const filteredCounselors = formData.center
        ? staffList.filter(s => s.centerId === formData.center)
        : [];

    if (success) {
        return (
            <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm mx-auto animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Inquiry Saved!</h2>
                <p className="text-gray-500">Thank you for visiting Unacademy Nashik.</p>
            </div>
        );
    }

    return (
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header / Tabs */}
            <div className="flex border-b border-gray-100 sticky top-0 bg-white z-50">
                <button
                    onClick={() => setActiveTab('front_desk')}
                    className={`flex-1 py-4 text-sm font-bold tracking-wide transition-colors flex items-center justify-center gap-2 ${activeTab === 'front_desk' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <FileText className="w-4 h-4" /> FRONT DESK
                </button>
                <button
                    onClick={() => setActiveTab('field_work')}
                    className={`flex-1 py-4 text-sm font-bold tracking-wide transition-colors flex items-center justify-center gap-2 ${activeTab === 'field_work' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <Briefcase className="w-4 h-4" /> BDE / FIELD WORK
                </button>
                <button onClick={onClose} className="p-4 hover:bg-gray-100 text-gray-400 transition"><X className="w-5 h-5" /></button>
            </div>

            {/* PASSWORD PROTECTION FOR FRONT DESK */}
            {activeTab === 'front_desk' && !isUnlocked ? (
                <div className="p-10 flex flex-col items-center justify-center h-full text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                        <UserCheck className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Staff Access Only</h3>
                        <p className="text-gray-500 text-sm">Please enter the PIN to access Front Desk entry.</p>
                    </div>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (passwordInput === storedPassword) {
                                setIsUnlocked(true);
                                setPasswordInput('');
                            } else {
                                alert("Incorrect PIN");
                                setPasswordInput('');
                            }
                        }}
                        className="w-full max-w-xs space-y-3"
                    >
                        <input
                            type="password"
                            autoFocus
                            placeholder="Enter PIN"
                            className="w-full text-center text-2xl tracking-widest p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            maxLength={4}
                        />
                        <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                            Unlock Access
                        </button>
                    </form>
                </div>
            ) : (
                /* Form Content */
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form
                        onSubmit={handleSubmit}
                        className="space-y-6"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                            }
                        }}
                    >

                        {/* SECTION 1: TAB SPECIFIC TOP FIELDS */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            {/* GLOBAL CENTER SELECTION (For Both Tabs) */}
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Center</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                    <select
                                        name="center"
                                        value={formData.center}
                                        onChange={handleChange}
                                        className="w-full pl-9 p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                        required
                                    >
                                        <option value="">-- Select Center --</option>
                                        {Object.values(CENTERS).map(center => (
                                            <option key={center.id} value={center.id}>{center.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {activeTab === 'front_desk' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Inquiry Source</label>
                                        <select
                                            name="source"
                                            value={formData.source}
                                            onChange={handleChange}
                                            className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                        >
                                            <option>Walk-in</option>
                                            <option>Social Media</option>
                                            <option>UNSAT / Exam</option>
                                            <option>Referral</option>
                                            <option>Google / Website</option>
                                            <option>Event</option>
                                            <option>Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assign To Counselor</label>
                                        <div className="relative">
                                            <UserCheck className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                            <select
                                                name="assignedTo"
                                                value={formData.assignedTo}
                                                onChange={handleChange}
                                                className="w-full pl-9 p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700"
                                                required
                                                disabled={!formData.center}
                                            >
                                                <option value="">
                                                    {!formData.center ? '-- Select Center First --' : '-- Select Counselor --'}
                                                </option>
                                                {filteredCounselors.map(s => (
                                                    <option key={s.uid} value={s.uid}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // FIELD WORK FIELDS
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-orange-600 uppercase mb-1">BDE Name</label>
                                            <select
                                                name="bdeName"
                                                value={formData.bdeName}
                                                onChange={handleChange}
                                                className="w-full p-2.5 border border-orange-200 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 outline-none font-medium"
                                                required
                                                disabled={!formData.center}
                                            >
                                                <option value="">
                                                    {!formData.center ? '-- Select Center First --' : '-- Select Reporting BDE --'}
                                                </option>
                                                {bdeList
                                                    .filter(b => !b.centerId || b.centerId === formData.center)
                                                    .map((b, idx) => (
                                                        <option key={idx} value={b.name}>
                                                            {b.name}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-orange-600 uppercase mb-1">Activity Date</label>
                                            <div className="relative">
                                                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-orange-400" />
                                                <input
                                                    type="date"
                                                    name="eventDate"
                                                    value={formData.eventDate}
                                                    onChange={handleChange}
                                                    className="w-full pl-9 p-2.5 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-orange-600 uppercase mb-1">School / College Name</label>
                                            <div className="relative">
                                                <School className="absolute left-3 top-2.5 w-4 h-4 text-orange-400" />
                                                <input
                                                    name="schoolName"
                                                    value={formData.schoolName}
                                                    onChange={handleChange}
                                                    placeholder="e.g. Fravashi Academy"
                                                    className="w-full pl-9 p-2.5 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-orange-600 uppercase mb-1">Event Location / Area</label>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-orange-400" />
                                                <input
                                                    name="eventLocation"
                                                    value={formData.eventLocation}
                                                    onChange={handleChange}
                                                    placeholder="e.g. City Center Mall"
                                                    className="w-full pl-9 p-2.5 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* NEW ROW: Assign To Counselor for BDE */}
                                    <div>
                                        <label className="block text-xs font-bold text-orange-600 uppercase mb-1">Assign To Counselor</label>
                                        <div className="relative">
                                            <UserCheck className="absolute left-3 top-2.5 w-4 h-4 text-orange-400" />
                                            <select
                                                name="assignedTo"
                                                value={formData.assignedTo}
                                                onChange={handleChange}
                                                className="w-full pl-9 p-2.5 border border-orange-200 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 outline-none font-medium text-gray-700"
                                                required
                                                disabled={!formData.center}
                                            >
                                                <option value="">
                                                    {!formData.center ? '-- Select Center First --' : '-- Select Counselor --'}
                                                </option>
                                                {filteredCounselors.map(s => (
                                                    <option key={s.uid} value={s.uid}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* SECTION 2: STUDENT DETAILS (SHARED) */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="h-px bg-gray-200 flex-1"></span>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Student Details</span>
                                <span className="h-px bg-gray-200 flex-1"></span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Student Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                        <input
                                            name="studentName"
                                            value={formData.studentName}
                                            onChange={handleChange}
                                            className="w-full pl-9 p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Full Name"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Parent Phone</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                        <input
                                            name="parentPhone"
                                            value={formData.parentPhone}
                                            onChange={handleChange}
                                            className="w-full pl-9 p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Primary Contact Number"
                                            type="tel"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Class</label>
                                    <select
                                        name="currentClass"
                                        value={formData.currentClass}
                                        onChange={handleChange}
                                        className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    >
                                        <option value="">-- Select --</option>
                                        <option>8th</option>
                                        <option>9th</option>
                                        <option>10th</option>
                                        <option>11th</option>
                                        <option>12th</option>
                                        <option>Repeater</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Board</label>
                                    <select
                                        name="board"
                                        value={formData.board}
                                        onChange={handleChange}
                                        className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">-- Select --</option>
                                        <option>CBSE</option>
                                        <option>ICSE</option>
                                        <option>State Board</option>
                                        <option>IB / Other</option>
                                    </select>
                                </div>
                                <div className="md:col-span-1 col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Course Interest</label>
                                    <select
                                        name="courseInterest"
                                        value={formData.courseInterest}
                                        onChange={handleChange}
                                        className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    >
                                        <option value="">-- Select Course --</option>
                                        <option>Foundation Class 8</option>
                                        <option>Foundation Class 9</option>
                                        <option>Foundation Class 10</option>
                                        <option>11th JEE (2 Year)</option>
                                        <option>11th NEET (2 Year)</option>
                                        <option>12th JEE (1 Year)</option>
                                        <option>12th NEET (1 Year)</option>
                                        <option>Repeater (JEE)</option>
                                        <option>Repeater (NEET)</option>
                                        <option>MHT-CET (1 Year)</option>
                                        <option>MHT-CET (2 Year)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Address</label>
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    rows="2"
                                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    placeholder="Residential Area / City"
                                ></textarea>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Remarks</label>
                                <input
                                    name="remarks"
                                    value={formData.remarks}
                                    onChange={handleChange}
                                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    placeholder="Any additional comments..."
                                />
                            </div>

                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2 ${activeTab === 'front_desk' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-orange-600 hover:bg-orange-700 shadow-orange-200'
                                }`}
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (activeTab === 'front_desk' ? 'Submit to Front Desk' : 'Submit Field Entry')}
                        </button>
                    </form>
                </div>
            )}
        </div >
    );
};

export default PublicInquiryForm;
