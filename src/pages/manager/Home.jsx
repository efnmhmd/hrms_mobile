import DashboardShell from '../../components/DashboardShell';

// Mirrors the manager view in web ModernSidebar.js: same admin sections plus
// the manager-only TEAM quick links. Managers get both a personal "My Expenses"
// claim screen (/expenses) and the read-only "Team Expenses" oversight view
// (/manager/expenses) — like the web app, where AddExpense is available to all.
// Leave follows the same dual pattern: a personal "My Leave" balance (/leave-balance)
// alongside the "Team Leave" oversight view (/manager/leave-balances). The team
// roster excludes the manager, so without the personal link a manager would have
// no way to see their own leave balance (mirrors web, where includeAll surfaces it).
const sections = [
  {
    title: 'MY TEAM',
    items: [
      { key: 'approvals', label: 'Approvals', icon: 'approvals', to: '/manager/approvals' },
      { key: 'team',      label: 'My Team',   icon: 'team',      to: '/manager/team' },
      { key: 'objectives', label: 'Objectives', icon: 'performance', to: '/manager/objectives' },
    ],
  },
  {
    title: 'PEOPLE',
    items: [
      { key: 'employees',    label: 'Employees',     icon: 'profile',  to: '/manager/employees' },
      { key: 'org-chart',    label: 'Org Chart',     icon: 'orgChart', to: '/manager/org-chart' },
      { key: 'my-leave',     label: 'My Leave',      icon: 'leave',    to: '/leave-balance' },
      { key: 'leave-bal',    label: 'Team Leave',    icon: 'leave',    to: '/manager/leave-balances' },
    ],
  },
  {
    title: 'WORKFORCE',
    items: [
      { key: 'calendar',     label: 'Calendar',     icon: 'calendar', to: '/manager/calendar' },
      { key: 'shifts',       label: 'Shifts',       icon: 'shifts',   to: '/manager/shifts' },
      { key: 'clock',        label: 'Clock In/Out', icon: 'clock',    to: '/clock' },
      { key: 'clock-ins',    label: 'Clock-ins',    icon: 'clock',    to: '/manager/clock-ins' },
      { key: 'time-history', label: 'Time History', icon: 'history',  to: '/manager/time-history' },
    ],
  },
  {
    title: 'REPORTING',
    items: [
      { key: 'performance',   label: 'Performance',   icon: 'performance', to: '/manager/performance' },
      { key: 'documents',     label: 'Documents',     icon: 'documents',   to: '/manager/documents' },
      { key: 'elearning',     label: 'E-Learning',    icon: 'elearning',   to: '/manager/elearning' },
      { key: 'my-expenses',   label: 'My Expenses',   icon: 'expenses',    to: '/expenses' },
      { key: 'expenses',      label: 'Team Expenses', icon: 'reports',     to: '/manager/expenses' },
      { key: 'reports',       label: 'Reports',       icon: 'reports',     to: '/manager/reports' },
    ],
  },
];

export default function ManagerHome() {
  return <DashboardShell sections={sections} />;
}
