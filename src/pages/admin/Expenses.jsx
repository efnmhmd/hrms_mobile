import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Admin / manager expense reporting. Reads the same approvals feed the web
// admin dashboard uses (/expenses/approvals). Read-only: it summarises spend
// by status and lets you search/filter — approvals stay on the web app.

const styles = `
  @keyframes ex-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ex-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes ex-spin { to { transform: rotate(360deg); } }

  .ex-wrap { padding: 0.85rem 1rem 6rem; }
  .ex-anim { animation: ex-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  .ex-header { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.25rem 0.85rem; }
  .ex-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18); flex-shrink: 0;
  }
  .ex-header-text { min-width: 0; flex: 1; }
  .ex-header-eyebrow {
    font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c; margin: 0;
  }
  .ex-header-title {
    font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0;
  }
  .ex-count { font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem; }
  .ex-refresh-btn {
    flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 10px;
    border: 1px solid rgba(212, 221, 214, 0.7); background: #fff; color: #354f52;
    cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 0.15s, transform 0.12s;
  }
  .ex-refresh-btn:active { background: #f1f4f0; transform: scale(0.95); }
  .ex-refresh-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .ex-refresh-btn.is-spinning svg { animation: ex-spin 0.9s linear infinite; }

  /* ── Spend summary ── */
  .ex-summary {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; margin-bottom: 0.85rem;
  }
  .ex-sum {
    border: 1px solid rgba(212, 221, 214, 0.7); background: #fff; border-radius: 12px;
    padding: 0.6rem 0.5rem; box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
  }
  .ex-sum-lab {
    font-size: 0.58rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
    color: #84a98c; margin-bottom: 3px;
  }
  .ex-sum-val {
    font-size: 1rem; font-weight: 700; color: #2f3e46; font-variant-numeric: tabular-nums; line-height: 1.1;
  }
  .ex-sum.is-pending .ex-sum-val { color: #b78f3a; }
  .ex-sum.is-approved .ex-sum-val { color: #354f52; }
  .ex-sum.is-rejected .ex-sum-val { color: #b85c50; }
  .ex-sum-sub { font-size: 0.6rem; color: #9aa8a0; margin-top: 2px; }

  /* ── Search + chips ── */
  .ex-search-wrap { position: relative; margin-bottom: 0.6rem; }
  .ex-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #84a98c; pointer-events: none; }
  .ex-search-input {
    width: 100%; padding: 0.7rem 1rem 0.7rem 2.5rem;
    border: 1.5px solid #d4ddd6; border-radius: 12px;
    font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46; background: #fff; outline: none;
    transition: border-color 0.18s, box-shadow 0.18s; box-shadow: 0 1px 3px rgba(47, 62, 70, 0.04);
    -webkit-appearance: none; appearance: none; box-sizing: border-box;
  }
  .ex-search-input:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }

  .ex-chips { display: flex; gap: 0.4rem; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 0.85rem; padding-bottom: 4px; }
  .ex-chips::-webkit-scrollbar { display: none; }
  .ex-chip {
    flex-shrink: 0; padding: 0.45rem 0.8rem; border-radius: 999px;
    font-size: 0.74rem; font-weight: 600; letter-spacing: 0.04em;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .ex-chip.is-active { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; border-color: transparent; }

  /* ── Cards ── */
  .ex-list { display: flex; flex-direction: column; gap: 0.45rem; }
  .ex-card {
    padding: 0.7rem 0.8rem; border-radius: 14px; background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    border-left: 3px solid transparent;
  }
  .ex-card.is-pending  { border-left-color: #d8a64c; }
  .ex-card.is-approved { border-left-color: #52796f; }
  .ex-card.is-rejected { border-left-color: #c0756a; }
  .ex-card-top { display: flex; align-items: flex-start; gap: 0.6rem; }
  .ex-card-main { min-width: 0; flex: 1; }
  .ex-card-name { font-size: 0.88rem; font-weight: 600; color: #2f3e46; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ex-card-cat { font-size: 0.68rem; color: #84a98c; letter-spacing: 0.03em; margin-top: 2px; text-transform: capitalize; }
  .ex-card-right { text-align: right; flex-shrink: 0; }
  .ex-card-amt { font-size: 0.95rem; font-weight: 700; color: #2f3e46; font-variant-numeric: tabular-nums; }
  .ex-status-pill {
    display: inline-block; margin-top: 4px;
    font-size: 0.56rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 2px 7px; border-radius: 999px;
  }
  .ex-status-pill.is-pending  { background: rgba(216, 166, 76, 0.18); color: #7a591f; }
  .ex-status-pill.is-approved { background: rgba(82, 121, 111, 0.18); color: #354f52; }
  .ex-status-pill.is-rejected { background: rgba(192, 117, 106, 0.18); color: #7a3028; }
  .ex-card-desc { margin: 0.55rem 0 0; font-size: 0.78rem; color: #56655d; line-height: 1.45; }
  .ex-card-foot {
    margin-top: 0.55rem; display: flex; flex-wrap: wrap; gap: 0.5rem;
    font-size: 0.68rem; color: #7a8e84;
  }
  .ex-foot-chip { display: inline-flex; align-items: center; gap: 0.3rem; background: #f1f4f0; border-radius: 999px; padding: 2px 8px; font-weight: 500; }

  /* ── States ── */
  .ex-skel { height: 84px; border-radius: 14px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%); animation: ex-skel 1.2s ease-in-out infinite; margin-bottom: 0.45rem; }
  .ex-empty, .ex-error {
    padding: 2rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .ex-error { border-color: rgba(192, 117, 106, 0.4); color: #7a3028; background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55); }
  .ex-empty-title, .ex-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .ex-empty-sub, .ex-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .ex-retry {
    margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5;
    font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .ex-retry:active { transform: scale(0.97); }
`;

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function normalizeStatus(s) {
  const v = (s || 'pending').toString().toLowerCase();
  if (v.startsWith('approv')) return 'approved';
  if (v.startsWith('reject') || v.startsWith('declin')) return 'rejected';
  return 'pending';
}

