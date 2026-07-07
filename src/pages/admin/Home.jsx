import DashboardShell, { soon } from '../../components/DashboardShell';
import AdminStats from '../../components/AdminStats';

// Mirrors the admin sidebar in web ModernSidebar.js. Screens not yet built on
// mobile route through ComingSoon (via the `soon(...)` helper).
const sections = [
  {
    title: 'PEOPLE',
    items: [
      { key: 'employees',    label: 'Employees',     icon: 'profile',  to: '/admin/employees' },
      { key: 'org-chart',    label: 'Org Chart',     icon: 'orgChart', to: '/admin/org-chart' },
      { key: 'teams',        label: 'Manage Teams',  icon: 'team',     to: '/admin/teams' },
      { key: 'archive',      label: 'Archived',      icon: 'archive',  to: '/admin/archived' },
      { key: 'leave-bal',    label: 'Leave Balance', icon: 'leave',    to: '/admin/leave-balances' },
    ],
  },
  {
    title: 'WORKFORCE',
    items: [
      { key: 'calendar',     label: 'Leaves',         icon: 'calendar', to: '/admin/calendar' },
      { key: 'shifts',       label: 'Shifts',         icon: 'shifts',   to: '/admin/shifts' },
      { key: 'clock',        label: 'Clock In/Out',   icon: 'clock',    to: '/clock' },
      { key: 'clock-ins',    label: 'Clock-ins',      icon: 'clock',    to: '/admin/clock-ins' },
      { key: 'time-history', label: 'Time History',   icon: 'history',  to: '/admin/time-history' },
    ],
  },
  {
    title: 'REPORTING',
    items: [
      { key: 'objectives',  label: 'Performance', icon: 'performance', to: '/admin/objectives' },
      { key: 'documents',   label: 'Documents',   icon: 'documents',   to: '/admin/documents' },
      { key: 'elearning',   label: 'E-Learning',  icon: 'elearning',   to: '/admin/elearning' },
      { key: 'expenses',    label: 'Expenses',    icon: 'expenses',    to: '/admin/expenses' },
      { key: 'reports',     label: 'Reports',     icon: 'reports',     to: '/admin/reports' },
    ],
  },
];

export default function AdminHome() {
  return <DashboardShell sections={sections} topSlot={<AdminStats />} />;
}
