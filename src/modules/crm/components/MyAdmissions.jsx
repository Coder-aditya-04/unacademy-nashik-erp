import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchMyAdmissions } from '../../../services/leadService';
import { Card, Tile, Count, Empty, Avatar, Contact, Seg } from '../../../components/j';
import { Money } from '../../../components/Money';
import { phoneOf, programLabel } from '../../j/data';
import { useFeeStructure } from '../../../hooks/useFeeStructure'; // Import Hook
import { calculateInstallments } from '../../../utils/calculations'; // Import Logic

const MyAdmissions = ({ userProfile }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { feeStructures } = useFeeStructure(); // Get Fee Data
    const [admissions, setAdmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [periodFilter, setPeriodFilter] = useState("ALL TIME"); // Default to All Time
    const [filterYear, setFilterYear] = useState(new Date().getFullYear()); // Default to Current Year

    useEffect(() => {
        loadData();
    }, [userProfile]);

    // From the counsellor home: open that student's fee plan in the profile.
    useEffect(() => {
        if (location.state?.openAdmissionId) navigate(`/staff/student/${location.state.openAdmissionId}`, { replace: true, state: { tab: 'fees' } });
    }, [location.state, navigate]);

    const loadData = async () => {
        setLoading(true);
        const data = await fetchMyAdmissions(userProfile);
        setAdmissions(data);
        setLoading(false);
    };

    const filteredAdmissions = admissions.filter(adm => {
        // 1. Search Query
        const matchesSearch = (adm.studentName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(adm.phone || "").includes(searchTerm);

        // 2. Period Filter
        let matchesPeriod = true;
        if (periodFilter !== "ALL TIME") {
            // Use admissionDate (preferred) or createdAt
            const rawDate = adm.admissionDate ? new Date(adm.admissionDate) : (adm.createdAt?.seconds ? new Date(adm.createdAt.seconds * 1000) : new Date());
            const month = rawDate.getMonth(); // 0-11
            const year = rawDate.getFullYear();
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            if (periodFilter === "THIS MONTH") {
                matchesPeriod = (month === currentMonth && year === currentYear);
            } else if (periodFilter === "LAST MONTH") {
                const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                matchesPeriod = (month === lastMonthDate.getMonth() && year === lastMonthDate.getFullYear());
            } else {
                // Specific Months (JAN ... DEC)
                const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                const targetMonthIndex = monthNames.indexOf(periodFilter);
                if (targetMonthIndex !== -1) {
                    // Use explicitly selected Year
                    matchesPeriod = (month === targetMonthIndex && year === parseInt(filterYear));
                }
            }
        }

        return matchesSearch && matchesPeriod;
    });

    // Helper: Normalize
    

    const getRealSchedule = (adm) => {
        const total = adm.amount || 0;
        const paid = adm.totalPaid || 0;
        const balance = (adm.status === 'REFUNDED' || adm.refundAmount > 0) ? 0 : (total - paid);
        if (balance <= 0) return []; // If fully paid or refunded, no schedule needed

        // Determine Start Date (Priority: Enrollment > Created > Today)
        let startDate = new Date();
        if (adm.enrollmentDate) {
            startDate = new Date(adm.enrollmentDate);
        } else if (adm.createdAt) {
            startDate = new Date(adm.createdAt.seconds * 1000);
        }

        // Use Centralized Logic
        // calculateInstallments(landingFee, programKey, paymentPlan, programsData, startDate)
        let baseSchedule = calculateInstallments(
            total,
            adm.program,
            adm.paymentPlan,
            feeStructures,
            startDate
        );

        // FALLBACK: If strict calculation fails (e.g. missing fee structure key), use Legacy Estimation
        if (!baseSchedule || baseSchedule.length === 0) {
            const programName = adm.program || "";
            // Heuristic check for 2 Year program based on key naming conventions
            const isTwoYear = (programName.includes("2Y") || programName.includes("11th") || programName.includes("8th") || programName.includes("9th"));

            let targetPercents = [0.60, 0.40];
            let dateOffsets = [0, 90]; // 3 Months (Standard) or 1 Month + Interval

            if (isTwoYear) {
                targetPercents = [0.50, 0.25, 0.25];
                dateOffsets = [0, 90, 180]; // 0, 3mo, 6mo (approx)
            }

            // Calculate Amounts
            let targets = targetPercents.map((p, i) => {
                if (i === targetPercents.length - 1) return 0;
                return Math.round(total * p);
            });
            const sumSoFar = targets.reduce((a, b) => a + b, 0);
            targets[targets.length - 1] = total - sumSoFar;

            baseSchedule = targets.map((targetAmount, idx) => {
                const dueDate = new Date(startDate);
                dueDate.setDate(dueDate.getDate() + dateOffsets[idx]); // Crude offset

                // Better Offset Logic matching Accounts
                // 1st inst: +1 month? Accounts says "Upon Admission" for first mostly?
                // Let's stick to the "dateOffsets" logic which was working visually for user before

                return {
                    id: `${idx + 1}${idx === 0 ? 'st' : idx === 1 ? 'nd' : 'rd'} Installment`,
                    amount: targetAmount,
                    dueDate: dueDate.toLocaleDateString('en-IN'),
                    status: "Future"
                };
            });
        }

        if (!baseSchedule || baseSchedule.length === 0) return [];

        // Apply "Burn Down" Logic to mark Paid vs Due
        // We simulate paying off the schedule from top to bottom
        let remainingPaid = paid;
        const finalSchedule = baseSchedule.map(inst => {
            let amountDue = inst.amount;
            let isItemPaid = false;

            if (remainingPaid >= amountDue) {
                remainingPaid -= amountDue;
                amountDue = 0;
                isItemPaid = true;
            } else {
                amountDue -= remainingPaid;
                remainingPaid = 0; // Exhausted paid amount
                isItemPaid = false;
            }

            return {
                ...inst,
                isPaid: isItemPaid,
                // If partially paid, we might want to show original amount but mark status? 
                // The UI expects 'amount' to be displayed. 
                // If I return the full amount but `isPaid=true`, it shows correctly.
            };
        });

        return finalSchedule;
    };

    const isRefunded = (a) => a.status === 'REFUNDED' || Number(a.refundAmount) > 0;
    const rows = filteredAdmissions.map(adm => {
        const fee = Number(adm.amount) || 0;
        const paid = Number(adm.totalPaid) || 0;
        const due = isRefunded(adm) ? 0 : Math.max(0, fee - paid);
        const pct = fee > 0 ? Math.min(100, Math.round((paid / fee) * 100)) : 0;
        const next = due > 0 ? getRealSchedule(adm).find(i => !i.isPaid) : null;
        const ms = adm.createdAt?.seconds ? adm.createdAt.seconds * 1000 : (adm.admissionDate ? new Date(adm.admissionDate).getTime() : null);
        return { adm, fee, paid, due, pct, next, ms };
    });
    const totals = rows.reduce((t, r) => ({ paid: t.paid + r.paid, due: t.due + r.due, clear: t.clear + (r.due === 0 && !isRefunded(r.adm) ? 1 : 0) }), { paid: 0, due: 0, clear: 0 });
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthPicked = MONTHS.includes(periodFilter);
    const periodName = periodFilter === 'ALL TIME' ? 'all time' : periodFilter === 'THIS MONTH' ? 'this month' : periodFilter === 'LAST MONTH' ? 'last month' : `${periodFilter.charAt(0)}${periodFilter.slice(1).toLowerCase()} ${filterYear}`;
    const sel = 'jb-input !w-auto !py-2 !rounded-full text-[13px] font-semibold';
    const chip = (r) => {
        if (isRefunded(r.adm)) return { text: 'Refunded', bg: 'var(--t-coral)' };
        if (r.due === 0) return { text: '🎉 Fees cleared', bg: 'var(--t-sage)' };
        return { text: `${r.pct}% paid`, bg: 'var(--t-butter)' };
    };
    const open = (adm) => navigate(`/staff/student/${adm.id}`, { state: { tab: 'fees' } });
    const nice = (d) => d || '';

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-[30px] sm:text-[34px] font-extrabold tracking-tight leading-tight">My admissions</h1>
                    <p className="text-[13.5px]" style={{ color: 'var(--muted)' }}>{loading ? 'Loading…' : `${rows.length} admissions by you · ${periodName} · tap one for the fee plan`}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Seg size="sm" label="Period" value={monthPicked ? 'MONTH' : periodFilter} onChange={(v) => setPeriodFilter(v === 'MONTH' ? MONTHS[new Date().getMonth()] : v)}
                        options={[{ value: 'ALL TIME', label: 'All time' }, { value: 'THIS MONTH', label: 'This month' }, { value: 'LAST MONTH', label: 'Last month' }, { value: 'MONTH', label: 'Pick month' }]} />
                    {monthPicked && (
                        <>
                            <select aria-label="Month" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} className={sel}>
                                {MONTHS.map((m, i) => <option key={m} value={m}>{new Date(2026, i, 1).toLocaleDateString('en-IN', { month: 'long' })}</option>)}
                            </select>
                            <select aria-label="Year" value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value, 10))} className={sel}>
                                {[0, 1, 2, 3].map(k => new Date().getFullYear() + 1 - k).map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 jb-rise">
                <Tile tone="lilac" emoji="🏆" title="Admissions" value={<Count value={rows.length} />} sub={periodName} size="sm" />
                <Tile tone="sage" emoji="💰" title="Collected" value={<Money value={totals.paid} />} sub="from your students" size="sm" delay={40} />
                <Tile tone="coral" emoji="⏳" title="Still to pay" value={<Money value={totals.due} />} sub="follow up on these" size="sm" delay={80} />
                <Tile tone="blue" emoji="🎉" title="Fees cleared" value={<Count value={totals.clear} />} sub="fully paid" size="sm" delay={120} />
            </div>

            <Card pad={16}>
                <label className="flex items-center gap-2 rounded-full px-4 h-[44px]" style={{ background: 'var(--cream)', boxShadow: '0 0 0 1px var(--line)' }}>
                    <span aria-hidden="true">🔎</span>
                    <span className="sr-only">Search my admissions</span>
                    <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Student name or phone"
                        className="flex-1 min-w-0 outline-none text-[14px]" style={{ border: 0, boxShadow: 'none', background: 'transparent' }} />
                </label>
            </Card>

            {loading ? (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map(i => <div key={i} className="j-sk h-[220px]" />)}</div>
            ) : rows.length === 0 ? (
                <Card><Empty emoji="🔍">{admissions.length ? 'No admissions match this search or period.' : 'Your admissions show here once you send one.'}</Empty></Card>
            ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {rows.map((r, i) => {
                        const c = chip(r);
                        return (
                            <div key={r.adm.id} role="link" tabIndex={0} onClick={() => open(r.adm)} onKeyDown={(e) => { if (e.key === 'Enter') open(r.adm); }}
                                className="jb-card jb-rise jb-lift cursor-pointer flex flex-col gap-3.5" style={{ padding: 18, animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                                <div className="flex items-center gap-3">
                                    <Avatar name={r.adm.studentName} size={42} />
                                    <div className="flex-1 min-w-0">
                                        <b className="block text-[15.5px] truncate">{r.adm.studentName || 'No name'}</b>
                                        <span className="block text-[12px] truncate" style={{ color: 'var(--muted)' }}>{[programLabel(r.adm.program) || 'Course not set', r.ms ? new Date(r.ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · ')}</span>
                                    </div>
                                    <span className="text-[11.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: c.bg }}>{c.text}</span>
                                </div>
                                <div>
                                    <div className="h-[8px] rounded-full overflow-hidden" style={{ background: 'var(--track)' }}>
                                        <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: 'var(--ok)', transition: 'width .9s cubic-bezier(.22,1,.36,1)' }} />
                                    </div>
                                    <div className="flex justify-between mt-2 text-[12px]" style={{ color: 'var(--muted)' }}>
                                        <span>Paid <b style={{ color: 'var(--ink)' }}><Money value={r.paid} /></b></span>
                                        <span>To pay <b style={{ color: 'var(--ink)' }}><Money value={r.due} /></b></span>
                                    </div>
                                </div>
                                {r.next ? (
                                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl" style={{ background: 'var(--nextbg, var(--cream))' }}>
                                        <span aria-hidden="true">⏰</span>
                                        <span className="flex-1 text-[13px]"><b>Next part <Money value={r.next.amount} /></b><span style={{ color: 'var(--muted)' }}> · by {nice(r.next.dueDate)}</span></span>
                                    </div>
                                ) : <div className="h-[2px]" />}
                                <div className="flex items-center justify-between gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
                                    <Contact name={r.adm.studentName} phone={phoneOf(r.adm)} size="sm" message={`Namaste, this is Unacademy Nashik about ${r.adm.studentName}.`} />
                                    <button type="button" onClick={() => open(r.adm)} className="jb-act jb-act-soft !text-[12.5px]">Fee plan ›</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MyAdmissions;
