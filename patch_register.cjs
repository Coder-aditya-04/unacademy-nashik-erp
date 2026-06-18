const fs = require('fs');
const file = 'src/pages/RegisterDetails.jsx';
let content = fs.readFileSync(file, 'utf8');

// Add Director to the roles dropdown
content = content.replace(
    /<option value="ACCOUNTANT">Accountant<\/option>/g,
    '<option value="ACCOUNTANT">Accountant</option>\n                                    <option value="DIRECTOR">Director (Admin)</option>'
);

// If role is DIRECTOR, automatically set verified: true
content = content.replace(
    /verified: false, \/\/ Critical: Starts as false/g,
    'verified: formData.role.toUpperCase() === "DIRECTOR", // Auto-verify directors'
);

fs.writeFileSync(file, content, 'utf8');
console.log('RegisterDetails patched!');
