import React, { useState, useEffect } from 'react';
import { useFeeStructure } from '../../../hooks/useFeeStructure';
import { saveFeeStructure, deleteFeeStructure } from '../../../services/feeService';
import { HostelFeesEditor } from '../../../components/j/HostelFees';
import { X, Trash2, Copy } from 'lucide-react';
import { Seg, Empty } from '../../../components/j';
import { Money } from '../../../components/Money';

const FeeStructureManager = ({ userProfile }) => {
    const { feeStructures, loading, error, reloadFees } = useFeeStructure();

    // TABS: STANDARD vs PRAYAS
    const [activeTab, setActiveTab] = useState('STANDARD'); // 'STANDARD' or 'PRAYAS'

    const [editingKey, setEditingKey] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [isCreating, setIsCreating] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [saveStatus, setSaveStatus] = useState(null); // 'saving', 'success', 'error'

    // Initialize edit form when a course is selected
    const handleEditClick = (key, data) => {
        setEditingKey(key);
        setEditForm({ ...data }); // Copy data to form
        setIsCreating(false);
        setSaveStatus(null);
    };

    const handleCreateClick = () => {
        setIsCreating(true);
        setEditingKey('NEW_ENTRY');
        // Auto-prefix if Prayas
        setNewKey(activeTab === 'PRAYAS' ? 'PRAYAS_' : '');
        setEditForm({
            name: activeTab === 'PRAYAS' ? 'Prayas ' : '',
            reg: 0,
            tech: 0,
            exam: 0,
            tuition: 0,
            total: 0,
            basePrice: 0,
            fixedAmt: 5000,
            installments: 3,
            intervalMonths: 3
        });
        setSaveStatus(null);
    };

    const handleCloneStandardToPrayas = async () => {
        if (!window.confirm("This will copy ALL Standard fees to Prayas (prefixed with PRAYAS_). Existing Prayas fees won't be overwritten unless they match keys exactly. Proceed?")) return;

        setSaveStatus('saving');
        try {
            const standardKeys = Object.keys(feeStructures).filter(k => !k.startsWith('PRAYAS_'));

            for (const key of standardKeys) {
                const newKey = `PRAYAS_${key}`;
                // Only create if doesn't exist (safety)
                if (!feeStructures[newKey]) {
                    const data = { ...feeStructures[key], name: `Prayas ${feeStructures[key].name}` };
                    await saveFeeStructure(newKey, data);
                }
            }
            await reloadFees();
            setSaveStatus('success');
            setTimeout(() => setSaveStatus(null), 2000);
            alert("Cloning Complete!");
        } catch (err) {
            console.error(err);
            setSaveStatus('error');
            alert("Error cloning fees.");
        }
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        // Auto-calculate Total and Base Price if components change
        if (['reg', 'tech', 'exam', 'tuition'].includes(name)) {
            const val = Number(value);
            setEditForm(prev => {
                const newState = { ...prev, [name]: val };
                const total = Number(newState.reg) + Number(newState.tech) + Number(newState.exam) + Number(newState.tuition);
                return { ...newState, total: total, basePrice: total };
            });
        } else {
            setEditForm(prev => ({ ...prev, [name]: value }));
        }
    };

    // Handler for Custom Installment Inputs
    const handleInstallmentChange = (idx, field, value) => {
        setEditForm(prev => {
            const count = Number(prev.installments) || 0;
            // Ensure arrays exist
            const percents = prev.installmentPercents ? [...prev.installmentPercents] : new Array(count).fill(0);
            const intervals = prev.installmentIntervals ? [...prev.installmentIntervals] : new Array(count).fill(0);

            if (field === 'percent') percents[idx] = Number(value);
            if (field === 'interval') intervals[idx] = Number(value);

            return { ...prev, installmentPercents: percents, installmentIntervals: intervals };
        });
    };

    // Auto-resize arrays when Count changes
    const totalInstallments = Number(editForm.installments) || 0;
    useEffect(() => {
        if (!editingKey || !totalInstallments) return;

        setEditForm(prev => {
            const currentP = prev.installmentPercents || [];
            const currentI = prev.installmentIntervals || [];

            if (currentP.length === totalInstallments) return prev; // No change

            // Resize and preserve/fill
            const newP = new Array(totalInstallments).fill(0).map((_, i) => currentP[i] || (i === 0 ? 50 : 0)); // Default 1st to 50%
            const newI = new Array(totalInstallments).fill(0).map((_, i) => currentI[i] || (i === 0 ? 0 : 3)); // Default 3 months

            return { ...prev, installmentPercents: newP, installmentIntervals: newI };
        });
    }, [totalInstallments, editingKey]);

    const handleSave = async () => {
        setSaveStatus('saving');
        let keyToSave = isCreating ? newKey.toUpperCase().replace(/\s+/g, '_') : editingKey;

        // Enforce Prefix for Prayas Tab (if creating new)
        if (isCreating && activeTab === 'PRAYAS' && !keyToSave.startsWith('PRAYAS_')) {
            keyToSave = 'PRAYAS_' + keyToSave;
        }

        if (!keyToSave) {
            alert("Please provide a valid Course Key");
            setSaveStatus(null);
            return;
        }

        try {
            await saveFeeStructure(keyToSave, editForm);
            setSaveStatus('success');
            setTimeout(() => {
                setEditingKey(null);
                setIsCreating(false);
                setSaveStatus(null);
                reloadFees();
            }, 1000);
        } catch (err) {
            console.error(err);
            setSaveStatus('error');
        }
    };

    const handleDelete = async () => {
        if (isCreating) return;
        if (!window.confirm("Are you sure you want to delete this course? This action cannot be undone.")) return;

        setSaveStatus('saving');
        try {
            await deleteFeeStructure(editingKey);
            setSaveStatus('success');
            setTimeout(() => {
                setEditingKey(null);
                setSaveStatus(null);
                reloadFees();
            }, 1000);
        } catch (err) {
            console.error(err);
            setSaveStatus('error');
            alert("Error deleting course.");
        }
    };

    if (loading) return (
        <div className="max-w-6xl mx-auto space-y-4">
            <div className="j-sk h-10 w-60 rounded-2xl" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{[0, 1, 2].map(k => <div key={k} className="j-sk h-24 rounded-[24px]" />)}</div>
        </div>
    );
    if (error) return <div className="jb-card max-w-xl mx-auto text-center" style={{ padding: 20 }} role="alert">Couldn't load fees: {error.message || 'Unknown error'}</div>;

    // Filter Keys based on Tab
    const allKeys = feeStructures ? Object.keys(feeStructures).sort() : [];
    const filteredKeys = allKeys.filter(key => {
        if (activeTab === 'PRAYAS') return key.startsWith('PRAYAS_');
        return !key.startsWith('PRAYAS_');
    });
    const pctTotal = editForm.installmentPercents?.slice(0, totalInstallments).reduce((a, b) => a + Number(b || 0), 0) || 0;
    const lab = 'block text-[12px] font-bold mb-1';
    const labStyle = { color: 'var(--sub)' };
    const PARTS = [['reg', 'Registration'], ['tech', 'Tech / other'], ['exam', 'Exam fee'], ['tuition', 'Tuition fee']];

    return (
        <div className="max-w-6xl mx-auto space-y-5 pb-10">
            <header className="jb-rise flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="jb-sub text-[13px] font-semibold">Settings</p>
                    <h1 className="jb-h text-[30px] leading-tight">Fee structures</h1>
                    <p className="jb-sub text-[13px]">Set each course's fee and how it splits into parts. New admissions use these.</p>
                </div>
                <div className="max-w-full overflow-x-auto jb-scroll">
                    <Seg label="Fee list" value={activeTab} onChange={(v) => { setActiveTab(v); setEditingKey(null); }} options={[
                        { value: 'STANDARD', label: 'College Rd & Nashik Rd' },
                        { value: 'PRAYAS', label: 'Prayas' },
                        { value: 'HOSTEL', label: '🏠 Hostel' },
                    ]} />
                </div>
            </header>

            {activeTab === 'HOSTEL' ? <HostelFeesEditor userProfile={userProfile} /> : (<>
            <div className="jb-card jb-rise flex flex-wrap items-center justify-between gap-3" style={{ padding: 14 }}>
                <span className="font-bold text-[14px] px-1">{filteredKeys.length} course{filteredKeys.length === 1 ? '' : 's'}</span>
                <div className="flex gap-2 flex-wrap">
                    {activeTab === 'PRAYAS' && filteredKeys.length === 0 && (
                        <button type="button" onClick={handleCloneStandardToPrayas} className="jb-act jb-act-soft"><Copy className="w-4 h-4 inline mr-1" /> Copy standard fees</button>
                    )}
                    <button type="button" onClick={handleCreateClick} className="jb-act jb-act-ink">＋ New course</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                <div className="lg:col-span-1 space-y-2.5">
                    {filteredKeys.map((key, n) => {
                        const on = editingKey === key;
                        return (
                            <button type="button" key={key} onClick={() => handleEditClick(key, feeStructures[key])}
                                className="jb-rise jb-lift w-full text-left rounded-[20px] px-4 py-3.5 flex items-center justify-between gap-3"
                                style={{ background: on ? 'var(--t-sage)' : 'var(--panel)', border: on ? '2px solid var(--ink)' : '1px solid var(--line)', animationDelay: `${Math.min(n, 12) * 25}ms`, color: 'var(--ink)' }}>
                                <span className="min-w-0">
                                    <span className="block font-bold text-[14.5px] truncate">{feeStructures[key].name}</span>
                                    <span className="block text-[11.5px] font-mono truncate" style={{ color: 'var(--muted)' }}>{key}</span>
                                </span>
                                <span className="font-bold text-[15px] shrink-0"><Money value={Number(feeStructures[key].total) || 0} /></span>
                            </button>
                        );
                    })}
                    {filteredKeys.length === 0 && <div className="jb-card"><Empty emoji="📭">No courses here yet.</Empty></div>}
                </div>

                <div className="lg:col-span-2">
                    {editingKey ? (
                        <div className="jb-card jb-rise overflow-hidden" style={{ padding: 0 }}>
                            <div className="px-5 py-4 flex items-center justify-between gap-3" style={{ background: 'var(--t-blue)' }}>
                                <h2 className="jb-h text-[18px] leading-tight min-w-0 truncate">
                                    {isCreating ? `New course · ${activeTab === 'PRAYAS' ? 'Prayas' : 'Standard'}` : feeStructures[editingKey]?.name}
                                </h2>
                                <button type="button" onClick={() => setEditingKey(null)} aria-label="Close" className="jb-act jb-act-line" style={{ padding: '6px 10px' }}><X className="w-4 h-4" /></button>
                            </div>

                            <div className="p-5 space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <label className="block">
                                        <span className={lab} style={labStyle}>Course name</span>
                                        <input name="name" value={editForm.name || ''} onChange={handleFormChange} className="jb-input font-bold" placeholder="e.g. MHT-CET Crash Course" />
                                    </label>
                                    <label className="block">
                                        <span className={lab} style={labStyle}>Course code (fixed once made)</span>
                                        <input value={isCreating ? newKey : editingKey} onChange={(e) => setNewKey(e.target.value)} disabled={!isCreating}
                                            className="jb-input font-mono text-[13px]" style={!isCreating ? { opacity: .6 } : undefined} placeholder={activeTab === 'PRAYAS' ? 'PRAYAS_KEY' : 'KEY'} />
                                        {activeTab === 'PRAYAS' && isCreating && <span className="block text-[11.5px] mt-1" style={{ color: 'var(--muted)' }}>Must start with PRAYAS_</span>}
                                    </label>
                                </div>

                                <div className="rounded-[20px] p-4" style={{ background: 'var(--cream)' }}>
                                    <p className="text-[12px] font-bold mb-3" style={labStyle}>Fee breakdown</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {PARTS.map(([k, l]) => (
                                            <label key={k} className="block rounded-2xl p-3" style={{ background: 'var(--panel)', border: k === 'tuition' ? '2px solid var(--ink)' : '1px solid var(--line)' }}>
                                                <span className="block text-[11.5px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>{l}</span>
                                                <input type="number" name={k} value={editForm[k] ?? 0} onChange={handleFormChange} className="w-full bg-transparent outline-none font-bold text-[16px]" />
                                            </label>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-4 flex flex-wrap items-end justify-between gap-3" style={{ borderTop: '1px solid var(--line)' }}>
                                        <label className="block">
                                            <span className="block text-[11.5px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Fixed buffer (internal)</span>
                                            <input type="number" name="fixedAmt" value={editForm.fixedAmt ?? 0} onChange={handleFormChange} className="jb-input !w-28 font-mono text-[13px]" />
                                        </label>
                                        <div className="text-right">
                                            <span className="block text-[12px] font-bold" style={labStyle}>Total fee</span>
                                            <span className="jb-h text-[28px]"><Money value={Number(editForm.total) || 0} /></span>
                                        </div>
                                    </div>
                                </div>

                                <label className="block max-w-[220px]">
                                    <span className={lab} style={labStyle}>Number of parts</span>
                                    <input type="number" name="installments" value={editForm.installments ?? 0} onChange={handleFormChange} className="jb-input" />
                                </label>

                                {totalInstallments > 0 && (
                                    <div className="rounded-[20px] p-4" style={{ background: 'var(--cream)' }}>
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <p className="text-[12px] font-bold" style={labStyle}>Part schedule</p>
                                            <span className="px-2.5 py-0.5 rounded-full text-[12px] font-bold" style={{ background: pctTotal === 100 ? 'var(--t-sage)' : 'var(--t-coral)' }}>
                                                {pctTotal}%{pctTotal === 100 ? ' ✓' : ' · should be 100%'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-[44px_1fr_1fr] gap-2 text-[11.5px] font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>
                                            <span className="text-center">Part</span><span>Share of fee</span><span>Months after last part</span>
                                        </div>
                                        <div className="space-y-2">
                                            {Array.from({ length: totalInstallments }).map((_, idx) => (
                                                <div key={idx} className="grid grid-cols-[44px_1fr_1fr] gap-2 items-center">
                                                    <span className="h-10 rounded-xl inline-flex items-center justify-center font-bold" style={{ background: 'var(--panel)' }}>{idx + 1}</span>
                                                    <div className="relative">
                                                        <input type="number" aria-label={`Part ${idx + 1} percent`} value={editForm.installmentPercents?.[idx] || 0} onChange={(e) => handleInstallmentChange(idx, 'percent', e.target.value)} className="jb-input !pr-8 font-bold" />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: 'var(--muted)' }}>%</span>
                                                    </div>
                                                    <div className="relative">
                                                        <input type="number" aria-label={`Part ${idx + 1} gap in months`} value={editForm.installmentIntervals?.[idx] || 0} onChange={(e) => handleInstallmentChange(idx, 'interval', e.target.value)} className="jb-input !pr-10 font-bold" />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: 'var(--muted)' }}>mo</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[11.5px] mt-2" style={{ color: 'var(--muted)' }}>The first part is usually 0 months (paid at admission).</p>
                                    </div>
                                )}

                                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        {!isCreating && (
                                            <button type="button" onClick={handleDelete} disabled={saveStatus === 'saving'} className="jb-act jb-act-line disabled:opacity-50" style={{ color: '#b4442f' }}>
                                                <Trash2 className="w-4 h-4 inline mr-1" /> Delete course
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {saveStatus === 'success' && <span className="font-bold text-[13px] jb-pop" role="status">✓ Saved</span>}
                                        {saveStatus === 'error' && <span className="font-bold text-[13px]" role="alert" style={{ color: '#b4442f' }}>Couldn't save</span>}
                                        <button type="button" onClick={handleSave} disabled={saveStatus === 'saving'} className="jb-act jb-act-ink disabled:opacity-50">
                                            {saveStatus === 'saving' ? 'Saving…' : isCreating ? 'Create course' : 'Save changes'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="jb-card text-center py-14 px-5">
                            <p className="text-[34px] jb-pop" aria-hidden="true">✏️</p>
                            <p className="font-bold mt-2">Pick a course to edit, or make a new one</p>
                            {activeTab === 'PRAYAS' && filteredKeys.length === 0 && <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>Or copy the standard fees above</p>}
                        </div>
                    )}
                </div>
            </div>
            </>)}
        </div>
    );
};

export default FeeStructureManager;
