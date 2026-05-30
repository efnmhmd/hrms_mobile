import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Employee's own expense claims.
//   GET  /expenses        → the signed-in user's claims (server scopes by token)
//   POST /expenses        → submit a new claim
// List + submit flow mirrors the leave-request pattern on the shared Calendar.
// Falls back across a couple of list endpoints if the primary 404s.

const LIST_ENDPOINTS = ['/expenses', '/expenses/my-requests', '/expenses/my'];

const CATEGORIES = ['Travel', 'Meals', 'Accommodation', 'Office Supplies', 'Software', 'Training', 'Other'];

const styles = `
  @keyframes ee-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ee-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes ee-spin { to { transform: rotate(360deg); } }
  @keyframes ee-sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes ee-fade { from { opacity: 0; } to { opacity: 1; } }

  .ee-wrap { padding: 0.85rem 1rem 6rem; }
  .ee-anim { animation: ee-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  .ee-header { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.25rem 0.85rem; }
  .ee-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18); flex-shrink: 0;
  }
  .ee-header-text { min-width: 0; flex: 1; }
  .ee-header-eyebrow { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .ee-header-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1; font-weight: 400; color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0; }
  .ee-count { font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem; }
  .ee-refresh {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .ee-refresh:disabled { opacity: 0.55; }
  .ee-refresh:not(:disabled):active { transform: scale(0.94); }
  .ee-refresh.is-busy svg { animation: ee-spin 0.8s linear infinite; }

  /* ── Summary ── */
  .ee-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; margin-bottom: 0.85rem; }
  .ee-sum { border: 1px solid rgba(212, 221, 214, 0.7); background: #fff; border-radius: 12px; padding: 0.6rem 0.5rem; box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04); }
  .ee-sum-lab { font-size: 0.55rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #84a98c; margin-bottom: 3px; }
  .ee-sum-val { font-size: 0.98rem; font-weight: 700; color: #2f3e46; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .ee-sum.is-pending .ee-sum-val { color: #b78f3a; }
  .ee-sum.is-approved .ee-sum-val { color: #354f52; }
  .ee-sum.is-rejected .ee-sum-val { color: #b85c50; }
  .ee-sum-sub { font-size: 0.58rem; color: #9aa8a0; margin-top: 2px; }

  /* ── New claim button ── */
  .ee-new {
    display: flex; align-items: center; justify-content: center; gap: 0.4rem; width: 100%;
    margin-bottom: 0.85rem; padding: 0.7rem; border-radius: 13px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #f0f5f2;
    font-family: 'DM Sans', sans-serif; font-size: 0.84rem; font-weight: 600; letter-spacing: 0.02em;
    cursor: pointer; -webkit-tap-highlight-color: transparent; box-shadow: 0 4px 14px rgba(53,79,82,0.2);
    transition: transform 0.12s;
  }
  .ee-new:active { transform: scale(0.98); }

  /* ── Chips ── */
  .ee-chips { display: flex; gap: 0.4rem; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 0.85rem; padding-bottom: 4px; }
  .ee-chips::-webkit-scrollbar { display: none; }
  .ee-chip {
    flex-shrink: 0; padding: 0.42rem 0.8rem; border-radius: 999px; font-size: 0.74rem; font-weight: 600; letter-spacing: 0.04em;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .ee-chip.is-active { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; border-color: transparent; }

  /* ── Cards ── */
  .ee-list { display: flex; flex-direction: column; gap: 0.45rem; }
  .ee-card { padding: 0.7rem 0.8rem; border-radius: 14px; background: #fff; border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04); border-left: 3px solid transparent; }
  .ee-card.is-pending { border-left-color: #d8a64c; }
  .ee-card.is-approved { border-left-color: #52796f; }
  .ee-card.is-rejected { border-left-color: #c0756a; }
  .ee-card-top { display: flex; align-items: flex-start; gap: 0.6rem; }
  .ee-card-main { min-width: 0; flex: 1; }
  .ee-card-cat { font-size: 0.86rem; font-weight: 600; color: #2f3e46; line-height: 1.2; text-transform: capitalize; }
  .ee-card-date { font-size: 0.68rem; color: #84a98c; margin-top: 2px; }
  .ee-card-right { text-align: right; flex-shrink: 0; }
  .ee-card-amt { font-size: 0.95rem; font-weight: 700; color: #2f3e46; font-variant-numeric: tabular-nums; }
  .ee-pill { display: inline-block; margin-top: 4px; font-size: 0.56rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 7px; border-radius: 999px; }
  .ee-pill.is-pending { background: rgba(216, 166, 76, 0.18); color: #7a591f; }
  .ee-pill.is-approved { background: rgba(82, 121, 111, 0.18); color: #354f52; }
  .ee-pill.is-rejected { background: rgba(192, 117, 106, 0.18); color: #7a3028; }
  .ee-card-desc { margin: 0.55rem 0 0; font-size: 0.78rem; color: #56655d; line-height: 1.45; }
  .ee-card-note { margin: 0.5rem 0 0; font-size: 0.72rem; color: #8a352b; background: rgba(192,117,106,0.08); border-radius: 9px; padding: 0.4rem 0.55rem; }

  /* ── States ── */
  .ee-skel { height: 78px; border-radius: 14px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%); animation: ee-skel 1.2s ease-in-out infinite; margin-bottom: 0.45rem; }
  .ee-empty, .ee-error {
    padding: 2rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .ee-error { border-color: rgba(192, 117, 106, 0.4); color: #7a3028; background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55); }
  .ee-empty-title, .ee-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .ee-empty-sub, .ee-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .ee-retry { margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .ee-retry:active { transform: scale(0.97); }

  /* ── Banner ── */
  .ee-banner { margin-bottom: 0.85rem; padding: 0.6rem 0.85rem; border-radius: 12px; font-size: 0.78rem; font-weight: 500; }
  .ee-banner.is-success { background: linear-gradient(135deg, #f0f5f2, #eaf2ec); border-left: 3px solid #52796f; color: #2f3e46; }
  .ee-banner.is-error { background: linear-gradient(135deg, #fdf3f2, #fdecea); border-left: 3px solid #c0756a; color: #7a3028; }

  /* ── Modal ── */
  .ee-overlay { position: fixed; inset: 0; background: rgba(31, 41, 38, 0.45); backdrop-filter: blur(2px); z-index: 50; display: flex; align-items: flex-end; animation: ee-fade 0.2s ease both; }
  .ee-sheet {
    width: 100%; max-height: 90vh; overflow-y: auto;
    background: #f6f8f4; border-radius: 22px 22px 0 0; padding: 1rem 1.1rem 1.5rem;
    box-shadow: 0 -8px 30px rgba(47, 62, 70, 0.2); animation: ee-sheetUp 0.3s cubic-bezier(0.22,1,0.36,1) both;
  }
  .ee-sheet-grip { width: 38px; height: 4px; border-radius: 999px; background: #cdd5cf; margin: 0 auto 0.85rem; }
  .ee-sheet-title { font-family: 'Cormorant Garamond', serif; font-size: 1.45rem; font-weight: 400; color: #2f3e46; margin: 0 0 0.85rem; }
  .ee-field { margin-bottom: 0.85rem; }
  .ee-label { display: block; font-size: 0.66rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #7a8e84; margin-bottom: 0.35rem; }
  .ee-input, .ee-select, .ee-textarea {
    width: 100%; padding: 0.7rem 0.8rem; border: 1.5px solid #d4ddd6; border-radius: 12px;
    font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46; background: #fff; outline: none;
    box-sizing: border-box; -webkit-appearance: none; appearance: none; transition: border-color 0.18s, box-shadow 0.18s;
  }
  .ee-input:focus, .ee-select:focus, .ee-textarea:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }
  .ee-textarea { min-height: 78px; resize: vertical; line-height: 1.5; }
  .ee-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .ee-amount-wrap { position: relative; }
  .ee-amount-cur { position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); color: #7a8e84; font-weight: 600; pointer-events: none; }
  .ee-amount-wrap .ee-input { padding-left: 1.7rem; }
  .ee-actions { display: flex; gap: 0.5rem; margin-top: 0.4rem; }
  .ee-btn { flex: 1; padding: 0.75rem; border-radius: 12px; font-size: 0.82rem; font-weight: 600; letter-spacing: 0.02em; border: none; cursor: pointer; -webkit-tap-highlight-color: transparent; display: flex; align-items: center; justify-content: center; gap: 0.4rem; transition: transform 0.12s; }
  .ee-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .ee-btn:not(:disabled):active { transform: scale(0.98); }
  .ee-btn-cancel { background: #fff; color: #7a8e84; border: 1.5px solid #d4ddd6; }
  .ee-btn-submit { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #f0f5f2; box-shadow: 0 4px 14px rgba(53,79,82,0.2); }
  .ee-mini-spin { width: 14px; height: 14px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: ee-spin 0.7s linear infinite; }
`;

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function normalizeStatus(s) {
  const v = (s || 'pending').toString().toLowerCase();
  if (v.startsWith('approv')) return 'approved';
  if (v.startsWith('reject') || v.startsWith('declin')) return 'rejected';
  return 'pending';
}

