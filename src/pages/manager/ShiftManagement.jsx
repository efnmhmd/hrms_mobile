import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Manager shift-management / team-rota overview.
//   GET /rota/shift-assignments/all?startDate=&endDate=  → { data: [...] }
// Same team-wide endpoint the shared Calendar uses. Windowed to the visible
// week, grouped per day so a manager can see who's covering each day. Read-only
// oversight — creating / editing shifts stays on the web rota planner.

const styles = `
  @keyframes sm-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes sm-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes sm-spin { to { transform: rotate(360deg); } }

  .sm-wrap { padding: 0.85rem 1rem 6rem; }
  .sm-anim { animation: sm-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  .sm-header { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.25rem 0.85rem; }
  .sm-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18); flex-shrink: 0;
  }
  .sm-header-text { min-width: 0; flex: 1; }
  .sm-header-eyebrow { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .sm-header-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1; font-weight: 400; color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0; }
  .sm-refresh {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .sm-refresh:disabled { opacity: 0.55; }
  .sm-refresh:not(:disabled):active { transform: scale(0.94); }
  .sm-refresh.is-busy svg { animation: sm-spin 0.8s linear infinite; }

  /* ── Week navigator ── */
  .sm-weeknav {
    display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.85rem;
    background: #fff; border: 1px solid rgba(212, 221, 214, 0.7); border-radius: 14px;
    padding: 0.5rem 0.55rem; box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
  }
  .sm-weeknav-btn {
    flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px;
    border: 1px solid rgba(212, 221, 214, 0.8); background: #fff; color: #354f52;
    display: flex; align-items: center; justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, transform 0.12s;
  }
  .sm-weeknav-btn:active { background: #f1f4f0; transform: scale(0.94); }
  .sm-weeknav-mid { flex: 1; min-width: 0; text-align: center; }
  .sm-weeknav-range { font-size: 0.85rem; font-weight: 600; color: #2f3e46; line-height: 1.15; }
  .sm-weeknav-rel { font-size: 0.62rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #84a98c; margin-top: 1px; }
  .sm-today-btn {
    margin-bottom: 0.85rem; width: 100%;
    border: 1px dashed rgba(132, 169, 140, 0.5); background: rgba(132, 169, 140, 0.08);
    color: #52796f; border-radius: 10px; padding: 0.4rem; font-size: 0.72rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .sm-today-btn:active { transform: scale(0.98); }

  /* ── Summary ── */
  .sm-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; margin-bottom: 0.85rem; }
  .sm-stat { border: 1px solid rgba(212, 221, 214, 0.7); background: #fff; border-radius: 12px; padding: 0.6rem 0.5rem; text-align: center; box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04); }
  .sm-stat-val { font-size: 1.15rem; font-weight: 700; color: #2f3e46; font-variant-numeric: tabular-nums; line-height: 1; }
  .sm-stat-lab { margin-top: 4px; font-size: 0.55rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #84a98c; }

  /* ── Search ── */
  .sm-search { position: relative; margin-bottom: 0.85rem; }
  .sm-search svg { position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%); color: #84a98c; pointer-events: none; }
  .sm-search input {
    width: 100%; padding: 0.65rem 0.75rem 0.65rem 2.2rem; border-radius: 12px;
    border: 1.5px solid #d4ddd6; background: #fff; font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46;
    -webkit-appearance: none; appearance: none; box-sizing: border-box; -webkit-tap-highlight-color: transparent;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .sm-search input::placeholder { color: #a7b6ac; }
  .sm-search input:focus { outline: none; border-color: #52796f; box-shadow: 0 0 0 3px rgba(82, 121, 111, 0.12); }

  /* ── Day group ── */
  .sm-day { margin-bottom: 0.4rem; }
  .sm-day-head {
    display: flex; align-items: center; gap: 0.5rem;
    margin: 0.7rem 0.25rem 0.45rem;
  }
  .sm-day-label { font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #52796f; }
  .sm-day-label.is-today { color: #354f52; }
  .sm-day-pill { font-size: 0.55rem; font-weight: 700; letter-spacing: 0.06em; color: #fff; background: #52796f; border-radius: 999px; padding: 1px 6px; }
  .sm-day-line { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(132,169,140,0.35), rgba(132,169,140,0)); }
  .sm-day-num { font-size: 0.62rem; color: #9aa8a0; font-weight: 600; }

  .sm-card {
    display: flex; align-items: center; gap: 0.65rem; width: 100%; text-align: left;
    padding: 0.6rem 0.75rem; border-radius: 13px; background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.4rem; font-family: 'DM Sans', sans-serif; cursor: pointer;
    -webkit-tap-highlight-color: transparent; transition: transform 0.12s, background 0.15s;
    border-left: 3px solid #52796f;
  }
  .sm-card:active { transform: scale(0.99); background: #f7f8f6; }
  .sm-card.is-completed { border-left-color: #4c8c52; }
  .sm-card.is-danger { border-left-color: #c0756a; }
  .sm-card.is-warn { border-left-color: #c49c4a; }
  .sm-avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 0.74rem; font-weight: 700; background: linear-gradient(135deg, rgba(132, 169, 140, 0.28), rgba(82, 121, 111, 0.18)); color: #354f52; }
  .sm-body { min-width: 0; flex: 1; }
  .sm-name { font-size: 0.85rem; font-weight: 600; color: #2f3e46; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sm-meta { margin-top: 2px; display: flex; align-items: center; gap: 0.4rem; font-size: 0.72rem; color: #52796f; }
  .sm-meta .sm-time { font-weight: 600; color: #2f3e46; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sm-meta .sm-loc { color: #7a8e84; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sm-status { flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.03em; border-radius: 999px; padding: 2px 7px; border: 1px solid transparent; white-space: nowrap; }
  .sm-status-dot { width: 5px; height: 5px; border-radius: 50%; }
  .sm-status-scheduled { background: rgba(82,121,111,0.1); color: #354f52; border-color: rgba(82,121,111,0.25); }
  .sm-status-scheduled .sm-status-dot { background: #52796f; }
  .sm-status-completed { background: rgba(76,140,82,0.12); color: #2f6e34; border-color: rgba(76,140,82,0.28); }
  .sm-status-completed .sm-status-dot { background: #4c8c52; }
  .sm-status-danger { background: rgba(192,117,106,0.12); color: #8a352b; border-color: rgba(192,117,106,0.3); }
  .sm-status-danger .sm-status-dot { background: #c0756a; }
  .sm-status-warn { background: rgba(196,156,74,0.14); color: #7a5a16; border-color: rgba(196,156,74,0.32); }
  .sm-status-warn .sm-status-dot { background: #c49c4a; }

  .sm-day-empty { font-size: 0.72rem; color: #aab6ad; font-style: italic; padding: 0.3rem 0.5rem 0.5rem; }

  /* ── States ── */
  .sm-skel { height: 56px; border-radius: 13px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%); animation: sm-skel 1.2s ease-in-out infinite; margin-bottom: 0.4rem; }
  .sm-error {
    padding: 2rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(192, 117, 106, 0.4); text-align: center; color: #7a3028;
  }
  .sm-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .sm-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .sm-retry { margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .sm-retry:active { transform: scale(0.97); }
  .sm-empty-week {
    padding: 1.6rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .sm-empty-week-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .sm-empty-week-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
`;

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Monday as the start of the week.
function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - day);
  return d;
}

