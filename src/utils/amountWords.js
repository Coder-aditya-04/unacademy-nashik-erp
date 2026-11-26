// Rupees in words, Indian grouping (lakh, crore), for fee receipts.
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const two = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const three = (n) => {
    const h = Math.floor(n / 100), r = n % 100;
    return [h ? `${ONES[h]} Hundred` : '', r ? two(r) : ''].filter(Boolean).join(' ');
};

export const amountInWords = (value) => {
    const total = Math.round(Math.abs(Number(value) || 0) * 100);
    let n = Math.floor(total / 100);
    const paise = total % 100;
    if (n === 0 && paise === 0) return 'Rupees Zero Only';
    const parts = [];
    const crore = Math.floor(n / 1e7); n %= 1e7;
    const lakh = Math.floor(n / 1e5); n %= 1e5;
    const thousand = Math.floor(n / 1e3); n %= 1e3;
    if (crore) parts.push(`${crore >= 100 ? three(crore) : two(crore)} Crore`);
    if (lakh) parts.push(`${two(lakh)} Lakh`);
    if (thousand) parts.push(`${two(thousand)} Thousand`);
    if (n) parts.push(three(n));
    const rupees = parts.join(' ');
    return `Rupees ${rupees || 'Zero'}${paise ? ` and ${two(paise)} Paise` : ''} Only`;
};
