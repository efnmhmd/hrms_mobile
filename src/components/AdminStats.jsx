import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { soon } from './DashboardShell';

// Six stats mirror the web admin Dashboard (ComplianceDashboard.js:678-689):
// employees · active · clocked-in · absent · pending leaves · pending expenses.
// Each card taps through to whichever screen exists on mobile; missing ones
// route to ComingSoon for now.

const styles = `
  @keyframes as-fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes as-skel {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.9; }
  }

  .as-heading {
    display: inline-flex; align-items: center; gap: 0.55rem;
    padding: 0 0.25rem;
    font-family: 'DM Sans', sans-serif;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: #52796f;
    margin-bottom: 0.5rem;
  }
  .as-heading::before {
    content: '';
    width: 14px; height: 1.5px;
    background: linear-gradient(90deg, #84a98c, rgba(132, 169, 140, 0));
    border-radius: 1px;
  }

  .as-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .as-card {
    display: flex; flex-direction: column;
    gap: 0.3rem;
    padding: 0.7rem 0.7rem 0.65rem;
    border-radius: 16px;
    background: #ffffff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47,62,70,0.04), 0 4px 12px rgba(47,62,70,0.05);
    text-decoration: none;
    color: inherit;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.15s, background 0.15s, box-shadow 0.15s;
    animation: as-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both;
    position: relative;
    overflow: hidden;
  }
  .as-card:active {
    transform: scale(0.96);
    background: #f7f8f6;
  }
  .as-card.is-accent {
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.16), rgba(255, 255, 255, 0.95));
  }
  .as-card.is-warn {
    background: linear-gradient(135deg, rgba(192, 117, 106, 0.10), rgba(255, 255, 255, 0.95));
    border-color: rgba(192, 117, 106, 0.30);
  }

  .as-icon-wrap {
    width: 30px; height: 30px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.22), rgba(82, 121, 111, 0.16));
    color: #354f52;
  }
  .as-card.is-warn .as-icon-wrap {
    background: linear-gradient(135deg, rgba(192, 117, 106, 0.22), rgba(192, 117, 106, 0.12));
    color: #b85c50;
  }

  .as-number {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.65rem;
    font-weight: 500;
    line-height: 1;
    color: #2f3e46;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .as-card.is-warn .as-number { color: #7a3028; }

  .as-label {
    font-size: 0.65rem; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
    color: #7a8e84;
    line-height: 1.15;
  }
  .as-card.is-warn .as-label { color: #b85c50; }

  .as-skel {
    height: 92px;
    border-radius: 16px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: as-skel 1.2s ease-in-out infinite;
  }

  .as-error {
    grid-column: 1 / -1;
    padding: 0.7rem 0.85rem;
    border-radius: 12px;
    border-left: 3px solid #c0756a;
    background: linear-gradient(135deg, #fdf3f2, #fdecea);
    font-size: 0.78rem; color: #7a3028;
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.5rem;
  }
  .as-error-retry {
    border: none; background: rgba(192, 117, 106, 0.18);
    color: #7a3028;
    font-size: 0.72rem; font-weight: 600;
    padding: 4px 10px; border-radius: 999px;
    -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .as-error-retry:active { transform: scale(0.97); }
`;

function safeArray(payload, ...paths) {
  for (const p of paths) {
    const v = p.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), payload);
    if (Array.isArray(v)) return v;
  }
  return [];
}

export default function AdminStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      // Run all in parallel. Each .catch keeps a single bad endpoint
      // from blanking the whole panel.
      const [employeesRes, leavesRes, expensesRes, clockRes, attendanceRes] = await Promise.all([
        api.get('/employees?includeAdmins=true').catch(() => null),
        api.get('/leave/pending-requests').catch(() => null),
        api.get('/expenses/approvals?status=pending&limit=500').catch(() => null),
        api.get('/clock/admin/status?includeAdmins=true').catch(() => null),
        api.get('/clock/attendance-status').catch(() => null),
      ]);

      const employees = safeArray(employeesRes?.data, 'data', 'employees') ||
                        (Array.isArray(employeesRes?.data) ? employeesRes.data : []);
      const leaves    = safeArray(leavesRes?.data, 'data');
      const expenses  = safeArray(expensesRes?.data, 'expenses', 'data');
      const expenseTotal = Number(expensesRes?.data?.pagination?.total ?? expenses.length ?? 0);

      const clockedIn = safeArray(clockRes?.data, 'data.clockedIn', 'clockedIn');
      const absent    = Number(attendanceRes?.data?.data?.summary?.absent ?? 0);
      const activeMembers = employees.filter(
        (m) => m.isActive !== false && m.status !== 'Terminated'
      ).length;

      setData({
        employees: employees.length,
        active: activeMembers,
        clockedIn: clockedIn.length,
        absent,
        leaves: leaves.length,
        expenses: expenseTotal,
      });
    } catch (err) {
      setError(err?.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const cards = useMemo(() => ([
    { key: 'employees',  label: 'Employees',  icon: <UsersIcon />, value: data?.employees,  to: '/admin/employees' },
    { key: 'active',     label: 'Active',     icon: <CheckIcon />, value: data?.active,     to: '/admin/employees', accent: true },
    { key: 'clocked-in', label: 'Clocked In', icon: <ClockIcon />, value: data?.clockedIn,  to: '/admin/time-history', accent: true },
    { key: 'absent',     label: 'Absent',     icon: <AlertIcon />, value: data?.absent,     to: '/admin/time-history', warn: true },
    { key: 'leaves',     label: 'Leaves',     icon: <LeaveIcon />, value: data?.leaves,     to: soon('Pending Leaves') },
    { key: 'expenses',   label: 'Expenses',   icon: <ExpenseIcon />, value: data?.expenses, to: soon('Pending Expenses') },
  ]), [data]);

  return (
    <>
      <style>{styles}</style>
      <h3 className="as-heading">At a glance</h3>

      <div className="as-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="as-skel" />)
        ) : (
          <>
            {error && (
              <div className="as-error">
                <span>Couldn't load some stats</span>
                <button className="as-error-retry" onClick={fetchAll}>Retry</button>
              </div>
            )}
            {cards.map((c, i) => (
              <Link
                key={c.key}
                to={c.to}
                className={`as-card ${c.accent ? 'is-accent' : ''} ${c.warn ? 'is-warn' : ''}`}
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <span className="as-icon-wrap">{c.icon}</span>
                <span className="as-number">{c.value ?? '—'}</span>
                <span className="as-label">{c.label}</span>
              </Link>
            ))}
          </>
        )}
      </div>
    </>
  );
}

function Glyph({ d, polyline }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d && <path d={d} />}
      {polyline}
    </svg>
  );
}
const UsersIcon   = () => <Glyph d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />;
const CheckIcon   = () => <Glyph d="M20 6L9 17l-5-5" />;
const ClockIcon   = () => <Glyph d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM12 6v6l4 2" />;
const AlertIcon   = () => <Glyph d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />;
const LeaveIcon   = () => <Glyph d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18" />;
const ExpenseIcon = () => <Glyph d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />;
