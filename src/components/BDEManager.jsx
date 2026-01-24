import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, runTransaction, collection } from 'firebase/firestore';
import { X, Plus, Trash2, Users, Save, Loader2 } from 'lucide-react';
import { CENTERS } from '../utils/centers'; // Import centers

const BDEManager = ({ onClose, preselectedCenterId = null }) => {
    const [bdeList, setBdeList] = useState([]);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newCenter, setNewCenter] = useState(preselectedCenterId || ''); // Initialize with prop
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // PRIMARY: 'batches' collection (Legacy/Director Access)
    const BDE_DOC_REF = doc(db, 'batches', 'bde_list_configuration');
    // FALLBACK: 'users' collection (Public Access assumed, since Counselor List works)
    const PUBLIC_BDE_REF = doc(db, 'users', 'metadata_bde_list');

    // Fetch List
    useEffect(() => {
        const fetchBDEs = async () => {
            try {
                // Try fetching from Public Ref first (faster/more likely to work for readers, but we are Manager)
                // Actually, Manager has access to everything. Let's fetch from PRIMARY.
                const docSnap = await getDoc(BDE_DOC_REF);
                let currentRecords = [];

                if (docSnap.exists()) {
                    currentRecords = docSnap.data().records || [];
                    setBdeList(currentRecords);
                } else {
                    await setDoc(BDE_DOC_REF, { records: [] });
                    setBdeList([]);
                }

                // SELF-HEALING: Sync to Public Ref if missing
                // This ensures the data is available for the Inquiry Form
                const publicSnap = await getDoc(PUBLIC_BDE_REF);
                if (!publicSnap.exists() && currentRecords.length > 0) {
                    await setDoc(PUBLIC_BDE_REF, { records: currentRecords });
                    console.log("Synced BDE list to public location.");
                }

            } catch (err) {
                console.error("Error fetching BDE list:", err);
                // Try fallback to public ref if primary failed (e.g. permission?)
                try {
                    const publicSnap = await getDoc(PUBLIC_BDE_REF);
                    if (publicSnap.exists()) {
                        setBdeList(publicSnap.data().records || []);
                    }
                } catch (e2) {
                    console.error("Fallback fetch failed", e2);
                }
            }
            setLoading(false);
        };
        fetchBDEs();
    }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        if (!newCenter) {
            alert("Please select a Center for this BDE.");
            return;
        }

        const newItem = {
            id: Date.now().toString(),
            name: newName.trim(),
            phone: newPhone.trim() || '-',
            centerId: newCenter
        };

        setSaving(true);
        try {
            await runTransaction(db, async (transaction) => {
                // 1. Read current state (Primary)
                const docSnap = await transaction.get(BDE_DOC_REF);
                let currentRecords = [];
                if (docSnap.exists()) {
                    currentRecords = docSnap.data().records || [];
                }

                // 2. Validate Duplicates (within transaction for safety)
                const normalizedList = currentRecords.map(item => {
                    if (typeof item === 'string') return { id: item, name: item, phone: '-', centerId: '' };
                    return item;
                });

                if (normalizedList.some(item => item.name.toLowerCase() === newItem.name.toLowerCase())) {
                    throw new Error("Name already exists!");
                }

                const updatedList = [...normalizedList, newItem];

                // 3. Write updates
                transaction.set(BDE_DOC_REF, { records: updatedList }, { merge: true });
                transaction.set(PUBLIC_BDE_REF, { records: updatedList }, { merge: true });

                // 4. Audit Log
                const logRef = doc(collection(db, 'bde_audit_logs'));
                transaction.set(logRef, {
                    action: "ADD",
                    bdeName: newItem.name,
                    bdeId: newItem.id,
                    centerId: newItem.centerId,
                    performedBy: auth.currentUser ? (auth.currentUser.email || auth.currentUser.uid) : "Unknown",
                    timestamp: new Date()
                });
            });

            // Optimistic update / Re-fetch done by re-rendering implicitly if needed, 
            // but here we just update local state to match successful transaction
            setBdeList(prev => [...prev, newItem]);
            setNewName('');
            setNewPhone('');
            setNewCenter('');
        } catch (err) {
            console.error("Error adding BDE:", err);
            alert(err.message || "Failed to add BDE.");
        }
        setSaving(false);
    };

    const handleDelete = async (idOfItem) => {
        if (!window.confirm(`Remove this BDE?`)) return;

        setSaving(true);
        try {
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(BDE_DOC_REF);
                if (!docSnap.exists()) throw new Error("Document does not exist!");

                const currentRecords = docSnap.data().records || [];
                const itemToRemove = currentRecords.find(item => (item.id || item) === idOfItem);
                const updatedList = currentRecords.filter(item => (item.id || item) !== idOfItem);

                transaction.set(BDE_DOC_REF, { records: updatedList }, { merge: true });
                transaction.set(PUBLIC_BDE_REF, { records: updatedList }, { merge: true });

                // Audit Log
                if (itemToRemove) {
                    const logRef = doc(collection(db, 'bde_audit_logs'));
                    transaction.set(logRef, {
                        action: "DELETE",
                        bdeName: itemToRemove.name || itemToRemove,
                        bdeId: itemToRemove.id || itemToRemove,
                        performedBy: auth.currentUser ? (auth.currentUser.email || auth.currentUser.uid) : "Unknown",
                        timestamp: new Date()
                    });
                }
            });

            setBdeList(prev => prev.filter(item => (item.id || item) !== idOfItem));
        } catch (err) {
            console.error("Error deleting BDE:", err);
            alert("Failed to delete BDE.");
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col">

                {/* Header */}
                <div className="bg-indigo-900 p-6 flex justify-between items-center text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-800 p-2 rounded-lg">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Manage BDE Team</h2>
                            <p className="text-indigo-200 text-xs">Standardize names for inquiry forms</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto max-h-[60vh]">
                    {loading ? (
                        <div className="flex justify-center py-10 text-indigo-600">
                            <Loader2 className="w-8 h-8 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Add Form */}
                            <form onSubmit={handleAdd} className="flex gap-2">
                                <div className="flex-1 space-y-2">
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="Name (e.g. Rahul)"
                                        className="w-full p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                                    />
                                    <input
                                        type="tel"
                                        value={newPhone}
                                        onChange={(e) => setNewPhone(e.target.value)}
                                        placeholder="Phone Number"
                                        className="w-full p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                                    />
                                    <select
                                        value={newCenter}
                                        onChange={(e) => setNewCenter(e.target.value)}
                                        className={`w-full p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-gray-700 ${preselectedCenterId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                        disabled={!!preselectedCenterId}
                                    >
                                        <option value="">-- Select Center --</option>
                                        {Object.values(CENTERS).map(center => (
                                            <option key={center.id} value={center.id}>{center.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    disabled={!newName.trim() || !newCenter || saving}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-xl disabled:opacity-50 transition shadow-lg shadow-indigo-200 flex items-center justify-center"
                                >
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                </button>
                            </form>

                            {/* List */}
                            <div className="space-y-2 mt-4">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Active BDE List ({bdeList.length})</h3>
                                {bdeList.length === 0 ? (
                                    <p className="text-center text-gray-400 italic py-4 text-sm">No BDEs added yet.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {bdeList.map((item) => (
                                            <li key={item.id || item} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 group hover:border-indigo-100 transition-colors">
                                                <div>
                                                    <div className="font-bold text-gray-700 text-sm">{item.name || item}</div>
                                                    <div className="text-xs text-indigo-500">{item.phone || ''} • {item.centerId ? CENTERS[item.centerId]?.name.split('Unacademy')[1] || item.centerId : 'All Centers'}</div>
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(item.id || item)}
                                                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Remove"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <p className="text-xs text-gray-400">Changes update immediately for all users.</p>
                </div>
            </div>
        </div>
    );
};

export default BDEManager;
