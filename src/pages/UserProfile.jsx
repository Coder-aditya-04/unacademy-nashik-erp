import React, { useState, useEffect } from 'react';
import { fetchActiveSessions, terminateSession } from '../services/sessionService';
import { Smartphone, Monitor, LogOut } from 'lucide-react';
import { Avatar, Empty } from '../components/j';

const UserProfile = ({ userProfile }) => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const currentSessionId = localStorage.getItem('current_session_id');

    useEffect(() => {
        const loadSessions = async () => {
            if (userProfile?.uid) {
                const data = await fetchActiveSessions(userProfile.uid);
                setSessions(data);
                setLoading(false);
            }
        };
        loadSessions();
    }, [userProfile]);

    const handleTerminate = async (sessionId, deviceName) => {
        if (window.confirm(`Are you sure you want to log out from "${deviceName}"?`)) {
            const result = await terminateSession(userProfile.uid, sessionId);
            if (result.success) {
                // Optimistic UI update
                setSessions(prev => prev.filter(s => s.id !== sessionId));
            } else {
                alert("Failed to logout device.");
            }
        }
    };

    const getDeviceIcon = (type, os) => {
        if (type === 'mobile' || (os && (os.includes('iOS') || os.includes('Android')))) return <Smartphone className="w-5 h-5" />;
        return <Monitor className="w-5 h-5" />;
    };

    const role = (userProfile?.role || '').replace(/_/g, ' ').toLowerCase();
    return (
        <div className="max-w-3xl mx-auto space-y-5 pb-10">
            <header className="jb-rise">
                <p className="jb-sub text-[13px] font-semibold">Your account</p>
                <h1 className="jb-h text-[30px] leading-tight">My profile</h1>
            </header>

            <section className="jb-rise rounded-[24px] p-6 flex items-center gap-5 flex-wrap" style={{ background: 'var(--t-sage)' }}>
                <Avatar name={userProfile?.name || 'User'} size={72} />
                <div className="min-w-0">
                    <h2 className="jb-h text-[22px] leading-tight break-words">{userProfile?.name || 'User'}</h2>
                    <p className="text-[14px] font-medium break-all" style={{ color: 'var(--sub)' }}>{userProfile?.email}</p>
                    {role && <span className="inline-block mt-2 px-3 py-1 rounded-full text-[12px] font-bold capitalize" style={{ background: 'var(--panel)' }}>{role}</span>}
                </div>
            </section>

            <div className="jb-card jb-rise overflow-hidden" style={{ padding: 0, animationDelay: '60ms' }}>
                <div className="px-5 pt-5 pb-4">
                    <h2 className="jb-h text-[18px] leading-tight">Signed-in devices</h2>
                    <p className="jb-sub text-[13px] mt-0.5">Phones and computers logged into your account. Log out any you don't recognise.</p>
                </div>
                {loading ? (
                    <div className="p-5 space-y-3">{[0, 1].map(k => <div key={k} className="j-sk h-14 rounded-2xl" />)}</div>
                ) : sessions.length === 0 ? (
                    <Empty emoji="📱">No device info yet.</Empty>
                ) : sessions.map(session => {
                    const isCurrent = session.sessionId === currentSessionId;
                    const loginTime = session.createdAt?.seconds
                        ? new Date(session.createdAt.seconds * 1000).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
                        : 'Unknown';
                    return (
                        <div key={session.id} className="flex items-center justify-between gap-3 px-5 py-4 flex-wrap" style={{ borderTop: '1px solid var(--line)' }}>
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="w-11 h-11 rounded-2xl inline-flex items-center justify-center shrink-0" style={{ background: isCurrent ? 'var(--t-blue)' : 'var(--track)' }}>
                                    {getDeviceIcon(session.deviceType, session.os)}
                                </span>
                                <div className="min-w-0">
                                    <p className="font-bold text-[15px] flex items-center gap-2 flex-wrap">
                                        {session.deviceName}
                                        {isCurrent && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: 'var(--t-sage)' }}>This device</span>}
                                    </p>
                                    <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{session.browser} on {session.os} · {loginTime}</p>
                                </div>
                            </div>
                            {!isCurrent && (
                                <button type="button" onClick={() => handleTerminate(session.id, session.deviceName)} className="jb-act jb-act-line" style={{ padding: '7px 14px', fontSize: 13 }}>
                                    <LogOut className="w-4 h-4 inline mr-1" /> Log out
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default UserProfile;
