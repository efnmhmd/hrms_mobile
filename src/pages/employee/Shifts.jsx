import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getUser } from '../../utils/auth';
import { getErrorMessage } from '../../utils/errorHandler';
import ShiftMonthCalendar from '../../components/ShiftMonthCalendar';

// Mirrors web MyShifts.js: per-employee rota endpoint, windowed to a few months
// around today, then grouped into Upcoming / Past / All with a status badge.

const styles = `
  @keyframes sh-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sh-skel {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.85; }
  }

  .sh-wrap { padding: 0.85rem 1rem 6rem; }
  .sh-anim { animation: sh-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header ── */
  .sh-header {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.25rem 0.85rem;
  }
  .sh-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18);
    flex-shrink: 0;
  }
  .sh-header-text { min-width: 0; flex: 1; }
  .sh-header-eyebrow {
    font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c; margin: 0;
  }
  .sh-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
  }
  .sh-count { font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem; }
  .sh-refresh {
    flex-shrink: 0;
    width: 36px; height: 36px; border-radius: 10px;
    border: 1.5px solid #d4ddd6; background: #fff;
    color: #52796f;
    display: flex; align-items: center; justify-content: center;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .sh-refresh:active { transform: scale(0.95); background: #f1f4f0; }
  .sh-refresh.is-loading svg { animation: sh-spin 0.9s linear infinite; }
  @keyframes sh-spin { to { transform: rotate(360deg); } }

  /* ── View toggle (List / Calendar) ── */
  .sh-viewtabs { display: flex; gap: 0.4rem; margin-bottom: 0.85rem; }
  .sh-viewtab {
    flex: 1; padding: 0.5rem 0.4rem; border-radius: 12px;
    font-size: 0.76rem; font-weight: 600; letter-spacing: 0.02em;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    -webkit-tap-highlight-color: transparent; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .sh-viewtab.is-active { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; border-color: transparent; }
  .sh-viewtab:active { transform: scale(0.98); }
  .sh-viewtab svg { flex-shrink: 0; }

  /* ── Filter tabs ── */
  .sh-tabs {
    display: flex; gap: 0.4rem;
    margin-bottom: 0.85rem;
  }
  .sh-tab {
    flex: 1;
    padding: 0.5rem 0.4rem;
    border-radius: 12px;
    font-size: 0.74rem; font-weight: 600;
    letter-spacing: 0.02em;
    border: 1px solid rgba(132, 169, 140, 0.4);
    background: rgba(255, 255, 255, 0.6);
    color: #52796f;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    display: flex; flex-direction: column; align-items: center; gap: 1px;
  }
  .sh-tab.is-active {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    border-color: transparent;
  }
  .sh-tab:active { transform: scale(0.97); }
  .sh-tab-count { font-size: 0.62rem; font-weight: 500; opacity: 0.8; }

  /* ── Date group ── */
  .sh-date-label {
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: #52796f;
    margin: 0.8rem 0.25rem 0.4rem;
  }
  .sh-date-label::before {
    content: '';
    width: 14px; height: 1.5px;
    background: linear-gradient(90deg, #84a98c, rgba(132, 169, 140, 0));
    border-radius: 1px;
  }

  /* ── Shift card ── */
  .sh-card {
    display: flex; align-items: stretch; gap: 0.7rem;
    padding: 0.7rem 0.8rem;
    border-radius: 14px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.45rem;
  }
  .sh-card.is-today {
    border-color: #52796f;
    box-shadow: 0 2px 10px rgba(82, 121, 111, 0.16);
  }
  .sh-date-badge {
    width: 46px; flex-shrink: 0;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.2), rgba(82, 121, 111, 0.14));
    color: #354f52;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 0.4rem 0;
  }
  .sh-date-badge.is-today {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #f0f5f2;
  }
  .sh-date-badge.is-past { background: #eef2ef; color: #7a8e84; }
  .sh-date-day { font-size: 1.25rem; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
  .sh-date-mon { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 2px; }

  .sh-body { min-width: 0; flex: 1; }
  .sh-body-top {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;
  }
  .sh-weekday {
    font-size: 0.86rem; font-weight: 600;
    color: #2f3e46; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .sh-today-pill {
    display: inline-block; margin-left: 0.4rem;
    font-size: 0.55rem; font-weight: 700;
    letter-spacing: 0.08em;
    color: #fff; background: #52796f;
    border-radius: 999px; padding: 1px 6px;
    vertical-align: middle;
  }
  .sh-status {
    flex-shrink: 0;
    display: inline-flex; align-items: center; gap: 0.25rem;
    font-size: 0.62rem; font-weight: 700;
    letter-spacing: 0.03em;
    border-radius: 999px;
    padding: 2px 8px;
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .sh-status-dot { width: 6px; height: 6px; border-radius: 50%; }
  .sh-status-scheduled { background: rgba(82,121,111,0.1); color: #354f52; border-color: rgba(82,121,111,0.25); }
  .sh-status-scheduled .sh-status-dot { background: #52796f; }
  .sh-status-completed { background: rgba(76,140,82,0.12); color: #2f6e34; border-color: rgba(76,140,82,0.28); }
  .sh-status-completed .sh-status-dot { background: #4c8c52; }
  .sh-status-danger { background: rgba(192,117,106,0.12); color: #8a352b; border-color: rgba(192,117,106,0.3); }
  .sh-status-danger .sh-status-dot { background: #c0756a; }
  .sh-status-warn { background: rgba(196,156,74,0.14); color: #7a5a16; border-color: rgba(196,156,74,0.32); }
  .sh-status-warn .sh-status-dot { background: #c49c4a; }

  .sh-rows { margin-top: 0.4rem; display: flex; flex-direction: column; gap: 0.25rem; }
  .sh-row {
    display: flex; align-items: center; gap: 0.4rem;
    font-size: 0.76rem; color: #52796f;
  }
  .sh-row svg { flex-shrink: 0; color: #84a98c; }
  .sh-row-time { font-weight: 600; color: #2f3e46; font-variant-numeric: tabular-nums; }
  .sh-row-loc { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sh-notes {
    margin-top: 0.45rem;
    font-size: 0.72rem; color: #5c6b63; line-height: 1.35;
    background: #f6f8f4; border-radius: 9px;
    padding: 0.4rem 0.55rem;
  }
  .sh-notes b { color: #354f52; font-weight: 600; }

  /* ── States ── */
  .sh-skel {
    height: 78px; border-radius: 14px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: sh-skel 1.2s ease-in-out infinite;
    margin-bottom: 0.45rem;
  }
  .sh-empty, .sh-error {
    padding: 2rem 1rem; border-radius: 16px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center; color: #52796f;
  }
  .sh-error {
    border-color: rgba(192, 117, 106, 0.4);
    color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .sh-empty-title, .sh-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .sh-empty-sub, .sh-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .sh-retry {
    margin-top: 0.85rem;
    padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .sh-retry:active { transform: scale(0.97); }
`;

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past',     label: 'Past' },
  { key: 'all',      label: 'All' },
];

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Start of today (local), as a comparable timestamp.
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function shiftDate(shift) {
  const base = shift?.date || shift?.startDate || shift?.endDate;
  if (!base) return null;
  const d = new Date(base);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Sortable timestamp combining the shift's date with its start time.
function shiftStamp(shift) {
  const d = shiftDate(shift);
  if (!d) return 0;
  const t = shift?.startTime;
  if (typeof t === 'string') {
    const m = /^(\d{1,2}):(\d{2})/.exec(t);
    if (m) {
      const withTime = new Date(d);
      withTime.setHours(Number(m[1]), Number(m[2]), 0, 0);
      return withTime.getTime();
    }
  }
  return d.getTime();
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

function friendlyDate(d) {
  if (!d) return 'Unknown date';
  const today = startOfToday();
  const dayMs = 24 * 60 * 60 * 1000;
  const base = new Date(d); base.setHours(0, 0, 0, 0);
  const diff = Math.round((base.getTime() - today) / dayMs);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function statusClass(status) {
  switch (status) {
    case 'Completed': return 'sh-status-completed';
    case 'Cancelled':
    case 'Missed':    return 'sh-status-danger';
    case 'Scheduled': return 'sh-status-scheduled';
    default:          return 'sh-status-warn';
  }
}

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const [view, setView] = useState('list'); // 'list' | 'calendar'

  // Month-calendar view: hard-scoped per-employee feed for the visible range.
  async function monthFetcher(startYMD, endYMD) {
    const user = await getUser();
    const employeeId = user?.id || user?._id;
    if (!employeeId) throw new Error('Could not determine your employee record.');
    const { data } = await api.get(
      `/rota/shift-assignments/employee/${employeeId}`,
      { params: { startDate: startYMD, endDate: endYMD } },
    );
    return data?.data || (Array.isArray(data) ? data : []);
  }

  async function fetchShifts() {
    setLoading(true);
    setError(null);
    try {
      const user = await getUser();
      const employeeId = user?.id || user?._id;
      if (!employeeId) {
        setError('Could not determine your employee record.');
        setShifts([]);
        return;
      }
      // Window: previous month start → two months ahead, matching web MyShifts.
      const start = new Date();
      start.setMonth(start.getMonth() - 1, 1);
      const end = new Date();
      end.setMonth(end.getMonth() + 3, 0); // last day of (now + 2 months)

      const { data } = await api.get(
        `/rota/shift-assignments/employee/${employeeId}`,
        { params: { startDate: toYMD(start), endDate: toYMD(end) } },
      );
      const list = data?.data || (Array.isArray(data) ? data : []);
      setShifts(list);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchShifts();
  }, []);

  const counts = useMemo(() => {
    const today = startOfToday();
    let upcoming = 0;
    let past = 0;
    for (const s of shifts) {
      const d = shiftDate(s);
      if (!d) continue;
      const base = new Date(d); base.setHours(0, 0, 0, 0);
      if (base.getTime() >= today) upcoming += 1;
      else past += 1;
    }
    return { upcoming, past, all: shifts.length };
  }, [shifts]);

  const groups = useMemo(() => {
    const today = startOfToday();
    const filtered = shifts.filter((s) => {
      const d = shiftDate(s);
      if (!d) return tab === 'all';
      const base = new Date(d); base.setHours(0, 0, 0, 0);
      if (tab === 'upcoming') return base.getTime() >= today;
      if (tab === 'past') return base.getTime() < today;
      return true;
    });

    // Upcoming → soonest first; Past / All → most recent first.
    const asc = tab === 'upcoming';
    filtered.sort((a, b) => (asc ? shiftStamp(a) - shiftStamp(b) : shiftStamp(b) - shiftStamp(a)));

    const map = new Map();
    for (const s of filtered) {
      const d = shiftDate(s);
      const key = d ? toYMD(d) : 'unknown';
      if (!map.has(key)) map.set(key, { date: d, items: [] });
      map.get(key).items.push(s);
    }
    return Array.from(map.values());
  }, [shifts, tab]);

  return (
    <>
      <style>{styles}</style>
      <div className="sh-wrap">
        <header className="sh-header sh-anim">
          <div className="sh-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
            </svg>
          </div>
          <div className="sh-header-text">
            <p className="sh-header-eyebrow">My Rota</p>
            <h1 className="sh-header-title">
              Shifts
              {!loading && !error && <span className="sh-count"> · {shifts.length}</span>}
            </h1>
          </div>
          <button
            type="button"
            className={`sh-refresh${loading ? ' is-loading' : ''}`}
            onClick={fetchShifts}
            disabled={loading}
            aria-label="Refresh shifts"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 2v6h-6M3 22v-6h6" />
              <path d="M3.5 9a9 9 0 0 1 14.85-3.36L21 8M20.5 15a9 9 0 0 1-14.85 3.36L3 16" />
            </svg>
          </button>
        </header>

        <div className="sh-viewtabs sh-anim">
          <button
            type="button"
            className={`sh-viewtab${view === 'list' ? ' is-active' : ''}`}
            onClick={() => setView('list')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            List
          </button>
          <button
            type="button"
            className={`sh-viewtab${view === 'calendar' ? ' is-active' : ''}`}
            onClick={() => setView('calendar')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Calendar
          </button>
        </div>

        {view === 'calendar' ? (
          <ShiftMonthCalendar
            fetcher={monthFetcher}
            renderShift={(s) => <ShiftCard shift={s} />}
            emptyText="You have no shift on this day."
          />
        ) : (
        <>
        <div className="sh-tabs sh-anim">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`sh-tab ${tab === t.key ? 'is-active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span>{t.label}</span>
              <span className="sh-tab-count">{counts[t.key]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="sh-skel" />
            ))}
          </div>
        ) : error ? (
          <div className="sh-error sh-anim">
            <p className="sh-error-title">Couldn't load your shifts</p>
            <p className="sh-error-sub">{error}</p>
            <button className="sh-retry" onClick={fetchShifts}>Try again</button>
          </div>
        ) : groups.length === 0 ? (
          <div className="sh-empty sh-anim">
            <p className="sh-empty-title">
              {tab === 'upcoming' && 'No upcoming shifts'}
              {tab === 'past' && 'No past shifts'}
              {tab === 'all' && 'No shifts found'}
            </p>
            <p className="sh-empty-sub">
              {tab === 'upcoming'
                ? 'Nothing scheduled in the coming weeks.'
                : 'Your rota will appear here once it’s set.'}
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.date ? toYMD(g.date) : 'unknown'} className="sh-anim">
              <h3 className="sh-date-label">{friendlyDate(g.date)}</h3>
              {g.items.map((s, i) => (
                <ShiftCard key={s._id || i} shift={s} />
              ))}
            </div>
          ))
        )}
        </>
        )}
      </div>
    </>
  );
}

function ShiftCard({ shift }) {
  const d = shiftDate(shift);
  const today = startOfToday();
  const base = d ? new Date(d) : null;
  if (base) base.setHours(0, 0, 0, 0);
  const isToday = base ? base.getTime() === today : false;
  const isPast = base ? base.getTime() < today : false;

  const start = formatTime(shift.startTime);
  const end = formatTime(shift.endTime);
  const status = shift.status || 'Scheduled';

  return (
    <div className={`sh-card${isToday ? ' is-today' : ''}`}>
      <div className={`sh-date-badge${isToday ? ' is-today' : isPast ? ' is-past' : ''}`}>
        <span className="sh-date-day">{d ? d.toLocaleDateString(undefined, { day: '2-digit' }) : '—'}</span>
        <span className="sh-date-mon">{d ? d.toLocaleDateString(undefined, { month: 'short' }) : ''}</span>
      </div>

      <div className="sh-body">
        <div className="sh-body-top">
          <div className="sh-weekday">
            {d ? d.toLocaleDateString(undefined, { weekday: 'long' }) : 'Shift'}
            {isToday && <span className="sh-today-pill">TODAY</span>}
          </div>
          <span className={`sh-status ${statusClass(status)}`}>
            <span className="sh-status-dot" />
            {status}
          </span>
        </div>

        <div className="sh-rows">
          <div className="sh-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span className="sh-row-time">
              {start && end ? `${start} – ${end}` : start || 'Time TBC'}
            </span>
          </div>
          {(shift.location || shift.shiftType || shift.role) && (
            <div className="sh-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="sh-row-loc">
                {[shift.location, shift.shiftType || shift.role].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}
        </div>

        {shift.notes && (
          <div className="sh-notes"><b>Notes:</b> {shift.notes}</div>
        )}
      </div>
    </div>
  );
}
