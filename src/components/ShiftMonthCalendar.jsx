import { useEffect, useMemo, useRef, useState } from 'react';
import { getErrorMessage } from '../utils/errorHandler';

// Month-grid calendar for shifts. Self-contained: the parent supplies a
// `fetcher(startYMD, endYMD)` that returns the shift list for a date range and a
// `renderShift(shift)` render prop for the selected day's cards. Used on the
// Shifts pages (employee + manager) so the shift calendar lives alongside the
// existing week / list views. Leave stays on the separate Leaves page.

const styles = `
  @keyframes shc-fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes shc-skel { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.9; } }

  .shc-anim { animation: shc-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  .shc-panel {
    background: #fff; border-radius: 18px;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47,62,70,0.04), 0 4px 14px rgba(47,62,70,0.04);
    padding: 0.85rem 0.85rem 0.7rem;
  }
  .shc-month-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
  .shc-month-label { font-family: 'Cormorant Garamond', serif; font-size: 1.15rem; font-weight: 500; color: #2f3e46; letter-spacing: -0.01em; }
  .shc-month-nav { display: flex; align-items: center; gap: 0.3rem; }
  .shc-nav-btn {
    -webkit-tap-highlight-color: transparent;
    background: rgba(132, 169, 140, 0.12); color: #354f52; border: none;
    width: 32px; height: 32px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    transition: background 0.12s, transform 0.12s;
  }
  .shc-nav-btn:active { transform: scale(0.94); background: rgba(132, 169, 140, 0.22); }
  .shc-today-btn {
    -webkit-tap-highlight-color: transparent;
    background: linear-gradient(135deg, #354f52, #52796f); color: #cad2c5;
    font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em;
    padding: 0.4rem 0.7rem; border: none; border-radius: 999px; margin-left: 0.25rem; cursor: pointer;
  }
  .shc-today-btn:active { transform: scale(0.96); }

  .shc-dow {
    display: grid; grid-template-columns: repeat(7, 1fr); text-align: center;
    font-size: 0.62rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    color: #84a98c; padding-bottom: 4px;
  }
  .shc-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
  .shc-cell {
    aspect-ratio: 1 / 1; border-radius: 10px; background: none; border: none;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    padding: 0; color: #354f52; font-size: 0.85rem; font-weight: 500; font-variant-numeric: tabular-nums;
    -webkit-tap-highlight-color: transparent; cursor: pointer; position: relative;
    transition: background 0.12s, color 0.12s, transform 0.1s;
  }
  .shc-cell:active { transform: scale(0.93); }
  .shc-cell.is-other-month { color: rgba(132, 169, 140, 0.45); }
  .shc-cell.is-today { background: rgba(132, 169, 140, 0.14); color: #2f3e46; font-weight: 700; }
  .shc-cell.is-selected { background: linear-gradient(135deg, #354f52, #52796f); color: #cad2c5; font-weight: 700; }
  .shc-cell.is-selected.is-today { background: linear-gradient(135deg, #2f3e46, #354f52); }

  .shc-dot-row { display: flex; gap: 2px; height: 5px; align-items: center; justify-content: center; }
  .shc-dot { width: 5px; height: 5px; border-radius: 50%; background: #52796f; }
  .shc-cell.is-selected .shc-dot { background: #cad2c5; }
  .shc-count-badge {
    position: absolute; top: 3px; right: 4px;
    min-width: 13px; height: 13px; padding: 0 3px;
    border-radius: 999px; background: rgba(82, 121, 111, 0.16); color: #354f52;
    font-size: 0.55rem; font-weight: 700; line-height: 13px; text-align: center;
  }
  .shc-cell.is-selected .shc-count-badge { background: rgba(202, 210, 197, 0.28); color: #f2f5ef; }

  .shc-skel { height: 240px; border-radius: 18px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%); animation: shc-skel 1.2s ease-in-out infinite; }

  .shc-day-heading {
    display: inline-flex; align-items: center; gap: 0.55rem; padding: 0 0.25rem;
    font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
    color: #52796f; margin: 1.2rem 0 0.5rem;
  }
  .shc-day-heading::before { content: ''; width: 14px; height: 1.5px; background: linear-gradient(90deg, #84a98c, rgba(132, 169, 140, 0)); border-radius: 1px; }

  .shc-empty, .shc-error {
    padding: 1.4rem 1rem; border-radius: 14px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .shc-error { border-color: rgba(192, 117, 106, 0.4); color: #7a3028; background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55); }
  .shc-empty-title, .shc-error-title { font-size: 0.82rem; font-weight: 600; margin: 0; }
  .shc-empty-sub, .shc-error-sub { font-size: 0.72rem; margin: 0.2rem 0 0; opacity: 0.85; }
  .shc-retry {
    margin-top: 0.7rem; padding: 0.5rem 1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5;
    font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .shc-retry:active { transform: scale(0.97); }
`;

