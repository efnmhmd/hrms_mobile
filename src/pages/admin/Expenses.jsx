import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Admin / manager expense reporting. Reads the same approvals feed the web
// admin dashboard uses (/expenses/approvals). Summarises spend by status,
// lets you search/filter, approve/decline pending claims in place
// (POST /expenses/:id/approve · /expenses/:id/decline), and file a claim
// ON BEHALF OF an employee (the "+ New claim" pill → POST /expenses with an
// `onBehalfOf` id). The backend records the picked employee as the claimant and
// the acting admin/manager as `submittedBy`. Org scope can file for anyone;
// team scope is limited to direct reports (the server enforces this too).

const CATEGORIES = ['Travel', 'Meals', 'Accommodation', 'Office Supplies', 'Software', 'Training', 'Other'];

// Receipt/document upload — mirror the backend multer limits (expenseRoutes.js):
// a single JPEG/PNG/GIF/PDF, 10MB max. Validate client-side so an unsupported
// pick (e.g. an iOS HEIC photo) fails friendly instead of a raw server error.
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

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
  .ex-header-add {
    flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.3rem;
    height: 34px; padding: 0 0.8rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #f0f5f2;
    font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 600;
    cursor: pointer; -webkit-tap-highlight-color: transparent; box-shadow: 0 4px 12px rgba(53,79,82,0.22);
    transition: transform 0.12s;
  }
  .ex-header-add:active { transform: scale(0.96); }

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

  /* ── Approve / decline actions on a pending card ── */
  .ex-actions { display: flex; gap: 0.45rem; margin-top: 0.7rem; }
  .ex-btn {
    flex: 1; padding: 0.6rem 0.7rem; border-radius: 10px;
    font-size: 0.8rem; font-weight: 600; letter-spacing: 0.04em;
    border: none; -webkit-tap-highlight-color: transparent; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 0.35rem;
    transition: transform 0.12s, box-shadow 0.12s;
  }
  .ex-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .ex-btn:not(:disabled):active { transform: scale(0.97); }
  .ex-btn-approve { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; box-shadow: 0 3px 10px rgba(53,79,82,0.22); }
  .ex-btn-decline { background: #fff; color: #b85c50; border: 1.5px solid rgba(192,117,106,0.55); }
  .ex-mini-spin { width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: ex-spin 0.7s linear infinite; }

  /* ── Banner (transient toast) ── */
  .ex-banner { margin-bottom: 0.85rem; padding: 0.6rem 0.85rem; border-radius: 12px; font-size: 0.78rem; font-weight: 500; }
  .ex-banner.is-success { background: linear-gradient(135deg, #f0f5f2, #eaf2ec); border-left: 3px solid #52796f; color: #2f3e46; }
  .ex-banner.is-error { background: linear-gradient(135deg, #fdf3f2, #fdecea); border-left: 3px solid #c0756a; color: #7a3028; }

  /* ── Action bottom sheet (approve / decline) ── */
  @keyframes ex-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ex-sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .ex-overlay {
    position: fixed; inset: 0; background: rgba(31, 41, 38, 0.45); backdrop-filter: blur(2px);
    z-index: 50; display: flex; align-items: flex-end; animation: ex-fade 0.2s ease both;
  }
  .ex-sheet {
    width: 100%; max-height: 90vh; overflow-y: auto;
    background: #f6f8f4; border-radius: 22px 22px 0 0; padding: 1rem 1.1rem 1.5rem;
    box-shadow: 0 -8px 30px rgba(47, 62, 70, 0.2); animation: ex-sheetUp 0.3s cubic-bezier(0.22,1,0.36,1) both;
  }
  .ex-sheet-grip { width: 38px; height: 4px; border-radius: 999px; background: #cdd5cf; margin: 0 auto 0.85rem; }
  .ex-sheet-title { font-family: 'Cormorant Garamond', serif; font-size: 1.45rem; font-weight: 400; color: #2f3e46; margin: 0 0 0.25rem; }
  .ex-sheet-sub { font-size: 0.78rem; color: #7a8e84; margin: 0 0 0.85rem; }
  .ex-field { margin-bottom: 0.85rem; }
  .ex-field-label { display: block; font-size: 0.66rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #7a8e84; margin-bottom: 0.35rem; }
  .ex-optional { font-weight: 500; letter-spacing: 0; text-transform: none; color: #9aa8a0; }
  .ex-textarea {
    width: 100%; padding: 0.7rem 0.8rem; border: 1.5px solid #d4ddd6; border-radius: 12px;
    font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46; background: #fff; outline: none;
    box-sizing: border-box; -webkit-appearance: none; appearance: none;
    transition: border-color 0.18s, box-shadow 0.18s; min-height: 90px; resize: vertical; line-height: 1.5;
  }
  .ex-textarea:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }
  .ex-sheet-actions { display: flex; gap: 0.5rem; margin-top: 0.4rem; }
  .ex-sheet-btn {
    flex: 1; padding: 0.75rem; border-radius: 12px; font-size: 0.82rem; font-weight: 600; letter-spacing: 0.02em;
    border: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
    display: flex; align-items: center; justify-content: center; gap: 0.4rem; transition: transform 0.12s;
  }
  .ex-sheet-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .ex-sheet-btn:not(:disabled):active { transform: scale(0.98); }
  .ex-sheet-btn-cancel { background: #fff; color: #7a8e84; border: 1.5px solid #d4ddd6; }
  .ex-sheet-btn-approve { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #f0f5f2; box-shadow: 0 4px 14px rgba(53,79,82,0.2); }
  .ex-sheet-btn-decline { background: linear-gradient(135deg, #8a3f36 0%, #b85c50 100%); color: #fbeae7; box-shadow: 0 4px 14px rgba(138,63,54,0.2); }

  /* ── Create-claim form controls (reuses the .ex-sheet / .ex-field shell) ── */
  .ex-req { color: #b85c50; }
  .ex-input, .ex-select {
    width: 100%; padding: 0.7rem 0.8rem; border: 1.5px solid #d4ddd6; border-radius: 12px;
    font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46; background: #fff; outline: none;
    box-sizing: border-box; -webkit-appearance: none; appearance: none; transition: border-color 0.18s, box-shadow 0.18s;
  }
  .ex-input:focus, .ex-select:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }
  .ex-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .ex-amount-wrap { position: relative; }
  .ex-amount-cur { position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); color: #7a8e84; font-weight: 600; pointer-events: none; }
  .ex-amount-wrap .ex-input { padding-left: 1.7rem; }
  .ex-hint { font-size: 0.7rem; color: #9aa8a0; margin: 0.15rem 0 0; }

  /* Claim-type toggle */
  .ex-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; padding: 0.25rem; margin-bottom: 1rem; background: rgba(132, 169, 140, 0.12); border-radius: 13px; }
  .ex-toggle-btn {
    display: flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.6rem; border: none; border-radius: 10px;
    background: transparent; color: #52796f; font-family: 'DM Sans', sans-serif; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.02em;
    cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 0.15s, color 0.15s, box-shadow 0.15s;
  }
  .ex-toggle-btn.is-active { background: #fff; color: #2f3e46; box-shadow: 0 1px 4px rgba(47, 62, 70, 0.1); }
  .ex-toggle-btn:not(.is-active):active { transform: scale(0.97); }

  .ex-total { margin: 0.2rem 0 0.85rem; padding: 0.7rem 0.85rem; border-radius: 12px; background: linear-gradient(135deg, #f0f5f2, #eaf2ec); display: flex; align-items: baseline; justify-content: space-between; }
  .ex-total-lab { font-size: 0.66rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #7a8e84; }
  .ex-total-val { font-size: 1.2rem; font-weight: 700; color: #2f3e46; font-variant-numeric: tabular-nums; }

  /* Receipt / document upload */
  .ex-upload {
    display: flex; align-items: center; gap: 0.6rem; width: 100%; box-sizing: border-box;
    padding: 0.85rem 0.9rem; border: 1.5px dashed #b9c8bd; border-radius: 12px;
    background: rgba(132, 169, 140, 0.06); color: #52796f; cursor: pointer;
    -webkit-tap-highlight-color: transparent; transition: border-color 0.18s, background 0.18s;
  }
  .ex-upload:active { border-color: #52796f; background: rgba(132, 169, 140, 0.12); }
  .ex-upload svg { flex-shrink: 0; }
  .ex-upload-text { font-size: 0.8rem; font-weight: 600; line-height: 1.25; }
  .ex-upload-text small { display: block; font-size: 0.66rem; font-weight: 500; color: #84a98c; margin-top: 1px; }
  .ex-file { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 0.7rem; border: 1.5px solid #d4ddd6; border-radius: 12px; background: #fff; }
  .ex-file-icon { flex-shrink: 0; width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; background: rgba(82, 121, 111, 0.12); color: #52796f; }
  .ex-file-meta { min-width: 0; flex: 1; }
  .ex-file-name { font-size: 0.78rem; font-weight: 600; color: #2f3e46; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ex-file-size { font-size: 0.66rem; color: #9aa8a0; margin-top: 1px; }
  .ex-file-remove { flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px; border: none; cursor: pointer; background: rgba(192, 117, 106, 0.12); color: #b85c50; display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; }
  .ex-file-remove:active { transform: scale(0.92); }
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

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function memberName(m) {
  const full = `${m?.firstName || ''} ${m?.lastName || ''}`.trim();
  return full || m?.name || m?.email || 'Employee';
}

function currencySymbol(cur) {
  return cur === 'GBP' ? '£' : cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '';
}

// Claim totals — kept in sync with the employee Expenses screen and web AddExpense.
function mileageTotal(f) {
  const d = Number(f?.distance);
  const r = Number(f?.ratePerUnit);
  const t = Number(f?.tax);
  const sub = (Number.isFinite(d) ? d : 0) * (Number.isFinite(r) ? r : 0);
  return sub + (Number.isFinite(t) ? t : 0);
}

function receiptTotal(f) {
  const a = Number(f?.amount);
  const t = Number(f?.tax);
  return (Number.isFinite(a) ? a : 0) + (Number.isFinite(t) ? t : 0);
}

export default function Expenses({ scope = 'team' }) {
  // Org scope (admin route) can file for anyone; team scope (manager route) is
  // limited to direct reports. The backend enforces the same scoping.
  const isOrg = scope === 'org';
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [banner, setBanner] = useState(null);
  const [actingId, setActingId] = useState(null);
  // Approve/decline bottom sheet: { mode: 'approve' | 'decline', req } | null.
  const [actionTarget, setActionTarget] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // "New claim" (on behalf of an employee) flow.
  const [members, setMembers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);

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

  // Employees this admin/manager can file a claim for. Org scope → everyone;
  // team scope → direct reports. A failed fetch degrades to an empty picker.
  async function fetchMembers() {
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
  }

  useEffect(() => {
    fetchExpenses();
    fetchMembers();
  }, []);

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 2800);
  }

  function openModal() {
    setForm({
      employeeId: '',
      claimType: 'receipt',
      amount: '', currency: 'GBP', category: 'Travel', customCategory: '', date: todayYMD(), supplier: '', description: '',
      // Mileage-specific (mirrors web AddExpense): distance × ratePerUnit + tax.
      distance: '', unit: 'miles', ratePerUnit: '0.45', tax: '',
    });
    setReceiptFile(null);
    setModalOpen(true);
  }

  function onPickFile(ev) {
    const file = ev.target.files?.[0];
    // Reset the input value so re-picking the same file after removal still fires onChange.
    ev.target.value = '';
    if (!file) return;
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      flash('error', 'Attach a JPEG, PNG, GIF or PDF file');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      flash('error', 'File must be 10MB or smaller');
      return;
    }
    setReceiptFile(file);
  }

  // Two-step flow (mirrors the employee screen): POST /expenses returns the new
  // claim, then the picked document is uploaded to POST /expenses/:id/attachments.
  // The backend now lets the on-behalf submitter attach. Returns true unless a
  // file was picked but the upload failed.
  async function attachReceiptIfAny(created) {
    if (!receiptFile) return true;
    const newId = created?._id || created?.expense?._id || created?.id;
    if (!newId) return true;
    const fd = new FormData();
    fd.append('file', receiptFile);
    try {
      await api.post(`/expenses/${newId}/attachments`, fd);
      return true;
    } catch {
      return false;
    }
  }

  async function submitExpense(ev) {
    ev?.preventDefault?.();
    if (!form.employeeId) {
      flash('error', 'Select the employee this claim is for');
      return;
    }
    if (form.claimType === 'mileage') return submitMileage();
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      flash('error', 'Enter a valid amount');
      return;
    }
    if (!form.category) {
      flash('error', 'Pick a category');
      return;
    }
    // When "Other" is picked, the typed value becomes the category.
    const category = form.category === 'Other' ? (form.customCategory || '').trim() : form.category;
    if (!category) {
      flash('error', 'Enter a category');
      return;
    }
    if ((form.supplier || '').trim().length < 2) {
      flash('error', 'Enter a supplier / merchant');
      return;
    }
    setSubmitting(true);
    try {
      // Match the backend's receipt schema (see web AddExpense) and file it on
      // behalf of the picked employee. totalAmount = receiptValue + tax.
      const tax = Number(form.tax);
      const taxVal = Number.isFinite(tax) && tax > 0 ? tax : 0;
      const { data } = await api.post('/expenses', {
        onBehalfOf: form.employeeId,
        claimType: 'receipt',
        date: form.date,
        currency: form.currency,
        category,
        tax: taxVal,
        totalAmount: amt + taxVal,
        receiptValue: amt,
        supplier: form.supplier.trim(),
        tags: [],
        notes: form.description.trim(),
      });
      const attached = await attachReceiptIfAny(data);
      flash(attached ? 'success' : 'error', attached
        ? 'Claim submitted for approval'
        : 'Claim saved, but the document failed to attach — add it later.');
      setModalOpen(false);
      fetchExpenses();
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMileage() {
    const dist = Number(form.distance);
    const rate = Number(form.ratePerUnit);
    if (!Number.isFinite(dist) || dist <= 0) {
      flash('error', 'Enter the distance travelled');
      return;
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      flash('error', 'Enter a rate per ' + (form.unit === 'km' ? 'km' : 'mile'));
      return;
    }
    setSubmitting(true);
    try {
      const tax = Number(form.tax);
      const { data } = await api.post('/expenses', {
        onBehalfOf: form.employeeId,
        claimType: 'mileage',
        date: form.date,
        currency: form.currency,
        category: 'Mileage',
        tax: Number.isFinite(tax) ? tax : 0,
        totalAmount: mileageTotal(form),
        tags: [],
        notes: (form.description || '').trim(),
        mileage: {
          distance: dist,
          unit: form.unit,
          ratePerUnit: rate,
          destinations: [{ address: '', latitude: null, longitude: null, order: 0 }],
          routePoints: [],
        },
      });
      const attached = await attachReceiptIfAny(data);
      flash(attached ? 'success' : 'error', attached
        ? 'Mileage claim submitted for approval'
        : 'Claim saved, but the document failed to attach — add it later.');
      setModalOpen(false);
      fetchExpenses();
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function openAction(mode, req) {
    setActionTarget({ mode, req });
    setActionReason('');
  }

  function closeAction() {
    if (actionSubmitting) return;
    setActionTarget(null);
    setActionReason('');
  }

  // Update a single claim's status in place so the summary, filter counts and
  // its bucket all move without a round-trip. Mirrors the manager approvals flow.
  function applyStatus(id, status) {
    setExpenses((prev) => prev.map((e) => ((e._id || e.id) === id ? { ...e, status } : e)));
  }

  async function submitAction(e) {
    e?.preventDefault?.();
    if (!actionTarget) return;
    const { mode, req } = actionTarget;
    const reason = actionReason.trim();
    // A decline needs a reason; approval notes are optional.
    if (mode === 'decline' && !reason) return;
    const id = req._id || req.id;
    setActionSubmitting(true);
    setActingId(id);
    try {
      if (mode === 'approve') {
        await api.post(`/expenses/${id}/approve`, { approvalNotes: reason });
        applyStatus(id, 'approved');
        flash('success', 'Expense approved');
      } else {
        // Backend `declineExpense` reads `req.body.reason` (not approvalNotes).
        await api.post(`/expenses/${id}/decline`, { reason });
        applyStatus(id, 'rejected');
        flash('success', 'Expense declined');
      }
      setActionTarget(null);
      setActionReason('');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActionSubmitting(false);
      setActingId(null);
    }
  }

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
          <button type="button" className="ex-header-add" onClick={openModal} aria-label="New expense claim">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New claim
          </button>
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

        {banner && (
          <div className={`ex-banner ex-anim ${banner.kind === 'success' ? 'is-success' : 'is-error'}`}>
            {banner.text}
          </div>
        )}

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
                  {status === 'pending' && (
                    <div className="ex-actions">
                      <button
                        type="button"
                        className="ex-btn ex-btn-decline"
                        onClick={() => openAction('decline', e)}
                        disabled={actingId === (e._id || e.id)}
                      >
                        {actingId === (e._id || e.id) ? <span className="ex-mini-spin" /> : null}
                        Decline
                      </button>
                      <button
                        type="button"
                        className="ex-btn ex-btn-approve"
                        onClick={() => openAction('approve', e)}
                        disabled={actingId === (e._id || e.id)}
                      >
                        {actingId === (e._id || e.id) ? <span className="ex-mini-spin" /> : null}
                        Approve
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && form && createPortal(
        <div className="ex-overlay" onClick={() => !submitting && setModalOpen(false)}>
          <div className="ex-sheet" onClick={(ev) => ev.stopPropagation()}>
            <div className="ex-sheet-grip" />
            <h2 className="ex-sheet-title">New {form.claimType === 'mileage' ? 'mileage' : 'expense'} claim</h2>
            <p className="ex-sheet-sub">Filed on behalf of an employee</p>
            {/* Banner lives INSIDE the portaled sheet — the page-level banner is
                painted behind this full-screen overlay, so validation/API feedback
                fired while the modal is open would otherwise be invisible. */}
            {banner && (
              <div className={`ex-banner ${banner.kind === 'success' ? 'is-success' : 'is-error'}`}>{banner.text}</div>
            )}
            <form onSubmit={submitExpense}>
              <div className="ex-field">
                <label className="ex-field-label" htmlFor="ex-ob-emp">Employee<span className="ex-req"> *</span></label>
                <select
                  id="ex-ob-emp"
                  className="ex-select"
                  value={form.employeeId}
                  onChange={(ev) => setForm((f) => ({ ...f, employeeId: ev.target.value }))}
                >
                  <option value="">Select an employee…</option>
                  {members.map((m) => (
                    <option key={m._id} value={m._id}>
                      {memberName(m)}{m.employeeId ? ` (${m.employeeId})` : ''}
                    </option>
                  ))}
                </select>
                {members.length === 0 && (
                  <p className="ex-hint">No employees available to file for right now.</p>
                )}
              </div>

              <div className="ex-toggle" role="group" aria-label="Claim type">
                <button
                  type="button"
                  className={`ex-toggle-btn ${form.claimType === 'receipt' ? 'is-active' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, claimType: 'receipt' }))}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" /><path d="M8 7h8M8 11h8M8 15h5" />
                  </svg>
                  Receipt
                </button>
                <button
                  type="button"
                  className={`ex-toggle-btn ${form.claimType === 'mileage' ? 'is-active' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, claimType: 'mileage' }))}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 17H3v-5l2-5h11l3 5v5h-2" /><circle cx="7.5" cy="17" r="2" /><circle cx="16.5" cy="17" r="2" />
                  </svg>
                  Mileage
                </button>
              </div>

              {form.claimType === 'receipt' ? (
                <>
                  <div className="ex-row2">
                    <div className="ex-field">
                      <label className="ex-field-label" htmlFor="ex-amount">Amount</label>
                      <div className="ex-amount-wrap">
                        <span className="ex-amount-cur">{currencySymbol(form.currency)}</span>
                        <input
                          id="ex-amount" className="ex-input" type="number" inputMode="decimal" min="0" step="0.01"
                          placeholder="0.00" value={form.amount}
                          onChange={(ev) => setForm((f) => ({ ...f, amount: ev.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="ex-field">
                      <label className="ex-field-label" htmlFor="ex-currency">Currency</label>
                      <select id="ex-currency" className="ex-select" value={form.currency} onChange={(ev) => setForm((f) => ({ ...f, currency: ev.target.value }))}>
                        <option value="GBP">GBP £</option>
                        <option value="USD">USD $</option>
                        <option value="EUR">EUR €</option>
                      </select>
                    </div>
                  </div>
                  <div className="ex-row2">
                    <div className="ex-field">
                      <label className="ex-field-label" htmlFor="ex-category">Category</label>
                      <select id="ex-category" className="ex-select" value={form.category} onChange={(ev) => setForm((f) => ({ ...f, category: ev.target.value }))}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="ex-field">
                      <label className="ex-field-label" htmlFor="ex-date">Date</label>
                      <input id="ex-date" className="ex-input" type="date" value={form.date} max={todayYMD()} onChange={(ev) => setForm((f) => ({ ...f, date: ev.target.value }))} />
                    </div>
                  </div>
                  {form.category === 'Other' && (
                    <div className="ex-field">
                      <label className="ex-field-label" htmlFor="ex-category-custom">Specify category</label>
                      <input id="ex-category-custom" className="ex-input" type="text" placeholder="Enter category" value={form.customCategory} onChange={(ev) => setForm((f) => ({ ...f, customCategory: ev.target.value }))} />
                    </div>
                  )}
                  <div className="ex-row2">
                    <div className="ex-field">
                      <label className="ex-field-label" htmlFor="ex-supplier">Supplier</label>
                      <input id="ex-supplier" className="ex-input" type="text" placeholder="Paid to?" value={form.supplier} onChange={(ev) => setForm((f) => ({ ...f, supplier: ev.target.value }))} />
                    </div>
                    <div className="ex-field">
                      <label className="ex-field-label" htmlFor="ex-tax-r">Tax</label>
                      <div className="ex-amount-wrap">
                        <span className="ex-amount-cur">{currencySymbol(form.currency)}</span>
                        <input
                          id="ex-tax-r" className="ex-input" type="number" inputMode="decimal" min="0" step="0.01"
                          placeholder="0.00" value={form.tax}
                          onChange={(ev) => setForm((f) => ({ ...f, tax: ev.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="ex-field">
                    <label className="ex-field-label" htmlFor="ex-desc">Description</label>
                    <textarea id="ex-desc" className="ex-textarea" placeholder="What was this expense for?" value={form.description} onChange={(ev) => setForm((f) => ({ ...f, description: ev.target.value }))} />
                  </div>
                  <div className="ex-total">
                    <span className="ex-total-lab">Total</span>
                    <span className="ex-total-val">{formatMoney(receiptTotal(form), form.currency)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="ex-row2">
                    <div className="ex-field">
                      <label className="ex-field-label" htmlFor="ex-distance">Distance</label>
                      <input
                        id="ex-distance" className="ex-input" type="number" inputMode="decimal" min="0" step="0.1"
                        placeholder="0" value={form.distance}
                        onChange={(ev) => setForm((f) => ({ ...f, distance: ev.target.value }))}
                      />
                    </div>
                    <div className="ex-field">
                      <label className="ex-field-label" htmlFor="ex-unit">Unit</label>
                      <select id="ex-unit" className="ex-select" value={form.unit} onChange={(ev) => setForm((f) => ({ ...f, unit: ev.target.value }))}>
                        <option value="miles">Miles</option>
                        <option value="km">KM</option>
                      </select>
                    </div>
                  </div>
                  <div className="ex-row2">
                    <div className="ex-field">
                      <label className="ex-field-label" htmlFor="ex-rate">Rate / {form.unit === 'km' ? 'KM' : 'Mile'}</label>
                      <div className="ex-amount-wrap">
                        <span className="ex-amount-cur">{currencySymbol(form.currency)}</span>
                        <input
                          id="ex-rate" className="ex-input" type="number" inputMode="decimal" min="0" step="0.01"
                          placeholder="0.45" value={form.ratePerUnit}
                          onChange={(ev) => setForm((f) => ({ ...f, ratePerUnit: ev.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="ex-field">
                      <label className="ex-field-label" htmlFor="ex-currency-m">Currency</label>
                      <select id="ex-currency-m" className="ex-select" value={form.currency} onChange={(ev) => setForm((f) => ({ ...f, currency: ev.target.value }))}>
                        <option value="GBP">GBP £</option>
                        <option value="USD">USD $</option>
                        <option value="EUR">EUR €</option>
                      </select>
                    </div>
                  </div>
                  <div className="ex-row2">
                    <div className="ex-field">
                      <label className="ex-field-label" htmlFor="ex-date-m">Date</label>
                      <input id="ex-date-m" className="ex-input" type="date" value={form.date} max={todayYMD()} onChange={(ev) => setForm((f) => ({ ...f, date: ev.target.value }))} />
                    </div>
                    <div className="ex-field">
                      <label className="ex-field-label" htmlFor="ex-tax">Tax</label>
                      <div className="ex-amount-wrap">
                        <span className="ex-amount-cur">{currencySymbol(form.currency)}</span>
                        <input
                          id="ex-tax" className="ex-input" type="number" inputMode="decimal" min="0" step="0.01"
                          placeholder="0.00" value={form.tax}
                          onChange={(ev) => setForm((f) => ({ ...f, tax: ev.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="ex-field">
                    <label className="ex-field-label" htmlFor="ex-desc-m">Notes</label>
                    <textarea id="ex-desc-m" className="ex-textarea" placeholder="Reason for the journey (optional)" value={form.description} onChange={(ev) => setForm((f) => ({ ...f, description: ev.target.value }))} />
                  </div>
                  <div className="ex-total">
                    <span className="ex-total-lab">Total</span>
                    <span className="ex-total-val">{formatMoney(mileageTotal(form), form.currency)}</span>
                  </div>
                </>
              )}

              <div className="ex-field">
                <label className="ex-field-label">Receipt / document <span className="ex-optional">· optional</span></label>
                {receiptFile ? (
                  <div className="ex-file">
                    <div className="ex-file-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
                      </svg>
                    </div>
                    <div className="ex-file-meta">
                      <div className="ex-file-name">{receiptFile.name}</div>
                      <div className="ex-file-size">{(receiptFile.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button type="button" className="ex-file-remove" onClick={() => setReceiptFile(null)} disabled={submitting} aria-label="Remove file">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label className="ex-upload">
                    <input type="file" accept="image/*,.pdf" onChange={onPickFile} hidden />
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" />
                    </svg>
                    <span className="ex-upload-text">
                      Attach receipt
                      <small>Image or PDF · max 10MB</small>
                    </span>
                  </label>
                )}
              </div>

              <div className="ex-sheet-actions">
                <button type="button" className="ex-sheet-btn ex-sheet-btn-cancel" onClick={() => setModalOpen(false)} disabled={submitting}>Cancel</button>
                <button type="submit" className="ex-sheet-btn ex-sheet-btn-approve" disabled={submitting}>
                  {submitting && <span className="ex-mini-spin" />}
                  {submitting ? 'Submitting…' : 'Submit claim'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {actionTarget && createPortal(
        <div className="ex-overlay" onClick={closeAction}>
          <div className="ex-sheet" onClick={(ev) => ev.stopPropagation()}>
            <div className="ex-sheet-grip" />
            <h2 className="ex-sheet-title">
              {actionTarget.mode === 'approve' ? 'Approve expense' : 'Decline expense'}
            </h2>
            <p className="ex-sheet-sub">
              {expenseEmployee(actionTarget.req)}
              {' · '}
              {formatMoney(expenseAmount(actionTarget.req), expenseCurrency(actionTarget.req))}
            </p>
            <form onSubmit={submitAction}>
              <div className="ex-field">
                <label className="ex-field-label" htmlFor="ex-action-reason">
                  {actionTarget.mode === 'approve' ? (
                    <>Approval notes <span className="ex-optional">· optional</span></>
                  ) : (
                    'Reason for decline'
                  )}
                </label>
                <textarea
                  id="ex-action-reason"
                  className="ex-textarea"
                  placeholder={
                    actionTarget.mode === 'approve'
                      ? 'Add a note for this approval (optional)…'
                      : 'Let the employee know why this expense is being declined…'
                  }
                  value={actionReason}
                  onChange={(ev) => setActionReason(ev.target.value)}
                  autoFocus={actionTarget.mode === 'decline'}
                />
              </div>
              <div className="ex-sheet-actions">
                <button
                  type="button"
                  className="ex-sheet-btn ex-sheet-btn-cancel"
                  onClick={closeAction}
                  disabled={actionSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`ex-sheet-btn ${actionTarget.mode === 'approve' ? 'ex-sheet-btn-approve' : 'ex-sheet-btn-decline'}`}
                  disabled={actionSubmitting || (actionTarget.mode === 'decline' && !actionReason.trim())}
                >
                  {actionSubmitting ? <span className="ex-mini-spin" /> : null}
                  {actionTarget.mode === 'approve' ? 'Approve' : 'Decline'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
