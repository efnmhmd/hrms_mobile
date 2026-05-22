import DashboardShell, { soon } from '../../components/DashboardShell';

// Mirrors the manager view in web ModernSidebar.js: same admin sections plus
// the manager-only TEAM quick links, and expenses pointing at /manager/expenses.
const sections = [
  {
    title: 'MY TEAM',
    items: [
      { key: 'approvals', label: 'Approvals', icon: 'approvals', to: '/manager/approvals' },
      { key: 'team',      label: 'My Team',   icon: 'team',      to: soon('My Team') },
      { key: 'objectives', label: 'Objectives', icon: 'performance', to: '/manager/objectives' },
    ],
  },
  {
    title: 'PEOPLE',
    items: [
      { key: 'employees',    label: 'Employees',     icon: 'profile',  to: '/manager/employees' },
      { key: 'org-chart',    label: 'Org Chart',     icon: 'orgChart', to: '/manager/org-chart' },
      { key: 'leave-bal',    label: 'Leave Balance', icon: 'leave',    to: soon('Annual Leave Balance') },
    ],
  },
  {
    title: 'WORKFORCE',
    items: [
      { key: 'calendar',     label: 'Calendar',     icon: 'calendar', to: '/manager/calendar' },
      { key: 'shifts',       label: 'Shifts',       icon: 'shifts',   to: soon('Shift Management') },
      { key: 'clock',        label: 'Clock In/Out', icon: 'clock',    to: '/clock' },
      { key: 'clock-ins',    label: 'Clock-ins',    icon: 'clock',    to: '/manager/clock-ins' },
      { key: 'time-history', label: 'Time History', icon: 'history',  to: '/manager/time-history' },
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

export default function ManagerHome() {
  return <DashboardShell sections={sections} />;
}
