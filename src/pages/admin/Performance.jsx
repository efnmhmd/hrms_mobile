import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Admin / manager performance reporting. Reads the objective-requests feed
// (same source as the manager Objectives screen) and rolls it up into a
// completion-rate ring, status breakdown and a per-employee leaderboard.

const styles = `
  @keyframes pf-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pf-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes pf-spin { to { transform: rotate(360deg); } }
  @keyframes pf-ring { from { stroke-dashoffset: var(--pf-circ); } }

  .pf-wrap { padding: 0.85rem 1rem 6rem; }
  .pf-anim { animation: pf-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  .pf-header { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.25rem 0.85rem; }
  .pf-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18); flex-shrink: 0;
  }
  .pf-header-text { min-width: 0; flex: 1; }
  .pf-header-eyebrow { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .pf-header-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1; font-weight: 400; color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0; }
  .pf-refresh-btn {
    flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 10px;
    border: 1px solid rgba(212, 221, 214, 0.7); background: #fff; color: #354f52;
    cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 0.15s, transform 0.12s;
  }
  .pf-refresh-btn:active { background: #f1f4f0; transform: scale(0.95); }
  .pf-refresh-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .pf-refresh-btn.is-spinning svg { animation: pf-spin 0.9s linear infinite; }

  /* ── Completion ring hero ── */
  .pf-hero {
    display: flex; align-items: center; gap: 1.1rem;
    padding: 1.1rem 1.15rem; margin-bottom: 0.85rem; border-radius: 18px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; box-shadow: 0 10px 26px rgba(47, 62, 70, 0.16);
    position: relative; overflow: hidden;
  }
  .pf-hero-ring { position: relative; flex-shrink: 0; width: 92px; height: 92px; }
  .pf-hero-ring svg { transform: rotate(-90deg); }
  .pf-hero-ring-track { stroke: rgba(202, 210, 197, 0.2); }
  .pf-hero-ring-fill { stroke: #cad2c5; stroke-linecap: round; animation: pf-ring 0.9s cubic-bezier(0.22,1,0.36,1) both; }
  .pf-hero-ring-pct {
    position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .pf-hero-ring-num { font-family: 'Cormorant Garamond', serif; font-size: 1.7rem; line-height: 1; font-weight: 500; color: #f0f5f2; }
  .pf-hero-ring-lab { font-size: 0.52rem; letter-spacing: 0.14em; text-transform: uppercase; color: #84a98c; margin-top: 1px; }
  .pf-hero-meta { min-width: 0; flex: 1; }
  .pf-hero-eyebrow { font-size: 0.58rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .pf-hero-title { font-family: 'Cormorant Garamond', serif; font-size: 1.4rem; line-height: 1.1; margin: 0.15rem 0 0.35rem; color: #f0f5f2; }
  .pf-hero-sub { font-size: 0.74rem; color: rgba(202, 210, 197, 0.85); line-height: 1.45; }

  /* ── Stat grid ── */
  .pf-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4rem; margin-bottom: 0.95rem; }
  .pf-stat { border: 1px solid rgba(212, 221, 214, 0.7); background: #fff; border-radius: 12px; padding: 0.55rem 0.4rem; text-align: center; box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04); }
  .pf-stat-val { font-size: 1.1rem; font-weight: 700; color: #2f3e46; font-variant-numeric: tabular-nums; line-height: 1; }
  .pf-stat-lab { margin-top: 4px; font-size: 0.56rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #84a98c; }
  .pf-stat.is-pending .pf-stat-val { color: #b78f3a; }
  .pf-stat.is-completed .pf-stat-val { color: #354f52; }
  .pf-stat.is-overdue .pf-stat-val { color: #b85c50; }

  /* ── Section label ── */
  .pf-section { display: inline-flex; align-items: center; gap: 0.55rem; padding: 0 0.25rem; font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #52796f; margin-bottom: 0.6rem; }
  .pf-section::before { content: ''; width: 14px; height: 1.5px; background: linear-gradient(90deg, #84a98c, rgba(132, 169, 140, 0)); border-radius: 1px; }

  /* ── Leaderboard ── */
  .pf-board { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.1rem; }
  .pf-row { padding: 0.6rem 0.75rem; border-radius: 12px; background: #fff; border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04); }
  .pf-row-top { display: flex; align-items: center; gap: 0.55rem; }
  .pf-row-avatar { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, rgba(132, 169, 140, 0.28), rgba(82, 121, 111, 0.22)); color: #354f52; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 600; flex-shrink: 0; }
  .pf-row-name { flex: 1; min-width: 0; font-size: 0.84rem; font-weight: 600; color: #2f3e46; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pf-row-rate { font-size: 0.74rem; font-weight: 700; color: #52796f; font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .pf-row-bar { margin-top: 0.5rem; height: 6px; border-radius: 999px; background: #eef2ef; overflow: hidden; }
  .pf-row-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #52796f, #84a98c); }
  .pf-row-meta { margin-top: 0.4rem; font-size: 0.66rem; color: #7a8e84; display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .pf-row-meta .pf-od { color: #b85c50; font-weight: 600; }

  /* ── Recent list ── */
  .pf-recent { display: flex; flex-direction: column; gap: 0.4rem; }
  .pf-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.55rem 0.75rem; border-radius: 12px; background: #fff; border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04); border-left: 3px solid transparent; }
  .pf-item.is-pending { border-left-color: #d8a64c; }
  .pf-item.is-completed { border-left-color: #52796f; }
  .pf-item.is-cancelled { border-left-color: rgba(122,142,132,0.4); }
  .pf-item.is-overdue { border-left-color: #c0756a; }
  .pf-item-main { flex: 1; min-width: 0; }
  .pf-item-name { font-size: 0.82rem; font-weight: 600; color: #2f3e46; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pf-item-msg { font-size: 0.7rem; color: #7a8e84; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pf-item-pill { flex-shrink: 0; font-size: 0.55rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 7px; border-radius: 999px; }
  .pf-item-pill.is-pending { background: rgba(216, 166, 76, 0.18); color: #7a591f; }
  .pf-item-pill.is-completed { background: rgba(82, 121, 111, 0.18); color: #354f52; }
  .pf-item-pill.is-cancelled { background: #ececec; color: #7a8e84; }
  .pf-item-pill.is-overdue { background: rgba(192, 117, 106, 0.18); color: #7a3028; }

  /* ── States ── */
  .pf-skel { height: 96px; border-radius: 16px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%); animation: pf-skel 1.2s ease-in-out infinite; margin-bottom: 0.5rem; }
  .pf-empty, .pf-error {
    padding: 2rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .pf-error { border-color: rgba(192, 117, 106, 0.4); color: #7a3028; background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55); }
  .pf-empty-title, .pf-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .pf-empty-sub, .pf-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .pf-retry { margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .pf-retry:active { transform: scale(0.97); }
`;

