// Admissions: the pipeline board (L3) first, the full lead table one click away.
import React, { useState } from 'react';
import AdmissionsPipeline from './AdmissionsPipeline';
import LeadDashboard from './pages/LeadDashboard';

const KEY = 'kap-leads-view';
const LeadsHome = ({ userProfile }) => {
    const [view, setView] = useState(() => { try { return sessionStorage.getItem(KEY) || 'board'; } catch { return 'board'; } });
    const go = (v) => { setView(v); try { sessionStorage.setItem(KEY, v); } catch { /* storage blocked */ } };
    if (view === 'list') {
        return (
            <div>
                <button type="button" className="jb-act jb-act-line mb-3" onClick={() => go('board')}>← Pipeline board</button>
                <LeadDashboard userProfile={userProfile} />
            </div>
        );
    }
    return <AdmissionsPipeline userProfile={userProfile} onList={() => go('list')} />;
};

export default LeadsHome;
