import React, { useState, useEffect } from 'react';
import { getCachedAdmissions } from '../../../services/cacheService';
import { Link } from 'react-router-dom';
import { Tile, Count, Avatar, Contact, Empty, Seg } from '../../../components/j';
import { programLabel } from '../../j/data';

const CollegeTieUps = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [collegeFilter, setCollegeFilter] = useState("ALL");

    // Fetch Tie-Up Students
    const fetchTieUps = async () => {
        setLoading(true);
        try {
            // Basic query for all active students (we filter by college locally or via compound query)
            const admissions = await getCachedAdmissions('ALL');
 
            // Filter only those with ACTIVE status and tieUpCollege set
            const tieUpData = admissions
                .filter(s => s.status === 'ACTIVE' && s.tieUpCollege && s.tieUpCollege.trim() !== "");

            setStudents(tieUpData);
        } catch (error) {
            console.error("Error fetching tie-ups:", error);
        }
        setLoading(false);
    };

    useEffect(() => { fetchTieUps(); }, []);

    // Unique Colleges for Dropdown
    const colleges = ["ALL", ...new Set(students.map(s => s.tieUpCollege))];

    // Filter Logic
    const filteredList = students.filter(s => {
        const matchesSearch = (s.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.phone?.includes(searchTerm) ||
            s.rollNumber?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCollege = collegeFilter === "ALL" || s.tieUpCollege === collegeFilter;
        return matchesSearch && matchesCollege;
    });

    const collegeCount = colleges.length - 1;
    const thisMonth = students.filter(s => {
        const t = s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000) : null;
        const n = new Date();
        return t && t.getMonth() === n.getMonth() && t.getFullYear() === n.getFullYear();
    }).length;
    const sel = 'jb-input !w-auto !py-2 !rounded-full text-[13px] font-semibold';

    return (
        <div className="max-w-6xl mx-auto space-y-5 pb-10">
            <header className="jb-rise flex flex-wrap items-end justify-between gap-3">
                <div>
                    <Link to="/staff/accounts" className="jb-act jb-act-line mb-3 inline-flex" style={{ padding: '6px 14px', fontSize: 13 }}>← Accounts</Link>
                    <h1 className="jb-h text-[30px] leading-tight">College tie-ups</h1>
                    <p className="jb-sub text-[13px]">Students who joined through a partner college.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Tile tone="lilac" emoji="🏛️" title="Tie-up students" value={<Count value={students.length} />} sub="active right now" size="sm" />
                <Tile tone="blue" emoji="🤝" title="Partner colleges" value={<Count value={collegeCount} />} sub="with students" size="sm" delay={40} />
                <Tile tone="sage" emoji="✨" title="Joined this month" value={<Count value={thisMonth} />} sub="new tie-up admissions" size="sm" delay={80} />
            </div>

            <div className="jb-card jb-rise flex flex-wrap items-center gap-3" style={{ padding: 14 }}>
                <input className="jb-input flex-1 min-w-[200px]" placeholder="Search name, roll no or phone" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} aria-label="Search tie-up students" />
                {colleges.length <= 5 ? (
                    <div className="max-w-full overflow-x-auto jb-scroll">
                        <Seg size="sm" label="College" value={collegeFilter} onChange={setCollegeFilter} options={colleges.map(c => ({ value: c, label: c === 'ALL' ? 'All colleges' : c }))} />
                    </div>
                ) : (
                    <select className={sel} value={collegeFilter} onChange={e => setCollegeFilter(e.target.value)} aria-label="College">
                        {colleges.map(c => <option key={c} value={c}>{c === 'ALL' ? 'All colleges' : c}</option>)}
                    </select>
                )}
            </div>

            <div className="jb-card overflow-hidden" style={{ padding: 0 }}>
                {loading ? (
                    <div className="p-5 space-y-3">{[0, 1, 2].map(k => <div key={k} className="j-sk h-14 rounded-2xl" />)}</div>
                ) : filteredList.length === 0 ? (
                    <Empty emoji="🏛️">No tie-up students match.</Empty>
                ) : filteredList.map((item, n) => (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 flex-wrap jb-rise" style={{ borderTop: n ? '1px solid var(--line)' : 0, animationDelay: `${Math.min(n, 10) * 25}ms` }}>
                        <Avatar name={item.studentName} />
                        <Link to={'/staff/student/' + item.id} className="min-w-0 flex-1 basis-[180px]">
                            <p className="font-bold text-[15px] truncate">{item.studentName}</p>
                            <p className="text-[12.5px] truncate" style={{ color: 'var(--muted)' }}>{programLabel(item.program)} · Roll {item.rollNumber || 'not given yet'}</p>
                        </Link>
                        <span className="px-2.5 py-1 rounded-full text-[12px] font-bold" style={{ background: 'var(--t-lilac)' }}>{item.tieUpCollege}</span>
                        <span className="text-[12.5px] w-[90px]" style={{ color: 'var(--muted)' }}>
                            {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                        </span>
                        <Contact name={item.studentName} phone={item.phone} who="student" />
                    </div>
                ))}
            </div>
            {!loading && <p className="text-right text-[12px]" style={{ color: 'var(--muted)' }}>Showing {filteredList.length} of {students.length}</p>}
        </div>
    );
};

export default CollegeTieUps;
