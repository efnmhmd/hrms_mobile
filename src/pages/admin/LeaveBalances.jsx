import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Admin view of annual-leave balances across the whole organisation, with
// inline editing. Mirrors web AnnualLeaveBalance.js:
//   GET /leave/balances?current=true&includeAll=true → { data: [{ _id, user:{...}, entitlementDays, carryOverDays, daysUsed, usedDays, totalTaken, pendingDays, totalDays, remainingDays, hasBalance }] }
//   PUT /leave/admin/balance/:userId                 → { entitlementDays, carryOverDays, reason } (reason required)
// Remaining = entitlement + carry-over − used. One bulk call (each row carries
// its embedded user), unlike the manager screen's per-member fetch.

const styles = `
  @keyframes alb-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes alb-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes alb-spin { to { transform: rotate(360deg); } }
  @keyframes alb-sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes alb-fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .alb-wrap { padding: 0.85rem 1rem 6rem; }
  .alb-anim { animation: alb-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  .alb-header { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.25rem 0.85rem; }
  .alb-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18); flex-shrink: 0;
  }
  .alb-header-text { min-width: 0; flex: 1; }
  .alb-header-eyebrow { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .alb-header-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1; font-weight: 400; color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0; }
  .alb-count { font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem; }
  .alb-refresh {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .alb-refresh:disabled { opacity: 0.55; }
  .alb-refresh:not(:disabled):active { transform: scale(0.94); }
  .alb-refresh.is-busy svg { animation: alb-spin 0.8s linear infinite; }

  /* ── Org summary hero ── */
  .alb-hero {
    position: relative; overflow: hidden; border-radius: 20px;
    background:
      radial-gradient(ellipse at 0% 0%, rgba(132, 169, 140, 0.32) 0%, transparent 55%),
      radial-gradient(ellipse at 100% 100%, rgba(53, 79, 82, 0.6) 0%, transparent 60%),
      linear-gradient(135deg, #354f52 0%, #52796f 100%);
    padding: 1.05rem 1.15rem; margin-bottom: 0.85rem;
    box-shadow: 0 10px 26px rgba(47, 62, 70, 0.16); color: #cad2c5;
  }
  .alb-hero-eyebrow { font-size: 0.58rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #9ec0a6; margin: 0 0 0.7rem; }
  .alb-hero-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
  .alb-hero-cell { text-align: center; }
  .alb-hero-num { font-family: 'Cormorant Garamond', serif; font-size: 1.7rem; line-height: 1; font-weight: 500; color: #f0f5f2; font-variant-numeric: tabular-nums; }
  .alb-hero-lab { margin-top: 4px; font-size: 0.55rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(202, 210, 197, 0.75); }
  .alb-hero-skel { height: 26px; border-radius: 7px; background: rgba(202, 210, 197, 0.18); animation: alb-skel 1.2s ease-in-out infinite; }

  /* ── Search + sort ── */
  .alb-search { position: relative; margin-bottom: 0.6rem; }
  .alb-search svg { position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%); color: #84a98c; pointer-events: none; }
  .alb-search input {
    width: 100%; padding: 0.65rem 0.75rem 0.65rem 2.2rem; border-radius: 12px;
    border: 1.5px solid #d4ddd6; background: #fff; font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46;
    -webkit-appearance: none; appearance: none; box-sizing: border-box; -webkit-tap-highlight-color: transparent;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .alb-search input::placeholder { color: #a7b6ac; }
  .alb-search input:focus { outline: none; border-color: #52796f; box-shadow: 0 0 0 3px rgba(82, 121, 111, 0.12); }

  .alb-chips { display: flex; gap: 0.4rem; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 0.85rem; padding-bottom: 4px; }
  .alb-chips::-webkit-scrollbar { display: none; }
  .alb-chip {
    flex-shrink: 0; padding: 0.42rem 0.8rem; border-radius: 999px; font-size: 0.74rem; font-weight: 600; letter-spacing: 0.04em;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .alb-chip.is-active { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; border-color: transparent; }

  /* ── Member card ── */
  .alb-card {
    display: flex; align-items: center; gap: 0.7rem; width: 100%; text-align: left;
    padding: 0.7rem 0.8rem; border-radius: 15px; background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.5rem; font-family: 'DM Sans', sans-serif; cursor: pointer;
    -webkit-tap-highlight-color: transparent; transition: transform 0.12s, background 0.15s;
    border-left: 3px solid transparent;
  }
  .alb-card:active { transform: scale(0.985); background: #f7f8f6; }
  .alb-card.is-low { border-left-color: #c0756a; }
  .alb-card.is-mid { border-left-color: #d8a64c; }
  .alb-avatar {
    width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 700;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.28), rgba(82, 121, 111, 0.18)); color: #354f52;
  }
  .alb-body { min-width: 0; flex: 1; display: flex; flex-direction: column; align-items: stretch; }
  .alb-name { display: block; max-width: 100%; font-size: 0.88rem; font-weight: 600; color: #2f3e46; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .alb-sub { display: block; max-width: 100%; margin-top: 1px; font-size: 0.7rem; color: #7a8e84; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .alb-bar { display: block; margin-top: 0.5rem; height: 6px; border-radius: 999px; background: #eef2ef; overflow: hidden; }
  .alb-bar-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #52796f, #84a98c); }
  .alb-bar-fill.is-low { background: linear-gradient(90deg, #c0756a, #d89a8f); }
  .alb-bar-fill.is-mid { background: linear-gradient(90deg, #c49c4a, #e0c074); }
  .alb-barmeta { margin-top: 0.35rem; font-size: 0.65rem; color: #7a8e84; display: flex; gap: 0.5rem; }
  .alb-barmeta strong { color: #52796f; font-weight: 700; }
  .alb-notset { font-size: 0.68rem; color: #b08a5a; margin-top: 0.4rem; font-style: italic; }

  .alb-right { flex-shrink: 0; text-align: right; display: flex; align-items: center; gap: 0.5rem; }
  .alb-rem { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
  .alb-rem-num { display: block; font-family: 'Cormorant Garamond', serif; font-size: 1.55rem; line-height: 1; font-weight: 500; color: #2f3e46; font-variant-numeric: tabular-nums; }
  .alb-rem-lab { display: block; font-size: 0.52rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #84a98c; margin-top: 2px; }
  .alb-rem-num.is-low { color: #b85c50; }
  .alb-rem-dash { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; color: #b8c4bc; }
  .alb-edit-glyph { color: #b8c4bc; flex-shrink: 0; }

  /* ── States ── */
  .alb-skel { height: 84px; border-radius: 15px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%); animation: alb-skel 1.2s ease-in-out infinite; margin-bottom: 0.5rem; }
  .alb-empty, .alb-error {
    padding: 2rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .alb-error { border-color: rgba(192, 117, 106, 0.4); color: #7a3028; background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55); }
  .alb-empty-title, .alb-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .alb-empty-sub, .alb-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .alb-retry { margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .alb-retry:active { transform: scale(0.97); }

  /* ── Toast ── */
  .alb-banner {
    position: fixed; left: 1rem; right: 1rem; bottom: calc(72px + env(safe-area-inset-bottom, 0px)); z-index: 60;
    padding: 0.7rem 0.95rem; border-radius: 12px; font-size: 0.8rem; font-weight: 500;
    box-shadow: 0 8px 24px rgba(47,62,70,0.18); animation: alb-fadeUp 0.3s ease both;
  }
  .alb-banner.is-success { background: #2f3e46; color: #eaf2ec; border-left: 3px solid #84a98c; }
  .alb-banner.is-error { background: #7a3028; color: #fdecea; border-left: 3px solid #c0756a; }

  /* ── Edit sheet ── */
  .alb-overlay {
    position: fixed; inset: 0; z-index: 50; background: rgba(47,62,70,0.55); backdrop-filter: blur(3px);
    display: flex; align-items: flex-end; justify-content: center; animation: alb-fadeIn 0.2s ease;
  }
  .alb-sheet {
    background: #f7f8f6; width: 100%; max-width: 640px; border-radius: 20px 20px 0 0; max-height: 92vh;
    display: flex; flex-direction: column; animation: alb-sheetUp 0.28s cubic-bezier(0.22,1,0.36,1); overflow: hidden;
  }
  .alb-sheet-head {
    flex-shrink: 0; padding: 0.85rem 1rem 0.75rem; background: #fff; border-bottom: 1px solid #eaefeb;
    display: flex; align-items: flex-start; gap: 0.75rem;
  }
  .alb-sheet-avatar {
    width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    color: #cad2c5; font-size: 1rem; font-weight: 700;
    background: linear-gradient(135deg, #354f52 0%, #52796f 60%, #84a98c 100%); border: 2px solid #fff; box-shadow: 0 3px 10px rgba(53,79,82,0.18);
  }
  .alb-sheet-head-text { flex: 1; min-width: 0; }
  .alb-sheet-eyebrow { font-size: 0.58rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .alb-sheet-title { font-family: 'Cormorant Garamond', serif; font-weight: 400; font-size: 1.3rem; line-height: 1.15; letter-spacing: -0.01em; margin: 0.1rem 0 0; color: #2f3e46; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .alb-sheet-sub { font-size: 0.72rem; margin: 0.15rem 0 0; color: #52796f; line-height: 1.4; }
  .alb-sheet-close {
    flex-shrink: 0; width: 32px; height: 32px; border-radius: 8px; background: #f0f5f2; border: 1px solid #eaefeb; color: #52796f;
    display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .alb-sheet-body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 1rem; }
  .alb-sheet-footer {
    flex-shrink: 0; padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px)); border-top: 1px solid #eaefeb; background: #fff;
    display: flex; gap: 0.5rem;
  }
  .alb-sheet-footer .alb-btn { flex: 1; }

  .alb-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 1rem; }
  .alb-summary-cell { text-align: center; background: #fff; border: 1px solid #eaefeb; border-radius: 12px; padding: 0.65rem 0.4rem; }
  .alb-summary-num { font-family: 'Cormorant Garamond', serif; font-size: 1.4rem; line-height: 1; font-weight: 500; color: #2f3e46; font-variant-numeric: tabular-nums; }
  .alb-summary-lab { font-size: 0.55rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #84a98c; margin-top: 4px; }

  .alb-label { display: block; font-size: 0.62rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #52796f; margin-bottom: 0.4rem; }
  .alb-label .req { color: #c0756a; margin-left: 2px; }
  .alb-input, .alb-textarea {
    width: 100%; padding: 0.65rem 0.85rem; border: 1.5px solid #d4ddd6; border-radius: 10px;
    font-size: 16px; color: #2f3e46; background: #fff; outline: none; box-sizing: border-box;
    transition: border-color 0.2s, box-shadow 0.2s; font-family: 'DM Sans', sans-serif;
  }
  .alb-input:focus, .alb-textarea:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }
  .alb-textarea { resize: vertical; min-height: 64px; }
  .alb-hint { font-size: 0.66rem; color: #8fa99a; margin: 0.3rem 0 0; }
  .alb-field { margin-bottom: 1rem; }
  .alb-field:last-child { margin-bottom: 0; }
  .alb-form-error { background: #fdecea; color: #7a3028; border-left: 3px solid #c0756a; border-radius: 8px; padding: 0.6rem 0.8rem; font-size: 0.76rem; margin-bottom: 0.85rem; }

  .alb-btn {
    border: none; border-radius: 10px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.03em; padding: 0.65rem 0.85rem;
    display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; -webkit-tap-highlight-color: transparent; cursor: pointer; transition: transform 0.12s;
  }
  .alb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .alb-btn:not(:disabled):active { transform: scale(0.97); }
  .alb-btn-primary { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; box-shadow: 0 3px 10px rgba(53,79,82,0.22); }
  .alb-btn-ghost { background: #fff; color: #52796f; border: 1.5px solid #d4ddd6; }
  .alb-mini-spin { width: 13px; height: 13px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: alb-spin 0.7s linear infinite; }
`;