const DOW_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function startOfDay(d)   { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function dowMon(d)       { return (d.getDay() + 6) % 7; }

// 42 cells for a 6-row grid, starting the Monday on/before the 1st.
function buildGrid(monthDate) {
  const first = startOfMonth(monthDate);
  const lead = dowMon(first);
  const start = new Date(first);
  start.setDate(first.getDate() - lead);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function shiftDate(shift) {
  const base = shift?.date || shift?.startDate || shift?.endDate;
  if (!base) return null;
  const d = new Date(base);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateLong(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function ChevronIcon({ dir }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
    </svg>
  );
}

export default function ShiftMonthCalendar({ fetcher, renderShift, emptyText = 'No shifts scheduled' }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Keep the latest fetcher without re-triggering the month effect when the
  // parent passes a fresh arrow on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const cells = useMemo(() => buildGrid(cursor), [cursor]);

  async function load(monthDate) {
    setLoading(true);
    setError(null);
    // Fetch the whole visible grid (incl. adjacent-month spill) so edge-day
    // dots are accurate.
    const grid = buildGrid(monthDate);
    const startStr = toYMD(grid[0]);
    const endStr = toYMD(grid[grid.length - 1]);
    try {
      const list = await fetcherRef.current(startStr, endStr);
      setShifts(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(getErrorMessage(err));
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(cursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.getFullYear(), cursor.getMonth()]);

  // Per-day shift count, keyed by YYYY-MM-DD.
  const counts = useMemo(() => {
    const map = new Map();
    for (const s of shifts) {
      const d = shiftDate(s);
      if (!d) continue;
      const ymd = toYMD(d);
      map.set(ymd, (map.get(ymd) || 0) + 1);
    }
    return map;
  }, [shifts]);

  const selectedYMD = toYMD(selected);
  const dayShifts = useMemo(
    () => shifts.filter((s) => {
      const d = shiftDate(s);
      return d && toYMD(d) === selectedYMD;
    }),
    [shifts, selectedYMD]
  );

  function goToToday() {
    setCursor(startOfMonth(today));
    setSelected(today);
  }

  return (
    <>
      <style>{styles}</style>

      {error ? (
        <div className="shc-error shc-anim">
          <p className="shc-error-title">Couldn't load shifts</p>
          <p className="shc-error-sub">{error}</p>
          <button className="shc-retry" onClick={() => load(cursor)}>Try again</button>
        </div>
      ) : (
        <>
          <div className="shc-panel shc-anim">
            <div className="shc-month-bar">
              <span className="shc-month-label">
                {MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}
              </span>
              <div className="shc-month-nav">
                <button type="button" className="shc-nav-btn" onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="Previous month">
                  <ChevronIcon dir="left" />
                </button>
                <button type="button" className="shc-nav-btn" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
                  <ChevronIcon dir="right" />
                </button>
                <button type="button" className="shc-today-btn" onClick={goToToday}>Today</button>
              </div>
            </div>

            <div className="shc-dow" aria-hidden="true">
              {DOW_MON_FIRST.map((d) => <span key={d}>{d}</span>)}
            </div>

            {loading ? (
              <div className="shc-skel" />
            ) : (
              <div className="shc-grid">
                {cells.map((d) => {
                  const ymd = toYMD(d);
                  const isOtherMonth = d.getMonth() !== cursor.getMonth();
                  const isToday = ymd === toYMD(today);
                  const isSelected = ymd === selectedYMD;
                  const count = counts.get(ymd) || 0;
                  return (
                    <button
                      key={ymd}
                      type="button"
                      className={`shc-cell ${isOtherMonth ? 'is-other-month' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => setSelected(d)}
                    >
                      {count > 1 && <span className="shc-count-badge">{count}</span>}
                      <span>{d.getDate()}</span>
                      <span className="shc-dot-row">
                        {count > 0 && <span className="shc-dot" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <h3 className="shc-day-heading">{formatDateLong(selected)}</h3>

          {loading ? null : dayShifts.length === 0 ? (
            <div className="shc-empty shc-anim">
              <p className="shc-empty-title">Nothing scheduled</p>
              <p className="shc-empty-sub">{emptyText}</p>
            </div>
          ) : (
            dayShifts.map((s, i) => (
              <div key={s._id || i} className="shc-anim">{renderShift(s)}</div>
            ))
          )}
        </>
      )}
    </>
  );
}
