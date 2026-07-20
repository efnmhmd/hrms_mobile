import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';
import ShiftMonthCalendar from '../../components/ShiftMonthCalendar';

// Manager shift-management / team-rota overview.
//   GET /rota/shift-assignments/all?startDate=&endDate=  → { data: [...] }
// Same team-wide endpoint the shared Calendar uses. Windowed to the visible
// week, grouped per day so a manager can see who's covering each day. Read-only
// oversight — creating / editing shifts stays on the web rota planner.

const styles = `
  @keyframes sm-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes sm-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes sm-spin { to { transform: rotate(360deg); } }

  .sm-wrap { padding: 0.85rem 1rem 6rem; }
  .sm-anim { animation: sm-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  .sm-header { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.25rem 0.85rem; }
  .sm-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18); flex-shrink: 0;
  }
  .sm-header-text { min-width: 0; flex: 1; }
  .sm-header-eyebrow { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .sm-header-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1; font-weight: 400; color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0; }
  .sm-refresh {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .sm-refresh:disabled { opacity: 0.55; }
  .sm-refresh:not(:disabled):active { transform: scale(0.94); }
  .sm-refresh.is-busy svg { animation: sm-spin 0.8s linear infinite; }
  .sm-header-actions { flex-shrink: 0; display: flex; align-items: center; gap: 0.4rem; }
  .sm-header-assign {
    flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.3rem;
    height: 36px; padding: 0 0.75rem; border-radius: 10px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #eef2ec;
    font-family: 'DM Sans', sans-serif; font-size: 0.76rem; font-weight: 600; letter-spacing: 0.01em;
    box-shadow: 0 4px 12px rgba(53,79,82,0.2); cursor: pointer;
    -webkit-tap-highlight-color: transparent; transition: transform 0.12s;
  }
  .sm-header-assign:active { transform: scale(0.95); }
  .sm-header-assign svg { flex-shrink: 0; }

  /* ── View toggle (Week / Calendar) ── */
  .sm-viewtabs { display: flex; gap: 0.4rem; margin-bottom: 0.85rem; }
  .sm-viewtab {
    flex: 1; padding: 0.5rem 0.4rem; border-radius: 12px;
    font-size: 0.76rem; font-weight: 600; letter-spacing: 0.02em;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    -webkit-tap-highlight-color: transparent; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .sm-viewtab.is-active { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; border-color: transparent; }
  .sm-viewtab:active { transform: scale(0.98); }
  .sm-viewtab svg { flex-shrink: 0; }

  /* ── Week navigator ── */
  .sm-weeknav {
    display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.85rem;
    background: #fff; border: 1px solid rgba(212, 221, 214, 0.7); border-radius: 14px;
    padding: 0.5rem 0.55rem; box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
  }
  .sm-weeknav-btn {
    flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px;
    border: 1px solid rgba(212, 221, 214, 0.8); background: #fff; color: #354f52;
    display: flex; align-items: center; justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, transform 0.12s;
  }
  .sm-weeknav-btn:active { background: #f1f4f0; transform: scale(0.94); }
  .sm-weeknav-mid { flex: 1; min-width: 0; text-align: center; }
  .sm-weeknav-range { font-size: 0.85rem; font-weight: 600; color: #2f3e46; line-height: 1.15; }
  .sm-weeknav-rel { font-size: 0.62rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #84a98c; margin-top: 1px; }
  .sm-today-btn {
    margin-bottom: 0.85rem; width: 100%;
    border: 1px dashed rgba(132, 169, 140, 0.5); background: rgba(132, 169, 140, 0.08);
    color: #52796f; border-radius: 10px; padding: 0.4rem; font-size: 0.72rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .sm-today-btn:active { transform: scale(0.98); }

  /* ── Summary ── */
  .sm-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; margin-bottom: 0.85rem; }
  .sm-stat { border: 1px solid rgba(212, 221, 214, 0.7); background: #fff; border-radius: 12px; padding: 0.6rem 0.5rem; text-align: center; box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04); }
  .sm-stat-val { font-size: 1.15rem; font-weight: 700; color: #2f3e46; font-variant-numeric: tabular-nums; line-height: 1; }
  .sm-stat-lab { margin-top: 4px; font-size: 0.55rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #84a98c; }

  /* ── Search ── */
  .sm-search { position: relative; margin-bottom: 0.85rem; }
  .sm-search svg { position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%); color: #84a98c; pointer-events: none; }
  .sm-search input {
    width: 100%; padding: 0.65rem 0.75rem 0.65rem 2.2rem; border-radius: 12px;
    border: 1.5px solid #d4ddd6; background: #fff; font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46;
    -webkit-appearance: none; appearance: none; box-sizing: border-box; -webkit-tap-highlight-color: transparent;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .sm-search input::placeholder { color: #a7b6ac; }
  .sm-search input:focus { outline: none; border-color: #52796f; box-shadow: 0 0 0 3px rgba(82, 121, 111, 0.12); }

  /* ── Day group ── */
  .sm-day { margin-bottom: 0.4rem; }
  .sm-day-head {
    display: flex; align-items: center; gap: 0.5rem;
    margin: 0.7rem 0.25rem 0.45rem;
  }
  .sm-day-label { font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #52796f; }
  .sm-day-label.is-today { color: #354f52; }
  .sm-day-pill { font-size: 0.55rem; font-weight: 700; letter-spacing: 0.06em; color: #fff; background: #52796f; border-radius: 999px; padding: 1px 6px; }
  .sm-day-line { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(132,169,140,0.35), rgba(132,169,140,0)); }
  .sm-day-num { font-size: 0.62rem; color: #9aa8a0; font-weight: 600; }

  .sm-card {
    display: flex; align-items: center; gap: 0.65rem; width: 100%; text-align: left;
    padding: 0.6rem 0.75rem; border-radius: 13px; background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.4rem; font-family: 'DM Sans', sans-serif; cursor: pointer;
    -webkit-tap-highlight-color: transparent; transition: transform 0.12s, background 0.15s;
    border-left: 3px solid #52796f;
  }
  .sm-card:active { transform: scale(0.99); background: #f7f8f6; }
  .sm-card.is-completed { border-left-color: #4c8c52; }
  .sm-card.is-danger { border-left-color: #c0756a; }
  .sm-card.is-warn { border-left-color: #c49c4a; }
  .sm-avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 0.74rem; font-weight: 700; background: linear-gradient(135deg, rgba(132, 169, 140, 0.28), rgba(82, 121, 111, 0.18)); color: #354f52; }
  .sm-body { min-width: 0; flex: 1; }
  .sm-name { display: block; font-size: 0.85rem; font-weight: 600; color: #2f3e46; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sm-meta { margin-top: 2px; display: flex; align-items: center; gap: 0.4rem; font-size: 0.72rem; color: #52796f; }
  .sm-meta .sm-time { font-weight: 600; color: #2f3e46; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sm-meta .sm-loc { color: #7a8e84; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sm-status { flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.03em; border-radius: 999px; padding: 2px 7px; border: 1px solid transparent; white-space: nowrap; }
  .sm-status-dot { width: 5px; height: 5px; border-radius: 50%; }
  .sm-status-scheduled { background: rgba(82,121,111,0.1); color: #354f52; border-color: rgba(82,121,111,0.25); }
  .sm-status-scheduled .sm-status-dot { background: #52796f; }
  .sm-status-completed { background: rgba(76,140,82,0.12); color: #2f6e34; border-color: rgba(76,140,82,0.28); }
  .sm-status-completed .sm-status-dot { background: #4c8c52; }
  .sm-status-danger { background: rgba(192,117,106,0.12); color: #8a352b; border-color: rgba(192,117,106,0.3); }
  .sm-status-danger .sm-status-dot { background: #c0756a; }
  .sm-status-warn { background: rgba(196,156,74,0.14); color: #7a5a16; border-color: rgba(196,156,74,0.32); }
  .sm-status-warn .sm-status-dot { background: #c49c4a; }

  .sm-day-empty { font-size: 0.72rem; color: #aab6ad; font-style: italic; padding: 0.3rem 0.5rem 0.5rem; }

  /* ── States ── */
  .sm-skel { height: 56px; border-radius: 13px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%); animation: sm-skel 1.2s ease-in-out infinite; margin-bottom: 0.4rem; }
  .sm-error {
    padding: 2rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(192, 117, 106, 0.4); text-align: center; color: #7a3028;
  }
  .sm-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .sm-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .sm-retry { margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .sm-retry:active { transform: scale(0.97); }
  .sm-empty-week {
    padding: 1.6rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .sm-empty-week-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .sm-empty-week-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }


  /* ── Flash toast ── */
  .sm-flash {
    position: fixed; left: 50%; transform: translateX(-50%); z-index: 70;
    top: calc(env(safe-area-inset-top) + 0.6rem);
    display: flex; align-items: center; gap: 0.5rem;
    max-width: min(92vw, 420px); padding: 0.6rem 0.9rem; border-radius: 12px;
    background: #2f6e34; color: #eaf3ea; font-size: 0.8rem; font-weight: 600;
    box-shadow: 0 10px 28px rgba(47, 62, 70, 0.28);
    animation: sm-fadeUp 0.28s cubic-bezier(0.22,1,0.36,1) both;
  }
  .sm-flash svg { flex-shrink: 0; }

  /* ── Assign modal ── */
  .sm-modal-overlay {
    position: fixed; inset: 0; z-index: 60;
    background: rgba(47, 62, 70, 0.55);
    display: flex; align-items: flex-end; justify-content: center;
    padding: 0; -webkit-tap-highlight-color: transparent;
  }
  .sm-modal {
    width: 100%; max-width: 480px; max-height: 92vh; overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    background: #f7f8f6; border-radius: 20px 20px 0 0;
    padding: 0.4rem 1.1rem calc(env(safe-area-inset-bottom) + 1.1rem);
    box-shadow: 0 -18px 48px rgba(47, 62, 70, 0.28);
    animation: sm-fadeUp 0.28s cubic-bezier(0.22,1,0.36,1) both;
  }
  .sm-modal-grab { width: 38px; height: 4px; border-radius: 999px; background: #cdd6cf; margin: 0.55rem auto 0.4rem; }
  .sm-modal-head { display: flex; align-items: flex-start; gap: 0.6rem; padding: 0.35rem 0 0.7rem; }
  .sm-modal-head-text { flex: 1; min-width: 0; }
  .sm-modal-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; font-weight: 400; color: #2f3e46; margin: 0; line-height: 1.1; }
  .sm-modal-sub { font-size: 0.72rem; color: #7a8e84; margin: 0.15rem 0 0; }
  .sm-close {
    flex-shrink: 0; width: 32px; height: 32px; border-radius: 9px;
    border: 1px solid rgba(212, 221, 214, 0.9); background: #fff; color: #52796f;
    display: flex; align-items: center; justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .sm-close:active { transform: scale(0.94); }

  .sm-field { margin-bottom: 0.75rem; }
  .sm-field-label { display: block; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #52796f; margin: 0 0 0.35rem 0.1rem; }
  .sm-field-req { color: #c0756a; }
  .sm-input, .sm-select, .sm-textarea {
    width: 100%; box-sizing: border-box; padding: 0.65rem 0.75rem; border-radius: 12px;
    border: 1.5px solid #d4ddd6; background: #fff; color: #2f3e46;
    font-family: 'DM Sans', sans-serif; font-size: 16px; -webkit-appearance: none; appearance: none;
    -webkit-tap-highlight-color: transparent; transition: border-color 0.18s, box-shadow 0.18s;
  }
  .sm-input:focus, .sm-select:focus, .sm-textarea:focus { outline: none; border-color: #52796f; box-shadow: 0 0 0 3px rgba(82, 121, 111, 0.12); }
  .sm-select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2352796f' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 0.7rem center; padding-right: 2.2rem;
  }
  .sm-textarea { resize: vertical; min-height: 62px; }
  .sm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .sm-hint { font-size: 0.66rem; color: #8a9a90; margin: 0.3rem 0.1rem 0; }

  .sm-modal-error {
    display: flex; gap: 0.5rem; align-items: flex-start;
    padding: 0.6rem 0.75rem; border-radius: 12px; margin-bottom: 0.75rem;
    background: rgba(192, 117, 106, 0.1); border: 1px solid rgba(192, 117, 106, 0.35);
    color: #8a352b; font-size: 0.76rem; font-weight: 500;
  }
  .sm-modal-error svg { flex-shrink: 0; margin-top: 1px; }

  .sm-modal-actions { display: flex; gap: 0.6rem; margin-top: 0.35rem; }
  .sm-btn {
    flex: 1; padding: 0.75rem; border-radius: 12px; font-family: 'DM Sans', sans-serif;
    font-size: 0.84rem; font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent;
    display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; transition: transform 0.12s;
  }
  .sm-btn:active { transform: scale(0.98); }
  .sm-btn:disabled { opacity: 0.6; cursor: default; }
  .sm-btn-secondary { border: 1.5px solid #d4ddd6; background: #fff; color: #52796f; }
  .sm-btn-primary { border: none; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #eef2ec; }
  .sm-mini-spin { width: 15px; height: 15px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.45); border-top-color: #fff; animation: sm-spin 0.7s linear infinite; }

  /* ── Custom date field + calendar (dd/mm/yyyy) ── */
  .sm-date { position: relative; }
  .sm-date-trigger {
    display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
    text-align: left; cursor: pointer;
  }
  .sm-date-trigger:disabled { opacity: 0.6; cursor: default; }
  .sm-date-trigger svg { flex-shrink: 0; color: #52796f; }
  .sm-date-val { color: #2f3e46; }
  .sm-date-ph { color: #9aa8a0; }
  .sm-cal {
    position: absolute; z-index: 30; top: calc(100% + 6px); left: 0;
    width: 264px; max-width: calc(100vw - 2.4rem);
    background: #fff; border: 1px solid rgba(212, 221, 214, 0.9); border-radius: 14px;
    box-shadow: 0 12px 32px rgba(47, 62, 70, 0.2); padding: 0.7rem;
    animation: sm-fadeUp 0.16s ease both;
  }
  .sm-cal.is-right { left: auto; right: 0; }
  .sm-cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
  .sm-cal-title { font-size: 0.82rem; font-weight: 700; color: #2f3e46; }
  .sm-cal-nav {
    width: 30px; height: 30px; border-radius: 8px; border: 1px solid rgba(212, 221, 214, 0.9);
    background: #fff; color: #354f52; cursor: pointer; -webkit-tap-highlight-color: transparent;
    display: flex; align-items: center; justify-content: center;
  }
  .sm-cal-nav:active { background: #f1f4f0; }
  .sm-cal-dow { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 3px; }
  .sm-cal-dow span { text-align: center; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; color: #9aa8a0; padding: 2px 0; }
  .sm-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
  .sm-cal-empty { height: 34px; }
  .sm-cal-day {
    height: 34px; display: flex; align-items: center; justify-content: center;
    border: none; background: transparent; border-radius: 8px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 0.8rem; color: #2f3e46;
    -webkit-tap-highlight-color: transparent; transition: background 0.12s;
  }
  .sm-cal-day:not(:disabled):active { background: #e6ece7; }
  .sm-cal-day.is-weekend { color: #b3bdb5; }
  .sm-cal-day.is-today { box-shadow: inset 0 0 0 1.5px rgba(82, 121, 111, 0.5); }
  .sm-cal-day.is-selected { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #fff; }
  .sm-cal-day.is-selected.is-today { box-shadow: none; }
  .sm-cal-day:disabled { color: #d5dbd6; cursor: default; }
  .sm-cal-foot { display: flex; justify-content: flex-end; margin-top: 0.5rem; }
  .sm-cal-today {
    border: none; background: transparent; color: #52796f; font-family: 'DM Sans', sans-serif;
    font-size: 0.72rem; font-weight: 600; cursor: pointer; padding: 0.25rem 0.4rem; border-radius: 7px;
    -webkit-tap-highlight-color: transparent;
  }
  .sm-cal-today:active { background: #f1f4f0; }

  /* ── Employee picker (searchable, in-app) ── */
  .sm-picker-overlay {
    position: fixed; inset: 0; z-index: 75;
    background: rgba(47, 62, 70, 0.5);
    display: flex; align-items: flex-end; justify-content: center;
    -webkit-tap-highlight-color: transparent;
  }
  .sm-picker-sheet {
    width: 100%; max-width: 480px; max-height: 78vh; display: flex; flex-direction: column;
    background: #f7f8f6; border-radius: 20px 20px 0 0;
    padding: 0.4rem 1rem calc(env(safe-area-inset-bottom) + 0.8rem);
    box-shadow: 0 -18px 48px rgba(47, 62, 70, 0.28);
    animation: sm-fadeUp 0.24s cubic-bezier(0.22,1,0.36,1) both;
  }
  .sm-picker-head { display: flex; align-items: center; gap: 0.6rem; padding: 0.3rem 0 0.6rem; }
  .sm-picker-title { flex: 1; min-width: 0; font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; font-weight: 400; color: #2f3e46; margin: 0; }
  .sm-picker-search { position: relative; margin-bottom: 0.55rem; }
  .sm-picker-search svg { position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%); color: #84a98c; pointer-events: none; }
  .sm-picker-search input {
    width: 100%; box-sizing: border-box; padding: 0.6rem 0.75rem 0.6rem 2.2rem; border-radius: 12px;
    border: 1.5px solid #d4ddd6; background: #fff; font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46;
    -webkit-appearance: none; appearance: none; -webkit-tap-highlight-color: transparent;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .sm-picker-search input::placeholder { color: #a7b6ac; }
  .sm-picker-search input:focus { outline: none; border-color: #52796f; box-shadow: 0 0 0 3px rgba(82, 121, 111, 0.12); }
  .sm-picker-list { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; margin: 0 -0.25rem; padding: 0 0.25rem; }
  .sm-picker-item {
    display: flex; align-items: center; gap: 0.6rem; width: 100%; text-align: left;
    padding: 0.55rem 0.5rem; border-radius: 12px; border: none; background: transparent;
    font-family: 'DM Sans', sans-serif; cursor: pointer; -webkit-tap-highlight-color: transparent;
    transition: background 0.14s;
  }
  .sm-picker-item:active { background: #eef2ef; }
  .sm-picker-item.is-sel { background: rgba(82, 121, 111, 0.1); }
  .sm-picker-av { width: 34px; height: 34px; font-size: 0.72rem; }
  .sm-picker-item-text { flex: 1; min-width: 0; }
  .sm-picker-item-name { display: block; font-size: 0.86rem; font-weight: 600; color: #2f3e46; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sm-picker-item-sub { display: block; font-size: 0.7rem; color: #7a8e84; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
  .sm-picker-empty { padding: 1.4rem 0.5rem; text-align: center; font-size: 0.78rem; color: #9aa8a0; font-style: italic; }
  .sm-picker-all {
    flex-shrink: 0; padding: 0.25rem 0.4rem; border: none; border-radius: 7px; background: none;
    font-family: 'DM Sans', sans-serif; font-size: 0.74rem; font-weight: 600; color: #52796f;
    cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .sm-picker-all:active { background: #eef2ef; }
  .sm-picker-foot { padding-top: 0.6rem; }
  .sm-picker-foot .sm-btn { width: 100%; }
  .sm-check-box {
    flex-shrink: 0; width: 20px; height: 20px; border-radius: 6px;
    border: 1.5px solid #cfdad3; background: #fff; color: #fff;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.14s, border-color 0.14s;
  }
  .sm-check-box.is-on { background: #52796f; border-color: #52796f; }
  .sm-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; }
  .sm-chip {
    display: inline-flex; align-items: center; gap: 0.3rem; max-width: 100%;
    padding: 0.24rem 0.42rem 0.24rem 0.6rem; border-radius: 999px;
    border: 1px solid rgba(82, 121, 111, 0.25); background: rgba(82, 121, 111, 0.09);
    font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 600; color: #354f52;
    cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .sm-chip:disabled { opacity: 0.6; cursor: default; }
  .sm-chip-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sm-chip svg { flex-shrink: 0; color: #6b8a80; }
`;

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Monday as the start of the week.
function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - day);
  return d;
}

