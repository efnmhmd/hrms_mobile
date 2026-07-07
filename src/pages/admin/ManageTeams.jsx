import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Mobile twin of web ManageTeams.js — full CRUD over /teams:
//   GET    /teams                      → { data: [{ _id, name, initials, memberCount }] }
//   GET    /teams/:id                  → { data: { _id, name, initials, members:[...], createdAt } }
//   POST   /teams                      → { name, initials, members:[ids], color }
//   PUT    /teams/:id                  → { name }
//   DELETE /teams/:id
//   POST   /teams/:id/members/add      → { employeeId }
//   POST   /teams/:id/members/remove   → { employeeId }
//   GET    /employees                  → { data: [{ _id, firstName, lastName, jobTitle, department, email, team }] }
// Destructive actions use window.confirm (matching the mobile Objectives page).

const styles = `
  @keyframes mtm-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes mtm-skel { 0%,100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes mtm-spin { to { transform: rotate(360deg); } }
  @keyframes mtm-sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes mtm-fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .mtm-wrap { padding: 0.85rem 1rem 6rem; }
  .mtm-anim { animation: mtm-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header ── */
  .mtm-header {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.25rem 0.85rem;
  }
  .mtm-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18);
    flex-shrink: 0;
  }
  .mtm-header-text { min-width: 0; flex: 1; }
  .mtm-header-eyebrow {
    font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c; margin: 0;
  }
  .mtm-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
  }

  /* ── Primary / generic buttons ── */
  .mtm-btn {
    border: none; border-radius: 10px;
    font-size: 0.78rem; font-weight: 600; letter-spacing: 0.03em;
    padding: 0.55rem 0.85rem;
    display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;
    -webkit-tap-highlight-color: transparent; cursor: pointer;
    transition: transform 0.12s;
  }
  .mtm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .mtm-btn:not(:disabled):active { transform: scale(0.97); }
  .mtm-btn-primary {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; box-shadow: 0 3px 10px rgba(53,79,82,0.22);
  }
  .mtm-btn-ghost {
    background: #fff; color: #52796f; border: 1.5px solid #d4ddd6;
  }
  .mtm-btn-danger {
    background: #fff; color: #b85c50; border: 1.5px solid rgba(192,117,106,0.4);
  }
  .mtm-btn-soft {
    background: rgba(82,121,111,0.10); color: #2f4a32;
    border: 1px solid rgba(82,121,111,0.22);
  }
  .mtm-btn-block { width: 100%; }

  .mtm-header-btn {
    flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.35rem;
    height: 34px; padding: 0 0.8rem; border-radius: 10px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5;
    font-family: 'DM Sans', sans-serif; font-size: 0.76rem; font-weight: 600;
    box-shadow: 0 4px 12px rgba(53,79,82,0.2); cursor: pointer;
    -webkit-tap-highlight-color: transparent; transition: transform 0.12s;
  }
  .mtm-header-btn:active { transform: scale(0.95); }
  .mtm-header-btn svg { flex-shrink: 0; }

  /* ── Search ── */
  .mtm-search { position: relative; margin-bottom: 0.85rem; }
  .mtm-search svg {
    position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%);
    color: #84a98c; pointer-events: none;
  }
  .mtm-search input {
    width: 100%;
    padding: 0.6rem 0.75rem 0.6rem 2.2rem;
    border-radius: 12px; border: 1px solid rgba(212, 221, 214, 0.9);
    background: #fff; font-size: 0.84rem; color: #2f3e46;
    -webkit-tap-highlight-color: transparent;
  }
  .mtm-search input::placeholder { color: #a7b6ac; }
  .mtm-search input:focus {
    outline: none; border-color: #84a98c;
    box-shadow: 0 0 0 3px rgba(132, 169, 140, 0.18);
  }

  /* ── Team card ── */
  .mtm-card {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.75rem 0.8rem;
    border-radius: 16px; background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.55rem;
  }
  .mtm-team-avatar {
    width: 46px; height: 46px; border-radius: 50%;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    color: #cad2c5; font-size: 0.9rem; font-weight: 700; letter-spacing: 0.02em;
    background: linear-gradient(135deg, #354f52 0%, #52796f 60%, #84a98c 100%);
    box-shadow: 0 2px 8px rgba(53,79,82,0.18);
  }
  .mtm-team-body { min-width: 0; flex: 1; }
  .mtm-team-name {
    font-size: 0.92rem; font-weight: 600; color: #2f3e46; line-height: 1.25;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .mtm-team-meta {
    margin-top: 1px; font-size: 0.72rem; color: #7a8e84;
  }
  .mtm-card-actions { display: flex; gap: 0.3rem; flex-shrink: 0; }
  .mtm-icon-btn {
    width: 34px; height: 34px; border-radius: 9px; border: none;
    background: #f1f4f0; display: flex; align-items: center; justify-content: center;
    -webkit-tap-highlight-color: transparent; cursor: pointer;
    transition: transform 0.12s;
  }
  .mtm-icon-btn:active { transform: scale(0.92); }
  .mtm-icon-btn.is-edit { color: #52796f; }
  .mtm-icon-btn.is-delete { color: #b85c50; background: rgba(192,117,106,0.10); }

  /* ── States ── */
  .mtm-skel {
    height: 64px; border-radius: 16px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: mtm-skel 1.2s ease-in-out infinite;
    margin-bottom: 0.55rem;
  }
  .mtm-empty, .mtm-error {
    padding: 2rem 1rem; border-radius: 16px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center; color: #52796f;
  }
  .mtm-error {
    border-color: rgba(192, 117, 106, 0.4); color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .mtm-empty-title, .mtm-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .mtm-empty-sub, .mtm-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .mtm-retry {
    margin-top: 0.85rem;
    padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.78rem; font-weight: 600; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .mtm-banner {
    position: fixed; left: 1rem; right: 1rem; bottom: calc(72px + env(safe-area-inset-bottom, 0px));
    z-index: 60;
    padding: 0.7rem 0.95rem; border-radius: 12px;
    font-size: 0.8rem; font-weight: 500;
    box-shadow: 0 8px 24px rgba(47,62,70,0.18);
    animation: mtm-fadeUp 0.3s ease both;
  }
  .mtm-banner.is-success { background: #2f3e46; color: #eaf2ec; border-left: 3px solid #84a98c; }
  .mtm-banner.is-error { background: #7a3028; color: #fdecea; border-left: 3px solid #c0756a; }

  /* ── Bottom sheet ── */
  .mtm-overlay {
    position: fixed; inset: 0; z-index: 50;
    background: rgba(47,62,70,0.55); backdrop-filter: blur(3px);
    display: flex; align-items: flex-end; justify-content: center;
    animation: mtm-fadeIn 0.2s ease;
  }
  .mtm-sheet {
    background: #f7f8f6;
    width: 100%; max-width: 640px;
    border-radius: 20px 20px 0 0;
    max-height: 92vh;
    display: flex; flex-direction: column;
    animation: mtm-sheetUp 0.28s cubic-bezier(0.22,1,0.36,1);
    overflow: hidden;
  }
  .mtm-sheet-head {
    flex-shrink: 0;
    padding: 0.85rem 1rem 0.75rem;
    background: linear-gradient(135deg, #2f3e46 0%, #354f52 70%, #52796f 100%);
    color: #cad2c5;
    display: flex; align-items: flex-start; gap: 0.75rem;
  }
  .mtm-sheet-head.is-light {
    background: #fff; color: #2f3e46;
    border-bottom: 1px solid #eaefeb;
  }
  .mtm-sheet-avatar {
    width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    color: #cad2c5; font-size: 1rem; font-weight: 700;
    background: linear-gradient(135deg, #354f52 0%, #52796f 60%, #84a98c 100%);
    border: 2px solid #fff; box-shadow: 0 3px 10px rgba(53,79,82,0.18);
  }
  .mtm-sheet-head-text { flex: 1; min-width: 0; }
  .mtm-sheet-eyebrow {
    font-size: 0.58rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c; margin: 0;
  }
  .mtm-sheet-title {
    font-family: 'Cormorant Garamond', serif; font-weight: 400;
    font-size: 1.3rem; line-height: 1.15; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .mtm-sheet-sub { font-size: 0.72rem; margin: 0.15rem 0 0; opacity: 0.85; line-height: 1.4; }
  .mtm-sheet-close {
    flex-shrink: 0; width: 32px; height: 32px; border-radius: 8px;
    background: rgba(255,255,255,0.12); border: 1px solid rgba(202,210,197,0.2);
    color: inherit; display: flex; align-items: center; justify-content: center;
    -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .mtm-sheet-head.is-light .mtm-sheet-close { background: #f0f5f2; border-color: #eaefeb; color: #52796f; }
  .mtm-sheet-body {
    flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch;
    padding: 1rem;
  }
  .mtm-sheet-footer {
    flex-shrink: 0;
    padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid #eaefeb; background: #fff;
    display: flex; gap: 0.5rem;
  }
  .mtm-sheet-footer .mtm-btn { flex: 1; }

  /* ── Form field ── */
  .mtm-label {
    display: block;
    font-size: 0.62rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
    color: #52796f; margin-bottom: 0.4rem;
  }
  .mtm-input {
    width: 100%;
    padding: 0.65rem 0.85rem;
    border: 1.5px solid #d4ddd6; border-radius: 10px;
    font-size: 16px; color: #2f3e46; background: #fff; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .mtm-input:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }
  .mtm-input::placeholder { color: #b6c0b9; }

  /* ── Assign groups ── */
  .mtm-group { margin-bottom: 0.85rem; }
  .mtm-group-head {
    display: flex; align-items: center; gap: 0.55rem;
    padding: 0.55rem 0.65rem;
    background: #fff; border: 1px solid #eaefeb; border-left: 3px solid #52796f;
    border-radius: 10px; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .mtm-group-chevron {
    width: 18px; height: 18px; flex-shrink: 0;
    color: #354f52; transition: transform 0.2s;
  }
  .mtm-group-chevron.is-open { transform: rotate(180deg); }
  .mtm-group-name { flex: 1; font-size: 0.82rem; font-weight: 600; color: #2f3e46; }
  .mtm-group-pill {
    flex-shrink: 0; min-width: 22px; text-align: center;
    padding: 0.15rem 0.5rem; border-radius: 999px;
    font-size: 0.64rem; font-weight: 700;
    background: linear-gradient(135deg, #354f52, #52796f); color: #cad2c5;
  }
  .mtm-group-pill.is-zero { background: #f0f2ef; color: #8fa99a; border: 1px solid #eaefeb; }
  .mtm-group-list { margin-top: 0.55rem; display: flex; flex-direction: column; gap: 0.45rem; }

  /* ── Employee select card ── */
  .mtm-emp {
    position: relative; width: 100%; text-align: left;
    padding: 0.65rem 0.75rem;
    border: 1.5px solid #eaefeb; border-radius: 11px; background: #fff;
    -webkit-tap-highlight-color: transparent; cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .mtm-emp:active:not(:disabled) { background: #fafbfa; }
  .mtm-emp.is-selected {
    border-color: #52796f; background: rgba(132,169,140,0.10);
    box-shadow: 0 0 0 2px rgba(82,121,111,0.14);
  }
  .mtm-emp:disabled, .mtm-emp.is-locked { opacity: 0.65; cursor: not-allowed; }
  .mtm-emp-name {
    font-size: 0.84rem; font-weight: 600; color: #2f3e46; margin: 0; line-height: 1.25;
    padding-right: 1.6rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .mtm-emp-detail {
    font-size: 0.72rem; color: #7a8e84; margin: 0.12rem 0 0; line-height: 1.3;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .mtm-emp-status {
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
    margin: 0.35rem 0 0; display: inline-flex; align-items: center; gap: 0.3rem;
  }
  .mtm-emp-status.is-available { color: #52796f; }
  .mtm-emp-status.is-other { color: #b89758; }
  .mtm-emp-status.is-current { color: #354f52; }
  .mtm-emp-status::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
  .mtm-emp-check {
    position: absolute; top: 8px; right: 8px;
    width: 22px; height: 22px; border-radius: 50%;
    background: linear-gradient(135deg, #354f52, #52796f); color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 6px rgba(53,79,82,0.25);
  }

  /* ── Section heading (add-member) ── */
  .mtm-section + .mtm-section { margin-top: 1.1rem; }
  .mtm-section-head {
    display: flex; align-items: center; gap: 0.5rem;
    margin-bottom: 0.6rem; padding-bottom: 0.45rem; border-bottom: 1px solid #eaefeb;
  }
  .mtm-section-title { font-size: 0.82rem; font-weight: 700; color: #2f3e46; margin: 0; }
  .mtm-section-count {
    margin-left: auto; font-size: 0.62rem; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase; color: #84a98c;
  }
  .mtm-add-empty {
    font-size: 0.74rem; color: #8fa99a; font-style: italic; text-align: center;
    padding: 0.85rem; background: #fff; border: 1px dashed #d4ddd6; border-radius: 9px;
  }

  /* ── Members list (edit) ── */
  .mtm-member-row {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.6rem 0.7rem; background: #fff;
    border: 1px solid #eaefeb; border-radius: 11px; margin-bottom: 0.45rem;
  }
  .mtm-member-info { flex: 1; min-width: 0; }
  .mtm-member-name {
    font-size: 0.82rem; font-weight: 600; color: #2f3e46; line-height: 1.25;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .mtm-member-detail {
    font-size: 0.7rem; color: #7a8e84; margin-top: 1px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .mtm-member-actions { display: flex; gap: 0.3rem; flex-shrink: 0; }
  .mtm-chip-btn {
    border-radius: 8px; border: 1px solid #d4ddd6; background: #fff;
    color: #52796f; font-size: 0.66rem; font-weight: 600;
    padding: 0.35rem 0.6rem; -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .mtm-chip-btn.is-danger { color: #b85c50; border-color: rgba(192,117,106,0.4); background: rgba(192,117,106,0.06); }

  .mtm-inline-loading {
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    padding: 1.75rem 1rem; color: #7a8e84; font-size: 0.78rem;
  }
  .mtm-spin {
    width: 18px; height: 18px;
    border: 2.5px solid rgba(82,121,111,0.2); border-top-color: #52796f;
    border-radius: 50%; animation: mtm-spin 0.8s linear infinite;
  }
  .mtm-mini-spin {
    width: 13px; height: 13px;
    border: 2px solid currentColor; border-top-color: transparent;
    border-radius: 50%; animation: mtm-spin 0.7s linear infinite;
  }
  .mtm-select {
    width: 100%; padding: 0.65rem 0.85rem;
    border: 1.5px solid #d4ddd6; border-radius: 10px;
    font-size: 16px; color: #2f3e46; background: #fff; outline: none;
  }
  .mtm-select:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }
`;