const SORTS = [
  { key: 'least', label: 'Least left' },
  { key: 'most',  label: 'Most left' },
  { key: 'name',  label: 'Name' },
  { key: 'used',  label: 'Most used' },
];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function fmt(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
function initials(name, email) {
  const parts = (name || '').trim().split(/\s+/);
  const ini = parts.length > 1
    ? `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`
    : (parts[0] || '').slice(0, 2);
  return ini.toUpperCase() || (email || '?').charAt(0).toUpperCase();
}

// Map a raw bulk-balance doc (with embedded `user`) into a flat row.
function toRow(b) {
  const u = b.user || {};
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown';
  const entitlement = num(b.entitlementDays);
  const carryOver = num(b.carryOverDays);
  // Prefer the server's canonical daysUsed (= ALL approved leave taken) over the
  // raw stored usedDays (annual-only, often stale) — mirrors the web app.
  const used = b.daysUsed != null
    ? num(b.daysUsed)
    : b.totalTaken != null
      ? num(b.totalTaken)
      : num(b.usedDays);
  const pending = num(b.pendingDays);
  const total = b.totalDays != null ? num(b.totalDays) : entitlement + carryOver;
  const remaining = b.remainingDays != null ? num(b.remainingDays) : Math.max(0, total - used);
  const configured = b.hasBalance !== false && !b.needsInitialization;
  return {
    balanceId: b._id,
    userId: u._id || b.userId,
    name,
    department: u.department || '',
    jobTitle: u.jobTitle || '',
    email: u.email || '',
    entitlement, carryOver, used, pending, total, remaining,
    configured,
  };
}

export default function AdminLeaveBalances() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('least');
  const [banner, setBanner] = useState(null);

  // Edit sheet
  const [editing, setEditing] = useState(null);
  const [entitlement, setEntitlement] = useState('');
  const [carryOver, setCarryOver] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 2800);
  }

  async function fetchData(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/leave/balances', {
        params: { current: true, includeAll: true },
      });
      const payload = data?.data || (Array.isArray(data) ? data : []);
      setRows(payload.map(toRow));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const totals = useMemo(() => {
    let remaining = 0, used = 0;
    for (const r of rows) {
      if (r.configured) { remaining += r.remaining; used += r.used; }
    }
    return { remaining, used, members: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((r) =>
        [r.name, r.email, r.department, r.jobTitle].filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    const sorted = [...list];
    const rem = (r) => (r.configured ? r.remaining : Infinity);
    sorted.sort((a, b) => {
      switch (sort) {
        case 'most': return (b.configured ? b.remaining : -1) - (a.configured ? a.remaining : -1);
        case 'used': return (b.configured ? b.used : -1) - (a.configured ? a.used : -1);
        case 'name': return a.name.localeCompare(b.name);
        case 'least':
        default: return rem(a) - rem(b);
      }
    });
    return sorted;
  }, [rows, search, sort]);

  function openEdit(row) {
    if (!row.userId) { flash('error', 'No user linked to this balance'); return; }
    setEditing(row);
    setEntitlement(String(row.entitlement || 28));
    setCarryOver(String(row.carryOver || 0));
    setReason('');
    setFormError(null);
  }
  function closeEdit() {
    setEditing(null);
    setReason('');
    setFormError(null);
  }
  async function saveEdit() {
    if (!editing?.userId) return;
    if (!reason.trim()) { setFormError('Please provide a reason for the adjustment.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      await api.put(`/leave/admin/balance/${editing.userId}`, {
        entitlementDays: parseInt(entitlement, 10) || 0,
        carryOverDays: parseInt(carryOver, 10) || 0,
        reason: reason.trim(),
      });
      await fetchData(true);
      flash('success', `Updated ${editing.name}'s balance`);
      closeEdit();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{styles}</style>
      <div className="alb-wrap">
        <header className="alb-header alb-anim">
          <div className="alb-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <div className="alb-header-text">
            <p className="alb-header-eyebrow">Annual Leave</p>
            <h1 className="alb-header-title">
              Leave Balances
              {!loading && !error && <span className="alb-count"> · {filtered.length}</span>}
            </h1>
          </div>
          <button
            type="button"
            className={`alb-refresh${refreshing ? ' is-busy' : ''}`}
            onClick={() => fetchData(true)}
            disabled={loading || refreshing}
            aria-label="Refresh balances"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </header>

        {!error && (
          <div className="alb-hero alb-anim">
            <p className="alb-hero-eyebrow">Across the organisation</p>
            <div className="alb-hero-grid">
              <div className="alb-hero-cell">
                {loading ? <div className="alb-hero-skel" /> : <div className="alb-hero-num">{fmt(totals.remaining)}</div>}
                <div className="alb-hero-lab">Days left</div>
              </div>
              <div className="alb-hero-cell">
                {loading ? <div className="alb-hero-skel" /> : <div className="alb-hero-num">{fmt(totals.used)}</div>}
                <div className="alb-hero-lab">Days used</div>
              </div>
              <div className="alb-hero-cell">
                {loading ? <div className="alb-hero-skel" /> : <div className="alb-hero-num">{totals.members}</div>}
                <div className="alb-hero-lab">People</div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <div className="alb-search alb-anim">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, department…"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <div className="alb-chips alb-anim">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`alb-chip ${sort === s.key ? 'is-active' : ''}`}
                  onClick={() => setSort(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}

        {loading ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="alb-skel" />)}
          </div>
        ) : error ? (
          <div className="alb-error alb-anim">
            <p className="alb-error-title">Couldn't load leave balances</p>
            <p className="alb-error-sub">{error}</p>
            <button className="alb-retry" onClick={() => fetchData()}>Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="alb-empty alb-anim">
            <p className="alb-empty-title">{rows.length === 0 ? 'No balances yet' : 'No matches'}</p>
            <p className="alb-empty-sub">
              {rows.length === 0 ? 'No leave balance records were found.' : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          filtered.map((r, i) => {
            const usedPct = r.configured && r.total > 0 ? Math.min(100, Math.round((r.used / r.total) * 100)) : 0;
            const remPct = r.configured && r.total > 0 ? (r.remaining / r.total) * 100 : 100;
            const tone = !r.configured ? '' : remPct <= 25 ? 'is-low' : remPct <= 50 ? 'is-mid' : '';
            return (
              <button
                key={r.balanceId || r.userId || i}
                type="button"
                className={`alb-card alb-anim ${tone}`}
                style={{ animationDelay: `${Math.min(i, 6) * 25}ms` }}
                onClick={() => openEdit(r)}
              >
                <span className="alb-avatar">{initials(r.name, r.email)}</span>
                <span className="alb-body">
                  <span className="alb-name">{r.name}</span>
                  <span className="alb-sub">
                    {[r.department, r.jobTitle].filter(Boolean).join(' · ') || r.email || ''}
                  </span>
                  {r.configured ? (
                    <>
                      <span className="alb-bar">
                        <span className={`alb-bar-fill ${tone}`} style={{ width: `${usedPct}%` }} />
                      </span>
                      <span className="alb-barmeta">
                        <span><strong>{fmt(r.used)}</strong> used</span>
                        <span>of {fmt(r.total)} days</span>
                        {r.pending > 0 && <span>· {fmt(r.pending)} pending</span>}
                      </span>
                    </>
                  ) : (
                    <span className="alb-notset">Balance not set up · tap to configure</span>
                  )}
                </span>
                <span className="alb-right">
                  <span className="alb-rem">
                    {r.configured ? (
                      <>
                        <span className={`alb-rem-num ${tone === 'is-low' ? 'is-low' : ''}`}>{fmt(r.remaining)}</span>
                        <span className="alb-rem-lab">Days left</span>
                      </>
                    ) : (
                      <span className="alb-rem-dash">—</span>
                    )}
                  </span>
                  <svg className="alb-edit-glyph" width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
                  </svg>
                </span>
              </button>
            );
          })
        )}
      </div>

      {banner && <div className={`alb-banner is-${banner.kind}`}>{banner.text}</div>}

      {editing && createPortal((
        <div className="alb-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeEdit(); }}>
          <div className="alb-sheet">
            <div className="alb-sheet-head">
              <div className="alb-sheet-avatar">{initials(editing.name, editing.email)}</div>
              <div className="alb-sheet-head-text">
                <p className="alb-sheet-eyebrow">Adjust allocation</p>
                <h2 className="alb-sheet-title">{editing.name}</h2>
                <p className="alb-sheet-sub">{[editing.department, editing.jobTitle].filter(Boolean).join(' · ') || editing.email}</p>
              </div>
              <button type="button" className="alb-sheet-close" onClick={closeEdit} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="alb-sheet-body">
              <div className="alb-summary-grid">
                <div className="alb-summary-cell">
                  <div className="alb-summary-num">{fmt(editing.total)}</div>
                  <div className="alb-summary-lab">Total</div>
                </div>
                <div className="alb-summary-cell">
                  <div className="alb-summary-num">{fmt(editing.used)}</div>
                  <div className="alb-summary-lab">Used</div>
                </div>
                <div className="alb-summary-cell">
                  <div className="alb-summary-num">{fmt(editing.remaining)}</div>
                  <div className="alb-summary-lab">Left</div>
                </div>
              </div>

              {formError && <div className="alb-form-error">{formError}</div>}

              <div className="alb-field">
                <label className="alb-label">Annual entitlement (days)<span className="req">*</span></label>
                <input
                  type="number" inputMode="numeric" min="0" max="60"
                  className="alb-input"
                  value={entitlement}
                  onChange={(e) => setEntitlement(e.target.value)}
                />
                <p className="alb-hint">Current: {fmt(editing.entitlement)} days · Standard UK: 28 days</p>
              </div>

              <div className="alb-field">
                <label className="alb-label">Carry-over days</label>
                <input
                  type="number" inputMode="numeric" min="0" max="60"
                  className="alb-input"
                  value={carryOver}
                  onChange={(e) => setCarryOver(e.target.value)}
                />
              </div>

              <div className="alb-field">
                <label className="alb-label">Reason for adjustment<span className="req">*</span></label>
                <textarea
                  className="alb-textarea"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Annual reset, correction, pro-rata for new starter…"
                />
              </div>
            </div>
            <div className="alb-sheet-footer">
              <button type="button" className="alb-btn alb-btn-ghost" onClick={closeEdit}>Cancel</button>
              <button type="button" className="alb-btn alb-btn-primary" disabled={saving} onClick={saveEdit}>
                {saving ? <span className="alb-mini-spin" /> : null}
                Save balance
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  );
}