function shiftDate(shift) {
  const base = shift?.date || shift?.startDate || shift?.endDate;
  if (!base) return null;
  const d = new Date(base);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTime(t) {
  if (!t) return null;
  if (typeof t === 'string' && t.includes('T')) {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t));
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function shiftEmployee(shift) {
  if (shift?.employeeId && typeof shift.employeeId === 'object') {
    return {
      id: shift.employeeId._id || shift.employeeId.id,
      name: [shift.employeeId.firstName, shift.employeeId.lastName].filter(Boolean).join(' ').trim() || shift.employeeId.email,
    };
  }
  if (shift?.employee && typeof shift.employee === 'object') {
    return {
      id: shift.employee._id || shift.employee.id,
      name: [shift.employee.firstName, shift.employee.lastName].filter(Boolean).join(' ').trim() || shift.employee.email,
    };
  }
  return { id: typeof shift?.employeeId === 'string' ? shift.employeeId : null, name: shift?.employeeName || 'Unassigned' };
}

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  const a = parts[0]?.charAt(0) || '';
  const b = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (a + b).toUpperCase() || '?';
}

function statusClass(status) {
  switch (status) {
    case 'Completed': return 'sm-status-completed';
    case 'Cancelled':
    case 'Missed': return 'sm-status-danger';
    case 'Scheduled': return 'sm-status-scheduled';
    default: return 'sm-status-warn';
  }
}

