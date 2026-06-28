import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Mobile twin of the web manager Performance → Objectives tab.
// Managers see their team's objectives (goals), team-scoped by the backend:
//   GET    /performance/goals                       → { data: [...] }
//   POST   /performance/goals/:id/approve-objective → approve a pending objective
//   POST   /performance/goals/:id/send-back         → send back with a reason
//   DELETE /performance/goals/:id                   → delete an objective
//
// NOTE: the old /objective-requests endpoint is admin-only (returns 403 for
// manager/senior-manager/hr), which is why this screen previously showed 0
// across every filter. Goals are the manager-authorised, team-scoped source.

const styles = `
  @keyframes ob-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ob-skel {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.85; }
  }
  @keyframes ob-spin { to { transform: rotate(360deg); } }

  .ob-wrap { padding: 0.85rem 1rem 6rem; }
  .ob-anim { animation: ob-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header ── */
  .ob-header {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.25rem 0.85rem;
  }
  .ob-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18);
    flex-shrink: 0;
  }
  .ob-header-text { min-width: 0; flex: 1; }
  .ob-header-eyebrow {
    font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c; margin: 0;
  }
  .ob-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
  }
  .ob-count { font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem; }
  .ob-refresh {
    flex-shrink: 0;
    width: 36px; height: 36px; border-radius: 10px;
    border: 1px solid rgba(132, 169, 140, 0.4);
    background: rgba(255, 255, 255, 0.6);
    color: #52796f;
    display: flex; align-items: center; justify-content: center;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
  }
  .ob-refresh:disabled { opacity: 0.55; }
  .ob-refresh:not(:disabled):active { transform: scale(0.94); }
  .ob-refresh.is-busy svg { animation: ob-spin 0.8s linear infinite; }

  /* ── Search ── */
  .ob-search { position: relative; margin-bottom: 0.7rem; }
  .ob-search svg {
    position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%);
    color: #84a98c; pointer-events: none;
  }
  .ob-search input {
    width: 100%;
    padding: 0.6rem 0.75rem 0.6rem 2.2rem;
    border-radius: 12px;
    border: 1px solid rgba(212, 221, 214, 0.9);
    background: #fff;
    font-size: 0.84rem; color: #2f3e46;
    -webkit-tap-highlight-color: transparent;
  }
  .ob-search input::placeholder { color: #a7b6ac; }
  .ob-search input:focus {
    outline: none;
    border-color: #84a98c;
    box-shadow: 0 0 0 3px rgba(132, 169, 140, 0.18);
  }

  /* ── Filter chips ── */
  .ob-chips {
    display: flex; gap: 0.4rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin-bottom: 0.85rem;
    padding-bottom: 4px;
  }
  .ob-chips::-webkit-scrollbar { display: none; }
  .ob-chip {
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
  }
  .ob-chip.is-active {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    border-color: transparent;
  }

  /* ── Card ── */
  .ob-card {
    padding: 0.85rem 0.95rem;
    border-radius: 16px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.55rem;
  }
  .ob-card.is-sentback {
    border-color: rgba(196, 150, 90, 0.55);
    background: linear-gradient(135deg, rgba(253, 248, 240, 0.6), #fff);
  }
  .ob-card-top {
    display: flex; align-items: flex-start; gap: 0.65rem;
  }
  .ob-card-headings { min-width: 0; flex: 1; }
  .ob-card-name {
    font-size: 0.92rem; font-weight: 600;
    color: #2f3e46; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ob-card-emp {
    margin-top: 1px;
    font-size: 0.72rem; color: #7a8e84;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ob-pills {
    display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
    flex-shrink: 0;
  }
  .ob-pill {
    font-size: 0.6rem; font-weight: 700;
    letter-spacing: 0.04em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 999px;
    white-space: nowrap;
  }
  /* approval pills */
  .ob-pill.ap-pending   { background: rgba(196, 150, 90, 0.2);  color: #6b5524; }
  .ob-pill.ap-approved  { background: rgba(82, 121, 111, 0.22); color: #2f3e46; }
  .ob-pill.ap-sent_back { background: rgba(192, 117, 106, 0.18); color: #b85c50; }
  /* status pills */
  .ob-pill.st-TO_DO       { background: #ececec; color: #6a6a6a; }
  .ob-pill.st-IN_PROGRESS { background: rgba(111, 140, 152, 0.18); color: #354f52; }
  .ob-pill.st-ACHIEVED    { background: rgba(82, 121, 111, 0.22); color: #2f3e46; }
  .ob-pill.st-OVERDUE     { background: rgba(192, 117, 106, 0.18); color: #b85c50; }

  .ob-category {
    margin-top: 0.55rem;
    display: inline-block;
    font-size: 0.66rem; font-weight: 600;
    color: #52796f;
    background: rgba(132, 169, 140, 0.16);
    border-radius: 999px;
    padding: 2px 9px;
  }

  .ob-desc {
    margin: 0.6rem 0 0;
    font-size: 0.82rem; color: #2f3e46; line-height: 1.5;
  }
  .ob-desc.is-clamped {
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .ob-readmore {
    margin-top: 2px;
    background: none; border: none; padding: 0;
    font-size: 0.72rem; font-weight: 600; color: #52796f;
    cursor: pointer; -webkit-tap-highlight-color: transparent;
  }

  .ob-feedback {
    margin: 0.6rem 0 0;
    padding: 0.55rem 0.7rem;
    background: rgba(196, 150, 90, 0.1);
    border: 1px solid rgba(196, 150, 90, 0.28);
    border-radius: 10px;
  }
  .ob-feedback-label {
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.05em;
    text-transform: uppercase; color: #6b5524; margin: 0 0 2px;
  }
  .ob-feedback-text { font-size: 0.78rem; color: #6b5524; margin: 0; line-height: 1.45; }

  /* progress */
  .ob-progress { margin-top: 0.7rem; }
  .ob-progress-row {
    display: flex; justify-content: space-between;
    font-size: 0.68rem; color: #7a8e84; margin-bottom: 4px;
  }
  .ob-progress-track {
    width: 100%; height: 6px; border-radius: 999px;
    background: #e9ede9; overflow: hidden;
  }
  .ob-progress-fill {
    height: 100%; border-radius: 999px;
    transition: width 0.3s ease;
  }

  .ob-dates {
    margin-top: 0.6rem;
    display: flex; flex-wrap: wrap; gap: 0.55rem;
    font-size: 0.7rem; color: #7a8e84;
  }
  .ob-date-chip {
    display: inline-flex; align-items: center; gap: 0.3rem;
    background: #f1f4f0;
    border-radius: 999px;
    padding: 2px 8px;
    font-weight: 500;
  }
  .ob-date-chip strong { color: #354f52; font-weight: 600; }

  .ob-contrib {
    margin-top: 0.6rem;
    font-size: 0.72rem; color: #52796f;
    background: none; border: none; padding: 0;
    cursor: pointer; -webkit-tap-highlight-color: transparent;
    font-weight: 600;
  }
  .ob-contrib-list {
    margin-top: 0.5rem;
    display: flex; flex-direction: column; gap: 0.4rem;
  }
  .ob-contrib-item {
    background: #f6f8f5; border-radius: 10px;
    padding: 0.5rem 0.65rem;
    font-size: 0.78rem; color: #2f3e46; line-height: 1.45;
  }
  .ob-contrib-date { color: #8fa99a; margin-right: 0.4rem; font-weight: 500; }

  .ob-actions {
    display: flex; gap: 0.45rem; flex-wrap: wrap;
    margin-top: 0.7rem;
  }
  .ob-btn {
    flex: 1; min-width: 90px;
    padding: 0.55rem 0.7rem;
    border-radius: 10px;
    font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em;
    border: none;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 0.3rem;
    transition: transform 0.12s;
  }
  .ob-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .ob-btn:not(:disabled):active { transform: scale(0.97); }
  .ob-btn-approve {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    box-shadow: 0 3px 10px rgba(53,79,82,0.22);
  }
  .ob-btn-sendback {
    background: #fff;
    color: #b8893f;
    border: 1.5px solid rgba(196, 150, 90, 0.5);
  }
  .ob-btn-delete {
    flex: 0 0 auto; min-width: 0;
    background: #fff;
    color: #b85c50;
    border: 1.5px solid rgba(192,117,106,0.4);
    padding: 0.55rem 0.85rem;
  }
  .ob-mini-spin {
    width: 12px; height: 12px;
    border: 2px solid currentColor; border-top-color: transparent;
    border-radius: 50%; animation: ob-spin 0.7s linear infinite;
  }

  /* ── States ── */
  .ob-skel {
    height: 130px; border-radius: 16px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: ob-skel 1.2s ease-in-out infinite;
    margin-bottom: 0.55rem;
  }
  .ob-empty, .ob-error {
    padding: 2rem 1rem; border-radius: 16px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center; color: #52796f;
  }
  .ob-error {
    border-color: rgba(192, 117, 106, 0.4);
    color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .ob-empty-title, .ob-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .ob-empty-sub, .ob-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .ob-retry {
    margin-top: 0.85rem;
    padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .ob-retry:active { transform: scale(0.97); }

  .ob-banner {
    margin-bottom: 0.85rem;
    padding: 0.6rem 0.85rem;
    border-radius: 12px;
    font-size: 0.78rem; font-weight: 500;
  }
  .ob-banner.is-success {
    background: linear-gradient(135deg, #f0f5f2, #eaf2ec);
    border-left: 3px solid #52796f;
    color: #2f3e46;
  }
  .ob-banner.is-error {
    background: linear-gradient(135deg, #fdf3f2, #fdecea);
    border-left: 3px solid #c0756a;
    color: #7a3028;
  }

  /* ── Send-back modal ── */
  .ob-modal-overlay {
    position: fixed; inset: 0; z-index: 60;
    background: rgba(47, 62, 70, 0.55);
    display: flex; align-items: flex-end; justify-content: center;
    padding: 1rem;
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }
  .ob-modal {
    width: 100%; max-width: 460px;
    background: #fff; border-radius: 18px;
    padding: 1.1rem 1.1rem 1.25rem;
    box-shadow: 0 24px 48px rgba(47, 62, 70, 0.25);
    animation: ob-fadeUp 0.25s cubic-bezier(0.22,1,0.36,1) both;
  }
  .ob-modal-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.2rem; font-weight: 400; color: #2f3e46;
    margin: 0 0 0.2rem;
  }
  .ob-modal-sub { font-size: 0.76rem; color: #7a8e84; margin: 0 0 0.75rem; }
  .ob-modal textarea {
    width: 100%; min-height: 84px; resize: vertical;
    border: 1.5px solid #d4ddd6; border-radius: 10px;
    padding: 0.6rem 0.7rem;
    font-size: 0.84rem; color: #2f3e46; font-family: inherit;
    outline: none;
  }
  .ob-modal textarea:focus {
    border-color: #84a98c; box-shadow: 0 0 0 3px rgba(132, 169, 140, 0.18);
  }
  .ob-modal-actions { display: flex; gap: 0.5rem; margin-top: 0.8rem; }
`;

