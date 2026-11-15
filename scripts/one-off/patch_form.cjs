const fs = require('fs');
const file = 'src/modules/crm/components/AdmissionForm.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace the centerId logic with state
const oldCenterLogic = `    // Determine Center
    const isDirector = userProfile?.role?.toUpperCase() === 'DIRECTOR';
    const centerId = (() => {
        if (isDirector) {
            // 1. Lead's Origin (Highest Priority)
            if (leadData.centerId) return leadData.centerId;
            // 2. Navbar Selection (If no lead) - passed via props now
            if (currentCenter?.id) return currentCenter.id;
            // 3. Fallback
            return 'UN_COLLEGE';
        }
        // Managers/Staff: Enforce Profile Center
        return userProfile?.centerId || 'UN_COLLEGE';
    })();

    const centerInfo = CENTERS[centerId] || CENTERS['UN_COLLEGE'];

    // 1. Initial Load of Batches
    useEffect(() => {
        if (userProfile?.centerId) {
            const load = async () => {
                try {
                    const allBatches = await fetchBatches(userProfile.centerId);
                    setBatches(allBatches || []);
                } catch (err) {
                    console.error("Failed to load batches", err);
                }
            };
            load();
        }
    }, [userProfile]);`;

const newCenterLogic = `    // Determine Center
    const isDirector = userProfile?.role?.toUpperCase() === 'DIRECTOR';
    
    // NEW: Selected Center State for Cross-Center Admissions
    const [selectedCenterId, setSelectedCenterId] = useState(() => {
        if (isDirector) {
            if (leadData.centerId) return leadData.centerId;
            if (currentCenter?.id) return currentCenter.id;
            return 'UN_COLLEGE';
        }
        return userProfile?.centerId || 'UN_COLLEGE';
    });

    // Alias centerId to selectedCenterId so rest of code works as-is
    const centerId = selectedCenterId;
    const centerInfo = CENTERS[selectedCenterId] || CENTERS['UN_COLLEGE'];

    // 1. Initial Load of Batches (Now reacts to selectedCenterId)
    useEffect(() => {
        if (selectedCenterId) {
            const load = async () => {
                try {
                    const allBatches = await fetchBatches(selectedCenterId);
                    setBatches(allBatches || []);
                    // Reset selected batch if center changes
                    setFormData(prev => ({ ...prev, batch: '', batchName: '' }));
                    setSelectedBatchObj(null);
                } catch (err) {
                    console.error("Failed to load batches", err);
                }
            };
            load();
        }
    }, [selectedCenterId]);`;

content = content.replace(oldCenterLogic, newCenterLogic);

// 2. Add Academic Center Dropdown before Admission Mode
const oldModeUI = `                            {/* ADMISSION MODE */}`;
const newModeUI = `                            {/* ACADEMIC CENTER SELECTION */}
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 md:col-span-2 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                                        <MapPin className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-blue-900 uppercase">Academic Center</label>
                                        <p className="text-xs text-blue-600">Where will this student actually study? (Changes batch list)</p>
                                    </div>
                                </div>
                                <select
                                    value={selectedCenterId}
                                    onChange={(e) => setSelectedCenterId(e.target.value)}
                                    className="w-full md:w-64 p-3 border-2 border-blue-200 rounded-lg text-blue-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:bg-white transition"
                                >
                                    {Object.entries(CENTERS).map(([id, info]) => (
                                        <option key={id} value={id}>{info.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ADMISSION MODE */}`;

content = content.replace(oldModeUI, newModeUI);

fs.writeFileSync(file, content, 'utf8');
console.log('AdmissionForm patched successfully!');
