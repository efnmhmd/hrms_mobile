import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

const styles = `
  @keyframes co-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes co-skel {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.85; }
  }
  @keyframes co-pulse {
    0%, 100% { opacity: 0.7; transform: scale(1); }
    50%      { opacity: 1; transform: scale(1.18); }
  }

  .co-wrap { padding: 0.85rem 1rem 6rem; }
  .co-anim { animation: co-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header ── */
  .co-header {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.25rem 0.85rem;
  }
  .co-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18);
    flex-shrink: 0;
  }
  .co-header-text { min-width: 0; flex: 1; }
  .co-header-eyebrow {
    font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c; margin: 0;
  }
  .co-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
  }
  .co-count { font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem; }
  .co-header-meta {
    display: flex; align-items: center; gap: 0.4rem;
    margin-top: 4px;
    font-size: 0.66rem;
    color: #84a98c;
    letter-spacing: 0.04em;
  }
  .co-live-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #84a98c;
    flex-shrink: 0;
    animation: co-pulse 2.4s ease-in-out infinite;
  }
  .co-refresh-btn {
    flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    width: 34px; height: 34px;
    border-radius: 10px;
    border: 1px solid rgba(212, 221, 214, 0.7);
    background: #fff;
    color: #354f52;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, transform 0.12s;
  }
  .co-refresh-btn:active { background: #f1f4f0; transform: scale(0.95); }
  .co-refresh-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .co-refresh-btn.is-spinning svg { animation: co-spin 0.9s linear infinite; }
  @keyframes co-spin { to { transform: rotate(360deg); } }

  /* ── Stats ── */
  .co-stats {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 0.4rem; margin-bottom: 0.85rem;
  }
  .co-stat {
    border: 1px solid rgba(212, 221, 214, 0.7);
    background: #fff;
    border-radius: 12px;
    padding: 0.55rem 0.4rem;
    text-align: center;
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
  }
  .co-stat-val {
    font-size: 1.1rem; font-weight: 700;
    color: #2f3e46;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .co-stat-lab {
    margin-top: 4px;
    font-size: 0.58rem; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: #84a98c;
  }
  .co-stat.is-clocked-in .co-stat-val { color: #354f52; }
  .co-stat.is-on-break  .co-stat-val { color: #b78f3a; }
  .co-stat.is-clocked-out .co-stat-val { color: #7a8e84; }
  .co-stat.is-on-leave  .co-stat-val { color: #5470a8; }

  /* ── Search row + filter ── */
  .co-search-row {
    display: flex; gap: 0.5rem; align-items: stretch;
    margin-bottom: 0.6rem;
  }
  .co-search-wrap { position: relative; flex: 1; min-width: 0; }
  .co-search-icon {
    position: absolute; left: 12px; top: 50%;
    transform: translateY(-50%);
    color: #84a98c; pointer-events: none;
  }
  .co-search-input {
    width: 100%;
    padding: 0.7rem 1rem 0.7rem 2.5rem;
    border: 1.5px solid #d4ddd6; border-radius: 12px;
    font-family: 'DM Sans', sans-serif; font-size: 16px;
    color: #2f3e46; background: #fff; outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
    box-shadow: 0 1px 3px rgba(47, 62, 70, 0.04);
    -webkit-appearance: none; appearance: none;
    box-sizing: border-box;
  }
  .co-search-input:focus {
    border-color: #52796f;
    box-shadow: 0 0 0 3px rgba(82,121,111,0.12);
  }
  .co-filter-btn {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    gap: 0.3rem;
    min-width: 46px; padding: 0 0.75rem;
    border: 1.5px solid #d4ddd6; border-radius: 12px;
    background: #fff; color: #354f52;
    font-family: 'DM Sans', sans-serif; font-size: 0.8rem; font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: border-color 0.18s, background 0.18s;
  }
  .co-filter-btn:active { transform: scale(0.97); }
  .co-filter-btn.is-open,
  .co-filter-btn.is-active {
    border-color: #52796f;
    background: rgba(82,121,111,0.08);
  }
  .co-filter-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 18px; padding: 0 5px;
    border-radius: 999px;
    background: #52796f; color: #fff;
    font-size: 0.65rem; font-weight: 700;
  }
  .co-filter-panel {
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    border-radius: 14px;
    padding: 0.75rem 0.85rem;
    margin-bottom: 0.85rem;
    box-shadow: 0 2px 8px rgba(47, 62, 70, 0.05);
  }
  .co-filter-group + .co-filter-group {
    margin-top: 0.65rem;
    padding-top: 0.65rem;
    border-top: 1px dashed rgba(132, 169, 140, 0.25);
  }
  .co-filter-label {
    font-size: 0.62rem; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #7a8e84;
    margin: 0 0 0.45rem;
  }
  .co-chip-row { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .co-fchip {
    border: 1px solid #d4ddd6;
    background: #fff; color: #354f52;
    border-radius: 999px;
    padding: 0.32rem 0.7rem;
    font-size: 0.74rem; font-weight: 500;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    text-transform: capitalize;
  }
  .co-fchip:active { transform: scale(0.97); }
  .co-fchip.is-on { background: #52796f; border-color: #52796f; color: #fff; }
  .co-filter-clear {
    margin-top: 0.7rem;
    border: none; background: none;
    color: #7a3028;
    font-size: 0.72rem; font-weight: 600;
    padding: 0.2rem 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .co-filter-clear:disabled { opacity: 0.4; cursor: default; }

  /* ── Card list ── */
  .co-list { display: flex; flex-direction: column; gap: 0.4rem; }
  .co-card {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.5rem 0.7rem;
    border-radius: 12px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    border-left: 3px solid transparent;
  }
  .co-card.is-clocked-in  { border-left-color: #52796f; }
  .co-card.is-on-break    { border-left-color: #d8a64c; }
  .co-card.is-on-leave    { border-left-color: #6d88c2; }
  .co-card.is-absent      { border-left-color: #c0756a; }
  .co-card.is-clocked-out { border-left-color: rgba(122, 142, 132, 0.35); }
  .co-card {
    text-align: left;
    width: 100%;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.12s, background 0.15s, box-shadow 0.15s;
  }
  .co-card:active { transform: scale(0.99); background: #f7f8f6; }
  .co-chev { color: #b8c4bc; flex-shrink: 0; margin-left: 0.1rem; }

  .co-avatar {
    width: 34px; height: 34px; border-radius: 50%;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.28), rgba(82, 121, 111, 0.22));
    color: #354f52;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.72rem; font-weight: 600;
    flex-shrink: 0;
    position: relative;
  }
  .co-avatar-dot {
    position: absolute; right: -1px; bottom: -1px;
    width: 10px; height: 10px;
    border: 2px solid #fff;
    border-radius: 50%;
    background: #b8c4bc;
  }
  .co-avatar-dot.is-clocked-in { background: #52796f; animation: co-pulse 2.4s ease-in-out infinite; }
  .co-avatar-dot.is-on-break  { background: #d8a64c; }
  .co-avatar-dot.is-on-leave  { background: #6d88c2; }
  .co-avatar-dot.is-absent    { background: #c0756a; }

  .co-meta { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .co-row-top {
    display: flex; align-items: baseline; gap: 0.4rem;
    min-width: 0;
  }
  .co-name {
    font-size: 0.86rem; font-weight: 600;
    color: #2f3e46; line-height: 1.15;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    min-width: 0;
  }
  .co-dept {
    font-size: 0.66rem; color: #84a98c;
    letter-spacing: 0.04em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    flex-shrink: 1;
  }
  .co-row-bot {
    display: flex; align-items: center; gap: 0.4rem;
    font-size: 0.7rem; color: #7a8e84;
    font-variant-numeric: tabular-nums;
    min-width: 0;
  }
  .co-time-pair {
    color: #52796f; font-weight: 600;
    white-space: nowrap;
  }
  .co-time-pair .co-arrow {
    color: #b8c4bc; padding: 0 0.18rem; font-weight: 400;
  }
  .co-time-pair .co-now {
    color: #84a98c; font-style: italic; font-weight: 500;
  }
  .co-dot-sep { color: #cdd5cf; }
  .co-duration {
    color: #354f52; font-weight: 600;
    white-space: nowrap;
  }
  .co-break-tag {
    display: inline-flex; align-items: center; gap: 3px;
    color: #b78f3a; font-weight: 600;
    white-space: nowrap;
  }
  .co-break-tag svg { flex-shrink: 0; }
  .co-idle {
    color: #9aa8a0;
  }

  .co-right {
    display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
    flex-shrink: 0;
  }
  .co-status-pill {
    font-size: 0.58rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    padding: 2px 7px; border-radius: 999px;
    background: rgba(132, 169, 140, 0.18);
    color: #354f52;
    white-space: nowrap;
  }
  .co-status-pill.is-clocked-in { background: rgba(82, 121, 111, 0.18); color: #354f52; }
  .co-status-pill.is-on-break  { background: rgba(216, 166, 76, 0.18); color: #7a591f; }
  .co-status-pill.is-clocked-out { background: rgba(122, 142, 132, 0.16); color: #4d5e57; }
  .co-status-pill.is-on-leave  { background: rgba(109, 136, 194, 0.16); color: #3c5285; }
  .co-status-pill.is-absent    { background: rgba(192, 117, 106, 0.18); color: #7a3028; }
  .co-role-tag {
    font-size: 0.58rem; font-weight: 500;
    color: #9aa8a0;
    letter-spacing: 0.05em; text-transform: uppercase;
  }

  /* ── States ── */
  .co-skel {
    height: 52px; border-radius: 12px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: co-skel 1.2s ease-in-out infinite;
  }
  .co-empty, .co-error {
    padding: 2rem 1rem; border-radius: 16px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center; color: #52796f;
  }
  .co-error {
    border-color: rgba(192, 117, 106, 0.4);
    color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .co-empty-title, .co-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .co-empty-sub, .co-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .co-retry {
    margin-top: 0.85rem;
    padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .co-retry:active { transform: scale(0.97); }
`;