function statusOf(req) {
  const s = (req?.status || 'pending').toLowerCase();
  if (s === 'completed' || s === 'cancelled') return s;
  if (req?.deadline) {
    const d = new Date(req.deadline);
    if (!Number.isNaN(d.getTime()) && d < new Date()) return 'overdue';
  }
  return 'pending';
}

function employeeOf(req) {
  return req?.employeeName || req?.employee?.name || req?.employee?.email || 'Employee';
}

// Adapt a performance "goal" (web manager feed) into the objective-request shape
// this screen renders, so the fallback below produces the same UI.
function goalToRequest(g) {
  const u = g?.userId;
  const employeeName =
    g?.employeeName ||
    (u && typeof u === 'object' ? [u.firstName, u.lastName].filter(Boolean).join(' ').trim() : '') ||
    g?.employee?.name || '';
  const raw = String(g?.status || '').toUpperCase();
  let status = 'pending';
  if (raw === 'ACHIEVED' || raw === 'COMPLETED') status = 'completed';
  else if (raw === 'CANCELLED') status = 'cancelled';
  // OVERDUE is derived from the deadline by statusOf(), so leave it as pending.
  return {
    _id: g?._id || g?.id,
    employeeName,
    employee: g?.employee,
    message: g?.title || g?.description,
    title: g?.title,
    deadline: g?.endDate || g?.deadline,
    status,
    createdAt: g?.createdAt,
    department: g?.department,
  };
}