function amountOf(e) {
  const n = Number(e?.amount ?? e?.total ?? e?.value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function currencyOf(e) {
  return e?.currency || e?.currencyCode || 'GBP';
}

function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency || ''} ${amount.toFixed(2)}`.trim();
  }
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function EmployeeExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [banner, setBanner] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(null);

  async function fetchExpenses() {
    setLoading(true);
    setError(null);
    let lastErr = null;
    for (const ep of LIST_ENDPOINTS) {
      try {
        const { data } = await api.get(ep);
        const list = data?.expenses || data?.data || (Array.isArray(data) ? data : null);
        if (Array.isArray(list)) {
          setExpenses(list);
          setLoading(false);
          return;
        }
      } catch (err) {
        lastErr = err;
        if (err?.response?.status && err.response.status !== 404) break;
      }
    }
    if (lastErr && lastErr?.response?.status && lastErr.response.status !== 404) {
      setError(getErrorMessage(lastErr));
    } else {
      setExpenses([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchExpenses();
  }, []);

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 3000);
  }

  function openModal() {
    setForm({ amount: '', currency: 'GBP', category: 'Travel', date: todayYMD(), description: '' });
    setModalOpen(true);
  }

  async function submitExpense(e) {
    e?.preventDefault?.();
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      flash('error', 'Enter a valid amount');
      return;
    }
    if (!form.category) {
      flash('error', 'Pick a category');
      return;
    }
    if ((form.description || '').trim().length < 3) {
      flash('error', 'Add a short description');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/expenses', {
        amount: amt,
        currency: form.currency,
        category: form.category,
        date: form.date,
        description: form.description.trim(),
      });
      flash('success', 'Expense submitted for approval');
      setModalOpen(false);
      fetchExpenses();
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const summary = useMemo(() => {
    const acc = { pending: { c: 0, t: 0 }, approved: { c: 0, t: 0 }, rejected: { c: 0, t: 0 } };
    let currency = 'GBP';
    for (const e of expenses) {
      const s = normalizeStatus(e.status);
      if (acc[s]) { acc[s].c += 1; acc[s].t += amountOf(e); }
      currency = currencyOf(e);
    }
    return { ...acc, currency };
  }, [expenses]);

  const counts = useMemo(() => ({
    all: expenses.length,
    pending: expenses.filter((e) => normalizeStatus(e.status) === 'pending').length,
    approved: expenses.filter((e) => normalizeStatus(e.status) === 'approved').length,
    rejected: expenses.filter((e) => normalizeStatus(e.status) === 'rejected').length,
  }), [expenses]);

  const filtered = useMemo(() => {
    if (filter === 'all') return expenses;
    return expenses.filter((e) => normalizeStatus(e.status) === filter);
  }, [expenses, filter]);

  return (
    <>
      <style>{styles}</style>
      <div className="ee-wrap">
        <header className="ee-header ee-anim">
          <div className="ee-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          </div>
          <div className="ee-header-text">
            <p className="ee-header-eyebrow">My Requests</p>
            <h1 className="ee-header-title">
              Expenses
              {!loading && !error && <span className="ee-count"> · {filtered.length}</span>}
            </h1>
          </div>
          <button
            type="button"
            className={`ee-refresh${loading ? ' is-busy' : ''}`}
            onClick={fetchExpenses}
            disabled={loading}
            aria-label="Refresh"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </header>

        {banner && <div className={`ee-banner ee-anim ${banner.kind === 'success' ? 'is-success' : 'is-error'}`}>{banner.text}</div>}

        {!loading && !error && (
          <div className="ee-summary ee-anim">
            <div className="ee-sum is-pending">
              <div className="ee-sum-lab">Pending</div>
              <div className="ee-sum-val">{formatMoney(summary.pending.t, summary.currency)}</div>
              <div className="ee-sum-sub">{summary.pending.c} claim{summary.pending.c === 1 ? '' : 's'}</div>
            </div>
            <div className="ee-sum is-approved">
              <div className="ee-sum-lab">Approved</div>
              <div className="ee-sum-val">{formatMoney(summary.approved.t, summary.currency)}</div>
              <div className="ee-sum-sub">{summary.approved.c} claim{summary.approved.c === 1 ? '' : 's'}</div>
            </div>
            <div className="ee-sum is-rejected">
              <div className="ee-sum-lab">Rejected</div>
              <div className="ee-sum-val">{formatMoney(summary.rejected.t, summary.currency)}</div>
              <div className="ee-sum-sub">{summary.rejected.c} claim{summary.rejected.c === 1 ? '' : 's'}</div>
            </div>
          </div>
        )}

        <button type="button" className="ee-new ee-anim" onClick={openModal}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New expense claim
        </button>

        <div className="ee-chips ee-anim">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={`ee-chip ${filter === f.key ? 'is-active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label} · {counts[f.key]}
            </button>
          ))}
        </div>

        {loading ? (
          <div>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ee-skel" />)}</div>
        ) : error ? (
          <div className="ee-error ee-anim">
            <p className="ee-error-title">Couldn't load your expenses</p>
            <p className="ee-error-sub">{error}</p>
            <button className="ee-retry" onClick={fetchExpenses}>Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ee-empty ee-anim">
            <p className="ee-empty-title">{filter !== 'all' ? 'No matches' : 'No expense claims yet'}</p>
            <p className="ee-empty-sub">
              {filter !== 'all' ? 'Try a different filter.' : 'Tap “New expense claim” to submit your first one.'}
            </p>
          </div>
        ) : (
          <div className="ee-list">
            {filtered.map((e, i) => {
              const status = normalizeStatus(e.status);
              const currency = currencyOf(e);
              const desc = e.description || e.title || e.notes || '';
              const date = formatDate(e.date || e.expenseDate || e.createdAt);
              const rejection = status === 'rejected' ? (e.rejectionReason || e.reviewNote || e.managerNote) : null;
              return (
                <div key={e._id || e.id || i} className={`ee-card ee-anim is-${status}`} style={{ animationDelay: `${Math.min(i, 6) * 25}ms` }}>
                  <div className="ee-card-top">
                    <div className="ee-card-main">
                      <div className="ee-card-cat">{e.category || e.merchant || 'Expense'}</div>
                      {date && <div className="ee-card-date">{date}</div>}
                    </div>
                    <div className="ee-card-right">
                      <div className="ee-card-amt">{formatMoney(amountOf(e), currency)}</div>
                      <span className={`ee-pill is-${status}`}>{status}</span>
                    </div>
                  </div>
                  {desc && <p className="ee-card-desc">{desc}</p>}
                  {rejection && <p className="ee-card-note"><b>Reason:</b> {rejection}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && form && (
        <div className="ee-overlay" onClick={() => !submitting && setModalOpen(false)}>
          <div className="ee-sheet" onClick={(ev) => ev.stopPropagation()}>
            <div className="ee-sheet-grip" />
            <h2 className="ee-sheet-title">New expense claim</h2>
            <form onSubmit={submitExpense}>
              <div className="ee-row2">
                <div className="ee-field">
                  <label className="ee-label" htmlFor="ee-amount">Amount</label>
                  <div className="ee-amount-wrap">
                    <span className="ee-amount-cur">{form.currency === 'GBP' ? '£' : form.currency === 'USD' ? '$' : form.currency === 'EUR' ? '€' : ''}</span>
                    <input
                      id="ee-amount" className="ee-input" type="number" inputMode="decimal" min="0" step="0.01"
                      placeholder="0.00" value={form.amount}
                      onChange={(ev) => setForm((f) => ({ ...f, amount: ev.target.value }))}
                    />
                  </div>
                </div>
                <div className="ee-field">
                  <label className="ee-label" htmlFor="ee-currency">Currency</label>
                  <select id="ee-currency" className="ee-select" value={form.currency} onChange={(ev) => setForm((f) => ({ ...f, currency: ev.target.value }))}>
                    <option value="GBP">GBP £</option>
                    <option value="USD">USD $</option>
                    <option value="EUR">EUR €</option>
                  </select>
                </div>
              </div>
              <div className="ee-row2">
                <div className="ee-field">
                  <label className="ee-label" htmlFor="ee-category">Category</label>
                  <select id="ee-category" className="ee-select" value={form.category} onChange={(ev) => setForm((f) => ({ ...f, category: ev.target.value }))}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="ee-field">
                  <label className="ee-label" htmlFor="ee-date">Date</label>
                  <input id="ee-date" className="ee-input" type="date" value={form.date} max={todayYMD()} onChange={(ev) => setForm((f) => ({ ...f, date: ev.target.value }))} />
                </div>
              </div>
              <div className="ee-field">
                <label className="ee-label" htmlFor="ee-desc">Description</label>
                <textarea id="ee-desc" className="ee-textarea" placeholder="What was this expense for?" value={form.description} onChange={(ev) => setForm((f) => ({ ...f, description: ev.target.value }))} />
              </div>
              <div className="ee-actions">
                <button type="button" className="ee-btn ee-btn-cancel" onClick={() => setModalOpen(false)} disabled={submitting}>Cancel</button>
                <button type="submit" className="ee-btn ee-btn-submit" disabled={submitting}>
                  {submitting && <span className="ee-mini-spin" />}
                  {submitting ? 'Submitting…' : 'Submit claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
