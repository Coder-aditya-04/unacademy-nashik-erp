import React, { useEffect, useState } from 'react';
import { fetchStaffPerformance, fetchBDEStats } from '../../../services/statsService';
import { Trophy, TrendingUp, Users, Briefcase } from 'lucide-react';

const PerformanceReport = ({ centerFilter }) => {
    const [report, setReport] = useState([]);
    const [bdeReport, setBdeReport] = useState([]); // NEW STATE
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            // Parallel Fetch
            const [staffData, bdeData] = await Promise.all([
                fetchStaffPerformance(centerFilter),
                fetchBDEStats(centerFilter)
            ]);
            setReport(staffData);
            setBdeReport(bdeData);
            setLoading(false);
        };
        loadData();
    }, [centerFilter]);

    if (loading) return <div className="p-6 text-center text-gray-400">Analyzing performance...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-4 flex justify-between items-center text-white">
                <h3 className="font-bold flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" /> Counsellor Leaderboard
                </h3>
                <span className="text-xs bg-gray-700 px-2 py-1 rounded border border-gray-600">
                    {centerFilter === 'ALL' ? 'All Centers' : centerFilter}
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold">
                        <tr>
                            <th className="p-4">Rank</th>
                            <th className="p-4">Counsellor Name</th>
                            <th className="p-4 text-center">Leads Assigned</th>
                            <th className="p-4 text-center">Converted</th>
                            <th className="p-4 text-right">Conversion Rate</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {report.map((staff, index) => (
                            <tr key={index} className="hover:bg-blue-50 transition">
                                <td className="p-4">
                                    {index === 0 ? (
                                        <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold border border-yellow-200">
                                            #1 🏆
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 font-mono">#{index + 1}</span>
                                    )}
                                </td>
                                <td className="p-4 font-bold text-gray-800 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                                        {staff.name.charAt(0)}
                                    </div>
                                    {staff.name}
                                </td>
                                <td className="p-4 text-center text-gray-600">
                                    {staff.leads}
                                </td>
                                <td className="p-4 text-center font-bold text-green-600 bg-green-50 rounded">
                                    {staff.converted}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <span className={`font-bold ${staff.conversionRate > 20 ? 'text-green-600' : 'text-orange-500'}`}>
                                            {staff.conversionRate}%
                                        </span>
                                        {staff.conversionRate > 0 && <TrendingUp className="w-4 h-4 text-gray-400" />}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {report.length === 0 && (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-400">No performance data found yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* BDE REPORT SECTION */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 px-6 py-4 flex justify-between items-center text-white mt-8">
                <h3 className="font-bold flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-purple-200" /> BDE / Marketing Performance
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold">
                        <tr>
                            <th className="p-4">Rank</th>
                            <th className="p-4">BDE Name</th>
                            <th className="p-4 text-center">Leads Generated</th>
                            <th className="p-4 text-center">Converted</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {bdeReport.map((bde, index) => (
                            <tr key={index} className="hover:bg-purple-50 transition">
                                <td className="p-4">
                                    <span className="text-gray-400 font-mono">#{index + 1}</span>
                                </td>
                                <td className="p-4 font-bold text-gray-800">
                                    {bde.name}
                                </td>
                                <td className="p-4 text-center text-blue-600 font-bold">
                                    {bde.leadsGenerated}
                                </td>
                                <td className="p-4 text-center font-bold text-green-600 bg-green-50 rounded">
                                    {bde.converted}
                                </td>
                            </tr>
                        ))}
                        {bdeReport.length === 0 && (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-400">No BDE activity recorded yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PerformanceReport;
