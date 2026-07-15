import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../utils/api';
import { getUser } from '../utils/auth';
import { getErrorMessage } from '../utils/errorHandler';
import { canPreviewInApp, isNativePlatform, openBlobWithOsViewer, saveBlobToDevice } from '../utils/files';

// Shared folder-based Documents browser used by every role.
//
// It mirrors the web app's Documents page and drives the real document-management
// folders API (the flat `/documents` route this app used before doesn't exist on
// the backend, which is why Documents looked permanently empty):
//
//   GET  /documentManagement/folders                         -> { folders: [...] }
//   GET  /documentManagement/folders/:folderId               -> { folder, folderPermissions, breadcrumb, contents }
//   GET  /documentManagement/employees/:empId/my-documents   -> ensures the "My Documents" folder exists
//   GET  /documentManagement/documents/:id/view              -> file blob (inline)
//   GET  /documentManagement/documents/:id/download          -> file blob (attachment)
//   POST /documentManagement/folders/:folderId/documents     -> upload (FormData)
//   DELETE /documentManagement/documents/:id                 -> delete
//
// Each folder/item carries canEdit / canDelete flags resolved by the backend, so
// the UI just respects them rather than re-deriving permissions. Role differences
// (framing, folder grouping, upload visibility) come in as props — the backend
// already returns the correct folder set and permission flags per role.

const BASE = '/documentManagement';

// Roles that may hand-pick folder access (ACL). Admins can grant to anyone;
// managers only to their team. Everyone else (employees) can still create their
// own folders and upload — they just can't assign other people's access.
const ADMIN_ROLES = ['admin', 'super-admin'];
const MANAGER_ROLES = ['manager', 'senior-manager'];

// Folder permission level for a single employee, derived from the backend's
// three id arrays (delete implies edit implies view).
function levelForEmployee(permissions, empId) {
  const id = String(empId);
  const has = (arr) => Array.isArray(arr) && arr.some((x) => String(x) === id);
  if (has(permissions?.deleteEmployeeIds)) return 'full';
  if (has(permissions?.editEmployeeIds)) return 'edit';
  if (has(permissions?.viewEmployeeIds)) return 'view';
  return 'none';
}

// Seed the ACL editor from an existing folder's permission arrays.
function folderLevelMap(folder) {
  const p = folder?.permissions || {};
  const ids = new Set([
    ...(p.viewEmployeeIds || []),
    ...(p.editEmployeeIds || []),
    ...(p.deleteEmployeeIds || []),
  ].map(String));
  const map = {};
  ids.forEach((id) => { map[id] = levelForEmployee(p, id); });
  return map;
}

// Turn { empId: level } back into the three arrays the API expects.
function levelsToAcl(levels) {
  const viewEmployeeIds = [];
  const editEmployeeIds = [];
  const deleteEmployeeIds = [];
  Object.entries(levels || {}).forEach(([id, lvl]) => {
    if (lvl === 'view' || lvl === 'edit' || lvl === 'full') viewEmployeeIds.push(id);
    if (lvl === 'edit' || lvl === 'full') editEmployeeIds.push(id);
    if (lvl === 'full') deleteEmployeeIds.push(id);
  });
  return { viewEmployeeIds, editEmployeeIds, deleteEmployeeIds };
}

// The team/employee endpoints return a few different envelope shapes.
function normalizeEmployeeList(payload) {
  const list = Array.isArray(payload) ? payload
    : Array.isArray(payload?.data) ? payload.data
    : Array.isArray(payload?.employees) ? payload.employees
    : Array.isArray(payload?.members) ? payload.members
    : Array.isArray(payload?.team) ? payload.team
    : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const e = item?.employee || item?.member || item || {};
    const id = e._id || e.id;
    if (!id || seen.has(String(id))) continue;
    seen.add(String(id));
    const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || e.email || 'Employee';
    out.push({ id: String(id), name, sub: e.jobTitle || e.department || e.email || '' });
  }
  return out;
}