function cardTone(status) {
  switch (status) {
    case 'Completed': return 'is-completed';
    case 'Cancelled':
    case 'Missed': return 'is-danger';
    case 'Scheduled': return '';
    default: return 'is-warn';
  }
}

function shiftStartMinutes(shift) {
  const t = formatTime(shift?.startTime);
  if (!t) return 9999;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 9999;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Mirror the web rota planner's assign-shift options (RotaShiftManagement.jsx).
const LOCATIONS = [
  { value: 'Office', label: 'Work From Office' },
  { value: 'Home', label: 'Work From Home' },
  { value: 'Field', label: 'Field' },
  { value: 'Client Site', label: 'Client Site' },
];
const WORK_TYPES = [
  { value: 'Regular', label: 'Regular' },
  { value: 'Overtime', label: 'Overtime' },
  { value: 'Weekend overtime', label: 'Weekend Overtime' },
  { value: 'Client side overtime', label: 'Client Side Overtime' },
];

// Weekends (Sat/Sun) are mandatory holidays on this backend and are excluded
// from shift assignment — same rule the web planner enforces.
function weekdaysInRange(startYMD, endYMD) {
  const dates = [];
  let cur = new Date(`${startYMD}T00:00:00`);
  const end = new Date(`${endYMD}T00:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || cur > end) return dates;
  for (let guard = 0; cur <= end && guard < 400; guard += 1) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) dates.push(toYMD(cur));
    cur = addDays(cur, 1);
  }
  return dates;
}

function makeGroupId() {
  if (typeof crypto !== 'undefined' && crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Runs workers over `items` with at most `limit` in flight. Assigning a range
// to a whole roster is employees × weekdays requests, so this keeps a
// select-all on a large org list from opening a connection per employee.
async function runPooled(items, limit, worker) {
  const results = [];
  let next = 0;
  async function drain() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, drain));
  return results;
}

// ── Custom date field (displays dd/mm/yyyy, opens an in-app calendar) ──
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const CAL_DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function formatDMY(ymd) {
  const m = YMD_RE.exec(ymd || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

// Grid of cells for a month, Monday-first, with leading blanks for alignment.
function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Mon=0 … Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayYMD = toYMD(new Date());
  const cells = [];
  for (let i = 0; i < startDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    const ymd = toYMD(date);
    cells.push({ day: d, ymd, isToday: ymd === todayYMD, isWeekend: dow === 0 || dow === 6 });
  }
  return cells;
}

function DateField({ id, value, min, disabled, alignRight, onChange }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = YMD_RE.test(value || '') ? new Date(`${value}T00:00:00`) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const grid = useMemo(() => buildMonthGrid(view.year, view.month), [view.year, view.month]);
  const minYMD = YMD_RE.test(min || '') ? min : null;

  function toggle() {
    if (disabled) return;
    if (!open && YMD_RE.test(value || '')) {
      const d = new Date(`${value}T00:00:00`);
      setView({ year: d.getFullYear(), month: d.getMonth() });
    }
    setOpen((o) => !o);
  }

  function step(delta) {
    setView((v) => {
      const m = v.month + delta;
      if (m < 0) return { year: v.year - 1, month: 11 };
      if (m > 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: m };
    });
  }

  function pick(ymd) {
    onChange(ymd);
    setOpen(false);
  }

  return (
    <div className="sm-date" ref={ref}>
      <button type="button" id={id} className="sm-input sm-date-trigger" onClick={toggle}
        disabled={disabled} aria-haspopup="dialog" aria-expanded={open}>
        <span className={value ? 'sm-date-val' : 'sm-date-ph'}>{value ? formatDMY(value) : 'dd/mm/yyyy'}</span>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
      {open && (
        <div className={`sm-cal${alignRight ? ' is-right' : ''}`} role="dialog" aria-label="Choose a date">
          <div className="sm-cal-head">
            <button type="button" className="sm-cal-nav" onClick={() => step(-1)} aria-label="Previous month">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="sm-cal-title">{MONTH_NAMES[view.month]} {view.year}</span>
            <button type="button" className="sm-cal-nav" onClick={() => step(1)} aria-label="Next month">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
          <div className="sm-cal-dow">
            {CAL_DOW.map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="sm-cal-grid">
            {grid.map((cell, i) => {
              if (!cell) return <span key={`e${i}`} className="sm-cal-empty" />;
              const dayDisabled = minYMD ? cell.ymd < minYMD : false;
              const cls = ['sm-cal-day'];
              if (value === cell.ymd) cls.push('is-selected');
              if (cell.isToday) cls.push('is-today');
              if (cell.isWeekend) cls.push('is-weekend');
              return (
                <button key={cell.ymd} type="button" className={cls.join(' ')}
                  onClick={() => pick(cell.ymd)} disabled={dayDisabled}>
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="sm-cal-foot">
            <button type="button" className="sm-cal-today" onClick={() => {
              const t = toYMD(new Date());
              if (!(minYMD && t < minYMD)) pick(t);
            }}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

function memberName(m) {
  return [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.email || 'Unnamed';
}

// Searchable, in-app employee picker. Replaces a native <select> so the roster
// (org-wide for admins) stays usable on mobile and matches the modal's custom
// date fields. Multi-select: a tap toggles a row and the sheet stays open, so
// one shift range can go to several people in a single pass. The sheet is
// portalled to <body> — the swipe-back stage transform clips position:fixed
// otherwise.
function EmployeePicker({ members, loading, error, values, onChange, disabled, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => members.filter((m) => values.includes(m._id)), [members, values]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      memberName(m).toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q));
  }, [members, query]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const label = loading ? 'Loading…'
    : error ? 'Team unavailable'
      : selected.length === 1 ? memberName(selected[0])
        : selected.length > 1 ? `${selected.length} employees selected`
          : placeholder;
  const triggerDisabled = disabled || loading || !!error || members.length === 0;

  // Select-all follows the search box: with a query active it acts on the
  // matches only, which is how a big org roster gets narrowed to a sub-team.
  const allFilteredSelected = filtered.length > 0 && filtered.every((m) => values.includes(m._id));

  function toggle(id) {
    onChange(values.includes(id) ? values.filter((x) => x !== id) : [...values, id]);
  }

  function toggleAllFiltered() {
    const ids = filtered.map((m) => m._id);
    if (allFilteredSelected) onChange(values.filter((x) => !ids.includes(x)));
    else onChange([...new Set([...values, ...ids])]);
  }

  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      <button type="button" id="asg-emp" className="sm-input sm-date-trigger"
        onClick={() => !triggerDisabled && setOpen(true)} disabled={triggerDisabled}
        aria-haspopup="dialog" aria-expanded={open}>
        <span className={selected.length ? 'sm-date-val' : 'sm-date-ph'}>{label}</span>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {/* One name already shows in the trigger; chips only earn their space
          once the selection is a list the manager can't otherwise see. */}
      {selected.length > 1 && (
        <div className="sm-chips">
          {selected.map((m) => (
            <button key={m._id} type="button" className="sm-chip" disabled={disabled}
              onClick={() => toggle(m._id)} aria-label={`Remove ${memberName(m)}`}>
              <span className="sm-chip-text">{memberName(m)}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          ))}
        </div>
      )}
      {open && createPortal(
        <div className="sm-picker-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="sm-picker-sheet" role="dialog" aria-modal="true" aria-label="Select employees">
            <div className="sm-modal-grab" />
            <div className="sm-picker-head">
              <h3 className="sm-picker-title">{placeholder}</h3>
              {filtered.length > 0 && (
                <button type="button" className="sm-picker-all" onClick={toggleAllFiltered}>
                  {allFilteredSelected ? 'Clear' : 'Select all'}
                </button>
              )}
              <button type="button" className="sm-close" onClick={close} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            {members.length > 6 && (
              <div className="sm-picker-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
                </svg>
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or email…" autoCapitalize="none" autoCorrect="off" autoFocus />
              </div>
            )}
            <div className="sm-picker-list">
              {filtered.length === 0 ? (
                <div className="sm-picker-empty">No matching employees.</div>
              ) : filtered.map((m) => {
                const on = values.includes(m._id);
                return (
                  <button key={m._id} type="button" aria-pressed={on}
                    className={`sm-picker-item${on ? ' is-sel' : ''}`}
                    onClick={() => toggle(m._id)}>
                    <span className="sm-avatar sm-picker-av">{initials(memberName(m))}</span>
                    <span className="sm-picker-item-text">
                      <span className="sm-picker-item-name">{memberName(m)}</span>
                      {m.email && <span className="sm-picker-item-sub">{m.email}</span>}
                    </span>
                    <span className={`sm-check-box${on ? ' is-on' : ''}`}>
                      {on && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="sm-picker-foot">
              <button type="button" className="sm-btn sm-btn-primary" onClick={close}>
                {values.length ? `Done · ${values.length} selected` : 'Done'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// Shared by /manager/shifts (team scope) and /admin/shifts (org scope). Scope
// only changes which roster the assign picker pulls: admins pick from the whole
// org, managers from their reporting tree.
export default function ManagerShiftManagement({ scope = 'team' }) {
  const isOrg = scope === 'org';
  const navigate = useNavigate();
  const [view, setView] = useState('week'); // 'week' | 'calendar'
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [flash, setFlash] = useState('');

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const todayYMD = toYMD(startOfWeek(new Date())) === toYMD(weekStart)
    ? toYMD(new Date())
    : null;

  async function fetchShifts(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/rota/shift-assignments/all', {
        params: { startDate: toYMD(weekStart), endDate: toYMD(weekEnd) },
      });
      const list = data?.data || (Array.isArray(data) ? data : []);
      setShifts(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(''), 3400);
    return () => clearTimeout(t);
  }, [flash]);

  // After a successful assignment, jump the view to the week the shift starts
  // in (so the manager sees it appear) and refresh. Changing weekStart refetches
  // via the effect above; if it's already the visible week, refetch explicitly.
  function handleAssigned(count, startYMD, { employeeCount = 1, failedNames = [] } = {}) {
    setAssignOpen(false);
    let msg = `${count} shift${count === 1 ? '' : 's'} assigned`;
    if (employeeCount > 1) msg += ` to ${employeeCount} employees`;
    // Name who missed out while the list is short enough to read — a conflict
    // or approved leave silently dropping someone is worth surfacing.
    if (failedNames.length) {
      msg += failedNames.length <= 2
        ? ` · skipped ${failedNames.join(', ')}`
        : ` · ${failedNames.length} skipped`;
    }
    setFlash(msg);
    const target = startOfWeek(new Date(`${startYMD}T00:00:00`));
    if (toYMD(target) === toYMD(weekStart)) fetchShifts(true);
    else setWeekStart(target);
  }

  const filteredShifts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shifts;
    return shifts.filter((s) => {
      const emp = shiftEmployee(s);
      const hay = [emp.name, s.location, s.shiftType, s.role, s.status].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [shifts, search]);

  const stats = useMemo(() => {
    const employees = new Set();
    let active = 0;
    for (const s of shifts) {
      const emp = shiftEmployee(s);
      if (emp.id || emp.name) employees.add(emp.id || emp.name);
      if (s.status !== 'Cancelled') active += 1;
    }
    return { shifts: active, employees: employees.size, total: shifts.length };
  }, [shifts]);

  // Build the 7 day buckets for the visible week.
  const days = useMemo(() => {
    const buckets = WEEKDAYS.map((_, i) => {
      const date = addDays(weekStart, i);
      return { date, ymd: toYMD(date), items: [] };
    });
    const byYmd = new Map(buckets.map((b) => [b.ymd, b]));
    for (const s of filteredShifts) {
      const d = shiftDate(s);
      if (!d) continue;
      const bucket = byYmd.get(toYMD(d));
      if (bucket) bucket.items.push(s);
    }
    for (const b of buckets) b.items.sort((a, c) => shiftStartMinutes(a) - shiftStartMinutes(c));
    return buckets;
  }, [filteredShifts, weekStart]);

  const rangeLabel = useMemo(() => {
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
    const startStr = weekStart.toLocaleDateString(undefined, { day: 'numeric', month: sameMonth ? undefined : 'short' });
    const endStr = weekEnd.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }, [weekStart, weekEnd]);

  const relLabel = useMemo(() => {
    const thisWeek = startOfWeek(new Date()).getTime();
    const diff = Math.round((weekStart.getTime() - thisWeek) / (7 * 24 * 60 * 60 * 1000));
    if (diff === 0) return 'This week';
    if (diff === 1) return 'Next week';
    if (diff === -1) return 'Last week';
    return diff > 0 ? `In ${diff} weeks` : `${Math.abs(diff)} weeks ago`;
  }, [weekStart]);

  const isThisWeek = relLabel === 'This week';
  const hasAnyShift = days.some((d) => d.items.length > 0);

  // Month-calendar view: team-wide feed for the visible range, and a clickable
  // day card that mirrors the week list.
  async function monthFetcher(startYMD, endYMD) {
    const { data } = await api.get('/rota/shift-assignments/all', {
      params: { startDate: startYMD, endDate: endYMD },
    });
    return data?.data || (Array.isArray(data) ? data : []);
  }

  function renderCalendarShift(s) {
    const emp = shiftEmployee(s);
    const start = formatTime(s.startTime);
    const end = formatTime(s.endTime);
    const status = s.status || 'Scheduled';
    const locRole = [s.location, s.shiftType || s.role].filter(Boolean).join(' · ');
    return (
      <button
        type="button"
        className={`sm-card ${cardTone(status)}`}
        onClick={() => emp.id && navigate(`/employees/${emp.id}`)}
      >
        <span className="sm-avatar">{initials(emp.name)}</span>
        <span className="sm-body">
          <span className="sm-name">{emp.name}</span>
          <span className="sm-meta">
            <span className="sm-time">{start && end ? `${start} – ${end}` : start || 'Time TBC'}</span>
            {locRole && <span className="sm-loc">· {locRole}</span>}
          </span>
        </span>
        <span className={`sm-status ${statusClass(status)}`}>
          <span className="sm-status-dot" />
          {status}
        </span>
      </button>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="sm-wrap">
        <header className="sm-header sm-anim">
          <div className="sm-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
            </svg>
          </div>
          <div className="sm-header-text">
            <p className="sm-header-eyebrow">Team Rota</p>
            <h1 className="sm-header-title">Shift Management</h1>
          </div>
          <div className="sm-header-actions">
            {!(view === 'week' && error) && (
              <button type="button" className="sm-header-assign" onClick={() => setAssignOpen(true)} aria-label="Assign a shift">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Assign shift
              </button>
            )}
            <button
              type="button"
              className={`sm-refresh${refreshing ? ' is-busy' : ''}`}
              onClick={() => fetchShifts(true)}
              disabled={loading || refreshing}
              aria-label="Refresh rota"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>
        </header>

        <div className="sm-viewtabs sm-anim">
          <button
            type="button"
            className={`sm-viewtab${view === 'week' ? ' is-active' : ''}`}
            onClick={() => setView('week')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Week
          </button>
          <button
            type="button"
            className={`sm-viewtab${view === 'calendar' ? ' is-active' : ''}`}
            onClick={() => setView('calendar')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Calendar
          </button>
        </div>

        {view === 'calendar' ? (
          <div className="sm-anim">
            <ShiftMonthCalendar
              fetcher={monthFetcher}
              renderShift={renderCalendarShift}
              emptyText="No one is scheduled on this day."
            />
          </div>
        ) : (
        <>
        <div className="sm-weeknav sm-anim">
          <button type="button" className="sm-weeknav-btn" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="Previous week">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="sm-weeknav-mid">
            <div className="sm-weeknav-range">{rangeLabel}</div>
            <div className="sm-weeknav-rel">{relLabel}</div>
          </div>
          <button type="button" className="sm-weeknav-btn" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="Next week">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>

        {!isThisWeek && (
          <button type="button" className="sm-today-btn sm-anim" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            ↩ Jump to this week
          </button>
        )}

        {!error && (
          <div className="sm-stats sm-anim">
            <div className="sm-stat">
              <div className="sm-stat-val">{loading ? '–' : stats.shifts}</div>
              <div className="sm-stat-lab">Shifts</div>
            </div>
            <div className="sm-stat">
              <div className="sm-stat-val">{loading ? '–' : stats.employees}</div>
              <div className="sm-stat-lab">Staff</div>
            </div>
            <div className="sm-stat">
              <div className="sm-stat-val">{loading ? '–' : stats.total}</div>
              <div className="sm-stat-lab">Total</div>
            </div>
          </div>
        )}

        {!loading && !error && shifts.length > 0 && (
          <div className="sm-search sm-anim">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee, location, role…"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
        )}

        {loading ? (
          <div>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="sm-skel" />)}
          </div>
        ) : error ? (
          <div className="sm-error sm-anim">
            <p className="sm-error-title">Couldn't load the rota</p>
            <p className="sm-error-sub">{error}</p>
            <button className="sm-retry" onClick={() => fetchShifts()}>Try again</button>
          </div>
        ) : !hasAnyShift ? (
          <div className="sm-empty-week sm-anim">
            <p className="sm-empty-week-title">{search ? 'No matching shifts' : 'No shifts this week'}</p>
            <p className="sm-empty-week-sub">
              {search ? 'Try a different search term.' : 'Nothing is scheduled for the team this week.'}
            </p>
          </div>
        ) : (
          days.map((day) => {
            const isToday = day.ymd === todayYMD;
            const weekdayIdx = (day.date.getDay() + 6) % 7;
            return (
              <div key={day.ymd} className="sm-day sm-anim">
                <div className="sm-day-head">
                  <span className={`sm-day-label${isToday ? ' is-today' : ''}`}>
                    {WEEKDAYS[weekdayIdx]}
                  </span>
                  {isToday && <span className="sm-day-pill">TODAY</span>}
                  <span className="sm-day-num">{day.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                  <span className="sm-day-line" />
                  {day.items.length > 0 && <span className="sm-day-num">{day.items.length}</span>}
                </div>
                {day.items.length === 0 ? (
                  <div className="sm-day-empty">No shifts scheduled</div>
                ) : (
                  day.items.map((s, i) => {
                    const emp = shiftEmployee(s);
                    const start = formatTime(s.startTime);
                    const end = formatTime(s.endTime);
                    const status = s.status || 'Scheduled';
                    const locRole = [s.location, s.shiftType || s.role].filter(Boolean).join(' · ');
                    return (
                      <button
                        key={s._id || `${day.ymd}-${i}`}
                        type="button"
                        className={`sm-card ${cardTone(status)}`}
                        onClick={() => emp.id && navigate(`/employees/${emp.id}`)}
                      >
                        <span className="sm-avatar">{initials(emp.name)}</span>
                        <span className="sm-body">
                          <span className="sm-name">{emp.name}</span>
                          <span className="sm-meta">
                            <span className="sm-time">{start && end ? `${start} – ${end}` : start || 'Time TBC'}</span>
                            {locRole && <span className="sm-loc">· {locRole}</span>}
                          </span>
                        </span>
                        <span className={`sm-status ${statusClass(status)}`}>
                          <span className="sm-status-dot" />
                          {status}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            );
          })
        )}
        </>
        )}
      </div>

      {flash && createPortal(
        <div className="sm-flash" role="status">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          {flash}
        </div>,
        document.body,
      )}

      {assignOpen && (
        <AssignShiftModal
          isOrg={isOrg}
          defaultDate={todayYMD || toYMD(weekStart)}
          onClose={() => setAssignOpen(false)}
          onAssigned={handleAssigned}
        />
      )}
    </>
  );
}

function AssignShiftModal({ isOrg, defaultDate, onClose, onAssigned }) {
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState(null);

  const [employeeIds, setEmployeeIds] = useState([]);
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [location, setLocation] = useState('Office');
  const [workType, setWorkType] = useState('Regular');
  const [breakDuration, setBreakDuration] = useState('60');
  const [shiftName, setShiftName] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMembersLoading(true);
      setMembersError(null);
      try {
        // Admin scope pulls the whole org; manager scope pulls their reporting
        // tree. Mirrors the roster switch used by Calendar / Objectives.
        const url = isOrg
          ? '/employees?includeAdmins=true'
          : '/manager/team/members?includeIndirect=true';
        const { data } = await api.get(url);
        const list = data?.data || data?.employees || (Array.isArray(data) ? data : []);
        if (!cancelled) setMembers(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!cancelled) setMembersError(getErrorMessage(err));
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOrg]);

  // Keep the end date on/after the start date as the manager changes it.
  function onStartDateChange(v) {
    setStartDate(v);
    if (v && endDate && endDate < v) setEndDate(v);
  }

  const dayCount = useMemo(() => weekdaysInRange(startDate, endDate).length, [startDate, endDate]);

  async function handleSubmit() {
    setError(null);
    if (employeeIds.length === 0) return setError('Please select at least one employee.');
    if (!startDate || !endDate) return setError('Please choose a date range.');
    if (endDate < startDate) return setError('The end date must be on or after the start date.');
    if (!startTime || !endTime) return setError('Please set a start and end time.');
    if (endTime <= startTime) return setError('The end time must be after the start time.');

    const dates = weekdaysInRange(startDate, endDate);
    if (dates.length === 0) return setError('No weekdays in that range — weekends are excluded from shifts.');

    setSaving(true);
    const brk = Number(breakDuration);
    const payloadBase = {
      shiftName: shiftName.trim(),
      startTime,
      endTime,
      location,
      workType,
      breakDuration: Number.isFinite(brk) && brk >= 0 ? brk : 0,
      notes: notes.trim(),
    };

    // /rota/assign-shift takes one employee for one date, so a multi-employee
    // range fans out here. Each employee gets their own groupId: the group is
    // the unit the rota deletes by, and a shared id would make removing one
    // person's range wipe everyone's.
    async function assignTo(id) {
      const groupId = makeGroupId();
      let ok = 0;
      let firstError = null;
      for (const date of dates) {
        try {
          const { data } = await api.post('/rota/assign-shift', {
            ...payloadBase,
            employeeId: id,
            date,
            groupId,
            startDate,
            endDate,
            sendEmail: false,
          });
          if (data?.success !== false) ok += 1;
        } catch (err) {
          if (!firstError) firstError = getErrorMessage(err);
        }
      }
      // One summary email per employee covering their whole range, rather than
      // one per day (mirrors the web planner).
      if (ok > 0) {
        try {
          await api.post('/rota/assign-shift/notify', {
            employeeId: id,
            shiftName: payloadBase.shiftName,
            startDate,
            endDate,
            startTime,
            endTime,
            location,
            count: ok,
          });
        } catch {
          // summary email is non-fatal — the shifts are already saved.
        }
      }
      return { id, ok, firstError };
    }

    const results = await runPooled(employeeIds, 4, assignTo);
    const assigned = results.reduce((sum, r) => sum + r.ok, 0);
    const failed = results.filter((r) => r.ok === 0);

    if (assigned > 0) {
      // Partial success still closes: the saved shifts are real, and
      // re-submitting to retry the rest would double-book everyone who worked.
      onAssigned(assigned, startDate, {
        employeeCount: results.length - failed.length,
        failedNames: failed.map((r) => memberName(members.find((m) => m._id === r.id) || {})),
      });
      return;
    }

    setSaving(false);
    setError(failed[0]?.firstError || 'Could not assign the shift. Please try again.');
  }

  return createPortal(
    <div className="sm-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="sm-modal" role="dialog" aria-modal="true" aria-label="Assign a shift">
        <div className="sm-modal-grab" />
        <div className="sm-modal-head">
          <div className="sm-modal-head-text">
            <h2 className="sm-modal-title">Assign a shift</h2>
            <p className="sm-modal-sub">
              {isOrg
                ? 'Schedule a shift for one or more employees.'
                : 'Schedule a shift for one or more of your team.'}
            </p>
          </div>
          <button type="button" className="sm-close" onClick={onClose} disabled={saving} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="sm-modal-error">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="sm-field">
          <label className="sm-field-label" htmlFor="asg-emp">Employees <span className="sm-field-req">*</span></label>
          <EmployeePicker
            members={members}
            loading={membersLoading}
            error={membersError}
            values={employeeIds}
            onChange={setEmployeeIds}
            disabled={saving}
            placeholder={isOrg ? 'Select employees…' : 'Select team members…'}
          />
          {membersError && <p className="sm-hint">{membersError}</p>}
          {!membersLoading && !membersError && members.length === 0 && (
            <p className="sm-hint">
              {isOrg ? 'No employees available to assign shifts to.' : 'You have no team members to assign shifts to.'}
            </p>
          )}
        </div>

        <div className="sm-field">
          <div className="sm-row">
            <div>
              <label className="sm-field-label" htmlFor="asg-start">Start date <span className="sm-field-req">*</span></label>
              <DateField id="asg-start" value={startDate}
                onChange={onStartDateChange} disabled={saving} />
            </div>
            <div>
              <label className="sm-field-label" htmlFor="asg-end">End date <span className="sm-field-req">*</span></label>
              <DateField id="asg-end" value={endDate} min={startDate} alignRight
                onChange={setEndDate} disabled={saving} />
            </div>
          </div>
          {startDate && endDate && (
            <p className="sm-hint">
              {dayCount === 0
                ? 'No weekdays selected — weekends (Sat/Sun) are excluded.'
                : `${dayCount} weekday${dayCount === 1 ? '' : 's'} · weekends excluded`}
            </p>
          )}
        </div>

        <div className="sm-field">
          <div className="sm-row">
            <div>
              <label className="sm-field-label" htmlFor="asg-stime">Start time <span className="sm-field-req">*</span></label>
              <input id="asg-stime" type="time" className="sm-input" value={startTime}
                onChange={(e) => setStartTime(e.target.value)} disabled={saving} />
            </div>
            <div>
              <label className="sm-field-label" htmlFor="asg-etime">End time <span className="sm-field-req">*</span></label>
              <input id="asg-etime" type="time" className="sm-input" value={endTime}
                onChange={(e) => setEndTime(e.target.value)} disabled={saving} />
            </div>
          </div>
        </div>

        <div className="sm-field">
          <div className="sm-row">
            <div>
              <label className="sm-field-label" htmlFor="asg-loc">Location</label>
              <select id="asg-loc" className="sm-select" value={location}
                onChange={(e) => setLocation(e.target.value)} disabled={saving}>
                {LOCATIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="sm-field-label" htmlFor="asg-wt">Work type</label>
              <select id="asg-wt" className="sm-select" value={workType}
                onChange={(e) => setWorkType(e.target.value)} disabled={saving}>
                {WORK_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="sm-field">
          <div className="sm-row">
            <div>
              <label className="sm-field-label" htmlFor="asg-brk">Break (min)</label>
              <input id="asg-brk" type="number" inputMode="numeric" min="0" className="sm-input"
                value={breakDuration} onChange={(e) => setBreakDuration(e.target.value)} disabled={saving} />
            </div>
            <div>
              <label className="sm-field-label" htmlFor="asg-name">Shift name</label>
              <input id="asg-name" type="text" className="sm-input" value={shiftName}
                placeholder="Optional" onChange={(e) => setShiftName(e.target.value)} disabled={saving} />
            </div>
          </div>
        </div>

        <div className="sm-field">
          <label className="sm-field-label" htmlFor="asg-notes">Notes</label>
          <textarea id="asg-notes" className="sm-textarea" rows="2" value={notes}
            placeholder="Optional note for this shift…" onChange={(e) => setNotes(e.target.value)} disabled={saving} />
        </div>

        <div className="sm-modal-actions">
          <button type="button" className="sm-btn sm-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="sm-btn sm-btn-primary" onClick={handleSubmit}
            disabled={saving || membersLoading || employeeIds.length === 0 || dayCount === 0}>
            {saving ? <span className="sm-mini-spin" /> : null}
            {saving ? 'Assigning…' : employeeIds.length > 1 ? `Assign to ${employeeIds.length}` : 'Assign shift'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