function expenseEmployee(e) {
  return (
    e?.employeeName ||
    [e?.employee?.firstName, e?.employee?.lastName].filter(Boolean).join(' ') ||
    e?.employee?.name ||
    e?.employee?.email ||
    e?.userName ||
    'Employee'
  );
}

function expenseAmount(e) {
  // The backend stores the claim amount in `totalAmount` (see web AdminExpenses).
  const raw = e?.totalAmount ?? e?.amount ?? e?.total ?? e?.value ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function expenseCurrency(e) {
  return e?.currency || e?.currencyCode || 'GBP';
}

function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'GBP',
      maximumFractionDigits: 2,
    }).format(amount);
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

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  async function fetchExpenses() {
    setLoading(true);
    setError(null);
    try {
      // The approvals feed accepts an optional status filter; omit it to pull
      // every expense and bucket client-side so the summary covers all states.
      const { data } = await api.get('/expenses/approvals?limit=500');
      const list =
        data?.expenses ||
        data?.data ||
        (Array.isArray(data) ? data : []);
      setExpenses(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchExpenses();
  }, []);

  const summary = useMemo(() => {
    const acc = {
      pending: { count: 0, total: 0 },
      approved: { count: 0, total: 0 },
      rejected: { count: 0, total: 0 },
    };
    let currency = 'GBP';
    for (const e of expenses) {
      const status = normalizeStatus(e.status);
      if (acc[status]) {
        acc[status].count += 1;
        acc[status].total += expenseAmount(e);
      }
      currency = expenseCurrency(e);
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
    const q = query.trim().toLowerCase();
    return expenses.filter((e) => {
      if (filter !== 'all' && normalizeStatus(e.status) !== filter) return false;
      if (!q) return true;
      const hay = [
        expenseEmployee(e), e.category, e.description, e.title, e.notes, e.merchant,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [expenses, query, filter]);

  return (
    <>
      <style>{styles}</style>
      <div className="ex-wrap">
        <header className="ex-header ex-anim">
          <div className="ex-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          </div>
          <div className="ex-header-text">
            <p className="ex-header-eyebrow">Reporting</p>
            <h1 className="ex-header-title">
              Expenses
              {!loading && !error && <span className="ex-count"> · {filtered.length}</span>}
            </h1>
          </div>
          <button
            type="button"
            className={`ex-refresh-btn${loading ? ' is-spinning' : ''}`}
            onClick={fetchExpenses}
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

        {!loading && !error && (
          <div className="ex-summary ex-anim">
            <div className="ex-sum is-pending">
              <div className="ex-sum-lab">Pending</div>
              <div className="ex-sum-val">{formatMoney(summary.pending.total, summary.currency)}</div>
              <div className="ex-sum-sub">{summary.pending.count} request{summary.pending.count === 1 ? '' : 's'}</div>
            </div>
            <div className="ex-sum is-approved">
              <div className="ex-sum-lab">Approved</div>
              <div className="ex-sum-val">{formatMoney(summary.approved.total, summary.currency)}</div>
              <div className="ex-sum-sub">{summary.approved.count} request{summary.approved.count === 1 ? '' : 's'}</div>
            </div>
            <div className="ex-sum is-rejected">
              <div className="ex-sum-lab">Rejected</div>
              <div className="ex-sum-val">{formatMoney(summary.rejected.total, summary.currency)}</div>
              <div className="ex-sum-sub">{summary.rejected.count} request{summary.rejected.count === 1 ? '' : 's'}</div>
            </div>
          </div>
        )}

        <div className="ex-search-wrap ex-anim">
          <span className="ex-search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            className="ex-search-input"
            placeholder="Search by employee, category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>

        <div className="ex-chips ex-anim">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`ex-chip ${filter === f.key ? 'is-active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} · {counts[f.key]}
            </button>
          ))}
        </div>

        {loading ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="ex-skel" />)}
          </div>
        ) : error ? (
          <div className="ex-error ex-anim">
            <p className="ex-error-title">Couldn't load expenses</p>
            <p className="ex-error-sub">{error}</p>
            <button className="ex-retry" onClick={fetchExpenses}>Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ex-empty ex-anim">
            <p className="ex-empty-title">{query || filter !== 'all' ? 'No matches' : 'No expenses yet'}</p>
            <p className="ex-empty-sub">
              {query || filter !== 'all'
                ? 'Try a different search term or filter.'
                : 'Submitted expense claims will appear here.'}
            </p>
          </div>
        ) : (
          <div className="ex-list">
            {filtered.map((e, i) => {
              const status = normalizeStatus(e.status);
              const currency = expenseCurrency(e);
              const desc = e.description || e.title || e.notes || '';
              const date = formatDate(e.date || e.expenseDate || e.createdAt);
              const dept = e.department || e.employee?.department;
              return (
                <div
                  key={e._id || e.id || i}
                  className={`ex-card ex-anim is-${status}`}
                  style={{ animationDelay: `${Math.min(i, 6) * 25}ms` }}
                >
                  <div className="ex-card-top">
                    <div className="ex-card-main">
                      <div className="ex-card-name">{expenseEmployee(e)}</div>
                      {(e.category || e.merchant) && (
                        <div className="ex-card-cat">{e.category || e.merchant}</div>
                      )}
                    </div>
                    <div className="ex-card-right">
                      <div className="ex-card-amt">{formatMoney(expenseAmount(e), currency)}</div>
                      <span className={`ex-status-pill is-${status}`}>{status}</span>
                    </div>
                  </div>
                  {desc && <p className="ex-card-desc">{desc}</p>}
                  {(date || dept) && (
                    <div className="ex-card-foot">
                      {date && (
                        <span className="ex-foot-chip">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                          </svg>
                          {date}
                        </span>
                      )}
                      {dept && <span className="ex-foot-chip">{dept}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
