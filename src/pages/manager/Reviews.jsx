import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Mobile twin of the web manager Performance → Reviews tab.
// Managers write performance reviews for their direct reports, linking the
// employee's approved objectives and giving a rating + written feedback.
//
//   GET    /reviews                      → { data: [...] }   (team-scoped by backend)
//   POST   /reviews                      → create a DRAFT review
//   PUT    /reviews/:id                  → edit a DRAFT review
//   POST   /reviews/:id/publish          → DRAFT → RATING_PUBLISHED (employee notified)
//   POST   /reviews/:id/close            → RATING_PUBLISHED → REVIEW_CLOSED
//
// Employee/objective pickers:
//   GET /manager/team/members?includeIndirect=false   (team scope)
//   GET /employees?includeAdmins=true                 (org / admin scope)
//   GET /goals/team-objectives?approvalStatus=approved (approved objectives to link)
//
// NOTE: the backend has no DELETE /reviews/:id route, so — unlike the web —
// there is no delete action here (drafts are edited/published instead).

const styles = `
  @keyframes rv-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes rv-skel { 0%,100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes rv-spin { to { transform: rotate(360deg); } }

  .rv-wrap { animation: rv-fadeUp 0.3s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Filter chips ── */
  .rv-chips {
    display: flex; gap: 0.4rem; overflow-x: auto;
    -webkit-overflow-scrolling: touch; margin-bottom: 0.75rem; padding-bottom: 4px;
  }
  .rv-chips::-webkit-scrollbar { display: none; }
  .rv-chip {
    flex-shrink: 0; padding: 0.45rem 0.85rem; border-radius: 999px;
    font-size: 0.74rem; font-weight: 600; letter-spacing: 0.03em;
    border: 1px solid rgba(132,169,140,0.4);
    background: rgba(255,255,255,0.6); color: #52796f;
    -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .rv-chip.is-active {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; border-color: transparent;
  }

  .rv-typefilter { margin-bottom: 0.85rem; }
  .rv-typefilter select {
    width: 100%; padding: 0.6rem 0.7rem; border-radius: 12px;
    border: 1px solid rgba(212,221,214,0.9); background: #fff;
    font-size: 0.82rem; color: #2f3e46; -webkit-appearance: none; appearance: none;
  }
  .rv-typefilter select:focus {
    outline: none; border-color: #84a98c; box-shadow: 0 0 0 3px rgba(132,169,140,0.18);
  }

  /* ── Card ── */
  .rv-card {
    padding: 0.85rem 0.95rem; border-radius: 16px; background: #fff;
    border: 1px solid rgba(212,221,214,0.7);
    box-shadow: 0 1px 2px rgba(47,62,70,0.04); margin-bottom: 0.55rem;
    animation: rv-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both;
  }
  .rv-card-top { display: flex; align-items: flex-start; gap: 0.65rem; }
  .rv-card-headings { min-width: 0; flex: 1; }
  .rv-card-name {
    font-size: 0.92rem; font-weight: 600; color: #2f3e46; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .rv-card-type {
    margin-top: 1px; font-size: 0.72rem; color: #7a8e84;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .rv-pill {
    flex-shrink: 0; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.04em;
    text-transform: uppercase; padding: 3px 8px; border-radius: 999px; white-space: nowrap;
  }
  .rv-pill.st-DRAFT            { background: #ececec; color: #6a6a6a; }
  .rv-pill.st-RATING_PUBLISHED { background: rgba(82,121,111,0.22); color: #2f3e46; }
  .rv-pill.st-SUBMITTED        { background: rgba(82,121,111,0.22); color: #2f3e46; }
  .rv-pill.st-REVIEW_CLOSED    { background: rgba(111,140,152,0.18); color: #354f52; }

  .rv-meta { margin-top: 0.55rem; display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .rv-meta-chip {
    display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.68rem;
    color: #7a8e84; background: #f1f4f0; border-radius: 999px; padding: 2px 8px; font-weight: 500;
  }
  .rv-meta-chip strong { color: #354f52; font-weight: 600; }

  .rv-rating {
    margin-top: 0.6rem; display: inline-flex; align-items: center; gap: 0.35rem;
    font-size: 0.68rem; font-weight: 700; letter-spacing: 0.02em;
    padding: 3px 10px; border-radius: 999px;
    background: rgba(132,169,140,0.16); color: #40614f;
  }
  .rv-rating.none { background: #eef2ef; color: #9aa89f; }

  .rv-block { margin-top: 0.6rem; }
  .rv-block-label {
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.05em;
    text-transform: uppercase; color: #84a98c; margin: 0 0 2px;
  }
  .rv-block-text { font-size: 0.82rem; color: #2f3e46; line-height: 1.5; margin: 0; }

  .rv-comment {
    margin-top: 0.6rem; background: #f6f8f5; border-radius: 10px; padding: 0.55rem 0.7rem;
  }
  .rv-comment .rv-block-label { color: #6b8f7c; }

  .rv-linked {
    margin-top: 0.6rem; font-size: 0.7rem; color: #52796f; font-weight: 600;
  }

  .rv-actions { display: flex; gap: 0.45rem; flex-wrap: wrap; margin-top: 0.75rem; }
  .rv-btn {
    flex: 1; min-width: 84px; padding: 0.55rem 0.7rem; border-radius: 10px;
    font-size: 0.78rem; font-weight: 600; letter-spacing: 0.03em; border: none;
    display: flex; align-items: center; justify-content: center; gap: 0.3rem;
    -webkit-tap-highlight-color: transparent; cursor: pointer; transition: transform 0.12s;
  }
  .rv-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .rv-btn:not(:disabled):active { transform: scale(0.97); }
  .rv-btn-primary {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; box-shadow: 0 3px 10px rgba(53,79,82,0.2);
  }
  .rv-btn-ghost {
    background: #fff; color: #52796f; border: 1.5px solid rgba(132,169,140,0.5);
  }
  .rv-btn-purple {
    background: #fff; color: #6f7ea8; border: 1.5px solid rgba(111,126,168,0.45);
  }
  .rv-mini-spin {
    width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent;
    border-radius: 50%; animation: rv-spin 0.7s linear infinite;
  }

  /* ── States ── */
  .rv-skel {
    height: 120px; border-radius: 16px; margin-bottom: 0.55rem;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: rv-skel 1.2s ease-in-out infinite;
  }
  .rv-empty, .rv-error {
    padding: 2rem 1rem; border-radius: 16px; text-align: center; color: #52796f;
    background:
      repeating-linear-gradient(135deg, rgba(132,169,140,0.06) 0 6px, transparent 6px 16px),
      rgba(255,255,255,0.55);
    border: 1px dashed rgba(132,169,140,0.4);
  }
  .rv-error { border-color: rgba(192,117,106,0.4); color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192,117,106,0.06) 0 6px, transparent 6px 16px),
      rgba(255,255,255,0.55);
  }
  .rv-empty-title, .rv-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .rv-empty-sub, .rv-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .rv-retry {
    margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.78rem; font-weight: 600; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .rv-retry:active { transform: scale(0.97); }

  .rv-banner {
    margin-bottom: 0.85rem; padding: 0.6rem 0.85rem; border-radius: 12px;
    font-size: 0.78rem; font-weight: 500;
  }
  .rv-banner.is-success {
    background: linear-gradient(135deg, #f0f5f2, #eaf2ec);
    border-left: 3px solid #52796f; color: #2f3e46;
  }
  .rv-banner.is-error {
    background: linear-gradient(135deg, #fdf3f2, #fdecea);
    border-left: 3px solid #c0756a; color: #7a3028;
  }

  /* ── Form modal ── */
  .rv-overlay {
    position: fixed; inset: 0; z-index: 60; background: rgba(47,62,70,0.55);
    display: flex; align-items: flex-end; justify-content: center;
  }
  .rv-modal {
    width: 100%; max-width: 480px; max-height: 92vh; overflow-y: auto;
    background: #fff; border-radius: 20px 20px 0 0;
    padding: 1.1rem 1.1rem calc(1.25rem + env(safe-area-inset-bottom));
    box-shadow: 0 -12px 40px rgba(47,62,70,0.25);
    animation: rv-fadeUp 0.28s cubic-bezier(0.22,1,0.36,1) both;
  }
  .rv-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; }
  .rv-modal-title {
    font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; font-weight: 400;
    color: #2f3e46; margin: 0;
  }
  .rv-modal-close {
    width: 30px; height: 30px; border-radius: 8px; border: none; background: #f1f4f0;
    color: #52796f; font-size: 1.1rem; line-height: 1; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .rv-field { margin-bottom: 0.85rem; }
  .rv-label {
    display: block; font-size: 0.72rem; font-weight: 600; color: #40614f;
    letter-spacing: 0.02em; margin-bottom: 0.35rem;
  }
  .rv-label .req { color: #c0756a; }
  .rv-input, .rv-select, .rv-textarea {
    width: 100%; border: 1.5px solid #d4ddd6; border-radius: 10px;
    padding: 0.6rem 0.7rem; font-size: 0.85rem; color: #2f3e46; font-family: inherit;
    background: #fff; -webkit-appearance: none; appearance: none; outline: none;
  }
  .rv-textarea { resize: vertical; min-height: 74px; }
  .rv-input:focus, .rv-select:focus, .rv-textarea:focus {
    border-color: #84a98c; box-shadow: 0 0 0 3px rgba(132,169,140,0.18);
  }
  .rv-input:disabled, .rv-select:disabled { background: #f4f6f4; color: #8a9a90; }
  .rv-dates { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }

  .rv-objlist { display: flex; flex-direction: column; gap: 0.4rem; max-height: 190px; overflow-y: auto; }
  .rv-objrow {
    display: flex; align-items: flex-start; gap: 0.55rem; padding: 0.55rem 0.65rem;
    border-radius: 10px; border: 1.5px solid #e4eae4; background: #fff; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .rv-objrow.is-on { border-color: #84a98c; background: rgba(132,169,140,0.1); }
  .rv-objrow input { margin-top: 2px; accent-color: #52796f; width: 16px; height: 16px; flex-shrink: 0; }
  .rv-objrow-body { min-width: 0; flex: 1; }
  .rv-objrow-title { font-size: 0.8rem; font-weight: 600; color: #2f3e46; line-height: 1.25; }
  .rv-objrow-cat { font-size: 0.68rem; color: #84a98c; margin-top: 1px; }
  .rv-hint { font-size: 0.72rem; color: #a7b6ac; font-style: italic; margin: 0; }

  .rv-ratings { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  .rv-ratebtn {
    display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
    padding: 0.55rem 0.65rem; border-radius: 10px; border: 1.5px solid #e4eae4;
    background: #fff; cursor: pointer; text-align: left;
    -webkit-tap-highlight-color: transparent;
  }
  .rv-ratebtn.is-on { border-color: #52796f; background: rgba(82,121,111,0.1); }
  .rv-ratebtn-code { font-size: 0.74rem; font-weight: 700; color: #40614f; }
  .rv-ratebtn-label { font-size: 0.66rem; color: #7a8e84; }

  .rv-form-error {
    background: #fdecea; border: 1px solid rgba(192,117,106,0.3); border-radius: 10px;
    padding: 0.55rem 0.7rem; font-size: 0.76rem; color: #7a3028; margin-bottom: 0.85rem;
  }
  .rv-modal-actions { display: flex; gap: 0.55rem; margin-top: 0.4rem; }
`;

