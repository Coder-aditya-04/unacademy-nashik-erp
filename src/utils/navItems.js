// Side menu for each role. `roles` lists who sees an item; ALL = every role.
import {
    LayoutDashboard, Users, UserPlus, Calculator, Ticket, FolderOpen, Wallet, AlertCircle,
    Settings2, Building2, PhoneCall, ClipboardList, GraduationCap, ConciergeBell,
} from 'lucide-react';

const ALL = ['DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'COUNSELLOR', 'FRONT_DESK', 'BDE', 'RECOVERY'];

export const normaliseRole = (role) => {
    const r = (role || '').toUpperCase();
    return r === 'COUNSELOR' || r === 'STAFF' ? 'COUNSELLOR' : r;
};

export const NAV_GROUPS = [
    {
        label: null,
        items: [
            { to: '/staff/dashboard', label: 'Home', icon: LayoutDashboard, roles: ALL.filter(r => r !== 'FRONT_DESK' && r !== 'BDE') },
            { to: '/staff/front-desk', label: 'Front desk', icon: ConciergeBell, roles: ['FRONT_DESK', 'DIRECTOR', 'MANAGER'] },
        ],
    },
    {
        label: 'Admissions',
        items: [
            { to: '/staff/leads', label: 'Leads CRM', icon: Users, roles: ['DIRECTOR', 'MANAGER', 'COUNSELLOR', 'BDE'] },
            { to: '/staff/take-admission', label: 'New admission', icon: UserPlus, roles: ['DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'COUNSELLOR'] },
            { to: '/staff/my-admissions', label: 'My admissions', icon: FolderOpen, roles: ['COUNSELLOR'] },
            { to: '/staff/calculator', label: 'Fee calculator', icon: Calculator, roles: ['DIRECTOR', 'MANAGER', 'COUNSELLOR', 'FRONT_DESK', 'BDE'] },
            { to: '/staff/token', label: 'Token calculator', icon: Ticket, roles: ['DIRECTOR', 'MANAGER', 'COUNSELLOR', 'FRONT_DESK'] },
        ],
    },
    {
        label: 'Fees',
        items: [
            { to: '/staff/accounts', label: 'Accounts', icon: Wallet, roles: ['DIRECTOR', 'ACCOUNTANT'] },
            { to: '/staff/recovery-desk', label: 'Recovery desk', icon: PhoneCall, roles: ['DIRECTOR', 'MANAGER'] },
            { to: '/staff/recovery', label: 'Fee recovery', icon: AlertCircle, roles: ['DIRECTOR', 'MANAGER', 'ACCOUNTANT'] },
            { to: '/staff/fees', label: 'Fee structures', icon: Settings2, roles: ['DIRECTOR', 'ACCOUNTANT'] },
            { to: '/staff/tie-ups', label: 'College tie-ups', icon: Building2, roles: ['DIRECTOR', 'ACCOUNTANT'] },
        ],
    },
    {
        label: 'Students',
        items: [
            { to: '/staff/student-records', label: 'Student records', icon: GraduationCap, roles: ['DIRECTOR', 'MANAGER'] },
            { to: '/staff/batches', label: 'Batches', icon: ClipboardList, roles: ['DIRECTOR', 'MANAGER'] },
        ],
    },
];

export const navFor = (role) => {
    const r = normaliseRole(role);
    return NAV_GROUPS
        .map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(r)) }))
        .filter(g => g.items.length);
};

// Title for the top bar: the longest nav path that matches the current page.
export const titleFor = (pathname) => {
    if (pathname.startsWith('/staff/profile')) return 'Account settings';
    if (pathname.startsWith('/staff/admission/')) return 'Admission';
    let best = null;
    NAV_GROUPS.forEach(g => g.items.forEach(i => {
        if (pathname === i.to || pathname.startsWith(i.to + '/')) {
            if (!best || i.to.length > best.to.length) best = i;
        }
    }));
    return best?.label || 'Staff portal';
};

export const ROLE_LABEL = {
    DIRECTOR: 'Director', MANAGER: 'Centre manager', ACCOUNTANT: 'Accounts', COUNSELLOR: 'Counsellor',
    FRONT_DESK: 'Front desk', BDE: 'BDE', RECOVERY: 'Recovery',
};
