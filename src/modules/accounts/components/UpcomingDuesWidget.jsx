import React, { useEffect, useState } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { AlertCircle, Phone, Calendar, CheckCircle } from 'lucide-react';
import { getEstimatedSchedule } from '../../../utils/calculations';

import StudentRecoveryModal from './StudentRecoveryModal';

const UpcomingDuesWidget = ({ centerId, userProfile }) => {
    const [dueList, setDueList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState(null);

    useEffect(() => {
        const fetchDues = async () => {
            try {
                // 1. Get Active Students (With Security Filter)
                let q;
                if (centerId && centerId !== 'ALL') {
                    q = query(collection(db, "admissions"), where("status", "==", "ACTIVE"), where("centerId", "==", centerId));
                } else {
                    q = query(collection(db, "admissions"), where("status", "==", "ACTIVE"));
                }
                const snapshot = await getDocs(q);

                const list = [];
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const next7Days = new Date();
                next7Days.setDate(today.getDate() + 7);

                // Helper to parse DD/MM/YYYY
                const parseDate = (dStr) => {
                    if (!dStr) return null;
                    if (dStr.includes && dStr.includes('/')) {
                        const [d, m, y] = dStr.split('/');
                        return new Date(`${y}-${m}-${d}`);
                    }
                    const d = new Date(dStr);
                    return isNaN(d.getTime()) ? null : d;
                };

                snapshot.forEach(doc => {
                    const data = doc.data();

                    // 1. Permissive Center Matching (Keyword Based)
                    if (centerId && centerId !== 'ALL') {
                        const userCenter = centerId.toUpperCase().trim();
                        const sId = (data.centerId || "").toUpperCase().trim();
                        const sName = (data.centerName || "").toUpperCase().trim();

                        let isMatch = false;

                        if (userCenter.includes('COLLEGE')) {
                            // User is College Road. Match Student if College or Un_College
                            if (sId.includes('COLLEGE') || sName.includes('COLLEGE') || sId === 'UN_COLLEGE') isMatch = true;
                        } else if (userCenter.includes('NASHIK') || userCenter.includes('JAIL') || userCenter.includes('ROAD')) {
                            // User is Nashik Road.
                            if (sId.includes('NASHIK') || sName.includes('NASHIK') || sId === 'UN_NASHIK_RD') isMatch = true;
                        } else if (userCenter.includes('PRAYAS')) {
                            if (sId.includes('PRAYAS') || sName.includes('PRAYAS')) isMatch = true;
                        } else {
                            // Fallback Exact Match
                            if (sId === userCenter || sName === userCenter) isMatch = true;
                        }

                        if (!isMatch) return;
                    }

                    // 2. Calculate Balance Logic
                    const totalPaid = Number(data.totalPaid || 0);
                    const totalFee = Number(data.amount || 0);
                    const balance = totalFee - totalPaid;

                    if (balance > 100) {
                        // 3. Determine Next Due Date
                        let nextDue = null;

                        // PRIORITY 1: USE SAVED SCHEDULE (If exists)
                        let schedule = data.paymentSchedule || [];

                        // PRIORITY 2: USE ESTIMATED SCHEDULE
                        if (!schedule || schedule.length === 0) {
                            const admDate = data.enrollmentDate
                                ? new Date(data.enrollmentDate)
                                : (data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date());

                            schedule = getEstimatedSchedule(totalFee, totalPaid, admDate, data.paymentPlan, data.program || data.batch);
                        }

                        if (schedule && schedule.length > 0) {
                            // Find first unpaid installment
                            let cumulative = 0;

                            for (let inst of schedule) {
                                // IF ESTIMATE
                                if (inst.isEstimate) {
                                    const dDate = new Date(inst.date);

                                    // FILTER: Must be Next 7 Days OR Past (Overdue)
                                    if (dDate <= next7Days) {
                                        nextDue = {
                                            date: dDate,
                                            dateStr: dDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                                            amount: inst.amount,
                                            label: inst.name || "Installment"
                                        };
                                        break;
                                    }
                                } else {
                                    // IF REAL SAVED SCHEDULE
                                    cumulative += Number(inst.amount || 0);
                                    if (cumulative > (totalPaid + 100)) {
                                        let dDate = parseDate(inst.dueDate || inst.date);
                                        if (!dDate) dDate = today;

                                        if (dDate <= next7Days) {
                                            const targetDue = cumulative - totalPaid;
                                            nextDue = {
                                                date: dDate,
                                                dateStr: dDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                                                amount: targetDue,
                                                label: inst.name || `Installment ${inst.id || ''}`
                                            };
                                        }
                                        break;
                                    }
                                }
                            }
                        } else {
                            // No schedule, but balance exists -> Due Immediately
                            nextDue = {
                                date: new Date(0),
                                dateStr: 'Immediate',
                                amount: balance,
                                label: "Outstanding Balance"
                            };
                        }

                        if (nextDue) {
                            list.push({
                                id: doc.id,
                                name: data.studentName || data.name || "Student",
                                phone: data.phone || data.parentPhone,
                                amount: nextDue.amount,
                                dueDate: nextDue.dateStr,
                                rawDate: nextDue.date,
                                dueLabel: nextDue.label,
                                batch: data.batchName || "No Batch",
                                center: data.centerName
                            });
                        }
                    }
                });

                // Sort by Due Date (Oldest Due First - Urgency)
                list.sort((a, b) => a.rawDate - b.rawDate);

                setDueList(list);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching dues:", error);
                setLoading(false);
            }
        };
        fetchDues();
    }, [centerId]);

    if (loading) return <div className="p-4 text-xs text-slate-400">Scanning Schedules...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden h-full flex flex-col">
            <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex justify-between items-center">
                <h3 className="font-bold text-red-800 flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Dues <span className="opacity-70 text-xs font-normal">(Overdue + 7 Days)</span>
                </h3>
                <span className="text-[10px] bg-white px-2 py-1 rounded-full text-red-600 font-bold shadow-sm">
                    {dueList.length} Students
                </span>
            </div>

            <div className="overflow-y-auto flex-1 max-h-[300px] divide-y divide-red-50 custom-scrollbar">
                {dueList.map(item => (
                    <div
                        key={item.id}
                        onClick={() => setSelectedStudent(item)}
                        className="p-3 hover:bg-red-50/30 transition-colors group cursor-pointer active:bg-red-50"
                    >
                        <div className="flex justify-between items-start mb-1">
                            <p className="font-bold text-gray-800 text-sm truncate w-32">{item.name}</p>
                            <p className="font-bold text-red-600 text-sm whitespace-nowrap">
                                ₹{item.amount.toLocaleString()}
                            </p>
                        </div>

                        <div className="flex justify-between items-end">
                            <div className="text-xs text-gray-500 space-y-0.5">
                                <p className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" /> {item.phone}
                                </p>
                                <p className="flex items-center gap-1" title={item.dueDate}>
                                    <Calendar className="w-3 h-3" />
                                    <span className="text-red-600 font-bold truncate max-w-[120px]">
                                        {item.dueLabel}
                                    </span>
                                    <span className="text-gray-400 ml-1">({item.dueDate})</span>
                                </p>
                            </div>

                            <button
                                onClick={() => {
                                    const msg = `Namaste! Gentle reminder from Unacademy Nashik. Fee Installment of Rs.${item.amount.toLocaleString()} for ${item.name} is due/overdue (${item.dueDate}). Please pay at the center or via app.`;
                                    window.open(`https://wa.me/91${item.phone}?text=${encodeURIComponent(msg)}`, '_blank');
                                }}
                                className="bg-green-100 hover:bg-green-200 text-green-700 p-1.5 rounded-lg transition-colors"
                                title="Send WhatsApp Reminder"
                            >
                                <Phone className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                ))}

                {dueList.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <CheckCircle className="w-8 h-8 mb-2 text-green-200" />
                        <span className="text-xs">No payments due this week!</span>
                    </div>
                )}

            </div>

            {/* RECOVERY MODAL */}
            {selectedStudent && (
                <StudentRecoveryModal
                    student={selectedStudent}
                    userProfile={userProfile}
                    onClose={() => setSelectedStudent(null)}
                />
            )}
        </div>
    );
};

export default UpcomingDuesWidget;
