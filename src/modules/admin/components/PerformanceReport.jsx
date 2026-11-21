import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStaffPerformance, fetchBDEStats } from '../../../services/statsService';
import { Trophy, TrendingUp, Users, Briefcase } from 'lucide-react';

const PerformanceReport = ({ centerFilter }) => {
    const navigate = useNavigate();
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

    const handleCounsellorClick = (staff) => {
        if (staff.uid) {
            navigate('/staff/leads', { state: { filterCounsellorId: staff.uid } });
        } else {
            alert("This counsellor does not have a linked system ID.");
        }
    };

    return (
        <div className="kap-glass rounded-[18px] overflow-hidden">
            <div className="px-5 py-4 flex justify-between items-center border-b border-slate-100">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-[15px]">
                    <Trophy className="w-4 h-4 text-amber-500" /> Counsellor Leaderboard
                </h3>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                    {centerFilter === 'ALL' ? 'All Centers' : centerFilter}
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="text-slate-500 text-xs font-medium border-b border-slate-100">
                        <tr>
                            <th className="p-4">Rank</th>
                            <th className="p-4">Counsellor</th>
                            <th className="p-4 text-center">Leads worked</th>
                            <th className="p-4 text-center">Converted</th>
                            <th className="p-4 text-center">Refunded</th>
                            <th className="p-4 text-right">Conversion</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {report.map((staff, index) => (
                            <tr 
                                key={index} 
                                className="hover:bg-slate-50 transition cursor-pointer"
                                onClick={() => handleCounsellorClick(staff)}
                                title="Click to view CRM leads for this counsellor"
                            >
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
                                    <span className="font-bold text-blue-600">{staff.counselled}</span>
                                    <span className="text-gray-400 text-xs mx-1">/</span>
                                    <span className="text-gray-500 text-xs">{staff.leads}</span>
                                </td>
                                <td className="p-4 text-center font-semibold text-emerald-600">
                                    {staff.converted}
                                </td>
                                <td className="p-4 text-center font-semibold text-rose-600">
                                    {staff.refunded || 0}
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
                            <tr><td colSpan="6" className="p-8 text-center text-gray-400">No performance data found yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* BDE REPORT SECTION */}
            <div className="px-5 py-4 flex justify-between items-center border-y border-slate-100 mt-6">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-[15px]">
                    <Briefcase className="w-4 h-4 text-slate-400" aria-hidden="true" /> BDE / marketing performance
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="text-slate-500 text-xs font-medium border-b border-slate-100">
                        <tr>
                            <th className="p-4">Rank</th>
                            <th className="p-4">BDE Name</th>
                            <th className="p-4 text-center">Leads Generated</th>
                            <th className="p-4 text-center">Visits</th>
                            <th className="p-4 text-center">Converted</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
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
                                <td className="p-4 text-center text-purple-600 font-bold bg-purple-50 rounded">
                                    {bde.visits}
                                </td>
                                <td className="p-4 text-center font-semibold text-emerald-600">
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
