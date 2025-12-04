// src/utils/centers.js

import unacademyLogo from '../assets/unacademy_full.png';
import prayaasLogo from '../assets/prayaas.png';

export const CENTERS = {
    "UN_COLLEGE": {
        id: "UN_COLLEGE",
        name: "Unacademy Nashik Centre (College Rd)",
        brand: "UNACADEMY",
        // Exact Address from Screenshot 3
        address: "2nd Floor, Platinum Grand Plaza, Near Magnum Hospital, Patil Lane 1, College Road, Nashik - 422005",
        phone: "8585858585", // Replace if you have a specific landline
        logoPath: unacademyLogo,
        color: [30, 58, 138] // Unacademy Blue
    },
    "UN_NASHIK_RD": {
        id: "UN_NASHIK_RD",
        name: "Unacademy Nashik Road Centre",
        brand: "UNACADEMY",
        // Exact Address from Screenshot 2
        address: "2nd Floor, Mogal Arcade, Jail Rd, behind Mogal Hospital, Nashik Road, Nashik - 422101",
        phone: "8585858585",
        logoPath: unacademyLogo,
        color: [30, 58, 138] // Unacademy Blue
    },
    "PRAYAS": {
        id: "PRAYAS",
        name: "Prayaas Education",
        brand: "PRAYAS",
        // Exact Address from Screenshot 1
        address: "2nd Floor, Pokar Arcade, Above Domino's Pizza, Opp. Synergy Hospital, Dindori Road, Nashik - 422004",
        phone: "9272090238",
        logoPath: prayaasLogo,
        color: [76, 29, 149] // Prayaas Purple (Approximate from logo)
    }
};
