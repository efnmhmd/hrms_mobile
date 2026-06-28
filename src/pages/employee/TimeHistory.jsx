import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Employee's own clock-in history.
//   GET /clock/user/entries?startDate=&endDate=
// Mirrors web clockApi.getUserTimeEntries — scoped server-side to the caller.
// Visual idiom matches the admin TimeHistory page, minus the per-employee
// filtering (these are all the current user's own entries).

const styles = `
  @keyframes eth-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes eth-skel {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.85; }
  }

  .eth-wrap { padding: 0.85rem 1rem 6rem; }
  .eth-anim { animation: eth-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header ── */
  .eth-header {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.25rem 0.85rem;
  }
  .eth-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18);
    flex-shrink: 0;
  }
  .eth-header-text { min-width: 0; flex: 1; }
  .eth-header-eyebrow {
    font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c; margin: 0;
  }
  .eth-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
  }

  /* ── Summary strip ── */
  .eth-summary {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem; margin-bottom: 0.85rem;
  }
  .eth-sum-card {
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    border-radius: 14px;
    padding: 0.7rem 0.6rem;
    text-align: center;
    box-shadow: 0 1px 2px rgba(47,62,70,0.04);
  }
  .eth-sum-value {
    font-size: 1.25rem; font-weight: 700; color: #2f3e46;
    font-variant-numeric: tabular-nums; line-height: 1;
  }
  .eth-sum-label {
    margin-top: 4px;
    font-size: 0.58rem; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: #84a98c;
  }

  /* ── Range chips ── */
  .eth-chips {
    display: flex; gap: 0.4rem;
    margin-bottom: 0.7rem;
  }
  .eth-chip {
    flex: 1;
    padding: 0.45rem 0.5rem;
    border-radius: 999px;
    font-size: 0.74rem; font-weight: 600; letter-spacing: 0.02em;
    border: 1px solid rgba(132, 169, 140, 0.4);
    background: rgba(255, 255, 255, 0.6);
    color: #52796f;
    -webkit-tap-highlight-color: transparent; cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .eth-chip.is-active {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; border-color: transparent;
  }
  .eth-chip:active { transform: scale(0.97); }

  /* ── Date group ── */
  .eth-date-label {
    display: flex; align-items: center; gap: 0.5rem;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: #52796f;
    margin: 0.8rem 0.25rem 0.4rem;
  }
  .eth-date-label::before {
    content: '';
    width: 14px; height: 1.5px;
    background: linear-gradient(90deg, #84a98c, rgba(132, 169, 140, 0));
    border-radius: 1px; flex-shrink: 0;
  }
  .eth-date-total {
    margin-left: auto;
    font-size: 0.7rem; font-weight: 600; color: #7a8e84;
    letter-spacing: 0.02em; text-transform: none;
  }

  /* ── Entry card ── */
  .eth-card {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.7rem 0.85rem;
    border-radius: 14px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.45rem;
  }
  .eth-card.is-active { border-color: rgba(82,121,111,0.45); }
  .eth-rail {
    width: 36px; flex-shrink: 0;
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    color: #84a98c;
  }
  .eth-rail-dot { width: 8px; height: 8px; border-radius: 50%; background: #52796f; }
  .eth-rail-line { width: 2px; flex: 1; min-height: 14px; background: rgba(132,169,140,0.35); }
  .eth-rail-dot.is-out { background: #c0756a; }
  .eth-rail-dot.is-open { background: #84a98c; box-shadow: 0 0 0 3px rgba(132,169,140,0.2); }

  .eth-meta { min-width: 0; flex: 1; }
  .eth-times {
    font-size: 0.92rem; font-weight: 600; color: #2f3e46;
    font-variant-numeric: tabular-nums;
    display: flex; align-items: center; gap: 0.4rem;
  }
  .eth-arrow { color: #b8c4bc; }
  .eth-live {
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.06em;
    color: #2f6e34; background: rgba(76,140,82,0.14);
    border-radius: 999px; padding: 1px 7px;
  }
  .eth-tags {
    margin-top: 5px;
    display: flex; flex-wrap: wrap; gap: 0.3rem;
  }
  .eth-tag {
    font-size: 0.62rem; font-weight: 600; color: #7a8e84;
    background: #f1f4f0; border-radius: 999px;
    padding: 1px 8px; letter-spacing: 0.03em;
    text-transform: capitalize;
  }
  .eth-hours {
    flex-shrink: 0; text-align: right;
  }
  .eth-hours-val {
    font-size: 1rem; font-weight: 700; color: #2f3e46;
    font-variant-numeric: tabular-nums;
  }
  .eth-hours-sub {
    font-size: 0.58rem; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: #84a98c; margin-top: 1px;
  }

  /* ── States ── */
  .eth-skel {
    height: 64px; border-radius: 14px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: eth-skel 1.2s ease-in-out infinite;
    margin-bottom: 0.45rem;
  }
  .eth-empty, .eth-error {
    padding: 2rem 1rem; border-radius: 16px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center; color: #52796f;
  }
  .eth-error {
    border-color: rgba(192, 117, 106, 0.4); color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .eth-empty-title, .eth-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .eth-empty-sub, .eth-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .eth-retry {
    margin-top: 0.85rem;
    padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .eth-retry:active { transform: scale(0.97); }
`;

