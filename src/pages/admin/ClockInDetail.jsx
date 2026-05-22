import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

const styles = `
  @keyframes cd-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes cd-skel {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.85; }
  }
  @keyframes cd-pulse {
    0%, 100% { opacity: 0.7; transform: scale(1); }
    50%      { opacity: 1; transform: scale(1.18); }
  }

  .cd-wrap { padding: 0.6rem 1rem 6rem; }
  .cd-anim { animation: cd-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Top bar ── */
  .cd-topbar {
    display: flex; align-items: center; gap: 0.4rem;
    padding: 0.25rem 0;
    margin-bottom: 0.4rem;
  }
  .cd-back {
    display: inline-flex; align-items: center; justify-content: center;
    width: 36px; height: 36px;
    border-radius: 10px;
    border: 1px solid rgba(212, 221, 214, 0.7);
    background: #fff;
    color: #354f52;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s;
  }
  .cd-back:active { background: #f1f4f0; transform: scale(0.97); }
  .cd-topbar-title {
    font-size: 0.7rem; font-weight: 600;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: #84a98c;
  }

  /* ── Identity ── */
  .cd-identity {
    display: flex; align-items: center; gap: 0.85rem;
    padding: 0.85rem;
    border-radius: 16px;
    background: linear-gradient(135deg, #ffffff 0%, #f6f8f5 100%);
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 2px 10px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.7rem;
  }
  .cd-avatar {
    width: 54px; height: 54px; border-radius: 50%;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.32), rgba(82, 121, 111, 0.24));
    color: #354f52;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.2rem; font-weight: 700;
    flex-shrink: 0;
    position: relative;
  }
  .cd-avatar-dot {
    position: absolute; right: 0; bottom: 1px;
    width: 14px; height: 14px;
    border: 2.5px solid #fff;
    border-radius: 50%;
    background: #b8c4bc;
  }
  .cd-avatar-dot.is-clocked-in { background: #52796f; animation: cd-pulse 2.4s ease-in-out infinite; }
  .cd-avatar-dot.is-on-break  { background: #d8a64c; }
  .cd-avatar-dot.is-on-leave  { background: #6d88c2; }
  .cd-avatar-dot.is-absent    { background: #c0756a; }
  .cd-identity-meta { min-width: 0; flex: 1; }
  .cd-identity-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; font-weight: 400; line-height: 1.1;
    color: #2f3e46; letter-spacing: -0.01em;
  }
  .cd-identity-sub {
    margin-top: 4px;
    font-size: 0.75rem; color: #7a8e84;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cd-identity-row {
    margin-top: 6px;
    display: flex; flex-wrap: wrap; gap: 0.3rem;
  }
  .cd-tag {
    font-size: 0.6rem; font-weight: 600;
    color: #52796f;
    background: rgba(132, 169, 140, 0.14);
    border-radius: 999px;
    padding: 2px 8px;
    letter-spacing: 0.04em;
  }
  .cd-tag.is-role { color: #354f52; background: rgba(82, 121, 111, 0.14); text-transform: capitalize; }

  /* ── Status banner ── */
  .cd-status-card {
    padding: 0.85rem 1rem;
    border-radius: 14px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    border-left: 4px solid #b8c4bc;
    margin-bottom: 0.7rem;
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
  }
  .cd-status-card.is-clocked-in  { border-left-color: #52796f; }
  .cd-status-card.is-on-break    { border-left-color: #d8a64c; }
  .cd-status-card.is-on-leave    { border-left-color: #6d88c2; }
  .cd-status-card.is-absent      { border-left-color: #c0756a; }
  .cd-status-card.is-clocked-out { border-left-color: rgba(122, 142, 132, 0.55); }
  .cd-status-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.7rem;
  }
  .cd-status-label {
    font-size: 0.6rem; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #7a8e84;
  }
  .cd-status-value {
    margin-top: 3px;
    font-size: 0.98rem; font-weight: 600;
    color: #2f3e46;
  }
  .cd-status-pill {
    font-size: 0.6rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    padding: 3px 9px; border-radius: 999px;
    background: rgba(132, 169, 140, 0.18);
    color: #354f52;
    white-space: nowrap;
  }
  .cd-status-pill.is-clocked-in  { background: rgba(82, 121, 111, 0.18); color: #354f52; }
  .cd-status-pill.is-on-break    { background: rgba(216, 166, 76, 0.18); color: #7a591f; }
  .cd-status-pill.is-clocked-out { background: rgba(122, 142, 132, 0.16); color: #4d5e57; }
  .cd-status-pill.is-on-leave    { background: rgba(109, 136, 194, 0.16); color: #3c5285; }
  .cd-status-pill.is-absent      { background: rgba(192, 117, 106, 0.18); color: #7a3028; }
  .cd-live-timer {
    margin-top: 8px;
    font-size: 1.4rem; font-weight: 700;
    color: #354f52;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
  .cd-live-sub {
    font-size: 0.68rem; color: #84a98c;
    margin-top: 2px;
    letter-spacing: 0.08em; text-transform: uppercase;
  }

  /* ── Shift actions ── */
  .cd-shift-actions {
    display: flex; gap: 0.5rem;
    margin-bottom: 0.7rem;
  }
  .cd-shift-btn {
    flex: 1;
    padding: 0.7rem 0.7rem;
    border-radius: 12px;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.82rem; font-weight: 600;
    letter-spacing: 0.04em;
    border: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    display: flex; align-items: center; justify-content: center; gap: 0.4rem;
    transition: transform 0.12s, box-shadow 0.12s, background 0.15s;
    box-shadow: 0 2px 6px rgba(47, 62, 70, 0.06);
  }
  .cd-shift-btn:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
  .cd-shift-btn:not(:disabled):active { transform: scale(0.97); }
  .cd-shift-btn.is-break {
    background: linear-gradient(135deg, #f4ddb5 0%, #e7c987 100%);
    color: #6b4f1d;
  }
  .cd-shift-btn.is-resume {
    background: linear-gradient(135deg, #cfe1d4 0%, #a9c8b0 100%);
    color: #2f4a35;
  }
  .cd-shift-btn.is-clockout {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    box-shadow: 0 3px 10px rgba(53,79,82,0.22);
  }

  /* ── Today grid ── */
  .cd-section-label {
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: #52796f;
    margin: 0.9rem 0.25rem 0.45rem;
  }
  .cd-section-label::before {
    content: '';
    width: 14px; height: 1.5px;
    background: linear-gradient(90deg, #84a98c, rgba(132, 169, 140, 0));
    border-radius: 1px;
  }
  .cd-today-grid {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 0.45rem;
  }
  .cd-stat-tile {
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    border-radius: 12px;
    padding: 0.65rem 0.7rem;
  }
  .cd-stat-tile-label {
    font-size: 0.58rem; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: #84a98c;
  }
  .cd-stat-tile-value {
    margin-top: 4px;
    font-size: 0.95rem; font-weight: 700;
    color: #2f3e46;
    font-variant-numeric: tabular-nums;
  }
  .cd-stat-tile-value.is-muted { color: #9aa8a0; font-weight: 600; }

  /* ── Timeline ── */
  .cd-timeline {
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    border-radius: 14px;
    padding: 0.6rem 0.85rem;
    margin-top: 0.4rem;
  }
  .cd-timeline-row {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.45rem 0;
    border-bottom: 1px dashed rgba(132, 169, 140, 0.2);
  }
  .cd-timeline-row:last-child { border-bottom: none; }
  .cd-timeline-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #84a98c; flex-shrink: 0;
  }
  .cd-timeline-dot.is-out { background: #b8c4bc; }
  .cd-timeline-dot.is-break { background: #d8a64c; }
  .cd-timeline-label {
    flex: 1;
    font-size: 0.78rem; color: #2f3e46;
    font-weight: 500;
  }
  .cd-timeline-time {
    font-size: 0.78rem; font-weight: 600;
    color: #354f52;
    font-variant-numeric: tabular-nums;
  }

  /* ── Recent entries ── */
  .cd-entry-wrap {
    border-radius: 12px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    margin-bottom: 0.4rem;
    overflow: hidden;
  }
  .cd-entry {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.6rem 0.75rem;
  }
  .cd-entry-day {
    display: flex; flex-direction: column; align-items: center;
    width: 38px; flex-shrink: 0;
    padding: 4px 0;
    border-radius: 8px;
    background: rgba(132, 169, 140, 0.12);
    color: #354f52;
  }
  .cd-entry-day-num {
    font-size: 1rem; font-weight: 700;
    line-height: 1;
  }
  .cd-entry-day-mon {
    font-size: 0.55rem; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: #7a8e84;
    margin-top: 2px;
  }
  .cd-entry-meta { min-width: 0; flex: 1; }
  .cd-entry-times {
    font-size: 0.8rem; font-weight: 600;
    color: #354f52;
    font-variant-numeric: tabular-nums;
  }
  .cd-entry-times .cd-arrow { color: #b8c4bc; padding: 0 0.18rem; font-weight: 400; }
  .cd-entry-sub {
    margin-top: 2px;
    font-size: 0.65rem; color: #84a98c;
    letter-spacing: 0.04em;
  }
  .cd-entry-hours {
    flex-shrink: 0;
    text-align: right;
    font-size: 0.85rem; font-weight: 700;
    color: #2f3e46;
    font-variant-numeric: tabular-nums;
  }
  .cd-entry-hours-sub {
    font-size: 0.55rem;
    color: #84a98c;
    letter-spacing: 0.08em; text-transform: uppercase;
    margin-top: 1px;
  }

  /* ── Entry actions ── */
  .cd-entry-actions {
    display: flex; gap: 0;
    border-top: 1px dashed rgba(132, 169, 140, 0.25);
    background: #fbfcfa;
  }
  .cd-entry-action {
    flex: 1;
    padding: 0.55rem 0.5rem;
    border: none;
    background: none;
    color: #354f52;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.74rem; font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    display: flex; align-items: center; justify-content: center; gap: 0.35rem;
    transition: background 0.15s;
  }
  .cd-entry-action:active { background: rgba(82,121,111,0.08); }
  .cd-entry-action:disabled { opacity: 0.5; cursor: not-allowed; }
  .cd-entry-action + .cd-entry-action {
    border-left: 1px dashed rgba(132, 169, 140, 0.25);
  }
  .cd-entry-action.is-danger { color: #b85c50; }
  .cd-entry-action.is-danger:active { background: rgba(192,117,106,0.1); }
  .cd-mini-spin {
    width: 11px; height: 11px;
    border: 2px solid currentColor; border-top-color: transparent;
    border-radius: 50%; animation: cd-spin 0.7s linear infinite;
  }
  @keyframes cd-spin { to { transform: rotate(360deg); } }

  /* ── Inline edit form ── */
  .cd-entry-edit {
    padding: 0.7rem 0.85rem;
    border-top: 1px dashed rgba(132, 169, 140, 0.25);
    background: #f6f8f5;
  }
  .cd-edit-row {
    display: flex; gap: 0.5rem;
    margin-bottom: 0.55rem;
  }
  .cd-edit-field { flex: 1; min-width: 0; }
  .cd-edit-label {
    font-size: 0.58rem; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: #84a98c;
    margin: 0 0 4px;
  }
  .cd-edit-input {
    width: 100%;
    padding: 0.5rem 0.6rem;
    border: 1.5px solid #d4ddd6; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 0.9rem;
    color: #2f3e46; background: #fff; outline: none;
    -webkit-appearance: none; appearance: none;
    box-sizing: border-box;
    font-variant-numeric: tabular-nums;
    transition: border-color 0.18s;
  }
  .cd-edit-input:focus { border-color: #52796f; }
  .cd-edit-actions {
    display: flex; gap: 0.45rem;
    margin-top: 0.3rem;
  }
  .cd-edit-btn {
    flex: 1;
    padding: 0.5rem 0.6rem;
    border-radius: 8px;
    font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em;
    border: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    display: flex; align-items: center; justify-content: center; gap: 0.3rem;
    transition: transform 0.12s;
  }
  .cd-edit-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .cd-edit-btn:not(:disabled):active { transform: scale(0.97); }
  .cd-edit-btn.is-primary {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    box-shadow: 0 3px 8px rgba(53,79,82,0.18);
  }
  .cd-edit-btn.is-secondary {
    background: #fff;
    color: #354f52;
    border: 1.5px solid #d4ddd6;
  }

  /* ── Banner ── */
  .cd-banner {
    margin-bottom: 0.65rem;
    padding: 0.55rem 0.85rem;
    border-radius: 10px;
    font-size: 0.76rem; font-weight: 500;
  }
  .cd-banner.is-success {
    background: linear-gradient(135deg, #f0f5f2, #eaf2ec);
    border-left: 3px solid #52796f;
    color: #2f3e46;
  }
  .cd-banner.is-error {
    background: linear-gradient(135deg, #fdf3f2, #fdecea);
    border-left: 3px solid #c0756a;
    color: #7a3028;
  }

  /* ── States ── */
  .cd-skel {
    height: 64px; border-radius: 12px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: cd-skel 1.2s ease-in-out infinite;
    margin-bottom: 0.45rem;
  }
  .cd-empty, .cd-error {
    padding: 1.4rem 1rem; border-radius: 14px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center; color: #52796f;
  }
  .cd-error {
    border-color: rgba(192, 117, 106, 0.4);
    color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .cd-empty-title, .cd-error-title { font-size: 0.82rem; font-weight: 600; margin: 0; }
  .cd-empty-sub, .cd-error-sub { font-size: 0.72rem; margin: 0.25rem 0 0; opacity: 0.85; }
`;

