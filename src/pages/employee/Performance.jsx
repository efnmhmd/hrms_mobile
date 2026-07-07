import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { useHeaderAction } from '../../components/headerAction';
import DateField from '../../components/DateField';

// Mirrors web Performance/PerformanceTab.js. Endpoints (mobile api baseURL
// already includes /api):
//   GET    /goals/my            -> my objectives
//   POST   /goals               -> create (goes to manager for approval)
//   PUT    /goals/:id           -> edit (only while not approved)
//   DELETE /goals/:id           -> delete (only while not approved)
//   POST   /goals/:id/input     -> { text } add a contribution
//   GET    /reviews/my          -> my performance reviews
//   POST   /reviews/:id/comment -> { comment } acknowledge a published review

const styles = `
  @keyframes pf-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pf-skel   { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes pf-spin   { to { transform: rotate(360deg); } }
  @keyframes pf-slide  { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes pf-fadein { from { opacity: 0; } to { opacity: 1; } }

  .pf-wrap { padding: 0.85rem 1rem 6rem; }
  .pf-anim { animation: pf-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header ── */
  .pf-header { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.25rem 0.85rem; }
  .pf-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18); flex-shrink: 0;
  }
  .pf-header-text { min-width: 0; flex: 1; }
  .pf-header-eyebrow { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .pf-header-title {
    font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1;
    font-weight: 400; color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0;
  }

  /* ── Tabs ── */
  .pf-tabs { display: flex; gap: 0.35rem; background: #fff; border: 1px solid rgba(212,221,214,0.7);
    border-radius: 14px; padding: 0.3rem; margin-bottom: 0.85rem; box-shadow: 0 1px 2px rgba(47,62,70,0.04); }
  .pf-tab {
    flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem;
    padding: 0.5rem 0.3rem; border-radius: 10px; border: none; background: none;
    font-size: 0.74rem; font-weight: 600; color: #7a8e84; cursor: pointer;
    -webkit-tap-highlight-color: transparent; transition: background 0.15s, color 0.15s;
  }
  .pf-tab.is-active { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #f0f5f2; }
  .pf-tab-badge {
    min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
    font-size: 0.6rem; font-weight: 700; line-height: 16px;
    background: rgba(132,169,140,0.22); color: #354f52;
  }
  .pf-tab.is-active .pf-tab-badge { background: rgba(202,210,197,0.25); color: #f0f5f2; }

  /* ── Card ── */
  .pf-card {
    padding: 0.85rem 0.95rem; border-radius: 16px; background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.55rem;
  }
  .pf-card-top { display: flex; align-items: flex-start; gap: 0.6rem; }
  .pf-card-title { font-size: 0.92rem; font-weight: 600; color: #2f3e46; line-height: 1.25; min-width: 0; flex: 1; }
  .pf-card-cat { margin-top: 2px; font-size: 0.7rem; color: #52796f; font-weight: 500; }
  .pf-pills { display: flex; flex-wrap: wrap; gap: 0.3rem; justify-content: flex-end; flex-shrink: 0; }
  .pf-pill { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
  .pf-pill.approved   { background: rgba(82,121,111,0.2);  color: #2f4a45; }
  .pf-pill.pending    { background: rgba(196,156,74,0.18); color: #7a5a16; }
  .pf-pill.sent_back  { background: rgba(192,117,106,0.16); color: #8a352b; }
  .pf-pill.todo       { background: #eef2ef; color: #5c6b63; }
  .pf-pill.in_progress{ background: rgba(82,121,111,0.14); color: #2f4a45; }
  .pf-pill.achieved   { background: rgba(76,140,82,0.16); color: #2f6e34; }
  .pf-pill.overdue    { background: rgba(192,117,106,0.16); color: #8a352b; }

  .pf-desc { margin: 0.6rem 0 0; font-size: 0.8rem; color: #5c6b63; line-height: 1.45;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

  .pf-feedback {
    margin-top: 0.6rem; padding: 0.55rem 0.7rem; border-radius: 10px;
    background: rgba(192,117,106,0.08); border-left: 2px solid rgba(192,117,106,0.5);
  }
  .pf-feedback-label { font-size: 0.55rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #b85c50; }
  .pf-feedback-text { margin-top: 2px; font-size: 0.76rem; color: #7a3028; line-height: 1.4; }

  .pf-progress-row { margin-top: 0.7rem; }
  .pf-progress-top { display: flex; justify-content: space-between; font-size: 0.66rem; color: #84a98c; margin-bottom: 4px; font-weight: 600; letter-spacing: 0.04em; }
  .pf-bar { height: 7px; border-radius: 999px; background: #eef2ef; overflow: hidden; }
  .pf-bar-fill { height: 100%; border-radius: 999px; transition: width 0.5s cubic-bezier(0.22,1,0.36,1); }
  .pf-bar-fill.lo { background: linear-gradient(90deg, #c49c4a, #d8b86a); }
  .pf-bar-fill.mid{ background: linear-gradient(90deg, #52796f, #84a98c); }
  .pf-bar-fill.hi { background: linear-gradient(90deg, #4c8c52, #84a98c); }

  .pf-dates { margin-top: 0.6rem; display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .pf-date-chip { display: inline-flex; align-items: center; gap: 0.3rem; background: #f1f4f0;
    border-radius: 999px; padding: 2px 8px; font-size: 0.68rem; color: #7a8e84; font-weight: 500; }
  .pf-date-chip strong { color: #354f52; font-weight: 600; }

  .pf-actions { display: flex; gap: 0.4rem; margin-top: 0.7rem; flex-wrap: wrap; }
  .pf-btn {
    padding: 0.5rem 0.85rem; border-radius: 10px; font-size: 0.76rem; font-weight: 600;
    border: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
    display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; transition: transform 0.12s;
  }
  .pf-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .pf-btn:not(:disabled):active { transform: scale(0.97); }
  .pf-btn.primary { flex: 1; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; box-shadow: 0 3px 10px rgba(53,79,82,0.2); }
  .pf-btn.ghost { background: #fff; color: #52796f; border: 1.5px solid #d4ddd6; }
  .pf-btn.danger { background: #fff; color: #b85c50; border: 1.5px solid rgba(192,117,106,0.4); }
  .pf-btn.danger-solid { flex: 1; background: linear-gradient(135deg, #b85c50 0%, #a04234 100%); color: #fdecea; box-shadow: 0 3px 10px rgba(160,66,52,0.24); }

  .pf-confirm-glyph {
    width: 46px; height: 46px; margin: 0.2rem auto 0.7rem; border-radius: 14px;
    background: rgba(192,117,106,0.14); color: #b85c50;
    display: flex; align-items: center; justify-content: center;
  }

  /* ── Contributions list ── */
  .pf-contrib-head { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #84a98c; margin: 0.7rem 0 0.35rem; }
  .pf-contrib { background: #f6f8f5; border-radius: 9px; padding: 0.4rem 0.6rem; font-size: 0.74rem; color: #44544c; margin-bottom: 0.3rem; line-height: 1.4; }
  .pf-contrib-date { color: #9aa89f; margin-right: 0.35rem; }

  /* ── Review feedback blocks ── */
  .pf-review-period { font-size: 0.7rem; color: #84a98c; margin-top: 2px; }
  .pf-block { margin-top: 0.7rem; }
  .pf-block-label { font-size: 0.58rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #84a98c; margin-bottom: 3px; }
  .pf-block-text { font-size: 0.82rem; color: #44544c; line-height: 1.5; }
  .pf-rating { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.62rem; font-weight: 700;
    padding: 2px 9px; border-radius: 999px; background: rgba(76,140,82,0.14); color: #2f6e34; white-space: nowrap; }
  .pf-rating.none { background: #eef2ef; color: #9aa89f; }
  .pf-own-comment { margin-top: 0.7rem; background: #f6f8f5; border-radius: 10px; padding: 0.55rem 0.7rem; }

  /* ── Textarea (inline + sheet) ── */
  .pf-textarea {
    width: 100%; padding: 0.65rem 0.75rem; border: 1.5px solid #d4ddd6; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 0.9rem; color: #2f3e46; background: #fff;
    outline: none; resize: vertical; min-height: 80px; box-sizing: border-box;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .pf-textarea:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }

  /* ── States ── */
  .pf-skel { height: 120px; border-radius: 16px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: pf-skel 1.2s ease-in-out infinite; margin-bottom: 0.55rem; }
  .pf-empty, .pf-error {
    padding: 2rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .pf-error { border-color: rgba(192, 117, 106, 0.4); color: #7a3028;
    background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55); }
  .pf-empty-glyph { width: 44px; height: 44px; margin: 0 auto 0.65rem; border-radius: 13px; background: rgba(132, 169, 140, 0.14);
    display: flex; align-items: center; justify-content: center; color: #52796f; }
  .pf-empty-title, .pf-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .pf-empty-sub, .pf-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; line-height: 1.45; }
  .pf-retry { margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .pf-retry:active { transform: scale(0.97); }

  .pf-callout { margin-bottom: 0.85rem; padding: 0.7rem 0.85rem; border-radius: 12px;
    background: linear-gradient(135deg, rgba(253,243,242,0.7), #fff); border: 1px solid rgba(192,117,106,0.3); }
  .pf-callout-title { font-size: 0.78rem; font-weight: 700; color: #8a352b; margin: 0; }
  .pf-callout-sub { font-size: 0.72rem; color: #a05246; margin: 0.2rem 0 0; }

  .pf-banner { margin-bottom: 0.85rem; padding: 0.6rem 0.85rem; border-radius: 12px; font-size: 0.78rem; font-weight: 500; }
  .pf-banner.is-success { background: linear-gradient(135deg, #f0f5f2, #eaf2ec); border-left: 3px solid #52796f; color: #2f3e46; }
  .pf-banner.is-error { background: linear-gradient(135deg, #fdf3f2, #fdecea); border-left: 3px solid #c0756a; color: #7a3028; }

  .pf-mini-spin { width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent;
    border-radius: 50%; animation: pf-spin 0.7s linear infinite; }

  /* ── Bottom sheet ── */
  .pf-overlay { position: fixed; inset: 0; background: rgba(47, 62, 70, 0.42); z-index: 50;
    animation: pf-fadein 0.18s ease both; display: flex; flex-direction: column; justify-content: flex-end; }
  .pf-sheet { background: #fff; border-radius: 18px 18px 0 0; max-height: 92vh; overflow-y: auto;
    box-shadow: 0 -8px 24px rgba(47, 62, 70, 0.18); animation: pf-slide 0.25s cubic-bezier(0.22,1,0.36,1) both;
    padding: 0.85rem 1rem calc(1.1rem + env(safe-area-inset-bottom, 0px)); }
  .pf-sheet-grip { width: 38px; height: 4px; border-radius: 999px; background: rgba(132, 169, 140, 0.4); margin: 0 auto 0.7rem; }
  .pf-sheet-title { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; font-weight: 500; color: #2f3e46; margin: 0 0 0.1rem; }
  .pf-sheet-sub { font-size: 0.72rem; color: #84a98c; margin: 0 0 0.9rem; letter-spacing: 0.02em; }
  .pf-field { margin-bottom: 0.7rem; }
  .pf-field.is-double { display: flex; gap: 0.5rem; }
  .pf-field.is-double > div { flex: 1; min-width: 0; }
  .pf-label { display: block; font-size: 0.6rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #84a98c; margin: 0 0 4px; }
  .pf-input {
    width: 100%; padding: 0.65rem 0.75rem; border: 1.5px solid #d4ddd6; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 0.9rem; color: #2f3e46; background: #fff; outline: none;
    -webkit-appearance: none; appearance: none; box-sizing: border-box; transition: border-color 0.18s, box-shadow 0.18s;
  }
  .pf-input:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }
  .pf-cats { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .pf-cat { border: 1px solid #d4ddd6; background: #fff; color: #52796f; border-radius: 999px;
    padding: 0.35rem 0.7rem; font-size: 0.72rem; font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, border-color 0.15s, color 0.15s; }
  .pf-cat.is-on { background: #52796f; border-color: #52796f; color: #fff; }
  .pf-range { width: 100%; accent-color: #52796f; }
  .pf-sheet-actions { display: flex; gap: 0.5rem; margin-top: 0.6rem; }
  .pf-sheet-err { font-size: 0.78rem; color: #7a3028; background: #fdecea; border: 1px solid rgba(192,117,106,0.3);
    border-radius: 10px; padding: 0.5rem 0.7rem; margin-bottom: 0.7rem; }
`;

