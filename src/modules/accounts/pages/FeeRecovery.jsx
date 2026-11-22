import React, { useState, useEffect } from 'react';
import { getCachedAdmissions } from '../../../services/cacheService';
import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Tile, Count, Empty, Avatar, Contact, Seg } from '../../../components/j';
import { Money } from '../../../components/Money';
import { programLabel } from '../../j/data';
import { useFeeStructure } from '../../../hooks/useFeeStructure';
import { getEstimatedSchedule } from '../../../utils/calculations';

const FeeRecovery = ({ userProfile }) => {
    const { feeStructures } = useFeeStructure();
    const [defaulters, setDefaulters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showUpcomingOnly, setShowUpcomingOnly] = useState(true);
    const [viewCenter, setViewCenter] = useState('ALL');

    // Permisison Check
    const isDirector = userProfile?.role === 'DIRECTOR';
    const isManager = userProfile?.role === 'MANAGER';
    const userCenterId = userProfile?.centerId || "";

    useEffect(() => {
        if (feeStructures) fetchDefaulters();
    }, [feeStructures]);

    const fetchDefaulters = async () => {
        setLoading(true);
        try {
            // 1. Get all Active Admissions
            const targetCenterId = (isDirector || userProfile?.role === 'ACCOUNTANT') ? 'ALL' : userCenterId;
            const admissions = await getCachedAdmissions(targetCenterId, false, { allSessions: true });

            const list = [];

            // Helper to parse DD/MM/YYYY
            const parseDate = (dStr) => {
                if (!dStr) return null;
                const [d, m, y] = dStr.split('/');
                return new Date(`${y}-${m}-${d}`);
            };

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            admissions.forEach(data => {
                if (data.status !== 'ACTIVE' || data.refundAmount > 0 || data.status === 'REFUNDED') return;

                // 1b. Permission Filter (For Managers)
                if (isManager) {
                    // Check both ID and Name
                    const rCenter = (data.centerId || "").trim();
                    // We don't have center Name easily available in userProfile usually, but let's compare ID.
                    // If data.centerId is missing, allow? No, restrict.
                    // Assuming userProfile.centerId is set.
                    if (rCenter !== userCenterId) {
                        // Double check against name logic if needed, but for now strict ID + assumption.
                        // But wait, user had issues with ID mismatch.
                        // Let's rely on loose check if defined.
                        if (userCenterId && rCenter && rCenter !== userCenterId) return;
                    }
                }

                // 2. Calculate Balance Logic
                const totalPaid = data.totalPaid || 0;
                const totalFee = data.amount || 0;
                const balance = totalFee - totalPaid;

                if (balance > 0) {
                    // 3. Determine Next Due Date
                    let nextDue = { date: 'Check Portal', amount: balance, daysLeft: 999, isOverdue: false };

                    // PRIORITY 1: USE SAVED SCHEDULE (If exists)
                    let schedule = data.paymentSchedule || [];

                    // PRIORITY 2: USE ESTIMATED SCHEDULE (If no saved schedule)
                    // This ensures consistency with Student Manager
                    if (!schedule || schedule.length === 0) {
                        const admDate = data.enrollmentDate
                            ? new Date(data.enrollmentDate)
                            : (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : (data.createdAt ? new Date(data.createdAt) : new Date()));

                        // FIX: Detect if Registration Fee is unpaid (Low Payment)
                        // If paid < 2000 (approx Reg Fee), assume "Due Now"
                        // Or if paid < 5% of Total
                        const minThreshold = 2000;

                        if (totalPaid < minThreshold) {
                            // Force Immediate Due for Balance (or at least the Reg Fee gap)
                            // We synthesize a "Down Payment" schedule item
                            schedule = [{
                                id: 'Down Payment',
                                name: 'Admission / Registration Fee',
                                date: new Date().toISOString(), // Due Now
                                amount: (totalFee > 5000 ? 5000 : totalFee) - totalPaid, // Ask for ~5k or balance
                                paid: false
                            }];

                            // If balance is tiny, just ask for balance
                            if (balance < 5000) schedule[0].amount = balance;

                        } else {
                            // Standard Estimate (Smart Logic)
                            schedule = getEstimatedSchedule(totalFee, totalPaid, admDate, data.paymentPlan, data.program || data.batch, feeStructures);
                        }
                    }

                    if (schedule && schedule.length > 0) {
                        // Find first unpaid installment
                        let cumulative = 0;
                        let found = false;
                        for (let inst of schedule) {
                            // IF ESTIMATE: The schedule amounts ALREADY represent the balance (Total - Paid).
                            // So we do NOT subtract totalPaid again.
                            if (inst.isEstimate) {
                                if (!inst.paid) { // Check if we marked it paid locally or if it's just raw estimate
                                    const dDate = new Date(inst.date);
                                    const diffDays = Math.ceil((dDate - today) / (1000 * 60 * 60 * 24));

                                    nextDue = {
                                        date: (inst.name || `Installment`) + ` (${dDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`,
                                        amount: inst.amount,
                                        daysLeft: diffDays,
                                        isOverdue: diffDays < 0
                                    };
                                    found = true;
                                    break;
                                }
                            } else {
                                // IF REAL SAVED SCHEDULE: Logic is Cumulative Amount vs Total Paid
                                cumulative += Number(inst.amount || 0);
                                // effectivePaid handles the logic where totalPaid covers previous installments
                                // Tolerance of 100rs for minor calc diffs
                                if (cumulative > (totalPaid + 100)) {
                                    const targetDue = cumulative - totalPaid;

                                    let dDate;
                                    try {
                                        // Parse date flexibly
                                        const rawDate = inst.dueDate || inst.date;
                                        if (rawDate && rawDate.includes('/')) {
                                            dDate = parseDate(rawDate);
                                        } else {
                                            dDate = new Date(rawDate);
                                        }

                                        if (!dDate || isNaN(dDate.getTime())) dDate = today;
                                    } catch (e) {
                                        dDate = today;
                                    }

                                    const diffDays = Math.ceil((dDate - today) / (1000 * 60 * 60 * 24));
                                    nextDue = {
                                        date: (inst.name || `Installment ${inst.id || ''}`) + ` (${dDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`,
                                        amount: targetDue,
                                        daysLeft: diffDays,
                                        isOverdue: diffDays < 0
                                    };
                                    found = true;
                                    break;
                                }
                            }

                        } // End of checked block (Estimate vs Real)

                        if (!found && balance > 0) {
                            // All scheduled items paid but balance remains? (e.g. ad-hoc penalty or extra fee)
                            nextDue = { date: 'Immediate (Balance)', amount: balance, daysLeft: 0, isOverdue: true };
                        }
                    } else {
                        // Fallback if No Schedule at all
                        nextDue = { date: 'Immediate', amount: balance, daysLeft: 0, isOverdue: true };
                    }

                    list.push({ id: data.id, ...data, balance, nextDue });
                }
            });

            // Sort by Days Left (Overdue first)
            list.sort((a, b) => a.nextDue.daysLeft - b.nextDue.daysLeft);

            setDefaulters(list);
        } catch (error) {
            console.error("Error fetching dues:", error);
        }
        setLoading(false);
    };

    const sendWhatsApp = (student) => {
        const message = `Hello ${student.studentName}, this is a gentle reminder from Unacademy Nashik. Your next installment of *₹${student.nextDue.amount.toLocaleString()}* is due on ${student.nextDue.date}. (Total Outstanding: ₹${student.balance.toLocaleString()}). Please clear it to avoid late charges.`;
        const url = `https://wa.me/91${student.phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const exportToCSV = () => {
        if (filtered.length === 0) {
            alert("No data to export");
            return;
        }

        const headers = ["Student Name", "Phone", "Batch / Course", "Total Balance", "Next Due Date", "Next Due Amount", "Status", "Center ID"];
        
        const rows = filtered.map(s => [
            s.studentName,
            s.phone,
            s.batch || s.program || "N/A",
            s.balance,
            s.nextDue.date,
            s.nextDue.amount,
            s.nextDue.isOverdue ? "Overdue" : "Upcoming",
            s.centerId || "N/A"
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(e => e.map(item => `"${item}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Fee_Recovery_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filtered = defaulters.filter(s => {
        // 1. Text Search
        const matchesSearch = s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone.includes(searchTerm);

        // 2. Reminder Filter (User Request: "early 7 days")
        // Show if Overdue OR Due in next 7 days
        let matchesTime = true;
        if (showUpcomingOnly) {
            matchesTime = s.nextDue.daysLeft <= 7;
        }

        // 3. Center Filter (Director Only)
        let matchesCenter = true;
        if (isDirector && viewCenter !== 'ALL') {
            matchesCenter = (s.centerId || "").trim() === viewCenter;
        }

        return matchesSearch && matchesTime && matchesCenter;
    });

    const overdueRows = filtered.filter(s => s.nextDue.isOverdue);
    const sumDue = (rows) => rows.reduce((x, s) => x + s.nextDue.amount, 0);
    const dueText = (s) => (s.nextDue.isOverdue ? (s.nextDue.daysLeft < 0 ? `${-s.nextDue.daysLeft} days late` : 'Due now') : s.nextDue.daysLeft === 0 ? 'Due today' : `In ${s.nextDue.daysLeft} days`);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-[30px] sm:text-[34px] font-extrabold tracking-tight leading-tight">Fee recovery</h1>
                    <p className="text-[13.5px]" style={{ color: 'var(--muted)' }}>{loading ? 'Working out who owes what…' : `${filtered.length} students · ${showUpcomingOnly ? 'late or due in the next 7 days' : 'everyone with a balance'}`}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={exportToCSV} className="jb-act jb-act-soft"><Download className="w-4 h-4" /> Export</button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <Tile tone="coral" emoji="⏰" title="Late now" value={<Count value={overdueRows.length} />} sub={<Money value={sumDue(overdueRows)} />} size="sm" />
                <Tile tone="butter" emoji="📅" title="Coming up" value={<Count value={filtered.length - overdueRows.length} />} sub={<Money value={sumDue(filtered) - sumDue(overdueRows)} />} size="sm" delay={40} />
                <div className="hidden lg:block [&>*]:h-full"><Tile tone="sage" emoji="💰" title="Next parts in this list" value={<Money value={sumDue(filtered)} />} sub="what to collect" size="sm" delay={80} /></div>
            </div>

            <Card pad={16}>
                <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
                    <label className="flex items-center gap-2 flex-1 rounded-full px-4 h-[44px]" style={{ background: 'var(--cream)', boxShadow: '0 0 0 1px var(--line)' }}>
                        <span aria-hidden="true">🔎</span><span className="sr-only">Search students</span>
                        <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Name or phone" className="flex-1 min-w-0 outline-none text-[14px]" style={{ border: 0, boxShadow: 'none', background: 'transparent' }} />
                    </label>
                    <div className="flex flex-wrap gap-2 items-center">
                        <Seg size="sm" label="Show" value={showUpcomingOnly ? 'SOON' : 'ALL'} onChange={(v) => setShowUpcomingOnly(v === 'SOON')} options={[{ value: 'SOON', label: 'Late + next 7 days' }, { value: 'ALL', label: 'All balances' }]} />
                        {isDirector && (
                            <div className="max-w-full overflow-x-auto jb-scroll"><Seg size="sm" label="Centre" value={viewCenter} onChange={setViewCenter} options={[{ value: 'ALL', label: 'All centres' }, { value: 'UN_COLLEGE', label: 'College Road' }, { value: 'UN_NASHIK_RD', label: 'Nashik Road' }, { value: 'PRAYAS', label: 'Prayaas' }]} /></div>
                        )}
                    </div>
                </div>
            </Card>

            {loading ? (
                <div className="flex flex-col gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="j-sk h-[72px]" />)}</div>
            ) : filtered.length === 0 ? (
                <Card><Empty emoji="🎉">Nobody is late or due soon for this filter.</Empty></Card>
            ) : (
                <Card pad={8}>
                    <div className="hidden lg:grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1.6fr)_150px_240px] gap-3 px-4 py-2 text-[12px] font-bold" style={{ color: 'var(--muted)' }}>
                        <span>Student</span><span>Course</span><span>Next part</span><span className="text-right">Amount</span><span />
                    </div>
                    <ul className="flex flex-col">
                        {filtered.map((s, k) => (
                            <li key={s.id} className="jb-rise grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1.6fr)_150px_240px] gap-x-3 gap-y-2 items-center px-4 py-3 rounded-2xl"
                                style={{ borderTop: k ? '1px solid var(--track)' : 'none', animationDelay: `${Math.min(k, 8) * 30}ms` }}>
                                <Link to={`/staff/student/${s.id}`} state={{ tab: 'fees' }} className="flex items-center gap-3 min-w-0">
                                    <Avatar name={s.studentName} size={38} />
                                    <span className="min-w-0"><b className="block text-[14.5px] truncate">{s.studentName}</b>
                                        <span className="block text-[12px] truncate" style={{ color: 'var(--muted)' }}>{[s.phone, s.createdAt?.seconds ? `joined ${new Date(s.createdAt.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''].filter(Boolean).join(' · ')}</span></span>
                                </Link>
                                <span className="hidden lg:block text-[13px] font-semibold truncate">{programLabel(s.batch || s.program) || '—'}</span>
                                <span className="text-[12.5px] min-w-0 col-span-2 lg:col-span-1 order-3 lg:order-none">
                                    <span className="inline-block text-[11.5px] font-bold px-2.5 py-1 rounded-full mr-2" style={{ background: s.nextDue.isOverdue ? 'var(--t-coral)' : 'var(--t-butter)' }}>{dueText(s)}</span>
                                    <span style={{ color: 'var(--muted)' }}>{s.nextDue.date}</span>
                                </span>
                                <span className="text-right"><b className="block text-[15px]"><Money value={s.nextDue.amount} /></b><span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>of <Money value={s.balance} /> left</span></span>
                                <div className="hidden lg:flex justify-end gap-2">
                                    <Contact name={s.studentName} phone={s.parentPhone || s.phone} size="sm" />
                                    <button type="button" onClick={() => sendWhatsApp(s)} className="jb-act jb-act-soft !py-1.5 !text-[12.5px]">Send reminder</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </div>
    );
};

export default FeeRecovery;
