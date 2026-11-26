// Batches: the L7 board first, the old batch manager one click away.
import React, { useState } from 'react';
import BatchesHome from './BatchesHome';
import BatchManager from '../admin/pages/BatchManager';

const KEY = 'kap-batches-view';
const BatchesPage = ({ userProfile }) => {
    const [view, setView] = useState(() => { try { return sessionStorage.getItem(KEY) || 'board'; } catch { return 'board'; } });
    const go = (v) => { setView(v); try { sessionStorage.setItem(KEY, v); } catch { /* storage blocked */ } };
    if (view === 'manage') {
        return (
            <div>
                <button type="button" className="jb-act jb-act-line mb-3" onClick={() => go('board')}>← Batches board</button>
                <BatchManager userProfile={userProfile} />
            </div>
        );
    }
    return <BatchesHome userProfile={userProfile} onManage={() => go('manage')} />;
};

export default BatchesPage;
