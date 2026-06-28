import { useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import { getErrorMessage } from '../utils/errorHandler';

// Shared between admin and manager. Server-side scoping decides who sees what.
// Two endpoints (mirrors web Calendar.js:1063-1081):
//   GET /leave/calendar?startDate=&endDate=         → leave records
//   GET /rota/shift-assignments/all?startDate=&endDate= → shift assignments

const styles = `
  @keyframes cal-fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes cal-skel {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.9; }
  }

  .cal-wrap { padding: 0.85rem 1rem 6rem; }
  .cal-anim { animation: cal-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header (page) ── */
  .cal-header {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.25rem 0.85rem;
  }
  .cal-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18);
    flex-shrink: 0;
  }
  .cal-header-text { min-width: 0; flex: 1; }
  .cal-header-eyebrow {
    font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c; margin: 0;
  }
  .cal-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
  }

  /* ── Month panel ── */
  .cal-panel {
    background: #fff;
    border-radius: 18px;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47,62,70,0.04), 0 4px 14px rgba(47,62,70,0.04);
    padding: 0.85rem 0.85rem 0.7rem;
  }
  .cal-month-bar {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .cal-month-label {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.15rem; font-weight: 500;
    color: #2f3e46; letter-spacing: -0.01em;
  }
  .cal-month-nav { display: flex; align-items: center; gap: 0.3rem; }
  .cal-nav-btn {
    -webkit-tap-highlight-color: transparent;
    background: rgba(132, 169, 140, 0.12);
    color: #354f52; border: none;
    width: 32px; height: 32px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: background 0.12s, transform 0.12s;
  }
  .cal-nav-btn:active { transform: scale(0.94); background: rgba(132, 169, 140, 0.22); }
  .cal-today-btn {
    -webkit-tap-highlight-color: transparent;
    background: linear-gradient(135deg, #354f52, #52796f);
    color: #cad2c5;
    font-size: 0.7rem; font-weight: 600;
    letter-spacing: 0.06em;
    padding: 0.4rem 0.7rem;
    border: none; border-radius: 999px;
    margin-left: 0.25rem;
    cursor: pointer;
  }
  .cal-today-btn:active { transform: scale(0.96); }

  .cal-dow {
    display: grid; grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 0.62rem; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: #84a98c;
    padding-bottom: 4px;
  }

  .cal-grid {
    display: grid; grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }
  .cal-cell {
    aspect-ratio: 1 / 1;
    border-radius: 10px;
    background: none; border: none;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 2px;
    padding: 0;
    color: #354f52;
    font-size: 0.85rem; font-weight: 500;
    font-variant-numeric: tabular-nums;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    position: relative;
    transition: background 0.12s, color 0.12s, transform 0.1s;
  }
  .cal-cell:active { transform: scale(0.93); }
  .cal-cell.is-other-month { color: rgba(132, 169, 140, 0.45); }
  .cal-cell.is-today {
    background: rgba(132, 169, 140, 0.14);
    color: #2f3e46;
    font-weight: 700;
  }
  .cal-cell.is-selected {
    background: linear-gradient(135deg, #354f52, #52796f);
    color: #cad2c5;
    font-weight: 700;
  }
  .cal-cell.is-selected.is-today { background: linear-gradient(135deg, #2f3e46, #354f52); }

  .cal-dot-row {
    display: flex; gap: 2px; height: 5px;
    align-items: center; justify-content: center;
  }
  .cal-dot {
    width: 5px; height: 5px; border-radius: 50%;
  }
  .cal-dot.is-leave { background: #c0756a; }
  .cal-dot.is-shift { background: #52796f; }
  .cal-cell.is-selected .cal-dot { background: #cad2c5; }

  .cal-legend {
    display: flex; gap: 0.85rem; justify-content: center;
    margin-top: 0.65rem;
    font-size: 0.66rem; color: #7a8e84;
  }
  .cal-legend-item { display: inline-flex; align-items: center; gap: 0.3rem; }
  .cal-legend-dot { width: 7px; height: 7px; border-radius: 50%; }
  .cal-legend-dot.is-leave { background: #c0756a; }
  .cal-legend-dot.is-shift { background: #52796f; }

  /* ── Day details ── */
  .cal-day-heading {
    display: inline-flex; align-items: center; gap: 0.55rem;
    padding: 0 0.25rem;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: #52796f;
    margin: 1.2rem 0 0.5rem;
  }
  .cal-day-heading::before {
    content: '';
    width: 14px; height: 1.5px;
    background: linear-gradient(90deg, #84a98c, rgba(132, 169, 140, 0));
    border-radius: 1px;
  }

  .cal-event {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.6rem 0.75rem;
    border-radius: 12px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47,62,70,0.04);
    margin-bottom: 0.4rem;
  }
  .cal-event-bar {
    width: 4px; height: 38px;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .cal-event-bar.is-leave { background: #c0756a; }
  .cal-event-bar.is-shift { background: #52796f; }

  .cal-event-meta { min-width: 0; flex: 1; }
  .cal-event-name {
    font-size: 0.88rem; font-weight: 600;
    color: #2f3e46;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    line-height: 1.2;
  }
  .cal-event-detail {
    margin-top: 2px;
    font-size: 0.72rem; color: #7a8e84;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .cal-event-pill {
    flex-shrink: 0;
    font-size: 0.6rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 999px;
  }
  .cal-event-pill.is-leave { background: rgba(192, 117, 106, 0.14); color: #b85c50; }
  .cal-event-pill.is-shift { background: rgba(82, 121, 111, 0.16); color: #354f52; }

  .cal-skel {
    height: 240px; border-radius: 18px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: cal-skel 1.2s ease-in-out infinite;
  }

  .cal-empty, .cal-error {
    padding: 1.4rem 1rem; border-radius: 14px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center; color: #52796f;
  }
  .cal-error {
    border-color: rgba(192, 117, 106, 0.4);
    color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .cal-empty-title, .cal-error-title { font-size: 0.82rem; font-weight: 600; margin: 0; }
  .cal-empty-sub, .cal-error-sub { font-size: 0.72rem; margin: 0.2rem 0 0; opacity: 0.85; }
  .cal-retry {
    margin-top: 0.7rem;
    padding: 0.5rem 1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.75rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .cal-retry:active { transform: scale(0.97); }

  /* ── Tabs ── */
  .cal-tabs {
    display: flex; gap: 0.4rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin-bottom: 0.8rem;
    padding-bottom: 4px;
  }
  .cal-tabs::-webkit-scrollbar { display: none; }
  .cal-tab {
    flex-shrink: 0;
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.55rem 0.85rem;
    border-radius: 999px;
    border: 1px solid rgba(132, 169, 140, 0.4);
    background: rgba(255, 255, 255, 0.6);
    color: #52796f;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.76rem; font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .cal-tab.is-active {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    border-color: transparent;
  }
  .cal-tab-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    font-size: 0.62rem; font-weight: 700;
    background: rgba(132, 169, 140, 0.22);
    color: #354f52;
  }
  .cal-tab.is-active .cal-tab-badge { background: rgba(202, 210, 197, 0.25); color: #f2f5ef; }
  .cal-tab-badge.is-success { background: rgba(82, 121, 111, 0.2); color: #2f4a35; }
  .cal-tab-badge.is-warn { background: rgba(216, 166, 76, 0.2); color: #6b4f1d; }

  /* ── Header action ── */
  .cal-add-btn {
    flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    width: 38px; height: 38px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    box-shadow: 0 3px 10px rgba(53,79,82,0.22);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.12s;
  }
  .cal-add-btn:active { transform: scale(0.94); }

  /* ── Request cards (Approved / My) ── */
  .cal-req-card {
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    border-radius: 14px;
    padding: 0.75rem 0.85rem;
    margin-bottom: 0.5rem;
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
  }
  .cal-req-top {
    display: flex; align-items: flex-start; gap: 0.65rem;
  }
  .cal-req-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.28), rgba(82, 121, 111, 0.22));
    color: #354f52;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.78rem; font-weight: 600;
    flex-shrink: 0;
  }
  .cal-req-meta { min-width: 0; flex: 1; }
  .cal-req-name {
    font-size: 0.88rem; font-weight: 600;
    color: #2f3e46; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cal-req-sub {
    margin-top: 2px;
    font-size: 0.7rem; color: #84a98c;
    text-transform: capitalize;
  }
  .cal-req-pill {
    flex-shrink: 0;
    font-size: 0.6rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 999px;
    white-space: nowrap;
  }
  .cal-req-pill.is-approved { background: rgba(82, 121, 111, 0.18); color: #2f4a35; }
  .cal-req-pill.is-pending  { background: rgba(216, 166, 76, 0.18); color: #7a591f; }
  .cal-req-pill.is-rejected { background: rgba(192, 117, 106, 0.18); color: #7a3028; }
  .cal-req-pill.is-cancelled { background: rgba(122, 142, 132, 0.16); color: #4d5e57; }

  .cal-req-grid {
    margin-top: 0.6rem;
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 0.35rem 0.6rem;
    padding: 0.55rem 0.7rem;
    background: #f6f8f5;
    border-radius: 10px;
  }
  .cal-req-field-label {
    font-size: 0.55rem; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: #84a98c;
  }
  .cal-req-field-value {
    margin-top: 2px;
    font-size: 0.78rem; font-weight: 500;
    color: #2f3e46;
    font-variant-numeric: tabular-nums;
  }
  .cal-req-reason {
    margin-top: 0.5rem;
    padding: 0.45rem 0.6rem;
    background: rgba(132, 169, 140, 0.08);
    border-left: 2px solid rgba(132, 169, 140, 0.5);
    border-radius: 6px;
    font-size: 0.75rem; color: #354f52;
    line-height: 1.4;
  }
  .cal-req-reason.is-reject {
    background: rgba(192, 117, 106, 0.08);
    border-left-color: rgba(192, 117, 106, 0.5);
    color: #7a3028;
  }
  .cal-req-reason-label {
    font-size: 0.55rem; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: #84a98c;
    display: block;
    margin-bottom: 2px;
  }
  .cal-req-reason.is-reject .cal-req-reason-label { color: #b85c50; }
  .cal-req-actions {
    margin-top: 0.6rem;
    display: flex; gap: 0.4rem;
  }
  .cal-req-note {
    margin-top: 0.6rem;
    padding: 0.45rem 0.6rem;
    background: rgba(122, 142, 132, 0.1);
    border-radius: 8px;
    font-size: 0.72rem; color: #4d5e57;
    text-align: center;
  }
  .cal-req-btn {
    flex: 1;
    padding: 0.5rem 0.6rem;
    border-radius: 10px;
    font-size: 0.76rem; font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    display: flex; align-items: center; justify-content: center; gap: 0.3rem;
    transition: transform 0.12s;
    border: none;
  }
  .cal-req-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .cal-req-btn:not(:disabled):active { transform: scale(0.97); }
  .cal-req-btn.is-cancel {
    background: #fff;
    color: #b85c50;
    border: 1.5px solid rgba(192,117,106,0.55);
  }
  .cal-mini-spin {
    width: 11px; height: 11px;
    border: 2px solid currentColor; border-top-color: transparent;
    border-radius: 50%;
    animation: cal-spin 0.7s linear infinite;
  }
  @keyframes cal-spin { to { transform: rotate(360deg); } }

  /* ── Banner ── */
  .cal-banner {
    margin-bottom: 0.7rem;
    padding: 0.55rem 0.85rem;
    border-radius: 10px;
    font-size: 0.76rem; font-weight: 500;
  }
  .cal-banner.is-success {
    background: linear-gradient(135deg, #f0f5f2, #eaf2ec);
    border-left: 3px solid #52796f;
    color: #2f3e46;
  }
  .cal-banner.is-error {
    background: linear-gradient(135deg, #fdf3f2, #fdecea);
    border-left: 3px solid #c0756a;
    color: #7a3028;
  }

  /* ── Modal sheet ── */
  .cal-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(47, 62, 70, 0.42);
    z-index: 50;
    animation: cal-fadein 0.18s ease both;
    display: flex; flex-direction: column; justify-content: flex-end;
  }
  @keyframes cal-fadein { from { opacity: 0; } to { opacity: 1; } }
  @keyframes cal-slide  { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .cal-sheet {
    background: #fff;
    border-radius: 18px 18px 0 0;
    max-height: 92vh;
    overflow-y: auto;
    box-shadow: 0 -8px 24px rgba(47, 62, 70, 0.18);
    animation: cal-slide 0.25s cubic-bezier(0.22,1,0.36,1) both;
    padding: 0.85rem 1rem 1.1rem;
    padding-bottom: calc(1.1rem + env(safe-area-inset-bottom, 0px));
  }
  .cal-sheet-grip {
    width: 38px; height: 4px;
    border-radius: 999px;
    background: rgba(132, 169, 140, 0.4);
    margin: 0 auto 0.7rem;
  }
  .cal-sheet-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.3rem; font-weight: 500;
    color: #2f3e46;
    margin: 0 0 0.25rem;
  }
  .cal-sheet-sub {
    font-size: 0.7rem; color: #84a98c;
    margin: 0 0 0.9rem;
    letter-spacing: 0.04em;
  }
  .cal-form-row { margin-bottom: 0.7rem; }
  .cal-form-row.is-double { display: flex; gap: 0.5rem; }
  .cal-form-row.is-double .cal-form-field { flex: 1; min-width: 0; }
  .cal-form-label {
    display: block;
    font-size: 0.6rem; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: #84a98c;
    margin: 0 0 4px;
  }
  .cal-form-input, .cal-form-select, .cal-form-textarea {
    width: 100%;
    padding: 0.65rem 0.75rem;
    border: 1.5px solid #d4ddd6;
    border-radius: 10px;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem;
    color: #2f3e46;
    background: #fff;
    outline: none;
    -webkit-appearance: none; appearance: none;
    box-sizing: border-box;
    font-variant-numeric: tabular-nums;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .cal-form-input:focus, .cal-form-select:focus, .cal-form-textarea:focus {
    border-color: #52796f;
    box-shadow: 0 0 0 3px rgba(82,121,111,0.12);
  }
  .cal-form-textarea {
    min-height: 84px;
    font-family: 'DM Sans', sans-serif;
    resize: vertical;
  }
  .cal-half-row {
    display: flex; gap: 0.35rem;
    margin-top: 6px;
  }
  .cal-half-chip {
    flex: 1;
    border: 1px solid #d4ddd6;
    background: #fff;
    color: #354f52;
    border-radius: 8px;
    padding: 0.4rem 0.5rem;
    font-size: 0.7rem; font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .cal-half-chip.is-on {
    background: #52796f;
    border-color: #52796f;
    color: #fff;
  }
  .cal-sheet-actions {
    display: flex; gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .cal-sheet-btn {
    flex: 1;
    padding: 0.7rem 0.7rem;
    border-radius: 12px;
    font-size: 0.82rem; font-weight: 600;
    letter-spacing: 0.04em;
    border: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    display: flex; align-items: center; justify-content: center; gap: 0.4rem;
    transition: transform 0.12s;
  }
  .cal-sheet-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .cal-sheet-btn:not(:disabled):active { transform: scale(0.97); }
  .cal-sheet-btn.is-primary {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    box-shadow: 0 3px 10px rgba(53,79,82,0.22);
  }
  .cal-sheet-btn.is-secondary {
    background: #fff;
    color: #354f52;
    border: 1.5px solid #d4ddd6;
  }
`;

const DOW_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(d)  { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d)    { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d, n)  { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function startOfDay(d)    { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

// Mon-first day-of-week index (Mon=0..Sun=6)
function dowMon(d) { return (d.getDay() + 6) % 7; }

// All cell dates for a 6-row month grid, starting Mon before the 1st.
function buildGrid(monthDate) {
  const first = startOfMonth(monthDate);
  const lead = dowMon(first);
  const start = new Date(first);
  start.setDate(first.getDate() - lead);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// Pull a display name out of any of the shapes the backend uses.
function leaveName(leave) {
  if (leave?.user) return [leave.user.firstName, leave.user.lastName].filter(Boolean).join(' ');
  if (leave?.employeeId && typeof leave.employeeId === 'object') {
    return [leave.employeeId.firstName, leave.employeeId.lastName].filter(Boolean).join(' ');
  }
  return leave?.employeeName || 'Employee';
}
function shiftName(shift) {
  if (shift?.employeeId && typeof shift.employeeId === 'object') {
    return [shift.employeeId.firstName, shift.employeeId.lastName].filter(Boolean).join(' ');
  }
  if (shift?.employee) {
    return [shift.employee.firstName, shift.employee.lastName].filter(Boolean).join(' ');
  }
  return shift?.employeeName || 'Unassigned';
}

function leaveCoversDay(leave, ymd) {
  if (!leave?.startDate || !leave?.endDate) return false;
  return toYMD(new Date(leave.startDate)) <= ymd && ymd <= toYMD(new Date(leave.endDate));
}

// True once the leave has started (start date is today or earlier).
// Employees may only cancel leave that hasn't begun yet.
function leaveStarted(leave) {
  if (!leave?.startDate) return false;
  return startOfDay(new Date(leave.startDate)) <= startOfDay(new Date());
}

function shiftOnDay(shift, ymd) {
  if (!shift?.date) return false;
  return toYMD(new Date(shift.date)) === ymd;
}

function formatDateLong(d) {
  return d.toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatGB(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

function normalizeStatus(s) {
  return (s || 'pending').toString().trim().toLowerCase();
}

function approverName(req) {
  const a = req?.approverId || req?.approvedBy || req?.approvedByUserId;
  if (!a) return null;
  if (typeof a === 'string') return a;
  return [a.firstName, a.lastName].filter(Boolean).join(' ') || a.email || null;
}

const LEAVE_TYPES = [
  'Annual Leave', 'Sick Leave', 'Bank Holiday', 'Compassionate Leave',
  'Maternity Leave', 'Paternity Leave', 'Parental Leave',
  'Unpaid Leave', 'Personal Leave', 'Other',
];

export default function Calendar() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(today);       // first-of-month for the visible grid
  const [selected, setSelected] = useState(today);
  const [leaves, setLeaves] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('calendar');
  const [approved, setApproved] = useState([]);
  const [myReqs, setMyReqs] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [banner, setBanner] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    leaveType: 'Annual Leave',
    startDate: toYMD(today),
    endDate: toYMD(today),
    startHalfDay: 'full',
    endHalfDay: 'full',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 2800);
  }

  useEffect(() => {
    if (!modalOpen) return undefined;
    const stage = document.querySelector('.tg-stage-inner');
    if (!stage) return undefined;
    const prevOverflow = stage.style.overflow;
    const prevTouch = stage.style.touchAction;
    const scrollTop = stage.scrollTop;
    stage.style.overflow = 'hidden';
    stage.style.touchAction = 'none';
    // Block touchmove on the overlay itself too — defence in depth for iOS.
    const blockTouch = (e) => {
      // Allow scrolling inside the sheet
      if (e.target.closest('.cal-sheet')) return;
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

  async function fetchMonth(monthDate) {
    setLoading(true);
    setError(null);
    const startStr = toYMD(startOfMonth(monthDate));
    const endStr = toYMD(endOfMonth(monthDate));
    try {
      const [leaveRes, shiftRes] = await Promise.all([
        api.get(`/leave/calendar?startDate=${startStr}&endDate=${endStr}`).catch(() => null),
        api.get(`/rota/shift-assignments/all?startDate=${startStr}&endDate=${endStr}`).catch(() => null),
      ]);
      setLeaves(leaveRes?.data?.data || []);
      setShifts(shiftRes?.data?.data || []);
      if (!leaveRes && !shiftRes) {
        setError(getErrorMessage(new Error('Both feeds failed')));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMonth(cursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.getFullYear(), cursor.getMonth()]);

  async function fetchRequestLists() {
    setReqLoading(true);
    try {
      const [appRes, myRes] = await Promise.all([
        api.get('/leave/approved-requests').catch(() => null),
        api.get('/leave/my-requests').catch(() => null),
      ]);
      const appList = appRes?.data?.data || appRes?.data?.requests || (Array.isArray(appRes?.data) ? appRes.data : []);
      const myList  = myRes?.data?.data  || myRes?.data?.requests  || (Array.isArray(myRes?.data) ? myRes.data : []);
      setApproved(Array.isArray(appList) ? appList : []);
      setMyReqs(Array.isArray(myList) ? myList : []);
    } finally {
      setReqLoading(false);
    }
  }

  useEffect(() => {
    fetchRequestLists();
  }, []);

  async function cancelLeave(req) {
    if (leaveStarted(req)) {
      flash('error', 'This leave has already started and can no longer be cancelled');
      return;
    }
    if (!window.confirm('Cancel this leave request?')) return;
    setActingId(req._id);
    try {
      await api.patch(`/leave/cancel/${req._id}`, { cancellationReason: 'Cancelled from mobile' });
      setApproved((prev) => prev.filter((r) => r._id !== req._id));
      setMyReqs((prev) => prev.map((r) => (r._id === req._id ? { ...r, status: 'cancelled' } : r)));
      flash('success', 'Leave cancelled');
      fetchMonth(cursor);
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  function openModal() {
    setForm({
      leaveType: 'Annual Leave',
      startDate: toYMD(selected || today),
      endDate: toYMD(selected || today),
      startHalfDay: 'full',
      endHalfDay: 'full',
      reason: '',
    });
    setModalOpen(true);
  }

  async function submitTimeOff(e) {
    e?.preventDefault?.();
    if (!form.leaveType || !form.startDate || !form.endDate) {
      flash('error', 'Type, start and end date are required');
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      flash('error', 'End date can\'t be before start');
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
      flash('success', 'Time off requested');
      setModalOpen(false);
      fetchRequestLists();
      fetchMonth(cursor);
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const cells = useMemo(() => buildGrid(cursor), [cursor]);

  // Per-day index of has-leave / has-shift, keyed by YYYY-MM-DD,
  // computed once per data change to keep the grid render cheap.
  const markers = useMemo(() => {
    const map = new Map();
    function bump(ymd, kind) {
      const cur = map.get(ymd) || { leave: false, shift: false };
      cur[kind] = true;
      map.set(ymd, cur);
    }
    for (const leave of leaves) {
      if (!leave?.startDate || !leave?.endDate) continue;
      const s = startOfDay(new Date(leave.startDate));
      const e = startOfDay(new Date(leave.endDate));
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        bump(toYMD(d), 'leave');
      }
    }
    for (const shift of shifts) {
      if (!shift?.date) continue;
      bump(toYMD(new Date(shift.date)), 'shift');
    }
    return map;
  }, [leaves, shifts]);

  const selectedYMD = toYMD(selected);
  const dayLeaves = useMemo(
    () => leaves.filter((l) => leaveCoversDay(l, selectedYMD)),
    [leaves, selectedYMD]
  );
  const dayShifts = useMemo(
    () => shifts.filter((s) => shiftOnDay(s, selectedYMD)),
    [shifts, selectedYMD]
  );

  function goToToday() {
    setCursor(startOfMonth(today));
    setSelected(today);
  }

  return (
    <>
      <style>{styles}</style>
      <div className="cal-wrap">
        <header className="cal-header cal-anim">
          <div className="cal-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <div className="cal-header-text">
            <p className="cal-header-eyebrow">Leave & Shifts</p>
            <h1 className="cal-header-title">Calendar</h1>
          </div>
          <button
            type="button"
            className="cal-add-btn"
            onClick={openModal}
            aria-label="Request time off"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </header>

        <div className="cal-tabs cal-anim">
          <button
            type="button"
            className={`cal-tab${tab === 'calendar' ? ' is-active' : ''}`}
            onClick={() => setTab('calendar')}
          >
            Calendar
          </button>
          <button
            type="button"
            className={`cal-tab${tab === 'approved' ? ' is-active' : ''}`}
            onClick={() => setTab('approved')}
          >
            Approved
            <span className="cal-tab-badge is-success">{approved.length}</span>
          </button>
          <button
            type="button"
            className={`cal-tab${tab === 'mine' ? ' is-active' : ''}`}
            onClick={() => setTab('mine')}
          >
            My Requests
            <span className="cal-tab-badge">{myReqs.length}</span>
          </button>
        </div>

        {banner && (
          <div className={`cal-banner ${banner.kind === 'success' ? 'is-success' : 'is-error'} cal-anim`}>
            {banner.text}
          </div>
        )}

        {tab === 'calendar' && error && leaves.length === 0 && shifts.length === 0 ? (
          <div className="cal-error cal-anim">
            <p className="cal-error-title">Couldn't load calendar</p>
            <p className="cal-error-sub">{error}</p>
            <button className="cal-retry" onClick={() => fetchMonth(cursor)}>Try again</button>
          </div>
        ) : tab === 'calendar' ? (
          <>
            <div className="cal-panel cal-anim">
              <div className="cal-month-bar">
                <span className="cal-month-label">
                  {MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}
                </span>
                <div className="cal-month-nav">
                  <button
                    type="button"
                    className="cal-nav-btn"
                    onClick={() => setCursor((c) => addMonths(c, -1))}
                    aria-label="Previous month"
                  >
                    <ChevronIcon dir="left" />
                  </button>
                  <button
                    type="button"
                    className="cal-nav-btn"
                    onClick={() => setCursor((c) => addMonths(c, 1))}
                    aria-label="Next month"
                  >
                    <ChevronIcon dir="right" />
                  </button>
                  <button type="button" className="cal-today-btn" onClick={goToToday}>
                    Today
                  </button>
                </div>
              </div>

              <div className="cal-dow" aria-hidden="true">
                {DOW_MON_FIRST.map((d) => <span key={d}>{d}</span>)}
              </div>

              {loading ? (
                <div className="cal-skel" />
              ) : (
                <div className="cal-grid">
                  {cells.map((d) => {
                    const ymd = toYMD(d);
                    const isOtherMonth = d.getMonth() !== cursor.getMonth();
                    const isToday = ymd === toYMD(today);
                    const isSelected = ymd === selectedYMD;
                    const mark = markers.get(ymd);
                    return (
                      <button
                        key={ymd}
                        type="button"
                        className={`cal-cell ${isOtherMonth ? 'is-other-month' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setSelected(d)}
                      >
                        <span>{d.getDate()}</span>
                        <span className="cal-dot-row">
                          {mark?.leave && <span className="cal-dot is-leave" />}
                          {mark?.shift && <span className="cal-dot is-shift" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="cal-legend">
                <span className="cal-legend-item">
                  <span className="cal-legend-dot is-leave" /> Leave
                </span>
                <span className="cal-legend-item">
                  <span className="cal-legend-dot is-shift" /> Shift
                </span>
              </div>
            </div>

            <h3 className="cal-day-heading">{formatDateLong(selected)}</h3>

            {dayLeaves.length === 0 && dayShifts.length === 0 ? (
              <div className="cal-empty cal-anim">
                <p className="cal-empty-title">Nothing scheduled</p>
                <p className="cal-empty-sub">No leave or shifts on this day.</p>
              </div>
            ) : (
              <>
                {dayLeaves.map((leave) => (
                  <div key={`l-${leave._id}`} className="cal-event cal-anim">
                    <span className="cal-event-bar is-leave" />
                    <div className="cal-event-meta">
                      <div className="cal-event-name">{leaveName(leave)}</div>
                      <div className="cal-event-detail">
                        {(leave.type || leave.leaveType || 'Leave')}
                        {leave.numberOfDays ? ` · ${leave.numberOfDays}d` : ''}
                      </div>
                    </div>
                    <span className="cal-event-pill is-leave">Leave</span>
                  </div>
                ))}
                {dayShifts.map((shift) => (
                  <div key={`s-${shift._id}`} className="cal-event cal-anim">
                    <span className="cal-event-bar is-shift" />
                    <div className="cal-event-meta">
                      <div className="cal-event-name">{shiftName(shift)}</div>
                      <div className="cal-event-detail">
                        {(shift.startTime && shift.endTime) ? `${shift.startTime} – ${shift.endTime}` : ''}
                        {shift.location ? `${(shift.startTime ? ' · ' : '')}${shift.location}` : ''}
                      </div>
                    </div>
                    <span className="cal-event-pill is-shift">Shift</span>
                  </div>
                ))}
              </>
            )}
          </>
        ) : tab === 'approved' ? (
          <ApprovedList
            items={approved}
            loading={reqLoading}
            actingId={actingId}
            onCancel={cancelLeave}
            onOpenForm={openModal}
          />
        ) : (
          <MyRequestsList
            items={myReqs}
            loading={reqLoading}
            actingId={actingId}
            onCancel={cancelLeave}
            onOpenForm={openModal}
          />
        )}

        {modalOpen && (
          <TimeOffSheet
            form={form}
            setForm={setForm}
            submitting={submitting}
            onClose={() => setModalOpen(false)}
            onSubmit={submitTimeOff}
          />
        )}
      </div>
    </>
  );
}

function ChevronIcon({ dir }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
    </svg>
  );
}

function RequestCardSkeleton() {
  return (
    <div className="cal-req-card" style={{ height: 110 }}>
      <div className="cal-skel" style={{ height: '100%' }} />
    </div>
  );
}

function ApprovedList({ items, loading, actingId, onCancel, onOpenForm }) {
  if (loading && items.length === 0) {
    return (
      <>
        {Array.from({ length: 3 }).map((_, i) => <RequestCardSkeleton key={i} />)}
      </>
    );
  }
  if (items.length === 0) {
    return (
      <div className="cal-empty cal-anim">
        <p className="cal-empty-title">No approved requests</p>
        <p className="cal-empty-sub">Approved leave requests will appear here.</p>
        <button className="cal-retry" onClick={onOpenForm} style={{ marginTop: '0.9rem' }}>
          + Request time off
        </button>
      </div>
    );
  }
  return items.map((req) => {
    const name = leaveName(req);
    const employee = req?.employeeId && typeof req.employeeId === 'object' ? req.employeeId : null;
    return (
      <div key={req._id} className="cal-req-card cal-anim">
        <div className="cal-req-top">
          <span className="cal-req-avatar">{initials(name)}</span>
          <div className="cal-req-meta">
            <div className="cal-req-name">{name}</div>
            <div className="cal-req-sub">{employee?.email || req.leaveType || 'Leave'}</div>
          </div>
          <span className="cal-req-pill is-approved">Approved</span>
        </div>
        <div className="cal-req-grid">
          <div>
            <div className="cal-req-field-label">Type</div>
            <div className="cal-req-field-value">{req.leaveType || '—'}</div>
          </div>
          <div>
            <div className="cal-req-field-label">Days</div>
            <div className="cal-req-field-value">{req.numberOfDays ?? '—'}</div>
          </div>
          <div>
            <div className="cal-req-field-label">From</div>
            <div className="cal-req-field-value">{formatGB(req.startDate)}</div>
          </div>
          <div>
            <div className="cal-req-field-label">To</div>
            <div className="cal-req-field-value">{formatGB(req.endDate)}</div>
          </div>
          {req.approvedAt && (
            <div>
              <div className="cal-req-field-label">Approved</div>
              <div className="cal-req-field-value">{formatGB(req.approvedAt)}</div>
            </div>
          )}
          {approverName(req) && (
            <div>
              <div className="cal-req-field-label">By</div>
              <div className="cal-req-field-value">{approverName(req)}</div>
            </div>
          )}
        </div>
        {req.reason && (
          <div className="cal-req-reason">
            <span className="cal-req-reason-label">Reason</span>
            {req.reason}
          </div>
        )}
        {leaveStarted(req) ? (
          <div className="cal-req-note">This leave has started and can no longer be cancelled.</div>
        ) : (
          <div className="cal-req-actions">
            <button
              type="button"
              className="cal-req-btn is-cancel"
              onClick={() => onCancel(req)}
              disabled={actingId === req._id}
            >
              {actingId === req._id ? <span className="cal-mini-spin" /> : null}
              Cancel Leave
            </button>
          </div>
        )}
      </div>
    );
  });
}

function MyRequestsList({ items, loading, actingId, onCancel, onOpenForm }) {
  if (loading && items.length === 0) {
    return (
      <>
        {Array.from({ length: 3 }).map((_, i) => <RequestCardSkeleton key={i} />)}
      </>
    );
  }
  if (items.length === 0) {
    return (
      <div className="cal-empty cal-anim">
        <p className="cal-empty-title">No requests yet</p>
        <p className="cal-empty-sub">You haven't filed any time off.</p>
        <button className="cal-retry" onClick={onOpenForm} style={{ marginTop: '0.9rem' }}>
          + Request time off
        </button>
      </div>
    );
  }
  return items.map((req) => {
    const status = normalizeStatus(req.status);
    const pillClass = status === 'approved' ? 'is-approved'
      : status === 'rejected' ? 'is-rejected'
      : status === 'cancelled' ? 'is-cancelled'
      : 'is-pending';
    const pillLabel = status === 'approved' ? 'Approved'
      : status === 'rejected' ? 'Rejected'
      : status === 'cancelled' ? 'Cancelled'
      : 'Pending';
    const cancellable = (status === 'pending' || status === 'approved') && !leaveStarted(req);
    return (
      <div key={req._id} className="cal-req-card cal-anim">
        <div className="cal-req-top">
          <div className="cal-req-meta" style={{ paddingLeft: 2 }}>
            <div className="cal-req-name">{req.leaveType || 'Leave'}</div>
            <div className="cal-req-sub">
              {formatGB(req.startDate)} → {formatGB(req.endDate)}
            </div>
          </div>
          <span className={`cal-req-pill ${pillClass}`}>{pillLabel}</span>
        </div>
        <div className="cal-req-grid">
          <div>
            <div className="cal-req-field-label">Days</div>
            <div className="cal-req-field-value">{req.numberOfDays ?? '—'}</div>
          </div>
          <div>
            <div className="cal-req-field-label">Submitted</div>
            <div className="cal-req-field-value">{formatGB(req.createdAt)}</div>
          </div>
        </div>
        {req.reason && (
          <div className="cal-req-reason">
            <span className="cal-req-reason-label">Reason</span>
            {req.reason}
          </div>
        )}
        {req.rejectionReason && status === 'rejected' && (
          <div className="cal-req-reason is-reject">
            <span className="cal-req-reason-label">Rejection reason</span>
            {req.rejectionReason}
          </div>
        )}
        {cancellable && (
          <div className="cal-req-actions">
            <button
              type="button"
              className="cal-req-btn is-cancel"
              onClick={() => onCancel(req)}
              disabled={actingId === req._id}
            >
              {actingId === req._id ? <span className="cal-mini-spin" /> : null}
              Cancel Request
            </button>
          </div>
        )}
      </div>
    );
  });
}

function TimeOffSheet({ form, setForm, submitting, onClose, onSubmit }) {
  return (
    <div className="cal-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <form
        className="cal-sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="cal-sheet-grip" />
        <h2 className="cal-sheet-title">Request Time Off</h2>
        <p className="cal-sheet-sub">Submit a new leave request</p>

        <div className="cal-form-row">
          <label className="cal-form-label">Leave Type</label>
          <select
            className="cal-form-select"
            value={form.leaveType}
            onChange={(e) => setForm((f) => ({ ...f, leaveType: e.target.value }))}
          >
            {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="cal-form-row is-double">
          <div className="cal-form-field">
            <label className="cal-form-label">Start Date</label>
            <input
              type="date"
              className="cal-form-input"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate }))}
            />
            <div className="cal-half-row">
              {[['full', 'Full'], ['am', 'AM'], ['pm', 'PM']].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  className={`cal-half-chip${form.startHalfDay === k ? ' is-on' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, startHalfDay: k }))}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="cal-form-field">
            <label className="cal-form-label">End Date</label>
            <input
              type="date"
              className="cal-form-input"
              value={form.endDate}
              min={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
            <div className="cal-half-row">
              {[['full', 'Full'], ['am', 'AM'], ['pm', 'PM']].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  className={`cal-half-chip${form.endHalfDay === k ? ' is-on' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, endHalfDay: k }))}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="cal-form-row">
          <label className="cal-form-label">Reason</label>
          <textarea
            className="cal-form-textarea"
            placeholder="A short reason for the time off…"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            maxLength={500}
          />
        </div>

        <div className="cal-sheet-actions">
          <button
            type="button"
            className="cal-sheet-btn is-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="cal-sheet-btn is-primary"
            disabled={submitting}
          >
            {submitting ? <span className="cal-mini-spin" /> : null}
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
