// Side menu for each role. `roles` lists who sees an item; ALL = every role.
import {
    LayoutDashboard, Users, UserPlus, Calculator, FolderOpen, Wallet, AlertCircle,
    Settings2, Building2, PhoneCall, ClipboardList, GraduationCap, ConciergeBell, CalendarDays, Megaphone, Headphones, Undo2,
} from 'lucide-react';

const ALL = ['DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'COUNSELLOR', 'FRONT_DESK', 'BDE', 'RECOVERY', 'TELECALLER'];

export const normaliseRole = (role) => {
    const r = (role || '').toUpperCase();
    return r === 'COUNSELOR' || r === 'STAFF' ? 'COUNSELLOR' : r;
};

export const NAV_GROUPS = [
    {
        label: null,
        items: [
            { to: '/staff/dashboard', emoji: '🏠', label: 'Home', icon: LayoutDashboard, roles: ALL.filter(r => r !== 'FRONT_DESK' && r !== 'BDE' && r !== 'TELECALLER') },
            { to: '/staff/front-desk', emoji: '🛎️', label: 'Front desk', icon: ConciergeBell, roles: ['FRONT_DESK', 'DIRECTOR', 'MANAGER'] },
        ],
    },
    {
        label: 'Admissions',
        items: [
            { to: '/staff/leads', emoji: '🎓', label: 'Admissions', icon: Users, roles: ['DIRECTOR', 'MANAGER', 'COUNSELLOR', 'BDE'] },
            { to: '/staff/tele/queue', emoji: '🎧', label: 'Calling queue', icon: Headphones, roles: ['TELECALLER'] },
            { to: '/staff/tele', emoji: '☎️', label: 'Telecalling', icon: Headphones, roles: ['DIRECTOR', 'MANAGER'] },
            { to: '/staff/calendar', emoji: '🗓️', label: 'Calendar', icon: CalendarDays, roles: ['DIRECTOR', 'MANAGER', 'COUNSELLOR'] },
            { to: '/staff/campaigns', emoji: '📣', label: 'Campaigns', icon: Megaphone, roles: ['DIRECTOR', 'MANAGER'] },
            { to: '/staff/take-admission', emoji: '📝', label: 'New admission', icon: UserPlus, roles: ['DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'COUNSELLOR'] },
            { to: '/staff/my-admissions', emoji: '📁', label: 'My admissions', icon: FolderOpen, roles: ['COUNSELLOR'] },
            { to: '/staff/calculator', emoji: '🧮', label: 'Fee calculator', icon: Calculator, roles: ['DIRECTOR', 'MANAGER', 'COUNSELLOR', 'FRONT_DESK', 'BDE'] },
        ],
    },
    {
        label: 'Fees',
        items: [
            { to: '/staff/accounts', emoji: '🧾', label: 'Accounts', icon: Wallet, roles: ['DIRECTOR', 'ACCOUNTANT'] },
            { to: '/staff/recovery-desk', emoji: '📞', label: 'Recovery desk', icon: PhoneCall, roles: ['DIRECTOR', 'MANAGER'] },
            { to: '/staff/recovery', emoji: '⏰', label: 'Fee recovery', icon: AlertCircle, roles: ['DIRECTOR', 'MANAGER', 'ACCOUNTANT'] },
            { to: '/staff/refunds', emoji: '↩️', label: 'Refunds & dropouts', icon: Undo2, roles: ['DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'COUNSELLOR'] },
            { to: '/staff/fees', emoji: '💳', label: 'Fee structures', icon: Settings2, roles: ['DIRECTOR', 'ACCOUNTANT'] },
            { to: '/staff/tie-ups', emoji: '🏛️', label: 'College tie-ups', icon: Building2, roles: ['DIRECTOR', 'ACCOUNTANT'] },
        ],
    },
    {
        label: 'Students',
        items: [
            { to: '/staff/student-records', emoji: '👩‍🎓', label: 'Student records', icon: GraduationCap, roles: ['DIRECTOR', 'MANAGER'] },
            { to: '/staff/batches', emoji: '📚', label: 'Batches', icon: ClipboardList, roles: ['DIRECTOR', 'MANAGER'] },
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
    if (pathname.startsWith('/staff/student/')) return 'Student profile';
    if (pathname.startsWith('/staff/my-day')) return 'My day';
    if (pathname.startsWith('/staff/receipt/')) return 'Fee receipt';
    if (pathname.startsWith('/staff/tele/queue')) return 'Calling queue';
    if (pathname.startsWith('/staff/tele')) return 'Telecalling';
    if (pathname.startsWith('/staff/calendar')) return 'Calendar';
    if (pathname.startsWith('/staff/campaigns')) return 'Campaigns';
    if (pathname.startsWith('/staff/refunds')) return 'Refunds and dropouts';
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
    FRONT_DESK: 'Front desk', BDE: 'BDE', RECOVERY: 'Recovery', TELECALLER: 'Telecaller',
};