function shiftDate(shift) {
  const base = shift?.date || shift?.startDate || shift?.endDate;
  if (!base) return null;
  const d = new Date(base);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTime(t) {
  if (!t) return null;
  if (typeof t === 'string' && t.includes('T')) {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t));
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function shiftEmployee(shift) {
  if (shift?.employeeId && typeof shift.employeeId === 'object') {
    return {
      id: shift.employeeId._id || shift.employeeId.id,
      name: [shift.employeeId.firstName, shift.employeeId.lastName].filter(Boolean).join(' ').trim() || shift.employeeId.email,
    };
  }
  if (shift?.employee && typeof shift.employee === 'object') {
    return {
      id: shift.employee._id || shift.employee.id,
      name: [shift.employee.firstName, shift.employee.lastName].filter(Boolean).join(' ').trim() || shift.employee.email,
    };
  }
  return { id: typeof shift?.employeeId === 'string' ? shift.employeeId : null, name: shift?.employeeName || 'Unassigned' };
}

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  const a = parts[0]?.charAt(0) || '';
  const b = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (a + b).toUpperCase() || '?';
}

function statusClass(status) {
  switch (status) {
    case 'Completed': return 'sm-status-completed';
    case 'Cancelled':
    case 'Missed': return 'sm-status-danger';
    case 'Scheduled': return 'sm-status-scheduled';
    default: return 'sm-status-warn';
  }
}

