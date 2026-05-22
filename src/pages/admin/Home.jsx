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
      { key: 'teams',        label: 'Manage Teams',  icon: 'team',     to: soon('Manage Teams') },
      { key: 'archive',      label: 'Archived',      icon: 'archive',  to: '/admin/archived' },
      { key: 'leave-bal',    label: 'Leave Balance', icon: 'leave',    to: soon('Annual Leave Balance') },
    ],
  },
  {
    title: 'WORKFORCE',
    items: [
      { key: 'calendar',     label: 'Calendar',       icon: 'calendar', to: '/admin/calendar' },
      { key: 'shifts',       label: 'Shifts',         icon: 'shifts',   to: soon('Shift Management') },
      { key: 'clock',        label: 'Clock In/Out',   icon: 'clock',    to: '/clock' },
      { key: 'clock-ins',    label: 'Clock-ins',      icon: 'clock',    to: '/admin/clock-ins' },
      { key: 'time-history', label: 'Time History',   icon: 'history',  to: '/admin/time-history' },
    ],
  },
  {
    title: 'REPORTING',
    items: [
      { key: 'performance', label: 'Performance', icon: 'performance', to: soon('Performance') },
      { key: 'documents',   label: 'Documents',   icon: 'documents',   to: soon('Documents') },
      { key: 'elearning',   label: 'E-Learning',  icon: 'elearning',   to: soon('E-Learning') },
      { key: 'expenses',    label: 'Expenses',    icon: 'expenses',    to: soon('Expenses') },
      { key: 'reports',     label: 'Reports',     icon: 'reports',     to: soon('Report Library') },
    ],
  },
];

export default function AdminHome() {
  return <DashboardShell sections={sections} topSlot={<AdminStats />} />;
}
