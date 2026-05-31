import React, { useState, useEffect } from 'react';
import { fetchActiveSessions, terminateSession } from '../services/sessionService';
import { User, Smartphone, Monitor, Globe, Clock, Shield, LogOut } from 'lucide-react';

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

    return (
        <div className="max-w-4xl mx-auto p-6 font-sans">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mb-8">
                Account Settings
            </h1>

            {/* Profile Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8 flex items-center gap-6">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shadow-inner">
                    <User className="w-10 h-10" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{userProfile?.name || "User"}</h2>
                    <p className="text-slate-500 font-medium">{userProfile?.email}</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full border border-slate-200 uppercase tracking-wide">
                        {userProfile?.role?.replace('_', ' ')}
                    </span>
                </div>
            </div>

            {/* Active Sessions Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-green-600" /> Active Sessions
                        </h3>
                        <p className="text-slate-500 text-sm mt-1">Manage devices logged into your account.</p>
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {loading ? (
                        <div className="p-8 text-center text-slate-400">Loading sessions...</div>
                    ) : sessions.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">No active session info found.</div>
                    ) : (
                        sessions.map(session => {
                            const isCurrent = session.sessionId === currentSessionId;
                            const loginTime = session.createdAt?.seconds
                                ? new Date(session.createdAt.seconds * 1000).toLocaleString()
                                : 'Unknown';

                            return (
                                <div key={session.id} className={`p-6 flex items-center justify-between group hover:bg-slate-50 transition ${isCurrent ? 'bg-blue-50/30' : ''}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${isCurrent ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                            {getDeviceIcon(session.deviceType, session.os)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                {session.deviceName}
                                                {isCurrent && (
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] uppercase font-bold rounded-full border border-green-200">
                                                        This Device
                                                    </span>
                                                )}
                                            </h4>
                                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 font-medium">
                                                <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {session.browser} on {session.os}</span>
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {loginTime}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {!isCurrent && (
                                        <button
                                            onClick={() => handleTerminate(session.id, session.deviceName)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-bold border border-transparent hover:border-red-100 transition flex items-center gap-2"
                                        >
                                            <LogOut className="w-4 h-4" /> Log Out
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
