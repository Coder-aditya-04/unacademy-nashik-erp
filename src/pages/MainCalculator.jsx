import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFeeStructure } from '../hooks/useFeeStructure'; // UPDATED
import { calculateFee, calculateInstallments, calculateRefunds } from '../utils/calculations';
import { generateAdmissionPDF } from '../utils/pdfGenerator';
import { saveQuoteToHistory } from '../services/leadService';
import { requestDiscount } from '../services/approvalService';
import { School, Calculator, Building2, CheckCircle, AlertCircle, FileText, Send, X, AlertTriangle, Download, User, BookOpen, Percent, CreditCard, ChevronRight, Landmark, Calendar, RefreshCw, Save } from 'lucide-react';


const MainCalculator = ({ center, userProfile }) => {
    const location = useLocation();
    const navigate = useNavigate();

    // FETCH DYNAMIC FEE STRUCTURES
    const { feeStructures, loading: feesLoading } = useFeeStructure();

    // Check if passed from CRM
    const crmData = location.state || {};

    // MAPPING: Translates 'Add Lead' Dropdown Values -> 'Fee Data' Keys
    const COURSE_MAPPING = {
        // Generic/Legacy Keys
        "JEE_MAINS": "NEET_JEE_1Y",
        "JEE_ADV": "NEET_JEE_2Y",
        "NEET": "NEET_JEE_1Y",
        "FOUNDATION": "CLASS_8",

        // Lead Form Exact Matches -> Fee Keys
        "Foundation Class 8": "CLASS_8",
        "Foundation Class 9": "CLASS_9",
        "Foundation Class 10": "CLASS_10",
        "11th JEE (2 Year)": "NEET_JEE_2Y",
        "11th NEET (2 Year)": "NEET_JEE_2Y",
        "12th JEE (1 Year)": "NEET_JEE_1Y",
        "12th NEET (1 Year)": "NEET_JEE_1Y",
        "Repeater (JEE)": "NEET_JEE_1Y",
        "Repeater (NEET)": "NEET_JEE_1Y",

        // MHT-CET (Fixed: Mapped to actual keys found in feeData.js)
        "MHT-CET (1 Year)": "MHT_CET_12",
        "MHT-CET (2 Year)": "MHT_CET_11",

        // MISSING KEYS REPORTED BY USER
        "NEET_11": "NEET_JEE_2Y",
        "JEE_11": "NEET_JEE_2Y",
        "NEET_12": "NEET_JEE_1Y",
        "JEE_12": "NEET_JEE_1Y",
        "foundation": "CLASS_8",

        // Partial Matches / Lowercase Fallbacks (Defensive)
        "neet": "NEET_JEE_1Y",
        "jee": "NEET_JEE_1Y",
        "repeater": "NEET_JEE_1Y",
        "mht-cet": "MHT_CET_12",
        "mht": "MHT_CET_12"
    };

    // Helper to find key by name or mapping
    const findProgramKey = (input) => {
        if (!input || !feeStructures) return '';

        let potentialKey = input;

        // Step 0: Resolve Mapping first (e.g. JEE_MAINS -> NEET_JEE_1Y)
        if (COURSE_MAPPING[input]) {
            potentialKey = COURSE_MAPPING[input];
        }

        // Step 1: Check Center Specific Prefix (e.g. PRAYAS_NEET_JEE_1Y)
        if (center?.id === 'PRAYAS') {
            const prayerKey = `PRAYAS_${potentialKey}`;
            if (feeStructures[prayerKey]) return prayerKey;

            // Also try Direct Input Prefix (if input wasn't mapped)
            if (feeStructures[`PRAYAS_${input}`]) return `PRAYAS_${input}`;
        }

        // Step 2: Check Direct Key Match (Standard)
        if (feeStructures[potentialKey]) return potentialKey;
        if (feeStructures[input]) return input;

        // Step 3: Check Name Match (Fallback)
        const keyByName = Object.keys(feeStructures).find(k => feeStructures[k].name === input);
        if (keyByName) return keyByName;

        return '';
    };

    const [selectedProgram, setSelectedProgram] = useState('');
    const [discount, setDiscount] = useState('');
    const [studentName, setStudentName] = useState(crmData.prefillName || '');
    const [paymentPlan, setPaymentPlan] = useState('INSTALLMENT');
    const [requestStatus, setRequestStatus] = useState('IDLE'); // IDLE, SENDING, SENT
    const [selectedCollege, setSelectedCollege] = useState('NONE');

    const [result, setResult] = useState(null);
    const [schedule, setSchedule] = useState([]);
    const [refunds, setRefunds] = useState(null);
    const [saving, setSaving] = useState(false);

    // Limit discount for auto-approval
    const MAX_DISCOUNT_LIMIT = 70;

    // Initialize Prefill once fees are loaded
    useEffect(() => {
        if (feeStructures && crmData.prefillCourse && !selectedProgram) {
            const matchedKey = findProgramKey(crmData.prefillCourse);
            if (matchedKey) setSelectedProgram(matchedKey);
        }
    }, [feeStructures, crmData.prefillCourse]);

    useEffect(() => {
        handleCalculate();
    }, [paymentPlan, discount, selectedProgram, selectedCollege, feeStructures]);

    const handleCalculate = () => {
        if (selectedProgram && feeStructures) {
            const discountVal = discount === '' ? 0 : parseFloat(discount);
            if (discountVal < 0) return;

            // UPDATED: Pass feeStructures
            const feeData = calculateFee(selectedProgram, discountVal, selectedCollege, feeStructures);

            if (!feeData) return;

            let finalPayable = feeData.grandTotal; // Use Grand Total as final amount to pay

            // Adjust for Special Plans
            if (paymentPlan === 'REG_ONLY') {
                finalPayable = Number(feeStructures[selectedProgram].reg);
            }

            setResult({ ...feeData, finalPayable });

            if (paymentPlan !== 'FULL') {
                const sched = calculateInstallments(feeData.landingFee, selectedProgram, paymentPlan, feeStructures);
                setSchedule(sched);
            } else {
                setSchedule([]);
            }

            const refundTable = calculateRefunds(feeData.landingFee, feeData.projectedFee, selectedProgram, feeStructures);
            setRefunds(refundTable);
        } else {
            setResult(null);
        }
    };

    const handleRequestApproval = async () => {
        if (!studentName) return alert("Enter Student Name");

        if (window.confirm("Send approval request to Director?")) {
            setRequestStatus('SENDING');
            const reqData = {
                leadId: location.state?.leadId,
                studentName: studentName,
                program: feeStructures[selectedProgram].name,
                originalFee: result.originalTotal,
                offeredFee: result.landingFee,
                discountPercent: discount
            };

            const res = await requestDiscount(reqData, userProfile);

            if (res.success) {
                setRequestStatus('SENT');
                alert("Request successfully sent to Director Dashboard!");
            } else {
                setRequestStatus('IDLE');
                alert("Error sending request: " + res.error);
            }
        }
    };

    if (feesLoading) {
        return <div className="min-h-screen flex items-center justify-center text-blue-600 gap-2"><RefreshCw className="animate-spin" /> Loading Latest Fee Structures...</div>;
    }

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
                            <p className="text-2xl font-bold">₹{result.grandTotal.toLocaleString()}</p>
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

                        {/* Program Select (DYNAMIC) */}
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
                                    {feeStructures && Object.keys(feeStructures)
                                        .filter(key => {
                                            // PRAYAS Center Logic
                                            if (center?.id === 'PRAYAS') return key.startsWith('PRAYAS_');
                                            // Standard Centers Logic
                                            return !key.startsWith('PRAYAS_');
                                        })
                                        .sort()
                                        .map(key => (
                                            <option key={key} value={key}>{feeStructures[key].name}</option>
                                        ))
                                    }
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
            {result && feeStructures && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* 1. TOP ROW: 3 KEY METRICS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        {/* Card 1: Total List Price */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total List Price</p>
                            <h2 className="text-3xl font-bold text-gray-400 line-through decoration-2">₹{result.originalTotal.toLocaleString()}</h2>
                        </div>

                        {/* Card 2: Scholarship */}
                        <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 shadow-sm relative overflow-hidden">
                            <div className="absolute right-0 top-0 h-16 w-16 bg-amber-100 rounded-bl-full -mr-4 -mt-4 transition-transform hover:scale-110"></div>
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 relative z-10">Scholarship</p>
                            <h2 className="text-4xl font-extrabold text-amber-700 relative z-10">{result.discountInput}%</h2>
                            <p className="text-xs text-amber-600 font-medium mt-1 relative z-10">Saved: ₹{(result.originalTotal - result.landingFee).toLocaleString()}</p>
                        </div>

                        {/* Card 3: Final Landing Fee */}
                        <div className="bg-green-600 p-6 rounded-xl shadow-lg text-white relative overflow-hidden group">
                            <div className="absolute right-0 top-0 h-24 w-24 bg-white opacity-10 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110"></div>
                            <p className="text-xs font-bold text-green-100 uppercase tracking-wider mb-2 relative z-10">Final Landing Fee</p>
                            <h2 className="text-4xl font-extrabold relative z-10">₹{result.landingFee?.toLocaleString()}</h2>
                            {result.paymentPlan !== 'FULL' && result.paymentPlan !== 'REG_ONLY' && (
                                <p className="text-xs text-green-100 mt-2 relative z-10 opacity-80 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Payable in Installments
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 2. SPLIT LAYOUT: Main Content vs Sidebar */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* LEFT COLUMN (Details) */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* Fee Composition */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Fee Composition</h3>
                                    <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 uppercase">Internal Use</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                                    <div className="hidden md:block absolute left-1/2 top-4 bottom-4 w-px bg-gray-100"></div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                            <p className="text-xs font-bold text-gray-500 uppercase">Mandatory Fixed Fee</p>
                                        </div>
                                        <p className="text-2xl font-bold text-gray-800">₹{result.fixedFee.toLocaleString()}</p>
                                        <p className="text-xs text-gray-400 mt-1">Reg + Tech + Exam (Non-refundable)</p>
                                    </div>
                                    <div className="md:pl-8">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            <p className="text-xs font-bold text-gray-500 uppercase">Tuition Fee</p>
                                        </div>
                                        <p className="text-2xl font-bold text-gray-800">₹{(result.landingFee - result.fixedFee).toLocaleString()}</p>
                                        <p className="text-green-600 text-xs font-medium mt-1">Discount applied on this amount</p>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Schedule */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <h3 className="text-sm font-bold text-gray-700 uppercase mb-6 flex items-center gap-2">
                                    {paymentPlan === 'LOAN' ? <Landmark className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                                    {paymentPlan === 'LOAN' ? "Loan Breakdown" : "Payment Schedule"}
                                </h3>

                                {schedule.length > 0 ? (
                                    <div className="relative">
                                        <div className="absolute left-4 top-2 bottom-4 w-0.5 bg-gray-100"></div>
                                        <div className="space-y-6">
                                            {schedule.map((row, idx) => (
                                                <div key={idx} className="relative flex items-start gap-4">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 ${idx === 0 ? 'bg-blue-600 border-blue-200 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
                                                        <span className="text-xs font-bold">{idx + 1}</span>
                                                    </div>
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

                        {/* RIGHT COLUMN (Sidebar: Actions & Policy) */}
                        <div className="space-y-6">

                            {/* 1. Payable Immediately (Only for REG_ONLY) + Valid Schedule */}
                            {result.paymentPlan === 'REG_ONLY' && schedule.length > 0 && (
                                <div className="bg-orange-600 p-6 rounded-xl shadow-lg text-white relative overflow-hidden animate-in zoom-in duration-300">
                                    <div className="absolute right-0 top-0 h-24 w-24 bg-white opacity-10 rounded-bl-full -mr-6 -mt-6"></div>
                                    <p className="text-xs font-bold text-orange-100 uppercase tracking-wider mb-2 relative z-10">Payable Immediately</p>
                                    <h2 className="text-4xl font-extrabold relative z-10">₹{schedule[0].amount.toLocaleString()}</h2>
                                    <p className="text-xs text-orange-100 mt-2 relative z-10 opacity-90 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> Remaining balance moves to installments.
                                    </p>
                                </div>
                            )}

                            {/* 2. Action Buttons */}
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-xs font-bold text-gray-500 uppercase mb-4">Actions</h3>
                                <div className="flex flex-col gap-3">
                                    {/* Logic: If Discount > 70% require Approval */}
                                    {(parseInt(discount || 0) > MAX_DISCOUNT_LIMIT) ? (
                                        <div className="w-full">
                                            {requestStatus === 'SENT' ? (
                                                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative text-center font-bold">
                                                    Request Sent to Director logic ✅
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleRequestApproval}
                                                    disabled={requestStatus === 'SENDING'}
                                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 shadow-lg transition"
                                                >
                                                    {requestStatus === 'SENDING' ? "Sending..." : <><AlertTriangle className="w-5 h-5" /> Request Director Approval</>}
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => generateAdmissionPDF({ name: studentName }, { ...result, paymentPlan }, schedule, center, refunds)}
                                                className="bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl w-full flex justify-center items-center gap-2 shadow-lg transition"
                                            >
                                                <Download className="w-5 h-5" /> Download Official Quote
                                            </button>
                                            {/* CRM INTEGRATION BUTTON */}
                                            {crmData.leadId && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={async () => {
                                                            setSaving(true);
                                                            const quoteData = {
                                                                finalFee: result.landingFee,
                                                                discount: discount || 0,
                                                                plan: paymentPlan,
                                                                grandTotal: result.grandTotal,
                                                                selectedProgram
                                                            };

                                                            const response = await saveQuoteToHistory(crmData.leadId, quoteData, userProfile);

                                                            if (response.success) {
                                                                alert("Quote saved to Lead History!");
                                                            }
                                                            setSaving(false);
                                                        }}
                                                        disabled={saving}
                                                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition text-xs md:text-sm"
                                                    >
                                                        {saving ? "Saving..." : <><Save className="w-4 h-4" /> Save Quote</>}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const quoteData = {
                                                                finalFee: result.landingFee,
                                                                discount: discount || 0,
                                                                plan: paymentPlan,
                                                                selectedProgram
                                                            };
                                                            // Navigate to Admission Form with Data
                                                            navigate('/staff/take-admission', {
                                                                state: {
                                                                    lead: { id: crmData.leadId, studentName, ...crmData },
                                                                    quote: quoteData
                                                                }
                                                            });
                                                        }}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition text-xs md:text-sm"
                                                    >
                                                        <CheckCircle className="w-4 h-4" /> Take Admission
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* 3. Refund Policy */}
                            {paymentPlan !== 'REG_ONLY' && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase">Refund Policy (Total Deduction)</h3>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {refunds && refunds.map((row, idx) => (
                                            <div key={idx} className="flex justify-between p-3 text-xs">
                                                <span className="text-gray-500">{row.period}</span>
                                                <span className="font-mono font-medium text-red-600">{row.deduction}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default MainCalculator;
