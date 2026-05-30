import DashboardShell from '../../components/DashboardShell';

// Mirrors the employee NAV_ITEMS in web UserSidebar.js. Clock In/Out points at
// the existing /clock tab; Profile points at the existing /profile tab.
const sections = [
  {
    title: 'ME',
    items: [
      { key: 'profile',       label: 'Profile',       icon: 'profile',       to: '/profile' },
      { key: 'notifications', label: 'Notifications', icon: 'notifications', to: '/notifications' },
    ],
  },
  {
    title: 'TIME',
    items: [
      { key: 'clock',        label: 'Clock In/Out',  icon: 'clock',    to: '/clock' },
      { key: 'shifts',       label: 'Shifts',        icon: 'shifts',   to: '/shifts' },
      { key: 'calendar',     label: 'Calendar',      icon: 'calendar', to: '/calendar' },
      { key: 'leave-bal',    label: 'Leave Balance', icon: 'leave',    to: '/leave-balance' },
      { key: 'time-history', label: 'Time History',  icon: 'history',  to: '/time-history' },
    ],
  },
  {
    title: 'DEVELOPMENT',
    items: [
      { key: 'performance', label: 'Performance', icon: 'performance', to: '/performance' },
      { key: 'elearning',   label: 'E-Learning',  icon: 'elearning',   to: '/elearning' },
    ],
  },
  {
    title: 'REQUESTS',
    items: [
      { key: 'expenses',  label: 'Expenses',  icon: 'expenses',  to: '/expenses' },
      { key: 'documents', label: 'Documents', icon: 'documents', to: '/documents' },
    ],
  },
];

export default function EmployeeHome() {
  return <DashboardShell sections={sections} />;
}
