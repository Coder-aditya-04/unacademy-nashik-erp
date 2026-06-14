const fs = require('fs');
const file = 'src/pages/CounsellorDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('showAlertPopup')) {
    content = content.replace(
        /const \[tasks, setTasks\] = useState\(\[\]\);/,
        `const [tasks, setTasks] = useState([]);
    const [showAlertPopup, setShowAlertPopup] = useState(false);
    const [alertInstallments, setAlertInstallments] = useState([]);`
    );

    content = content.replace(
        /setInstallments\(installmentsData \|\| \[\]\);/,
        `setInstallments(installmentsData || []);
                const dueSoon = (installmentsData || []).filter(inst => inst.daysLeft >= 0 && inst.daysLeft <= 2);
                if (dueSoon.length > 0 && sessionStorage.getItem('dismissed_install_alert') !== 'true') {
                    setAlertInstallments(dueSoon);
                    setShowAlertPopup(true);
                }`
    );

    const popupHtml = `
            {/* UPCOMING INSTALLMENT ALERT POPUP */}
            {showAlertPopup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
                        
                        {/* Header */}
                        <div className="bg-rose-50 p-6 border-b border-rose-100 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-100 rounded-full text-rose-600 animate-pulse">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">Action Required</h3>
                                    <p className="text-sm text-slate-500 font-medium">{alertInstallments.length} installment{alertInstallments.length > 1 ? 's' : ''} due very soon.</p>
                                </div>
                            </div>
                        </div>

                        {/* List */}
                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                            {alertInstallments.map(inst => {
                                let dateLabel = \`Due \${inst.dueDate}\`;
                                if (inst.daysLeft === 0) dateLabel = "Due Today! 🚨";
                                else if (inst.daysLeft === 1) dateLabel = "Due Tomorrow! ⚠️";
                                else if (inst.daysLeft === 2) dateLabel = "Due in 2 days";

                                const whatsappMessage = \`Hello \${inst.studentName}, this is a gentle reminder from Unacademy Nashik. Your course fee installment of ₹\${inst.balance.toLocaleString('en-IN')} is due \${inst.daysLeft === 0 ? 'today' : inst.daysLeft === 1 ? 'tomorrow' : \`on \${inst.dueDate}\`}. Kindly process the payment at the earliest. Thank you!\`;
                                const whatsappUrl = \`https://wa.me/91\${inst.phone.replace(/\\D/g, '')}?text=\${encodeURIComponent(whatsappMessage)}\`;

                                return (
                                    <div key={inst.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col gap-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-slate-800">{inst.studentName}</h4>
                                                <p className="text-xs text-slate-500 font-medium">₹{inst.balance.toLocaleString('en-IN')} Remaining</p>
                                            </div>
                                            <span className={\`text-[10px] font-bold px-2 py-1 rounded border \${inst.daysLeft === 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-orange-50 text-orange-600 border-orange-100'}\`}>
                                                {dateLabel}
                                            </span>
                                        </div>
                                        <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg text-sm font-bold transition-colors">
                                            <PhoneCall className="w-4 h-4" /> Send Reminder
                                        </a>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Actions */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50">
                            <button 
                                onClick={() => {
                                    sessionStorage.setItem('dismissed_install_alert', 'true');
                                    setShowAlertPopup(false);
                                }}
                                className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-bold transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>

                    </div>
                </div>
            )}
`;
    content = content.replace(/<\/div>\n\s*<\/div>\n\s*\);\n};/g, popupHtml + '\n        </div>\n    </div>\n  );\n};');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Added popup logic successfully');
}
