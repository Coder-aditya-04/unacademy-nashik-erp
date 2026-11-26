// The course choices staff pick from, built from the fee structures.
// NEET/JEE 2-year and 1-year fees are offered as 11th, 12th and repeater
// options, the same split the admission form has always used.
export const COURSE_GROUPS = ['NEET', 'JEE', 'Foundation', 'MHT-CET', 'Other'];

export const courseOptions = (feeStructures = {}, isPrayas = false) => {
    const out = [];
    const add = (group, key, label, standard) => out.push({ group, key, label, standard: standard || label, value: standard ? `${key}|${standard}` : key });
    Object.keys(feeStructures || {})
        .filter(key => (isPrayas ? key.startsWith('PRAYAS_') : !key.startsWith('PRAYAS_')))
        .sort()
        .forEach(key => {
            const c = feeStructures[key] || {};
            const name = String(c.name || key).toUpperCase();
            if (key.includes('NEET_JEE_2Y')) {
                add('NEET', key, '11th NEET (2 Year)', '11th NEET (2 Year)');
                add('JEE', key, '11th JEE (2 Year)', '11th JEE (2 Year)');
                return;
            }
            if (key.includes('NEET_JEE_1Y')) {
                ['11th', '12th', 'Repeater'].forEach(w => {
                    add('NEET', key, `${w} NEET (1 Year)`, `${w} NEET (1 Year)`);
                    add('JEE', key, `${w} JEE (1 Year)`, `${w} JEE (1 Year)`);
                });
                return;
            }
            if (key.includes('MHT_CET') || name.includes('MHT')) { add('MHT-CET', key, c.name || key); return; }
            if (name.includes('FOUNDATION') || /\b(8|9|10)\b/.test(name)) { add('Foundation', key, c.name || key); return; }
            if (name.includes('NEET')) { add('NEET', key, c.name || key); return; }
            if (name.includes('JEE')) { add('JEE', key, c.name || key); return; }
            add('Other', key, c.name || key);
        });
    return out;
};

// Batch course code for a chosen course (batches store JEE_11, NEET_12 ...).
export const batchCodeFor = (standard = '', key = '') => {
    const s = String(standard);
    if (s.includes('11th JEE')) return 'JEE_11';
    if (s.includes('11th NEET')) return 'NEET_11';
    if (s.includes('12th JEE') || s.includes('Repeater JEE')) return 'JEE_12';
    if (s.includes('12th NEET') || s.includes('Repeater NEET')) return 'NEET_12';
    if (key.includes('MHT_CET_12')) return 'MHT_CET_12';
    if (key.includes('MHT_CET_11')) return 'MHT_CET_11';
    const m = String(key).match(/CLASS_(8|9|10)/);
    if (m) return `FOUNDATION_${m[1]}`;
    return '';
};

// Old lead course names to a course option (best effort).
export const optionFor = (options, interest = '') => {
    const t = String(interest || '').toLowerCase();
    if (!t) return null;
    return options.find(o => o.label.toLowerCase() === t)
        || options.find(o => o.key === interest || o.key.endsWith(interest))
        || options.find(o => t.includes('neet') && o.group === 'NEET' && t.includes(o.standard.slice(0, 4).toLowerCase()))
        || options.find(o => (t.includes('neet') && o.group === 'NEET') || (t.includes('jee') && o.group === 'JEE') || (t.includes('foundation') && o.group === 'Foundation') || (t.includes('cet') && o.group === 'MHT-CET'))
        || null;
};
