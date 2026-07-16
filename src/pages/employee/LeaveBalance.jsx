import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../utils/api';
import { getUser } from '../../utils/auth';
import { getErrorMessage } from '../../utils/errorHandler';
import { LEAVE_TYPES } from '../../utils/leaveTypes';

// Employee's own annual-leave balance.
//   GET /leave/balances/current/:userId
//     -> { success, data: { entitlementDays, carryOverDays, usedDays, daysUsed,
//                           totalTaken, pendingDays, totalDays, remainingDays } }
// The server's enrichSingleBalance returns the canonical `daysUsed` (= ALL
// approved leave taken, every type) alongside the raw stored `usedDays`
// (annual-deducting types only, frequently stale/zero). "Used" must prefer
// daysUsed → totalTaken → usedDays, exactly as the web LeaveBalanceSummary /
// LeaveBalanceCards do — otherwise Used/Remaining disagree with the web app.
// Remaining = entitlement + carry-over − used.
// The "Remaining" stat shows leave still available to take — i.e. that same
// remaining figure (entitlement + carry-over − used), per HR's definition —
// not the server's pendingDays (leave awaiting approval).

const styles = `
  @keyframes lb-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes lb-skel {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.85; }
  }
  @keyframes lb-ring {
    from { stroke-dashoffset: var(--lb-circ); }
  }

  .lb-wrap { padding: 0.85rem 1rem 6rem; }
  .lb-anim { animation: lb-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header ── */
  .lb-header {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.25rem 0.85rem;
  }
  .lb-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18);
    flex-shrink: 0;
  }
  .lb-header-text { min-width: 0; flex: 1; }
  .lb-header-eyebrow {
    font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c; margin: 0;
  }
  .lb-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
  }
  .lb-refresh {
    flex-shrink: 0;
    width: 36px; height: 36px; border-radius: 10px;
    border: 1.5px solid #d4ddd6; background: #fff;
    color: #52796f;
    display: flex; align-items: center; justify-content: center;
    -webkit-tap-highlight-color: transparent; cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .lb-refresh:active { transform: scale(0.95); background: #f1f4f0; }
  .lb-refresh.is-loading svg { animation: lb-spin 0.9s linear infinite; }
  @keyframes lb-spin { to { transform: rotate(360deg); } }

  /* Request + refresh sit together as a pair at the header's right edge,
     mirroring ShiftManagement's .sm-header-actions (request pill next to the
     update button). */
  .lb-header-actions { flex-shrink: 0; display: flex; align-items: center; gap: 0.4rem; }
  .lb-request {
    flex-shrink: 0;
    display: inline-flex; align-items: center; gap: 0.35rem;
    height: 36px; padding: 0 0.8rem; border-radius: 10px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.74rem; font-weight: 600; letter-spacing: 0.02em;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(53,79,82,0.24);
    -webkit-tap-highlight-color: transparent; cursor: pointer;
    transition: transform 0.12s;
  }
  .lb-request:active { transform: scale(0.96); }
  .lb-request:disabled { opacity: 0.55; cursor: not-allowed; }

  /* ── Hero ring card ── */
  .lb-hero {
    position: relative; overflow: hidden;
    border-radius: 22px;
    background:
      radial-gradient(ellipse at 0% 0%, rgba(132, 169, 140, 0.35) 0%, transparent 55%),
      radial-gradient(ellipse at 100% 100%, rgba(53, 79, 82, 0.65) 0%, transparent 60%),
      linear-gradient(135deg, #354f52 0%, #52796f 100%);
    padding: 1.25rem;
    box-shadow: 0 12px 30px rgba(47, 62, 70, 0.18);
    display: flex; align-items: center; gap: 1.25rem;
  }
  .lb-hero::before {
    content: ''; position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(202, 210, 197, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(202, 210, 197, 0.05) 1px, transparent 1px);
    background-size: 26px 26px; pointer-events: none;
  }
  .lb-ring-wrap { position: relative; flex-shrink: 0; width: 104px; height: 104px; }
  .lb-ring-svg { transform: rotate(-90deg); }
  .lb-ring-track { stroke: rgba(202, 210, 197, 0.18); }
  .lb-ring-fill {
    stroke: #cad2c5; stroke-linecap: round;
    animation: lb-ring 1s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .lb-ring-center {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: #f0f5f2;
  }
  .lb-ring-num { font-size: 1.7rem; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
  .lb-ring-label { font-size: 0.56rem; letter-spacing: 0.14em; text-transform: uppercase; color: #b9cabe; margin-top: 3px; }
  .lb-hero-side { position: relative; z-index: 1; min-width: 0; flex: 1; }
  .lb-hero-eyebrow {
    font-size: 0.6rem; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase;
    color: #9ec0a6; margin: 0 0 0.3rem;
  }
  .lb-hero-headline {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.5rem; line-height: 1.1; font-weight: 400;
    color: #f0f5f2; margin: 0;
  }
  .lb-hero-sub { margin: 0.45rem 0 0; font-size: 0.74rem; color: rgba(202, 210, 197, 0.82); }

  /* ── Stat grid ── */
  .lb-grid {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 0.6rem; margin-top: 0.85rem;
  }
  .lb-stat {
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    border-radius: 16px;
    padding: 0.85rem 0.9rem;
    box-shadow: 0 1px 2px rgba(47,62,70,0.04);
  }
  .lb-stat-top { display: flex; align-items: center; gap: 0.45rem; }
  .lb-stat-chip {
    width: 28px; height: 28px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(132, 169, 140, 0.16); color: #354f52;
  }
  .lb-stat-chip.is-amber { background: rgba(196,156,74,0.16); color: #7a5a16; }
  .lb-stat-chip.is-blue  { background: rgba(82,121,111,0.14); color: #2f4a45; }
  .lb-stat-chip.is-slate { background: rgba(122,142,132,0.16); color: #4d5e57; }
  .lb-stat-label {
    font-size: 0.6rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
    color: #84a98c;
  }
  .lb-stat-value {
    margin-top: 0.55rem;
    font-size: 1.6rem; font-weight: 700; line-height: 1;
    color: #2f3e46; font-variant-numeric: tabular-nums;
  }
  .lb-stat-unit { font-size: 0.72rem; font-weight: 500; color: #9aa89f; margin-left: 0.25rem; }

  /* ── Usage bar ── */
  .lb-usage {
    margin-top: 0.85rem;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    border-radius: 16px;
    padding: 0.9rem 1rem;
    box-shadow: 0 1px 2px rgba(47,62,70,0.04);
  }
  .lb-usage-top {
    display: flex; align-items: baseline; justify-content: space-between;
    margin-bottom: 0.55rem;
  }
  .lb-usage-title { font-size: 0.78rem; font-weight: 600; color: #2f3e46; }
  .lb-usage-pct { font-size: 0.74rem; font-weight: 600; color: #52796f; font-variant-numeric: tabular-nums; }
  .lb-bar { height: 9px; border-radius: 999px; background: #eef2ef; overflow: hidden; }
  .lb-bar-fill {
    height: 100%; border-radius: 999px;
    background: linear-gradient(90deg, #52796f, #84a98c);
    transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .lb-usage-legend {
    margin-top: 0.55rem;
    display: flex; justify-content: space-between;
    font-size: 0.66rem; color: #7a8e84;
  }

  /* ── Note ── */
  .lb-note {
    margin-top: 0.85rem;
    font-size: 0.7rem; color: #7a8e84; line-height: 1.4;
    text-align: center; padding: 0 0.5rem;
  }

  /* ── States ── */
  .lb-skel {
    border-radius: 18px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: lb-skel 1.2s ease-in-out infinite;
  }
  .lb-empty, .lb-error {
    padding: 2rem 1rem; border-radius: 16px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center; color: #52796f;
  }
  .lb-error {
    border-color: rgba(192, 117, 106, 0.4); color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .lb-empty-glyph {
    width: 44px; height: 44px; margin: 0 auto 0.65rem; border-radius: 13px;
    background: rgba(132, 169, 140, 0.14);
    display: flex; align-items: center; justify-content: center; color: #52796f;
  }
  .lb-empty-title, .lb-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .lb-empty-sub, .lb-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .lb-retry {
    margin-top: 0.85rem;
    padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .lb-retry:active { transform: scale(0.97); }

  /* ── Toast ── */
  .lb-toast {
    position: fixed; left: 50%; transform: translateX(-50%);
    top: calc(0.9rem + env(safe-area-inset-top, 0px));
    z-index: 60; max-width: calc(100% - 2rem);
    padding: 0.6rem 1rem; border-radius: 12px;
    font-size: 0.78rem; font-weight: 500;
    box-shadow: 0 8px 24px rgba(47,62,70,0.18);
    animation: lb-fadeUp 0.25s ease both;
  }
  .lb-toast.is-success {
    background: linear-gradient(135deg, #f0f5f2, #eaf2ec);
    border-left: 3px solid #52796f; color: #2f3e46;
  }
  .lb-toast.is-error {
    background: linear-gradient(135deg, #fdf3f2, #fdecea);
    border-left: 3px solid #c0756a; color: #7a3028;
  }

  /* ── Request modal sheet ── */
  .lb-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(47, 62, 70, 0.42);
    z-index: 50;
    animation: lb-overlay-in 0.18s ease both;
    display: flex; flex-direction: column; justify-content: flex-end;
  }
  @keyframes lb-overlay-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes lb-sheet-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .lb-sheet {
    background: #fff;
    border-radius: 18px 18px 0 0;
    max-height: 92vh; overflow-y: auto;
    box-shadow: 0 -8px 24px rgba(47, 62, 70, 0.18);
    animation: lb-sheet-in 0.25s cubic-bezier(0.22,1,0.36,1) both;
    padding: 0.85rem 1rem 1.1rem;
    padding-bottom: calc(1.1rem + env(safe-area-inset-bottom, 0px));
  }
  .lb-sheet-grip {
    width: 38px; height: 4px; border-radius: 999px;
    background: rgba(132, 169, 140, 0.4);
    margin: 0 auto 0.7rem;
  }
  .lb-sheet-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.3rem; font-weight: 500; color: #2f3e46;
    margin: 0 0 0.25rem;
  }
  .lb-sheet-sub {
    font-size: 0.7rem; color: #84a98c;
    margin: 0 0 0.9rem; letter-spacing: 0.04em;
  }
  .lb-form-row { margin-bottom: 0.7rem; }
  .lb-form-row.is-double { display: flex; gap: 0.5rem; }
  .lb-form-row.is-double .lb-form-field { flex: 1; min-width: 0; }
  .lb-form-label {
    display: block;
    font-size: 0.6rem; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: #84a98c; margin: 0 0 4px;
  }
  .lb-form-input, .lb-form-select, .lb-form-textarea {
    width: 100%;
    padding: 0.65rem 0.75rem;
    border: 1.5px solid #d4ddd6; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 0.9rem;
    color: #2f3e46; background: #fff; outline: none;
    -webkit-appearance: none; appearance: none;
    box-sizing: border-box; font-variant-numeric: tabular-nums;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .lb-form-input:focus, .lb-form-select:focus, .lb-form-textarea:focus {
    border-color: #52796f;
    box-shadow: 0 0 0 3px rgba(82,121,111,0.12);
  }
  .lb-form-textarea {
    min-height: 84px; font-family: 'DM Sans', sans-serif; resize: vertical;
  }
  .lb-half-row { display: flex; gap: 0.35rem; margin-top: 6px; }
  .lb-half-chip {
    flex: 1;
    border: 1px solid #d4ddd6; background: #fff; color: #354f52;
    border-radius: 8px; padding: 0.4rem 0.5rem;
    font-size: 0.7rem; font-weight: 600; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .lb-half-chip.is-on { background: #52796f; border-color: #52796f; color: #fff; }
  .lb-sheet-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .lb-sheet-btn {
    flex: 1; padding: 0.7rem 0.7rem; border-radius: 12px;
    font-size: 0.82rem; font-weight: 600; letter-spacing: 0.04em;
    border: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
    display: flex; align-items: center; justify-content: center; gap: 0.4rem;
    transition: transform 0.12s;
  }
  .lb-sheet-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .lb-sheet-btn:not(:disabled):active { transform: scale(0.97); }
  .lb-sheet-btn.is-primary {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; box-shadow: 0 3px 10px rgba(53,79,82,0.22);
  }
  .lb-sheet-btn.is-secondary { background: #f1f4f0; color: #52796f; }
  .lb-mini-spin {
    width: 11px; height: 11px;
    border: 2px solid currentColor; border-top-color: transparent;
    border-radius: 50%;
    animation: lb-spin 0.7s linear infinite;
  }
`;

