import React, { useEffect } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, LogOut } from 'lucide-react';

const PendingApproval = () => {
    const auth = getAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        signOut(auth).then(() => navigate('/login'));
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden text-center p-8">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Clock className="w-10 h-10 text-yellow-600" />
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Pending Verification</h2>
                <p className="text-gray-500 mb-8">
                    Your profile has been created successfully. Access will be granted once your <strong>Center Manager</strong> approves your request.
                </p>

                <div className="bg-blue-50 p-4 rounded-xl text-left flex items-start gap-3 mb-8">
                    <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 className="font-bold text-gray-900 text-sm">What happens next?</h4>
                        <p className="text-xs text-gray-600 mt-1">
                            Please contact your manager to expedite the approval process. You will be able to log in normally once approved.
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 w-full py-3 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition"
                >
                    <LogOut className="w-4 h-4" /> Check Again Later (Logout)
                </button>
            </div>
        </div>
    );
};

export default PendingApproval;