const STATUS_LABELS = {
  'clocked-in':  'Clocked In',
  'on-break':    'On Break',
  'clocked-out': 'Clocked Out',
  'on-leave':    'On Leave',
  absent:        'Absent',
};

function normalizeStatus(s) {
  return (s || 'clocked-out').toString().replace('_', '-').toLowerCase();
}

function initials(emp) {
  const f = (emp?.firstName || '').charAt(0);
  const l = (emp?.lastName || '').charAt(0);
  return (f + l).toUpperCase() || (emp?.email || '?').charAt(0).toUpperCase();
}

function fullName(emp) {
  return [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim() || emp?.email || 'Unnamed';
}

function timeToDate(t) {
  if (!t) return null;
  if (typeof t === 'string' && t.includes('T')) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t));
  if (!m) return null;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

function timeOnly(t) {
  const d = timeToDate(t);
  if (!d) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(mins) {
  if (mins == null || mins < 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTimerHMS(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function netMinutes(entry) {
  const start = timeToDate(entry?.clockIn);
  const end = timeToDate(entry?.clockOut);
  if (!start || !end) return null;
  let total = Math.floor((end - start) / 60000);
  if (total < 0) total += 24 * 60;
  const breakSum = (entry?.breaks || []).reduce((acc, b) => acc + (Number(b?.duration) || 0), 0);
  return Math.max(0, total - breakSum);
}

function entryDate(entry) {
  if (!entry?.date) return null;
  const d = new Date(entry.date);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function friendlyDay(d, today) {
  if (!d) return '—';
  if (isSameDay(d, today)) return 'Today';
  const y = new Date(today); y.setDate(today.getDate() - 1);
  if (isSameDay(d, y)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function monthShort(d) {
  return d ? d.toLocaleDateString(undefined, { month: 'short' }) : '';
}

export default function ClockInDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const stateEmployee = location.state?.employee || null;

  const [employee, setEmployee] = useState(stateEmployee);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [actingId, setActingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ clockIn: '', clockOut: '' });
  const [banner, setBanner] = useState(null);

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 2800);
  }

  function startEdit(entry) {
    setEditingId(entry._id);
    setEditForm({
      clockIn: timeOnly(entry.clockIn) || '',
      clockOut: timeOnly(entry.clockOut) || '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ clockIn: '', clockOut: '' });
  }

  async function saveEdit(entry) {
    const payload = {};
    if (editForm.clockIn && editForm.clockIn !== timeOnly(entry.clockIn)) payload.clockIn = editForm.clockIn;
    if (editForm.clockOut && editForm.clockOut !== timeOnly(entry.clockOut)) payload.clockOut = editForm.clockOut;
    if (Object.keys(payload).length === 0) {
      cancelEdit();
      return;
    }
    setActingId(entry._id);
    try {
      const { data } = await api.put(`/clock/entry/${entry._id}`, payload);
      const updated = data?.data || data?.entry || { ...entry, ...payload };
      setEntries((prev) => prev.map((e) => (e._id === entry._id ? { ...e, ...updated } : e)));
      flash('success', 'Entry updated');
      cancelEdit();
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  async function changeShiftStatus(newStatus, confirmText) {
    if (!employee) return;
    const empId = employee._id || employee.id || id;
    if (!empId) {
      flash('error', "Couldn't find employee ID");
      return;
    }
    if (confirmText && !window.confirm(confirmText)) return;
    setActingId('shift');
    try {
      await api.post('/clock/admin/status', { employeeId: empId, status: newStatus });
      const stamp = new Date().toISOString();
      setEmployee((prev) => {
        if (!prev) return prev;
        const next = { ...prev, status: newStatus };
        if (newStatus === 'on-break')   next.breakIn = stamp;
        if (newStatus === 'clocked-in') next.breakOut = stamp;
        if (newStatus === 'clocked-out') next.clockOut = stamp;
        return next;
      });
      flash('success',
        newStatus === 'on-break'   ? 'Started break'
        : newStatus === 'clocked-in' ? 'Resumed work'
        : 'Clocked out');
      fetchDetail();
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  async function deleteEntry(entry) {
    if (!window.confirm('Delete this clock-in entry?')) return;
    setActingId(entry._id);
    try {
      await api.delete(`/clock/entry/${entry._id}`);
      setEntries((prev) => prev.filter((e) => e._id !== entry._id));
      flash('success', 'Entry deleted');
      if (editingId === entry._id) cancelEdit();
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function fetchDetail() {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      const start = new Date();
      start.setDate(today.getDate() - 13);

      const calls = [
        api.get(`/clock/entries?startDate=${toYMD(start)}&endDate=${toYMD(today)}`).catch(() => null),
      ];
      if (!stateEmployee) {
        calls.push(api.get('/employees?includeAdmins=true').catch(() => null));
        calls.push(api.get('/clock/status?includeAdmins=true').catch(() => null));
      }

      const [entriesRes, empsRes, statusRes] = await Promise.all(calls);

      const allEntries =
        entriesRes?.data?.data ||
        entriesRes?.data?.entries ||
        (Array.isArray(entriesRes?.data) ? entriesRes.data : []) || [];
      const mine = allEntries.filter((e) => {
        const k = e?.employee?._id || e?.employee?.id || e?.employeeId;
        return k && String(k) === String(id);
      });
      setEntries(mine);

      if (!stateEmployee) {
        const empList =
          empsRes?.data?.data ||
          empsRes?.data?.employees ||
          (Array.isArray(empsRes?.data) ? empsRes.data : []) || [];
        const found = empList.find((e) => String(e._id || e.id) === String(id));
        const statusPayload = statusRes?.data?.data || statusRes?.data || {};
        const statusList =
          statusPayload?.employees ||
          statusPayload?.allEmployees ||
          (Array.isArray(statusPayload) ? statusPayload : []) || [];
        const liveStatus = statusList.find((s) => {
          const k = s?._id || s?.id || s?.email;
          return k && String(k) === String(id);
        }) || (found && statusList.find((s) => s?.email && s.email === found.email));

        if (found || liveStatus) {
          setEmployee({
            ...(found || {}),
            ...(liveStatus ? {
              status: normalizeStatus(liveStatus.status),
              clockIn: liveStatus.clockIn,
              clockOut: liveStatus.clockOut,
              breakIn: liveStatus.breakIn,
              breakOut: liveStatus.breakOut,
            } : {}),
          });
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const status = normalizeStatus(employee?.status);
  const today = useMemo(() => new Date(), []);

  const todayEntry = useMemo(() => {
    return entries.find((e) => isSameDay(entryDate(e), today)) || null;
  }, [entries, today]);

  const liveSession = useMemo(() => {
    const start = timeToDate(employee?.clockIn) || (todayEntry && timeToDate(todayEntry.clockIn));
    if (!start) return null;
    const end = timeToDate(employee?.clockOut) || (todayEntry && timeToDate(todayEntry.clockOut)) || null;
    return { start, end };
  }, [employee, todayEntry]);

  const liveSeconds = useMemo(() => {
    if (!liveSession) return null;
    const end = liveSession.end || now;
    let diff = Math.floor((end - liveSession.start) / 1000);
    if (diff < 0) diff += 24 * 3600;
    return Math.max(0, diff);
  }, [liveSession, now]);

  const todayStats = useMemo(() => {
    const inT = liveSession?.start ? timeOnly(liveSession.start) : null;
    const outT = liveSession?.end ? timeOnly(liveSession.end) : null;
    const breaks = (todayEntry?.breaks || []).reduce((a, b) => a + (Number(b?.duration) || 0), 0);
    const isActive = status === 'clocked-in' || status === 'on-break';
    let netMin = todayEntry ? netMinutes(todayEntry) : null;
    if (netMin == null && isActive && liveSeconds != null) {
      netMin = Math.max(0, Math.floor(liveSeconds / 60) - breaks);
    }
    return { inT, outT, breaks, netMin };
  }, [todayEntry, liveSession, liveSeconds, status]);

  const weekStats = useMemo(() => {
    const last7 = entries.filter((e) => {
      const d = entryDate(e);
      if (!d) return false;
      const diffDays = Math.floor((today - d) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays < 7;
    });
    let totalMin = 0;
    const days = new Set();
    for (const e of last7) {
      const n = netMinutes(e);
      if (n != null) {
        totalMin += n;
        const d = entryDate(e);
        if (d) days.add(toYMD(d));
      }
    }
    const avg = days.size > 0 ? Math.round(totalMin / days.size) : null;
    return { totalMin, days: days.size, avg };
  }, [entries, today]);

  const timeline = useMemo(() => {
    const events = [];
    if (todayEntry?.clockIn) events.push({ label: 'Clocked in', time: timeOnly(todayEntry.clockIn), kind: 'in' });
    for (const b of todayEntry?.breaks || []) {
      if (b?.start) events.push({ label: 'Break started', time: timeOnly(b.start), kind: 'break' });
      if (b?.end)   events.push({ label: 'Break ended',   time: timeOnly(b.end),   kind: 'break' });
    }
    if (status === 'on-break' && employee?.breakIn) {
      events.push({ label: 'Break started', time: timeOnly(employee.breakIn), kind: 'break' });
    }
    if (todayEntry?.clockOut) events.push({ label: 'Clocked out', time: timeOnly(todayEntry.clockOut), kind: 'out' });
    return events.filter((e) => e.time);
  }, [todayEntry, status, employee]);

  const recentEntries = useMemo(() => {
    return entries
      .filter((e) => entryDate(e))
      .sort((a, b) => entryDate(b) - entryDate(a))
      .slice(0, 14);
  }, [entries]);

  const dept = employee?.department || employee?.team;
  const role = employee?.jobTitle || employee?.role;

  return (
    <>
      <style>{styles}</style>
      <div className="cd-wrap">
        <div className="cd-topbar cd-anim">
          <button type="button" className="cd-back" onClick={() => navigate(-1)} aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <span className="cd-topbar-title">Clock-in Detail</span>
        </div>

        {loading && !employee ? (
          <>
            <div className="cd-skel" style={{ height: 86, marginBottom: 10 }} />
            <div className="cd-skel" style={{ height: 110, marginBottom: 10 }} />
            <div className="cd-skel" style={{ height: 60 }} />
          </>
        ) : error && !employee ? (
          <div className="cd-error cd-anim">
            <p className="cd-error-title">Couldn't load this employee</p>
            <p className="cd-error-sub">{error}</p>
          </div>
        ) : !employee ? (
          <div className="cd-empty cd-anim">
            <p className="cd-empty-title">Employee not found</p>
            <p className="cd-empty-sub">They may have been removed.</p>
          </div>
        ) : (
          <>
            {banner && (
              <div className={`cd-banner ${banner.kind === 'success' ? 'is-success' : 'is-error'} cd-anim`}>
                {banner.text}
              </div>
            )}
            <section className="cd-identity cd-anim">
              <span className="cd-avatar">
                {initials(employee)}
                <span className={`cd-avatar-dot is-${status}`} />
              </span>
              <div className="cd-identity-meta">
                <div className="cd-identity-name">{fullName(employee)}</div>
                {(role || dept) && (
                  <div className="cd-identity-sub">
                    {[role, dept].filter(Boolean).join(' · ')}
                  </div>
                )}
                {(employee.email || employee.vtid) && (
                  <div className="cd-identity-row">
                    {employee.vtid && <span className="cd-tag">{employee.vtid}</span>}
                    {employee.email && <span className="cd-tag">{employee.email}</span>}
                  </div>
                )}
              </div>
            </section>

            <section className={`cd-status-card cd-anim is-${status}`}>
              <div className="cd-status-row">
                <div>
                  <div className="cd-status-label">Current status</div>
                  <div className="cd-status-value">{STATUS_LABELS[status] || status}</div>
                </div>
                <span className={`cd-status-pill is-${status}`}>{STATUS_LABELS[status] || status}</span>
              </div>
              {(status === 'clocked-in' || status === 'on-break') && liveSeconds != null && (
                <>
                  <div className="cd-live-timer">{formatTimerHMS(liveSeconds)}</div>
                  <div className="cd-live-sub">
                    {status === 'on-break' ? 'Time on shift (incl. breaks)' : 'Time on shift'}
                  </div>
                </>
              )}
            </section>

            {(status === 'clocked-in' || status === 'on-break') && (
              <div className="cd-shift-actions cd-anim">
                {status === 'clocked-in' ? (
                  <button
                    type="button"
                    className="cd-shift-btn is-break"
                    onClick={() => changeShiftStatus('on-break', `Start a break for ${fullName(employee)}?`)}
                    disabled={actingId === 'shift'}
                  >
                    {actingId === 'shift' ? <span className="cd-mini-spin" /> : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                        <line x1="6" y1="2" x2="6" y2="4" />
                        <line x1="10" y1="2" x2="10" y2="4" />
                        <line x1="14" y1="2" x2="14" y2="4" />
                      </svg>
                    )}
                    Start Break
                  </button>
                ) : (
                  <button
                    type="button"
                    className="cd-shift-btn is-resume"
                    onClick={() => changeShiftStatus('clocked-in', `Resume work for ${fullName(employee)}?`)}
                    disabled={actingId === 'shift'}
                  >
                    {actingId === 'shift' ? <span className="cd-mini-spin" /> : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                    Resume Work
                  </button>
                )}
                <button
                  type="button"
                  className="cd-shift-btn is-clockout"
                  onClick={() => changeShiftStatus('clocked-out', `Clock out ${fullName(employee)}?`)}
                  disabled={actingId === 'shift'}
                >
                  {actingId === 'shift' ? <span className="cd-mini-spin" /> : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  )}
                  Clock Out
                </button>
              </div>
            )}

            <h3 className="cd-section-label">Today</h3>
            <div className="cd-today-grid cd-anim">
              <div className="cd-stat-tile">
                <div className="cd-stat-tile-label">Clock In</div>
                <div className={`cd-stat-tile-value${todayStats.inT ? '' : ' is-muted'}`}>
                  {todayStats.inT || '—'}
                </div>
              </div>
              <div className="cd-stat-tile">
                <div className="cd-stat-tile-label">Clock Out</div>
                <div className={`cd-stat-tile-value${todayStats.outT ? '' : ' is-muted'}`}>
                  {todayStats.outT || '—'}
                </div>
              </div>
              <div className="cd-stat-tile">
                <div className="cd-stat-tile-label">Breaks</div>
                <div className={`cd-stat-tile-value${todayStats.breaks > 0 ? '' : ' is-muted'}`}>
                  {todayStats.breaks > 0 ? formatDuration(todayStats.breaks) : '—'}
                </div>
              </div>
              <div className="cd-stat-tile">
                <div className="cd-stat-tile-label">Net Hours</div>
                <div className={`cd-stat-tile-value${todayStats.netMin != null ? '' : ' is-muted'}`}>
                  {todayStats.netMin != null ? formatDuration(todayStats.netMin) : '—'}
                </div>
              </div>
            </div>

            {timeline.length > 0 && (
              <div className="cd-timeline cd-anim" style={{ marginTop: '0.55rem' }}>
                {timeline.map((e, i) => (
                  <div key={i} className="cd-timeline-row">
                    <span className={`cd-timeline-dot is-${e.kind}`} />
                    <span className="cd-timeline-label">{e.label}</span>
                    <span className="cd-timeline-time">{e.time}</span>
                  </div>
                ))}
              </div>
            )}

            <h3 className="cd-section-label">
              <span>Last 7 days</span>
              <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0.5, fontSize: '0.7rem', color: '#7a8e84' }}>
                {weekStats.days} days · {formatDuration(weekStats.totalMin) || '0h'}{weekStats.avg ? ` · avg ${formatDuration(weekStats.avg)}` : ''}
              </span>
            </h3>

            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="cd-skel" />)
            ) : recentEntries.length === 0 ? (
              <div className="cd-empty cd-anim">
                <p className="cd-empty-title">No recent clock-ins</p>
                <p className="cd-empty-sub">Nothing in the last two weeks.</p>
              </div>
            ) : (
              recentEntries.map((e, i) => {
                const d = entryDate(e);
                const net = netMinutes(e);
                const inT = timeOnly(e.clockIn);
                const outT = timeOnly(e.clockOut);
                const isEditing = editingId === e._id;
                const isActing = actingId === e._id;
                return (
                  <div key={e._id || i} className="cd-entry-wrap cd-anim">
                    <div className="cd-entry">
                      <div className="cd-entry-day">
                        <div className="cd-entry-day-num">{d ? d.getDate() : '–'}</div>
                        <div className="cd-entry-day-mon">{monthShort(d)}</div>
                      </div>
                      <div className="cd-entry-meta">
                        <div className="cd-entry-times">
                          {inT || '—'}
                          <span className="cd-arrow">→</span>
                          {outT || '—'}
                        </div>
                        <div className="cd-entry-sub">
                          {friendlyDay(d, today)}{e.location ? ` · ${e.location}` : ''}
                        </div>
                      </div>
                      <div>
                        <div className="cd-entry-hours">{formatDuration(net) || '—'}</div>
                        <div className="cd-entry-hours-sub">Net</div>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="cd-entry-edit">
                        <div className="cd-edit-row">
                          <div className="cd-edit-field">
                            <p className="cd-edit-label">Clock In</p>
                            <input
                              type="time"
                              className="cd-edit-input"
                              value={editForm.clockIn}
                              onChange={(ev) => setEditForm((f) => ({ ...f, clockIn: ev.target.value }))}
                            />
                          </div>
                          <div className="cd-edit-field">
                            <p className="cd-edit-label">Clock Out</p>
                            <input
                              type="time"
                              className="cd-edit-input"
                              value={editForm.clockOut}
                              onChange={(ev) => setEditForm((f) => ({ ...f, clockOut: ev.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="cd-edit-actions">
                          <button
                            type="button"
                            className="cd-edit-btn is-secondary"
                            onClick={cancelEdit}
                            disabled={isActing}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="cd-edit-btn is-primary"
                            onClick={() => saveEdit(e)}
                            disabled={isActing}
                          >
                            {isActing ? <span className="cd-mini-spin" /> : null}
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="cd-entry-actions">
                        <button
                          type="button"
                          className="cd-entry-action"
                          onClick={() => startEdit(e)}
                          disabled={isActing || !e._id}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="cd-entry-action is-danger"
                          onClick={() => deleteEntry(e)}
                          disabled={isActing || !e._id}
                        >
                          {isActing ? (
                            <span className="cd-mini-spin" />
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M3 6h18" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            </svg>
                          )}
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </>
  );
}