const RING_SIZE = 104;
const RING_STROKE = 9;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_R;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Trim trailing ".0" so 12.5 stays but 12.0 shows as 12.
function fmt(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// Leave types offered in the request sheet — mirrors the Calendar request form.
function toYMD(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function CalIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function PlusIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function LeaveBalance() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState(() => {
    const t = toYMD(new Date());
    return {
      leaveType: 'Annual Leave',
      startDate: t,
      endDate: t,
      startHalfDay: 'full',
      endHalfDay: 'full',
      reason: '',
    };
  });

  function flash(kind, text) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 2800);
  }

  async function fetchBalance() {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const user = await getUser();
      const userId = user?._id || user?.id || user?.userId;
      if (!userId) {
        setError('Could not determine your employee record.');
        return;
      }
      const { data } = await api.get(`/leave/balances/current/${userId}`);
      const b = data?.data || data;
      if (!b || typeof b !== 'object' || Array.isArray(b)) {
        setNotConfigured(true);
        return;
      }
      setBalance(b);
    } catch (err) {
      // 404 = no balance set up for this user yet (mirrors web behaviour).
      if (err?.response?.status === 404) {
        setNotConfigured(true);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBalance();
  }, []);

  // Lock the swipe-back stage while the sheet is open so background content
  // doesn't scroll/pan behind it (mirrors the Calendar request sheet).
  useEffect(() => {
    if (!modalOpen) return undefined;
    const stage = document.querySelector('.tg-stage-inner');
    if (!stage) return undefined;
    const prevOverflow = stage.style.overflow;
    const prevTouch = stage.style.touchAction;
    const scrollTop = stage.scrollTop;
    stage.style.overflow = 'hidden';
    stage.style.touchAction = 'none';
    const blockTouch = (e) => {
      if (e.target.closest('.lb-sheet')) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', blockTouch, { passive: false });
    return () => {
      stage.style.overflow = prevOverflow;
      stage.style.touchAction = prevTouch;
      stage.scrollTop = scrollTop;
      document.removeEventListener('touchmove', blockTouch);
    };
  }, [modalOpen]);

  function openModal() {
    const t = toYMD(new Date());
    setForm({
      leaveType: 'Annual Leave',
      startDate: t,
      endDate: t,
      startHalfDay: 'full',
      endHalfDay: 'full',
      reason: '',
    });
    setModalOpen(true);
  }

  async function submitRequest(e) {
    e?.preventDefault?.();
    if (!form.leaveType || !form.startDate || !form.endDate) {
      flash('error', 'Type, start and end date are required');
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      flash('error', "End date can't be before start");
      return;
    }
    if ((form.reason || '').trim().length < 10) {
      flash('error', 'Please give a reason (10+ characters)');
      return;
    }
    setSubmitting(true);
    try {
      const days = Math.max(1, Math.round(
        (new Date(form.endDate) - new Date(form.startDate)) / (1000 * 60 * 60 * 24)
      ) + 1) - (form.startHalfDay !== 'full' ? 0.5 : 0) - (form.endHalfDay !== 'full' ? 0.5 : 0);
      await api.post('/leave/request', {
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        numberOfDays: Math.max(0.5, days),
        reason: form.reason.trim(),
        startHalfDay: form.startHalfDay,
        endHalfDay: form.endHalfDay,
      });
      flash('success', 'Leave requested');
      setModalOpen(false);
      fetchBalance();
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Derived figures. Field precedence mirrors the web LeaveBalanceSummary:
  // prefer the server's canonical daysUsed / totalDays / remainingDays and fall
  // back to raw fields only for older responses.
  const entitlement = balance ? num(balance.entitlementDays ?? balance.totalDays) : 0;
  const carryOver = balance ? num(balance.carryOverDays) : 0;
  const used = balance
    ? (balance.daysUsed != null
        ? num(balance.daysUsed)
        : balance.totalTaken != null
          ? num(balance.totalTaken)
          : num(balance.usedDays))
    : 0;
  const total = balance && balance.totalDays != null ? num(balance.totalDays) : entitlement + carryOver;
  const remaining = balance && balance.remainingDays != null
    ? num(balance.remainingDays)
    : Math.max(0, total - used);
  const usedPct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const ringOffset = RING_CIRC * (1 - (total > 0 ? remaining / total : 0));

  return (
    <>
      <style>{styles}</style>
      <div className="lb-wrap">
        <header className="lb-header lb-anim">
          <div className="lb-header-icon"><CalIcon /></div>
          <div className="lb-header-text">
            <p className="lb-header-eyebrow">Annual Leave</p>
            <h1 className="lb-header-title">Leave Balance</h1>
          </div>
          <div className="lb-header-actions">
            <button
              type="button"
              className="lb-request"
              onClick={openModal}
              disabled={loading}
              aria-label="Request leave"
            >
              <PlusIcon size={15} />
              Request Leave
            </button>
            <button
              type="button"
              className={`lb-refresh${loading ? ' is-loading' : ''}`}
              onClick={fetchBalance}
              disabled={loading}
              aria-label="Refresh balance"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 2v6h-6M3 22v-6h6" />
                <path d="M3.5 9a9 9 0 0 1 14.85-3.36L21 8M20.5 15a9 9 0 0 1-14.85 3.36L3 16" />
              </svg>
            </button>
          </div>
        </header>

        {loading ? (
          <>
            <div className="lb-skel" style={{ height: 152 }} />
            <div className="lb-grid">
              <div className="lb-skel" style={{ height: 92 }} />
              <div className="lb-skel" style={{ height: 92 }} />
              <div className="lb-skel" style={{ height: 92 }} />
              <div className="lb-skel" style={{ height: 92 }} />
            </div>
          </>
        ) : error ? (
          <div className="lb-error lb-anim">
            <p className="lb-error-title">Couldn't load your balance</p>
            <p className="lb-error-sub">{error}</p>
            <button className="lb-retry" onClick={fetchBalance}>Try again</button>
          </div>
        ) : notConfigured ? (
          <div className="lb-empty lb-anim">
            <div className="lb-empty-glyph"><CalIcon size={20} /></div>
            <p className="lb-empty-title">Balance not set up yet</p>
            <p className="lb-empty-sub">
              Your leave entitlement hasn’t been configured. Please contact HR.
            </p>
          </div>
        ) : (
          <>
            <div className="lb-hero lb-anim">
              <div className="lb-ring-wrap">
                <svg className="lb-ring-svg" width={RING_SIZE} height={RING_SIZE}>
                  <circle
                    className="lb-ring-track"
                    cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                    fill="none" strokeWidth={RING_STROKE}
                  />
                  <circle
                    className="lb-ring-fill"
                    cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                    fill="none" strokeWidth={RING_STROKE}
                    strokeDasharray={RING_CIRC}
                    strokeDashoffset={ringOffset}
                    style={{ '--lb-circ': RING_CIRC }}
                  />
                </svg>
                <div className="lb-ring-center">
                  <span className="lb-ring-num">{fmt(remaining)}</span>
                  <span className="lb-ring-label">Days left</span>
                </div>
              </div>
              <div className="lb-hero-side">
                <p className="lb-hero-eyebrow">Remaining</p>
                <h2 className="lb-hero-headline">{fmt(remaining)} of {fmt(total)} days</h2>
                <p className="lb-hero-sub">
                  {remaining > 0
                    ? `You’ve used ${fmt(used)} day${used === 1 ? '' : 's'} so far.`
                    : 'You’ve used your full allowance.'}
                </p>
              </div>
            </div>

            <div className="lb-grid">
              <Stat tone="" icon="cal" label="Entitlement" value={entitlement} />
              <Stat tone="is-blue" icon="gift" label="Carry-over" value={carryOver} />
              <Stat tone="is-amber" icon="minus" label="Used" value={used} />
              <Stat tone="is-slate" icon="clock" label="Remaining" value={remaining} />
            </div>

            <div className="lb-usage lb-anim">
              <div className="lb-usage-top">
                <span className="lb-usage-title">Leaves Used</span>
                <span className="lb-usage-pct">{usedPct}%</span>
              </div>
              <div className="lb-bar">
                <div className="lb-bar-fill" style={{ width: `${usedPct}%` }} />
              </div>
              <div className="lb-usage-legend">
                <span>{fmt(used)} used</span>
                <span>{fmt(remaining)} left</span>
              </div>
            </div>

            {balance?.year && (
              <p className="lb-note">Allowance year: {balance.year}</p>
            )}
          </>
        )}
      </div>

      {toast && createPortal(
        <div className={`lb-toast ${toast.kind === 'success' ? 'is-success' : 'is-error'}`}>
          {toast.text}
        </div>,
        document.body,
      )}

      {modalOpen && createPortal(
        <div
          className="lb-modal-overlay"
          onClick={() => !submitting && setModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <form className="lb-sheet" onClick={(e) => e.stopPropagation()} onSubmit={submitRequest}>
            <div className="lb-sheet-grip" />
            <h2 className="lb-sheet-title">Request Leave</h2>
            <p className="lb-sheet-sub">Submit a new leave request</p>

            <div className="lb-form-row">
              <label className="lb-form-label">Leave Type</label>
              <select
                className="lb-form-select"
                value={form.leaveType}
                onChange={(e) => setForm((f) => ({ ...f, leaveType: e.target.value }))}
              >
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="lb-form-row is-double">
              <div className="lb-form-field">
                <label className="lb-form-label">Start Date</label>
                <input
                  type="date"
                  className="lb-form-input"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    startDate: e.target.value,
                    endDate: f.endDate < e.target.value ? e.target.value : f.endDate,
                  }))}
                />
                <div className="lb-half-row">
                  {[['full', 'Full'], ['am', 'AM'], ['pm', 'PM']].map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      className={`lb-half-chip${form.startHalfDay === k ? ' is-on' : ''}`}
                      onClick={() => setForm((f) => ({ ...f, startHalfDay: k }))}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="lb-form-field">
                <label className="lb-form-label">End Date</label>
                <input
                  type="date"
                  className="lb-form-input"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
                <div className="lb-half-row">
                  {[['full', 'Full'], ['am', 'AM'], ['pm', 'PM']].map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      className={`lb-half-chip${form.endHalfDay === k ? ' is-on' : ''}`}
                      onClick={() => setForm((f) => ({ ...f, endHalfDay: k }))}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lb-form-row">
              <label className="lb-form-label">Reason</label>
              <textarea
                className="lb-form-textarea"
                placeholder="A short reason for the leave…"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                maxLength={500}
              />
            </div>

            <div className="lb-sheet-actions">
              <button
                type="button"
                className="lb-sheet-btn is-secondary"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="lb-sheet-btn is-primary" disabled={submitting}>
                {submitting ? <span className="lb-mini-spin" /> : null}
                Submit
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}

const STAT_ICONS = {
  cal:   'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18',
  gift:  'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  minus: 'M5 12h14',
  clock: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM12 6v6l4 2',
};

function Stat({ tone, icon, label, value }) {
  return (
    <div className="lb-stat lb-anim">
      <div className="lb-stat-top">
        <span className={`lb-stat-chip ${tone}`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={STAT_ICONS[icon] || STAT_ICONS.cal} />
          </svg>
        </span>
        <span className="lb-stat-label">{label}</span>
      </div>
      <div className="lb-stat-value">{fmt(value)}<span className="lb-stat-unit">days</span></div>
    </div>
  );
}