const CATEGORIES = ['Business Contributor', 'Value Creation', 'Self / People Development', 'Other'];

const APPROVAL = {
  pending:   'Awaiting Approval',
  approved:  'Approved',
  sent_back: 'Sent Back',
};
const STATUS = {
  TO_DO:       { label: 'To Do',       cls: 'todo' },
  IN_PROGRESS: { label: 'In Progress', cls: 'in_progress' },
  ACHIEVED:    { label: 'Achieved',    cls: 'achieved' },
  OVERDUE:     { label: 'Overdue',     cls: 'overdue' },
};
const RATING = {
  1: '1 · Did Not Meet',
  2: '2 · Partially Met',
  3: '3 · Met Expectations',
  4: '4 · Exceeded',
};
const REVIEW_STATUS = {
  DRAFT:            'Draft',
  SUBMITTED:        'Published',
  RATING_PUBLISHED: 'Rating Shared',
  REVIEW_CLOSED:    'Closed',
};

function fmt(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TABS = [
  { id: 'objectives', label: 'Objectives' },
  { id: 'input',      label: 'Input' },
  { id: 'reviews',    label: 'Reviews' },
];

export default function Performance() {
  const [tab, setTab] = useState('objectives');
  const [goals, setGoals] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [banner, setBanner] = useState(null);
  const [actingId, setActingId] = useState(null);

  // Modals / inline editors
  const [objSheet, setObjSheet] = useState(null);      // { initial } | null
  const [inputSheet, setInputSheet] = useState(null);  // objective | null
  const [confirmDelete, setConfirmDelete] = useState(null); // objective | null
  const [commentFor, setCommentFor] = useState(null);  // review id
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 2800);
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [goalRes, reviewRes] = await Promise.all([
        api.get('/goals/my').catch((e) => { if (e?.response?.status === 404) return null; throw e; }),
        api.get('/reviews/my').catch((e) => { if (e?.response?.status === 404) return null; return null; }),
      ]);
      setGoals(goalRes?.data?.data || goalRes?.data?.goals || []);
      const rData = reviewRes?.data?.data || reviewRes?.data;
      setReviews(Array.isArray(rData) ? rData : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function saveObjective(payload, id) {
    setSaving(true);
    try {
      if (id) {
        await api.put(`/goals/${id}`, payload);
        flash('success', 'Objective updated');
      } else {
        await api.post('/goals', payload);
        flash('success', 'Objective sent for approval');
      }
      setObjSheet(null);
      await loadAll();
    } catch (err) {
      throw new Error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Native window.confirm is unreliable in installed/standalone webviews and
  // can be permanently silenced by Safari's "Don't show more alerts" — where
  // it returns false and the delete silently no-ops. Confirmation is handled
  // by an in-app sheet (ConfirmDeleteSheet) instead; this just does the delete.
  async function deleteObjective(obj) {
    if (!obj?._id) return;
    setActingId(obj._id);
    try {
      await api.delete(`/goals/${obj._id}`);
      setGoals((prev) => prev.filter((g) => g._id !== obj._id));
      setConfirmDelete(null);
      flash('success', 'Objective deleted');
    } catch (err) {
      setConfirmDelete(null);
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  async function submitInput(text) {
    if (!inputSheet) return;
    setSaving(true);
    try {
      await api.post(`/goals/${inputSheet._id}/input`, { text });
      flash('success', 'Contribution submitted');
      setInputSheet(null);
      await loadAll();
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitComment(reviewId) {
    const text = commentText.trim();
    if (!text) return;
    setSaving(true);
    try {
      await api.post(`/reviews/${reviewId}/comment`, { comment: text });
      flash('success', 'Comment added');
      setCommentFor(null);
      setCommentText('');
      await loadAll();
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const approvedGoals = useMemo(() => goals.filter((g) => g.approvalStatus === 'approved'), [goals]);
  const sentBackGoals = useMemo(() => goals.filter((g) => g.approvalStatus === 'sent_back'), [goals]);
  const pendingGoals  = useMemo(() => goals.filter((g) => g.approvalStatus === 'pending'), [goals]);
  const publishedReviews = useMemo(
    () => reviews.filter((r) => ['RATING_PUBLISHED', 'REVIEW_CLOSED'].includes(r.status)),
    [reviews],
  );

  const counts = {
    objectives: goals.length,
    input: approvedGoals.length,
    reviews: publishedReviews.length,
  };

  // Surface "New objective" in the global top bar (next to the refresh button)
  // while the Objectives tab is showing and the page is ready.
  useHeaderAction(
    !loading && !error && tab === 'objectives'
      ? { label: 'New', ariaLabel: 'New objective', onClick: () => setObjSheet({ initial: null }) }
      : null,
  );

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
            <p className="pf-header-eyebrow">Development</p>
            <h1 className="pf-header-title">Performance</h1>
          </div>
        </header>

        <div className="pf-tabs pf-anim">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`pf-tab ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {counts[t.id] > 0 && <span className="pf-tab-badge">{counts[t.id]}</span>}
            </button>
          ))}
        </div>

        {banner && (
          <div className={`pf-banner ${banner.kind === 'success' ? 'is-success' : 'is-error'} pf-anim`}>
            {banner.text}
          </div>
        )}

        {loading ? (
          <div>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="pf-skel" />)}</div>
        ) : error ? (
          <div className="pf-error pf-anim">
            <p className="pf-error-title">Couldn't load performance data</p>
            <p className="pf-error-sub">{error}</p>
            <button className="pf-retry" onClick={loadAll}>Try again</button>
          </div>
        ) : tab === 'objectives' ? (
          <ObjectivesTab
            goals={goals}
            sentBackCount={sentBackGoals.length}
            approvedCount={approvedGoals.length}
            pendingCount={pendingGoals.length}
            actingId={actingId}
            onAdd={() => setObjSheet({ initial: null })}
            onEdit={(obj) => setObjSheet({ initial: obj })}
            onDelete={(obj) => setConfirmDelete(obj)}
            onAddInput={(obj) => setInputSheet(obj)}
          />
        ) : tab === 'input' ? (
          <InputTab goals={approvedGoals} onAddInput={(obj) => setInputSheet(obj)} />
        ) : (
          <ReviewsTab
            reviews={publishedReviews}
            commentFor={commentFor}
            commentText={commentText}
            saving={saving}
            onStartComment={(id) => { setCommentFor(id); setCommentText(''); }}
            onChangeComment={setCommentText}
            onCancelComment={() => { setCommentFor(null); setCommentText(''); }}
            onSubmitComment={submitComment}
          />
        )}
      </div>

      {objSheet && (
        <ObjectiveSheet
          initial={objSheet.initial}
          saving={saving}
          onClose={() => setObjSheet(null)}
          onSave={saveObjective}
        />
      )}
      {inputSheet && (
        <InputSheet
          objective={inputSheet}
          saving={saving}
          onClose={() => setInputSheet(null)}
          onSubmit={submitInput}
        />
      )}
      {confirmDelete && (
        <ConfirmDeleteSheet
          objective={confirmDelete}
          deleting={actingId === confirmDelete._id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteObjective(confirmDelete)}
        />
      )}
    </>
  );
}

/* ── Objectives tab ─────────────────────────────────────────── */

function ObjectivesTab({ goals, sentBackCount, approvedCount, pendingCount, actingId, onAdd, onEdit, onDelete, onAddInput }) {
  if (goals.length === 0) {
    return (
      <div className="pf-empty pf-anim">
        <div className="pf-empty-glyph">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" />
          </svg>
        </div>
        <p className="pf-empty-title">No objectives yet</p>
        <p className="pf-empty-sub">Set an objective — it’s sent to your manager for approval.</p>
        <button className="pf-retry" onClick={onAdd}>+ Add objective</button>
      </div>
    );
  }
  return (
    <>
      {sentBackCount > 0 && (
        <div className="pf-callout pf-anim">
          <p className="pf-callout-title">{sentBackCount} objective{sentBackCount !== 1 ? 's' : ''} sent back</p>
          <p className="pf-callout-sub">Review manager feedback, edit, and re-submit.</p>
        </div>
      )}
      <p className="pf-empty-sub pf-anim" style={{ textAlign: 'left', margin: '0 0.25rem 0.7rem', color: '#7a8e84' }}>
        {approvedCount} approved · {pendingCount} pending · {sentBackCount} sent back
      </p>
      {goals.map((obj) => (
        <ObjectiveCard
          key={obj._id}
          obj={obj}
          acting={actingId === obj._id}
          onEdit={() => onEdit(obj)}
          onDelete={() => onDelete(obj)}
          onAddInput={() => onAddInput(obj)}
        />
      ))}
    </>
  );
}

function ProgressBlock({ value }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const tone = pct >= 100 ? 'hi' : pct >= 50 ? 'mid' : 'lo';
  return (
    <div className="pf-progress-row">
      <div className="pf-progress-top"><span>Progress</span><span>{pct}%</span></div>
      <div className="pf-bar"><div className={`pf-bar-fill ${tone}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function StatusPills({ obj }) {
  const st = STATUS[obj.status];
  return (
    <div className="pf-pills">
      <span className={`pf-pill ${obj.approvalStatus || 'pending'}`}>
        {APPROVAL[obj.approvalStatus] || obj.approvalStatus || 'Pending'}
      </span>
      {st && <span className={`pf-pill ${st.cls}`}>{st.label}</span>}
    </div>
  );
}

function ObjectiveCard({ obj, acting, onEdit, onDelete, onAddInput }) {
  const isApproved = obj.approvalStatus === 'approved';
  const progress = obj.progressPercent ?? obj.progress ?? 0;
  return (
    <div className="pf-card pf-anim">
      <div className="pf-card-top">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="pf-card-title">{obj.title}</div>
          {obj.category && <div className="pf-card-cat">{obj.category}</div>}
        </div>
        <StatusPills obj={obj} />
      </div>

      {obj.description && <p className="pf-desc">{obj.description}</p>}

      {obj.approvalStatus === 'sent_back' && (obj.sentBackReason || obj.rejectionReason) && (
        <div className="pf-feedback">
          <div className="pf-feedback-label">Manager feedback</div>
          <div className="pf-feedback-text">{obj.sentBackReason || obj.rejectionReason}</div>
        </div>
      )}

      <ProgressBlock value={progress} />

      {(obj.startDate || obj.endDate || obj.deadline) && (
        <div className="pf-dates">
          {obj.startDate && <span className="pf-date-chip"><strong>Start</strong>{fmt(obj.startDate)}</span>}
          <span className="pf-date-chip"><strong>Due</strong>{fmt(obj.endDate || obj.deadline)}</span>
        </div>
      )}

      <div className="pf-actions">
        {isApproved ? (
          <button className="pf-btn primary" onClick={onAddInput} disabled={acting}>+ Add contribution</button>
        ) : (
          <>
            <button className="pf-btn ghost" onClick={onEdit} disabled={acting}>Edit</button>
            <button className="pf-btn danger" onClick={onDelete} disabled={acting}>
              {acting ? <span className="pf-mini-spin" /> : 'Delete'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Submit Input tab ───────────────────────────────────────── */

function InputTab({ goals, onAddInput }) {
  if (goals.length === 0) {
    return (
      <div className="pf-empty pf-anim">
        <div className="pf-empty-glyph">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </div>
        <p className="pf-empty-title">No approved objectives</p>
        <p className="pf-empty-sub">Once your manager approves an objective, log your contributions here.</p>
      </div>
    );
  }
  return (
    <>
      <p className="pf-empty-sub pf-anim" style={{ textAlign: 'left', margin: '0 0.25rem 0.7rem', color: '#7a8e84', lineHeight: 1.45 }}>
        Log progress on your approved objectives. Your manager sees these when writing your review.
      </p>
      {goals.map((obj) => {
        const contributions = obj.employeeInput || [];
        const progress = obj.progressPercent ?? obj.progress ?? 0;
        return (
          <div key={obj._id} className="pf-card pf-anim">
            <div className="pf-card-top">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="pf-card-title">{obj.title}</div>
                {obj.category && <div className="pf-card-cat">{obj.category}</div>}
              </div>
              {STATUS[obj.status] && <span className={`pf-pill ${STATUS[obj.status].cls}`}>{STATUS[obj.status].label}</span>}
            </div>

            <ProgressBlock value={progress} />

            {contributions.length > 0 && (
              <>
                <div className="pf-contrib-head">Contributions ({contributions.length})</div>
                {contributions.map((c, i) => (
                  <div key={i} className="pf-contrib">
                    <span className="pf-contrib-date">{fmt(c.date || c.submittedAt)}:</span>
                    {c.contribution || c.text}
                  </div>
                ))}
              </>
            )}

            <div className="pf-actions">
              <button className="pf-btn primary" onClick={() => onAddInput(obj)}>+ Add contribution</button>
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ── Reviews tab ────────────────────────────────────────────── */

function ReviewsTab({ reviews, commentFor, commentText, saving, onStartComment, onChangeComment, onCancelComment, onSubmitComment }) {
  if (reviews.length === 0) {
    return (
      <div className="pf-empty pf-anim">
        <div className="pf-empty-glyph">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13l2 2 4-4" />
          </svg>
        </div>
        <p className="pf-empty-title">No published reviews</p>
        <p className="pf-empty-sub">Your manager will share a review here once it’s ready.</p>
      </div>
    );
  }
  return reviews.map((rev) => {
    const rating = rev.managerFeedback?.rating;
    const canComment = rev.status === 'RATING_PUBLISHED' && !rev.employeeComment?.comment;
    return (
      <div key={rev._id} className="pf-card pf-anim">
        <div className="pf-card-top">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="pf-card-title">{(rev.reviewType || 'Review').replace(/_/g, ' ')}</div>
            {rev.reviewPeriodStart && (
              <div className="pf-review-period">
                {fmt(rev.reviewPeriodStart)}{rev.reviewPeriodEnd ? ` – ${fmt(rev.reviewPeriodEnd)}` : ''}
              </div>
            )}
          </div>
          <div className="pf-pills">
            <span className="pf-pill achieved">{REVIEW_STATUS[rev.status] || rev.status}</span>
            <span className={`pf-rating ${rating ? '' : 'none'}`}>{rating ? RATING[Number(rating)] || `Rating ${rating}` : 'Not rated'}</span>
          </div>
        </div>

        {rev.managerFeedback?.feedback && (
          <div className="pf-block">
            <div className="pf-block-label">Feedback</div>
            <div className="pf-block-text">{rev.managerFeedback.feedback}</div>
          </div>
        )}
        {rev.managerFeedback?.areasForImprovement && (
          <div className="pf-block">
            <div className="pf-block-label">Areas for improvement</div>
            <div className="pf-block-text">{rev.managerFeedback.areasForImprovement}</div>
          </div>
        )}

        {rev.employeeComment?.comment ? (
          <div className="pf-own-comment">
            <div className="pf-block-label">Your comment</div>
            <div className="pf-block-text">{rev.employeeComment.comment}</div>
          </div>
        ) : canComment ? (
          commentFor === rev._id ? (
            <div className="pf-block">
              <textarea
                className="pf-textarea"
                rows={3}
                placeholder="Add your acknowledgement or comment…"
                value={commentText}
                onChange={(e) => onChangeComment(e.target.value)}
              />
              <div className="pf-sheet-actions">
                <button className="pf-btn ghost" onClick={onCancelComment} disabled={saving}>Cancel</button>
                <button className="pf-btn primary" onClick={() => onSubmitComment(rev._id)} disabled={!commentText.trim() || saving}>
                  {saving ? <span className="pf-mini-spin" /> : 'Submit'}
                </button>
              </div>
            </div>
          ) : (
            <div className="pf-actions">
              <button className="pf-btn ghost" onClick={() => onStartComment(rev._id)}>+ Add comment</button>
            </div>
          )
        ) : null}
      </div>
    );
  });
}

/* ── Objective create/edit sheet ────────────────────────────── */

function ObjectiveSheet({ initial, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    category: initial?.category && CATEGORIES.includes(initial.category) ? initial.category : (initial?.category ? 'Other' : 'Business Contributor'),
    customCat: initial?.category && !CATEGORIES.includes(initial.category) ? initial.category : '',
    startDate: initial?.startDate?.slice(0, 10) || '',
    endDate: initial?.endDate?.slice(0, 10) || initial?.deadline?.slice(0, 10) || '',
    progressPercent: initial?.progressPercent ?? initial?.progress ?? 0,
  });
  const [err, setErr] = useState('');
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!form.title.trim()) { setErr('Title is required'); return; }
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      setErr('Due date can’t be before the start date'); return;
    }
    const category = form.category === 'Other' && form.customCat.trim() ? form.customCat.trim() : form.category;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      category,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      progressPercent: Number(form.progressPercent) || 0,
    };
    try {
      await onSave(payload, initial?._id);
    } catch (e2) {
      setErr(e2.message || 'Failed to save');
    }
  }

  return createPortal(
    <div className="pf-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <form className="pf-sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="pf-sheet-grip" />
        <h2 className="pf-sheet-title">{initial ? 'Edit Objective' : 'New Objective'}</h2>
        <p className="pf-sheet-sub">{initial ? 'Update and re-submit for approval' : 'Submitted to your manager for approval'}</p>

        {err && <div className="pf-sheet-err">{err}</div>}

        <div className="pf-field">
          <label className="pf-label">Title</label>
          <input className="pf-input" value={form.title} onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Complete Q1 sales targets" />
        </div>

        <div className="pf-field">
          <label className="pf-label">Description</label>
          <textarea className="pf-textarea" rows={3} value={form.description}
            onChange={(e) => set('description', e.target.value)} placeholder="Add detail…" />
        </div>

        <div className="pf-field">
          <label className="pf-label">Category</label>
          <div className="pf-cats">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className={`pf-cat${form.category === c ? ' is-on' : ''}`} onClick={() => set('category', c)}>
                {c}
              </button>
            ))}
          </div>
          {form.category === 'Other' && (
            <input className="pf-input" style={{ marginTop: '0.5rem' }} value={form.customCat}
              onChange={(e) => set('customCat', e.target.value)} placeholder="Custom category…" />
          )}
        </div>

        <div className="pf-field is-double">
          <div>
            <label className="pf-label">Start date</label>
            <DateField value={form.startDate} onChange={(iso) => set('startDate', iso)} />
          </div>
          <div>
            <label className="pf-label">Due date</label>
            <DateField value={form.endDate} min={form.startDate || undefined}
              onChange={(iso) => set('endDate', iso)} />
          </div>
        </div>

        <div className="pf-field">
          <label className="pf-label">Progress · {form.progressPercent}%</label>
          <input type="range" className="pf-range" min={0} max={100} step={5} value={form.progressPercent}
            onChange={(e) => set('progressPercent', e.target.value)} />
        </div>

        <div className="pf-sheet-actions">
          <button type="button" className="pf-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="pf-btn primary" disabled={saving}>
            {saving ? <span className="pf-mini-spin" /> : (initial ? 'Save' : 'Create')}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/* ── Contribution input sheet ───────────────────────────────── */

function InputSheet({ objective, saving, onClose, onSubmit }) {
  const [text, setText] = useState('');
  const previous = objective?.employeeInput || [];
  return createPortal(
    <div className="pf-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pf-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="pf-sheet-grip" />
        <h2 className="pf-sheet-title">Add Contribution</h2>
        <p className="pf-sheet-sub">{objective?.title}</p>

        {previous.length > 0 && (
          <>
            <div className="pf-contrib-head">Previous ({previous.length})</div>
            {previous.map((c, i) => (
              <div key={i} className="pf-contrib">
                <span className="pf-contrib-date">{fmt(c.date || c.submittedAt)}:</span>
                {c.contribution || c.text}
              </div>
            ))}
          </>
        )}

        <div className="pf-field" style={{ marginTop: '0.7rem' }}>
          <label className="pf-label">What did you do?</label>
          <textarea className="pf-textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Describe your progress towards this objective…" />
        </div>

        <div className="pf-sheet-actions">
          <button type="button" className="pf-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="pf-btn primary" onClick={() => onSubmit(text.trim())} disabled={!text.trim() || saving}>
            {saving ? <span className="pf-mini-spin" /> : 'Submit'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Delete confirmation sheet ──────────────────────────────── */

function ConfirmDeleteSheet({ objective, deleting, onCancel, onConfirm }) {
  return createPortal(
    <div className="pf-overlay" onClick={deleting ? undefined : onCancel} role="dialog" aria-modal="true">
      <div className="pf-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="pf-sheet-grip" />
        <div className="pf-confirm-glyph">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
          </svg>
        </div>
        <h2 className="pf-sheet-title" style={{ textAlign: 'center' }}>Delete objective?</h2>
        <p className="pf-sheet-sub" style={{ textAlign: 'center' }}>
          “{objective?.title || 'This objective'}” will be permanently removed. This can’t be undone.
        </p>

        <div className="pf-sheet-actions">
          <button type="button" className="pf-btn ghost" onClick={onCancel} disabled={deleting}>Cancel</button>
          <button type="button" className="pf-btn danger-solid" onClick={onConfirm} disabled={deleting}>
            {deleting ? <span className="pf-mini-spin" /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
