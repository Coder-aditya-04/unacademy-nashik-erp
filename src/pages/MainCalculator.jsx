import React, { useState } from 'react';
import { PROGRAMS } from '../utils/feeData';
import { calculateFee, calculateInstallments, calculateRefunds } from '../utils/calculations';
import { generateAdmissionPDF } from '../utils/pdfGenerator';
import { Calculator, Calendar, CheckCircle, Download, Loader, AlertCircle, FileText } from 'lucide-react';

const MainCalculator = ({ center }) => {
    const [selectedProgram, setSelectedProgram] = useState('');
    const [discount, setDiscount] = useState(0);
    const [result, setResult] = useState(null);
    const [schedule, setSchedule] = useState([]);
    const [studentName, setStudentName] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // NEW: Payment Plan State
    const [paymentPlan, setPaymentPlan] = useState('INSTALLMENT'); // INSTALLMENT | FULL | REG_ONLY
    const [refunds, setRefunds] = useState(null);

    // Auto-calculate when inputs change
    React.useEffect(() => {
        handleCalculate();
    }, [paymentPlan, discount, selectedProgram]);

    const handleCalculate = () => {
        if (selectedProgram && discount >= 0) {
            // 1. Calculate Fee
            const feeData = calculateFee(selectedProgram, parseFloat(discount));

            // Default: Landing Fee is the final payable
            let finalPayable = feeData.landingFee;

            // If "Reg Only", the immediate payable is just the Reg Fee
            if (paymentPlan === 'REG_ONLY') {
                finalPayable = PROGRAMS[selectedProgram].reg;
            }

            setResult({ ...feeData, finalPayable });

            // 2. Calculate Schedule
            // Always calculate schedule if it's INSTALLMENT or REG_ONLY
            if (paymentPlan === 'INSTALLMENT' || paymentPlan === 'REG_ONLY') {
                // PASS 'paymentPlan' HERE
                const sched = calculateInstallments(feeData.landingFee, selectedProgram, paymentPlan);
                setSchedule(sched);
            } else {
                setSchedule([]); // Full Payment
            }

            // 3. Calculate Refunds
            const refundTable = calculateRefunds(feeData.landingFee, feeData.projectedFee, selectedProgram);
            setRefunds(refundTable);
        }
    };

    const handleDownload = async () => {
        setIsGenerating(true);
        try {
            await generateAdmissionPDF({ name: studentName }, { ...result, paymentPlan }, schedule, center, refunds);
        } catch (error) {
            console.error("Download failed:", error);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">

                {/* Header */}
                <div className={`p-6 text-white flex items-center gap-3 ${center.brand === 'PRAYAS' ? 'bg-red-800' : 'bg-blue-900'}`}>
                    <Calculator className="w-8 h-8" />
                    <div>
                        <h1 className="text-2xl font-bold">Admission Fee Engine</h1>
                        <p className="text-blue-200 text-sm">{center.name}</p>
                    </div>
                </div>

                <div className="p-6">
                    {/* Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Student Name (Optional)</label>
                            <input
                                type="text"
                                className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                placeholder="Enter student name for quote"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Program</label>
                            <select
                                className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={selectedProgram}
                                onChange={(e) => setSelectedProgram(e.target.value)}
                            >
                                <option value="">-- Choose Course --</option>
                                {Object.keys(PROGRAMS).map(key => (
                                    <option key={key} value={key}>{PROGRAMS[key].name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Scholarship / Discount (%)</label>
                            <input
                                type="number"
                                className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={discount}
                                onChange={(e) => setDiscount(e.target.value)}
                                placeholder="0"
                            />
                        </div>

                        {/* NEW: Payment Plan Dropdown */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Plan</label>
                            <select
                                className="w-full p-3 border rounded-lg bg-blue-50 border-blue-200 font-semibold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={paymentPlan}
                                onChange={(e) => setPaymentPlan(e.target.value)}
                            >
                                <option value="INSTALLMENT">Standard Installments</option>
                                <option value="FULL">One Shot (Full Payment)</option>
                                <option value="REG_ONLY">Registration Fee Only</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={handleCalculate}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition-all transform active:scale-95 shadow-md"
                        >
                            Calculate Landing Fee
                        </button>

                        {result && (
                            <button
                                onClick={handleDownload}
                                disabled={isGenerating}
                                className={`flex-1 text-white font-bold py-4 rounded-lg transition-all transform active:scale-95 shadow-md flex items-center justify-center gap-2 ${isGenerating ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader className="w-5 h-5 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-5 h-5" />
                                        Download Quote
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Results Area */}
                    {result && (
                        <div className="animate-fade-in mt-6">
                            <div className="border-t border-gray-200 mb-6"></div>

                            {/* SALES TOOL: FEE BREAKDOWN */}
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                                <h3 className="text-sm font-bold text-blue-900 mb-3 uppercase">Fee Structure Breakdown (For Parent Explanation)</h3>
                                <div className="flex justify-between items-center text-sm mb-2">
                                    <span className="text-gray-600">Fixed Mandatory Charges (Reg + Tech + Exam):</span>
                                    <span className="font-bold text-gray-800">₹{result.fixedFee.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm mb-2">
                                    <span className="text-gray-600">Tuition Fee (Variable):</span>
                                    <span className="font-bold text-gray-800">₹{result.tuitionFee.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm pt-2 border-t border-blue-200">
                                    <span className="text-blue-800 font-bold">Total List Price:</span>
                                    <span className="font-bold text-blue-800">₹{result.originalTotal.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* FINAL LANDING FEE CARD */}
                            <div className="bg-green-600 text-white p-6 rounded-lg shadow-lg text-center mb-8">
                                <p className="text-sm uppercase opacity-90">Total Final Deal Value (Landing Fee)</p>
                                <p className="text-4xl font-extrabold my-2">₹{result.landingFee.toLocaleString()}</p>
                                <p className="text-sm bg-green-700 inline-block px-3 py-1 rounded-full">
                                    {discount}% Scholarship Applied
                                </p>
                            </div>

                            {/* PAYABLE NOW SECTION */}
                            {paymentPlan === 'REG_ONLY' && (
                                <div className="bg-orange-100 border-l-4 border-orange-500 p-4 mb-8">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-orange-800 font-bold text-lg">Payable Now (Registration Only)</p>
                                            <p className="text-xs text-orange-600">Balance will be split in future installments</p>
                                        </div>
                                        <p className="text-2xl font-bold text-orange-900">₹{PROGRAMS[selectedProgram].reg.toLocaleString()}</p>
                                    </div>
                                </div>
                            )}

                            {/* SCHEDULE & REFUND SECTION */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Schedule Table (Same as before) */}
                                <div>
                                    <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                        <Calendar className="w-5 h-5" /> Payment Schedule
                                    </h3>
                                    {schedule.length > 0 ? (
                                        <table className="w-full text-sm border rounded overflow-hidden">
                                            <thead className="bg-gray-100 text-gray-600">
                                                <tr>
                                                    <th className="p-2 text-left">Due Date</th>
                                                    <th className="p-2 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {schedule.map((row) => (
                                                    <tr key={row.id} className="border-t">
                                                        <td className="p-2">
                                                            <span className={row.id === "Down Pay" ? "font-bold text-orange-600" : ""}>{row.id === "Down Pay" ? "Down Payment" : `Inst ${row.id}`}</span>
                                                            <br />
                                                            <span className="text-xs text-gray-400">{row.dueDate}</span>
                                                        </td>
                                                        <td className="p-2 text-right font-bold">₹{row.amount.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">Full Payment selected.</p>
                                    )}
                                </div>

                                {/* Refund Table (Updated) */}
                                <div>
                                    <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5" /> Refund Values
                                    </h3>
                                    <table className="w-full text-xs border rounded overflow-hidden">
                                        <thead className="bg-gray-100 text-gray-600">
                                            <tr>
                                                <th className="p-2 text-left">Days</th>
                                                <th className="p-2 text-right">Refund</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {refunds && refunds.map((row, idx) => (
                                                <tr key={idx} className="border-t">
                                                    <td className="p-2 text-gray-600">{row.period}</td>
                                                    <td className="p-2 text-right font-mono font-medium">{row.refund}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* DOWNLOAD BUTTON */}
                            <div className="mt-8 flex justify-center">
                                <button
                                    onClick={() => generateAdmissionPDF({ name: studentName }, { ...result, paymentPlan }, schedule, center, refunds)}
                                    className="bg-blue-800 hover:bg-blue-900 text-white font-bold py-3 px-8 rounded-lg flex items-center gap-2 shadow-lg transition"
                                >
                                    <FileText className="w-5 h-5" /> Download Official Quote PDF
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MainCalculator;