const STATUS_OPTIONS = [
  { key: 'clocked-in',  label: 'Clocked In' },
  { key: 'on-break',    label: 'On Break' },
  { key: 'clocked-out', label: 'Clocked Out' },
  { key: 'on-leave',    label: 'On Leave' },
  { key: 'absent',      label: 'Absent' },
];

function normalizeStatus(s) {
  return (s || 'clocked-out').toString().replace('_', '-').toLowerCase();
}

function initials(emp) {
  const f = (emp?.firstName || '').charAt(0);
  const l = (emp?.lastName || '').charAt(0);
  return (f + l).toUpperCase() || (emp?.email || '?').charAt(0).toUpperCase();
}

function fullName(emp) {
  return [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim() || emp?.email || 'Unnamed';
}

function statusLabel(key) {
  return STATUS_OPTIONS.find((s) => s.key === key)?.label || key.replace('-', ' ');
}

function timeToDate(t) {
  if (!t) return null;
  if (typeof t === 'string' && t.includes('T')) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t));
  if (!m) return null;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

function timeOnly(t) {
  const d = timeToDate(t);
  if (!d) return null;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDuration(mins) {
  if (mins == null || mins < 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function workedMinutes(emp, now) {
  const start = timeToDate(emp?.clockIn);
  if (!start) return null;
  const end = timeToDate(emp?.clockOut) || now;
  if (!end) return null;
  let diff = Math.floor((end - start) / 60000);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function breakMinutes(emp, now) {
  const start = timeToDate(emp?.breakIn);
  if (!start) return null;
  const end = timeToDate(emp?.breakOut) || now;
  if (!end) return null;
  let diff = Math.floor((end - start) / 60000);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function roleTag(emp) {
  return emp?.jobTitle || emp?.role || emp?.department || '';
}

function formatRelative(then, now) {
  if (!then) return null;
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function exactClock(d) {
  if (!d) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function ClockInsOverview() {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/manager') ? '/manager/clock-ins' : '/admin/clock-ins';
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState([]);
  const [deptFilters, setDeptFilters] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  async function fetchOverview() {
    setLoading(true);
    setError(null);
    try {
      const [empRes, statusRes] = await Promise.all([
        api.get('/employees?includeAdmins=true'),
        api.get('/clock/status?includeAdmins=true').catch(() => ({ data: null })),
      ]);

      const empList =
        empRes?.data?.data ||
        empRes?.data?.employees ||
        (Array.isArray(empRes?.data) ? empRes.data : []);

      const statusPayload = statusRes?.data?.data || statusRes?.data || {};
      const statusList =
        statusPayload?.employees ||
        statusPayload?.allEmployees ||
        (Array.isArray(statusPayload) ? statusPayload : []);

      const statusMap = new Map();
      for (const s of statusList) {
        const key = s?.email || s?._id || s?.id;
        if (key) statusMap.set(String(key), s);
      }

      const merged = empList.map((e) => {
        const k = String(e?.email || e?._id || e?.id || '');
        const live = statusMap.get(k);
        return {
          ...e,
          status: normalizeStatus(live?.status || e?.status || 'clocked-out'),
          clockIn: live?.clockIn || e?.clockIn || null,
          clockOut: live?.clockOut || e?.clockOut || null,
          breakIn: live?.breakIn || e?.breakIn || null,
          breakOut: live?.breakOut || e?.breakOut || null,
        };
      });

      setEmployees(merged);
      setLastUpdatedAt(new Date());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOverview();
  }, []);

  const deptOptions = useMemo(() => {
    const set = new Set();
    for (const e of employees) if (e?.department) set.add(e.department);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const stats = useMemo(() => {
    const s = { 'clocked-in': 0, 'on-break': 0, 'clocked-out': 0, 'on-leave': 0, absent: 0 };
    for (const e of employees) {
      const key = normalizeStatus(e.status);
      if (s[key] != null) s[key] += 1;
    }
    return s;
  }, [employees]);

  const activeFilterCount = statusFilters.length + deptFilters.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      const status = normalizeStatus(e.status);
      if (statusFilters.length && !statusFilters.includes(status)) return false;
      if (deptFilters.length && !deptFilters.includes(e.department)) return false;
      if (!q) return true;
      const hay = [e.firstName, e.lastName, e.email, e.jobTitle, e.department, e.team]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [employees, query, statusFilters, deptFilters]);

  function toggleFilter(setter, value) {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function clearAllFilters() {
    setStatusFilters([]);
    setDeptFilters([]);
  }

  return (
    <>
      <style>{styles}</style>
      <div className="co-wrap">
        <header className="co-header co-anim">
          <div className="co-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </div>
          <div className="co-header-text">
            <p className="co-header-eyebrow">Workforce Status</p>
            <h1 className="co-header-title">
              Clock-ins
              {!loading && !error && (
                <span className="co-count"> · {filtered.length}</span>
              )}
            </h1>
            {lastUpdatedAt && !error && (
              <div className="co-header-meta">
                <span className="co-live-dot" aria-hidden="true" />
                <span>Updated {formatRelative(lastUpdatedAt, now)}</span>
                <span style={{ color: '#cdd5cf' }}>·</span>
                <span>{exactClock(lastUpdatedAt)}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            className={`co-refresh-btn${loading ? ' is-spinning' : ''}`}
            onClick={fetchOverview}
            disabled={loading}
            aria-label="Refresh"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </header>

        <div className="co-stats co-anim">
          <div className="co-stat is-clocked-in">
            <div className="co-stat-val">{stats['clocked-in']}</div>
            <div className="co-stat-lab">In</div>
          </div>
          <div className="co-stat is-on-break">
            <div className="co-stat-val">{stats['on-break']}</div>
            <div className="co-stat-lab">Break</div>
          </div>
          <div className="co-stat is-clocked-out">
            <div className="co-stat-val">{stats['clocked-out']}</div>
            <div className="co-stat-lab">Out</div>
          </div>
          <div className="co-stat is-on-leave">
            <div className="co-stat-val">{stats['on-leave']}</div>
            <div className="co-stat-lab">Leave</div>
          </div>
        </div>

        <div className="co-search-row co-anim">
          <div className="co-search-wrap">
            <span className="co-search-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              type="search"
              className="co-search-input"
              placeholder="Search by name, role, team…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <button
            type="button"
            className={`co-filter-btn${filtersOpen ? ' is-open' : ''}${activeFilterCount > 0 ? ' is-active' : ''}`}
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-label="Toggle filters"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 5h18M6 12h12M10 19h4" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="co-filter-badge">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="co-filter-panel co-anim">
            <div className="co-filter-group">
              <p className="co-filter-label">Status</p>
              <div className="co-chip-row">
                {STATUS_OPTIONS.map((s) => {
                  const on = statusFilters.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      className={`co-fchip${on ? ' is-on' : ''}`}
                      onClick={() => toggleFilter(setStatusFilters, s.key)}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {deptOptions.length > 0 && (
              <div className="co-filter-group">
                <p className="co-filter-label">Department</p>
                <div className="co-chip-row">
                  {deptOptions.map((d) => {
                    const on = deptFilters.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        className={`co-fchip${on ? ' is-on' : ''}`}
                        onClick={() => toggleFilter(setDeptFilters, d)}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <button
              type="button"
              className="co-filter-clear"
              onClick={clearAllFilters}
              disabled={activeFilterCount === 0}
            >
              Clear all filters
            </button>
          </div>
        )}

        {loading ? (
          <div className="co-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="co-skel" />
            ))}
          </div>
        ) : error ? (
          <div className="co-error co-anim">
            <p className="co-error-title">Couldn't load clock-in status</p>
            <p className="co-error-sub">{error}</p>
            <button className="co-retry" onClick={fetchOverview}>Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="co-empty co-anim">
            <p className="co-empty-title">
              {query || activeFilterCount > 0 ? 'No matches' : 'No employees yet'}
            </p>
            <p className="co-empty-sub">
              {query || activeFilterCount > 0
                ? 'Try a different search term or adjust filters.'
                : 'Add employees to see their clock-in status here.'}
            </p>
          </div>
        ) : (
          <div className="co-list">
            {filtered.map((emp, i) => {
              const status = normalizeStatus(emp.status);
              const inT = timeOnly(emp.clockIn);
              const outT = timeOnly(emp.clockOut);
              const isLive = status === 'clocked-in' || status === 'on-break';
              const showTimes = !!inT && (status !== 'clocked-out' || !!outT);
              const worked = isLive || (status === 'clocked-out' && emp.clockOut)
                ? workedMinutes(emp, now)
                : null;
              const breakStartT = timeOnly(emp.breakIn);
              const breakMins = status === 'on-break' ? breakMinutes(emp, now) : null;
              const dept = emp.department || emp.team;
              const role = roleTag(emp);
              const empId = emp._id || emp.id;
              return (
                <button
                  type="button"
                  key={empId || emp.email || i}
                  className={`co-card co-anim is-${status}`}
                  style={{ animationDelay: `${Math.min(i, 6) * 25}ms`, border: '1px solid rgba(212, 221, 214, 0.7)' }}
                  onClick={() => {
                    if (!empId) return;
                    navigate(`${basePath}/${empId}`, { state: { employee: emp } });
                  }}
                >
                  <span className="co-avatar">
                    {initials(emp)}
                    <span className={`co-avatar-dot is-${status}`} />
                  </span>
                  <span className="co-meta">
                    <span className="co-row-top">
                      <span className="co-name">{fullName(emp)}</span>
                      {dept && <span className="co-dept">· {dept}</span>}
                    </span>
                    <span className="co-row-bot">
                      {showTimes ? (
                        <>
                          <span className="co-time-pair">
                            {inT}
                            <span className="co-arrow">→</span>
                            {outT ? outT : <span className="co-now">now</span>}
                          </span>
                          {worked != null && (
                            <>
                              <span className="co-dot-sep">·</span>
                              <span className="co-duration">{formatDuration(worked)}</span>
                            </>
                          )}
                          {status === 'on-break' && breakStartT && (
                            <>
                              <span className="co-dot-sep">·</span>
                              <span className="co-break-tag">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <rect x="6" y="5" width="4" height="14" rx="1" />
                                  <rect x="14" y="5" width="4" height="14" rx="1" />
                                </svg>
                                {breakStartT}
                                {breakMins != null ? ` · ${formatDuration(breakMins)}` : ''}
                              </span>
                            </>
                          )}
                        </>
                      ) : (
                        <span className="co-idle">
                          {status === 'on-leave' ? 'On leave today'
                            : status === 'absent' ? 'No clock-in yet'
                            : 'Not clocked in today'}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="co-right">
                    <span className={`co-status-pill is-${status}`}>
                      {statusLabel(status)}
                    </span>
                    {role && role !== dept && (
                      <span className="co-role-tag">{role}</span>
                    )}
                  </span>
                  <span className="co-chev" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
