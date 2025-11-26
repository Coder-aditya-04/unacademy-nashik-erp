import React from 'react';
import { Link } from 'react-router-dom';
import { Calculator, CreditCard, Users, Clock, CheckCircle } from 'lucide-react';

const CounsellorDashboard = ({ userProfile, center }) => {
    return (
        <div className="max-w-6xl mx-auto">
            {/* Welcome Header */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Welcome, {userProfile?.name || "Counsellor"} 👋</h1>
                    <p className="text-gray-500 mt-1">
                        You are logged into <span className="font-bold text-blue-600">{center.name}</span>
                    </p>
                </div>
                <div className="text-right hidden md:block">
                    <p className="text-xs text-gray-400 uppercase">Today's Date</p>
                    <p className="font-bold text-lg">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <h2 className="text-lg font-bold text-gray-700 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

                {/* Card 1: Calculator */}
                <Link to="/staff/calculator" className="bg-blue-600 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
                    <div className="bg-blue-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                        <Calculator className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold">Fee Calculator</h3>
                    <p className="text-blue-100 text-sm mt-2">Generate Quotes & explain fees to parents.</p>
                </Link>

                {/* Card 2: Token Booking */}
                <Link to="/staff/token" className="bg-orange-500 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
                    <div className="bg-orange-400 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                        <CreditCard className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold">Book Token</h3>
                    <p className="text-orange-100 text-sm mt-2">Collect Payment & Upload Screenshot.</p>
                </Link>

                {/* Card 3: CRM */}
                <Link to="/staff/leads" className="bg-green-600 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
                    <div className="bg-green-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                        <Users className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold">My Leads</h3>
                    <p className="text-green-100 text-sm mt-2">View assigned inquiries & update status.</p>
                </Link>
            </div>

            {/* Recent Activity Section (Placeholder for now) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-800 mb-4">Workstation Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="font-semibold text-gray-700">Pending Follow-ups</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">0</p>
                        <p className="text-xs text-gray-400">Check your CRM for details</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="font-semibold text-gray-700">Admissions Today</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">0</p>
                        <p className="text-xs text-gray-400">Recorded in {center.name}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CounsellorDashboard;
