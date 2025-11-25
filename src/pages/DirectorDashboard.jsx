import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { Search, FileText, UserCog, RefreshCw } from 'lucide-react';
import { generateTokenReceipt } from '../utils/pdfGenerator';
import StudentManager from '../components/StudentManager'; // Import the Modal

const DirectorDashboard = () => {
    const [admissions, setAdmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedStudent, setSelectedStudent] = useState(null); // Controls the Popup

    // Function to Fetch Data (Reusable for refreshing)
    const fetchData = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "admissions"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAdmissions(data);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
        setLoading(false);
    };

    // Fetch on mount
    useEffect(() => {
        fetchData();
    }, []);

    // Filter Logic
    const filteredData = admissions.filter(student =>
        student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.phone.includes(searchTerm)
    );

    return (
        <div className="max-w-7xl mx-auto p-4 min-h-screen bg-gray-50">

            {/* 1. Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Accounts Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage Student Fees & Receipts</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search Name or Phone..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 outline-none shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={fetchData}
                        className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 shadow-sm"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* 2. Main Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-xs tracking-wider">
                            <tr>
                                <th className="p-4 border-b">Date</th>
                                <th className="p-4 border-b">Student Name</th>
                                <th className="p-4 border-b">Center</th>
                                <th className="p-4 border-b">Course</th>
                                <th className="p-4 border-b">Paid Total</th>
                                <th className="p-4 border-b text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-500">Loading live data...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-400">No students found.</td></tr>
                            ) : filteredData.map((student) => (
                                <tr key={student.id} className="hover:bg-blue-50 transition duration-150">

                                    {/* Date */}
                                    <td className="p-4 whitespace-nowrap">
                                        {student.createdAt ? new Date(student.createdAt.seconds * 1000).toLocaleDateString("en-IN") : "-"}
                                    </td>

                                    {/* Name & Phone */}
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900">{student.studentName}</div>
                                        <div className="text-xs text-gray-500">{student.phone}</div>
                                    </td>

                                    {/* Center Badge */}
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${student.centerName?.includes("Prayas")
                                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                                : "bg-blue-50 text-blue-700 border-blue-200"
                                            }`}>
                                            {student.centerName?.includes("Prayas") ? "Prayas" : "Unacademy"}
                                        </span>
                                    </td>

                                    {/* Course */}
                                    <td className="p-4 max-w-xs truncate" title={student.program}>
                                        {student.program}
                                    </td>

                                    {/* Total Paid (Updates dynamically) */}
                                    <td className="p-4 font-mono font-bold text-green-700 text-base">
                                        ₹{(student.totalPaid || student.amount).toLocaleString()}
                                    </td>

                                    {/* Action Buttons */}
                                    <td className="p-4">
                                        <div className="flex justify-center gap-2">
                                            {/* Button 1: Download Initial Token Receipt */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); generateTokenReceipt(student); }}
                                                className="p-2 text-gray-500 hover:text-blue-700 hover:bg-blue-100 rounded-md transition"
                                                title="Download Token Receipt"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </button>

                                            {/* Button 2: MANAGE (Open Modal) */}
                                            <button
                                                onClick={() => setSelectedStudent(student)}
                                                className="flex items-center gap-1 bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition"
                                            >
                                                <UserCog className="w-3 h-3" /> Manage
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 3. STUDENT MANAGER POPUP (Modal) */}
            {selectedStudent && (
                <StudentManager
                    student={selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                    refreshData={fetchData}
                />
            )}

        </div>
    );
};

export default DirectorDashboard;
