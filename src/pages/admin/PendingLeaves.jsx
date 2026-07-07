import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Admin "Pending Leaves" screen — the target of the Leaves stat card on the
// admin Home dashboard. Mirrors the web admin dashboard's pending-leave view
// (ComplianceDashboard.js → ComplianceInsights leave table), but adds the
// approve / reject actions admins have org-wide.
//
// Endpoints (admin scope returns the whole organisation, unlike the manager
// screen which is team-scoped):
//   GET   /leave/pending-requests   → { data: [ LeaveRequest ] }  (status Pending)
//   GET   /leave/approved-requests  → { data: [...] }             (status Approved)
//   GET   /leave/denied-requests    → { data: [...] }             (status Rejected)
//   PATCH /leave/approve/:id  { adminComment }
//   PATCH /leave/reject/:id   { rejectionReason }   (reason required)
// Each request populates `employeeId` with firstName/lastName/email/vtid/
// department/jobTitle, plus leaveType / startDate / endDate / reason / numberOfDays.

const styles = `
  @keyframes pl-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pl-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes pl-spin { to { transform: rotate(360deg); } }
  @keyframes pl-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pl-sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

  .pl-wrap { padding: 0.85rem 1rem 6rem; }
  .pl-anim { animation: pl-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header ── */
  .pl-header { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.25rem 0.85rem; }
  .pl-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18); flex-shrink: 0;
  }
  .pl-header-text { min-width: 0; flex: 1; }
  .pl-header-eyebrow { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .pl-header-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1; font-weight: 400; color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0; }
  .pl-count { font-size: 0.7rem; color: #7a8e84; }
  .pl-refresh {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .pl-refresh:disabled { opacity: 0.55; }
  .pl-refresh:not(:disabled):active { transform: scale(0.94); }
  .pl-refresh.is-busy svg { animation: pl-spin 0.8s linear infinite; }

  /* ── Status sub-tabs (Pending / Approved / Denied) ── */
  .pl-tabs { display: flex; gap: 0.4rem; margin-bottom: 0.85rem; }
  .pl-tab {
    flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
    padding: 0.5rem 0.7rem; border-radius: 999px;
    border: 1px solid #d4ddd6; background: #fff; color: #52796f;
    font-family: 'DM Sans', sans-serif; font-size: 0.76rem; font-weight: 600;
    white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .pl-tab:active { transform: scale(0.97); }
  .pl-tab.is-active.is-pending { background: rgba(184,151,88,0.14); border-color: rgba(184,151,88,0.4); color: #7a5a28; }
  .pl-tab.is-active.is-approved { background: rgba(82,121,111,0.14); border-color: rgba(82,121,111,0.4); color: #354f52; }
  .pl-tab.is-active.is-denied { background: rgba(184,92,80,0.14); border-color: rgba(184,92,80,0.4); color: #7a3028; }
  .pl-tab-count {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 17px; padding: 0 5px; border-radius: 999px;
    font-size: 0.6rem; font-weight: 700; background: rgba(132,169,140,0.18); color: inherit;
  }
  .pl-tab.is-active .pl-tab-count { background: rgba(255,255,255,0.85); }

  /* ── Search ── */
  .pl-search { position: relative; margin-bottom: 0.85rem; }
  .pl-search svg { position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%); color: #84a98c; pointer-events: none; }
  .pl-search input {
    width: 100%; padding: 0.65rem 0.75rem 0.65rem 2.2rem; border-radius: 12px;
    border: 1.5px solid #d4ddd6; background: #fff; font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46;
    -webkit-appearance: none; appearance: none; box-sizing: border-box; -webkit-tap-highlight-color: transparent;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .pl-search input::placeholder { color: #a7b6ac; }
  .pl-search input:focus { outline: none; border-color: #52796f; box-shadow: 0 0 0 3px rgba(82, 121, 111, 0.12); }

  /* ── Card ── */
  .pl-card {
    padding: 0.85rem 0.95rem; border-radius: 16px; background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.55rem;
  }
  .pl-card-top { display: flex; align-items: flex-start; gap: 0.7rem; }
  .pl-avatar {
    width: 38px; height: 38px; border-radius: 50%;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.28), rgba(82, 121, 111, 0.22)); color: #354f52;
    display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 600; flex-shrink: 0;
  }
  .pl-card-meta { min-width: 0; flex: 1; }
  .pl-name { font-size: 0.92rem; font-weight: 600; color: #2f3e46; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pl-subtitle { margin-top: 2px; font-size: 0.72rem; color: #7a8e84; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pl-type-pill {
    align-self: flex-start; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 999px; background: rgba(82, 121, 111, 0.18); color: #354f52; flex-shrink: 0;
  }

  .pl-card-details {
    margin: 0.65rem 0 0; padding: 0.55rem 0.7rem; background: #f6f8f5; border-radius: 10px;
    font-size: 0.78rem; color: #2f3e46; line-height: 1.45;
  }
  .pl-card-details strong { color: #354f52; font-weight: 600; margin-right: 0.25rem; }
  .pl-days { color: #52796f; font-weight: 600; }

  .pl-actions { display: flex; gap: 0.45rem; margin-top: 0.7rem; }
  .pl-btn {
    flex: 1; padding: 0.6rem 0.7rem; border-radius: 10px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.04em;
    border: none; -webkit-tap-highlight-color: transparent; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 0.35rem; transition: transform 0.12s, box-shadow 0.12s;
  }
  .pl-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .pl-btn:not(:disabled):active { transform: scale(0.97); }
  .pl-btn-approve { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; box-shadow: 0 3px 10px rgba(53,79,82,0.22); }
  .pl-btn-reject { background: #fff; color: #b85c50; border: 1.5px solid rgba(192,117,106,0.55); }
  .pl-mini-spin { width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: pl-spin 0.7s linear infinite; }

  /* ── Status note (approved/denied card footer) ── */
  .pl-status-note {
    margin-top: 0.7rem; padding: 0.5rem 0.7rem; border-radius: 10px;
    font-size: 0.74rem; line-height: 1.45; display: flex; gap: 0.5rem; align-items: flex-start;
  }
  .pl-status-note.is-approved { background: rgba(82,121,111,0.1); color: #354f52; }
  .pl-status-note.is-denied { background: rgba(184,92,80,0.1); color: #7a3028; }
  .pl-status-note strong { font-weight: 700; margin-right: 0.25rem; }
  .pl-status-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
  .pl-status-dot.is-approved { background: #52796f; }
  .pl-status-dot.is-denied { background: #b85c50; }

  /* ── States ── */
  .pl-skel { height: 118px; border-radius: 16px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%); animation: pl-skel 1.2s ease-in-out infinite; margin-bottom: 0.55rem; }
  .pl-empty, .pl-error {
    padding: 2rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .pl-error { border-color: rgba(192, 117, 106, 0.4); color: #7a3028; background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55); }
  .pl-empty-title, .pl-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .pl-empty-sub, .pl-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .pl-retry {
    margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .pl-retry:active { transform: scale(0.97); }

  /* ── Banner (transient toast) ── */
  .pl-banner {
    position: fixed; left: 1rem; right: 1rem; bottom: calc(72px + env(safe-area-inset-bottom, 0px)); z-index: 60;
    padding: 0.7rem 0.95rem; border-radius: 12px; font-size: 0.8rem; font-weight: 500;
    box-shadow: 0 8px 24px rgba(47,62,70,0.18); animation: pl-fadeUp 0.3s ease both;
  }
  .pl-banner.is-success { background: #2f3e46; color: #eaf2ec; border-left: 3px solid #84a98c; }
  .pl-banner.is-error { background: #7a3028; color: #fdecea; border-left: 3px solid #c0756a; }

  /* ── Reject reason sheet ── */
  .pl-overlay {
    position: fixed; inset: 0; background: rgba(31, 41, 38, 0.45); backdrop-filter: blur(2px);
    z-index: 50; display: flex; align-items: flex-end; animation: pl-fade 0.2s ease both;
  }
  .pl-sheet {
    width: 100%; max-height: 90vh; overflow-y: auto;
    background: #f6f8f4; border-radius: 22px 22px 0 0; padding: 1rem 1.1rem 1.5rem;
    box-shadow: 0 -8px 30px rgba(47, 62, 70, 0.2); animation: pl-sheetUp 0.3s cubic-bezier(0.22,1,0.36,1) both;
  }
  .pl-sheet-grip { width: 38px; height: 4px; border-radius: 999px; background: #cdd5cf; margin: 0 auto 0.85rem; }
  .pl-sheet-title { font-family: 'Cormorant Garamond', serif; font-size: 1.45rem; font-weight: 400; color: #2f3e46; margin: 0 0 0.25rem; }
  .pl-sheet-sub { font-size: 0.78rem; color: #7a8e84; margin: 0 0 0.85rem; }
  .pl-field { margin-bottom: 0.85rem; }
  .pl-field-label { display: block; font-size: 0.66rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #7a8e84; margin-bottom: 0.35rem; }
  .pl-textarea {
    width: 100%; padding: 0.7rem 0.8rem; border: 1.5px solid #d4ddd6; border-radius: 12px;
    font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46; background: #fff; outline: none;
    box-sizing: border-box; -webkit-appearance: none; appearance: none;
    transition: border-color 0.18s, box-shadow 0.18s; min-height: 90px; resize: vertical; line-height: 1.5;
  }
  .pl-textarea:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }
  .pl-sheet-actions { display: flex; gap: 0.5rem; margin-top: 0.4rem; }
  .pl-sheet-btn {
    flex: 1; padding: 0.75rem; border-radius: 12px; font-size: 0.82rem; font-weight: 600; letter-spacing: 0.02em;
    border: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
    display: flex; align-items: center; justify-content: center; gap: 0.4rem; transition: transform 0.12s;
  }
  .pl-sheet-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .pl-sheet-btn:not(:disabled):active { transform: scale(0.98); }
  .pl-sheet-btn-cancel { background: #fff; color: #7a8e84; border: 1.5px solid #d4ddd6; }
  .pl-sheet-btn-confirm { background: linear-gradient(135deg, #8a3f36 0%, #b85c50 100%); color: #fbeae7; box-shadow: 0 4px 14px rgba(138,63,54,0.2); }
`;

