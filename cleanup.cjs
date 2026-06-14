const fs = require('fs');
const path = require('path');

const filesToClean = [
    'src/modules/accounts/pages/AccountantDashboard.jsx',
    'src/pages/CounsellorDashboard.jsx',
    'src/pages/DirectorDashboard.jsx',
    'src/pages/FrontDeskDashboard.jsx',
    'src/pages/StudentRecords.jsx'
];

function cleanClasses(content) {
    // Regex to match className="..."
    return content.replace(/className=(["'])(.*?)\1/g, (match, quote, classes) => {
        let classArray = classes.split(/\s+/);
        
        classArray = classArray.filter(c => {
            if (!c) return false;
            // Remove dark mode (user said it breaks light mode)
            if (c.startsWith('dark:')) return false;
            // Remove animations and goofy scales
            if (c.startsWith('animate-') || c.startsWith('hover:scale-') || c.startsWith('active:scale-') || c.startsWith('delay-') || c.startsWith('duration-')) return false;
            // Remove gradients
            if (c.startsWith('bg-gradient-') || c.startsWith('from-') || c.startsWith('to-') || c.startsWith('via-')) return false;
            if (c.startsWith('backdrop-blur') || c.startsWith('bg-opacity-')) return false;
            // Remove overly large shadows
            if (['shadow-lg', 'shadow-xl', 'shadow-2xl'].includes(c)) return false;
            return true;
        });

        // Replace rounded-2xl, rounded-3xl with rounded-lg
        classArray = classArray.map(c => {
            if (c === 'rounded-2xl' || c === 'rounded-3xl' || c === 'rounded-xl') return 'rounded-lg';
            if (c === 'shadow-md') return 'shadow-sm';
            // Also let's standardize primary colors: 
            // If it's a blue or indigo background for a button, change to Unacademy green or blue?
            // Unacademy green is often represented nicely by Emerald-500 or Green-500. Educator Blue by Blue-600.
            return c;
        });

        // Remove duplicates
        classArray = [...new Set(classArray)];

        return `className=${quote}${classArray.join(' ')}${quote}`;
    });
}

filesToClean.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        content = cleanClasses(content);
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Cleaned ${file}`);
    } else {
        console.log(`Not found: ${file}`);
    }
});
