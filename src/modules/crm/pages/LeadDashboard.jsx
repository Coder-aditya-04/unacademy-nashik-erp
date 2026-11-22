import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { assignLead, deleteLead, subscribeToLeads } from '../../../services/leadService';
import { fetchStaffList } from '../../../services/userService';
import { CENTERS } from '../../../utils/centers'; // Import CENTERS
import { Download } from 'lucide-react';
import { Card, Tile, Count, Empty, Avatar, Contact, Seg, Layer } from '../../../components/j';
import { programLabel } from '../../j/data';
import AddLead from './AddLead'; // Import logic-rich form

const LeadDashboard = ({ userProfile }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [leads, setLeads] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    // Initialize state from sessionStorage or defaults
    const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('lead_search') || "");
    const [viewCenter, setViewCenter] = useState(() => sessionStorage.getItem('lead_center') || 'ALL');
    const [editingLead, setEditingLead] = useState(null);
    const [selectedLeads, setSelectedLeads] = useState([]); // NEW STATE


    const [filterStatus, setFilterStatus] = useState(() => sessionStorage.getItem('lead_filterStatus') || "ALL");
    const [filterSource, setFilterSource] = useState(() => sessionStorage.getItem('lead_filterSource') || "ALL");
    const [startDate, setStartDate] = useState(() => sessionStorage.getItem('lead_startDate') || "");
    const [endDate, setEndDate] = useState(() => sessionStorage.getItem('lead_endDate') || "");
    const [selectedCounselor, setSelectedCounselor] = useState(() => location.state?.filterCounsellorId || sessionStorage.getItem('lead_counselor') || "ALL");
    const [filterBDEName, setFilterBDEName] = useState(() => sessionStorage.getItem('lead_filterBDEName') || "ALL");
    const [currentTime, setCurrentTime] = useState(new Date());
    const [visibleCount, setVisibleCount] = useState(10); // Pagination State

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const greeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    // PERSISTENCE EFFECT
    useEffect(() => {
        sessionStorage.setItem('lead_search', searchTerm);
        sessionStorage.setItem('lead_center', viewCenter);
        sessionStorage.setItem('lead_filterStatus', filterStatus);
        sessionStorage.setItem('lead_filterSource', filterSource);
        sessionStorage.setItem('lead_startDate', startDate);
        sessionStorage.setItem('lead_endDate', endDate);
        sessionStorage.setItem('lead_counselor', selectedCounselor);
        sessionStorage.setItem('lead_filterBDEName', filterBDEName);
    }, [searchTerm, viewCenter, filterStatus, filterSource, startDate, endDate, selectedCounselor, filterBDEName]);

    // Reset pagination when filters change
    useEffect(() => {
        setVisibleCount(10);
    }, [searchTerm, viewCenter, filterStatus, filterSource, startDate, endDate, selectedCounselor, filterBDEName]);

    // Handle incoming router state for Counselor Filtering (e.g., from Leaderboard)
    useEffect(() => {
        if (location.state?.filterCounsellorId) {
            setSelectedCounselor(location.state.filterCounsellorId);
            setViewCenter('ALL'); // Ensure we see their leads across centers if applicable
            setFilterStatus('ALL'); // Clear status filter to see everything
            
            // Clear state so a refresh doesn't re-trigger it unnecessarily
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const isDirector = userProfile?.role?.toUpperCase() === 'DIRECTOR';
    const isManager = userProfile?.role?.toUpperCase() === 'MANAGER';
    const canManageLeads = isDirector || isManager;

    // 1. REAL-TIME Data Load (Replaces old loadData on mount)
    useEffect(() => {
        let unsubscribe = () => { };

        const initData = async () => {
            setLoading(true);

            // SETUP LISTENER
            unsubscribe = subscribeToLeads(userProfile, (updatedLeads) => {
                setLeads(updatedLeads);
                setLoading(false);
            });

            // Staff List Population (Keep one-time load)
            if (isDirector) {
                const allStaff = await fetchStaffList(null);
                setStaffList(allStaff);
            } else if (isManager) {
                if (userProfile.centerId) {
                    const centerStaff = await fetchStaffList(userProfile.centerId);
                    setStaffList(centerStaff);
                }
            }
        };

        if (userProfile) {
            initData();
        }

        return () => unsubscribe(); // Cleanup Listener on Unmount
    }, [userProfile]);

    // Legacy manual reload if needed (though real-time makes it redundant)
    const loadData = () => {
        console.log("Data auto-updates via listener.");
    };

    // Auto-Heal: Fix any leads that have an admission but their status is broken
    useEffect(() => {
        if (!isDirector || !leads || leads.length === 0) return;
        
        const fixBrokenLeads = async () => {
            try {
                const { doc, updateDoc, collection, getDocs, query } = await import('firebase/firestore');
                const { db } = await import('../../../firebase.js');

                // 1. Fix broken assigned statuses (Whitelist REFUNDED)
                const corruptedLeads = leads.filter(l => 
                    l.admissionId && 
                    !['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN', 'CLOSED', 'LOST', 'REJECTED', 'REFUNDED'].includes(l.status)
                );
                
                if (corruptedLeads.length > 0) {
                    console.log(`Auto-healing ${corruptedLeads.length} corrupted leads...`);
                    await Promise.all(corruptedLeads.map(l => 
                        updateDoc(doc(db, "leads", l.id), { status: "CONVERTED" })
                    ));
                }

                // 2. Restore Refunded Leads (In case they were accidentally overwritten to CONVERTED)
                const admissionsSnap = await getDocs(query(collection(db, "admissions")));
                const allAdmissions = admissionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const refundedAdmissions = allAdmissions.filter(a => a.status === 'REFUNDED');
                
                const leadsToRestore = leads.filter(l => 
                    l.status === 'CONVERTED' && 
                    refundedAdmissions.some(a => a.leadId === l.id || l.admissionId === a.id)
                );

                if (leadsToRestore.length > 0) {
                    console.log(`Restoring ${leadsToRestore.length} refunded leads...`);
                    await Promise.all(leadsToRestore.map(l => 
                        updateDoc(doc(db, "leads", l.id), { status: "REFUNDED" })
                    ));
                }

                // 3. Sync Center Mismatches (If CRM lead was reassigned to a different center, move the admission too)
                const { CENTERS } = await import('../../../utils/centers.js');
                const mismatchedAdmissions = allAdmissions.filter(a => {
                    if (!a.leadId) return false;
                    const matchingLead = leads.find(l => l.id === a.leadId);
                    if (!matchingLead) return false;
                    // If the lead was moved to a new center, but the admission didn't follow
                    return matchingLead.centerId && a.centerId !== matchingLead.centerId;
                });

                if (mismatchedAdmissions.length > 0) {
                    console.log(`Syncing centers for ${mismatchedAdmissions.length} mismatched admissions...`);
                    await Promise.all(mismatchedAdmissions.map(a => {
                        const matchingLead = leads.find(l => l.id === a.leadId);
                        return updateDoc(doc(db, "admissions", a.id), { 
                            centerId: matchingLead.centerId,
                            centerName: CENTERS[matchingLead.centerId]?.name || matchingLead.centerId
                        });
                    }));
                }
                
                if (corruptedLeads.length > 0 || leadsToRestore.length > 0 || mismatchedAdmissions.length > 0) {
                    console.log("Auto-heal complete!");
                }
            } catch (e) {
                console.error("Auto-heal failed:", e);
            }
        };

        fixBrokenLeads();
    }, [leads, isDirector]);

    // 2. Handle Assignment
    const handleAssignChange = async (leadId, staffId) => {
        if (!staffId) return;
        const selectedStaff = staffList.find(s => s.uid === staffId);
        if (window.confirm(`Assign this lead to ${selectedStaff.name}?`)) {
            const result = await assignLead(leadId, selectedStaff, userProfile.name);
            if (result.success) loadData(); // Log only
            else alert(`Assignment Failed: ${result.error}`);
        }
    };

    // 2.5 Handle Delete
    const handleDelete = async (leadId, e) => {
        e.stopPropagation(); // Prevent row click
        
        const leadToDelete = leads.find(l => l.id === leadId);
        if (leadToDelete?.status === 'CONVERTED' && userProfile?.role === 'manager') {
            alert("Managers cannot delete CONVERTED leads. Please contact the Director.");
            return;
        }

        if (window.confirm("Are you sure you want to DELETE this lead? This action cannot be undone.")) {
            const result = await deleteLead(leadId);
            if (result.success) {
                alert("Lead deleted successfully.");
                // loadData(); // Auto updates
            } else {
                alert("Failed to delete lead: " + result.error);
            }
        }
    };

    // 2.6 Handle Edit
    const handleEdit = (lead, e) => {
        e.stopPropagation();
        setEditingLead(lead);
    };

    // 2.7 Bulk Actions
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            // Select all currently filtered leads
            const allIds = filteredLeads.map(l => l.id);
            setSelectedLeads(allIds);
        } else {
            setSelectedLeads([]);
        }
    };

    const handleSelectRow = (e, leadId) => {
        e.stopPropagation();
        if (e.target.checked) {
            setSelectedLeads(prev => [...prev, leadId]);
        } else {
            setSelectedLeads(prev => prev.filter(id => id !== leadId));
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedLeads.length) return;
        
        if (userProfile?.role === 'manager') {
            const hasConverted = selectedLeads.some(id => {
                const l = leads.find(lead => lead.id === id);
                return l?.status === 'CONVERTED';
            });
            if (hasConverted) {
                alert("You have selected one or more CONVERTED leads. Managers cannot delete CONVERTED leads. Please deselect them and try again.");
                return;
            }
        }

        if (window.confirm(`Are you sure you want to DELETE ${selectedLeads.length} selected lead(s)? This action cannot be undone.`)) {
            setLoading(true);
            try {
                await Promise.all(selectedLeads.map(id => deleteLead(id)));
                setSelectedLeads([]);
                alert(`Successfully deleted ${selectedLeads.length} lead(s).`);
            } catch (err) {
                alert(`Error during bulk delete: ${err.message}`);
            }
            setLoading(false);
        }
    };

    const handleBulkAssign = async (staffId) => {
        if (!staffId || !selectedLeads.length) return;
        const selectedStaff = staffList.find(s => s.uid === staffId);
        
        if (window.confirm(`Assign ${selectedLeads.length} lead(s) to ${selectedStaff.name}?`)) {
            setLoading(true);
            try {
                // assignLead requires (leadId, staffObj, assignedBy)
                await Promise.all(selectedLeads.map(id => assignLead(id, selectedStaff, userProfile.name)));
                setSelectedLeads([]);
                alert(`Successfully assigned ${selectedLeads.length} lead(s).`);
            } catch (err) {
                alert(`Error during bulk assignment: ${err.message}`);
            }
            setLoading(false);
        }
    };



    // 3. Filter Leads
    // Defensive check: Ensure leads is an array before filtering
    const safeLeads = Array.isArray(leads) ? leads : [];

    const filteredLeads = safeLeads.filter(l => {
        if (!l) return false; // Skip null leads
        const name = l.studentName ? String(l.studentName).toLowerCase() : "";
        const phone = l.phone ? String(l.phone) : "";

        const matchesSearch = name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm);

        let matchesStatus = true;
        if (filterStatus === "PENDING_ALL") { // NEW: Special Filter for "Pending Follow Ups" Card
            const isConverted = ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN', 'CLOSED', 'LOST', 'REJECTED'].includes(l.status);
            if (isConverted) {
                matchesStatus = false;
            } else {
                // Date Check
                const localDate = new Date();
                const todayStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                // Match if explicitly 'FOLLOW_UP' OR has a due date in past/today
                matchesStatus = l.status === 'FOLLOW_UP' || (l.nextFollowUp && l.nextFollowUp <= todayStr);
            }
        } else {
            // Standard equality check for other statuses
            matchesStatus = filterStatus === "ALL" || l.status === filterStatus;
        }

        const matchesSource = filterSource === "ALL" || l.source === filterSource;

        // Date Filter
        let matchesDate = true;
        if (startDate || endDate) {
            let leadDate = "";
            // Handle Timestamp or String
            if (l.createdAt?.seconds) {
                // Use Local Time (en-CA gives YYYY-MM-DD)
                const d = new Date(l.createdAt.seconds * 1000);
                leadDate = d.toLocaleDateString('en-CA');
            } else if (typeof l.createdAt === 'string') {
                leadDate = l.createdAt.split('T')[0];
            }

            if (leadDate) {
                if (startDate && leadDate < startDate) matchesDate = false;
                if (endDate && leadDate > endDate) matchesDate = false;
            }
        }

        // Counselor Filter (Assigned To)
        let matchesCounselor = true;
        if (canManageLeads && selectedCounselor !== "ALL") {
            const currentStaff = staffList.find(s => s.uid === selectedCounselor);
            const staffName = currentStaff ? currentStaff.name : ""; // Get Name for Fallback Match

            // Helper to check if string is a valid Firebase UID
            const isUid = (str) => str && str.length > 20 && !str.includes(' ');
            const hasValidUid = isUid(l.assignedTo);

            // Match by UID (New System) OR Match by Name (Legacy System)
            matchesCounselor = (l.assignedTo === selectedCounselor) ||
                (!hasValidUid && staffName && l.assignedByName === staffName);
        }

        // Director Center Filter
        // FIX: If a specific counselor is selected, show ALL their leads regardless of Center (to match Staff View)
        let matchesCenter = true;
        if (isDirector && viewCenter !== 'ALL') {
            // If we are filtering by a specific counselor, we allow their leads from ANY center to show
            // Otherwise, we strictly filter by the selected center
            if (selectedCounselor !== "ALL" && matchesCounselor) {
                matchesCenter = true;
            } else {
                matchesCenter = (l.centerId || "").trim() === viewCenter;
            }
        }

        // BDE Name Filter (Source Details)
        let matchesBDEName = true;
        if (filterBDEName !== "ALL") {
            // Check if source matches BDE (optional, but safer) and name matches
            const bdeName = l.bdeName || (typeof l.sourceDetails === 'string' ? l.sourceDetails : (l.sourceDetails?.enteredBy || ""));
            matchesBDEName = (l.source === 'BDE' && bdeName === filterBDEName);
        }

        return matchesSearch && matchesStatus && matchesSource && matchesCenter && matchesDate && matchesCounselor && matchesBDEName;
    });

    // Extract Unique BDE Names for Filter
    const bdeNames = [...new Set(safeLeads
        .filter(l => l.source === 'BDE')
        .map(l => l.bdeName || (typeof l.sourceDetails === 'string' ? l.sourceDetails : l.sourceDetails?.enteredBy))
    )].sort();

    // New: Export to CSV
    const exportToCSV = () => {
        if (filteredLeads.length === 0) return alert("No data to export!");

        const headers = [
            "Date", 
            "Student Name", 
            "Phone", 
            "Parent Phone",
            "Board",
            "Current Standard",
            "Previous School",
            "Course Interest", 
            "Source", 
            "Source Location / Details",
            "BDE Name",
            "Address / City",
            "Status", 
            "Assigned To Name", 
            "Center"
        ];

        const rows = filteredLeads.map(l => {
            const dateStr = l.createdAt?.seconds
                ? new Date(l.createdAt.seconds * 1000).toLocaleDateString('en-IN')
                : (l.createdAt || '-');

            const sourceLocation = l.location || l.sourceDetails?.location || (typeof l.sourceDetails === 'string' ? l.sourceDetails : '');
            const bdeName = l.bdeName || l.sourceDetails?.enteredBy || '';
            const previousSchool = l.school || l.sourceDetails?.school || '';
            const addressCity = [l.address, l.city].filter(Boolean).join(', ');

            return [
                `"${dateStr}"`,
                `"${(l.studentName || '').replace(/"/g, '""')}"`,
                `"${l.phone || ''}"`,
                `"${l.parentPhone || ''}"`,
                `"${(l.board || '').replace(/"/g, '""')}"`,
                `"${(l.currentStandard || l.currentClass || '').replace(/"/g, '""')}"`,
                `"${previousSchool.replace(/"/g, '""')}"`,
                `"${(l.courseInterest || l.course || '').replace(/"/g, '""')}"`,
                `"${l.source || ''}"`,
                `"${sourceLocation.replace(/"/g, '""')}"`,
                `"${bdeName.replace(/"/g, '""')}"`,
                `"${addressCity.replace(/"/g, '""')}"`,
                `"${(l.status || '').replace(/"/g, '""')}"`,
                `"${(l.assignedByName || 'Unassigned').replace(/"/g, '""')}"`,
                `"${l.centerId || ''}"`
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `crm_leads_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    // 4. Calculate Stats
    const stats = {
        total: filteredLeads.length,
        followUps: filteredLeads.filter(l => {
            const isConverted = ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN', 'CLOSED', 'LOST', 'REJECTED'].includes(l.status);
            if (isConverted) return false; // Don't count converted/rejected leads as pending

            // Date Check (Local Date String Comparison)
            const localDate = new Date();
            const todayStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

            return l.status === 'FOLLOW_UP' || (l.nextFollowUp && l.nextFollowUp <= todayStr);
        }).length,
        newLeads: filteredLeads.filter(l => l.status === 'NEW').length,
        converted: filteredLeads.filter(l => ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN'].includes(l.status)).length,
        underVerification: filteredLeads.filter(l => l.status === 'UNDER_VERIFICATION').length
    };

    const STATUS_BG = { REJECTED: 'var(--t-coral)', REFUNDED: 'var(--t-coral)', NEW: 'var(--t-lilac)', UNDER_VERIFICATION: 'var(--t-butter)', FOLLOW_UP: 'var(--t-butter)', ASSIGNED: 'var(--t-blue)' };
    const statusText = (st) => String(st || 'NEW').replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
    const sel = 'jb-input !w-auto !py-2 !rounded-full text-[13px] font-semibold';
    const dupPhones = {};
    safeLeads.forEach(l => { const ph = String(l.phone || '').trim(); if (ph.length > 5) dupPhones[ph] = (dupPhones[ph] || 0) + 1; });
    const first = (userProfile?.name || 'there').split(' ')[0];
    const tiles = [
        ['ALL', 'lilac', '📥', 'All enquiries', stats.total],
        ['PENDING_ALL', 'butter', '⏰', 'Follow-ups due', stats.followUps],
        ['NEW', 'blue', '✨', 'New', stats.newLeads],
        ['CONVERTED', 'sage', '🎓', 'Converted', stats.converted],
        ['UNDER_VERIFICATION', 'coral', '🧾', 'With Accounts', stats.underVerification],
    ];
    const cols = canManageLeads
        ? 'grid-cols-[24px_minmax(0,1fr)_auto] lg:grid-cols-[24px_minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_120px_minmax(0,1.5fr)_150px]'
        : 'grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_120px_minmax(0,1.3fr)_88px]';

    return (
        <div className="flex flex-col gap-4">
            {editingLead && (
                <Layer>
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 shell-fade" style={{ background: 'rgba(17,25,21,.4)' }}>
                        <div className="max-w-2xl w-full">
                            <AddLead userProfile={userProfile} initialData={Object.keys(editingLead).length > 0 ? editingLead : null}
                                onClose={() => setEditingLead(null)} onSuccess={() => setEditingLead(null)} />
                        </div>
                    </div>
                </Layer>
            )}

            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>{currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    <h1 className="text-[30px] sm:text-[34px] font-extrabold tracking-tight leading-tight">{greeting().replace(/ (\w)/, (m, c) => ' ' + c.toLowerCase())}, {first}</h1>
                    <p className="text-[13.5px]" style={{ color: 'var(--muted)' }}>{loading ? 'Loading enquiries…' : `${filteredLeads.length} enquiries · tap one to open it`}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={exportToCSV} className="jb-act jb-act-soft"><Download className="w-4 h-4" /> Export</button>
                    <button type="button" onClick={() => setEditingLead({})} className="jb-act jb-act-ink">＋ New enquiry</button>
                </div>
            </div>

            {isDirector && (
                <div className="max-w-full overflow-x-auto jb-scroll self-start"><Seg label="Centre" value={viewCenter} onChange={setViewCenter} size="sm"
                    options={[{ value: 'ALL', label: 'All centres' }, { value: 'UN_COLLEGE', label: 'College Road' }, { value: 'UN_NASHIK_RD', label: 'Nashik Road' }, { value: 'PRAYAS', label: 'Prayaas' }]} /></div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {tiles.map(([key, tone, emoji, title, value], k) => (
                    <div key={key} className="[&>*]:h-full [&>*]:w-full rounded-[24px] transition-shadow" style={{ boxShadow: filterStatus === key ? '0 0 0 2.5px var(--ink)' : 'none' }}>
                        <Tile tone={tone} emoji={emoji} title={title} value={<Count value={value} />} sub={filterStatus === key ? 'Showing these' : 'Tap to filter'} size="sm" delay={k * 40} onClick={() => setFilterStatus(key)} />
                    </div>
                ))}
            </div>

            <Card pad={16}>
                <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
                    <label className="flex items-center gap-2 flex-1 rounded-full px-4 h-[44px]" style={{ background: 'var(--cream)', boxShadow: '0 0 0 1px var(--line)' }}>
                        <span aria-hidden="true">🔎</span><span className="sr-only">Search enquiries</span>
                        <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Name or phone" className="flex-1 min-w-0 outline-none text-[14px]" style={{ border: 0, boxShadow: 'none', background: 'transparent' }} />
                    </label>
                    <div className="flex flex-wrap gap-2 items-center">
                        <select aria-label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={sel}>
                            <option value="ALL">All statuses</option><option value="PENDING_ALL">Follow-ups due</option><option value="NEW">New</option><option value="FOLLOW_UP">Follow up</option>
                            <option value="CONVERTED">Converted</option><option value="UNDER_VERIFICATION">With Accounts</option><option value="REFUNDED">Refunded</option><option value="ASSIGNED">Assigned</option>
                            <option value="VISITED">Visited</option><option value="COUNSELLING_DONE">Counselling done</option><option value="REJECTED">Rejected</option>
                        </select>
                        <select aria-label="Source" value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className={sel}>
                            <option value="ALL">All sources</option><option value="Walk-in">Walk-in</option><option value="Website">Website</option><option value="Referral">Referral</option><option value="Social Media">Social media</option>
                        </select>
                        {bdeNames.length > 0 && (
                            <select aria-label="BDE" value={filterBDEName} onChange={(e) => setFilterBDEName(e.target.value)} className={`${sel} max-w-[180px]`}>
                                <option value="ALL">All BDEs</option>{bdeNames.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        )}
                        {canManageLeads && (
                            <select aria-label="Counsellor" value={selectedCounselor} onChange={(e) => setSelectedCounselor(e.target.value)} className={`${sel} max-w-[200px]`}>
                                <option value="ALL">All counsellors</option>{staffList.map(st => <option key={st.uid} value={st.uid}>{st.name}</option>)}
                            </select>
                        )}
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

            {canManageLeads && selectedLeads.length > 0 && (
                <div className="jb-pop flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl" style={{ background: 'var(--ink)', color: 'var(--on-ink)' }}>
                    <span className="text-[14px] font-bold">{selectedLeads.length} selected <button type="button" onClick={() => setSelectedLeads([])} className="ml-2 text-[12.5px] underline opacity-80">Clear</button></span>
                    <div className="flex flex-wrap gap-2">
                        <select aria-label="Send selected to" value="" onChange={(e) => handleBulkAssign(e.target.value)} className="jb-input !w-auto !py-2 !rounded-full text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                            <option value="" disabled>Send to counsellor…</option>{staffList.map(st => <option key={st.uid} value={st.uid}>{st.name}</option>)}
                        </select>
                        <button type="button" onClick={handleBulkDelete} className="jb-act !py-2" style={{ background: 'var(--t-coral)', color: 'var(--ink)' }}>Delete</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="j-sk h-[72px]" />)}</div>
            ) : filteredLeads.length === 0 ? (
                <Card><Empty emoji="🔍">No enquiries match these filters.</Empty></Card>
            ) : (
                <Card pad={8}>
                    <div className={`hidden lg:grid gap-3 px-4 py-2 text-[12px] font-bold items-center ${cols}`} style={{ color: 'var(--muted)' }}>
                        {canManageLeads && <input type="checkbox" aria-label="Select all" checked={selectedLeads.length > 0 && selectedLeads.length === filteredLeads.length} onChange={handleSelectAll} className="w-4 h-4" />}
                        <span>Student</span><span>Course</span><span>Source</span><span>Status</span><span>Counsellor</span><span />
                    </div>
                    <ul className="flex flex-col">
                        {filteredLeads.slice(0, visibleCount).map((lead, k) => {
                            const ms = lead.createdAt?.seconds ? lead.createdAt.seconds * 1000 : null;
                            const dup = (dupPhones[String(lead.phone || '').trim()] || 0) > 1;
                            const src = lead.bdeName || (typeof lead.sourceDetails === 'string' ? lead.sourceDetails : (lead.sourceDetails?.enteredBy || ''));
                            const open = () => navigate(`/staff/leads/${lead.id}`);
                            return (
                                <li key={lead.id} role="link" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
                                    className={`jb-rise cursor-pointer grid gap-x-3 gap-y-2 items-center px-4 py-3 rounded-2xl hover:bg-[var(--cream)] ${cols}`}
                                    style={{ borderTop: k ? '1px solid var(--track)' : 'none', animationDelay: `${Math.min(k, 8) * 30}ms` }}>
                                    {canManageLeads && <span onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${lead.studentName}`} checked={selectedLeads.includes(lead.id)} onChange={(e) => handleSelectRow(e, lead.id)} className="w-4 h-4" /></span>}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar name={lead.studentName} size={38} />
                                        <div className="min-w-0">
                                            <b className="block text-[14.5px] truncate">{lead.studentName || 'No name'}</b>
                                            <span className="block text-[12px] truncate" style={{ color: 'var(--muted)' }}>{[lead.phone || 'No phone', ms ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''].filter(Boolean).join(' · ')}
                                                {dup && <span className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--t-coral)', color: 'var(--ink)' }}>Duplicate</span>}</span>
                                        </div>
                                    </div>
                                    <span className="hidden lg:block text-[13px] font-semibold truncate">{programLabel(lead.courseInterest) || '—'}</span>
                                    <span className="hidden lg:block text-[12.5px] min-w-0"><b className="block truncate">{lead.source || '—'}</b><span className="block truncate" style={{ color: 'var(--muted)' }}>{src}</span></span>
                                    <span className="justify-self-end lg:justify-self-start text-[11.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: STATUS_BG[lead.status] || 'var(--t-sage)' }}>{statusText(lead.status)}</span>
                                    <div className={`min-w-0 ${canManageLeads ? 'col-start-2 lg:col-start-auto' : ''}`} onClick={(e) => { if (isDirector || isManager) e.stopPropagation(); }}>
                                        {isDirector || isManager ? (
                                            <select aria-label={`Counsellor for ${lead.studentName}`} value={lead.assignedTo || ''} onChange={(e) => handleAssignChange(lead.id, e.target.value)} className="jb-input !py-1.5 !rounded-full text-[12.5px] font-semibold">
                                                <option value="" disabled>Send to…</option>
                                                {lead.assignedTo && !staffList.find(st => st.uid === lead.assignedTo) && <option value={lead.assignedTo} disabled>{lead.assignedByName || 'Unknown'} (not in list)</option>}
                                                {staffList.map(st => <option key={st.uid} value={st.uid}>{st.name}{isDirector && st.centerId ? ` · ${st.centerId.replace('UN_', '').replace('_', ' ')}` : ''}</option>)}
                                            </select>
                                        ) : <span className="text-[12.5px] font-semibold truncate block" style={{ color: 'var(--muted)' }}>{lead.assignedByName || 'Not assigned'}</span>}
                                    </div>
                                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                        <Contact name={lead.studentName} phone={lead.parentPhone || lead.phone} size="sm" />
                                        {canManageLeads && (
                                            <>
                                                <button type="button" onClick={(e) => handleEdit(lead, e)} aria-label={`Edit ${lead.studentName}`} className="w-8 h-8 rounded-full text-[13px]" style={{ background: 'var(--cream)' }}>✏️</button>
                                                <button type="button" onClick={(e) => handleDelete(lead.id, e)} aria-label={`Delete ${lead.studentName}`} className="w-8 h-8 rounded-full text-[13px]" style={{ background: 'var(--t-coral)' }}>🗑️</button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    {visibleCount < filteredLeads.length && (
                        <div className="p-3 text-center"><button type="button" onClick={() => setVisibleCount(v => v + 20)} className="jb-act jb-act-soft">Show more ({filteredLeads.length - visibleCount} left)</button></div>
                    )}
                </Card>
            )}
        </div>
    );
};

export default LeadDashboard;