const REVIEW_TYPES = [
  { value: 'QUARTERLY',        label: 'Quarterly Review' },
  { value: 'MID_YEAR',         label: 'Mid-Year Review' },
  { value: 'ANNUAL',           label: 'Annual Review' },
  { value: 'PROBATION',        label: 'Probation Review' },
  { value: 'PIP',              label: 'Performance Improvement Plan' },
  { value: 'MONTHLY',          label: 'Monthly 1:1' },
  { value: 'WEEKLY',           label: 'Weekly Check-in' },
  { value: 'HR_REVIEW',        label: 'HR Review' },
  { value: 'LEAVE_MANAGEMENT', label: 'Leave Management' },
];
const TYPE_LABEL = Object.fromEntries(REVIEW_TYPES.map((t) => [t.value, t.label]));

const RATINGS = [
  { value: 1, code: 'DNM', label: 'Did Not Meet' },
  { value: 2, code: 'PME', label: 'Partially Met' },
  { value: 3, code: 'ME',  label: 'Met Expectations' },
  { value: 4, code: 'EE',  label: 'Exceeded' },
];
const RATING_LABEL = Object.fromEntries(RATINGS.map((r) => [r.value, `${r.code} · ${r.label}`]));

const STATUS_META = {
  DRAFT:            { label: 'Draft' },
  SUBMITTED:        { label: 'Published' },
  RATING_PUBLISHED: { label: 'Shared' },
  REVIEW_CLOSED:    { label: 'Closed' },
};