const styles = `
  @keyframes ed-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ed-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes ed-spin { to { transform: rotate(360deg); } }
  @keyframes ed-fadein { from { opacity: 0; } to { opacity: 1; } }

  .ed-wrap { padding: 0.85rem 1rem 6rem; }
  .ed-anim { animation: ed-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  .ed-header { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.25rem 0.85rem; }
  .ed-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18); flex-shrink: 0;
  }
  .ed-header-text { min-width: 0; flex: 1; }
  .ed-header-eyebrow { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .ed-header-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1; font-weight: 400; color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ed-count { font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem; }
  .ed-refresh {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .ed-refresh:disabled { opacity: 0.55; }
  .ed-refresh:not(:disabled):active { transform: scale(0.94); }
  .ed-refresh.is-busy svg { animation: ed-spin 0.8s linear infinite; }
  .ed-refresh.is-add { border-color: transparent; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; box-shadow: 0 4px 12px rgba(53,79,82,0.22); }

  .ed-back {
    display: inline-flex; align-items: center; gap: 0.3rem;
    background: rgba(255,255,255,0.6); border: 1px solid rgba(132,169,140,0.4); color: #52796f;
    border-radius: 999px; padding: 0.4rem 0.8rem 0.4rem 0.6rem; font-size: 0.74rem; font-weight: 600;
    -webkit-tap-highlight-color: transparent; cursor: pointer; margin-bottom: 0.7rem;
  }
  .ed-back:active { transform: scale(0.97); }
  .ed-crumbs { font-size: 0.68rem; color: #7a8e84; margin: 0 0 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ed-crumbs b { color: #52796f; font-weight: 600; }

  .ed-search { position: relative; margin-bottom: 0.85rem; }
  .ed-search svg { position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%); color: #84a98c; pointer-events: none; }
  .ed-search input {
    width: 100%; padding: 0.65rem 0.75rem 0.65rem 2.2rem; border-radius: 12px;
    border: 1.5px solid #d4ddd6; background: #fff; font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46;
    -webkit-appearance: none; appearance: none; box-sizing: border-box; -webkit-tap-highlight-color: transparent;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .ed-search input::placeholder { color: #a7b6ac; }
  .ed-search input:focus { outline: none; border-color: #52796f; box-shadow: 0 0 0 3px rgba(82, 121, 111, 0.12); }

  .ed-group-label {
    display: flex; align-items: center; gap: 0.4rem; margin: 0.4rem 0 0.5rem;
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #84a98c;
  }
  .ed-group-label::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(132,169,140,0.3), transparent); }

  .ed-list { display: flex; flex-direction: column; gap: 0.45rem; }
  .ed-card {
    display: flex; align-items: center; gap: 0.7rem; width: 100%; text-align: left;
    padding: 0.65rem 0.75rem; border-radius: 13px; background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    font-family: 'DM Sans', sans-serif; cursor: pointer; -webkit-tap-highlight-color: transparent;
    transition: transform 0.12s, background 0.15s; text-decoration: none;
  }
  .ed-card:active { transform: scale(0.99); background: #f7f8f6; }

  .ed-folder-icon {
    width: 40px; height: 40px; border-radius: 9px; flex-shrink: 0;
    background: rgba(82,121,111,0.12); border: 1px solid rgba(82,121,111,0.2); color: #52796f;
    display: flex; align-items: center; justify-content: center;
  }
  .ed-file {
    width: 40px; height: 46px; border-radius: 7px; flex-shrink: 0; position: relative;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.2), rgba(82, 121, 111, 0.14));
    color: #354f52; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px;
  }
  .ed-file-ext { font-size: 0.5rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
  .ed-file.is-pdf { background: linear-gradient(135deg, rgba(192,117,106,0.22), rgba(192,117,106,0.12)); color: #b85c50; }
  .ed-file.is-img { background: linear-gradient(135deg, rgba(109,136,194,0.2), rgba(109,136,194,0.12)); color: #5470a8; }
  .ed-file.is-sheet { background: linear-gradient(135deg, rgba(132,169,140,0.26), rgba(132,169,140,0.14)); color: #3f6b4a; }
  .ed-meta { min-width: 0; flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .ed-name { display: block; max-width: 100%; font-size: 0.85rem; font-weight: 600; color: #2f3e46; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ed-sub { display: block; max-width: 100%; margin-top: 2px; font-size: 0.68rem; color: #7a8e84; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ed-chev { color: #b8c4bc; flex-shrink: 0; }

  .ed-row-actions { display: flex; align-items: center; gap: 0.15rem; flex-shrink: 0; }
  .ed-act-btn {
    width: 32px; height: 32px; border-radius: 8px; border: none; background: none; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; color: #84a98c;
    -webkit-tap-highlight-color: transparent; transition: background 0.15s, color 0.15s;
  }
  .ed-act-btn:active { transform: scale(0.92); }
  .ed-act-btn.is-view { color: #52796f; }
  .ed-act-btn.is-view:active { background: rgba(82,121,111,0.12); }
  .ed-act-btn.is-dl { color: #6f8c98; }
  .ed-act-btn.is-dl:active { background: rgba(111,140,152,0.12); }
  .ed-act-btn.is-del { color: #b85c50; }
  .ed-act-btn.is-del:active { background: rgba(192,117,106,0.12); }
  .ed-act-btn:disabled { opacity: 0.5; }

  .ed-fab {
    position: fixed; right: 1.1rem; bottom: calc(1.1rem + env(safe-area-inset-bottom, 0px)); z-index: 40;
    display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.8rem 1.05rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; font-size: 0.82rem; font-weight: 600;
    box-shadow: 0 8px 22px rgba(53,79,82,0.32); -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .ed-fab:active { transform: scale(0.96); }
  .ed-fab:disabled { opacity: 0.6; }

  .ed-skel { height: 64px; border-radius: 13px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%); animation: ed-skel 1.2s ease-in-out infinite; margin-bottom: 0.45rem; }
  .ed-empty, .ed-error {
    padding: 2rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .ed-error { border-color: rgba(192, 117, 106, 0.4); color: #7a3028; background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55); }
  .ed-empty-glyph { width: 38px; height: 38px; margin: 0 auto 0.6rem; border-radius: 11px; background: rgba(132, 169, 140, 0.14); display: flex; align-items: center; justify-content: center; color: #52796f; }
  .ed-empty-title, .ed-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .ed-empty-sub, .ed-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .ed-retry { margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .ed-retry:active { transform: scale(0.97); }

  .ed-banner { margin-bottom: 0.85rem; padding: 0.6rem 0.85rem; border-radius: 12px; font-size: 0.78rem; font-weight: 500; }
  .ed-banner.is-success { background: linear-gradient(135deg, #f0f5f2, #eaf2ec); border-left: 3px solid #52796f; color: #2f3e46; }
  .ed-banner.is-error { background: linear-gradient(135deg, #fdf3f2, #fdecea); border-left: 3px solid #c0756a; color: #7a3028; }

  /* ── Document viewer overlay ── */
  .ed-viewer { position: fixed; inset: 0; z-index: 60; background: #2f3e46; display: flex; flex-direction: column; animation: ed-fadein 0.2s ease both; }
  .ed-viewer-bar {
    flex-shrink: 0; display: flex; align-items: center; gap: 0.6rem;
    padding: calc(0.6rem + env(safe-area-inset-top, 0px)) 0.85rem 0.6rem;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #f0f5f2;
  }
  .ed-viewer-title { flex: 1; min-width: 0; font-size: 0.88rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ed-viewer-btn { background: rgba(255,255,255,0.15); border: none; color: #f0f5f2; width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent; flex-shrink: 0; }
  .ed-viewer-btn:active { transform: scale(0.94); }
  .ed-viewer-body { flex: 1; min-height: 0; position: relative; background: #525659; }
  .ed-viewer-frame { width: 100%; height: 100%; border: none; }
  .ed-viewer-img { width: 100%; height: 100%; object-fit: contain; }
  .ed-viewer-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.8rem; color: #cad2c5; padding: 1.5rem; text-align: center; }
  .ed-viewer-spin { width: 34px; height: 34px; border: 3px solid rgba(202,210,197,0.25); border-top-color: #cad2c5; border-radius: 50%; animation: ed-spin 0.8s linear infinite; }
  .ed-viewer-fallback-btn { margin-top: 0.5rem; padding: 0.6rem 1.1rem; border-radius: 999px; border: none; background: #cad2c5; color: #2f3e46; font-size: 0.8rem; font-weight: 600; cursor: pointer; }

  /* ── Upload modal ── */
  .ed-modal-overlay { position: fixed; inset: 0; z-index: 70; background: rgba(47,62,70,0.6); backdrop-filter: blur(3px); display: flex; align-items: flex-end; justify-content: center; padding: 0; animation: ed-fadein 0.18s ease; }
  @media (min-width: 480px) { .ed-modal-overlay { align-items: center; padding: 1rem; } }
  .ed-modal { background: #fff; width: 100%; max-width: 460px; border-radius: 18px 18px 0 0; box-shadow: 0 -10px 40px rgba(47,62,70,0.25); display: flex; flex-direction: column; max-height: 92vh; animation: ed-fadeUp 0.28s cubic-bezier(0.22,1,0.36,1); }
  @media (min-width: 480px) { .ed-modal { border-radius: 18px; } }
  .ed-modal-head { flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.1rem 1.2rem 0.85rem; border-bottom: 1px solid #eaefeb; }
  .ed-modal-eyebrow { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .ed-modal-title { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; font-weight: 400; color: #2f3e46; margin: 0.1rem 0 0; }
  .ed-modal-sub { font-size: 0.72rem; color: #52796f; font-weight: 500; margin: 0.2rem 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ed-modal-close { background: none; border: none; color: #84a98c; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; -webkit-tap-highlight-color: transparent; }
  .ed-modal-body { flex: 1 1 auto; min-height: 0; padding: 1.1rem 1.2rem; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
  .ed-field { margin-bottom: 0.95rem; }
  .ed-field:last-child { margin-bottom: 0; }
  .ed-label { display: block; font-size: 0.62rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #52796f; margin-bottom: 0.4rem; }
  .ed-input, .ed-select { width: 100%; padding: 0.65rem 0.85rem; border: 1.5px solid #d4ddd6; border-radius: 9px; font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46; background: #fff; outline: none; box-sizing: border-box; }
  .ed-input:focus, .ed-select:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }
  .ed-file-input { padding: 0; }
  .ed-file-input::-webkit-file-upload-button, .ed-file-input::file-selector-button { padding: 0.65rem 0.85rem; margin-right: 0.7rem; border: none; border-right: 1.5px solid #d4ddd6; background: linear-gradient(135deg, #f0f5f2, #eaf2ec); color: #354f52; font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500; cursor: pointer; }
  .ed-modal-foot { flex-shrink: 0; display: flex; gap: 0.5rem; padding: 0.85rem 1.2rem calc(0.85rem + env(safe-area-inset-bottom, 0px)); border-top: 1px solid #eaefeb; background: #fafbfa; }
  .ed-btn { flex: 1; padding: 0.8rem; border-radius: 10px; border: none; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; }
  .ed-btn.is-ghost { background: #fff; color: #52796f; border: 1px solid #d4ddd6; }
  .ed-btn.is-primary { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; box-shadow: 0 3px 12px rgba(53,79,82,0.22); }
  .ed-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .ed-btn-spin { width: 14px; height: 14px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: ed-spin 0.7s linear infinite; }

  /* ── FAB stack (Upload + New Folder) ── */
  .ed-fab-stack { position: fixed; right: 1.1rem; bottom: calc(1.1rem + env(safe-area-inset-bottom, 0px)); z-index: 40; display: flex; flex-direction: column; gap: 0.55rem; align-items: flex-end; }
  .ed-fab-stack .ed-fab { position: static; }
  .ed-fab.is-secondary { background: #fff; color: #52796f; border: 1px solid rgba(82, 121, 111, 0.35); box-shadow: 0 6px 18px rgba(47, 62, 70, 0.12); }

  .ed-act-btn.is-edit { color: #6f8c98; }
  .ed-act-btn.is-edit:active { background: rgba(111, 140, 152, 0.12); }

  /* ── ACL editor ── */
  .ed-textarea { width: 100%; padding: 0.65rem 0.85rem; border: 1.5px solid #d4ddd6; border-radius: 9px; font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46; background: #fff; outline: none; box-sizing: border-box; resize: vertical; min-height: 46px; }
  .ed-textarea:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82, 121, 111, 0.12); }
  .ed-acl-search { margin: 0.2rem 0 0.5rem; }
  .ed-acl-count { font-size: 0.66rem; color: #7a8e84; margin: 0 0 0.4rem; }
  .ed-acl-list { display: flex; flex-direction: column; gap: 0.3rem; max-height: 34vh; overflow-y: auto; -webkit-overflow-scrolling: touch; border: 1px solid #eaefeb; border-radius: 10px; padding: 0.45rem; }
  .ed-acl-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.25rem 0.15rem; }
  .ed-acl-info { min-width: 0; flex: 1; }
  .ed-acl-name { font-size: 0.8rem; font-weight: 600; color: #2f3e46; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ed-acl-sub { font-size: 0.64rem; color: #7a8e84; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ed-acl-select { flex-shrink: 0; width: auto; padding: 0.35rem 0.45rem; font-size: 0.74rem; border: 1.5px solid #d4ddd6; border-radius: 8px; background: #fff; color: #2f3e46; outline: none; -webkit-appearance: none; }
  .ed-acl-select:focus { border-color: #52796f; }
  .ed-acl-empty { padding: 1rem; text-align: center; font-size: 0.74rem; color: #7a8e84; }
  .ed-btn.is-danger { flex: 0 0 auto; background: #fff; color: #b85c50; border: 1px solid rgba(192, 117, 106, 0.4); }
`;