function initials(name) {
  const parts = String(name).trim().split(/\s+/);
  const a = parts[0]?.charAt(0) || '';
  const b = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (a + b).toUpperCase() || '?';
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const RING_R = 40;
const RING_CIRC = 2 * Math.PI * RING_R;

export default function Performance() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchRequests() {
    setLoading(true);
    setError(null);
    try {
      let list;
      try {
        const { data } = await api.get('/objective-requests');
        list = data?.data || (Array.isArray(data) ? data : []);
      } catch (primaryErr) {
        // Some manager roles can't read the objective-requests feed; fall back to
        // the performance goals feed (the web manager view) and adapt its shape.
        const { data } = await api.get('/performance/goals');
        const goals = data?.data || data?.goals || (Array.isArray(data) ? data : []);
        list = (Array.isArray(goals) ? goals : []).map(goalToRequest);
      }
      setRequests(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  const stats = useMemo(() => {
    const s = { total: requests.length, pending: 0, completed: 0, cancelled: 0, overdue: 0 };
    for (const r of requests) {
      const st = statusOf(r);
      if (st === 'overdue') { s.overdue += 1; s.pending += 1; }
      else if (s[st] != null) s[st] += 1;
    }
    const decided = s.completed + s.cancelled;
    s.completionRate = decided > 0 ? Math.round((s.completed / decided) * 100) : 0;
    return s;
  }, [requests]);

  const board = useMemo(() => {
    const map = new Map();
    for (const r of requests) {
      const name = employeeOf(r);
      const cur = map.get(name) || { name, total: 0, completed: 0, overdue: 0 };
      cur.total += 1;
      const st = statusOf(r);
      if (st === 'completed') cur.completed += 1;
      if (st === 'overdue') cur.overdue += 1;
      map.set(name, cur);
    }
    return [...map.values()]
      .map((e) => ({ ...e, rate: e.total ? Math.round((e.completed / e.total) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total)
      .slice(0, 8);
  }, [requests]);

  const recent = useMemo(() => {
    return [...requests]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 8);
  }, [requests]);

  const dashOffset = RING_CIRC - (stats.completionRate / 100) * RING_CIRC;

  return (
    <>
      <style>{styles}</style>
      <div className="pf-wrap">
        <header className="pf-header pf-anim">
          <div className="pf-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20V10M18 20V4M6 20v-4" />
            </svg>
          </div>
          <div className="pf-header-text">
            <p className="pf-header-eyebrow">Reporting</p>
            <h1 className="pf-header-title">Performance</h1>
          </div>
          <button
            type="button"
            className={`pf-refresh-btn${loading ? ' is-spinning' : ''}`}
            onClick={fetchRequests}
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

        {loading ? (
          <div>
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="pf-skel" />)}
          </div>
        ) : error ? (
          <div className="pf-error pf-anim">
            <p className="pf-error-title">Couldn't load performance data</p>
            <p className="pf-error-sub">{error}</p>
            <button className="pf-retry" onClick={fetchRequests}>Try again</button>
          </div>
        ) : stats.total === 0 ? (
          <div className="pf-empty pf-anim">
            <p className="pf-empty-title">No objectives yet</p>
            <p className="pf-empty-sub">Objectives assigned to employees will be summarised here.</p>
          </div>
        ) : (
          <>
            <div className="pf-hero pf-anim">
              <div className="pf-hero-ring" style={{ ['--pf-circ']: `${RING_CIRC}px` }}>
                <svg width="92" height="92" viewBox="0 0 92 92">
                  <circle className="pf-hero-ring-track" cx="46" cy="46" r={RING_R} fill="none" strokeWidth="8" />
                  <circle
                    className="pf-hero-ring-fill"
                    cx="46" cy="46" r={RING_R} fill="none" strokeWidth="8"
                    strokeDasharray={RING_CIRC}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <div className="pf-hero-ring-pct">
                  <span className="pf-hero-ring-num">{stats.completionRate}%</span>
                  <span className="pf-hero-ring-lab">Complete</span>
                </div>
              </div>
              <div className="pf-hero-meta">
                <p className="pf-hero-eyebrow">Objectives</p>
                <h2 className="pf-hero-title">{stats.total} total</h2>
                <p className="pf-hero-sub">
                  {stats.completed} completed · {stats.pending} in progress
                  {stats.overdue > 0 ? ` · ${stats.overdue} overdue` : ''}
                </p>
              </div>
            </div>

            <div className="pf-stats pf-anim">
              <div className="pf-stat">
                <div className="pf-stat-val">{stats.total}</div>
                <div className="pf-stat-lab">Total</div>
              </div>
              <div className="pf-stat is-pending">
                <div className="pf-stat-val">{stats.pending}</div>
                <div className="pf-stat-lab">Active</div>
              </div>
              <div className="pf-stat is-completed">
                <div className="pf-stat-val">{stats.completed}</div>
                <div className="pf-stat-lab">Done</div>
              </div>
              <div className="pf-stat is-overdue">
                <div className="pf-stat-val">{stats.overdue}</div>
                <div className="pf-stat-lab">Overdue</div>
              </div>
            </div>

            {board.length > 0 && (
              <>
                <h3 className="pf-section pf-anim">By employee</h3>
                <div className="pf-board pf-anim">
                  {board.map((e) => (
                    <div key={e.name} className="pf-row">
                      <div className="pf-row-top">
                        <span className="pf-row-avatar">{initials(e.name)}</span>
                        <span className="pf-row-name">{e.name}</span>
                        <span className="pf-row-rate">{e.rate}%</span>
                      </div>
                      <div className="pf-row-bar">
                        <div className="pf-row-bar-fill" style={{ width: `${e.rate}%` }} />
                      </div>
                      <div className="pf-row-meta">
                        <span>{e.completed}/{e.total} completed</span>
                        {e.overdue > 0 && <span className="pf-od">{e.overdue} overdue</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h3 className="pf-section pf-anim">Recent</h3>
            <div className="pf-recent pf-anim">
              {recent.map((r, i) => {
                const st = statusOf(r);
                const date = formatDate(r.deadline || r.createdAt);
                return (
                  <div key={r._id || r.id || i} className={`pf-item is-${st}`}>
                    <div className="pf-item-main">
                      <div className="pf-item-name">{employeeOf(r)}</div>
                      <div className="pf-item-msg">
                        {r.message || r.title || 'Objective'}{date ? ` · ${date}` : ''}
                      </div>
                    </div>
                    <span className={`pf-item-pill is-${st}`}>{st}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
