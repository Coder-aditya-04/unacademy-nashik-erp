import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../../firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore'; // Added updateDoc
import { ArrowLeft, Users, Calendar, BookOpen, Clock, Phone, Download } from 'lucide-react';
import { exportToCSV } from '../../../utils/exportUtils';
import StudentAcademicProfile from '../../../components/StudentAcademicProfile';

const BatchDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [batch, setBatch] = useState(null);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState(null);

    useEffect(() => {
        const fetchBatchData = async () => {
            try {
                // 1. Fetch Batch Info
                const batchRef = doc(db, "batches", id);
                const batchSnap = await getDoc(batchRef);

                if (batchSnap.exists()) {
                    setBatch({ id: batchSnap.id, ...batchSnap.data() });

                    // 2. Fetch Students in this Batch
                    // Query by 'batchAssigned' (Name) to match StudentManager logic
                    const q = query(
                        collection(db, "admissions"),
                        where("batchAssigned", "==", batchSnap.data().name)
                    );
                    const querySnapshot = await getDocs(q);
                    const studentList = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setStudents(studentList);
                } else {
                    alert("Batch not found!");
                    navigate('/staff/batches');
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            }
            setLoading(false);
        };

        fetchBatchData();
    }, [id, navigate]);

    const handleExport = () => {
        if (students.length === 0) return alert("No students to export.");

        const data = students.map(s => ({
            "Roll Number": s.rollNumber || 'N/A',
            "Name": s.studentName,
            "Phone": s.phone,
            "Parent Phone": s.parentPhone,
            "Program": s.program,
            "Batch": s.batchAssigned || batch?.name,
            "Admission Date": new Date(s.createdAt?.seconds * 1000).toLocaleDateString()
        }));

        exportToCSV(data, `${batch?.name}_Students`);
    };

    const handleChangeBatch = async () => {
        if (!selectedStudent) return;
        const newBatchName = prompt(`Enter new batch name for ${selectedStudent.studentName}:`, selectedStudent.batchAssigned || batch?.name);

        if (newBatchName && newBatchName !== selectedStudent.batchAssigned) {
            try {
                const docRef = doc(db, "admissions", selectedStudent.id);
                await updateDoc(docRef, {
                    batchAssigned: newBatchName,
                    batchId: null // Reset Linked Batch ID since we are manually overriding text (simplification)
                });

                // Update Local State
                setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, batchAssigned: newBatchName } : s));
                setSelectedStudent(prev => ({ ...prev, batchAssigned: newBatchName }));

                alert("Batch Updated Successfully!");
            } catch (err) {
                console.error("Batch Update Error:", err);
                alert("Failed to update batch.");
            }
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-500">Loading Batch Details...</div>;
    if (!batch) return null;

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">

            {/* Header / Back */}
            <button onClick={() => navigate('/staff/batches')} className="flex items-center text-slate-500 hover:text-indigo-600 font-bold text-sm mb-4">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Batch Manager
            </button>

            {/* Batch Hero Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-8 text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
                                {batch.course}
                            </span>
                            <h1 className="text-3xl font-bold mb-2">{batch.name}</h1>
                            <div className="flex items-center gap-6 text-indigo-100 text-sm font-medium mt-4">
                                <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Starts: {batch.startDate}</div>
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    {/* Dynamic Calculation: Total - Enrolled (Live) */}
                                    {(batch.totalSeats || batch.capacity || 60) - students.length} Seats Remaining
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm text-center min-w-[120px]">
                            <p className="text-3xl font-bold">{students.length}</p>
                            <p className="text-xs text-indigo-200 uppercase tracking-wide">Enrolled</p>
                        </div>
                    </div>
                </div>

                {/* Faculty Strip */}
                <div className="bg-slate-50 px-8 py-4 border-b border-gray-100 flex items-center gap-6 overflow-x-auto">
                    <span className="text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Faculty Team:</span>
                    {batch.faculty && batch.faculty.map((fac, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm min-w-max">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                {fac.name.charAt(0)}
                            </div>
                            <div className="text-xs">
                                <span className="font-bold text-slate-700">{fac.name}</span>
                                <span className="text-slate-400 ml-1">({fac.subject})</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Students List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-600" /> Enrolled Students ({students.length})
                    </h3>
                    <button onClick={handleExport} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 font-bold border px-3 py-1.5 rounded-lg hover:border-indigo-200 transition">
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b">
                            <tr>
                                <th className="px-6 py-3">Roll No</th>
                                <th className="px-6 py-3">Student Name</th>
                                <th className="px-6 py-3">Phone</th>
                                <th className="px-6 py-3">Admission Date</th>
                                <th className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {students.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-400 italic">No students enrolled in this batch yet.</td>
                                </tr>
                            ) : (
                                students.map(std => (
                                    <tr key={std.id} className="hover:bg-indigo-50/50 transition cursor-pointer" onClick={() => setSelectedStudent(std)}>
                                        <td className="px-6 py-4 font-mono font-bold text-slate-500">{std.rollNumber || 'PENDING'}</td>
                                        <td className="px-6 py-4 font-bold text-slate-800">{std.studentName}</td>
                                        <td className="px-6 py-4">{std.phone}</td>
                                        <td className="px-6 py-4">{new Date(std.admissionDate).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">
                                            <button className="text-indigo-600 hover:text-indigo-800 font-bold text-xs">View Profile</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Student Detail Modal */}
            {selectedStudent && (
                <StudentAcademicProfile
                    student={selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                    onUpdate={(updatedStudent) => {
                        // Update Local State for the List
                        setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
                        setSelectedStudent(updatedStudent);
                    }}
                />
            )}
        </div>
    );
};

export default BatchDetails;
