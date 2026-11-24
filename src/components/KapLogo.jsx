// KAP logo with no background box. The text is black on light screens and
// white on dark ones (dark theme, or tone="light" on a dark hero).
import React from 'react';
import dark from '../assets/kap_logo.png';
import light from '../assets/kap_logo_white.png';

const KapLogo = ({ tone, className = 'h-8 w-auto', ...rest }) => {
    if (tone === 'light') return <img src={light} alt="KAP Edutech" className={className} {...rest} />;
    if (tone === 'dark') return <img src={dark} alt="KAP Edutech" className={className} {...rest} />;
    return (
        <>
            <img src={dark} alt="KAP Edutech" className={`kap-logo-d ${className}`} {...rest} />
            <img src={light} alt="KAP Edutech" className={`kap-logo-l ${className}`} {...rest} />
        </>
    );
};

export default KapLogo;