const TABS = [
  { id: 'pending', label: 'Pending', cls: 'is-pending' },
  { id: 'approved', label: 'Approved', cls: 'is-approved' },
  { id: 'denied', label: 'Denied', cls: 'is-denied' },
];

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Inclusive calendar-day count for the range — matches the backend's stored
// numberOfDays (Math.floor(diff) + 1). Prefer the stored value when present.
function dayCount(req) {
  if (req?.numberOfDays != null && Number.isFinite(Number(req.numberOfDays))) {
    return Number(req.numberOfDays);
  }
  const s = req?.startDate ? new Date(req.startDate) : null;
  const e = req?.endDate ? new Date(req.endDate) : null;
  if (!s || !e || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  s.setHours(0, 0, 0, 0); e.setHours(0, 0, 0, 0);
  return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

function employeeOf(req) {
  const e = req?.employeeId;
  return e && typeof e === 'object' ? e : {};
}
function initials(emp) {
  const f = (emp?.firstName || '').charAt(0);
  const l = (emp?.lastName || '').charAt(0);
  return (f + l).toUpperCase() || '?';
}
function fullName(emp) {
  return [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
}

// Read a list endpoint that returns `{ data: [...] }` or a bare array. Swallows
// errors so a failing history tab degrades to empty (count 0) rather than
// tearing down the screen.
async function fetchList(url) {
  try {
    const { data } = await api.get(url);
    const arr = data?.data ?? data;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function AdminPendingLeaves() {
  const [tab, setTab] = useState('pending');
  const [leaves, setLeaves] = useState({ pending: [], approved: [], denied: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [actingId, setActingId] = useState(null);
  const [banner, setBanner] = useState(null);

  // Reject sheet
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 2800);
  }

  async function fetchAll(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      // Pending is the primary payload — its failure surfaces the error state.
      // Approved/denied history load in parallel and fail soft to empty.
      const [pendingRes, approved, denied] = await Promise.all([
        api.get('/leave/pending-requests'),
        fetchList('/leave/approved-requests'),
        fetchList('/leave/denied-requests'),
      ]);
      const pending = pendingRes?.data?.data ?? pendingRes?.data ?? [];
      setLeaves({
        pending: Array.isArray(pending) ? pending : [],
        approved,
        denied,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refreshHistory() {
    const [approved, denied] = await Promise.all([
      fetchList('/leave/approved-requests'),
      fetchList('/leave/denied-requests'),
    ]);
    setLeaves((prev) => ({ ...prev, approved, denied }));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function approve(req) {
    if (!window.confirm(`Approve ${fullName(employeeOf(req))}'s leave request?`)) return;
    setActingId(req._id);
    try {
      await api.patch(`/leave/approve/${req._id}`, { adminComment: '' });
      setLeaves((prev) => ({ ...prev, pending: prev.pending.filter((r) => r._id !== req._id) }));
      flash('success', 'Leave approved');
      refreshHistory();
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  function openReject(req) {
    setRejectTarget(req);
    setRejectReason('');
  }
  function closeReject() {
    if (rejectSubmitting) return;
    setRejectTarget(null);
    setRejectReason('');
  }
  async function submitReject(e) {
    e.preventDefault();
    const reason = rejectReason.trim();
    if (!rejectTarget || !reason) return;
    const req = rejectTarget;
    setRejectSubmitting(true);
    try {
      await api.patch(`/leave/reject/${req._id}`, { rejectionReason: reason });
      setLeaves((prev) => ({ ...prev, pending: prev.pending.filter((r) => r._id !== req._id) }));
      flash('success', 'Leave rejected');
      refreshHistory();
      setRejectTarget(null);
      setRejectReason('');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setRejectSubmitting(false);
    }
  }

  const counts = {
    pending: leaves.pending.length,
    approved: leaves.approved.length,
    denied: leaves.denied.length,
  };

  const list = useMemo(() => {
    const rows = leaves[tab] || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const emp = employeeOf(r);
      return [fullName(emp), emp.email, emp.vtid, emp.department, emp.jobTitle, r.leaveType, r.reason]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [leaves, tab, search]);

  return (
    <>
      <style>{styles}</style>
      <div className="pl-wrap">
        <header className="pl-header pl-anim">
          <div className="pl-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <div className="pl-header-text">
            <p className="pl-header-eyebrow">Leave Approvals</p>
            <h1 className="pl-header-title">
              Pending Leaves
              {!loading && !error && <span className="pl-count"> · {counts.pending}</span>}
            </h1>
          </div>
          <button
            type="button"
            className={`pl-refresh${refreshing ? ' is-busy' : ''}`}
            onClick={() => fetchAll(true)}
            disabled={loading || refreshing}
            aria-label="Refresh"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </header>

        <div className="pl-tabs pl-anim">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`pl-tab${tab === t.id ? ` is-active ${t.cls}` : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="pl-tab-count">{counts[t.id]}</span>
            </button>
          ))}
        </div>

        {!loading && !error && (leaves[tab] || []).length > 0 && (
          <div className="pl-search pl-anim">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, type, department…"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
        )}

        {loading ? (
          <div>
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="pl-skel" />)}
          </div>
        ) : error ? (
          <div className="pl-error pl-anim">
            <p className="pl-error-title">Couldn't load leave requests</p>
            <p className="pl-error-sub">{error}</p>
            <button className="pl-retry" onClick={() => fetchAll()}>Try again</button>
          </div>
        ) : list.length === 0 ? (
          <div className="pl-empty pl-anim">
            <p className="pl-empty-title">
              {search.trim()
                ? 'No matches'
                : tab === 'pending' ? 'All caught up' : 'Nothing here'}
            </p>
            <p className="pl-empty-sub">
              {search.trim()
                ? 'Try a different search term.'
                : tab === 'pending'
                  ? 'No leave requests are waiting for approval.'
                  : `No ${tab} leave requests.`}
            </p>
          </div>
        ) : (
          list.map((req, i) => (
            <LeaveCard
              key={req._id || i}
              req={req}
              status={tab}
              acting={actingId === req._id}
              onApprove={approve}
              onReject={openReject}
              index={i}
            />
          ))
        )}
      </div>

      {banner && <div className={`pl-banner is-${banner.kind}`}>{banner.text}</div>}

      {rejectTarget && (
        <div className="pl-overlay" onClick={closeReject}>
          <div className="pl-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="pl-sheet-grip" />
            <h2 className="pl-sheet-title">Reject leave request</h2>
            <p className="pl-sheet-sub">{fullName(employeeOf(rejectTarget))}</p>
            <form onSubmit={submitReject}>
              <div className="pl-field">
                <label className="pl-field-label" htmlFor="pl-reject-reason">Reason for rejection</label>
                <textarea
                  id="pl-reject-reason"
                  className="pl-textarea"
                  placeholder="Let the employee know why this leave is being rejected…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="pl-sheet-actions">
                <button
                  type="button"
                  className="pl-sheet-btn pl-sheet-btn-cancel"
                  onClick={closeReject}
                  disabled={rejectSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pl-sheet-btn pl-sheet-btn-confirm"
                  disabled={rejectSubmitting || !rejectReason.trim()}
                >
                  {rejectSubmitting ? <span className="pl-mini-spin" /> : null}
                  Reject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function StatusNote({ status, date, by, reason }) {
  const kind = status === 'approved' ? 'approved' : 'denied';
  const label = status === 'approved' ? 'Approved ' : 'Rejected ';
  return (
    <div className={`pl-status-note is-${kind}`}>
      <span className={`pl-status-dot is-${kind}`} />
      <span>
        <strong>{label}</strong>
        {date ? formatDate(date) : ''}
        {by ? ` · by ${by}` : ''}
        {reason ? <span style={{ display: 'block', marginTop: 3 }}>“{reason}”</span> : null}
      </span>
    </div>
  );
}

function LeaveCard({ req, status, acting, onApprove, onReject, index = 0 }) {
  const emp = employeeOf(req);
  const days = dayCount(req);
  return (
    <div className="pl-card pl-anim" style={{ animationDelay: `${Math.min(index, 6) * 25}ms` }}>
      <div className="pl-card-top">
        <span className="pl-avatar">{initials(emp)}</span>
        <div className="pl-card-meta">
          <div className="pl-name">{fullName(emp)}</div>
          <div className="pl-subtitle">
            {[emp.department, emp.jobTitle].filter(Boolean).join(' · ') || emp.vtid || emp.email || '—'}
          </div>
        </div>
        <span className="pl-type-pill">{req.leaveType || 'Leave'}</span>
      </div>
      <div className="pl-card-details">
        <div>
          <strong>Dates:</strong>{formatDate(req.startDate)} → {formatDate(req.endDate)}
          {days ? <span className="pl-days"> · {days} day{days === 1 ? '' : 's'}</span> : null}
        </div>
        {req.reason && <div style={{ marginTop: 4 }}><strong>Reason:</strong>{req.reason}</div>}
      </div>
      {status === 'pending' ? (
        <div className="pl-actions">
          <button className="pl-btn pl-btn-reject" onClick={() => onReject(req)} disabled={acting}>
            {acting ? <span className="pl-mini-spin" /> : null}
            Reject
          </button>
          <button className="pl-btn pl-btn-approve" onClick={() => onApprove(req)} disabled={acting}>
            {acting ? <span className="pl-mini-spin" /> : null}
            Approve
          </button>
        </div>
      ) : (
        <StatusNote
          status={status}
          date={status === 'approved' ? req.approvedAt : req.rejectedAt}
          by={
            status === 'approved' && req.approvedBy ? fullName(req.approvedBy)
              : status === 'denied' && req.rejectedBy ? fullName(req.rejectedBy)
                : ''
          }
          reason={status === 'denied' ? req.rejectionReason : ''}
        />
      )}
    </div>
  );
}
