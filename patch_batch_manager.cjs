const fs = require('fs');
const file = 'src/modules/admin/pages/BatchManager.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update Imports
content = content.replace(
    /import { fetchBatches, createBatch, updateBatch, deleteBatch, fetchRealBatchEnrollments } from '\.\.\/\.\.\/\.\.\/services\/batchService';/g,
    "import { fetchBatches, createBatch, updateBatch, deleteBatch, fetchRealBatchEnrollments, subscribeToBatches } from '../../../services/batchService';"
);

// 2. Add search query state
const stateInjection = `    const [viewCenter, setViewCenter] = useState('ALL');
    const [selectedBatchStats, setSelectedBatchStats] = useState('ALL');
    
    // NEW: Search Query State
    const [searchQuery, setSearchQuery] = useState('');`;

content = content.replace(
    /const \[viewCenter, setViewCenter\] = useState\('ALL'\);\n\s*const \[selectedBatchStats, setSelectedBatchStats\] = useState\('ALL'\);/g,
    stateInjection
);

// 3. Update loadBatches to use subscribeToBatches
const effectReplacement = `    // Initial Load
    useEffect(() => {
        let unsubscribe = null;
        setLoading(true);
        
        const load = async () => {
            try {
                // Fetch enrollments first
                const enumData = await fetchRealBatchEnrollments(userProfile.centerId);
                setEnrollments(enumData || {});
                
                // Then subscribe to real-time batch updates
                unsubscribe = subscribeToBatches(userProfile.centerId, (batchData) => {
                    setBatches(batchData || []);
                    setLoading(false);
                });
            } catch (error) {
                console.error("Failed to load batches", error);
                setBatches([]);
                setEnrollments({});
                setLoading(false);
            }
        };
        
        load();
        
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [userProfile]);

    const loadBatches = async () => {
        // Keeping this for manual refresh needs, though real-time handles most cases now
        try {
            const enumData = await fetchRealBatchEnrollments(userProfile.centerId);
            setEnrollments(enumData || {});
        } catch (error) {
            console.error(error);
        }
    };`;

content = content.replace(
    /\/\/ Initial Load[\s\S]*?setLoading\(false\);\n    };/g,
    effectReplacement
);

// 4. Update the filteredBatches logic to include searchQuery
const filterReplacement = `                const filteredBatches = batches.filter(b => {
                    const matchesCenter = (!isDirector || viewCenter === 'ALL' || (b.centerId || "UN_COLLEGE").trim() === viewCenter);
                    const matchesSearch = b.name?.toLowerCase().includes(searchQuery.toLowerCase()) || b.course?.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesCenter && matchesSearch;
                });`;

content = content.replace(
    /const filteredBatches = batches\.filter\(b => \(\!isDirector \|\| viewCenter === 'ALL' \|\| \(b\.centerId \|\| "UN_COLLEGE"\)\.trim\(\) === viewCenter\)\);/g,
    filterReplacement
);

const filterReplacement2 = `                        {Array.isArray(batches) && batches.filter(b => {
                            const matchesCenter = (!isDirector || viewCenter === 'ALL' || (b.centerId || "UN_COLLEGE").trim() === viewCenter);
                            const matchesSearch = b.name?.toLowerCase().includes(searchQuery.toLowerCase()) || b.course?.toLowerCase().includes(searchQuery.toLowerCase());
                            return matchesCenter && matchesSearch;
                        }).map(batch => {`;

content = content.replace(
    /\{Array\.isArray\(batches\) && batches\.filter\(b => \{\n\s*if \(!isDirector\) return true;\n\s*if \(viewCenter === 'ALL'\) return true;\n\s*return \(b\.centerId \|\| "UN_COLLEGE"\)\.trim\(\) === viewCenter;\n\s*\}\)\.map\(batch => \{/g,
    filterReplacement2
);

// 5. Add search bar UI
const searchBarInjection = `            </div>

            {/* SEARCH BAR (Added for Batch Search Feature) */}
            <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <input 
                    type="text" 
                    placeholder="Search batches by name or course..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-5 py-3 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-700 transition"
                />
            </div>

            {/* DIRECTOR FILTER */}`;

content = content.replace(
    /<\/div>\n\n\s*\{\/\* DIRECTOR FILTER \*\/\}/g,
    searchBarInjection
);

fs.writeFileSync(file, content, 'utf8');
console.log('BatchManager patched successfully!');