const RANGES = [
  { key: '7',     label: 'Last 7 days',  days: 7 },
  { key: '30',    label: 'Last 30 days', days: 30 },
  { key: 'month', label: 'This month',   days: null },
];

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rangeBounds(key) {
  const end = new Date();
  if (key === 'month') {
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return { start: toYMD(start), end: toYMD(end) };
  }
  const def = RANGES.find((r) => r.key === key) || RANGES[0];
  const start = new Date();
  start.setDate(end.getDate() - (def.days - 1));
  return { start: toYMD(start), end: toYMD(end) };
}

// "HH:MM" or ISO -> minutes since midnight.
function timeToMinutes(t) {
  if (!t) return null;
  if (typeof t === 'string' && t.includes('T')) {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return null;
    return d.getHours() * 60 + d.getMinutes();
  }
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatTime(t) {
  const mins = timeToMinutes(t);
  if (mins == null) return '—';
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function netMinutes(entry) {
  const start = timeToMinutes(entry.clockIn);
  const end = timeToMinutes(entry.clockOut);
  if (start == null || end == null) return null;
  let total = end - start;
  if (total < 0) total += 24 * 60; // overnight shift
  const breakSum = (entry.breaks || []).reduce((acc, b) => acc + (Number(b?.duration) || 0), 0);
  return Math.max(0, total - breakSum);
}

function formatHours(mins) {
  if (mins == null) return '—';
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function entryDate(entry) {
  if (!entry?.date) return null;
  const d = new Date(entry.date);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateKey(d) {
  return d ? toYMD(d) : 'unknown';
}

function friendlyDate(d) {
  if (!d) return 'Unknown date';
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (toYMD(d) === toYMD(today)) return 'Today';
  if (toYMD(d) === toYMD(y))    return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function EmployeeTimeHistory() {
  const [rangeKey, setRangeKey] = useState('7');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchEntries(key) {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = rangeBounds(key);
      const { data } = await api.get(`/clock/user/entries?startDate=${start}&endDate=${end}`);
      const list = data?.data || data?.entries || (Array.isArray(data) ? data : []);
      setEntries(list);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEntries(rangeKey);
  }, [rangeKey]);

  // Group by date (newest first), and tally totals for the summary strip.
  const { groups, totalMinutes, daysWorked } = useMemo(() => {
    const map = new Map();
    let total = 0;
    for (const e of entries) {
      const d = entryDate(e);
      const key = dateKey(d);
      if (!map.has(key)) map.set(key, { date: d, items: [], total: 0 });
      const g = map.get(key);
      g.items.push(e);
      const net = netMinutes(e) || 0;
      g.total += net;
      total += net;
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date - a.date;
    });
    return { groups: arr, totalMinutes: total, daysWorked: arr.length };
  }, [entries]);

  const avgPerDay = daysWorked > 0 ? Math.round(totalMinutes / daysWorked) : 0;

  return (
    <>
      <style>{styles}</style>
      <div className="eth-wrap">
        <header className="eth-header eth-anim">
          <div className="eth-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.74 9.74 0 0 0-7 3L3 8" />
              <path d="M3 3v5h5M12 7v5l4 2" />
            </svg>
          </div>
          <div className="eth-header-text">
            <p className="eth-header-eyebrow">My Attendance</p>
            <h1 className="eth-header-title">Time History</h1>
          </div>
        </header>

        <div className="eth-summary eth-anim">
          <div className="eth-sum-card">
            <div className="eth-sum-value">{loading ? '—' : formatHours(totalMinutes)}</div>
            <div className="eth-sum-label">Total</div>
          </div>
          <div className="eth-sum-card">
            <div className="eth-sum-value">{loading ? '—' : daysWorked}</div>
            <div className="eth-sum-label">Days</div>
          </div>
          <div className="eth-sum-card">
            <div className="eth-sum-value">{loading ? '—' : formatHours(avgPerDay)}</div>
            <div className="eth-sum-label">Avg / day</div>
          </div>
        </div>

        <div className="eth-chips eth-anim">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`eth-chip ${rangeKey === r.key ? 'is-active' : ''}`}
              onClick={() => setRangeKey(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="eth-skel" />
            ))}
          </div>
        ) : error ? (
          <div className="eth-error eth-anim">
            <p className="eth-error-title">Couldn't load your time history</p>
            <p className="eth-error-sub">{error}</p>
            <button className="eth-retry" onClick={() => fetchEntries(rangeKey)}>Try again</button>
          </div>
        ) : groups.length === 0 ? (
          <div className="eth-empty eth-anim">
            <p className="eth-empty-title">No clock-ins in this range</p>
            <p className="eth-empty-sub">Try a longer range, or clock in from the Clock tab.</p>
          </div>
        ) : (
          groups.map((g) => (
            <div key={dateKey(g.date)} className="eth-anim">
              <h3 className="eth-date-label">
                <span>{friendlyDate(g.date)}</span>
                <span className="eth-date-total">{formatHours(g.total)}</span>
              </h3>
              {g.items.map((e, i) => (
                <Entry key={e._id || i} entry={e} />
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}

function Entry({ entry }) {
  const total = netMinutes(entry);
  const breaks = (entry.breaks || []).reduce((acc, b) => acc + (Number(b?.duration) || 0), 0);
  const isActive = !entry.clockOut;
  return (
    <div className={`eth-card${isActive ? ' is-active' : ''}`}>
      <div className="eth-rail">
        <span className="eth-rail-dot" />
        <span className="eth-rail-line" />
        <span className={`eth-rail-dot ${isActive ? 'is-open' : 'is-out'}`} />
      </div>
      <div className="eth-meta">
        <div className="eth-times">
          <span>{formatTime(entry.clockIn)}</span>
          <span className="eth-arrow">→</span>
          <span>{isActive ? 'In progress' : formatTime(entry.clockOut)}</span>
          {isActive && <span className="eth-live">LIVE</span>}
        </div>
        {(breaks > 0 || entry.location || entry.workType) && (
          <div className="eth-tags">
            {entry.workType && <span className="eth-tag">{entry.workType}</span>}
            {entry.location && <span className="eth-tag">{entry.location}</span>}
            {breaks > 0 && <span className="eth-tag">Break {formatHours(breaks)}</span>}
          </div>
        )}
      </div>
      <div className="eth-hours">
        <div className="eth-hours-val">{formatHours(total)}</div>
        <div className="eth-hours-sub">Net</div>
      </div>
    </div>
  );
}
