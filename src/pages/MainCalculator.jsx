import React, { useState, useEffect } from 'react';
import { PROGRAMS } from '../utils/feeData';
import { calculateFee, calculateInstallments, calculateRefunds } from '../utils/calculations';
import { generateAdmissionPDF } from '../utils/pdfGenerator';
import {
    Calculator, Calendar, FileText, User,
    BookOpen, Percent, CreditCard, ChevronRight,
    CheckCircle, AlertCircle, ArrowDown, Landmark
} from 'lucide-react';

const MainCalculator = ({ center }) => {
    const [selectedProgram, setSelectedProgram] = useState('');
    const [discount, setDiscount] = useState('');
    const [studentName, setStudentName] = useState('');
    const [paymentPlan, setPaymentPlan] = useState('INSTALLMENT');

    const [result, setResult] = useState(null);
    const [schedule, setSchedule] = useState([]);
    const [refunds, setRefunds] = useState(null);

    useEffect(() => {
        handleCalculate();
    }, [paymentPlan, discount, selectedProgram]);

    const handleCalculate = () => {
        if (selectedProgram) {
            const discountVal = discount === '' ? 0 : parseFloat(discount);
            if (discountVal < 0) return;

            const feeData = calculateFee(selectedProgram, discountVal);

            let finalPayable = feeData.landingFee;
            if (paymentPlan === 'REG_ONLY') {
                finalPayable = PROGRAMS[selectedProgram].reg;
            }

            setResult({ ...feeData, finalPayable });

            if (paymentPlan !== 'FULL') {
                const sched = calculateInstallments(feeData.landingFee, selectedProgram, paymentPlan);
                setSchedule(sched);
            } else {
                setSchedule([]);
            }

            const refundTable = calculateRefunds(feeData.landingFee, feeData.projectedFee, selectedProgram);
            setRefunds(refundTable);
        } else {
            setResult(null);
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">

            {/* 1. CONTROL PANEL (Inputs) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-6 text-white flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Calculator className="w-6 h-6 text-blue-300" /> Admission Fee Engine
                        </h1>
                        <p className="text-blue-200 text-sm mt-1 opacity-90">Calculate Quotes & Schedules for {center.name}</p>
                    </div>
                    {result && (
                        <div className="hidden md:block text-right">
                            <p className="text-xs uppercase tracking-widest opacity-70">Current Quote</p>
                            <p className="text-2xl font-bold">₹{result.finalPayable.toLocaleString()}</p>
                        </div>
                    )}
                </div>

                <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                        {/* Student Name */}
                        <div className="relative group">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Student Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition" />
                                <input
                                    type="text"
                                    className="w-full pl-10 p-3 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition font-medium"
                                    placeholder="Enter Name"
                                    value={studentName}
                                    onChange={(e) => setStudentName(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Program Select */}
                        <div className="relative group md:col-span-1">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Course Selection</label>
                            <div className="relative">
                                <BookOpen className="absolute left-3 top-3 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition" />
                                <select
                                    className="w-full pl-10 p-3 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition font-medium appearance-none"
                                    value={selectedProgram}
                                    onChange={(e) => setSelectedProgram(e.target.value)}
                                >
                                    <option value="">-- Select Program --</option>
                                    {Object.keys(PROGRAMS).map(key => (
                                        <option key={key} value={key}>{PROGRAMS[key].name}</option>
                                    ))}
                                </select>
                                <ChevronRight className="absolute right-3 top-3 w-5 h-5 text-gray-400 rotate-90" />
                            </div>
                        </div>

                        {/* Discount */}
                        <div className="relative group">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Scholarship (%)</label>
                            <div className="relative">
                                <Percent className="absolute left-3 top-3 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition" />
                                <input
                                    type="number"
                                    className="w-full pl-10 p-3 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition font-medium"
                                    value={discount}
                                    onChange={(e) => setDiscount(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {/* Plan */}
                        <div className="relative group">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Payment Plan</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-3 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition" />
                                <select
                                    className="w-full pl-10 p-3 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition font-medium appearance-none"
                                    value={paymentPlan}
                                    onChange={(e) => setPaymentPlan(e.target.value)}
                                >
                                    <option value="INSTALLMENT">Installments (Standard)</option>
                                    <option value="FULL">Full Payment (One Shot)</option>
                                    <option value="REG_ONLY">Registration Fee Only</option>
                                    <option value="LOAN">Education Loan (EMI)</option>
                                </select>
                                <ChevronRight className="absolute right-3 top-3 w-5 h-5 text-gray-400 rotate-90" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. RESULTS DASHBOARD */}
            {result && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in-up">

                    {/* LEFT COLUMN: Financial Summary */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* The Big Cards */}
                        <div className="grid grid-cols-3 gap-4">
                            {/* Original */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total List Price</p>
                                <p className="text-2xl font-bold text-gray-400 line-through mt-1">₹{result.originalTotal.toLocaleString()}</p>
                                <div className="absolute -right-4 -top-4 bg-gray-100 w-16 h-16 rounded-full opacity-50"></div>
                            </div>

                            {/* Savings */}
                            <div className="bg-amber-50 p-5 rounded-xl border border-amber-100 shadow-sm relative overflow-hidden">
                                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Scholarship</p>
                                <p className="text-2xl font-bold text-amber-700 mt-1">{result.discountInput}%</p>
                                <p className="text-xs text-amber-600 mt-1">Saved: ₹{(result.originalTotal - result.landingFee).toLocaleString()}</p>
                                <div className="absolute -right-4 -top-4 bg-amber-100 w-16 h-16 rounded-full opacity-50"></div>
                            </div>

                            {/* Final */}

                            <div className="bg-green-600 p-5 rounded-xl border border-green-600 shadow-lg text-white relative overflow-hidden">
                                <p className="text-xs font-bold text-green-100 uppercase tracking-wider">Final Landing Fee</p>
                                <p className="text-3xl font-extrabold mt-1">₹{result.landingFee.toLocaleString()}</p>
                                <div className="absolute -right-4 -top-4 bg-green-500 w-16 h-16 rounded-full opacity-50"></div>
                            </div>
                        </div>

                        {/* Fee Breakdown (Sales Tool) */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-gray-700 uppercase">Fee Composition</h3>
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">INTERNAL USE</span>
                            </div>
                            <div className="p-6 grid grid-cols-2 gap-8 relative">
                                {/* Visual Connector */}
                                <div className="absolute left-1/2 top-6 bottom-6 w-px bg-gray-200 hidden md:block"></div>

                                {/* Fixed */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                        <p className="text-xs font-bold text-gray-500 uppercase">Mandatory Fixed Fee</p>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-800">₹{result.fixedFee.toLocaleString()}</p>
                                    <p className="text-xs text-gray-400 mt-1">Reg + Tech + Exam (Non-refundable)</p>
                                </div>

                                {/* Tuition */}
                                <div className="md:pl-8">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        <p className="text-xs font-bold text-gray-500 uppercase">Tuition Fee</p>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-800">₹{result.tuitionFee.toLocaleString()}</p>
                                    <p className="text-xs text-green-600 mt-1">Discount applied on this amount</p>
                                </div>
                            </div>
                        </div>

                        {/* Installment Timeline */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-sm font-bold text-gray-700 uppercase mb-6 flex items-center gap-2">
                                {paymentPlan === 'LOAN' ? <Landmark className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                                {paymentPlan === 'LOAN' ? "Loan Breakdown" : "Payment Schedule"}
                            </h3>

                            {schedule.length > 0 ? (
                                <div className="relative">
                                    {/* Vertical Line */}
                                    <div className="absolute left-4 top-2 bottom-4 w-0.5 bg-gray-100"></div>

                                    <div className="space-y-6">
                                        {schedule.map((row, idx) => (
                                            <div key={idx} className="relative flex items-start gap-4">
                                                {/* Dot */}
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 ${idx === 0 ? 'bg-blue-600 border-blue-200 text-white' : 'bg-white border-gray-200 text-gray-400'
                                                    }`}>
                                                    <span className="text-xs font-bold">{idx + 1}</span>
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100 flex justify-between items-center">
                                                    <div>
                                                        <p className={`text-sm font-bold ${idx === 0 ? 'text-blue-700' : 'text-gray-700'}`}>
                                                            {typeof row.id === 'number' ? `Installment ${row.id}` : row.id === "Down Pay" ? "Down Payment" : row.id}
                                                        </p>
                                                        <p className="text-xs text-gray-400 mt-0.5">{row.dueDate}</p>
                                                    </div>
                                                    <p className="text-lg font-bold text-gray-800">₹{row.amount.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-green-50 text-green-800 rounded-lg flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5" /> Full Payment Plan Selected. No installments.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Actions & Refunds */}
                    <div className="space-y-6">

                        {/* Pay Now Box (If Reg Only) */}
                        {paymentPlan === 'REG_ONLY' && (
                            <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-6 text-white shadow-lg">
                                <p className="text-orange-100 text-xs font-bold uppercase mb-1">Payable Immediately</p>
                                <p className="text-3xl font-extrabold">₹{PROGRAMS[selectedProgram].reg.toLocaleString()}</p>
                                <div className="mt-4 pt-4 border-t border-white/20 text-xs text-orange-100 flex gap-2">
                                    <AlertCircle className="w-4 h-4" /> Remaining balance moves to installments.
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <button
                                onClick={() => generateAdmissionPDF({ name: studentName }, { ...result, paymentPlan }, schedule, center, refunds)}
                                className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition transform hover:-translate-y-1"
                            >
                                <FileText className="w-5 h-5" /> Download Official Quote
                            </button>
                            <p className="text-xs text-center text-gray-400 mt-3">Generates PDF with {center.name} letterhead</p>
                        </div>

                        {/* Refund Table (Compact) */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                <h3 className="text-xs font-bold text-gray-500 uppercase">Refund Policy (Estimate)</h3>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {refunds && refunds.map((row, idx) => (
                                    <div key={idx} className="flex justify-between p-3 text-xs">
                                        <span className="text-gray-500">{row.period}</span>
                                        <span className="font-mono font-medium text-gray-800">{row.refund}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default MainCalculator;