// Manager filters mirror the web Performance → Objectives tab (approval status).
const FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: 'Pending' },
  { key: 'approved',  label: 'Approved' },
  { key: 'sent_back', label: 'Sent Back' },
];

const APPROVAL_LABELS = {
  pending:   'Awaiting',
  approved:  'Approved',
  sent_back: 'Sent Back',
};

const STATUS_LABELS = {
  TO_DO:       'To Do',
  IN_PROGRESS: 'In Progress',
  ACHIEVED:    'Achieved',
  OVERDUE:     'Overdue',
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function employeeName(obj) {
  const u = obj?.userId;
  if (u && typeof u === 'object') {
    const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return full || u.email || 'Employee';
  }
  return obj?.employeeName || 'Employee';
}

function progressOf(obj) {
  const p = obj?.progressPercent ?? obj?.progress ?? 0;
  return Math.min(100, Math.max(0, Number(p) || 0));
}

function progressColor(pct) {
  if (pct >= 100) return '#52796f';
  if (pct >= 50) return '#6f8c98';
  return '#c4965a';
}

export default function ManagerObjectives() {
  const [objectives, setObjectives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [actingId, setActingId] = useState(null);
  const [banner, setBanner] = useState(null);
  const [sendBackTarget, setSendBackTarget] = useState(null);

  async function fetchObjectives(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/performance/goals');
      const list = data?.data || (Array.isArray(data) ? data : []);
      setObjectives(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchObjectives();
  }, []);

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 2800);
  }

  async function approve(obj) {
    if (!window.confirm('Approve this objective?')) return;
    setActingId(obj._id);
    try {
      await api.post(`/performance/goals/${obj._id}/approve-objective`);
      setObjectives((prev) =>
        prev.map((o) => (o._id === obj._id ? { ...o, approvalStatus: 'approved', sentBackReason: null } : o)),
      );
      flash('success', 'Objective approved');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  async function submitSendBack(reason) {
    const obj = sendBackTarget;
    if (!obj) return;
    setActingId(obj._id);
    try {
      await api.post(`/performance/goals/${obj._id}/send-back`, { reason });
      setObjectives((prev) =>
        prev.map((o) => (o._id === obj._id ? { ...o, approvalStatus: 'sent_back', sentBackReason: reason } : o)),
      );
      setSendBackTarget(null);
      flash('success', 'Objective sent back');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  async function deleteObjective(obj) {
    if (!window.confirm('Delete this objective? This can\'t be undone.')) return;
    setActingId(obj._id);
    try {
      await api.delete(`/performance/goals/${obj._id}`);
      setObjectives((prev) => prev.filter((o) => o._id !== obj._id));
      flash('success', 'Objective deleted');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return objectives.filter((o) => {
      const matchesFilter = filter === 'all' || o.approvalStatus === filter;
      if (!matchesFilter) return false;
      if (!q) return true;
      return (
        String(o.title || '').toLowerCase().includes(q)
        || employeeName(o).toLowerCase().includes(q)
        || String(o.category || '').toLowerCase().includes(q)
      );
    });
  }, [objectives, filter, search]);

  const counts = useMemo(() => ({
    all: objectives.length,
    pending: objectives.filter((o) => o.approvalStatus === 'pending').length,
    approved: objectives.filter((o) => o.approvalStatus === 'approved').length,
    sent_back: objectives.filter((o) => o.approvalStatus === 'sent_back').length,
  }), [objectives]);

  return (
    <>
      <style>{styles}</style>
      <div className="ob-wrap">
        <header className="ob-header ob-anim">
          <div className="ob-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div className="ob-header-text">
            <p className="ob-header-eyebrow">Team Objectives</p>
            <h1 className="ob-header-title">
              Objectives
              {!loading && !error && (
                <span className="ob-count"> · {filtered.length}</span>
              )}
            </h1>
          </div>
          <button
            type="button"
            className={`ob-refresh ${refreshing ? 'is-busy' : ''}`}
            onClick={() => fetchObjectives(true)}
            disabled={loading || refreshing}
            aria-label="Refresh objectives"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </header>

        {!loading && !error && objectives.length > 0 && (
          <div className="ob-search ob-anim">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search objective, employee, category…"
            />
          </div>
        )}

        <div className="ob-chips ob-anim">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`ob-chip ${filter === f.key ? 'is-active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} · {counts[f.key]}
            </button>
          ))}
        </div>

        {banner && (
          <div className={`ob-banner ${banner.kind === 'success' ? 'is-success' : 'is-error'} ob-anim`}>
            {banner.text}
          </div>
        )}

        {loading ? (
          <div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ob-skel" />
            ))}
          </div>
        ) : error ? (
          <div className="ob-error ob-anim">
            <p className="ob-error-title">Couldn't load objectives</p>
            <p className="ob-error-sub">{error}</p>
            <button className="ob-retry" onClick={() => fetchObjectives()}>Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ob-empty ob-anim">
            <p className="ob-empty-title">Nothing here</p>
            <p className="ob-empty-sub">
              {objectives.length === 0
                ? 'No objectives have been set for your team yet.'
                : `No ${filter === 'all' ? '' : (APPROVAL_LABELS[filter] || filter).toLowerCase() + ' '}objectives match.`}
            </p>
          </div>
        ) : (
          filtered.map((obj) => (
            <ObjectiveCard
              key={obj._id}
              obj={obj}
              acting={actingId === obj._id}
              onApprove={() => approve(obj)}
              onSendBack={() => setSendBackTarget(obj)}
              onDelete={() => deleteObjective(obj)}
            />
          ))
        )}
      </div>

      {sendBackTarget && (
        <SendBackModal
          objective={sendBackTarget}
          saving={actingId === sendBackTarget._id}
          onClose={() => setSendBackTarget(null)}
          onConfirm={submitSendBack}
        />
      )}
    </>
  );
}

function ObjectiveCard({ obj, acting, onApprove, onSendBack, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [showContrib, setShowContrib] = useState(false);

  const approval = obj.approvalStatus || 'pending';
  const status = obj.status || 'TO_DO';
  const pct = progressOf(obj);
  const inputs = Array.isArray(obj.employeeInput) ? obj.employeeInput : [];
  const dueDate = obj.endDate || obj.deadline;
  const longDesc = (obj.description || '').length > 110;

  return (
    <div className={`ob-card ob-anim ${approval === 'sent_back' ? 'is-sentback' : ''}`}>
      <div className="ob-card-top">
        <div className="ob-card-headings">
          <div className="ob-card-name">{obj.title || 'Untitled objective'}</div>
          <div className="ob-card-emp">{employeeName(obj)}</div>
        </div>
        <div className="ob-pills">
          <span className={`ob-pill ap-${approval}`}>{APPROVAL_LABELS[approval] || approval}</span>
          <span className={`ob-pill st-${status}`}>{STATUS_LABELS[status] || status}</span>
        </div>
      </div>

      {obj.category && <span className="ob-category">{obj.category}</span>}

      {obj.description && (
        <>
          <p className={`ob-desc ${!expanded && longDesc ? 'is-clamped' : ''}`}>{obj.description}</p>
          {longDesc && (
            <button type="button" className="ob-readmore" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </>
      )}

      {approval === 'sent_back' && obj.sentBackReason && (
        <div className="ob-feedback">
          <p className="ob-feedback-label">Manager feedback</p>
          <p className="ob-feedback-text">{obj.sentBackReason}</p>
        </div>
      )}

      <div className="ob-progress">
        <div className="ob-progress-row">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="ob-progress-track">
          <div className="ob-progress-fill" style={{ width: `${pct}%`, background: progressColor(pct) }} />
        </div>
      </div>

      {(obj.startDate || dueDate) && (
        <div className="ob-dates">
          {obj.startDate && (
            <span className="ob-date-chip"><strong>Start:</strong>{formatDate(obj.startDate)}</span>
          )}
          {dueDate && (
            <span className="ob-date-chip"><strong>Due:</strong>{formatDate(dueDate)}</span>
          )}
        </div>
      )}

      {inputs.length > 0 && (
        <>
          <button type="button" className="ob-contrib" onClick={() => setShowContrib((v) => !v)}>
            {showContrib ? 'Hide' : 'View'} {inputs.length} contribution{inputs.length !== 1 ? 's' : ''}
          </button>
          {showContrib && (
            <div className="ob-contrib-list">
              {inputs.map((entry, i) => (
                <div key={i} className="ob-contrib-item">
                  <span className="ob-contrib-date">{formatDate(entry.date || entry.submittedAt)}:</span>
                  {entry.contribution || entry.text || '—'}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="ob-actions">
        {approval === 'pending' && (
          <>
            <button className="ob-btn ob-btn-approve" onClick={onApprove} disabled={acting}>
              {acting ? <span className="ob-mini-spin" /> : null}
              Approve
            </button>
            <button className="ob-btn ob-btn-sendback" onClick={onSendBack} disabled={acting}>
              Send back
            </button>
          </>
        )}
        <button
          className="ob-btn ob-btn-delete"
          onClick={onDelete}
          disabled={acting}
          aria-label="Delete objective"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SendBackModal({ objective, saving, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <div className="ob-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ob-modal">
        <h3 className="ob-modal-title">Send back objective</h3>
        <p className="ob-modal-sub">{objective.title}</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason so the employee can revise their objective…"
          autoFocus
        />
        <div className="ob-modal-actions">
          <button className="ob-btn ob-btn-sendback" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="ob-btn ob-btn-approve"
            onClick={() => onConfirm(reason.trim())}
            disabled={saving || !reason.trim()}
          >
            {saving ? <span className="ob-mini-spin" /> : null}
            Send back
          </button>
        </div>
      </div>
    </div>
  );
}
