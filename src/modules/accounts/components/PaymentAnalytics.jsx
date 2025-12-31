import React, { useMemo } from 'react';
import { Wallet, CreditCard, Banknote, Landmark } from 'lucide-react';

const PaymentAnalytics = ({ transactions }) => {
    // Calculate Totals dynamically
    const stats = useMemo(() => {
        let acc = { total: 0, kapOnline: 0, shsOnline: 0, cash: 0 };

        transactions.forEach(student => {
            if (student.payments && Array.isArray(student.payments)) {
                student.payments.forEach(p => {
                    const amt = Number(p.amount) || 0;
                    acc.total += amt;
                    const mode = p.mode?.toUpperCase() || 'UNKNOWN';

                    if (mode.includes('CASH')) {
                        acc.cash += amt;
                    }
                    else if (mode.includes('UPI') || mode.includes('KAPQR')) {
                        acc.kapOnline += amt;
                    }
                    else {
                        // All others (POS, Ujjivan, Card, Cheque, etc.) -> SHS Online
                        acc.shsOnline += amt;
                    }
                });
            } else {
                const amt = Number(student.totalPaid) || Number(student.amount) || 0;
                if (student.totalPaid > 0) {
                    acc.total += Number(student.totalPaid);
                    const mode = student.paymentMode?.toUpperCase() || 'UNKNOWN';

                    if (mode.includes('CASH')) {
                        acc.cash += Number(student.totalPaid);
                    }
                    else if (mode.includes('UPI') || mode.includes('KAPQR')) {
                        acc.kapOnline += Number(student.totalPaid);
                    }
                    else {
                        acc.shsOnline += Number(student.totalPaid);
                    }
                }
            }
        });
        return acc;
    }, [transactions]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Wallet className="w-5 h-5" /></div>
                    <p className="text-xs font-bold text-gray-500 uppercase">Total Collection</p>
                </div>
                <h3 className="text-2xl font-extrabold text-gray-800">₹{stats.total.toLocaleString()}</h3>
            </div>

            <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-100 rounded-lg text-green-600"><Banknote className="w-5 h-5" /></div>
                    <p className="text-xs font-bold text-gray-500 uppercase">Cash In Hand</p>
                </div>
                <h3 className="text-xl font-bold text-green-700">₹{stats.cash.toLocaleString()}</h3>
            </div>

            <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><CreditCard className="w-5 h-5" /></div>
                    <p className="text-xs font-bold text-gray-500 uppercase">KAP Online (RTGS/NEFT)</p>
                </div>
                <h3 className="text-xl font-bold text-purple-700">₹{stats.kapOnline.toLocaleString()}</h3>
            </div>

            <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Landmark className="w-5 h-5" /></div>
                    <p className="text-xs font-bold text-gray-500 uppercase">SHS Online (RTGS/NEFT)</p>
                </div>
                <h3 className="text-xl font-bold text-orange-700">₹{stats.shsOnline.toLocaleString()}</h3>
            </div>
        </div>
    );
};

export default PaymentAnalytics;