// Status filter chips.
const FILTERS = [
  { key: 'all',              label: 'All' },
  { key: 'DRAFT',            label: 'Drafts' },
  { key: 'RATING_PUBLISHED', label: 'Shared' },
  { key: 'REVIEW_CLOSED',    label: 'Closed' },
];

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function employeeName(rev) {
  const e = rev?.employeeId;
  if (e && typeof e === 'object') {
    const full = `${e.firstName || ''} ${e.lastName || ''}`.trim();
    return full || e.email || 'Employee';
  }
  return rev?.employeeName || 'Employee';
}

function memberName(m) {
  const full = `${m.firstName || ''} ${m.lastName || ''}`.trim();
  return full || m.email || 'Employee';
}

const ManagerReviews = forwardRef(function ManagerReviews({ scope = 'team' }, ref) {
  const isOrg = scope === 'org';
  const [reviews, setReviews] = useState([]);
  const [members, setMembers] = useState([]);
  const [approvedObjectives, setApprovedObjectives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [actingId, setActingId] = useState(null);
  const [banner, setBanner] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // Let the parent (Objectives header) trigger the New-review form.
  useImperativeHandle(ref, () => ({
    openNew: () => { setEditing(null); setFormOpen(true); },
  }), []);

  async function fetchReviews() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/reviews');
      const list = data?.data || (Array.isArray(data) ? data : []);
      setReviews(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function fetchPickers() {
    // Employees the manager may review. Team scope → direct reports;
    // org/admin scope → everyone. Failures degrade to an empty picker.
    try {
      const url = isOrg
        ? '/employees?includeAdmins=true'
        : '/manager/team/members?includeIndirect=false';
      const { data } = await api.get(url);
      const list = data?.data || data?.employees || (Array.isArray(data) ? data : []);
      setMembers(Array.isArray(list) ? list : []);
    } catch {
      setMembers([]);
    }
    // Approved objectives available to link into a review.
    try {
      const { data } = await api.get('/goals/team-objectives?approvalStatus=approved');
      const list = data?.data || (Array.isArray(data) ? data : []);
      setApprovedObjectives(Array.isArray(list) ? list : []);
    } catch {
      setApprovedObjectives([]);
    }
  }

  useEffect(() => {
    fetchReviews();
    fetchPickers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 2800);
  }

  async function saveReview(payload) {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/reviews/${editing._id}`, payload);
        flash('success', 'Review updated');
      } else {
        await api.post('/reviews', payload);
        flash('success', 'Review created as draft');
      }
      setFormOpen(false);
      setEditing(null);
      await fetchReviews();
    } catch (err) {
      // Surface the error inside the form so the manager can fix it.
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function publishReview(rev) {
    if (!window.confirm('Publish this review? The employee will be notified and can see their rating and feedback.')) return;
    setActingId(rev._id);
    try {
      await api.post(`/reviews/${rev._id}/publish`);
      setReviews((prev) => prev.map((r) => (r._id === rev._id ? { ...r, status: 'RATING_PUBLISHED' } : r)));
      flash('success', 'Review shared with employee');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  async function closeReview(rev) {
    if (!window.confirm('Close this review? It becomes read-only for both of you.')) return;
    setActingId(rev._id);
    try {
      await api.post(`/reviews/${rev._id}/close`);
      setReviews((prev) => prev.map((r) => (r._id === rev._id ? { ...r, status: 'REVIEW_CLOSED' } : r)));
      flash('success', 'Review closed');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (typeFilter !== 'all' && r.reviewType !== typeFilter) return false;
      return true;
    });
  }, [reviews, filter, typeFilter]);

  const counts = useMemo(() => ({
    all: reviews.length,
    DRAFT: reviews.filter((r) => r.status === 'DRAFT').length,
    RATING_PUBLISHED: reviews.filter((r) => r.status === 'RATING_PUBLISHED').length,
    REVIEW_CLOSED: reviews.filter((r) => r.status === 'REVIEW_CLOSED').length,
  }), [reviews]);

  return (
    <div className="rv-wrap">
      <style>{styles}</style>

      <div className="rv-chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`rv-chip ${filter === f.key ? 'is-active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label} · {counts[f.key]}
          </button>
        ))}
      </div>

      <div className="rv-typefilter">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All review types</option>
          {REVIEW_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {banner && (
        <div className={`rv-banner ${banner.kind === 'success' ? 'is-success' : 'is-error'}`}>
          {banner.text}
        </div>
      )}

      {loading ? (
        <div>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="rv-skel" />)}</div>
      ) : error ? (
        <div className="rv-error">
          <p className="rv-error-title">Couldn't load reviews</p>
          <p className="rv-error-sub">{error}</p>
          <button className="rv-retry" onClick={fetchReviews}>Try again</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rv-empty">
          <p className="rv-empty-title">No reviews {filter !== 'all' || typeFilter !== 'all' ? 'match' : 'yet'}</p>
          <p className="rv-empty-sub">
            {reviews.length === 0
              ? (isOrg
                  ? 'Start a performance review for any employee.'
                  : 'Start a performance review for one of your team members.')
              : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        filtered.map((rev) => (
          <ReviewCard
            key={rev._id}
            rev={rev}
            acting={actingId === rev._id}
            onEdit={() => { setEditing(rev); setFormOpen(true); }}
            onPublish={() => publishReview(rev)}
            onClose={() => closeReview(rev)}
          />
        ))
      )}

      {formOpen && (
        <ReviewFormModal
          initial={editing}
          members={members}
          approvedObjectives={approvedObjectives}
          saving={saving}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSave={saveReview}
        />
      )}
    </div>
  );
});