function computeInitials(name) {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  return words.length > 1
    ? words.map((w) => w[0]).join('').toUpperCase()
    : trimmed.substring(0, 2).toUpperCase();
}

function Chevron({ open }) {
  return (
    <svg className={`mtm-group-chevron ${open ? 'is-open' : ''}`} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function AdminManageTeams() {
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [banner, setBanner] = useState(null);

  // Create flow
  const [createStep, setCreateStep] = useState(0); // 0 = closed, 1 = name, 2 = assign
  const [newName, setNewName] = useState('');
  const [selectedNew, setSelectedNew] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [creating, setCreating] = useState(false);

  // Edit flow
  const [editOpen, setEditOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editName, setEditName] = useState('');
  const [editMembers, setEditMembers] = useState([]);
  const [editLoading, setEditLoading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Add-member flow
  const [addOpen, setAddOpen] = useState(false);
  const [addCandidates, setAddCandidates] = useState([]);
  const [selectedAdd, setSelectedAdd] = useState([]);
  const [adding, setAdding] = useState(false);

  // Switch flow
  const [switchMember, setSwitchMember] = useState(null);
  const [switchTarget, setSwitchTarget] = useState('');
  const [switching, setSwitching] = useState(false);

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 2800);
  }

  async function loadAll(initial = false) {
    if (initial) setLoading(true);
    setError(null);
    try {
      const [teamsRes, empRes] = await Promise.all([
        api.get('/teams'),
        api.get('/employees'),
      ]);
      const teamList = (teamsRes?.data?.data || []).map((t) => ({
        id: t._id, name: t.name, initials: t.initials, memberCount: t.memberCount,
      }));
      const empList = (empRes?.data?.data || []).map((e) => ({
        id: e._id,
        firstName: e.firstName,
        lastName: e.lastName,
        jobTitle: e.jobTitle,
        department: e.department,
        email: e.email,
        currentTeam: e.team || null,
      }));
      setTeams(teamList);
      setEmployees(empList);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll(true);
  }, []);

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, search]);

  // ── Create ───────────────────────────────────────────────
  function openCreate() {
    setNewName('');
    setSelectedNew([]);
    setCreateStep(1);
  }
  function closeCreate() {
    setCreateStep(0);
    setNewName('');
    setSelectedNew([]);
  }
  function goToAssign() {
    if (!newName.trim()) return;
    const groups = {};
    teams.forEach((t) => { groups[t.name] = true; });
    groups['No group'] = true;
    setExpanded(groups);
    setCreateStep(2);
  }
  function toggleSelectNew(id) {
    setSelectedNew((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleGroup(name) {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  }
  async function createTeam() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await api.post('/teams', {
        name,
        initials: computeInitials(name),
        members: selectedNew,
        color: '#3B82F6',
      });
      await loadAll();
      closeCreate();
      flash('success', 'Team created');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────
  async function deleteTeam(team, afterDelete) {
    if (!window.confirm(`Delete "${team.name}" and unassign its members? This can't be undone.`)) return;
    try {
      await api.delete(`/teams/${team.id}`);
      await loadAll();
      flash('success', 'Team deleted');
      afterDelete?.();
    } catch (err) {
      flash('error', getErrorMessage(err));
    }
  }

  // ── Edit ─────────────────────────────────────────────────
  async function loadEditingTeam(teamId) {
    setEditLoading(true);
    try {
      const { data } = await api.get(`/teams/${teamId}`);
      const t = data?.data;
      if (t) {
        setEditingTeam({
          id: t._id, name: t.name, initials: t.initials,
          memberCount: t.members?.length || 0, createdAt: t.createdAt,
        });
        setEditName(t.name || '');
        setEditMembers(t.members || []);
      }
    } catch (err) {
      flash('error', getErrorMessage(err));
      setEditOpen(false);
    } finally {
      setEditLoading(false);
    }
  }
  async function openEdit(team) {
    setEditOpen(true);
    setEditingTeam(team);
    setEditName(team.name);
    setEditMembers([]);
    await loadEditingTeam(team.id);
  }
  function closeEdit() {
    setEditOpen(false);
    setEditingTeam(null);
    setEditMembers([]);
    setEditName('');
  }
  async function saveEdit() {
    if (!editingTeam?.id) return;
    if (!editName.trim()) { flash('error', 'Team name cannot be empty'); return; }
    setSavingEdit(true);
    try {
      await api.put(`/teams/${editingTeam.id}`, { name: editName.trim() });
      await loadAll();
      await loadEditingTeam(editingTeam.id);
      flash('success', 'Team updated');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  }
  async function removeMember(memberId) {
    if (!editingTeam?.id) return;
    if (!window.confirm('Remove this employee from the team?')) return;
    try {
      await api.post(`/teams/${editingTeam.id}/members/remove`, { employeeId: memberId });
      await loadAll();
      await loadEditingTeam(editingTeam.id);
      flash('success', 'Member removed');
    } catch (err) {
      flash('error', getErrorMessage(err));
    }
  }

  // ── Switch ───────────────────────────────────────────────
  function openSwitch(member) {
    const others = teams.filter((t) => t.id !== editingTeam?.id);
    if (others.length === 0) { flash('error', 'No other team to switch to'); return; }
    setSwitchMember(member);
    setSwitchTarget(others[0].id);
  }
  async function confirmSwitch() {
    if (!switchMember || !switchTarget || !editingTeam?.id) return;
    const target = teams.find((t) => t.id === switchTarget);
    if (!target) { flash('error', 'Target team not found'); return; }
    setSwitching(true);
    try {
      await api.post(`/teams/${editingTeam.id}/members/remove`, { employeeId: switchMember._id });
      await api.post(`/teams/${target.id}/members/add`, { employeeId: switchMember._id });
      await loadAll();
      await loadEditingTeam(editingTeam.id);
      flash('success', `Moved to ${target.name}`);
      setSwitchMember(null);
      setSwitchTarget('');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setSwitching(false);
    }
  }

  // ── Add members ──────────────────────────────────────────
  async function openAddMember() {
    if (!editingTeam) return;
    setSelectedAdd([]);
    setAddOpen(true);
    try {
      const { data } = await api.get('/employees');
      const list = (data?.data || []).map((emp) => {
        const inOther = emp.team && emp.team !== editingTeam.name;
        const inCurrent = emp.team === editingTeam.name;
        const available = !emp.team;
        return {
          id: emp._id,
          firstName: emp.firstName, lastName: emp.lastName,
          email: emp.email, department: emp.department, jobTitle: emp.jobTitle,
          currentTeam: emp.team || null,
          status: available ? 'available' : (inCurrent ? 'current' : 'other'),
        };
      });
      setAddCandidates(list);
    } catch (err) {
      flash('error', getErrorMessage(err));
      setAddOpen(false);
    }
  }
  function toggleSelectAdd(id) {
    setSelectedAdd((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  async function addMembers() {
    if (selectedAdd.length === 0 || !editingTeam?.id) return;
    setAdding(true);
    try {
      await Promise.all(selectedAdd.map((employeeId) =>
        api.post(`/teams/${editingTeam.id}/members/add`, { employeeId })));
      await loadAll();
      await loadEditingTeam(editingTeam.id);
      setAddOpen(false);
      flash('success', `Added ${selectedAdd.length} member${selectedAdd.length === 1 ? '' : 's'}`);
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  const availableCount = addCandidates.filter((e) => e.status === 'available').length;
  const otherCount = addCandidates.filter((e) => e.status === 'other').length;
  const currentCount = addCandidates.filter((e) => e.status === 'current').length;

  return (
    <>
      <style>{styles}</style>
      <div className="mtm-wrap">
        <header className="mtm-header mtm-anim">
          <div className="mtm-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-3-3.87M9 21v-2a4 4 0 0 1 3-3.87M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21v-1a3 3 0 0 1 3-3M19 21v-1a3 3 0 0 0-3-3" />
            </svg>
          </div>
          <div className="mtm-header-text">
            <p className="mtm-header-eyebrow">Organization</p>
            <h1 className="mtm-header-title">Manage Teams</h1>
          </div>
          <button type="button" className="mtm-header-btn" onClick={openCreate} aria-label="New team">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New team
          </button>
        </header>

        {!loading && !error && teams.length > 0 && (
          <div className="mtm-search mtm-anim">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams…"
            />
          </div>
        )}

        {loading ? (
          <div>
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="mtm-skel" />)}
          </div>
        ) : error ? (
          <div className="mtm-error mtm-anim">
            <p className="mtm-error-title">Couldn't load teams</p>
            <p className="mtm-error-sub">{error}</p>
            <button className="mtm-retry" onClick={() => loadAll(true)}>Try again</button>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="mtm-empty mtm-anim">
            <p className="mtm-empty-title">{teams.length === 0 ? 'No teams yet' : 'No matches'}</p>
            <p className="mtm-empty-sub">
              {teams.length === 0 ? 'Tap + to create your first team.' : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          filteredTeams.map((team) => (
            <div key={team.id} className="mtm-card mtm-anim">
              <div className="mtm-team-avatar">{team.initials || computeInitials(team.name)}</div>
              <div className="mtm-team-body">
                <div className="mtm-team-name">{team.name}</div>
                <div className="mtm-team-meta">
                  {team.memberCount} member{team.memberCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className="mtm-card-actions">
                <button type="button" className="mtm-icon-btn is-edit" onClick={() => openEdit(team)} aria-label="Edit team">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
                  </svg>
                </button>
                <button type="button" className="mtm-icon-btn is-delete" onClick={() => deleteTeam(team)} aria-label="Delete team">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {banner && (
        <div className={`mtm-banner is-${banner.kind}`}>{banner.text}</div>
      )}

      {/* ── Create · Step 1 (name) ── */}
      {createStep === 1 && createPortal(
        <div className="mtm-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeCreate(); }}>
          <div className="mtm-sheet">
            <div className="mtm-sheet-head">
              <div className="mtm-sheet-head-text">
                <p className="mtm-sheet-eyebrow">Step 1 of 2</p>
                <h2 className="mtm-sheet-title">New team</h2>
              </div>
              <button type="button" className="mtm-sheet-close" onClick={closeCreate} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className="mtm-sheet-body">
              <label className="mtm-label">Team name</label>
              <input
                className="mtm-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Marketing, Engineering…"
                autoFocus
              />
            </div>
            <div className="mtm-sheet-footer">
              <button type="button" className="mtm-btn mtm-btn-ghost" onClick={closeCreate}>Cancel</button>
              <button type="button" className="mtm-btn mtm-btn-primary" disabled={!newName.trim()} onClick={goToAssign}>
                Choose members
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Create · Step 2 (assign) ── */}
      {createStep === 2 && createPortal(
        <div className="mtm-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeCreate(); }}>
          <div className="mtm-sheet">
            <div className="mtm-sheet-head">
              <div className="mtm-sheet-head-text">
                <p className="mtm-sheet-eyebrow">Step 2 of 2</p>
                <h2 className="mtm-sheet-title">Assign to “{newName}”</h2>
                <p className="mtm-sheet-sub">Only unassigned employees can be selected.</p>
              </div>
              <button type="button" className="mtm-sheet-close" onClick={closeCreate} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className="mtm-sheet-body">
              {employees.length === 0 ? (
                <div className="mtm-add-empty">No employees found.</div>
              ) : (
                <>
                  {teams.map((team) => {
                    const inTeam = employees.filter((e) => e.currentTeam === team.name);
                    if (inTeam.length === 0) return null;
                    const sel = inTeam.filter((e) => selectedNew.includes(e.id)).length;
                    return (
                      <div key={team.name} className="mtm-group">
                        <div className="mtm-group-head" onClick={() => toggleGroup(team.name)}>
                          <Chevron open={!!expanded[team.name]} />
                          <span className="mtm-group-name">{team.name}</span>
                          <span className={`mtm-group-pill ${sel === 0 ? 'is-zero' : ''}`}>{sel}</span>
                        </div>
                        {expanded[team.name] && (
                          <div className="mtm-group-list">
                            {inTeam.map((emp) => (
                              <EmployeePick key={emp.id} emp={emp} locked selectable={false} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(() => {
                    const noGroup = teams.length === 0 ? employees : employees.filter((e) => !e.currentTeam);
                    if (noGroup.length === 0) return null;
                    const sel = noGroup.filter((e) => selectedNew.includes(e.id)).length;
                    return (
                      <div className="mtm-group">
                        <div className="mtm-group-head" onClick={() => toggleGroup('No group')}>
                          <Chevron open={!!expanded['No group']} />
                          <span className="mtm-group-name">No group</span>
                          <span className={`mtm-group-pill ${sel === 0 ? 'is-zero' : ''}`}>{sel}</span>
                        </div>
                        {expanded['No group'] && (
                          <div className="mtm-group-list">
                            {noGroup.map((emp) => (
                              <EmployeePick
                                key={emp.id}
                                emp={emp}
                                selectable
                                selected={selectedNew.includes(emp.id)}
                                onToggle={() => toggleSelectNew(emp.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
            <div className="mtm-sheet-footer">
              <button type="button" className="mtm-btn mtm-btn-ghost" onClick={() => setCreateStep(1)}>Back</button>
              <button type="button" className="mtm-btn mtm-btn-primary" disabled={creating} onClick={createTeam}>
                {creating ? <span className="mtm-mini-spin" /> : null}
                Create ({selectedNew.length})
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Edit ── */}
      {editOpen && createPortal(
        <div className="mtm-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeEdit(); }}>
          <div className="mtm-sheet">
            <div className="mtm-sheet-head is-light">
              <div className="mtm-sheet-avatar">
                {editingTeam?.initials || computeInitials(editingTeam?.name || 'TM')}
              </div>
              <div className="mtm-sheet-head-text">
                <p className="mtm-sheet-eyebrow" style={{ color: '#84a98c' }}>Editing team</p>
                <h2 className="mtm-sheet-title">{editingTeam?.name || 'Team'}</h2>
                <p className="mtm-sheet-sub" style={{ color: '#52796f' }}>
                  {editingTeam?.memberCount || 0} member{(editingTeam?.memberCount || 0) === 1 ? '' : 's'}
                </p>
              </div>
              <button type="button" className="mtm-sheet-close" onClick={closeEdit} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className="mtm-sheet-body">
              <label className="mtm-label">Team name</label>
              <input
                className="mtm-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Team name"
              />

              <div style={{ marginTop: '1.1rem' }}>
                <p className="mtm-section-title" style={{ marginBottom: '0.55rem' }}>Members</p>
                {editLoading ? (
                  <div className="mtm-inline-loading"><span className="mtm-spin" />Loading members…</div>
                ) : editMembers.length === 0 ? (
                  <div className="mtm-add-empty">No members in this team yet.</div>
                ) : (
                  editMembers.map((m) => (
                    <div key={m._id} className="mtm-member-row">
                      <div className="mtm-member-info">
                        <div className="mtm-member-name">{m.firstName} {m.lastName}</div>
                        <div className="mtm-member-detail">{m.jobTitle || m.department || m.email || '—'}</div>
                      </div>
                      <div className="mtm-member-actions">
                        <button type="button" className="mtm-chip-btn" onClick={() => openSwitch(m)}>Switch</button>
                        <button type="button" className="mtm-chip-btn is-danger" onClick={() => removeMember(m._id)}>Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                className="mtm-btn mtm-btn-soft mtm-btn-block"
                style={{ marginTop: '0.85rem' }}
                onClick={openAddMember}
                disabled={editLoading}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add member
              </button>
              <button
                type="button"
                className="mtm-btn mtm-btn-danger mtm-btn-block"
                style={{ marginTop: '0.5rem' }}
                onClick={() => deleteTeam({ id: editingTeam.id, name: editingTeam.name }, closeEdit)}
              >
                Delete team
              </button>
            </div>
            <div className="mtm-sheet-footer">
              <button type="button" className="mtm-btn mtm-btn-ghost" onClick={closeEdit}>Cancel</button>
              <button type="button" className="mtm-btn mtm-btn-primary" disabled={savingEdit || editLoading} onClick={saveEdit}>
                {savingEdit ? <span className="mtm-mini-spin" /> : null}
                Save changes
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Add member ── */}
      {addOpen && createPortal(
        <div className="mtm-overlay" onClick={(e) => { if (e.target === e.currentTarget) setAddOpen(false); }}>
          <div className="mtm-sheet">
            <div className="mtm-sheet-head is-light">
              <div className="mtm-sheet-head-text">
                <p className="mtm-sheet-eyebrow" style={{ color: '#84a98c' }}>Add members</p>
                <h2 className="mtm-sheet-title">Add to {editingTeam?.name || 'Team'}</h2>
              </div>
              <button type="button" className="mtm-sheet-close" onClick={() => setAddOpen(false)} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className="mtm-sheet-body">
              {addCandidates.length === 0 ? (
                <div className="mtm-inline-loading"><span className="mtm-spin" />Loading employees…</div>
              ) : (
                <>
                  <div className="mtm-section">
                    <div className="mtm-section-head">
                      <h3 className="mtm-section-title">Available</h3>
                      <span className="mtm-section-count">{availableCount} free</span>
                    </div>
                    {availableCount === 0 ? (
                      <div className="mtm-add-empty">No employees available to add.</div>
                    ) : (
                      <div className="mtm-group-list">
                        {addCandidates.filter((e) => e.status === 'available').map((emp) => (
                          <EmployeePick
                            key={emp.id}
                            emp={emp}
                            selectable
                            showEmail
                            statusLabel="Available"
                            statusKind="available"
                            selected={selectedAdd.includes(emp.id)}
                            onToggle={() => toggleSelectAdd(emp.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {otherCount > 0 && (
                    <div className="mtm-section">
                      <div className="mtm-section-head">
                        <h3 className="mtm-section-title">In other teams</h3>
                        <span className="mtm-section-count">{otherCount} locked</span>
                      </div>
                      <div className="mtm-group-list">
                        {addCandidates.filter((e) => e.status === 'other').map((emp) => (
                          <EmployeePick
                            key={emp.id} emp={emp} locked showEmail
                            statusLabel={`In ${emp.currentTeam}`} statusKind="other"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {currentCount > 0 && (
                    <div className="mtm-section">
                      <div className="mtm-section-head">
                        <h3 className="mtm-section-title">Already in team</h3>
                        <span className="mtm-section-count">{currentCount} here</span>
                      </div>
                      <div className="mtm-group-list">
                        {addCandidates.filter((e) => e.status === 'current').map((emp) => (
                          <EmployeePick
                            key={emp.id} emp={emp} locked showEmail
                            statusLabel="Already in team" statusKind="current"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="mtm-sheet-footer">
              <button type="button" className="mtm-btn mtm-btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              <button type="button" className="mtm-btn mtm-btn-primary" disabled={selectedAdd.length === 0 || adding} onClick={addMembers}>
                {adding ? <span className="mtm-mini-spin" /> : null}
                Add {selectedAdd.length || ''}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Switch member ── */}
      {switchMember && createPortal(
        <div className="mtm-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSwitchMember(null); }}>
          <div className="mtm-sheet">
            <div className="mtm-sheet-head is-light">
              <div className="mtm-sheet-head-text">
                <p className="mtm-sheet-eyebrow" style={{ color: '#84a98c' }}>Switch team</p>
                <h2 className="mtm-sheet-title">{switchMember.firstName} {switchMember.lastName}</h2>
                <p className="mtm-sheet-sub" style={{ color: '#52796f' }}>
                  Move from “{editingTeam?.name}” to another team.
                </p>
              </div>
              <button type="button" className="mtm-sheet-close" onClick={() => setSwitchMember(null)} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className="mtm-sheet-body">
              <label className="mtm-label">Target team</label>
              <select className="mtm-select" value={switchTarget} onChange={(e) => setSwitchTarget(e.target.value)}>
                {teams.filter((t) => t.id !== editingTeam?.id).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="mtm-sheet-footer">
              <button type="button" className="mtm-btn mtm-btn-ghost" onClick={() => setSwitchMember(null)}>Cancel</button>
              <button type="button" className="mtm-btn mtm-btn-primary" disabled={switching} onClick={confirmSwitch}>
                {switching ? <span className="mtm-mini-spin" /> : null}
                Switch
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}

function EmployeePick({ emp, selectable = false, selected = false, locked = false, onToggle, showEmail = false, statusLabel, statusKind }) {
  const Tag = selectable ? 'button' : 'div';
  return (
    <Tag
      type={selectable ? 'button' : undefined}
      className={`mtm-emp ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}
      onClick={selectable ? onToggle : undefined}
      disabled={selectable ? false : undefined}
    >
      <p className="mtm-emp-name">{emp.firstName} {emp.lastName}</p>
      <p className="mtm-emp-detail">{emp.department || '—'}{emp.jobTitle ? ` · ${emp.jobTitle}` : ''}</p>
      {showEmail && <p className="mtm-emp-detail">{emp.email || '—'}</p>}
      {statusLabel ? (
        <p className={`mtm-emp-status is-${statusKind}`}>{statusLabel}</p>
      ) : locked && emp.currentTeam ? (
        <p className="mtm-emp-status is-other">In {emp.currentTeam}</p>
      ) : null}
      {selectable && selected && <span className="mtm-emp-check"><CheckMark /></span>}
    </Tag>
  );
}
