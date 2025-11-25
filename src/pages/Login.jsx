import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

const Login = ({ setIsAuthenticated }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        const auth = getAuth();
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Login Success
            if (setIsAuthenticated) setIsAuthenticated(true);
            navigate('/staff/calculator'); // Go to Calculator
        } catch (err) {
            console.error("Login Error:", err);
            setError("Invalid Email or Password");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-2xl overflow-hidden">
                <div className="bg-blue-900 p-8 text-center">
                    <div className="inline-block p-4 rounded-full bg-blue-800 mb-4">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">KAP Edutech ERP</h2>
                    <p className="text-blue-200 text-sm mt-1">Authorized Access Only</p>
                </div>

                <form onSubmit={handleLogin} className="p-8 space-y-6">
                    {error && <div className="bg-red-100 text-red-700 p-3 rounded text-sm text-center">{error}</div>}

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email Address</label>
                        <input
                            type="email"
                            required
                            className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-900 outline-none"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            type="password"
                            required
                            className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-900 outline-none"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-lg transition"
                    >
                        Sign In
                    </button>
                </form>

                <div className="bg-gray-50 p-4 text-center text-xs text-gray-500 border-t">
                    Protected System. IP Address Logged.
                </div>
            </div>
        </div>
    );
};

export default Login;