export default ManagerReviews;

function ReviewCard({ rev, acting, onEdit, onPublish, onClose }) {
  const status = rev.status || 'DRAFT';
  const rating = rev.managerFeedback?.rating;
  const linkedCount = Array.isArray(rev.linkedObjectiveIds) ? rev.linkedObjectiveIds.length : 0;

  return (
    <div className="rv-card">
      <div className="rv-card-top">
        <div className="rv-card-headings">
          <div className="rv-card-name">{employeeName(rev)}</div>
          <div className="rv-card-type">{TYPE_LABEL[rev.reviewType] || rev.reviewType || 'Review'}</div>
        </div>
        <span className={`rv-pill st-${status}`}>{STATUS_META[status]?.label || status}</span>
      </div>

      {(rev.reviewPeriodStart || rev.discussionDate) && (
        <div className="rv-meta">
          {rev.reviewPeriodStart && (
            <span className="rv-meta-chip">
              <strong>Period:</strong>{fmt(rev.reviewPeriodStart)}{rev.reviewPeriodEnd ? ` – ${fmt(rev.reviewPeriodEnd)}` : ''}
            </span>
          )}
          {rev.discussionDate && (
            <span className="rv-meta-chip"><strong>1:1:</strong>{fmt(rev.discussionDate)}</span>
          )}
        </div>
      )}

      <div className={`rv-rating ${rating ? '' : 'none'}`}>
        {rating ? RATING_LABEL[Number(rating)] || `Rating ${rating}` : 'Not rated'}
      </div>

      {rev.managerFeedback?.feedback && (
        <div className="rv-block">
          <p className="rv-block-label">Feedback</p>
          <p className="rv-block-text">{rev.managerFeedback.feedback}</p>
        </div>
      )}

      {rev.managerFeedback?.areasForImprovement && (
        <div className="rv-block">
          <p className="rv-block-label">Areas for Improvement</p>
          <p className="rv-block-text">{rev.managerFeedback.areasForImprovement}</p>
        </div>
      )}

      {linkedCount > 0 && (
        <div className="rv-linked">
          {linkedCount} linked objective{linkedCount !== 1 ? 's' : ''}
        </div>
      )}

      {rev.employeeComment?.comment && (
        <div className="rv-comment">
          <p className="rv-block-label">Employee comment</p>
          <p className="rv-block-text">{rev.employeeComment.comment}</p>
        </div>
      )}

      {status === 'DRAFT' && (
        <div className="rv-actions">
          <button className="rv-btn rv-btn-ghost" onClick={onEdit} disabled={acting}>Edit</button>
          <button className="rv-btn rv-btn-primary" onClick={onPublish} disabled={acting}>
            {acting ? <span className="rv-mini-spin" /> : null}
            Publish
          </button>
        </div>
      )}
      {status === 'RATING_PUBLISHED' && (
        <div className="rv-actions">
          <button className="rv-btn rv-btn-purple" onClick={onClose} disabled={acting}>
            {acting ? <span className="rv-mini-spin" /> : null}
            Close review
          </button>
        </div>
      )}
    </div>
  );
}

