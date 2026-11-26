import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, Tile, Count, Empty, Avatar, Contact } from '../components/j';
import { Money } from '../components/Money';
import { balanceOf, phoneOf, programLabel } from '../modules/j/data';
import { exportToCSV, formatAdmissionsForExport } from '../utils/exportUtils';
import { fetchBatches } from '../services/batchService';
import { subscribeAdmissions } from '../services/cacheService';

const StudentRecords = ({ center, isManager, userProfile }) => {
    const navigate = useNavigate();
    const [admissions, setAdmissions] = useState([]);
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewCenter, setViewCenter] = useState(isManager ? (center?.id || 'UN_COLLEGE') : 'ALL');
    const [filterBatch, setFilterBatch] = useState("ALL");
    const [lastSynced, setLastSynced] = useState(null);

    // Filters
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    useEffect(() => {
        setLoading(true);
        const currentViewCenter = isManager ? (center?.id || viewCenter) : viewCenter;

        // Fetch batches once initially
        fetchBatches().then(fetchedBatches => {
            const centerBatches = fetchedBatches.filter(b => currentViewCenter === 'ALL' || (b.centerId || "UN_COLLEGE").trim() === currentViewCenter);
            setBatches(centerBatches);
        }).catch(err => console.error("Error fetching batches:", err));

        // Subscribe to Admissions
        const unsubAdmissions = subscribeAdmissions(currentViewCenter, (allData) => {
            setLastSynced(new Date());

            // 1. FILTER BY CENTER
            let filtered = allData;
            if (currentViewCenter !== 'ALL') {
                filtered = allData.filter(txn => {
                    const txnCenterId = (txn.centerId || "").trim().toUpperCase();
                    const txnCenterName = (txn.centerName || "").trim().toUpperCase();
                    const viewId = (currentViewCenter || "").trim().toUpperCase();

                    if (txnCenterId === viewId) return true;
                    if (viewId === 'UN_COLLEGE') {
                        return (txnCenterId === "" && !txnCenterName.includes("NASHIK RD") && !txnCenterName.includes("PRAYAS")) ||
                            txnCenterId.includes("COLLEGE") ||
                            txnCenterName.includes("COLLEGE");
                    }
                    if (viewId === 'UN_NASHIK_RD') {
                        return txnCenterId.includes("NASHIK RD") || txnCenterName.includes("NASHIK RD") || txnCenterName.includes("NASHIK ROAD");
                    }
                    if (viewId === 'PRAYAS') {
                        return txnCenterId.includes("PRAYAS") || txnCenterName.includes("PRAYAS");
                    }
                    const viewName = (center?.name || "").trim().toUpperCase();
                    if (viewName && txnCenterName && txnCenterName.includes(viewName)) return true;
                    return false;
                });
            }

            // 2. Filter by Active Status
            const activeData = filtered.filter(txn => ['ACTIVE', 'TOKEN_PAID', 'COMPLETED', 'REFUNDED'].includes(txn.status) || txn.refundAmount > 0);

            setAdmissions(activeData);
            setLoading(false);
        });

        return () => {
            unsubAdmissions();
        };
    }, [viewCenter, center, isManager]);

    // Client-side Filtering
    const filteredData = admissions.filter(student => {
        const matchesSearch = (student.studentName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (student.phone || "").includes(searchTerm);

        // Date Filter
        let matchesDate = true;
        if (startDate || endDate) {
            let recordDate = "";
            if (student.createdAt?.seconds) {
                recordDate = new Date(student.createdAt.seconds * 1000).toLocaleDateString('en-CA');
            } else if (typeof student.createdAt === 'string') {
                recordDate = student.createdAt.split('T')[0]; // Simple string check
            }

            if (recordDate) {
                if (startDate && recordDate < startDate) matchesDate = false;
                if (endDate && recordDate > endDate) matchesDate = false;
            }
        }

        // Batch Filter
        let matchesBatch = true;
        if (filterBatch !== "ALL") {
            const studentBatch = (student.batchAssigned || "").trim();
            if (filterBatch === "UNASSIGNED") {
                matchesBatch = !studentBatch; // Matches null, undefined, or empty string
            } else if (filterBatch === "INVALID") {
                // Has a batch name, but it doesn't match any of the active fetched batches
                matchesBatch = !!studentBatch && !batches.some(b => b.name === studentBatch);
            } else {
                matchesBatch = studentBatch === filterBatch;
            }
        }

        return matchesSearch && matchesDate && matchesBatch;
    });

    const renderDate = (dateVal) => {
        if (!dateVal) return "-";
        try {
            if (dateVal.seconds) return new Date(dateVal.seconds * 1000).toLocaleDateString("en-IN");
            if (dateVal instanceof Date) return dateVal.toLocaleDateString("en-IN");
            return new Date(dateVal).toLocaleDateString("en-IN");
        } catch (e) { return "-"; }
    };

    const isRefunded = (s) => s.status === 'REFUNDED' || Number(s.refundAmount) > 0;
    const dueOf = (s) => (isRefunded(s) ? 0 : balanceOf(s));
    const totals = filteredData.reduce((t, s) => ({ paid: t.paid + (Number(s.totalPaid) || 0), due: t.due + dueOf(s) }), { paid: 0, due: 0 });
    const open = (s) => navigate(`/staff/student/${s.id}`);
    const chip = (s) => {
        if (isRefunded(s)) return { text: 'Refunded', bg: 'var(--t-coral)' };
        if (!s.batchAssigned) return { text: 'No batch yet', bg: 'var(--t-butter)' };
        if (dueOf(s) === 0) return { text: 'Fees cleared', bg: 'var(--t-sage)' };
        return { text: `₹${dueOf(s).toLocaleString('en-IN')} to pay`, bg: 'var(--t-blue)' };
    };
    const sel = 'jb-input !w-auto !py-2 !rounded-full text-[13px] font-semibold';

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-[30px] sm:text-[34px] font-extrabold tracking-tight leading-tight">Students</h1>
                    <p className="text-[13.5px]" style={{ color: 'var(--muted)' }}>{loading ? 'Loading…' : `${filteredData.length} students · tap one to open the profile`}{lastSynced ? ` · live` : ''}</p>
                </div>
                <button type="button" onClick={() => exportToCSV(formatAdmissionsForExport(filteredData), 'student_records')}
                    className="inline-flex items-center gap-2 h-[42px] px-4 rounded-full text-[13.5px] font-bold" style={{ background: 'var(--ink)', color: 'var(--on-ink)' }}>
                    <Download className="w-4 h-4" /> Export ({filteredData.length})
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 jb-rise">
                <div className="hidden sm:block [&>*]:h-full"><Tile tone="lilac" emoji="🎓" title="Students" value={<Count value={filteredData.length} />} size="sm" /></div>
                <Tile tone="sage" emoji="💰" title="Paid so far" value={<Money value={totals.paid} />} size="sm" />
                <Tile tone="coral" emoji="⏳" title="Still to pay" value={<Money value={totals.due} />} size="sm" />
            </div>

            <Card pad={16}>
                <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
                    <label className="flex items-center gap-2 flex-1 rounded-full px-4 h-[44px]" style={{ background: 'var(--cream)', boxShadow: '0 0 0 1px var(--line)' }}>
                        <span aria-hidden="true">🔎</span>
                        <span className="sr-only">Search students</span>
                        <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Name or phone"
                            className="flex-1 min-w-0 outline-none text-[14px]" style={{ border: 0, boxShadow: 'none', background: 'transparent' }} />
                    </label>
                    <div className="flex flex-wrap gap-2 items-center">
                        {!isManager && (
                            <select aria-label="Centre" value={viewCenter} onChange={(e) => { setViewCenter(e.target.value); setFilterBatch('ALL'); }} className={sel}>
                                <option value="ALL">All centres</option>
                                <option value="UN_COLLEGE">College Road</option>
                                <option value="UN_NASHIK_RD">Nashik Road</option>
                                <option value="PRAYAS">Prayaas</option>
                            </select>
                        )}
                        <select aria-label="Batch" value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)} className={`${sel} max-w-[200px]`}>
                            <option value="ALL">All batches</option>
                            <option value="UNASSIGNED">No batch yet</option>
                            <option value="INVALID">Batch deleted</option>
                            {batches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                        </select>
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 h-[38px] text-[13px]" style={{ background: 'var(--cream)', boxShadow: '0 0 0 1px var(--line)' }}>
                            <span aria-hidden="true">📅</span>
                            <input type="date" aria-label="From" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent outline-none" style={{ border: 0 }} />
                            <span style={{ color: 'var(--muted)' }}>to</span>
                            <input type="date" aria-label="To" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent outline-none" style={{ border: 0 }} />
                            {(startDate || endDate) && <button type="button" aria-label="Clear dates" onClick={() => { setStartDate(''); setEndDate(''); }} className="font-bold" style={{ color: 'var(--coral)' }}>✕</button>}
                        </span>
                    </div>
                </div>
            </Card>

            {loading ? (
                <div className="flex flex-col gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="j-sk h-[76px]" />)}</div>
            ) : filteredData.length === 0 ? (
                <Card><Empty emoji="🔍">No students match these filters.</Empty></Card>
            ) : (
                <Card pad={8}>
                    <div className="hidden lg:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_120px_120px_96px] gap-3 px-4 py-2 text-[12px] font-bold" style={{ color: 'var(--muted)' }}>
                        <span>Student</span><span>Course</span><span>Batch</span><span className="text-right">Paid</span><span className="text-right">To pay</span><span />
                    </div>
                    <ul className="flex flex-col">
                        {filteredData.map((s, i) => {
                            const c = chip(s);
                            return (
                                <li key={s.id} className="jb-rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms`, borderTop: i ? '1px solid var(--track)' : 'none' }}>
                                    <div role="button" tabIndex={0} onClick={() => open(s)} onKeyDown={(e) => { if (e.key === 'Enter') open(s); }}
                                        className="grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_120px_120px_96px] gap-3 items-center px-3 lg:px-4 py-3 rounded-2xl cursor-pointer hover:bg-[var(--cream)]">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar name={s.studentName} />
                                            <div className="min-w-0">
                                                <b className="block text-[14.5px] truncate">{s.studentName || 'No name'}</b>
                                                <p className="text-[12px] truncate" style={{ color: 'var(--muted)' }}>
                                                    <span className="lg:hidden">{programLabel(s.program || s.programKey)} · </span>{s.rollNumber ? `Roll ${s.rollNumber}` : s.phone} · joined {renderDate(s.createdAt)}
                                                </p>
                                                <span className="inline-block mt-1 text-[11.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: c.bg }}>{c.text}</span>
                                            </div>
                                        </div>
                                        <span className="hidden lg:block text-[13.5px] truncate" title={s.program || s.programKey}>{programLabel(s.program || s.programKey) || '—'}</span>
                                        <span className="hidden lg:block text-[13.5px] truncate">{s.batchAssigned || <span style={{ color: 'var(--muted)' }}>No batch yet</span>}</span>
                                        <b className="hidden lg:block text-right text-[14px]"><Money value={Number(s.totalPaid) || 0} /></b>
                                        <b className="hidden lg:block text-right text-[14px]" style={{ color: dueOf(s) ? 'var(--coral)' : 'var(--ok)' }}><Money value={dueOf(s)} /></b>
                                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                            <Contact name={s.studentName} phone={phoneOf(s)} />
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </Card>
            )}
        </div>
    );
};

export default StudentRecords;
