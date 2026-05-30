import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './pages/Login';
import AdminHome from './pages/admin/Home';
import AdminEmployees from './pages/admin/Employees';
import AdminOrgChart from './pages/admin/OrgChart';
import AdminTimeHistory from './pages/admin/TimeHistory';
import AdminArchived from './pages/admin/Archived';
import ClockInsOverview from './pages/admin/ClockInsOverview';
import ClockInDetail from './pages/admin/ClockInDetail';
import AdminManageTeams from './pages/admin/ManageTeams';
import AdminLeaveBalances from './pages/admin/LeaveBalances';
import AdminExpenses from './pages/admin/Expenses';
import AdminPerformance from './pages/admin/Performance';
import AdminDocuments from './pages/admin/Documents';
import AdminELearning from './pages/admin/ELearning';
import AdminReports from './pages/admin/Reports';
import ManagerHome from './pages/manager/Home';
import ManagerApprovals from './pages/manager/Approvals';
import ManagerObjectives from './pages/manager/Objectives';
import ManagerTeam from './pages/manager/Team';
import ManagerLeaveBalances from './pages/manager/LeaveBalances';
import ManagerShiftManagement from './pages/manager/ShiftManagement';
import EmployeeHome from './pages/employee/Home';
import Shifts from './pages/employee/Shifts';
import Notifications from './pages/employee/Notifications';
import LeaveBalance from './pages/employee/LeaveBalance';
import EmployeeTimeHistory from './pages/employee/TimeHistory';
import Performance from './pages/employee/Performance';
import ELearning from './pages/employee/ELearning';
import EmployeeExpenses from './pages/employee/Expenses';
import EmployeeDocuments from './pages/employee/Documents';
import Clock from './pages/Clock';
import Profile from './pages/Profile';
import Calendar from './pages/Calendar';
import EmployeeDetail from './pages/EmployeeDetail';
import ComingSoon from './pages/ComingSoon';
import TabLayout from './components/TabLayout';
import { api } from './utils/api';
import { getToken, getUser, clearSession, getUserGroup, USER_GROUPS } from './utils/auth';

const HOME_FOR_GROUP = {
  [USER_GROUPS.ADMIN]: AdminHome,
  [USER_GROUPS.MANAGER]: ManagerHome,
  [USER_GROUPS.EMPLOYEE]: EmployeeHome,
};

// Where each user group lands right after login.
const LANDING_FOR_GROUP = {
  [USER_GROUPS.ADMIN]: '/',
  [USER_GROUPS.MANAGER]: '/',
  [USER_GROUPS.EMPLOYEE]: '/clock',
};

export default function App() {
  const [authed, setAuthed] = useState(null);
  const [userGroup, setUserGroup] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        setUserGroup(getUserGroup(await getUser()));
      }
      setAuthed(!!token);
    })();
  }, []);

  async function handleLogin(group) {
    const resolved = group || getUserGroup(await getUser());
    setUserGroup(resolved);
    setAuthed(true);
    navigate(LANDING_FOR_GROUP[resolved] || '/', { replace: true });
  }

  async function handleLogout() {
    // Hit /auth/logout so the server can destroy the session cookie.
    try {
      await api.post('/auth/logout');
    } catch {
      // Swallow — local sign-out should always succeed.
    }
    await clearSession();
    setUserGroup(null);
    setAuthed(false);
  }

  if (authed === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <Routes>
        <Route path="*" element={<Login onLogin={handleLogin} />} />
      </Routes>
    );
  }

  const HomeForGroup = HOME_FOR_GROUP[userGroup] || EmployeeHome;

  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route path="/" element={<HomeForGroup />} />
        <Route path="/clock" element={<Clock />} />
        <Route path="/shifts" element={<Shifts />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/leave-balance" element={<LeaveBalance />} />
        <Route path="/time-history" element={<EmployeeTimeHistory />} />
        <Route path="/performance" element={<Performance />} />
        <Route path="/elearning" element={<ELearning />} />
        <Route path="/expenses" element={<EmployeeExpenses />} />
        <Route path="/documents" element={<EmployeeDocuments />} />
        <Route path="/profile" element={<Profile onLogout={handleLogout} />} />
        <Route path="/admin/employees" element={<AdminEmployees />} />
        <Route path="/admin/org-chart" element={<AdminOrgChart />} />
        <Route path="/admin/time-history" element={<AdminTimeHistory />} />
        <Route path="/admin/archived" element={<AdminArchived />} />
        <Route path="/admin/clock-ins" element={<ClockInsOverview />} />
        <Route path="/admin/clock-ins/:id" element={<ClockInDetail />} />
        <Route path="/admin/calendar" element={<Calendar />} />
        <Route path="/admin/teams" element={<AdminManageTeams />} />
        <Route path="/admin/shifts" element={<ManagerShiftManagement />} />
        <Route path="/admin/leave-balances" element={<AdminLeaveBalances />} />
        <Route path="/admin/expenses" element={<AdminExpenses />} />
        <Route path="/admin/performance" element={<AdminPerformance />} />
        <Route path="/admin/documents" element={<AdminDocuments />} />
        <Route path="/admin/elearning" element={<AdminELearning />} />
        <Route path="/admin/reports" element={<AdminReports />} />
        <Route path="/manager/employees" element={<AdminEmployees />} />
        <Route path="/manager/org-chart" element={<AdminOrgChart />} />
        <Route path="/manager/approvals" element={<ManagerApprovals />} />
        <Route path="/manager/objectives" element={<ManagerObjectives />} />
        <Route path="/manager/team" element={<ManagerTeam />} />
        <Route path="/manager/leave-balances" element={<ManagerLeaveBalances />} />
        <Route path="/manager/shifts" element={<ManagerShiftManagement />} />
        <Route path="/manager/clock-ins" element={<ClockInsOverview />} />
        <Route path="/manager/clock-ins/:id" element={<ClockInDetail />} />
        <Route path="/manager/time-history" element={<AdminTimeHistory />} />
        <Route path="/manager/calendar" element={<Calendar />} />
        <Route path="/manager/expenses" element={<AdminExpenses />} />
        <Route path="/manager/performance" element={<AdminPerformance />} />
        <Route path="/manager/documents" element={<AdminDocuments />} />
        <Route path="/manager/elearning" element={<AdminELearning />} />
        <Route path="/manager/reports" element={<AdminReports />} />
        <Route path="/employees/:id" element={<EmployeeDetail />} />
        <Route path="/soon" element={<ComingSoon />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
