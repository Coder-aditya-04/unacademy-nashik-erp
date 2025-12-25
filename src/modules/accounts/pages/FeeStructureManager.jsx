import React, { useState, useEffect } from 'react';
import { useFeeStructure } from '../../../hooks/useFeeStructure';
import { saveFeeStructure } from '../../../services/feeService';
import { Edit2, Plus, Save, X, RefreshCw, AlertCircle, CheckCircle, Trash2, Copy } from 'lucide-react';

const FeeStructureManager = () => {
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

    if (loading) return <div className="p-10 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" /> Loading Fees...</div>;
    if (error) return <div className="p-10 text-center text-red-600"><AlertCircle className="inline" /> Error loading fees: {error.message || "Unknown Error"}</div>;

    // Filter Keys based on Tab
    const allKeys = feeStructures ? Object.keys(feeStructures).sort() : [];
    const filteredKeys = allKeys.filter(key => {
        if (activeTab === 'PRAYAS') return key.startsWith('PRAYAS_');
        return !key.startsWith('PRAYAS_');
    });

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Fee Structure Manager</h1>
                    <p className="text-slate-500">Manage fees for individual centers.</p>
                </div>

                {/* TABS */}
                <div className="bg-slate-100 p-1 rounded-lg flex space-x-2">
                    <button
                        onClick={() => setActiveTab('STANDARD')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition ${activeTab === 'STANDARD' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Standard (College/Nashik Rd)
                    </button>
                    <button
                        onClick={() => setActiveTab('PRAYAS')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition ${activeTab === 'PRAYAS' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Prayas Center
                    </button>
                </div>
            </div>

            {/* ACTION BAR */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700">
                    Showing {filteredKeys.length} courses for <span className={activeTab === 'PRAYAS' ? "text-purple-600" : "text-blue-600"}>{activeTab}</span>
                </span>
                <div className="flex gap-3">
                    {/* Bulk Clone for Prayas */}
                    {activeTab === 'PRAYAS' && filteredKeys.length === 0 && (
                        <button
                            onClick={handleCloneStandardToPrayas}
                            className="flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-lg font-bold hover:bg-purple-200 transition"
                        >
                            <Copy className="w-4 h-4" /> Copy Standard Fees
                        </button>
                    )}

                    <button
                        onClick={handleCreateClick}
                        className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-black transition"
                    >
                        <Plus className="w-4 h-4" /> Add New Course
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LIST OF COURSES */}
                <div className="lg:col-span-1 space-y-3">
                    {filteredKeys.map(key => (
                        <div
                            key={key}
                            onClick={() => handleEditClick(key, feeStructures[key])}
                            className={`p-4 rounded-xl border cursor-pointer transition flex justify-between items-center ${editingKey === key ? 'bg-blue-50 border-blue-500 shadow-md' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                        >
                            <div>
                                <h3 className="font-bold text-slate-700">{feeStructures[key].name}</h3>
                                <p className="text-xs text-slate-400 font-mono">{key}</p>
                            </div>
                            <div className="text-right">
                                <span className="block font-bold text-slate-800">₹{Number(feeStructures[key].total).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                    {filteredKeys.length === 0 && (
                        <div className="text-center text-slate-400 py-10 border-2 border-dashed border-slate-200 rounded-xl">
                            <p>No fee structures found for {activeTab}.</p>
                        </div>
                    )}
                </div>

                {/* EDIT FORM */}
                <div className="lg:col-span-2">
                    {editingKey ? (
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
                                <h2 className="font-bold flex items-center gap-2">
                                    <Edit2 className="w-4 h-4 text-blue-600" />
                                    {isCreating ? `Create New (${activeTab})` : `Editing: ${feeStructures[editingKey]?.name}`}
                                </h2>
                                <button onClick={() => setEditingKey(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Key & Name */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Course Name</label>
                                        <input
                                            name="name"
                                            value={editForm.name || ''}
                                            onChange={handleFormChange}
                                            className="w-full p-2 border rounded font-bold"
                                            placeholder="e.g. MHT-CET Crash Course"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Fiebase Key (Internal)</label>
                                        <input
                                            value={isCreating ? newKey : editingKey}
                                            onChange={(e) => setNewKey(e.target.value)}
                                            disabled={!isCreating}
                                            className={`w-full p-2 border rounded font-mono text-sm ${!isCreating ? 'bg-slate-100' : ''}`}
                                            // Make prefix clearer for user
                                            placeholder={activeTab === 'PRAYAS' ? "PRAYAS_KEY" : "KEY"}
                                        />
                                        {activeTab === 'PRAYAS' && isCreating && <p className="text-[10px] text-purple-600 mt-1">Must start with PRAYAS_</p>}
                                    </div>
                                </div>

                                {/* Financial Layout */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 text-center">Fee Breakdown</h3>
                                    <div className="grid grid-cols-4 gap-4 text-center">
                                        <div className="bg-white p-2 rounded border">
                                            <label className="text-[10px] text-slate-400 block mb-1">Registration</label>
                                            <input type="number" name="reg" value={editForm.reg} onChange={handleFormChange} className="w-full text-center font-bold text-slate-700 outline-none" />
                                        </div>
                                        <div className="bg-white p-2 rounded border">
                                            <label className="text-[10px] text-slate-400 block mb-1">Tech / Other</label>
                                            <input type="number" name="tech" value={editForm.tech} onChange={handleFormChange} className="w-full text-center font-bold text-slate-700 outline-none" />
                                        </div>
                                        <div className="bg-white p-2 rounded border">
                                            <label className="text-[10px] text-slate-400 block mb-1">Exam Fee</label>
                                            <input type="number" name="exam" value={editForm.exam} onChange={handleFormChange} className="w-full text-center font-bold text-slate-700 outline-none" />
                                        </div>
                                        <div className="bg-white p-2 rounded border border-blue-200 shadow-sm">
                                            <label className="text-[10px] text-blue-500 block mb-1">Tuition Fee</label>
                                            <input type="number" name="tuition" value={editForm.tuition} onChange={handleFormChange} className="w-full text-center font-bold text-blue-700 outline-none" />
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                                        <div>
                                            <label className="text-[10px] text-slate-400 block mb-1">Fixed Buffer (Internal)</label>
                                            <input type="number" name="fixedAmt" value={editForm.fixedAmt} onChange={handleFormChange} className="w-20 text-center font-mono text-xs border rounded bg-slate-100 p-1" />
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-slate-500 uppercase block">Total Calculated Fee</span>
                                            <span className="text-2xl font-black text-slate-800">₹{editForm.total?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Installment Config */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Total Installments</label>
                                        <input type="number" name="installments" value={editForm.installments} onChange={handleFormChange} className="w-full p-2 border rounded" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Interval (Months)</label>
                                        <input type="number" name="intervalMonths" value={editForm.intervalMonths} onChange={handleFormChange} className="w-full p-2 border rounded" />
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="pt-4 flex items-center justify-end gap-3">
                                    {saveStatus === 'success' && <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Saved!</span>}
                                    <button
                                        onClick={handleSave}
                                        disabled={saveStatus === 'saving'}
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {saveStatus === 'saving' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        {isCreating ? 'Create' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-2xl p-10">
                            <Edit2 className="w-12 h-12 mb-4 opacity-50" />
                            <p className="font-bold">Select a course to edit or create new</p>
                            {activeTab === 'PRAYAS' && filteredKeys.length === 0 && <p className="text-sm mt-2 text-purple-500">Or use "Copy Standard Fees" above</p>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FeeStructureManager;