function cardTone(status) {
  switch (status) {
    case 'Completed': return 'is-completed';
    case 'Cancelled':
    case 'Missed': return 'is-danger';
    case 'Scheduled': return '';
    default: return 'is-warn';
  }
}

function shiftStartMinutes(shift) {
  const t = formatTime(shift?.startTime);
  if (!t) return 9999;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 9999;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ManagerShiftManagement() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const todayYMD = toYMD(startOfWeek(new Date())) === toYMD(weekStart)
    ? toYMD(new Date())
    : null;

  async function fetchShifts(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/rota/shift-assignments/all', {
        params: { startDate: toYMD(weekStart), endDate: toYMD(weekEnd) },
      });
      const list = data?.data || (Array.isArray(data) ? data : []);
      setShifts(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const filteredShifts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shifts;
    return shifts.filter((s) => {
      const emp = shiftEmployee(s);
      const hay = [emp.name, s.location, s.shiftType, s.role, s.status].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [shifts, search]);

  const stats = useMemo(() => {
    const employees = new Set();
    let active = 0;
    for (const s of shifts) {
      const emp = shiftEmployee(s);
      if (emp.id || emp.name) employees.add(emp.id || emp.name);
      if (s.status !== 'Cancelled') active += 1;
    }
    return { shifts: active, employees: employees.size, total: shifts.length };
  }, [shifts]);

  // Build the 7 day buckets for the visible week.
  const days = useMemo(() => {
    const buckets = WEEKDAYS.map((_, i) => {
      const date = addDays(weekStart, i);
      return { date, ymd: toYMD(date), items: [] };
    });
    const byYmd = new Map(buckets.map((b) => [b.ymd, b]));
    for (const s of filteredShifts) {
      const d = shiftDate(s);
      if (!d) continue;
      const bucket = byYmd.get(toYMD(d));
      if (bucket) bucket.items.push(s);
    }
    for (const b of buckets) b.items.sort((a, c) => shiftStartMinutes(a) - shiftStartMinutes(c));
    return buckets;
  }, [filteredShifts, weekStart]);

  const rangeLabel = useMemo(() => {
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
    const startStr = weekStart.toLocaleDateString(undefined, { day: 'numeric', month: sameMonth ? undefined : 'short' });
    const endStr = weekEnd.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }, [weekStart, weekEnd]);

  const relLabel = useMemo(() => {
    const thisWeek = startOfWeek(new Date()).getTime();
    const diff = Math.round((weekStart.getTime() - thisWeek) / (7 * 24 * 60 * 60 * 1000));
    if (diff === 0) return 'This week';
    if (diff === 1) return 'Next week';
    if (diff === -1) return 'Last week';
    return diff > 0 ? `In ${diff} weeks` : `${Math.abs(diff)} weeks ago`;
  }, [weekStart]);

  const isThisWeek = relLabel === 'This week';
  const hasAnyShift = days.some((d) => d.items.length > 0);

  return (
    <>
      <style>{styles}</style>
      <div className="sm-wrap">
        <header className="sm-header sm-anim">
          <div className="sm-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
            </svg>
          </div>
          <div className="sm-header-text">
            <p className="sm-header-eyebrow">Team Rota</p>
            <h1 className="sm-header-title">Shift Management</h1>
          </div>
          <button
            type="button"
            className={`sm-refresh${refreshing ? ' is-busy' : ''}`}
            onClick={() => fetchShifts(true)}
            disabled={loading || refreshing}
            aria-label="Refresh rota"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </header>

        <div className="sm-weeknav sm-anim">
          <button type="button" className="sm-weeknav-btn" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="Previous week">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="sm-weeknav-mid">
            <div className="sm-weeknav-range">{rangeLabel}</div>
            <div className="sm-weeknav-rel">{relLabel}</div>
          </div>
          <button type="button" className="sm-weeknav-btn" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="Next week">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>

        {!isThisWeek && (
          <button type="button" className="sm-today-btn sm-anim" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            ↩ Jump to this week
          </button>
        )}

        {!error && (
          <div className="sm-stats sm-anim">
            <div className="sm-stat">
              <div className="sm-stat-val">{loading ? '–' : stats.shifts}</div>
              <div className="sm-stat-lab">Shifts</div>
            </div>
            <div className="sm-stat">
              <div className="sm-stat-val">{loading ? '–' : stats.employees}</div>
              <div className="sm-stat-lab">Staff</div>
            </div>
            <div className="sm-stat">
              <div className="sm-stat-val">{loading ? '–' : stats.total}</div>
              <div className="sm-stat-lab">Total</div>
            </div>
          </div>
        )}

        {!loading && !error && shifts.length > 0 && (
          <div className="sm-search sm-anim">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee, location, role…"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
        )}

        {loading ? (
          <div>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="sm-skel" />)}
          </div>
        ) : error ? (
          <div className="sm-error sm-anim">
            <p className="sm-error-title">Couldn't load the rota</p>
            <p className="sm-error-sub">{error}</p>
            <button className="sm-retry" onClick={() => fetchShifts()}>Try again</button>
          </div>
        ) : !hasAnyShift ? (
          <div className="sm-empty-week sm-anim">
            <p className="sm-empty-week-title">{search ? 'No matching shifts' : 'No shifts this week'}</p>
            <p className="sm-empty-week-sub">
              {search ? 'Try a different search term.' : 'Nothing is scheduled for the team this week.'}
            </p>
          </div>
        ) : (
          days.map((day) => {
            const isToday = day.ymd === todayYMD;
            const weekdayIdx = (day.date.getDay() + 6) % 7;
            return (
              <div key={day.ymd} className="sm-day sm-anim">
                <div className="sm-day-head">
                  <span className={`sm-day-label${isToday ? ' is-today' : ''}`}>
                    {WEEKDAYS[weekdayIdx]}
                  </span>
                  {isToday && <span className="sm-day-pill">TODAY</span>}
                  <span className="sm-day-num">{day.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                  <span className="sm-day-line" />
                  {day.items.length > 0 && <span className="sm-day-num">{day.items.length}</span>}
                </div>
                {day.items.length === 0 ? (
                  <div className="sm-day-empty">No shifts scheduled</div>
                ) : (
                  day.items.map((s, i) => {
                    const emp = shiftEmployee(s);
                    const start = formatTime(s.startTime);
                    const end = formatTime(s.endTime);
                    const status = s.status || 'Scheduled';
                    const locRole = [s.location, s.shiftType || s.role].filter(Boolean).join(' · ');
                    return (
                      <button
                        key={s._id || `${day.ymd}-${i}`}
                        type="button"
                        className={`sm-card ${cardTone(status)}`}
                        onClick={() => emp.id && navigate(`/employees/${emp.id}`)}
                      >
                        <span className="sm-avatar">{initials(emp.name)}</span>
                        <span className="sm-body">
                          <span className="sm-name">{emp.name}</span>
                          <span className="sm-meta">
                            <span className="sm-time">{start && end ? `${start} – ${end}` : start || 'Time TBC'}</span>
                            {locRole && <span className="sm-loc">· {locRole}</span>}
                          </span>
                        </span>
                        <span className={`sm-status ${statusClass(status)}`}>
                          <span className="sm-status-dot" />
                          {status}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