const emptyForm = () => ({
  employeeId: '',
  reviewType: 'ANNUAL',
  reviewPeriodStart: '',
  reviewPeriodEnd: '',
  discussionDate: '',
  linkedObjectiveIds: [],
  rating: '',
  feedback: '',
  areasForImprovement: '',
});

function ReviewFormModal({ initial, members, approvedObjectives, saving, onClose, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (initial) {
      setForm({
        employeeId: initial.employeeId?._id || initial.employeeId || '',
        reviewType: initial.reviewType || 'ANNUAL',
        reviewPeriodStart: initial.reviewPeriodStart ? String(initial.reviewPeriodStart).slice(0, 10) : '',
        reviewPeriodEnd: initial.reviewPeriodEnd ? String(initial.reviewPeriodEnd).slice(0, 10) : '',
        discussionDate: initial.discussionDate ? String(initial.discussionDate).slice(0, 10) : '',
        linkedObjectiveIds: (initial.linkedObjectiveIds || []).map((o) => o?._id || o).filter(Boolean),
        rating: initial.managerFeedback?.rating || '',
        feedback: initial.managerFeedback?.feedback || '',
        areasForImprovement: initial.managerFeedback?.areasForImprovement || '',
      });
    } else {
      setForm(emptyForm());
    }
    setErr('');
  }, [initial]);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const changeEmployee = (id) => {
    // Reset linked objectives when the employee changes — they belong to a person.
    setForm((prev) => ({ ...prev, employeeId: id, linkedObjectiveIds: [] }));
  };

  const toggleObjective = (id) => {
    setForm((prev) => {
      const linked = prev.linkedObjectiveIds || [];
      return {
        ...prev,
        linkedObjectiveIds: linked.includes(id) ? linked.filter((x) => x !== id) : [...linked, id],
      };
    });
  };

  // Approved objectives belonging to the selected employee.
  const objectivesForEmployee = useMemo(() => {
    if (!form.employeeId) return [];
    return approvedObjectives.filter(
      (o) => String(o.userId?._id || o.userId || '') === String(form.employeeId)
        && o.approvalStatus === 'approved',
    );
  }, [approvedObjectives, form.employeeId]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!form.employeeId) { setErr('Please select an employee.'); return; }
    if (!form.reviewType) { setErr('Please select a review type.'); return; }

    const payload = {
      employeeId: form.employeeId,
      reviewType: form.reviewType,
      reviewPeriodStart: form.reviewPeriodStart || undefined,
      reviewPeriodEnd: form.reviewPeriodEnd || undefined,
      discussionDate: form.discussionDate || undefined,
      linkedObjectiveIds: form.linkedObjectiveIds,
      managerFeedback: {
        rating: form.rating !== '' ? Number(form.rating) : null,
        feedback: form.feedback.trim() || null,
        areasForImprovement: form.areasForImprovement.trim() || null,
      },
    };

    try {
      await onSave(payload);
    } catch (e2) {
      setErr(getErrorMessage(e2));
    }
  }

  return createPortal(
    <div className="rv-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rv-modal">
        <div className="rv-modal-head">
          <h3 className="rv-modal-title">{initial ? 'Edit Review' : 'New Performance Review'}</h3>
          <button type="button" className="rv-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form onSubmit={submit}>
          {err && <div className="rv-form-error">{err}</div>}

          <div className="rv-field">
            <label className="rv-label">Employee <span className="req">*</span></label>
            <select
              className="rv-select"
              value={form.employeeId}
              onChange={(e) => changeEmployee(e.target.value)}
              disabled={!!initial}
            >
              <option value="">Select employee…</option>
              {members.map((m) => (
                <option key={m._id} value={m._id}>
                  {memberName(m)}{m.employeeId ? ` (${m.employeeId})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="rv-field">
            <label className="rv-label">Review Type <span className="req">*</span></label>
            <select
              className="rv-select"
              value={form.reviewType}
              onChange={(e) => set('reviewType', e.target.value)}
            >
              {REVIEW_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="rv-field">
            <label className="rv-label">Review Period</label>
            <div className="rv-dates">
              <input type="date" className="rv-input" value={form.reviewPeriodStart}
                onChange={(e) => set('reviewPeriodStart', e.target.value)} />
              <input type="date" className="rv-input" value={form.reviewPeriodEnd}
                onChange={(e) => set('reviewPeriodEnd', e.target.value)} />
            </div>
          </div>

          <div className="rv-field">
            <label className="rv-label">Discussion Date</label>
            <input type="date" className="rv-input" value={form.discussionDate}
              onChange={(e) => set('discussionDate', e.target.value)} />
          </div>

          {form.employeeId && (
            <div className="rv-field">
              <label className="rv-label">Link Approved Objectives</label>
              {objectivesForEmployee.length === 0 ? (
                <p className="rv-hint">No approved objectives for this employee.</p>
              ) : (
                <div className="rv-objlist">
                  {objectivesForEmployee.map((o) => {
                    const on = form.linkedObjectiveIds.includes(o._id);
                    return (
                      <label key={o._id} className={`rv-objrow ${on ? 'is-on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => toggleObjective(o._id)} />
                        <span className="rv-objrow-body">
                          <span className="rv-objrow-title">{o.title || 'Untitled objective'}</span>
                          {o.category && <span className="rv-objrow-cat">{o.category}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="rv-field">
            <label className="rv-label">Overall Rating</label>
            <div className="rv-ratings">
              {RATINGS.map((r) => {
                const on = Number(form.rating) === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    className={`rv-ratebtn ${on ? 'is-on' : ''}`}
                    onClick={() => set('rating', on ? '' : r.value)}
                  >
                    <span className="rv-ratebtn-code">{r.value} · {r.code}</span>
                    <span className="rv-ratebtn-label">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rv-field">
            <label className="rv-label">Overall Feedback</label>
            <textarea
              className="rv-textarea"
              value={form.feedback}
              onChange={(e) => set('feedback', e.target.value)}
              placeholder="Provide overall performance feedback…"
              rows={4}
            />
          </div>

          <div className="rv-field">
            <label className="rv-label">Areas for Improvement</label>
            <textarea
              className="rv-textarea"
              value={form.areasForImprovement}
              onChange={(e) => set('areasForImprovement', e.target.value)}
              placeholder="Note areas where the employee can improve…"
              rows={3}
            />
          </div>

          <div className="rv-modal-actions">
            <button type="button" className="rv-btn rv-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="rv-btn rv-btn-primary" disabled={saving}>
              {saving ? <span className="rv-mini-spin" /> : null}
              {initial ? 'Save Changes' : 'Create Review'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
