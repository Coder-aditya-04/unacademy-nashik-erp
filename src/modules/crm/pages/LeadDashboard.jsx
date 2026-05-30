import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLeads, assignLead, deleteLead, subscribeToLeads } from '../../../services/leadService';
import { fetchStaffList } from '../../../services/userService';
import { CENTERS } from '../../../utils/centers'; // Import CENTERS
import { Users, Filter, Search, UserCheck, Clock, AlertCircle, CheckCircle, Trash2, Edit, Download, ShieldAlert, Database, Sparkles, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import AddLead from './AddLead'; // Import logic-rich form

const LeadDashboard = ({ userProfile }) => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    // Initialize state from sessionStorage or defaults
    const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('lead_search') || "");
    const [viewCenter, setViewCenter] = useState(() => sessionStorage.getItem('lead_center') || 'ALL');
    const [editingLead, setEditingLead] = useState(null);
    const [selectedLeads, setSelectedLeads] = useState([]); // NEW STATE
    const [showIntegrityModal, setShowIntegrityModal] = useState(false);
    const [integrityStatus, setIntegrityStatus] = useState({
        scanned: false,
        loading: false,
        missing: [],
        duplicates: [],
        orphanedLeads: [],
        sharedLeads: [],
        totalAdmissions: 0,
        totalLeads: 0
    });


    const [filterStatus, setFilterStatus] = useState(() => sessionStorage.getItem('lead_filterStatus') || "ALL");
    const [filterSource, setFilterSource] = useState(() => sessionStorage.getItem('lead_filterSource') || "ALL");
    const [startDate, setStartDate] = useState(() => sessionStorage.getItem('lead_startDate') || "");
    const [endDate, setEndDate] = useState(() => sessionStorage.getItem('lead_endDate') || "");
    const [selectedCounselor, setSelectedCounselor] = useState(() => sessionStorage.getItem('lead_counselor') || "ALL");
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

    const performDatabaseDiagnostic = async () => {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('../../../firebase');

        const admissionsSnap = await getDocs(collection(db, "admissions"));
        const leadsSnap = await getDocs(collection(db, "leads"));

        const allAdmissions = admissionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const allLeads = leadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const activeAdmissions = allAdmissions.filter(adm => 
            ['ACTIVE', 'TOKEN_PAID', 'COMPLETED', 'PENDING_APPROVAL'].includes(adm.status)
        );

        const leadsMap = new Map();
        allLeads.forEach(lead => {
            leadsMap.set(lead.id, lead);
        });

        const missing = [];
        activeAdmissions.forEach(adm => {
            const leadId = adm.leadId;
            const hasLead = leadId && leadsMap.has(leadId);
            
            if (!hasLead) {
                const matchingLeads = allLeads.filter(l => 
                    l.phone && adm.phone && String(l.phone).replace(/\D/g, '').slice(-10) === String(adm.phone).replace(/\D/g, '').slice(-10)
                );
                
                if (matchingLeads.length > 0) {
                    missing.push({
                        admission: adm,
                        type: 'MISALIGNED_LEAD_ID',
                        matchingLeadId: matchingLeads[0].id,
                        matchingLead: matchingLeads[0]
                    });
                } else {
                    missing.push({
                        admission: adm,
                        type: 'MISSING_LEAD'
                    });
                }
            } else {
                const lead = leadsMap.get(leadId);
                const isConverted = ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN'].includes(lead.status);
                if (!isConverted) {
                    missing.push({
                        admission: adm,
                        type: 'STATUS_MISMATCH',
                        matchingLeadId: leadId,
                        matchingLead: lead
                    });
                }
            }
        });

        const duplicates = [];
        const grouped = {};
        activeAdmissions.forEach(adm => {
            if (!adm.phone) return;
            const phoneDigits = String(adm.phone).replace(/\D/g, '').slice(-10);
            if (!phoneDigits || phoneDigits.length < 10) return;
            
            const course = (adm.program || adm.courseInterest || adm.course || '').trim().toLowerCase();
            const name = (adm.studentName || '').trim().toLowerCase().split(' ')[0] || '';
            
            const key = `${phoneDigits}_${course}_${name}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(adm);
        });

        Object.keys(grouped).forEach(key => {
            if (grouped[key].length > 1) {
                const sorted = [...grouped[key]].sort((a, b) => {
                    const paymentsA = a.payments?.length || 0;
                    const paymentsB = b.payments?.length || 0;
                    if (paymentsB !== paymentsA) return paymentsB - paymentsA;
                    
                    const paidA = Number(a.totalPaid || 0);
                    const paidB = Number(b.totalPaid || 0);
                    if (paidB !== paidA) return paidB - paidA;
                    
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeA - timeB;
                });
                
                duplicates.push({
                    original: sorted[0],
                    dupes: sorted.slice(1),
                    key
                });
            }
        });

        const orphanedLeads = [];
        const convertedLeads = allLeads.filter(l => ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN'].includes(l.status));
        
        convertedLeads.forEach(lead => {
            const hasAdmission = activeAdmissions.some(adm => 
                adm.leadId === lead.id || 
                (adm.phone && lead.phone && String(adm.phone).replace(/\D/g, '').slice(-10) === String(lead.phone).replace(/\D/g, '').slice(-10))
            );
            
            if (!hasAdmission) {
                orphanedLeads.push(lead);
            }
        });

        // Find converted leads with multiple active/pending admissions (Shared Leads)
        const sharedLeads = [];
        const leadAdmissionsMap = new Map();
        
        activeAdmissions.forEach(adm => {
            let matchingLead = null;
            if (adm.leadId) {
                matchingLead = leadsMap.get(adm.leadId);
            }
            if (!matchingLead && adm.phone) {
                const phoneClean = String(adm.phone).replace(/\D/g, '').slice(-10);
                matchingLead = convertedLeads.find(l => 
                    l.phone && String(l.phone).replace(/\D/g, '').slice(-10) === phoneClean
                );
            }
            
            if (matchingLead && ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN'].includes(matchingLead.status)) {
                if (!leadAdmissionsMap.has(matchingLead.id)) {
                    leadAdmissionsMap.set(matchingLead.id, {
                        lead: matchingLead,
                        admissions: []
                    });
                }
                leadAdmissionsMap.get(matchingLead.id).admissions.push(adm);
            }
        });
        
        for (const [leadId, entry] of leadAdmissionsMap.entries()) {
            if (entry.admissions.length > 1) {
                sharedLeads.push(entry);
            }
        }

        return {
            missing,
            duplicates,
            orphanedLeads,
            sharedLeads,
            totalAdmissions: activeAdmissions.length,
            totalLeads: convertedLeads.length
        };
    };

    const handleRestoreLead = async (item) => {
        const { doc, setDoc, updateDoc, Timestamp } = await import('firebase/firestore');
        const { db } = await import('../../../firebase');
        
        const adm = item.admission;
        
        if (item.type === 'STATUS_MISMATCH') {
            await updateDoc(doc(db, "leads", item.matchingLeadId), {
                status: 'CONVERTED',
                lastUpdated: Timestamp.now()
            });
        } else if (item.type === 'MISALIGNED_LEAD_ID') {
            await updateDoc(doc(db, "admissions", adm.id), {
                leadId: item.matchingLeadId,
                lastUpdated: Timestamp.now()
            });
        } else {
            const newLeadId = adm.leadId || `lead-auto-${adm.id}`;
            const leadRef = doc(db, "leads", newLeadId);
            
            const restoredLeadData = {
                studentName: adm.studentName,
                phone: adm.phone || "",
                parentPhone: adm.parentPhone || "",
                courseInterest: adm.program || adm.courseInterest || adm.course || "",
                status: 'CONVERTED',
                source: adm.source || 'Website',
                sourceDetails: adm.sourceDetails || {
                    role: 'Student',
                    enteredBy: 'Self-Healing Restore',
                    location: 'Restored from Admission'
                },
                centerId: adm.centerId || "UN_COLLEGE",
                assignedTo: adm.counsellorId || adm.bookedById || "",
                assignedByName: adm.counsellorName || adm.bookedBy || "Unknown Staff",
                admissionId: adm.id,
                createdAt: adm.createdAt || Timestamp.now(),
                lastUpdated: Timestamp.now(),
                timeline: [
                    {
                        type: "CREATED",
                        message: "Lead document recreated via self-healing recovery script",
                        date: new Date(),
                        by: "System Self-Healing"
                    },
                    {
                        type: "ADMISSION_TAKEN",
                        message: `Admission linked: ${adm.id}`,
                        date: new Date(),
                        by: "System Self-Healing"
                    }
                ]
            };
            
            await setDoc(leadRef, restoredLeadData);
            
            if (!adm.leadId) {
                await updateDoc(doc(db, "admissions", adm.id), {
                    leadId: newLeadId,
                    lastUpdated: Timestamp.now()
                });
            }
        }
    };

    const handleDeleteDuplicate = async (dupeAdmission) => {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { db } = await import('../../../firebase');
        await deleteDoc(doc(db, "admissions", dupeAdmission.id));
    };

    const handleResetOrphanedLead = async (leadId, newStatus = 'FOLLOW_UP') => {
        const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
        const { db } = await import('../../../firebase');
        await updateDoc(doc(db, "leads", leadId), {
            status: newStatus,
            lastUpdated: Timestamp.now()
        });
    };

    const runAutoHealing = async () => {
        const { updateDoc, doc, setDoc, deleteDoc, Timestamp } = await import('firebase/firestore');
        const { db } = await import('../../../firebase');
        const { clearAdmissionsCache, clearLeadsCache } = await import('../../../services/cacheService');

        let restoredCount = 0;
        let alignedCount = 0;
        let deletedDupesCount = 0;

        for (const item of integrityStatus.missing) {
            const adm = item.admission;
            if (item.type === 'STATUS_MISMATCH') {
                await updateDoc(doc(db, "leads", item.matchingLeadId), {
                    status: 'CONVERTED',
                    lastUpdated: Timestamp.now()
                });
                alignedCount++;
            } else if (item.type === 'MISALIGNED_LEAD_ID') {
                await updateDoc(doc(db, "admissions", adm.id), {
                    leadId: item.matchingLeadId,
                    lastUpdated: Timestamp.now()
                });
                alignedCount++;
            } else {
                const newLeadId = adm.leadId || `lead-auto-${adm.id}`;
                const leadRef = doc(db, "leads", newLeadId);
                
                const restoredLeadData = {
                    studentName: adm.studentName,
                    phone: adm.phone || "",
                    parentPhone: adm.parentPhone || "",
                    courseInterest: adm.program || adm.courseInterest || adm.course || "",
                    status: 'CONVERTED',
                    source: adm.source || 'Website',
                    sourceDetails: adm.sourceDetails || {
                        role: 'Student',
                        enteredBy: 'Self-Healing Restore',
                        location: 'Restored from Admission'
                    },
                    centerId: adm.centerId || "UN_COLLEGE",
                    assignedTo: adm.counsellorId || adm.bookedById || "",
                    assignedByName: adm.counsellorName || adm.bookedBy || "Unknown Staff",
                    admissionId: adm.id,
                    createdAt: adm.createdAt || Timestamp.now(),
                    lastUpdated: Timestamp.now(),
                    timeline: [
                        {
                            type: "CREATED",
                            message: "Lead document recreated via self-healing recovery script",
                            date: new Date(),
                            by: "System Self-Healing"
                        },
                        {
                            type: "ADMISSION_TAKEN",
                            message: `Admission linked: ${adm.id}`,
                            date: new Date(),
                            by: "System Self-Healing"
                        }
                    ]
                };
                
                await setDoc(leadRef, restoredLeadData);
                
                await updateDoc(doc(db, "admissions", adm.id), {
                    leadId: newLeadId,
                    lastUpdated: Timestamp.now()
                });
                restoredCount++;
            }
        }

        for (const group of integrityStatus.duplicates) {
            for (const dupe of group.dupes) {
                await deleteDoc(doc(db, "admissions", dupe.id));
                deletedDupesCount++;
            }
        }

        let resetOrphanedCount = 0;
        for (const lead of integrityStatus.orphanedLeads) {
            await updateDoc(doc(db, "leads", lead.id), {
                status: 'FOLLOW_UP',
                lastUpdated: Timestamp.now()
            });
            resetOrphanedCount++;
        }

        clearAdmissionsCache();
        clearLeadsCache();

        const newResults = await performDatabaseDiagnostic();
        setIntegrityStatus({
            scanned: true,
            loading: false,
            missing: newResults.missing,
            duplicates: newResults.duplicates,
            orphanedLeads: newResults.orphanedLeads,
            sharedLeads: newResults.sharedLeads,
            totalAdmissions: newResults.totalAdmissions,
            totalLeads: newResults.totalLeads
        });

        return {
            restoredCount,
            alignedCount,
            deletedDupesCount,
            resetOrphanedCount
        };
    };

    useEffect(() => {
        const runSilentScan = async () => {
            if (!userProfile || userProfile.role?.toUpperCase() !== 'DIRECTOR') return;
            try {
                const results = await performDatabaseDiagnostic();
                setIntegrityStatus({
                    scanned: true,
                    loading: false,
                    missing: results.missing,
                    duplicates: results.duplicates,
                    orphanedLeads: results.orphanedLeads,
                    sharedLeads: results.sharedLeads,
                    totalAdmissions: results.totalAdmissions,
                    totalLeads: results.totalLeads
                });
            } catch (err) {
                console.error("Silent integrity scan failed:", err);
            }
        };

        runSilentScan();
    }, [userProfile]);


    // Legacy manual reload if needed (though real-time makes it redundant)
    const loadData = () => {
        console.log("Data auto-updates via listener.");
    };

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

    // Helper for Premium Card Styles (Director Theme)
    const getCardStyle = (type) => {
        switch (type) {
            case 'revenue': return "bg-gradient-to-br from-white to-blue-50 border-blue-100 shadow-blue-100/50";
            case 'new': return "bg-gradient-to-br from-white to-green-50 border-green-100 shadow-green-100/50"; // Mapped 'today' to 'new' concept
            case 'students': return "bg-gradient-to-br from-white to-purple-50 border-purple-100 shadow-purple-100/50";
            case 'pending': return "bg-gradient-to-br from-white to-red-50 border-red-100 shadow-red-100/50";
            default: return "bg-white";
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

        const headers = ["Date", "Student Name", "Phone", "Source", "Source Details", "Course", "Status", "Assigned To Name", "Assigned To ID", "Center"];

        const rows = filteredLeads.map(l => {
            const dateStr = l.createdAt?.seconds
                ? new Date(l.createdAt.seconds * 1000).toLocaleDateString('en-IN')
                : (l.createdAt || '-');

            return [
                `"${dateStr}"`,
                `"${l.studentName || ''}"`,
                `"${l.phone || ''}"`,
                `"${l.source || ''}"`,
                `"${l.source || ''}"`,
                `"${l.bdeName || (typeof l.sourceDetails === 'string' ? l.sourceDetails : (l.sourceDetails?.enteredBy || ""))}"`,
                `"${l.courseInterest || ''}"`,
                `"${l.courseInterest || ''}"`,
                `"${l.status || ''}"`,
                `"${l.assignedByName || 'Unassigned'}"`,
                `"${l.assignedTo || ''}"`,
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
        converted: filteredLeads.filter(l => ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN'].includes(l.status)).length
    };

    return (
        <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen relative font-sans">

            {/* Edit Modal Overlay */}
            {editingLead && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="max-w-2xl w-full">
                        <AddLead
                            userProfile={userProfile}
                            initialData={Object.keys(editingLead).length > 0 ? editingLead : null}
                            onClose={() => setEditingLead(null)}
                            onSuccess={() => {
                                setEditingLead(null);
                                // loadData(); // Auto updates
                            }}
                        />
                    </div>
                </div>
            )}

            {/* HEADER & WELCOME (Dark Theme - Director Style) */}
            <div className="relative overflow-hidden bg-slate-900 rounded-3xl shadow-xl p-8 mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
                {/* Decorative Background Effects */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 rounded-full blur-3xl opacity-20 bg-indigo-500 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 rounded-full blur-3xl opacity-10 bg-purple-500 pointer-events-none"></div>

                <div className="relative z-10 w-full md:w-auto text-left">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider bg-white/10 text-indigo-200 border border-white/10">
                            <Users className="w-3 h-3" /> LEAD CRM & DISTRIBUTION
                        </span>
                        <span className="text-slate-400 text-xs font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </span>
                    </div>
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
                        {greeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{(userProfile?.name || "User").split(' ')?.[0]}</span>
                    </h1>
                    <p className="text-slate-400 text-sm max-w-xl">
                        Manage inquiries for <span className="font-bold text-slate-200">{userProfile?.centerId || "your center"}</span>.
                    </p>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    {isDirector && (
                        <button
                            onClick={() => setShowIntegrityModal(true)}
                            className="relative bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-xl font-bold flex items-center gap-3 shadow-lg shadow-indigo-900/20 hover:scale-105 transition-all duration-300"
                        >
                            <Database className="w-4 h-4" />
                            <span>Integrity Center</span>
                            {integrityStatus.scanned && (integrityStatus.missing.length > 0 || integrityStatus.duplicates.length > 0 || integrityStatus.orphanedLeads?.length > 0) && (
                                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse shadow-md">
                                    {(integrityStatus.missing?.length || 0) + (integrityStatus.duplicates?.length || 0) + (integrityStatus.orphanedLeads?.length || 0)}
                                </span>
                            )}
                        </button>
                    )}

                    <button
                        onClick={() => setEditingLead({})} // Empty object signals NEW lead, Modal logic handles it
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-4 rounded-xl font-bold flex items-center gap-3 shadow-lg shadow-emerald-900/20 hover:scale-105 transition-transform"
                    >
                        <div className="bg-white/20 p-1 rounded-lg"><Edit className="w-4 h-4" /></div>
                        <span>Add New Lead</span>
                    </button>

                    <button
                        onClick={exportToCSV}
                        className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-6 py-4 rounded-xl font-bold flex items-center gap-3 transition-all backdrop-blur-md"
                    >
                        <Download className="w-4 h-4" /> Export
                    </button>
                </div>
            </div>

            {/* DIRECTOR CENTER FILTER */}
            {isDirector && (
                <div className="flex justify-center -mt-4 mb-2 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-gray-200 inline-flex gap-1">
                        {['ALL', 'UN_COLLEGE', 'UN_NASHIK_RD', 'PRAYAS'].map(c => (
                            <button
                                key={c}
                                onClick={() => setViewCenter(c)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${viewCenter === c
                                    ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md transform scale-105'
                                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                    }`}
                            >
                                {c === 'ALL' ? 'All Centers' : c.replace('UN_', '').replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* STATS CARDS (Premium Gradient Style) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {/* TOTAL */}
                <div
                    onClick={() => setFilterStatus("ALL")}
                    className={`${getCardStyle('revenue')} p-6 rounded-2xl border shadow-sm flex items-center gap-4 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group cursor-pointer ${filterStatus === 'ALL' ? 'ring-2 ring-blue-500' : ''}`}
                >
                    <div className="bg-blue-100 p-4 rounded-xl text-blue-600 shadow-inner group-hover:bg-blue-200 transition"><Users className="w-8 h-8" /></div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Inquiries</p>
                        <h2 className="text-3xl font-black text-slate-800">{stats.total}</h2>
                    </div>
                </div>

                {/* FOLLOW UPS */}
                <div
                    onClick={() => setFilterStatus("PENDING_ALL")}
                    className={`${getCardStyle('pending')} p-6 rounded-2xl border shadow-sm flex items-center gap-4 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group cursor-pointer ${filterStatus === 'PENDING_ALL' ? 'ring-2 ring-red-500' : ''}`}
                >
                    <div className="bg-amber-100 p-4 rounded-xl text-amber-600 shadow-inner group-hover:bg-amber-200 transition"><Clock className="w-8 h-8" /></div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pending Follow Ups</p>
                        <h2 className="text-3xl font-black text-slate-800">{stats.followUps}</h2>
                    </div>
                </div>

                {/* NEW LEADS */}
                <div
                    onClick={() => setFilterStatus("NEW")}
                    className={`${getCardStyle('pending')} p-6 rounded-2xl border shadow-sm flex items-center gap-4 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group cursor-pointer ${filterStatus === 'NEW' ? 'ring-2 ring-rose-500' : ''}`}
                >
                    <div className="bg-rose-100 p-4 rounded-xl text-rose-600 shadow-inner group-hover:bg-rose-200 transition"><AlertCircle className="w-8 h-8" /></div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">New Leads</p>
                        <h2 className="text-3xl font-black text-slate-800">{stats.newLeads}</h2>
                    </div>
                </div>

                {/* CONVERTED */}
                <div
                    onClick={() => setFilterStatus("CONVERTED")}
                    className={`${getCardStyle('new')} p-6 rounded-2xl border shadow-sm flex items-center gap-4 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group cursor-pointer ${filterStatus === 'CONVERTED' ? 'ring-2 ring-green-500' : ''}`}
                >
                    <div className="bg-green-100 p-4 rounded-xl text-green-600 shadow-inner group-hover:bg-green-200 transition"><CheckCircle className="w-8 h-8" /></div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Converted</p>
                        <h2 className="text-3xl font-black text-slate-800">{stats.converted}</h2>
                    </div>
                </div>
            </div>
            {/* ... (rest of the file until table) ... */}

            {/* Premium Search & Filter Toolbar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">

                {/* Search Bar */}
                <div className="relative w-full md:w-80 group">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search student name or phone..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium text-slate-700"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Filters */}
                <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    {/* Status Filter */}
                    <div className="relative min-w-[150px]">
                        <Filter className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <select
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="PENDING_ALL">Pending (Due & Follow Ups)</option>
                            <option value="NEW">New Leads</option>
                            <option value="FOLLOW_UP">Follow Ups (Only)</option>
                            <option value="CONVERTED">Converted</option>
                            <option value="ASSIGNED">Assigned</option>
                            <option value="VISITED">Visited</option>
                            <option value="COUNSELLING_DONE">Counselling Done</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>

                    {/* Source Filter */}
                    <div className="relative min-w-[150px]">
                        <Users className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <select
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                            value={filterSource}
                            onChange={(e) => setFilterSource(e.target.value)}
                        >
                            <option value="ALL">All Sources</option>
                            <option value="Walk-in">Walk-in</option>
                            <option value="Website">Website</option>
                            <option value="Referral">Referral</option>
                            <option value="Social Media">Social Media</option>
                        </select>
                    </div>

                    {/* NEW: BDE Name Filter (Dynamic) */}
                    <div className="relative min-w-[150px]">
                        <UserCheck className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <select
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                            value={filterBDEName}
                            onChange={(e) => setFilterBDEName(e.target.value)}
                        >
                            <option value="ALL">All BDE Sources</option>
                            {bdeNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>

                    {/* NEW Counselors Filter (Managers/Directors) */}
                    {canManageLeads && (
                        <div className="relative min-w-[180px]">
                            <UserCheck className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <select
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                                value={selectedCounselor}
                                onChange={(e) => setSelectedCounselor(e.target.value)}
                            >
                                <option value="ALL">All Counselors</option>
                                {staffList.map(s => (
                                    <option key={s.uid} value={s.uid}>{s.name} ({s.centerId})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Date Filter Inputs */}
                    <div className="flex gap-2 items-center bg-gray-50 p-1.5 rounded-xl border border-gray-200 flex-shrink-0">
                        <span className="text-xs font-bold text-gray-400 pl-2 uppercase">Date:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="bg-white border text-xs rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="bg-white border text-xs rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {(startDate || endDate) && (
                            <button onClick={() => { setStartDate(''); setEndDate('') }} className="text-xs text-red-500 hover:text-red-700 font-bold px-2">✕</button>
                        )}
                    </div>
                </div>
            </div>

            {/* Bulk Action Bar */}
            {canManageLeads && selectedLeads.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm">
                            {selectedLeads.length}
                        </div>
                        <span className="text-indigo-900 font-bold text-sm">Leads Selected</span>
                        <button 
                            onClick={() => setSelectedLeads([])}
                            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium ml-2 underline"
                        >
                            Clear Selection
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <select
                                className="pl-3 pr-8 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm w-48"
                                value=""
                                onChange={(e) => handleBulkAssign(e.target.value)}
                            >
                                <option value="" disabled>Bulk Assign To...</option>
                                {staffList.map(s => (
                                    <option key={s.uid} value={s.uid}>{s.name} ({s.centerId})</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={handleBulkDelete}
                            className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 border border-red-200 transition-colors shadow-sm"
                        >
                            <Trash2 className="w-4 h-4" /> Delete Selected
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        {/* ... thead ... */}
                        <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-xs">
                            <tr>
                                {canManageLeads && (
                                    <th className="p-4 w-12 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={selectedLeads.length > 0 && selectedLeads.length === filteredLeads.length}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                )}
                                <th className="p-4">Date</th>
                                <th className="p-4">Student</th>
                                <th className="p-4">Source</th>
                                <th className="p-4">Course</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Assigned To</th>
                                {canManageLeads && <th className="p-4">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={canManageLeads ? "8" : "6"} className="p-8 text-center">Loading Data...</td></tr>
                            ) : filteredLeads.slice(0, visibleCount).map(lead => (
                                <tr
                                    key={lead.id}
                                    className="hover:bg-blue-50 transition cursor-pointer"
                                    onClick={() => navigate(`/staff/leads/${lead.id}`)}
                                >
                                    
                                    {/* Bulk Select Checkbox */}
                                    {canManageLeads && (
                                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={selectedLeads.includes(lead.id)}
                                                onChange={(e) => handleSelectRow(e, lead.id)}
                                            />
                                        </td>
                                    )}

                                    {/* Date */}
                                    <td className="p-4 text-gray-500">
                                        {lead.createdAt?.seconds ? new Date(lead.createdAt.seconds * 1000).toLocaleDateString('en-IN') : 'N/A'}
                                    </td>

                                    {/* Student */}
                                    <td className="p-4">
                                        <p className="font-bold text-gray-900">{lead.studentName || "Unknown"}</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs text-gray-500">{lead.phone || "No Phone"}</p>
                                            {/* DUPLICATE INDICATOR (Robust Check) */}
                                            {safeLeads.filter(l => String(l.phone || "").trim() === String(lead.phone || "").trim() && String(lead.phone || "").length > 5).length > 1 && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 border border-red-200 flex items-center gap-1 animate-pulse">
                                                    <AlertCircle className="w-3 h-3" /> Duplicate
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Source - New Column */}
                                    <td className="p-4">
                                        <span className="font-semibold text-gray-700 text-xs block">
                                            {lead.source || "Unknown"}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {lead.bdeName || (typeof lead.sourceDetails === 'string' ? lead.sourceDetails : (lead.sourceDetails?.enteredBy || ""))}
                                        </span>
                                    </td>

                                    {/* Course */}
                                    <td className="p-4">
                                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-semibold">
                                            {lead.courseInterest || "N/A"}
                                        </span>
                                    </td>                                    {/* Status Badge */}
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${lead.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                                            lead.status === 'NEW' ? 'bg-purple-100 text-purple-600' :
                                                lead.status === 'FOLLOW_UP' ? 'bg-yellow-100 text-yellow-700' :
                                                    lead.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-600' :
                                                        'bg-green-100 text-green-600'
                                            }`}>
                                            {lead.status}
                                        </span>
                                    </td>

                                    {/* Assignment Column (Complex Logic) */}
                                    <td className="p-4">
                                        {isDirector || isManager ? (
                                            // DIRECTOR & MANAGER: Shows Dropdown to Assign
                                            <div className="relative" onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    className="w-full border border-gray-300 rounded p-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={lead.assignedTo || ""}
                                                    onChange={(e) => handleAssignChange(lead.id, e.target.value)}
                                                >
                                                    <option value="" disabled>-- Assign Staff --</option>
                                                    {/* Fallback if assigned user is not in the list */}
                                                    {lead.assignedTo && !staffList.find(s => s.uid === lead.assignedTo) && (
                                                        <option value={lead.assignedTo} disabled>
                                                            {lead.assignedByName || "Unknown Staff"} (Not in List)
                                                        </option>
                                                    )}
                                                    {staffList.map(staff => (
                                                        <option key={staff.uid} value={staff.uid}>
                                                            {staff.name} ({staff.centerId}) [#{staff.uid.slice(-4)}]
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            // STAFF: Just shows name
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <UserCheck className="w-4 h-4" />
                                                {lead.assignedByName || "Unassigned"}
                                            </div>
                                        )}
                                    </td>

                                    {/* Actions Column (Manager Only) */}
                                    {canManageLeads && (
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => handleEdit(lead, e)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                                                    title="Edit Lead"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(lead.id, e)}
                                                    className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition"
                                                    title="Delete Lead"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    )}

                                </tr>
                            ))}



                            {/* Load More Button Row */}
                            {visibleCount < filteredLeads.length && (
                                <tr>
                                    <td colSpan={canManageLeads ? "8" : "6"} className="p-4 text-center bg-gray-50 border-t border-gray-100">
                                        <button
                                            onClick={() => setVisibleCount(prev => prev + 10)}
                                            className="px-6 py-2 bg-white border border-gray-300 rounded-full shadow-sm text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-all flex items-center gap-2 mx-auto"
                                        >
                                            Show More ({filteredLeads.length - visibleCount} remaining)
                                        </button>
                                    </td>
                                </tr>
                            )}

                            {filteredLeads.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={canManageLeads ? "8" : "6"} className="p-8 text-center text-gray-400">
                                        <div className="font-bold mb-2">No leads found.</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* INTEGRITY CENTER MODAL */}
            {showIntegrityModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col relative">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                            <div className="flex items-center gap-3">
                                <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-xl border border-indigo-500/20">
                                    <ShieldAlert className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold tracking-tight text-white">
                                        CRM & Admission Integrity Center
                                    </h2>
                                    <p className="text-xs text-slate-400">
                                        Scan and resolve database discrepancies between CRM Leads and Admissions.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowIntegrityModal(false)}
                                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-all font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Admissions (Active & Verification)</span>
                                    <span className="text-2xl font-black text-indigo-400">{integrityStatus.totalAdmissions}</span>
                                </div>
                                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">CRM Converted Leads</span>
                                    <span className="text-2xl font-black text-emerald-400">{integrityStatus.totalLeads}</span>
                                </div>
                                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Discrepancy Count</span>
                                        <span className={`text-2xl font-black ${integrityStatus.totalAdmissions - integrityStatus.totalLeads === 0 ? 'text-green-400' : 'text-rose-400'}`}>
                                            {integrityStatus.totalAdmissions - integrityStatus.totalLeads}
                                        </span>
                                    </div>
                                    {integrityStatus.totalAdmissions - integrityStatus.totalLeads !== 0 && (
                                        <span className="bg-rose-500/10 text-rose-400 text-[10px] font-bold px-2 py-1 rounded-full border border-rose-500/20">
                                            Needs Alignment
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Main Diagnostic Panel */}
                            {integrityStatus.loading ? (
                                <div className="text-center py-12 space-y-4">
                                    <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                                    <p className="text-sm text-slate-400">Running database diagnostic check...</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Issue 1: Missing Leads */}
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                            <span>1. Admissions Missing Leads</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${integrityStatus.missing.length > 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                                                {integrityStatus.missing.length} Issues
                                            </span>
                                        </h3>
                                        
                                        {integrityStatus.missing.length > 0 ? (
                                            <div className="bg-slate-950/20 rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800 max-h-60 overflow-y-auto">
                                                {integrityStatus.missing.map((item, idx) => (
                                                    <div key={idx} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-800/10 transition-colors">
                                                        <div>
                                                            <p className="font-bold text-white text-sm">{item.admission.studentName}</p>
                                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                                                                <span>📞 {item.admission.phone || 'N/A'}</span>
                                                                <span>📍 {item.admission.centerId}</span>
                                                                <span>📚 {item.admission.program || item.admission.courseInterest || item.admission.course}</span>
                                                                <span>📅 {item.admission.enrollmentDate || 'No Date'}</span>
                                                            </div>
                                                            <div className="mt-2 text-xs">
                                                                {item.type === 'STATUS_MISMATCH' ? (
                                                                    <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md font-semibold">
                                                                        ⚠️ Lead exists in CRM but is marked as "{item.matchingLead?.status || 'Unknown'}" instead of Converted.
                                                                    </span>
                                                                ) : item.type === 'MISALIGNED_LEAD_ID' ? (
                                                                    <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md font-semibold">
                                                                        ⚠️ Lead exists in CRM but lead ID reference is missing.
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md font-semibold">
                                                                        🚨 Lead is deleted or missing from the CRM database.
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    setIntegrityStatus(prev => ({ ...prev, loading: true }));
                                                                    await handleRestoreLead(item);
                                                                    alert("Lead successfully restored/aligned!");
                                                                } catch (err) {
                                                                    alert("Failed to restore lead: " + err.message);
                                                                    setIntegrityStatus(prev => ({ ...prev, loading: false }));
                                                                }
                                                            }}
                                                            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-2 rounded-xl transition-all self-stretch md:self-auto text-center"
                                                        >
                                                            {item.type === 'STATUS_MISMATCH' ? 'Sync Status' : item.type === 'MISALIGNED_LEAD_ID' ? 'Align Reference' : 'Restore Lead'}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="bg-slate-950/20 rounded-2xl border border-slate-800 p-4 text-center text-slate-400 text-sm">
                                                ✅ No admissions are missing corresponding CRM leads.
                                            </div>
                                        )}
                                    </div>

                                    {/* Issue 2: Duplicate Admissions */}
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                            <span>2. Duplicate Admissions Detected</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${integrityStatus.duplicates.length > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                                                {integrityStatus.duplicates.length} Groups
                                            </span>
                                        </h3>

                                        {integrityStatus.duplicates.length > 0 ? (
                                            <div className="bg-slate-950/20 rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800 max-h-60 overflow-y-auto">
                                                {integrityStatus.duplicates.map((group, idx) => (
                                                    <div key={idx} className="p-4 space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <div>
                                                                <p className="font-bold text-white text-sm">{group.original.studentName}</p>
                                                                <p className="text-xs text-slate-400">📞 Phone: {group.original.phone} | Program: {group.original.program || group.original.course}</p>
                                                            </div>
                                                            <button
                                                                onClick={async () => {
                                                                    if (window.confirm("Are you sure you want to clean up duplicate records? This will delete all duplicate entries but keep the primary record.")) {
                                                                        try {
                                                                            setIntegrityStatus(prev => ({ ...prev, loading: true }));
                                                                            for (const dupe of group.dupes) {
                                                                                await handleDeleteDuplicate(dupe);
                                                                            }
                                                                            const newResults = await performDatabaseDiagnostic();
                                                                            setIntegrityStatus({
                                                                                scanned: true,
                                                                                loading: false,
                                                                                missing: newResults.missing,
                                                                                duplicates: newResults.duplicates,
                                                                                orphanedLeads: newResults.orphanedLeads,
                                                                                sharedLeads: newResults.sharedLeads,
                                                                                totalAdmissions: newResults.totalAdmissions,
                                                                                totalLeads: newResults.totalLeads
                                                                            });
                                                                            alert("Duplicates removed successfully!");
                                                                        } catch (err) {
                                                                            alert("Failed to remove duplicates: " + err.message);
                                                                            setIntegrityStatus(prev => ({ ...prev, loading: false }));
                                                                        }
                                                                    }
                                                                }}
                                                                className="text-xs bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 font-bold px-3 py-2 rounded-xl transition-all"
                                                            >
                                                                Remove {group.dupes.length} Duplicates
                                                            </button>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                            <div className="bg-slate-900 p-3 rounded-xl border border-emerald-500/30">
                                                                <span className="font-bold text-emerald-400 block mb-1">Primary Record (To Keep)</span>
                                                                <p>Doc ID: {group.original.id}</p>
                                                                <p>Total Paid: ₹{group.original.totalPaid} / ₹{group.original.amount}</p>
                                                                <p>Counsellor: {group.original.counsellorName || group.original.bookedBy}</p>
                                                                <p>Created: {group.original.createdAt?.seconds ? new Date(group.original.createdAt.seconds * 1000).toLocaleString() : 'N/A'}</p>
                                                            </div>
                                                            {group.dupes.map((dupe, dIdx) => (
                                                                <div key={dIdx} className="bg-slate-900 p-3 rounded-xl border border-red-500/30">
                                                                    <span className="font-bold text-red-400 block mb-1">Duplicate Record {dIdx + 1} (To Delete)</span>
                                                                    <p>Doc ID: {dupe.id}</p>
                                                                    <p>Total Paid: ₹{dupe.totalPaid} / ₹{dupe.amount}</p>
                                                                    <p>Counsellor: {dupe.counsellorName || dupe.bookedBy}</p>
                                                                    <p>Created: {dupe.createdAt?.seconds ? new Date(dupe.createdAt.seconds * 1000).toLocaleString() : 'N/A'}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="bg-slate-950/20 rounded-2xl border border-slate-800 p-4 text-center text-slate-400 text-sm">
                                                ✅ No duplicate active admissions detected.
                                            </div>
                                        )}
                                    </div>

                                    {/* Issue 3: Orphaned Converted Leads */}
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                            <span>3. Extra Converted Leads (No Admission Record)</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${integrityStatus.orphanedLeads?.length > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                                                {integrityStatus.orphanedLeads?.length || 0} Extra Leads
                                            </span>
                                        </h3>

                                        {integrityStatus.orphanedLeads?.length > 0 ? (
                                            <div className="bg-slate-950/20 rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800 max-h-60 overflow-y-auto">
                                                {integrityStatus.orphanedLeads.map((lead, idx) => (
                                                    <div key={idx} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-800/10 transition-colors">
                                                        <div>
                                                            <p className="font-bold text-white text-sm">{lead.studentName}</p>
                                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                                                                <span>📞 {lead.phone || 'N/A'}</span>
                                                                <span>📍 {lead.centerId}</span>
                                                                <span>📚 {lead.courseInterest || 'N/A'}</span>
                                                                <span>👤 Counselor: {lead.assignedByName || 'Unassigned'}</span>
                                                            </div>
                                                            <div className="mt-2 text-xs">
                                                                <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md font-semibold">
                                                                    ⚠️ Lead is marked as Converted, but no active or pending admission was found.
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 self-stretch md:self-auto">
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        setIntegrityStatus(prev => ({ ...prev, loading: true }));
                                                                        await handleResetOrphanedLead(lead.id, 'FOLLOW_UP');
                                                                        const newResults = await performDatabaseDiagnostic();
                                                                        setIntegrityStatus({
                                                                            scanned: true,
                                                                            loading: false,
                                                                            missing: newResults.missing,
                                                                            duplicates: newResults.duplicates,
                                                                            orphanedLeads: newResults.orphanedLeads,
                                                                            sharedLeads: newResults.sharedLeads,
                                                                            totalAdmissions: newResults.totalAdmissions,
                                                                            totalLeads: newResults.totalLeads
                                                                        });
                                                                        alert("Lead status reset to Follow-Up!");
                                                                    } catch (err) {
                                                                        alert("Failed to reset lead: " + err.message);
                                                                        setIntegrityStatus(prev => ({ ...prev, loading: false }));
                                                                    }
                                                                }}
                                                                className="text-xs bg-slate-850 hover:bg-slate-800 text-slate-200 font-bold px-3 py-2 rounded-xl transition-all border border-slate-700 flex-1 text-center"
                                                            >
                                                                Reset status to Follow-Up
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="bg-slate-950/20 rounded-2xl border border-slate-800 p-4 text-center text-slate-400 text-sm">
                                                ✅ No extra orphaned converted leads detected.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Issue 4: Converted Leads with Multiple Enrollments */}
                            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5 space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <span className="font-bold text-white text-base">4. Leads with Multiple Enrollments (Expected Difference)</span>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                        {integrityStatus.sharedLeads?.length || 0} Leads
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 pl-10">
                                    These leads have multiple active/pending admissions associated with them in the database (e.g. siblings sharing a phone number, or a student enrolled in multiple courses). Since there is only 1 lead in the CRM but multiple admissions, it is completely expected that the total admissions count (600) exceeds the converted leads count (598).
                                </p>
                                {integrityStatus.sharedLeads?.length > 0 ? (
                                    <div className="space-y-3 pl-10 max-h-60 overflow-y-auto pr-2">
                                        {integrityStatus.sharedLeads.map((item, idx) => (
                                            <div key={idx} className="bg-slate-950/40 rounded-2xl border border-slate-850 p-4 space-y-3">
                                                <div className="flex justify-between items-start border-b border-slate-800/50 pb-2">
                                                    <div>
                                                        <p className="font-bold text-white text-sm">{item.lead?.studentName || "Unknown Student"}</p>
                                                        <p className="text-xs text-slate-400">📞 Phone: {item.lead?.phone || "N/A"} | Status: {item.lead?.status}</p>
                                                    </div>
                                                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                                        {item.admissions.length} Admissions
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    {item.admissions.map((adm, aIdx) => (
                                                        <div key={aIdx} className="flex justify-between items-center bg-slate-900/40 px-3 py-2 rounded-xl text-xs">
                                                            <span className="text-slate-300 font-medium">{adm.program || adm.courseInterest || adm.course || "No Course"}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-400 font-bold">₹{(adm.amount || 0).toLocaleString()}</span>
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                                    adm.status === 'ACTIVE'
                                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                                }`}>
                                                                    {adm.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-slate-950/20 rounded-2xl border border-slate-800 p-4 text-center text-slate-400 text-sm pl-10">
                                        ✅ No leads with multiple active/pending admissions detected.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <button
                                onClick={async () => {
                                    try {
                                        setIntegrityStatus(prev => ({ ...prev, loading: true }));
                                        const newResults = await performDatabaseDiagnostic();
                                        setIntegrityStatus({
                                            scanned: true,
                                            loading: false,
                                            missing: newResults.missing,
                                            duplicates: newResults.duplicates,
                                            orphanedLeads: newResults.orphanedLeads,
                                            sharedLeads: newResults.sharedLeads,
                                            totalAdmissions: newResults.totalAdmissions,
                                            totalLeads: newResults.totalLeads
                                        });
                                    } catch (err) {
                                        alert("Refresh failed: " + err.message);
                                        setIntegrityStatus(prev => ({ ...prev, loading: false }));
                                    }
                                }}
                                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-sm px-4 py-3 rounded-xl transition-all self-stretch sm:self-auto justify-center"
                                disabled={integrityStatus.loading}
                            >
                                <RefreshCw className={`w-4 h-4 ${integrityStatus.loading ? 'animate-spin' : ''}`} />
                                <span>Re-Scan</span>
                            </button>

                            {(integrityStatus.missing.length > 0 || integrityStatus.duplicates.length > 0 || integrityStatus.orphanedLeads?.length > 0) && (
                                <button
                                    onClick={async () => {
                                        if (window.confirm(`Are you sure you want to run auto-healing? This will:\n1. Recreate/align ${integrityStatus.missing.length} missing CRM leads.\n2. Delete duplicate active admissions.\n3. Sync ${integrityStatus.orphanedLeads?.length || 0} orphaned converted leads status.\nThis action updates Firestore documents.`)) {
                                            try {
                                                setIntegrityStatus(prev => ({ ...prev, loading: true }));
                                                const stats = await runAutoHealing();
                                                alert(`🔧 Auto-Healing Success:\n- Recreated ${stats.restoredCount} leads\n- Aligned ${stats.alignedCount} lead references\n- Cleaned ${stats.deletedDupesCount} duplicate admissions\n- Reset ${stats.resetOrphanedCount || 0} orphaned converted leads\n\nPlease refresh the page.`);
                                                setShowIntegrityModal(false);
                                            } catch (err) {
                                                alert("Auto-healing encountered errors: " + err.message);
                                                setIntegrityStatus(prev => ({ ...prev, loading: false }));
                                            }
                                        }
                                    }}
                                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg transition-all self-stretch sm:self-auto justify-center"
                                    disabled={integrityStatus.loading}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>Run Auto-Healing & Clean Database</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
};

export default LeadDashboard;
