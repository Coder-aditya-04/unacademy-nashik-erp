import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBatches, createBatch, updateBatch, deleteBatch, fetchRealBatchEnrollments } from '../../../services/batchService';
import { Plus, Trash2, Edit, Save, X, Users, Upload, Image as ImageIcon, Loader2, GraduationCap, TrendingUp } from 'lucide-react';
import { storage, auth } from '../../../firebase';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString } from 'firebase/storage';

const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Botany", "Zoology", "Mental Ability"];

const BatchManager = ({ userProfile }) => {
    console.log("BatchManager Rendering...", { userProfile }); // Debug Log
    const navigate = useNavigate();

    // Safety Check
    if (!userProfile) {
        console.warn("BatchManager: No userProfile");
        return <div className="p-10 text-center text-gray-500">Loading profile...</div>;
    }

    const [batches, setBatches] = useState([]);
    const [enrollments, setEnrollments] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [debugStatus, setDebugStatus] = useState(''); // Debugging UI
    const [viewCenter, setViewCenter] = useState('ALL');
    const [selectedBatchStats, setSelectedBatchStats] = useState('ALL');

    const isDirector = userProfile?.role?.toUpperCase() === 'DIRECTOR';
    const isManager = userProfile?.role?.toUpperCase() === 'MANAGER';

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        course: 'JEE_11',
        startDate: '',
        capacity: 60,
        totalSeats: 60,
        facultyPhotoUrl: '',
        faculty: []
    });

    const [editingId, setEditingId] = useState(null);

    // Initial Load
    useEffect(() => {
        loadBatches();
    }, [userProfile]);

    const loadBatches = async () => {
        setLoading(true);
        try {
            const [batchData, enumData] = await Promise.all([
                fetchBatches(userProfile.centerId),
                fetchRealBatchEnrollments(userProfile.centerId)
            ]);
            setBatches(batchData || []);
            setEnrollments(enumData || {});
        } catch (error) {
            console.error("Failed to load batches", error);
            setBatches([]);
            setEnrollments({});
        }
        setLoading(false);
    };

    // Handle Form Input
    const handleChange = (e) => {
        const { name, value } = e.target;

        // Auto-adjust Capacity if Total Seats changes
        if (name === 'totalSeats') {
            const oldTotal = parseInt(formData.totalSeats) || 0;
            const newTotal = parseInt(value) || 0;
            const diff = newTotal - oldTotal;

            // Adjust remaining capacity by the difference
            let newCapacity = (parseInt(formData.capacity) || 0) + diff;
            if (newCapacity < 0) newCapacity = 0;

            setFormData({
                ...formData,
                [name]: value,
                capacity: newCapacity
            });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    // Image Upload Handler (v6: Base64 Storage Bypass)
    // PROBLEM: Firebase Storage CORS blocks localhost uploads.
    // SOLUTION: Compress image locally and store as Base64 string directly in DB.
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        e.target.value = ''; // Reset

        if (file.size > 10 * 1024 * 1024) {
            alert("File too large! Max 10MB.");
            return;
        }

        setUploading(true);
        setDebugStatus("Processing image...");

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                // Resize & Compress Logic
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Max Width 800px (Good balance for quality/size)
                const MAX_WIDTH = 800;
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to compressed JPEG (0.7 quality)
                // This usually results in ~50-100KB string, safe for Firestore (1MB limit)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

                setFormData(prev => ({ ...prev, facultyPhotoUrl: dataUrl }));

                setDebugStatus("Photo Ready!");
                setUploading(false);
                // alert("Photo attached successfully! (Saved directly)");
            };

            img.onerror = () => {
                alert("Failed to process image.");
                setUploading(false);
            };
        };

        reader.onerror = () => {
            alert("Failed to read file.");
            setUploading(false);
        };
    };

    // Faculty Handlers
    const addFacultyRow = () => {
        setFormData({
            ...formData,
            faculty: [...formData.faculty, { subject: 'Physics', name: '' }]
        });
    };

    const removeFacultyRow = (index) => {
        const updated = formData.faculty.filter((_, i) => i !== index);
        setFormData({ ...formData, faculty: updated });
    };

    const handleFacultyChange = (index, field, value) => {
        const updated = [...formData.faculty];
        updated[index] = { ...updated[index], [field]: value };
        setFormData({ ...formData, faculty: updated });
    };

    // Submit Batch
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Robust parsing - Trust manual edits now
            const cap = parseInt(formData.capacity) || 0;
            const seats = parseInt(formData.totalSeats) || cap || 60;

            const payload = {
                ...formData,
                totalSeats: seats,
                capacity: cap, // Use the form value directly (user can edit manually now)
                centerId: userProfile.centerId || "UN_COLLEGE"
            };

            // If creating new, and capacity wasn't manually set?
            // Actually, if creating new, capacity usually equals totalSeats unless manually lowered.
            // But form initializes both to 60. Sync logic handles changes.

            console.log("Submitting Batch Payload:", payload);

            let result;
            if (editingId) {
                result = await updateBatch(editingId, payload);
            } else {
                result = await createBatch(payload, userProfile);
            }

            setLoading(false);

            if (result.success) {
                alert(editingId ? "Batch Updated Successfully!" : "Batch Created Successfully!");
                setShowModal(false);
                setEditingId(null);
                setFormData({
                    name: '',
                    course: 'JEE_11',
                    startDate: '',
                    capacity: 60,
                    totalSeats: 60,
                    facultyPhotoUrl: '',
                    faculty: []
                });
                await loadBatches();
            } else {
                console.error("Operation failed:", result.error);
                alert(`Error: ${result.error}\n\nPlease check your internet and permissions.`);
            }
        } catch (err) {
            console.error("Unexpected Error in Submit:", err);
            setLoading(false);
            alert("An unexpected error occurred: " + err.message);
        }
    };

    // Safe Date Helper for Input (YYYY-MM-DD)
    const safeDateForInput = (dateVal) => {
        if (!dateVal) return '';
        try {
            // Handle Firestore Timestamp
            if (dateVal && typeof dateVal === 'object' && dateVal.toDate) {
                return dateVal.toDate().toISOString().split('T')[0];
            }
            // Handle Date object
            if (dateVal instanceof Date) return dateVal.toISOString().split('T')[0];
            // Handle String
            if (typeof dateVal === 'string') {
                // If it's already YYYY-MM-DD
                if (dateVal.match(/^\d{4}-\d{2}-\d{2}$/)) return dateVal;
                // If it's ISO string
                return new Date(dateVal).toISOString().split('T')[0];
            }
            return '';
        } catch (e) {
            console.warn("Date parse error:", e);
            return '';
        }
    };

    // Open Edit Modal (Hardened & Normalized)
    const handleEdit = (batch) => {
        console.log("Editing Batch:", batch);
        setEditingId(batch.id);

        // Sanitize & Normalize Faculty
        let safeFaculty = [];
        if (Array.isArray(batch.faculty)) {
            safeFaculty = batch.faculty.map(f => {
                if (!f) return null;
                // Handle legacy string format "Name"
                if (typeof f === 'string') return { subject: 'Physics', name: f };
                // Handle object format { subject, name }
                if (typeof f === 'object') return { subject: f.subject || 'Physics', name: f.name || '' };
                return null;
            }).filter(Boolean); // Remove nulls
        }

        setFormData({
            name: batch.name || '',
            course: batch.course || 'JEE_11',
            startDate: safeDateForInput(batch.startDate),
            capacity: batch.capacity ?? 0,
            totalSeats: batch.totalSeats ?? (batch.capacity ?? 60),
            facultyPhotoUrl: batch.facultyPhotoUrl || '',
            faculty: safeFaculty
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure? This cannot be undone.")) {
            setLoading(true);
            const result = await deleteBatch(id);
            if (result.success) {
                alert("Batch deleted successfully!");
                await loadBatches();
            } else {
                console.error("Delete failed:", result.error);
                alert("Failed to delete batch: " + result.error + "\n\nCheck your permissions.");
                setLoading(false);
            }
        }
    };

    // Safe Date Helper for Display
    const formatDate = (dateStr) => {
        if (!dateStr) return 'TBA';
        try {
            // Handle Firestore Timestamp
            if (dateStr.toDate) return dateStr.toDate().toLocaleDateString();
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleDateString();
        } catch (e) {
            return 'Invalid Date';
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto min-h-screen bg-gray-50">
            {/* ... (Header remains same) */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Users className="w-8 h-8 text-indigo-600" /> Batch Management
                    </h1>
                    <p className="text-sm text-gray-500">Create batches and assign faculty.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setFormData({
                            name: '',
                            course: 'JEE_11',
                            startDate: '',
                            capacity: 60,
                            totalSeats: 60,
                            facultyPhotoUrl: '',
                            faculty: []
                        });
                        setShowModal(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow"
                >
                    <Plus className="w-4 h-4" /> Create New Batch
                </button>
            </div>

            {/* DIRECTOR FILTER */}
            {
                isDirector && (
                    <div className="flex justify-center mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-gray-200 inline-flex gap-1">
                            {['ALL', 'UN_COLLEGE', 'UN_NASHIK_RD', 'PRAYAS'].map(c => (
                                <button
                                    key={c}
                                    onClick={() => setViewCenter(c)}
                                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${viewCenter === c
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md transform scale-105'
                                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                        }`}
                                >
                                    {c === 'ALL' ? 'All Centers' : c.replace('UN_', '').replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* OVERVIEW HEADER */}
            {!loading && (() => {
                const filteredBatches = batches.filter(b => (!isDirector || viewCenter === 'ALL' || (b.centerId || "UN_COLLEGE").trim() === viewCenter));
                const totalStudentsAll = filteredBatches.reduce((sum, b) => sum + (enrollments[b.name] || 0), 0);
                const displayedStudents = selectedBatchStats === 'ALL' 
                    ? totalStudentsAll 
                    : (enrollments[selectedBatchStats] || 0);

                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {/* Card 1: Premium Active Batches */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl p-6 shadow-xl border border-gray-800 group">
                            {/* Decorative blur elements */}
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl transition-all group-hover:bg-indigo-500/30"></div>
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-600"></div>

                            <div className="relative z-10 flex items-start justify-between h-full">
                                <div className="flex flex-col justify-between h-full">
                                    <p className="text-gray-400 font-medium text-xs mb-2 uppercase tracking-widest">Active Batches</p>
                                    <div className="flex items-baseline gap-2">
                                        <h3 className="text-5xl font-black text-white tracking-tight">{filteredBatches.length}</h3>
                                        <span className="text-sm text-gray-500 font-medium">total</span>
                                    </div>
                                </div>
                                <div className="bg-white/5 p-3.5 rounded-2xl backdrop-blur-md border border-white/10 text-indigo-400 shadow-inner">
                                    <GraduationCap className="w-7 h-7" />
                                </div>
                            </div>
                        </div>
                        
                        {/* Card 2: Premium Student Enrollment with Dropdown */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl p-6 shadow-xl border border-gray-800 group">
                            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl transition-all group-hover:bg-emerald-500/20"></div>
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-600"></div>

                            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-gray-400 font-medium text-xs mb-2 uppercase tracking-widest">Student Enrollment</p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-5xl font-black text-white tracking-tight">{displayedStudents}</h3>
                                            <span className="text-sm text-gray-500 font-medium">enrolled</span>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 p-3.5 rounded-2xl backdrop-blur-md border border-white/10 text-emerald-400 shadow-inner">
                                        <TrendingUp className="w-7 h-7" />
                                    </div>
                                </div>
                                
                                <select 
                                    className="w-full bg-black/40 border border-gray-700/50 hover:border-gray-600 text-sm font-medium text-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
                                    value={selectedBatchStats}
                                    onChange={(e) => setSelectedBatchStats(e.target.value)}
                                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239CA3AF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundPosition: `right 12px center`, backgroundRepeat: `no-repeat`, backgroundSize: `16px` }}
                                >
                                    <option value="ALL">All Supported Batches</option>
                                    {filteredBatches.map(b => (
                                        <option key={b.id} value={b.name}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* BATCH GRID */}
            {
                loading ? <p>Loading Batches...</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.isArray(batches) && batches.filter(b => {
                            if (!isDirector) return true;
                            if (viewCenter === 'ALL') return true;
                            return (b.centerId || "UN_COLLEGE").trim() === viewCenter;
                        }).map(batch => {
                            // PREPARE FACULTY LIST SAFELY
                            let facultyList = [];
                            if (Array.isArray(batch.faculty)) {
                                facultyList = batch.faculty;
                            } else if (typeof batch.faculty === 'string') {
                                facultyList = [{ name: batch.faculty, subject: 'Physics' }];
                            } else if (batch.faculty && typeof batch.faculty === 'object') {
                                facultyList = [batch.faculty];
                            }

                            return (
                                <div key={batch?.id || Math.random()} onClick={() => navigate(`/staff/batches/${batch.id}`)} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer group">

                                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 border-b border-gray-100 flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-800 group-hover:text-indigo-600 transition">{batch.name || 'Unnamed Batch'}</h3>
                                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-white border text-gray-600">{batch.course || 'General'}</span>
                                        </div>
                                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={() => handleEdit(batch)} className="p-1.5 bg-white rounded hover:text-blue-600 border text-gray-400"><Edit className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(batch.id)} className="p-1.5 bg-white rounded hover:text-red-600 border text-gray-400"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-3">
                                        <div className="flex justify-between items-center text-sm text-gray-600">
                                            <span>Starts: <strong className="text-gray-800">{formatDate(batch.startDate)}</strong></span>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md font-bold text-xs ring-1 ring-emerald-200/50">
                                                    <Users className="w-3.5 h-3.5" />
                                                    {enrollments[batch.name] || 0} / {batch.totalSeats || batch.capacity || 0}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Faculty Section for Card */}
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Faculty Team</p>
                                            {facultyList.length > 0 ? (
                                                <div className="space-y-1">
                                                    {facultyList.map((fac, idx) => {
                                                        if (!fac) return null; // Skip nulls
                                                        const isObj = typeof fac === 'object';
                                                        return (
                                                            <div key={idx} className="flex justify-between text-sm">
                                                                <span className="text-gray-500">{isObj ? (fac.subject || 'Subject') : 'Faculty'}</span>
                                                                <span className="font-medium text-gray-800">{isObj ? (fac.name || 'Unknown') : fac}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : <p className="text-xs text-gray-400 italic">No faculty assigned.</p>}
                                        </div>

                                        {batch.facultyPhotoUrl && (
                                            <div className="mt-2 text-xs flex items-center gap-1 text-green-600">
                                                <ImageIcon className="w-3 h-3" /> Faculty Photo Linked
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* ... (Empty State) */}
                        {batches.length === 0 && (
                            <div className="col-span-full text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">
                                No batches found. Create one to get started.
                            </div>
                        )}
                    </div>
                )
            }

            {/* CREATE/EDIT MODAL */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100 flex flex-col">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Batch Details' : 'Create New Batch'}</h2>
                                    <p className="text-xs text-gray-500 mt-1">Manage batch schedule, capacity, and faculty assignments.</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-gray-400 hover:text-red-500" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-8 flex-1 overflow-y-auto">

                                {/* SECTION 1: BASIC DETAILS */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2">Batch Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch Name</label>
                                            <input
                                                required
                                                name="name"
                                                value={formData.name || ''}
                                                onChange={handleChange}
                                                placeholder="e.g. JEE Growth Batch 1"
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Course / Class</label>
                                            <select
                                                name="course"
                                                value={formData.course || 'JEE_11'}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 transition-all outline-none text-sm"
                                            >
                                                <option value="JEE_11">11th JEE (2 Year)</option>
                                                <option value="NEET_11">11th NEET (2 Year)</option>
                                                <option value="JEE_12">12th JEE (1 Year)</option>
                                                <option value="NEET_12">12th NEET (1 Year)</option>
                                                <option value="REPEATER_JEE">Repeater JEE (1 Year)</option>
                                                <option value="REPEATER_NEET">Repeater NEET (1 Year)</option>
                                                <option value="REPEATER_MHT_CET">Repeater MHT-CET (1 Year)</option>
                                                <option value="FOUNDATION_8">Class 8th Foundation</option>
                                                <option value="FOUNDATION_9">Class 9th Foundation</option>
                                                <option value="FOUNDATION_10">Class 10th Foundation</option>
                                                <option value="MHT_CET_11">11th MHT-CET (2 Year)</option>
                                                <option value="MHT_CET_12">12th MHT-CET (1 Year)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                                            <input
                                                required
                                                type="date"
                                                name="startDate"
                                                value={formData.startDate || ''}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Seats</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    name="totalSeats"
                                                    value={formData.totalSeats || 60}
                                                    onChange={handleChange}
                                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm pl-10"
                                                />
                                                <Users className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Remaining</label>
                                            <input
                                                type="number"
                                                name="capacity"
                                                value={formData.capacity ?? 0}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none text-sm font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 2: FACULTY TEAM */}
                                <div className="space-y-4 pt-2">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2">Faculty Team</h3>

                                    {/* Photo Upload */}
                                    <div className="flex items-start gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <div className="relative group shrink-0">
                                            {formData.facultyPhotoUrl ? (
                                                <div className="w-24 h-24 rounded-lg overflow-hidden shadow-sm border border-gray-200 relative">
                                                    <img src={formData.facultyPhotoUrl} alt="Team" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, facultyPhotoUrl: '' })}
                                                        className="absolute top-1 right-1 bg-white/90 p-1 rounded-full shadow-sm hover:text-red-600 transition"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 bg-white">
                                                    <ImageIcon className="w-8 h-8 opacity-50 mb-1" />
                                                    <span className="text-[10px] font-medium">No Photo</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-900 mb-1">Team Group Photo</label>
                                            <p className="text-xs text-gray-500 mb-3">Upload a group photo of the faculty members assigned to this batch.</p>

                                            <div className="flex items-center gap-3">
                                                <label className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm flex items-center gap-2">
                                                    <Upload className="w-4 h-4" />
                                                    {uploading ? 'Uploading...' : 'Choose Image'}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleImageUpload}
                                                        disabled={uploading}
                                                        className="hidden"
                                                    />
                                                </label>
                                                {uploading && <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />}
                                            </div>
                                            {debugStatus && <p className="text-[10px] text-indigo-600 mt-1">{debugStatus}</p>}
                                        </div>
                                    </div>

                                    {/* Faculty List */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-end">
                                            <label className="block text-sm font-medium text-gray-700">Assigned Members</label>
                                            <button
                                                type="button"
                                                onClick={addFacultyRow}
                                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Add Faculty
                                            </button>
                                        </div>

                                        <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100 min-h-[100px]">
                                            {formData.faculty.length === 0 && (
                                                <div className="text-center py-6 text-gray-400 text-sm italic">
                                                    No faculty members added yet. Click "Add Faculty" to start.
                                                </div>
                                            )}
                                            {formData.faculty.map((fac, idx) => (
                                                <div key={idx} className="flex gap-3 items-center group animate-in slide-in-from-left-2 duration-200">
                                                    <select
                                                        value={fac.subject || 'Physics'}
                                                        onChange={(e) => handleFacultyChange(idx, 'subject', e.target.value)}
                                                        className="w-1/3 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    >
                                                        {SUBJECTS.map(subj => <option key={subj}>{subj}</option>)}
                                                    </select>
                                                    <input
                                                        placeholder="Faculty Name"
                                                        value={fac.name || ''}
                                                        onChange={(e) => handleFacultyChange(idx, 'name', e.target.value)}
                                                        className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-800"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFacultyRow(idx)}
                                                        className="text-gray-400 hover:text-red-500 p-2 hover:bg-white rounded-lg transition opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* FOOTER */}
                                <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white border-t border-gray-100 mt-auto">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-5 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={uploading}
                                        className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition flex items-center gap-2 text-sm"
                                    >
                                        <Save className="w-4 h-4" />
                                        {editingId ? 'Save Changes' : 'Create Batch'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default BatchManager;
