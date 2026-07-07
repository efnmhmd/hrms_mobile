import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

const styles = `
  @keyframes th-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes th-skel {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.85; }
  }

  .th-wrap { padding: 0.85rem 1rem 6rem; }
  .th-anim { animation: th-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header ── */
  .th-header {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.25rem 0.85rem;
  }
  .th-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18);
    flex-shrink: 0;
  }
  .th-header-text { min-width: 0; flex: 1; }
  .th-header-eyebrow {
    font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c; margin: 0;
  }
  .th-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
  }
  .th-count { font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem; }

  /* ── Range chips ── */
  .th-chips {
    display: flex; gap: 0.4rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin-bottom: 0.65rem;
    padding-bottom: 4px;
  }
  .th-chips::-webkit-scrollbar { display: none; }
  .th-chip {
    flex-shrink: 0;
    padding: 0.45rem 0.85rem;
    border-radius: 999px;
    font-size: 0.74rem; font-weight: 600;
    letter-spacing: 0.04em;
    border: 1px solid rgba(132, 169, 140, 0.4);
    background: rgba(255, 255, 255, 0.6);
    color: #52796f;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .th-chip.is-active {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    border-color: transparent;
  }
  .th-chip:active { transform: scale(0.97); }

  /* ── Search row ── */
  .th-search-row {
    display: flex; gap: 0.5rem; align-items: stretch;
    margin-bottom: 0.6rem;
  }
  .th-search-wrap {
    position: relative;
    flex: 1; min-width: 0;
  }
  .th-search-icon {
    position: absolute; left: 12px; top: 50%;
    transform: translateY(-50%);
    color: #84a98c; pointer-events: none;
  }
  .th-search-input {
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
  .th-search-input:focus {
    border-color: #52796f;
    box-shadow: 0 0 0 3px rgba(82,121,111,0.12);
  }

  /* ── Filter button + panel ── */
  .th-filter-btn {
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
  .th-filter-btn:active { transform: scale(0.97); }
  .th-filter-btn.is-open,
  .th-filter-btn.is-active {
    border-color: #52796f;
    background: rgba(82,121,111,0.08);
  }
  .th-filter-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 18px; padding: 0 5px;
    border-radius: 999px;
    background: #52796f; color: #fff;
    font-size: 0.65rem; font-weight: 700;
  }
  .th-filter-panel {
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    border-radius: 14px;
    padding: 0.75rem 0.85rem;
    margin-bottom: 0.85rem;
    box-shadow: 0 2px 8px rgba(47, 62, 70, 0.05);
  }
  .th-filter-group + .th-filter-group {
    margin-top: 0.65rem;
    padding-top: 0.65rem;
    border-top: 1px dashed rgba(132, 169, 140, 0.25);
  }
  .th-filter-label {
    font-size: 0.62rem; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #7a8e84;
    margin: 0 0 0.45rem;
  }
  .th-chip-row {
    display: flex; flex-wrap: wrap; gap: 0.35rem;
  }
  .th-fchip {
    border: 1px solid #d4ddd6;
    background: #fff;
    color: #354f52;
    border-radius: 999px;
    padding: 0.32rem 0.7rem;
    font-size: 0.74rem; font-weight: 500;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    text-transform: capitalize;
  }
  .th-fchip:active { transform: scale(0.97); }
  .th-fchip.is-on {
    background: #52796f;
    border-color: #52796f;
    color: #fff;
  }
  .th-filter-clear {
    margin-top: 0.7rem;
    border: none; background: none;
    color: #7a3028;
    font-size: 0.72rem; font-weight: 600;
    padding: 0.2rem 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .th-filter-clear:disabled { opacity: 0.4; cursor: default; }

  /* ── Date group ── */
  .th-date-label {
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: #52796f;
    margin: 0.8rem 0.25rem 0.4rem;
  }
  .th-date-label::before {
    content: '';
    width: 14px; height: 1.5px;
    background: linear-gradient(90deg, #84a98c, rgba(132, 169, 140, 0));
    border-radius: 1px;
  }
  .th-date-total {
    margin-left: auto;
    font-size: 0.7rem; font-weight: 600;
    color: #7a8e84; letter-spacing: 0.02em;
    text-transform: none;
  }

  /* ── Entry card ── */
  .th-card {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.8rem;
    border-radius: 14px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.45rem;
  }
  .th-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.28), rgba(82, 121, 111, 0.22));
    color: #354f52;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }
  .th-meta { min-width: 0; flex: 1; }
  .th-name {
    font-size: 0.86rem; font-weight: 600;
    color: #2f3e46; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .th-times {
    margin-top: 2px;
    font-size: 0.74rem; color: #52796f;
    font-variant-numeric: tabular-nums;
  }
  .th-times .th-arrow {
    color: #b8c4bc; padding: 0 0.2rem;
  }
  .th-tags {
    margin-top: 4px;
    display: flex; flex-wrap: wrap; gap: 0.3rem;
  }
  .th-tag {
    font-size: 0.62rem; font-weight: 600;
    color: #7a8e84;
    background: #f1f4f0;
    border-radius: 999px;
    padding: 1px 7px;
    letter-spacing: 0.04em;
  }
  .th-hours {
    flex-shrink: 0;
    text-align: right;
    font-size: 0.95rem; font-weight: 700;
    color: #2f3e46;
    font-variant-numeric: tabular-nums;
  }
  .th-hours-sub {
    font-size: 0.62rem; font-weight: 500;
    color: #84a98c; letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-top: 1px;
  }

  /* ── States ── */
  .th-skel {
    height: 60px; border-radius: 14px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: th-skel 1.2s ease-in-out infinite;
    margin-bottom: 0.45rem;
  }
  .th-empty, .th-error {
    padding: 2rem 1rem; border-radius: 16px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center; color: #52796f;
  }
  .th-error {
    border-color: rgba(192, 117, 106, 0.4);
    color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .th-empty-title, .th-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .th-empty-sub, .th-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .th-retry {
    margin-top: 0.85rem;
    padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .th-retry:active { transform: scale(0.97); }
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

// "HH:MM" or full ISO -> minutes since midnight (entry's own date).
function timeToMinutes(t) {
  if (!t) return null;
  // ISO datetime
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
  const totalSeconds = Math.round(mins * 60);
  if (totalSeconds === 0) return '0m';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  return parts.join(' ');
}

function entryDate(entry) {
  // Backend may return ISO ("2026-05-20T00:00:00.000Z") or "YYYY-MM-DD".
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

function initials(emp) {
  const f = (emp?.firstName || '').charAt(0);
  const l = (emp?.lastName || '').charAt(0);
  return (f + l).toUpperCase() || '?';
}

function fullName(emp) {
  if (!emp) return 'Unknown';
  return [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim() || emp.email || 'Unknown';
}

export default function AdminTimeHistory() {
  const [rangeKey, setRangeKey] = useState('7');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [employeeFilters, setEmployeeFilters] = useState([]);
  const [locationFilters, setLocationFilters] = useState([]);
  const [statusFilters, setStatusFilters] = useState([]);

  async function fetchEntries(key) {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = rangeBounds(key);
      const { data } = await api.get(`/clock/entries?startDate=${start}&endDate=${end}`);
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

  const { employeeOptions, locationOptions } = useMemo(() => {
    const emps = new Map();
    const locs = new Set();
    for (const e of entries) {
      if (e?.location) locs.add(e.location);
      const emp = e?.employee;
      const key = emp?._id || emp?.id || emp?.email || fullName(emp);
      if (key && !emps.has(key)) emps.set(key, { key, label: fullName(emp) });
    }
    return {
      employeeOptions: [...emps.values()].sort((a, b) => a.label.localeCompare(b.label)),
      locationOptions: [...locs].sort((a, b) => a.localeCompare(b)),
    };
  }, [entries]);

  const activeFilterCount =
    employeeFilters.length + locationFilters.length + statusFilters.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (employeeFilters.length) {
        const emp = e?.employee;
        const key = emp?._id || emp?.id || emp?.email || fullName(emp);
        if (!employeeFilters.includes(key)) return false;
      }
      if (locationFilters.length && !locationFilters.includes(e?.location)) return false;
      if (statusFilters.length) {
        const isActive = !e?.clockOut;
        const status = isActive ? 'active' : 'completed';
        if (!statusFilters.includes(status)) return false;
      }
      if (!q) return true;
      const hay = [
        e?.employee?.firstName, e?.employee?.lastName, e?.employee?.email,
        e?.location,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [entries, query, employeeFilters, locationFilters, statusFilters]);

  function toggleFilter(setter, value) {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function clearAllFilters() {
    setEmployeeFilters([]);
    setLocationFilters([]);
    setStatusFilters([]);
  }

  // Group by date (newest first), keep entries in their original order within each day.
  const groups = useMemo(() => {
    const map = new Map();
    for (const e of filtered) {
      const d = entryDate(e);
      const key = dateKey(d);
      if (!map.has(key)) map.set(key, { date: d, items: [], total: 0 });
      const g = map.get(key);
      g.items.push(e);
      g.total += netMinutes(e) || 0;
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date - a.date;
    });
    return arr;
  }, [filtered]);

  const totalCount = filtered.length;

  return (
    <>
      <style>{styles}</style>
      <div className="th-wrap">
        <header className="th-header th-anim">
          <div className="th-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.74 9.74 0 0 0-7 3L3 8" />
              <path d="M3 3v5h5M12 7v5l4 2" />
            </svg>
          </div>
          <div className="th-header-text">
            <p className="th-header-eyebrow">Clock-In Records</p>
            <h1 className="th-header-title">
              Time History
              {!loading && !error && (
                <span className="th-count"> · {totalCount}</span>
              )}
            </h1>
          </div>
        </header>

        <div className="th-chips th-anim">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`th-chip ${rangeKey === r.key ? 'is-active' : ''}`}
              onClick={() => setRangeKey(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="th-search-row th-anim">
          <div className="th-search-wrap">
            <span className="th-search-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              type="search"
              className="th-search-input"
              placeholder="Filter by employee or location…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <button
            type="button"
            className={`th-filter-btn${filtersOpen ? ' is-open' : ''}${activeFilterCount > 0 ? ' is-active' : ''}`}
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-label="Toggle filters"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 5h18M6 12h12M10 19h4" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="th-filter-badge">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="th-filter-panel th-anim">
            <div className="th-filter-group">
              <p className="th-filter-label">Status</p>
              <div className="th-chip-row">
                {[
                  { key: 'completed', label: 'Completed' },
                  { key: 'active', label: 'In progress' },
                ].map((s) => {
                  const on = statusFilters.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      className={`th-fchip${on ? ' is-on' : ''}`}
                      onClick={() => toggleFilter(setStatusFilters, s.key)}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {employeeOptions.length > 1 && (
              <div className="th-filter-group">
                <p className="th-filter-label">Employee</p>
                <div className="th-chip-row">
                  {employeeOptions.map((e) => {
                    const on = employeeFilters.includes(e.key);
                    return (
                      <button
                        key={e.key}
                        type="button"
                        className={`th-fchip${on ? ' is-on' : ''}`}
                        onClick={() => toggleFilter(setEmployeeFilters, e.key)}
                      >
                        {e.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {locationOptions.length > 0 && (
              <div className="th-filter-group">
                <p className="th-filter-label">Location</p>
                <div className="th-chip-row">
                  {locationOptions.map((loc) => {
                    const on = locationFilters.includes(loc);
                    return (
                      <button
                        key={loc}
                        type="button"
                        className={`th-fchip${on ? ' is-on' : ''}`}
                        onClick={() => toggleFilter(setLocationFilters, loc)}
                      >
                        {loc}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <button
              type="button"
              className="th-filter-clear"
              onClick={clearAllFilters}
              disabled={activeFilterCount === 0}
            >
              Clear all filters
            </button>
          </div>
        )}

        {loading ? (
          <div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="th-skel" />
            ))}
          </div>
        ) : error ? (
          <div className="th-error th-anim">
            <p className="th-error-title">Couldn't load time entries</p>
            <p className="th-error-sub">{error}</p>
            <button className="th-retry" onClick={() => fetchEntries(rangeKey)}>Try again</button>
          </div>
        ) : groups.length === 0 ? (
          <div className="th-empty th-anim">
            <p className="th-empty-title">
              {query || activeFilterCount > 0
                ? 'No matches in this range'
                : 'No clock-ins yet for this range'}
            </p>
            <p className="th-empty-sub">
              {query || activeFilterCount > 0
                ? 'Clear filters or pick a different range.'
                : 'Try a longer range.'}
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <div key={dateKey(g.date)} className="th-anim">
              <h3 className="th-date-label">
                <span>{friendlyDate(g.date)}</span>
                <span className="th-date-total">{formatHours(g.total)}</span>
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
  return (
    <div className="th-card">
      <span className="th-avatar">{initials(entry.employee)}</span>
      <div className="th-meta">
        <div className="th-name">{fullName(entry.employee)}</div>
        <div className="th-times">
          <span>{formatTime(entry.clockIn)}</span>
          <span className="th-arrow">→</span>
          <span>{formatTime(entry.clockOut)}</span>
        </div>
        {(breaks > 0 || entry.location) && (
          <div className="th-tags">
            {breaks > 0 && <span className="th-tag">Break {formatHours(breaks)}</span>}
            {entry.location && <span className="th-tag">{entry.location}</span>}
          </div>
        )}
      </div>
      <div>
        <div className="th-hours">{formatHours(total)}</div>
        <div className="th-hours-sub">Net</div>
      </div>
    </div>
  );
}