const UPLOAD_CATEGORIES = [
  { value: 'other', label: 'Other' },
  { value: 'contract', label: 'Contract' },
  { value: 'identification', label: 'Identification' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'payslip', label: 'Payslip' },
  { value: 'policy', label: 'Policy' },
];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.txt'];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function docName(d) {
  return d?.name || d?.title || d?.fileName || d?.filename || d?.originalName || 'Untitled document';
}
function docExt(d) {
  const src = d?.fileType || d?.mimeType || d?.type || docName(d) || '';
  const fromName = String(docName(d)).split('.').pop();
  const raw = (String(src).includes('/') ? String(src).split('/').pop() : src) || fromName || '';
  return String(raw).replace(/[^a-z0-9]/gi, '').slice(0, 4).toLowerCase() || 'file';
}
function extKind(ext) {
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg', 'bmp'].includes(ext)) return 'img';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  return 'doc';
}
function formatSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function FolderIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function FileGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
    </svg>
  );
}

export default function DocumentsBrowser({
  // Root header framing
  eyebrow = 'My Workspace',
  title = 'Documents',
  // Root empty state copy
  emptyTitle = 'No folders yet',
  emptySubtitle = 'Folders shared with you and your personal documents will appear here.',
  // Employees get a personal "My Documents" folder auto-provisioned + grouped
  // separately from shared folders. Admins/managers browse a single flat list.
  groupFolders = true,
  ensureMyDocuments = true,
  // How uploads are scoped: employees upload private ('employee') files owned by
  // themselves; admins/managers default to folder-wide ('all') visibility.
  uploadVisibility = 'employee',
}) {
  const [empId, setEmpId] = useState(null);

  // Root folder list
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  // Current open folder
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderData, setFolderData] = useState(null); // { folder, folderPermissions, breadcrumb, contents }
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState(null);

  const [viewer, setViewer] = useState(null); // { doc, url, mime, inline, loading, failed }
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [banner, setBanner] = useState(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCategory, setUploadCategory] = useState('other');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Signed-in role → whether this user may assign other people's folder access.
  const [role, setRole] = useState('');
  const isAdminLike = ADMIN_ROLES.includes(role);
  const aclScope = isAdminLike ? 'all' : MANAGER_ROLES.includes(role) ? 'team' : 'none';
  const canManageAcl = aclScope !== 'none';

  // Create / edit folder modal: { mode, parentFolderId, folder, canDelete }
  const [folderModal, setFolderModal] = useState(null);
  const [savingFolder, setSavingFolder] = useState(false);
  const [aclEmployees, setAclEmployees] = useState([]);
  const [aclLoading, setAclLoading] = useState(false);

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 3000);
  }

  // ── Root folders ────────────────────────────────────────────────────────
  const fetchFolders = useCallback(async (employeeId) => {
    setLoading(true);
    setError(null);
    try {
      // Ensure the employee's "My Documents" folder exists so it shows up even
      // before anything has been uploaded into it. Admins/managers have no
      // EmployeeHub record, so this step is skipped for them.
      if (ensureMyDocuments && employeeId) {
        try { await api.get(`${BASE}/employees/${employeeId}/my-documents`); } catch { /* non-fatal */ }
      }
      const { data } = await api.get(`${BASE}/folders`);
      const list = data?.folders || (Array.isArray(data) ? data : []);
      setFolders(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [ensureMyDocuments]);

  useEffect(() => {
    let active = true;
    (async () => {
      const user = await getUser();
      const id = user?.employeeHubId || user?.employeeId || user?._id || user?.id || null;
      if (!active) return;
      setEmpId(id);
      setRole(String(user?.role || user?.userType || '').toLowerCase());
      fetchFolders(id);
    })();
    return () => { active = false; };
  }, [fetchFolders]);

  // ── Folder contents ─────────────────────────────────────────────────────
  const fetchFolderContents = useCallback(async (folderId) => {
    setFolderLoading(true);
    setFolderError(null);
    try {
      const { data } = await api.get(`${BASE}/folders/${folderId}`);
      setFolderData({
        folder: data?.folder || null,
        folderPermissions: data?.folderPermissions || { canEdit: false, canDelete: false },
        breadcrumb: Array.isArray(data?.breadcrumb) ? data.breadcrumb : [],
        contents: Array.isArray(data?.contents)
          ? data.contents
          : (Array.isArray(data?.documents) ? data.documents.map((d) => ({ ...d, type: 'document' })) : []),
      });
    } catch (err) {
      setFolderError(getErrorMessage(err));
      setFolderData(null);
    } finally {
      setFolderLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentFolderId) fetchFolderContents(currentFolderId);
  }, [currentFolderId, fetchFolderContents]);

  function openFolder(folderId) {
    if (!folderId) return;
    setCurrentFolderId(String(folderId));
  }

  function goBack() {
    const crumbs = folderData?.breadcrumb || [];
    if (crumbs.length > 1) {
      // Navigate to the parent folder.
      const parent = crumbs[crumbs.length - 2];
      setFolderData(null);
      setCurrentFolderId(String(parent._id));
    } else {
      setCurrentFolderId(null);
      setFolderData(null);
      // Refresh root counts in case anything changed inside a folder.
      fetchFolders(empId);
    }
  }

  // Revoke viewer object URL on close / unmount.
  useEffect(() => () => { if (viewer?.url) URL.revokeObjectURL(viewer.url); }, [viewer?.url]);

  async function openDocument(doc) {
    const id = doc?._id || doc?.id;
    if (!id) return;
    const mime = doc.mimeType || doc.fileType || '';
    const ext = docExt(doc);
    const inline = canPreviewInApp(mime, ext);
    const native = isNativePlatform();
    setViewer({ doc, url: null, mime, inline, loading: true, failed: false, error: null });
    try {
      const res = await api.get(`${BASE}/documents/${id}/view`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: mime || 'application/octet-stream' });

      // Anything the WebView can't paint itself goes to the OS viewer — on
      // Android that's every PDF, which is what used to render as a blank page.
      if (native && !inline) {
        await openBlobWithOsViewer(blob, docName(doc), mime);
        setViewer(null);
        return;
      }

      const url = URL.createObjectURL(blob);
      setViewer({ doc, url, mime, inline, loading: false, failed: false, error: null });
    } catch (err) {
      setViewer({ doc, url: null, mime, inline, loading: false, failed: true, error: getErrorMessage(err) });
    }
  }

  function closeViewer() {
    if (viewer?.url) URL.revokeObjectURL(viewer.url);
    setViewer(null);
  }

  async function downloadDocument(doc) {
    const id = doc?._id || doc?.id;
    if (!id) return;
    const mime = doc.mimeType || doc.fileType || '';
    setDownloadingId(id);
    try {
      const res = await api.get(`${BASE}/documents/${id}/download`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: mime || 'application/octet-stream' });

      // A WebView ignores <a download>, so on a device the file has to be
      // written to storage ourselves.
      if (isNativePlatform()) {
        const { location } = await saveBlobToDevice(blob, docName(doc), mime);
        flash('success', `Saved to ${location}`);
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', docName(doc));
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  }

  async function deleteDocument(doc) {
    const id = doc?._id || doc?.id;
    if (!id) return;
    if (!window.confirm(`Delete "${docName(doc)}"? This can't be undone.`)) return;
    setDeletingId(id);
    try {
      await api.delete(`${BASE}/documents/${id}`);
      setFolderData((prev) => prev
        ? { ...prev, contents: prev.contents.filter((it) => String(it._id || it.id) !== String(id)) }
        : prev);
      flash('success', 'Document deleted');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  // ── Folders: create / edit / delete ─────────────────────────────────────
  // Load the pool of people this user may grant access to (admins → everyone,
  // managers → their team). Fetched once, lazily, when a folder modal opens.
  const fetchAclEmployees = useCallback(async () => {
    if (aclScope === 'none') return;
    setAclLoading(true);
    try {
      const url = aclScope === 'all' ? '/employees' : '/manager/team/members?includeIndirect=true';
      const { data } = await api.get(url);
      setAclEmployees(normalizeEmployeeList(data));
    } catch {
      setAclEmployees([]);
    } finally {
      setAclLoading(false);
    }
  }, [aclScope]);

  function openCreateFolder(parentFolderId = null) {
    if (canManageAcl && aclEmployees.length === 0) fetchAclEmployees();
    setFolderModal({ mode: 'create', parentFolderId, folder: null, canDelete: false });
  }
  function openEditFolder(folder, canDelete) {
    if (canManageAcl && aclEmployees.length === 0) fetchAclEmployees();
    setFolderModal({ mode: 'edit', parentFolderId: folder?.parentFolder || null, folder, canDelete: Boolean(canDelete) });
  }
  function closeFolderModal() {
    if (savingFolder) return;
    setFolderModal(null);
  }

  function refreshCurrentView() {
    if (currentFolderId) fetchFolderContents(currentFolderId);
    else fetchFolders(empId);
  }

  async function submitFolder({ name, description, levels }) {
    const trimmed = String(name || '').trim();
    if (!trimmed) { flash('error', 'Folder name is required'); return; }
    setSavingFolder(true);
    try {
      const payload = { name: trimmed, description: description || '' };
      if (canManageAcl) Object.assign(payload, levelsToAcl(levels));
      if (folderModal.mode === 'edit') {
        await api.put(`${BASE}/folders/${folderModal.folder._id}`, payload);
        flash('success', 'Folder updated');
      } else {
        payload.parentFolderId = folderModal.parentFolderId || null;
        await api.post(`${BASE}/folders`, payload);
        flash('success', 'Folder created');
      }
      setFolderModal(null);
      refreshCurrentView();
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setSavingFolder(false);
    }
  }

  async function deleteFolder(folder) {
    const id = folder?._id || folder?.id;
    if (!id) return;
    if (!window.confirm(`Delete folder "${folder.name || 'this folder'}" and everything inside it? This can't be undone.`)) return;
    setSavingFolder(true);
    try {
      await api.delete(`${BASE}/folders/${id}`);
      flash('success', 'Folder deleted');
      setFolderModal(null);
      if (currentFolderId && String(currentFolderId) === String(id)) goBack();
      else refreshCurrentView();
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setSavingFolder(false);
    }
  }

  // ── Upload ──────────────────────────────────────────────────────────────
  function openUpload() {
    setUploadFile(null);
    setUploadCategory('other');
    setUploadOpen(true);
  }
  function closeUpload() {
    if (uploading) return;
    setUploadOpen(false);
    setUploadFile(null);
  }

  async function submitUpload() {
    if (!uploadFile) { flash('error', 'Please choose a file'); return; }
    const lower = uploadFile.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((e) => lower.endsWith(e))) {
      flash('error', 'Only PDF, Word, Excel, PowerPoint, image and text files are allowed.');
      return;
    }
    if (uploadFile.size > MAX_UPLOAD_BYTES) {
      flash('error', 'File is too large. Max size is 10MB.');
      return;
    }
    if (!currentFolderId) { flash('error', 'Open a folder before uploading'); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('category', uploadCategory);
      if (uploadVisibility === 'employee' && empId) {
        // Employee upload: a private file they own.
        fd.append('ownerId', empId);
        fd.append('accessControl', JSON.stringify({ visibility: 'employee', allowedUserIds: [] }));
      } else {
        // Admin/manager upload: visible to everyone with access to the folder.
        fd.append('accessControl', JSON.stringify({ visibility: 'all', allowedUserIds: [] }));
      }
      await api.post(`${BASE}/folders/${currentFolderId}/documents`, fd);
      setUploadOpen(false);
      setUploadFile(null);
      flash('success', 'Document uploaded');
      fetchFolderContents(currentFolderId);
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  // ── Derived: grouped + filtered root folders ────────────────────────────
  const ownerIdOf = (f) => f?.createdByEmployeeId || f?.ownerInfo?._id || f?.ownerInfo?.id || null;
  const isOwnMyDocuments = (f) => {
    if (String(f?.name || '').trim() !== 'My Documents') return false;
    const owner = ownerIdOf(f);
    const inView = Array.isArray(f?.permissions?.viewEmployeeIds)
      && f.permissions.viewEmployeeIds.some((x) => String(x) === String(empId));
    return (owner && String(owner) === String(empId)) || inView;
  };

  const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''));

  const isMyDocumentsFolder = (f) => String(f?.name || '').trim() === 'My Documents';

  const visibleFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = folders.filter((f) => f?._id && (!q || String(f.name || '').toLowerCase().includes(q)));

    // Normalize the personal "My Documents" folders the backend hands back. It
    // returns one per employee plus historic duplicates, which is why the
    // mobile list filled up with empty "My Documents" cards. Mirror the web app:
    //   • admin-like users manage the shared library and never see a personal
    //     "My Documents" folder — drop them all;
    //   • everyone else keeps a single canonical one (preferring their own copy,
    //     then whichever actually holds documents) and drops the empty dupes.
    const myDocs = filtered.filter(isMyDocumentsFolder);
    if (myDocs.length === 0) return filtered.slice().sort(byName);

    const rest = filtered.filter((f) => !isMyDocumentsFolder(f));
    if (isAdminLike) return rest.sort(byName);

    const own = myDocs.filter(isOwnMyDocuments);
    const pool = own.length ? own : myDocs;
    const canonical = [...pool].sort((a, b) => (b?.documentCount || 0) - (a?.documentCount || 0))[0];
    return [...rest, canonical].sort(byName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders, query, isAdminLike, empId]);

  const grouped = useMemo(() => {
    if (!groupFolders) return { mine: [], shared: visibleFolders };
    const mine = [];
    const shared = [];
    for (const f of visibleFolders) {
      if (isOwnMyDocuments(f)) mine.push(f);
      else shared.push(f);
    }
    return { mine, shared };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleFolders, groupFolders, empId]);

  const totalFolders = grouped.mine.length + grouped.shared.length;
  const canUploadHere = Boolean(folderData?.folderPermissions?.canEdit);

  // A folder is "manageable" when the user can edit it — except a personal
  // "My Documents" folder, which employees must not rename (it's resolved by
  // name on the backend). Admins/managers may still manage it.
  const canManageFolder = (f) =>
    Boolean(f?.canEdit) && !(String(f?.name || '') === 'My Documents' && !canManageAcl);

  // ── Render: inside a folder ─────────────────────────────────────────────
  if (currentFolderId) {
    const crumbs = folderData?.breadcrumb || [];
    const folderTitle = folderData?.folder?.name || 'Folder';
    const items = folderData?.contents || [];
    const subfolders = items.filter((it) => it.type === 'folder');
    const docs = items.filter((it) => it.type !== 'folder');

    return (
      <>
        <style>{styles}</style>
        <div className="ed-wrap">
          <button type="button" className="ed-back ed-anim" onClick={goBack}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>

          <header className="ed-header ed-anim" style={{ paddingTop: 0 }}>
            <div className="ed-header-icon"><FolderIcon size={18} /></div>
            <div className="ed-header-text">
              <p className="ed-header-eyebrow">Documents</p>
              <h1 className="ed-header-title">{folderTitle}</h1>
            </div>
            {folderData?.folderPermissions?.canEdit && folderData?.folder
              && !(folderData.folder.name === 'My Documents' && !canManageAcl) && (
              <button
                type="button"
                className="ed-refresh"
                onClick={() => openEditFolder(folderData.folder, folderData.folderPermissions.canDelete)}
                aria-label={canManageAcl ? 'Edit folder & access' : 'Rename folder'}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className={`ed-refresh${folderLoading ? ' is-busy' : ''}`}
              onClick={() => fetchFolderContents(currentFolderId)}
              disabled={folderLoading}
              aria-label="Refresh"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </header>

          {crumbs.length > 0 && (
            <p className="ed-crumbs ed-anim">
              {crumbs.map((c, i) => (
                <span key={c._id || i}>
                  {i > 0 && ' / '}
                  {i === crumbs.length - 1 ? <b>{c.name}</b> : c.name}
                </span>
              ))}
            </p>
          )}

          {banner && (
            <div className={`ed-banner ${banner.kind === 'success' ? 'is-success' : 'is-error'} ed-anim`}>{banner.text}</div>
          )}

          {folderLoading ? (
            <div>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="ed-skel" />)}</div>
          ) : folderError ? (
            <div className="ed-error ed-anim">
              <p className="ed-error-title">Couldn't open folder</p>
              <p className="ed-error-sub">{folderError}</p>
              <button className="ed-retry" onClick={() => fetchFolderContents(currentFolderId)}>Try again</button>
            </div>
          ) : items.length === 0 ? (
            <div className="ed-empty ed-anim">
              <div className="ed-empty-glyph"><FileGlyph /></div>
              <p className="ed-empty-title">This folder is empty</p>
              <p className="ed-empty-sub">
                {canUploadHere ? 'Tap “Upload” to add a document.' : 'No documents have been shared here yet.'}
              </p>
            </div>
          ) : (
            <div className="ed-list">
              {subfolders.map((f, i) => (
                <FolderCard
                  key={f._id || i}
                  folder={f}
                  index={i}
                  subtitle="Folder"
                  onOpen={openFolder}
                  onManage={canManageFolder(f) ? () => openEditFolder(f, f.canDelete) : null}
                />
              ))}

              {docs.map((d, i) => {
                const id = d._id || d.id;
                const ext = docExt(d);
                const kind = extKind(ext);
                const date = formatDate(d.createdAt || d.uploadedAt || d.date);
                const size = formatSize(d.fileSize || d.size);
                const sub = [date, size].filter(Boolean).join(' · ') || 'Document';
                return (
                  <div key={id || i} className="ed-card ed-anim" style={{ animationDelay: `${Math.min(i, 6) * 25}ms` }}>
                    <span className={`ed-file is-${kind}`} onClick={() => openDocument(d)}><span className="ed-file-ext">{ext}</span></span>
                    <span className="ed-meta" onClick={() => openDocument(d)}>
                      <span className="ed-name">{docName(d)}</span>
                      <span className="ed-sub">{sub}</span>
                    </span>
                    <span className="ed-row-actions">
                      <button type="button" className="ed-act-btn is-view" onClick={() => openDocument(d)} aria-label="View">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button type="button" className="ed-act-btn is-dl" onClick={() => downloadDocument(d)} disabled={downloadingId === id} aria-label="Download">
                        {downloadingId === id ? <span className="ed-btn-spin" /> : (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                          </svg>
                        )}
                      </button>
                      {d.canDelete && (
                        <button type="button" className="ed-act-btn is-del" onClick={() => deleteDocument(d)} disabled={deletingId === id} aria-label="Delete">
                          {deletingId === id ? <span className="ed-btn-spin" /> : (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                            </svg>
                          )}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {canUploadHere && !folderLoading && (
          <div className="ed-fab-stack">
            <button type="button" className="ed-fab is-secondary" onClick={() => openCreateFolder(currentFolderId)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <path d="M12 11v4M10 13h4" />
              </svg>
              New Folder
            </button>
            <button type="button" className="ed-fab" onClick={openUpload}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Upload
            </button>
          </div>
        )}

        {folderModal && (
          <FolderFormModal
            modal={folderModal}
            canManageAcl={canManageAcl}
            aclEmployees={aclEmployees}
            aclLoading={aclLoading}
            saving={savingFolder}
            onClose={closeFolderModal}
            onSubmit={submitFolder}
            onDelete={deleteFolder}
          />
        )}

        {uploadOpen && (
          <UploadModal
            folderName={folderTitle}
            file={uploadFile}
            category={uploadCategory}
            uploading={uploading}
            fileInputRef={fileInputRef}
            onFile={setUploadFile}
            onCategory={setUploadCategory}
            onClose={closeUpload}
            onSubmit={submitUpload}
          />
        )}

        {viewer && <DocumentViewerOverlay viewer={viewer} onClose={closeViewer} onRetry={() => openDocument(viewer.doc)} onDownload={() => downloadDocument(viewer.doc)} />}
      </>
    );
  }

  // ── Render: root folder list ────────────────────────────────────────────
  return (
    <>
      <style>{styles}</style>
      <div className="ed-wrap">
        <header className="ed-header ed-anim">
          <div className="ed-header-icon"><FolderIcon size={18} /></div>
          <div className="ed-header-text">
            <p className="ed-header-eyebrow">{eyebrow}</p>
            <h1 className="ed-header-title">
              {title}
              {!loading && !error && <span className="ed-count"> · {totalFolders}</span>}
            </h1>
          </div>
          {!loading && !error && (
            <button
              type="button"
              className="ed-refresh is-add"
              onClick={() => openCreateFolder(null)}
              aria-label="New folder"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <path d="M12 11v4M10 13h4" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className={`ed-refresh${loading ? ' is-busy' : ''}`}
            onClick={() => fetchFolders(empId)}
            disabled={loading}
            aria-label="Refresh"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </header>

        <div className="ed-search ed-anim">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search folders…"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>

        {banner && (
          <div className={`ed-banner ${banner.kind === 'success' ? 'is-success' : 'is-error'} ed-anim`}>{banner.text}</div>
        )}

        {loading ? (
          <div>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="ed-skel" />)}</div>
        ) : error ? (
          <div className="ed-error ed-anim">
            <p className="ed-error-title">Couldn't load documents</p>
            <p className="ed-error-sub">{error}</p>
            <button className="ed-retry" onClick={() => fetchFolders(empId)}>Try again</button>
          </div>
        ) : totalFolders === 0 ? (
          <div className="ed-empty ed-anim">
            <div className="ed-empty-glyph"><FolderIcon /></div>
            <p className="ed-empty-title">{query ? 'No matching folders' : emptyTitle}</p>
            <p className="ed-empty-sub">
              {query ? 'Try a different search term.' : emptySubtitle}
            </p>
          </div>
        ) : (
          <>
            {grouped.mine.length > 0 && (
              <>
                <p className="ed-group-label ed-anim">My Documents</p>
                <div className="ed-list">
                  {grouped.mine.map((f, i) => (
                    <FolderCard key={f._id} folder={f} index={i} onOpen={openFolder} onManage={canManageFolder(f) ? () => openEditFolder(f, f.canDelete) : null} />
                  ))}
                </div>
              </>
            )}
            {grouped.shared.length > 0 && (
              <>
                {groupFolders && (
                  <p className="ed-group-label ed-anim" style={{ marginTop: grouped.mine.length ? '1rem' : '0.4rem' }}>Shared with me</p>
                )}
                <div className="ed-list">
                  {grouped.shared.map((f, i) => (
                    <FolderCard key={f._id} folder={f} index={i} onOpen={openFolder} onManage={canManageFolder(f) ? () => openEditFolder(f, f.canDelete) : null} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {folderModal && (
        <FolderFormModal
          modal={folderModal}
          canManageAcl={canManageAcl}
          aclEmployees={aclEmployees}
          aclLoading={aclLoading}
          saving={savingFolder}
          onClose={closeFolderModal}
          onSubmit={submitFolder}
          onDelete={deleteFolder}
        />
      )}

      {viewer && <DocumentViewerOverlay viewer={viewer} onClose={closeViewer} onRetry={() => openDocument(viewer.doc)} onDownload={() => downloadDocument(viewer.doc)} />}
    </>
  );
}

function FolderCard({ folder, index, onOpen, onManage, subtitle }) {
  const count = folder?.documentCount;
  const sub = subtitle || (typeof count === 'number'
    ? `${count} ${count === 1 ? 'document' : 'documents'}`
    : 'Folder');
  const owner = folder?.ownerInfo && (folder.ownerInfo.firstName || folder.ownerInfo.lastName)
    ? ` · ${[folder.ownerInfo.firstName, folder.ownerInfo.lastName].filter(Boolean).join(' ')}`
    : '';
  const open = () => onOpen(folder._id);
  return (
    <div className="ed-card ed-anim" style={{ animationDelay: `${Math.min(index, 6) * 25}ms` }}>
      <span className="ed-folder-icon" onClick={open}><FolderIcon /></span>
      <span className="ed-meta" onClick={open}>
        <span className="ed-name">{folder.name || 'Folder'}</span>
        <span className="ed-sub">{sub}{owner}</span>
      </span>
      {onManage && (
        <span className="ed-row-actions">
          <button type="button" className="ed-act-btn is-edit" onClick={onManage} aria-label="Manage folder">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        </span>
      )}
      <span className="ed-chev" aria-hidden="true" onClick={open}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </span>
    </div>
  );
}

function DocumentViewerOverlay({ viewer, onClose, onRetry, onDownload }) {
  const title = docName(viewer.doc);
  return createPortal(
    <div className="ed-viewer">
      <div className="ed-viewer-bar">
        <span className="ed-viewer-title">{title}</span>
        {!viewer.loading && (
          <button type="button" className="ed-viewer-btn" onClick={onDownload} aria-label="Download">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
        )}
        <button type="button" className="ed-viewer-btn" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="ed-viewer-body">
        {viewer.loading ? (
          <div className="ed-viewer-center">
            <div className="ed-viewer-spin" />
            <span>Opening document…</span>
          </div>
        ) : viewer.failed ? (
          <div className="ed-viewer-center">
            <span>Couldn't open this document.</span>
            {viewer.error && <span style={{ fontSize: '0.75rem', opacity: 0.75 }}>{viewer.error}</span>}
            <button type="button" className="ed-viewer-fallback-btn" onClick={onRetry}>Try again</button>
            <button type="button" className="ed-viewer-fallback-btn" onClick={onDownload}>Download instead</button>
          </div>
        ) : !viewer.inline ? (
          <div className="ed-viewer-center">
            <span>This file type can't be previewed here.</span>
            <button type="button" className="ed-viewer-fallback-btn" onClick={onDownload}>Download to open</button>
          </div>
        ) : viewer.mime && viewer.mime.toLowerCase().startsWith('image/') ? (
          <img className="ed-viewer-img" src={viewer.url} alt={title} />
        ) : (
          <iframe className="ed-viewer-frame" src={viewer.url} title={title} />
        )}
      </div>
    </div>,
    document.body,
  );
}

function UploadModal({ folderName, file, category, uploading, fileInputRef, onFile, onCategory, onClose, onSubmit }) {
  return createPortal(
    <div className="ed-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ed-modal">
        <div className="ed-modal-head">
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="ed-modal-eyebrow">Add file</p>
            <h3 className="ed-modal-title">Upload Document</h3>
            <p className="ed-modal-sub">{folderName}</p>
          </div>
          <button type="button" className="ed-modal-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="ed-modal-body">
          <div className="ed-field">
            <label className="ed-label" htmlFor="ed-upload-file">File</label>
            <input
              id="ed-upload-file"
              ref={fileInputRef}
              type="file"
              className="ed-input ed-file-input"
              accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={(e) => onFile(e.target.files?.[0] || null)}
            />
            {file && <p className="ed-modal-sub" style={{ marginTop: '0.4rem' }}>{file.name} · {formatSize(file.size) || ''}</p>}
          </div>
          <div className="ed-field">
            <label className="ed-label" htmlFor="ed-upload-cat">Category</label>
            <select id="ed-upload-cat" className="ed-select" value={category} onChange={(e) => onCategory(e.target.value)}>
              {UPLOAD_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="ed-modal-foot">
          <button type="button" className="ed-btn is-ghost" onClick={onClose} disabled={uploading}>Cancel</button>
          <button type="button" className="ed-btn is-primary" onClick={onSubmit} disabled={uploading || !file}>
            {uploading ? <><span className="ed-btn-spin" /> Uploading…</> : 'Upload'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const ACCESS_OPTIONS = [
  { value: 'none', label: 'No access' },
  { value: 'view', label: 'View' },
  { value: 'edit', label: 'Edit' },
  { value: 'full', label: 'Full access' },
];

function FolderFormModal({ modal, canManageAcl, aclEmployees, aclLoading, saving, onClose, onSubmit, onDelete }) {
  const isEdit = modal.mode === 'edit';
  const folder = modal.folder;
  const [name, setName] = useState(folder?.name || '');
  const [description, setDescription] = useState(folder?.description || '');
  const [levels, setLevels] = useState(() => (isEdit ? folderLevelMap(folder) : {}));
  const [q, setQ] = useState('');

  const subtitle = isEdit
    ? (folder?.name || 'Folder')
    : (modal.parentFolderId ? 'New subfolder' : 'Top-level folder');

  const grantedCount = Object.values(levels).filter((l) => l && l !== 'none').length;

  const filtered = (() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return aclEmployees;
    return aclEmployees.filter((e) => e.name.toLowerCase().includes(needle) || String(e.sub || '').toLowerCase().includes(needle));
  })();

  function setLevel(id, value) {
    setLevels((prev) => ({ ...prev, [id]: value }));
  }

  function submit() {
    onSubmit({ name, description, levels });
  }

  return createPortal(
    <div className="ed-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ed-modal">
        <div className="ed-modal-head">
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="ed-modal-eyebrow">{isEdit ? 'Manage' : 'Create'}</p>
            <h3 className="ed-modal-title">{isEdit ? 'Edit Folder' : 'New Folder'}</h3>
            <p className="ed-modal-sub">{subtitle}</p>
          </div>
          <button type="button" className="ed-modal-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="ed-modal-body">
          <div className="ed-field">
            <label className="ed-label" htmlFor="ed-folder-name">Folder name</label>
            <input
              id="ed-folder-name"
              type="text"
              className="ed-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Contracts"
              autoCapitalize="words"
            />
          </div>
          <div className="ed-field">
            <label className="ed-label" htmlFor="ed-folder-desc">Description (optional)</label>
            <textarea
              id="ed-folder-desc"
              className="ed-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this folder for?"
              rows={2}
            />
          </div>

          {canManageAcl && (
            <div className="ed-field">
              <label className="ed-label">Who can access {grantedCount > 0 ? `· ${grantedCount}` : ''}</label>
              <div className="ed-search ed-acl-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search people…"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              <p className="ed-acl-count">You always keep full access. Edit includes view; Full access adds delete.</p>
              {aclLoading ? (
                <div className="ed-acl-empty">Loading people…</div>
              ) : filtered.length === 0 ? (
                <div className="ed-acl-empty">{q ? 'No matching people.' : 'No people available to assign.'}</div>
              ) : (
                <div className="ed-acl-list">
                  {filtered.map((e) => (
                    <div key={e.id} className="ed-acl-row">
                      <div className="ed-acl-info">
                        <div className="ed-acl-name">{e.name}</div>
                        {e.sub ? <div className="ed-acl-sub">{e.sub}</div> : null}
                      </div>
                      <select
                        className="ed-acl-select"
                        value={levels[e.id] || 'none'}
                        onChange={(ev) => setLevel(e.id, ev.target.value)}
                      >
                        {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="ed-modal-foot">
          {isEdit && modal.canDelete && (
            <button type="button" className="ed-btn is-danger" onClick={() => onDelete(folder)} disabled={saving} aria-label="Delete folder">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
            </button>
          )}
          <button type="button" className="ed-btn is-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="ed-btn is-primary" onClick={submit} disabled={saving || !name.trim()}>
            {saving ? <><span className="ed-btn-spin" /> Saving…</> : (isEdit ? 'Save' : 'Create')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
