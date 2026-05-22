import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

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
  .ob-card.is-overdue {
    border-color: rgba(192, 117, 106, 0.55);
    background: linear-gradient(135deg, rgba(253, 243, 242, 0.55), #fff);
  }
  .ob-card-top {
    display: flex; align-items: flex-start; gap: 0.65rem;
  }
  .ob-card-name {
    font-size: 0.92rem; font-weight: 600;
    color: #2f3e46; line-height: 1.2;
    min-width: 0; flex: 1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ob-status-pill {
    font-size: 0.62rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 999px;
    flex-shrink: 0;
  }
  .ob-status-pill.is-pending   { background: rgba(132, 169, 140, 0.22); color: #354f52; }
  .ob-status-pill.is-completed { background: rgba(82, 121, 111, 0.22);  color: #2f3e46; }
  .ob-status-pill.is-cancelled { background: #ececec; color: #7a8e84; }
  .ob-status-pill.is-overdue   { background: rgba(192, 117, 106, 0.18); color: #b85c50; }

  .ob-dept {
    margin-top: 2px;
    font-size: 0.72rem; color: #7a8e84;
  }

  .ob-message {
    margin: 0.65rem 0 0;
    padding: 0.6rem 0.75rem;
    background: #f6f8f5;
    border-radius: 10px;
    font-size: 0.82rem; color: #2f3e46;
    line-height: 1.5;
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
  .ob-date-chip.is-overdue {
    background: rgba(192, 117, 106, 0.14);
    color: #b85c50;
  }
  .ob-date-chip strong {
    color: #354f52;
    font-weight: 600;
  }

  .ob-actions {
    display: flex; gap: 0.45rem;
    margin-top: 0.7rem;
  }
  .ob-btn {
    flex: 1;
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
  .ob-btn-complete {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    box-shadow: 0 3px 10px rgba(53,79,82,0.22);
  }
  .ob-btn-cancel {
    background: #fff;
    color: #7a8e84;
    border: 1.5px solid #d4ddd6;
  }
  .ob-btn-delete {
    flex: 0 0 auto;
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
    height: 110px; border-radius: 16px;
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
`;

const FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(req) {
  if (!req?.deadline || req?.status !== 'pending') return false;
  const d = new Date(req.deadline);
  return !Number.isNaN(d.getTime()) && d < new Date();
}

export default function ManagerObjectives() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [actingId, setActingId] = useState(null);
  const [banner, setBanner] = useState(null);

  async function fetchRequests() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/objective-requests');
      const list = data?.data || (Array.isArray(data) ? data : []);
      setRequests(list);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 2800);
  }

  async function updateStatus(req, status) {
    const verb = status === 'completed' ? 'Mark as completed?' : 'Cancel this request?';
    if (!window.confirm(verb)) return;
    setActingId(req._id);
    try {
      await api.put(`/objective-requests/${req._id}`, { status });
      setRequests((prev) => prev.map((r) => (r._id === req._id ? { ...r, status } : r)));
      flash('success', status === 'completed' ? 'Marked complete' : 'Cancelled');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  async function deleteRequest(req) {
    if (!window.confirm('Delete this request? This can\'t be undone.')) return;
    setActingId(req._id);
    try {
      await api.delete(`/objective-requests/${req._id}`);
      setRequests((prev) => prev.filter((r) => r._id !== req._id));
      flash('success', 'Request deleted');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  const counts = useMemo(() => ({
    all: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    completed: requests.filter((r) => r.status === 'completed').length,
    cancelled: requests.filter((r) => r.status === 'cancelled').length,
  }), [requests]);

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
              Objective Requests
              {!loading && !error && (
                <span className="ob-count"> · {filtered.length}</span>
              )}
            </h1>
          </div>
        </header>

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
            <p className="ob-error-title">Couldn't load objective requests</p>
            <p className="ob-error-sub">{error}</p>
            <button className="ob-retry" onClick={fetchRequests}>Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ob-empty ob-anim">
            <p className="ob-empty-title">Nothing here</p>
            <p className="ob-empty-sub">
              {filter === 'all'
                ? 'No objective requests sent yet. Create one on the web app.'
                : `No ${filter} requests right now.`}
            </p>
          </div>
        ) : (
          filtered.map((req) => (
            <ObjectiveCard
              key={req._id}
              req={req}
              acting={actingId === req._id}
              onComplete={() => updateStatus(req, 'completed')}
              onCancel={() => updateStatus(req, 'cancelled')}
              onDelete={() => deleteRequest(req)}
            />
          ))
        )}
      </div>
    </>
  );
}

function ObjectiveCard({ req, acting, onComplete, onCancel, onDelete }) {
  const overdue = isOverdue(req);
  const status = req.status || 'pending';
  return (
    <div className={`ob-card ob-anim ${overdue ? 'is-overdue' : ''}`}>
      <div className="ob-card-top">
        <div className="ob-card-name">{req.employeeName || 'Employee'}</div>
        <span className={`ob-status-pill is-${overdue ? 'overdue' : status}`}>
          {overdue ? 'Overdue' : status}
        </span>
      </div>
      {req.department && <div className="ob-dept">{req.department}</div>}

      {req.message && (
        <div className="ob-message">{req.message}</div>
      )}

      <div className="ob-dates">
        <span className={`ob-date-chip ${overdue ? 'is-overdue' : ''}`}>
          <strong>Deadline:</strong>{formatDate(req.deadline)}
        </span>
        {req.createdAt && (
          <span className="ob-date-chip">
            <strong>Sent:</strong>{formatDate(req.createdAt)}
          </span>
        )}
        {req.completedAt && (
          <span className="ob-date-chip">
            <strong>Done:</strong>{formatDate(req.completedAt)}
          </span>
        )}
      </div>

      <div className="ob-actions">
        {status === 'pending' && (
          <button
            className="ob-btn ob-btn-complete"
            onClick={onComplete}
            disabled={acting}
          >
            {acting ? <span className="ob-mini-spin" /> : null}
            Mark complete
          </button>
        )}
        {status !== 'cancelled' && status !== 'completed' && (
          <button
            className="ob-btn ob-btn-cancel"
            onClick={onCancel}
            disabled={acting}
          >
            Cancel
          </button>
        )}
        <button
          className="ob-btn ob-btn-delete"
          onClick={onDelete}
          disabled={acting}
          aria-label="Delete request"
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
