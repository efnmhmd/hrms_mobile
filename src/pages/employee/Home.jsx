import DashboardShell, { soon } from '../../components/DashboardShell';

// Mirrors the employee NAV_ITEMS in web UserSidebar.js. Clock In/Out points at
// the existing /clock tab; Profile points at the existing /profile tab.
const sections = [
  {
    title: 'ME',
    items: [
      { key: 'profile',       label: 'Profile',       icon: 'profile',       to: '/profile' },
      { key: 'notifications', label: 'Notifications', icon: 'notifications', to: soon('Notifications') },
    ],
  },
  {
    title: 'TIME',
    items: [
      { key: 'clock',        label: 'Clock In/Out',  icon: 'clock',    to: '/clock' },
      { key: 'shifts',       label: 'Shifts',        icon: 'shifts',   to: soon('Shifts') },
      { key: 'calendar',     label: 'Calendar',      icon: 'calendar', to: soon('Calendar') },
      { key: 'leave-bal',    label: 'Leave Balance', icon: 'leave',    to: soon('Annual Leave Balance') },
      { key: 'time-history', label: 'Time History',  icon: 'history',  to: soon('Time History') },
    ],
  },
  {
    title: 'DEVELOPMENT',
    items: [
      { key: 'performance', label: 'Performance', icon: 'performance', to: soon('Performance') },
      { key: 'elearning',   label: 'E-Learning',  icon: 'elearning',   to: soon('E-Learning') },
    ],
  },
  {
    title: 'REQUESTS',
    items: [
      { key: 'expenses',  label: 'Expenses',  icon: 'expenses',  to: soon('Expenses') },
      { key: 'documents', label: 'Documents', icon: 'documents', to: soon('Documents') },
    ],
  },
];

export default function EmployeeHome() {
  return <DashboardShell sections={sections} />;
}
