import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

const styles = `
  @keyframes ap-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ap-skel {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.85; }
  }
  @keyframes ap-spin { to { transform: rotate(360deg); } }

  .ap-wrap { padding: 0.85rem 1rem 6rem; }
  .ap-anim { animation: ap-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header ── */
  .ap-header {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.25rem 0.85rem;
  }
  .ap-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18);
    flex-shrink: 0;
  }
  .ap-header-text { min-width: 0; flex: 1; }
  .ap-header-eyebrow {
    font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c; margin: 0;
  }
  .ap-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
  }

  /* ── Tabs ── */
  .ap-tabs {
    display: flex; gap: 0.4rem;
    margin-bottom: 0.85rem;
  }
  .ap-tab {
    flex: 1;
    padding: 0.55rem 0.5rem;
    border-radius: 12px;
    border: 1px solid rgba(132, 169, 140, 0.4);
    background: rgba(255, 255, 255, 0.6);
    color: #52796f;
    font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em;
    display: flex; align-items: center; justify-content: center; gap: 0.35rem;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .ap-tab.is-active {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    border-color: transparent;
  }
  .ap-tab-pill {
    font-size: 0.62rem;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(132, 169, 140, 0.22);
    color: inherit;
  }
  .ap-tab.is-active .ap-tab-pill {
    background: rgba(202, 210, 197, 0.25);
  }

  /* ── Filter button + panel ── */
  .ap-filter-bar {
    display: flex; justify-content: flex-end;
    margin-bottom: 0.6rem;
  }
  .ap-filter-btn {
    position: relative;
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.45rem 0.75rem;
    border: 1.5px solid #d4ddd6; border-radius: 999px;
    background: #fff; color: #354f52;
    font-family: 'DM Sans', sans-serif; font-size: 0.75rem; font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: border-color 0.18s, background 0.18s;
  }
  .ap-filter-btn:active { transform: scale(0.97); }
  .ap-filter-btn.is-open,
  .ap-filter-btn.is-active {
    border-color: #52796f;
    background: rgba(82,121,111,0.08);
  }
  .ap-filter-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 18px; padding: 0 5px;
    border-radius: 999px;
    background: #52796f; color: #fff;
    font-size: 0.65rem; font-weight: 700;
  }
  .ap-filter-panel {
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    border-radius: 14px;
    padding: 0.75rem 0.85rem;
    margin-bottom: 0.75rem;
    box-shadow: 0 2px 8px rgba(47, 62, 70, 0.05);
  }
  .ap-filter-group + .ap-filter-group {
    margin-top: 0.65rem;
    padding-top: 0.65rem;
    border-top: 1px dashed rgba(132, 169, 140, 0.25);
  }
  .ap-filter-label {
    font-size: 0.62rem; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #7a8e84;
    margin: 0 0 0.45rem;
  }
  .ap-chip-row {
    display: flex; flex-wrap: wrap; gap: 0.35rem;
  }
  .ap-chip {
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
  .ap-chip:active { transform: scale(0.97); }
  .ap-chip.is-on {
    background: #52796f;
    border-color: #52796f;
    color: #fff;
  }
  .ap-amount-row {
    display: flex; gap: 0.5rem; align-items: center;
  }
  .ap-amount-input {
    flex: 1; min-width: 0;
    padding: 0.5rem 0.65rem;
    border: 1.5px solid #d4ddd6; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 0.85rem;
    color: #2f3e46; background: #fff; outline: none;
    -webkit-appearance: none; appearance: none;
    box-sizing: border-box;
    transition: border-color 0.18s;
  }
  .ap-amount-input:focus { border-color: #52796f; }
  .ap-amount-dash { color: #7a8e84; font-size: 0.8rem; }
  .ap-filter-clear {
    margin-top: 0.7rem;
    border: none; background: none;
    color: #7a3028;
    font-size: 0.72rem; font-weight: 600;
    padding: 0.2rem 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .ap-filter-clear:disabled { opacity: 0.4; cursor: default; }

  /* ── Card ── */
  .ap-card {
    padding: 0.85rem 0.95rem;
    border-radius: 16px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.55rem;
  }
  .ap-card-top {
    display: flex; align-items: flex-start; gap: 0.7rem;
  }
  .ap-avatar {
    width: 38px; height: 38px; border-radius: 50%;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.28), rgba(82, 121, 111, 0.22));
    color: #354f52;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.8rem; font-weight: 600;
    flex-shrink: 0;
  }
  .ap-card-meta { min-width: 0; flex: 1; }
  .ap-name {
    font-size: 0.92rem; font-weight: 600;
    color: #2f3e46; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ap-subtitle {
    margin-top: 2px;
    font-size: 0.72rem; color: #7a8e84;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ap-type-pill {
    align-self: flex-start;
    font-size: 0.62rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 999px;
    background: rgba(132, 169, 140, 0.18);
    color: #354f52;
    flex-shrink: 0;
  }
  .ap-type-pill.is-leave { background: rgba(82, 121, 111, 0.18); color: #354f52; }
  .ap-type-pill.is-expense { background: rgba(132, 169, 140, 0.22); color: #354f52; }

  .ap-card-details {
    margin: 0.65rem 0 0;
    padding: 0.55rem 0.7rem;
    background: #f6f8f5;
    border-radius: 10px;
    font-size: 0.78rem; color: #2f3e46;
    line-height: 1.45;
  }
  .ap-card-details strong {
    color: #354f52; font-weight: 600;
    margin-right: 0.25rem;
  }

  .ap-actions {
    display: flex; gap: 0.45rem;
    margin-top: 0.7rem;
  }
  .ap-btn {
    flex: 1;
    padding: 0.6rem 0.7rem;
    border-radius: 10px;
    font-size: 0.8rem; font-weight: 600;
    letter-spacing: 0.04em;
    border: none;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 0.35rem;
    transition: transform 0.12s, box-shadow 0.12s;
  }
  .ap-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .ap-btn:not(:disabled):active { transform: scale(0.97); }
  .ap-btn-approve {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    box-shadow: 0 3px 10px rgba(53,79,82,0.22);
  }
  .ap-btn-reject {
    background: #fff;
    color: #b85c50;
    border: 1.5px solid rgba(192,117,106,0.55);
  }
  .ap-mini-spin {
    width: 12px; height: 12px;
    border: 2px solid currentColor; border-top-color: transparent;
    border-radius: 50%; animation: ap-spin 0.7s linear infinite;
  }

  /* ── States ── */
  .ap-skel {
    height: 110px; border-radius: 16px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: ap-skel 1.2s ease-in-out infinite;
    margin-bottom: 0.55rem;
  }
  .ap-empty, .ap-error {
    padding: 2rem 1rem; border-radius: 16px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center; color: #52796f;
  }
  .ap-error {
    border-color: rgba(192, 117, 106, 0.4);
    color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .ap-empty-title, .ap-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .ap-empty-sub, .ap-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .ap-retry {
    margin-top: 0.85rem;
    padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .ap-retry:active { transform: scale(0.97); }

  /* ── Banner (transient toast in-card) ── */
  .ap-banner {
    margin-bottom: 0.85rem;
    padding: 0.6rem 0.85rem;
    border-radius: 12px;
    font-size: 0.78rem; font-weight: 500;
  }
  .ap-banner.is-success {
    background: linear-gradient(135deg, #f0f5f2, #eaf2ec);
    border-left: 3px solid #52796f;
    color: #2f3e46;
  }
  .ap-banner.is-error {
    background: linear-gradient(135deg, #fdf3f2, #fdecea);
    border-left: 3px solid #c0756a;
    color: #7a3028;
  }

  /* ── Reason modal ── */
  @keyframes ap-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ap-sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .ap-overlay {
    position: fixed; inset: 0;
    background: rgba(31, 41, 38, 0.45); backdrop-filter: blur(2px);
    z-index: 50; display: flex; align-items: flex-end;
    animation: ap-fade 0.2s ease both;
  }
  .ap-sheet {
    width: 100%; max-height: 90vh; overflow-y: auto;
    background: #f6f8f4; border-radius: 22px 22px 0 0; padding: 1rem 1.1rem 1.5rem;
    box-shadow: 0 -8px 30px rgba(47, 62, 70, 0.2);
    animation: ap-sheetUp 0.3s cubic-bezier(0.22,1,0.36,1) both;
  }
  .ap-sheet-grip { width: 38px; height: 4px; border-radius: 999px; background: #cdd5cf; margin: 0 auto 0.85rem; }
  .ap-sheet-title { font-family: 'Cormorant Garamond', serif; font-size: 1.45rem; font-weight: 400; color: #2f3e46; margin: 0 0 0.25rem; }
  .ap-sheet-sub { font-size: 0.78rem; color: #7a8e84; margin: 0 0 0.85rem; }
  .ap-field { margin-bottom: 0.85rem; }
  .ap-field-label { display: block; font-size: 0.66rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #7a8e84; margin-bottom: 0.35rem; }
  .ap-textarea {
    width: 100%; padding: 0.7rem 0.8rem; border: 1.5px solid #d4ddd6; border-radius: 12px;
    font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46; background: #fff; outline: none;
    box-sizing: border-box; -webkit-appearance: none; appearance: none;
    transition: border-color 0.18s, box-shadow 0.18s;
    min-height: 90px; resize: vertical; line-height: 1.5;
  }
  .ap-textarea:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }
  .ap-sheet-actions { display: flex; gap: 0.5rem; margin-top: 0.4rem; }
  .ap-sheet-btn {
    flex: 1; padding: 0.75rem; border-radius: 12px;
    font-size: 0.82rem; font-weight: 600; letter-spacing: 0.02em;
    border: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
    display: flex; align-items: center; justify-content: center; gap: 0.4rem;
    transition: transform 0.12s;
  }
  .ap-sheet-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .ap-sheet-btn:not(:disabled):active { transform: scale(0.98); }
  .ap-sheet-btn-cancel { background: #fff; color: #7a8e84; border: 1.5px solid #d4ddd6; }
  .ap-sheet-btn-confirm { background: linear-gradient(135deg, #8a3f36 0%, #b85c50 100%); color: #fbeae7; box-shadow: 0 4px 14px rgba(138,63,54,0.2); }
`;

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatAmount(amount, currency) {
  if (amount == null) return '—';
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '';
  return `${symbol}${Number(amount).toFixed(2)}`;
}

function leaveEmployee(req) {
  return req?.employeeId || {};
}
function expenseEmployee(req) {
  return req?.employee || {};
}

function initials(emp) {
  const f = (emp?.firstName || '').charAt(0);
  const l = (emp?.lastName || '').charAt(0);
  return (f + l).toUpperCase() || '?';
}
function fullName(emp) {
  return [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
}

export default function ManagerApprovals() {
  const [tab, setTab] = useState('leave');
  const [leaves, setLeaves] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actingId, setActingId] = useState(null);
  const [banner, setBanner] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [expFiltersOpen, setExpFiltersOpen] = useState(false);
  const [categoryFilters, setCategoryFilters] = useState([]);
  const [employeeFilters, setEmployeeFilters] = useState([]);
  const [currencyFilters, setCurrencyFilters] = useState([]);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/manager/approvals/pending');
      const payload = data?.data || data || {};
      setLeaves(Array.isArray(payload.leaveRequests) ? payload.leaveRequests : []);
      const allExpenses = Array.isArray(payload.expenses) ? payload.expenses : [];
      setExpenses(allExpenses.filter((e) => {
        const s = (e?.status || '').toString().trim().toLowerCase();
        return s === 'pending' || s === '';
      }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 2800);
  }

  async function actOnLeave(req, approve) {
    if (!approve) {
      openReject('leave', req);
      return;
    }
    if (!window.confirm('Approve this leave request?')) return;
    setActingId(req._id);
    try {
      await api.patch(`/leave/approve/${req._id}`, { adminComment: '' });
      setLeaves((prev) => prev.filter((r) => r._id !== req._id));
      flash('success', 'Leave approved');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  async function actOnExpense(req, approve) {
    if (!approve) {
      openReject('expense', req);
      return;
    }
    if (!window.confirm('Approve this expense?')) return;
    setActingId(req._id);
    try {
      await api.post(`/expenses/${req._id}/approve`, { approvalNotes: '' });
      setExpenses((prev) => prev.filter((r) => r._id !== req._id));
      flash('success', 'Expense approved');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  function openReject(kind, req) {
    setRejectTarget({ kind, req });
    setRejectReason('');
  }

  function closeReject() {
    if (rejectSubmitting) return;
    setRejectTarget(null);
    setRejectReason('');
  }

  async function submitReject(e) {
    e.preventDefault();
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) return;
    const { kind, req } = rejectTarget;
    setRejectSubmitting(true);
    try {
      if (kind === 'leave') {
        await api.patch(`/leave/reject/${req._id}`, { adminComment: reason });
        setLeaves((prev) => prev.filter((r) => r._id !== req._id));
        flash('success', 'Leave rejected');
      } else {
        await api.post(`/expenses/${req._id}/decline`, { approvalNotes: reason });
        setExpenses((prev) => prev.filter((r) => r._id !== req._id));
        flash('success', 'Expense declined');
      }
      setRejectTarget(null);
      setRejectReason('');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setRejectSubmitting(false);
    }
  }

  const { categoryOptions, employeeOptions, currencyOptions } = useMemo(() => {
    const cats = new Set();
    const emps = new Map();
    const ccys = new Set();
    for (const e of expenses) {
      if (e?.category) cats.add(e.category);
      if (e?.currency) ccys.add(e.currency);
      const emp = expenseEmployee(e);
      const key = emp?._id || emp?.id || emp?.email || fullName(emp);
      if (key && !emps.has(key)) emps.set(key, { key, label: fullName(emp) });
    }
    const sortAlpha = (a, b) => a.localeCompare(b);
    return {
      categoryOptions: [...cats].sort(sortAlpha),
      employeeOptions: [...emps.values()].sort((a, b) => a.label.localeCompare(b.label)),
      currencyOptions: [...ccys].sort(sortAlpha),
    };
  }, [expenses]);

  const min = minAmount.trim() === '' ? null : Number(minAmount);
  const max = maxAmount.trim() === '' ? null : Number(maxAmount);
  const amountActive =
    (min != null && !Number.isNaN(min)) || (max != null && !Number.isNaN(max));
  const activeExpFilterCount =
    categoryFilters.length +
    employeeFilters.length +
    currencyFilters.length +
    (amountActive ? 1 : 0);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilters.length && !categoryFilters.includes(e.category)) return false;
      if (currencyFilters.length && !currencyFilters.includes(e.currency)) return false;
      if (employeeFilters.length) {
        const emp = expenseEmployee(e);
        const key = emp?._id || emp?.id || emp?.email || fullName(emp);
        if (!employeeFilters.includes(key)) return false;
      }
      if (min != null && !Number.isNaN(min) && Number(e.amount) < min) return false;
      if (max != null && !Number.isNaN(max) && Number(e.amount) > max) return false;
      return true;
    });
  }, [expenses, categoryFilters, employeeFilters, currencyFilters, min, max]);

  const counts = useMemo(() => ({ leave: leaves.length, expense: expenses.length }), [leaves, expenses]);
  const list = tab === 'leave' ? leaves : filteredExpenses;

  function toggleFilter(setter, value) {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function clearExpFilters() {
    setCategoryFilters([]);
    setEmployeeFilters([]);
    setCurrencyFilters([]);
    setMinAmount('');
    setMaxAmount('');
  }

  return (
    <>
      <style>{styles}</style>
      <div className="ap-wrap">
        <header className="ap-header ap-anim">
          <div className="ap-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div className="ap-header-text">
            <p className="ap-header-eyebrow">Pending Decisions</p>
            <h1 className="ap-header-title">Approvals</h1>
          </div>
        </header>

        <div className="ap-tabs ap-anim">
          <button
            type="button"
            className={`ap-tab ${tab === 'leave' ? 'is-active' : ''}`}
            onClick={() => setTab('leave')}
          >
            Leave <span className="ap-tab-pill">{counts.leave}</span>
          </button>
          <button
            type="button"
            className={`ap-tab ${tab === 'expense' ? 'is-active' : ''}`}
            onClick={() => setTab('expense')}
          >
            Expense <span className="ap-tab-pill">{counts.expense}</span>
          </button>
        </div>

        {tab === 'expense' && expenses.length > 0 && (
          <>
            <div className="ap-filter-bar ap-anim">
              <button
                type="button"
                className={`ap-filter-btn${expFiltersOpen ? ' is-open' : ''}${activeExpFilterCount > 0 ? ' is-active' : ''}`}
                onClick={() => setExpFiltersOpen((v) => !v)}
                aria-expanded={expFiltersOpen}
                aria-label="Toggle filters"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 5h18M6 12h12M10 19h4" />
                </svg>
                Filters
                {activeExpFilterCount > 0 && (
                  <span className="ap-filter-badge">{activeExpFilterCount}</span>
                )}
              </button>
            </div>
            {expFiltersOpen && (
              <div className="ap-filter-panel ap-anim">
                {categoryOptions.length > 0 && (
                  <div className="ap-filter-group">
                    <p className="ap-filter-label">Category</p>
                    <div className="ap-chip-row">
                      {categoryOptions.map((c) => {
                        const on = categoryFilters.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            className={`ap-chip${on ? ' is-on' : ''}`}
                            onClick={() => toggleFilter(setCategoryFilters, c)}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {employeeOptions.length > 1 && (
                  <div className="ap-filter-group">
                    <p className="ap-filter-label">Employee</p>
                    <div className="ap-chip-row">
                      {employeeOptions.map((e) => {
                        const on = employeeFilters.includes(e.key);
                        return (
                          <button
                            key={e.key}
                            type="button"
                            className={`ap-chip${on ? ' is-on' : ''}`}
                            onClick={() => toggleFilter(setEmployeeFilters, e.key)}
                          >
                            {e.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {currencyOptions.length > 1 && (
                  <div className="ap-filter-group">
                    <p className="ap-filter-label">Currency</p>
                    <div className="ap-chip-row">
                      {currencyOptions.map((c) => {
                        const on = currencyFilters.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            className={`ap-chip${on ? ' is-on' : ''}`}
                            onClick={() => toggleFilter(setCurrencyFilters, c)}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="ap-filter-group">
                  <p className="ap-filter-label">Amount</p>
                  <div className="ap-amount-row">
                    <input
                      type="number"
                      inputMode="decimal"
                      className="ap-amount-input"
                      placeholder="Min"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                    />
                    <span className="ap-amount-dash">–</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="ap-amount-input"
                      placeholder="Max"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="ap-filter-clear"
                  onClick={clearExpFilters}
                  disabled={activeExpFilterCount === 0}
                >
                  Clear all filters
                </button>
              </div>
            )}
          </>
        )}

        {banner && (
          <div className={`ap-banner ${banner.kind === 'success' ? 'is-success' : 'is-error'} ap-anim`}>
            {banner.text}
          </div>
        )}

        {loading ? (
          <div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ap-skel" />
            ))}
          </div>
        ) : error ? (
          <div className="ap-error ap-anim">
            <p className="ap-error-title">Couldn't load approvals</p>
            <p className="ap-error-sub">{error}</p>
            <button className="ap-retry" onClick={fetchAll}>Try again</button>
          </div>
        ) : list.length === 0 ? (
          <div className="ap-empty ap-anim">
            <p className="ap-empty-title">
              {tab === 'expense' && activeExpFilterCount > 0 ? 'No matches' : 'All caught up'}
            </p>
            <p className="ap-empty-sub">
              {tab === 'expense' && activeExpFilterCount > 0
                ? 'No expenses match the current filters.'
                : `No pending ${tab === 'leave' ? 'leave' : 'expense'} requests right now.`}
            </p>
          </div>
        ) : tab === 'leave' ? (
          list.map((req) => <LeaveCard key={req._id} req={req} acting={actingId === req._id} onAct={actOnLeave} />)
        ) : (
          list.map((req) => <ExpenseCard key={req._id} req={req} acting={actingId === req._id} onAct={actOnExpense} />)
        )}
      </div>

      {rejectTarget && (
        <div className="ap-overlay" onClick={closeReject}>
          <div className="ap-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ap-sheet-grip" />
            <h2 className="ap-sheet-title">
              {rejectTarget.kind === 'leave' ? 'Reject leave request' : 'Decline expense'}
            </h2>
            <p className="ap-sheet-sub">
              {fullName(
                rejectTarget.kind === 'leave'
                  ? leaveEmployee(rejectTarget.req)
                  : expenseEmployee(rejectTarget.req),
              )}
            </p>
            <form onSubmit={submitReject}>
              <div className="ap-field">
                <label className="ap-field-label" htmlFor="ap-reject-reason">
                  {rejectTarget.kind === 'leave' ? 'Reason for rejection' : 'Reason for decline'}
                </label>
                <textarea
                  id="ap-reject-reason"
                  className="ap-textarea"
                  placeholder={
                    rejectTarget.kind === 'leave'
                      ? 'Let the employee know why this leave is being rejected…'
                      : 'Let the employee know why this expense is being declined…'
                  }
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="ap-sheet-actions">
                <button
                  type="button"
                  className="ap-sheet-btn ap-sheet-btn-cancel"
                  onClick={closeReject}
                  disabled={rejectSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ap-sheet-btn ap-sheet-btn-confirm"
                  disabled={rejectSubmitting || !rejectReason.trim()}
                >
                  {rejectSubmitting ? <span className="ap-mini-spin" /> : null}
                  {rejectTarget.kind === 'leave' ? 'Reject' : 'Decline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function LeaveCard({ req, acting, onAct }) {
  const emp = leaveEmployee(req);
  return (
    <div className="ap-card ap-anim">
      <div className="ap-card-top">
        <span className="ap-avatar">{initials(emp)}</span>
        <div className="ap-card-meta">
          <div className="ap-name">{fullName(emp)}</div>
          <div className="ap-subtitle">{emp.vtid || emp.email || '—'}</div>
        </div>
        <span className="ap-type-pill is-leave">{req.leaveType || 'Leave'}</span>
      </div>
      <div className="ap-card-details">
        <div><strong>Dates:</strong>{formatDate(req.startDate)} → {formatDate(req.endDate)}</div>
        {req.reason && <div style={{ marginTop: 4 }}><strong>Reason:</strong>{req.reason}</div>}
      </div>
      <div className="ap-actions">
        <button
          className="ap-btn ap-btn-reject"
          onClick={() => onAct(req, false)}
          disabled={acting}
        >
          {acting ? <span className="ap-mini-spin" /> : null}
          Reject
        </button>
        <button
          className="ap-btn ap-btn-approve"
          onClick={() => onAct(req, true)}
          disabled={acting}
        >
          {acting ? <span className="ap-mini-spin" /> : null}
          Approve
        </button>
      </div>
    </div>
  );
}

function ExpenseCard({ req, acting, onAct }) {
  const emp = expenseEmployee(req);
  return (
    <div className="ap-card ap-anim">
      <div className="ap-card-top">
        <span className="ap-avatar">{initials(emp)}</span>
        <div className="ap-card-meta">
          <div className="ap-name">{fullName(emp)}</div>
          <div className="ap-subtitle">{req.category || 'General'}</div>
        </div>
        <span className="ap-type-pill is-expense">{formatAmount(req.amount, req.currency)}</span>
      </div>
      <div className="ap-card-details">
        {req.date && <div><strong>Date:</strong>{formatDate(req.date)}</div>}
        {(req.description || req.notes) && (
          <div style={{ marginTop: 4 }}><strong>Notes:</strong>{req.description || req.notes}</div>
        )}
      </div>
      <div className="ap-actions">
        <button
          className="ap-btn ap-btn-reject"
          onClick={() => onAct(req, false)}
          disabled={acting}
        >
          {acting ? <span className="ap-mini-spin" /> : null}
          Decline
        </button>
        <button
          className="ap-btn ap-btn-approve"
          onClick={() => onAct(req, true)}
          disabled={acting}
        >
          {acting ? <span className="ap-mini-spin" /> : null}
          Approve
        </button>
      </div>
    </div>
  );
}
