import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getUser, getUserGroup, USER_GROUPS } from '../../utils/auth';
import { getErrorMessage } from '../../utils/errorHandler';

// Admin / manager e-learning manager. Mirrors web ELearning.js admin slice on the
// real backend (routes/elearningRoutes.js):
//   GET    /elearning                          -> { data: [ material + completedCount/totalEmployees ] }
//   POST   /elearning/upload (multipart)       -> admin only (file, title, description)
//   DELETE /elearning/:id                      -> admin only (soft delete)
//   GET    /elearning/view/:id                 -> file blob (view / download)
//   GET    /elearning/completions/:id          -> admin completion roster
//   GET    /elearning/team-completions/:id     -> manager / hr team roster

const styles = `
  @keyframes el-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes el-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes el-spin { to { transform: rotate(360deg); } }
  @keyframes el-fadein { from { opacity: 0; } to { opacity: 1; } }

  .el-wrap { padding: 0.85rem 1rem 6rem; }
  .el-anim { animation: el-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  .el-header { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.25rem 0.85rem; }
  .el-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18); flex-shrink: 0;
  }
  .el-header-text { min-width: 0; flex: 1; }
  .el-header-eyebrow { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .el-header-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1; font-weight: 400; color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0; }
  .el-count { font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem; }
  .el-refresh-btn {
    flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 10px;
    border: 1px solid rgba(212, 221, 214, 0.7); background: #fff; color: #354f52;
    cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 0.15s, transform 0.12s;
  }
  .el-refresh-btn:active { background: #f1f4f0; transform: scale(0.95); }
  .el-refresh-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .el-refresh-btn.is-spinning svg { animation: el-spin 0.9s linear infinite; }

  .el-banner { margin-bottom: 0.85rem; padding: 0.6rem 0.85rem; border-radius: 12px; font-size: 0.78rem; font-weight: 500; }
  .el-banner.is-success { background: linear-gradient(135deg, #f0f5f2, #eaf2ec); border-left: 3px solid #52796f; color: #2f3e46; }
  .el-banner.is-error { background: linear-gradient(135deg, #fdf3f2, #fdecea); border-left: 3px solid #c0756a; color: #7a3028; }

  /* Upload call-to-action (admin) */
  .el-upload-cta {
    width: 100%; margin-bottom: 0.85rem; padding: 0.7rem 0.9rem; border-radius: 12px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5;
    font-family: 'DM Sans', sans-serif; font-size: 0.82rem; font-weight: 600; letter-spacing: 0.02em;
    display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;
    box-shadow: 0 3px 12px rgba(53,79,82,0.2); cursor: pointer; -webkit-tap-highlight-color: transparent; transition: transform 0.12s;
  }
  .el-upload-cta:active { transform: scale(0.98); }

  .el-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; margin-bottom: 0.85rem; }
  .el-stat { border: 1px solid rgba(212, 221, 214, 0.7); background: #fff; border-radius: 12px; padding: 0.6rem 0.5rem; text-align: center; box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04); }
  .el-stat-val { font-size: 1.15rem; font-weight: 700; color: #2f3e46; font-variant-numeric: tabular-nums; line-height: 1; }
  .el-stat-lab { margin-top: 4px; font-size: 0.56rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #84a98c; }
  .el-stat.is-accent .el-stat-val { color: #354f52; }

  .el-search-wrap { position: relative; margin-bottom: 0.85rem; }
  .el-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #84a98c; pointer-events: none; }
  .el-search-input {
    width: 100%; padding: 0.7rem 1rem 0.7rem 2.5rem;
    border: 1.5px solid #d4ddd6; border-radius: 12px;
    font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46; background: #fff; outline: none;
    transition: border-color 0.18s, box-shadow 0.18s; box-shadow: 0 1px 3px rgba(47, 62, 70, 0.04);
    -webkit-appearance: none; appearance: none; box-sizing: border-box;
  }
  .el-search-input:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }

  .el-list { display: flex; flex-direction: column; gap: 0.55rem; }
  .el-card {
    padding: 0.9rem 0.95rem; border-radius: 16px; background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
  }
  .el-card-head { display: flex; align-items: flex-start; gap: 0.7rem; margin-bottom: 0.65rem; }
  .el-tile {
    width: 44px; height: 44px; border-radius: 11px; flex-shrink: 0;
    background: linear-gradient(135deg, rgba(82,121,111,0.1), rgba(132,169,140,0.18));
    border: 1px solid rgba(82,121,111,0.18); color: #354f52;
    display: flex; align-items: center; justify-content: center;
  }
  .el-head-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .el-type-pill {
    font-size: 0.58rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 2px 8px; border-radius: 999px;
    background: rgba(82,121,111,0.12); color: #354f52; border: 1px solid rgba(82,121,111,0.22);
  }
  .el-card-title { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 1.15rem;
    color: #2f3e46; letter-spacing: -0.01em; line-height: 1.3; margin: 0 0 0.3rem;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .el-card-desc { font-size: 0.78rem; color: #52796f; line-height: 1.5; margin: 0 0 0.55rem;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .el-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; font-size: 0.68rem; color: #7a8e84; margin-bottom: 0.3rem; }
  .el-meta-dot { color: #b6c0b9; }
  .el-uploader { font-size: 0.66rem; color: #8fa99a; margin: 0 0 0.7rem; }
  .el-uploader strong { color: #52796f; font-weight: 500; }

  /* Completion stats block */
  .el-completion {
    margin-bottom: 0.7rem; padding: 0.65rem 0.75rem; border-radius: 11px;
    background: linear-gradient(135deg, #fafbfa, #f0f5f2); border: 1px solid #eaefeb;
  }
  .el-completion-top { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
  .el-completion-text { font-size: 0.72rem; font-weight: 500; color: #354f52; line-height: 1.4; }
  .el-completion-pct { font-size: 0.95rem; font-weight: 700; color: #2f3e46; font-variant-numeric: tabular-nums; }
  .el-completion-bar { height: 6px; border-radius: 999px; background: rgba(132,169,140,0.2); overflow: hidden; margin-bottom: 0.6rem; }
  .el-completion-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #52796f, #84a98c); transition: width 0.5s cubic-bezier(0.22,1,0.36,1); }
  .el-completion-btn {
    width: 100%; padding: 0.5rem 0.75rem; border-radius: 9px; border: 1px solid #d4ddd6; background: #fff; color: #354f52;
    font-family: 'DM Sans', sans-serif; font-size: 0.74rem; font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, transform 0.12s;
  }
  .el-completion-btn:active { background: #f1f4f0; transform: scale(0.98); }

  .el-actions { display: flex; align-items: center; gap: 0.4rem; }
  .el-btn {
    padding: 0.55rem 0.8rem; border-radius: 10px; font-size: 0.78rem; font-weight: 600;
    border: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
    display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; transition: transform 0.12s;
  }
  .el-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .el-btn:not(:disabled):active { transform: scale(0.97); }
  .el-btn.view { flex: 1; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; box-shadow: 0 3px 10px rgba(53,79,82,0.2); }
  .el-btn.icon { flex-shrink: 0; width: 38px; padding: 0.55rem 0; }
  .el-btn.download { background: #f1f4f0; color: #52796f; border: 1px solid #d4ddd6; }
  .el-btn.danger { background: rgba(192,117,106,0.1); color: #b85c50; border: 1px solid rgba(192,117,106,0.22); }

  .el-mini-spin { width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent;
    border-radius: 50%; animation: el-spin 0.7s linear infinite; }

  .el-skel { height: 150px; border-radius: 16px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%); animation: el-skel 1.2s ease-in-out infinite; margin-bottom: 0.55rem; }
  .el-empty, .el-error {
    padding: 2.5rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .el-error { border-color: rgba(192, 117, 106, 0.4); color: #7a3028; background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55); }
  .el-empty-glyph { width: 48px; height: 48px; margin: 0 auto 0.7rem; border-radius: 14px; background: rgba(132, 169, 140, 0.14); display: flex; align-items: center; justify-content: center; color: #52796f; }
  .el-empty-title, .el-error-title { font-size: 0.9rem; font-weight: 600; margin: 0; }
  .el-empty-sub, .el-error-sub { font-size: 0.76rem; margin: 0.3rem 0 0; opacity: 0.85; }
  .el-retry { margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .el-retry:active { transform: scale(0.97); }

  /* ── Modal (upload + completions) ── */
  .el-modal-overlay { position: fixed; inset: 0; z-index: 70; background: rgba(47,62,70,0.6);
    display: flex; align-items: flex-end; justify-content: center; animation: el-fadein 0.2s ease both;
    padding-bottom: env(safe-area-inset-bottom, 0px); }
  .el-modal { background: #fff; width: 100%; max-width: 560px; max-height: 92vh; border-radius: 18px 18px 0 0;
    display: flex; flex-direction: column; overflow: hidden; animation: el-fadeUp 0.28s cubic-bezier(0.22,1,0.36,1) both; }
  .el-modal-head { display: flex; align-items: flex-start; gap: 0.8rem; padding: 1.05rem 1.15rem 0.85rem; border-bottom: 1px solid #eaefeb; flex-shrink: 0; }
  .el-modal-head-text { min-width: 0; flex: 1; }
  .el-modal-eyebrow { font-size: 0.58rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .el-modal-title { font-family: 'Cormorant Garamond', serif; font-size: 1.25rem; font-weight: 500; color: #2f3e46; margin: 0.1rem 0 0; line-height: 1.2; }
  .el-modal-sub { font-size: 0.72rem; color: #52796f; margin: 0.2rem 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .el-modal-close { flex-shrink: 0; width: 32px; height: 32px; border-radius: 9px; border: none; background: #f1f4f0; color: #52796f;
    display: flex; align-items: center; justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .el-modal-close:active { transform: scale(0.94); }
  .el-modal-body { padding: 1.05rem 1.15rem; overflow-y: auto; -webkit-overflow-scrolling: touch; flex: 1; }
  .el-modal-foot { display: flex; gap: 0.5rem; padding: 0.85rem 1.15rem calc(0.85rem + env(safe-area-inset-bottom, 0px)); border-top: 1px solid #eaefeb; background: #fafbfa; flex-shrink: 0; }
  .el-modal-foot .el-btn { flex: 1; }
  .el-btn.secondary { background: #fff; color: #354f52; border: 1px solid #d4ddd6; }
  .el-btn.primary { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; }

  .el-field { margin-bottom: 0.95rem; }
  .el-field:last-child { margin-bottom: 0; }
  .el-label { display: block; font-size: 0.62rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #52796f; margin-bottom: 0.4rem; }
  .el-req { color: #b85c50; margin-left: 0.15rem; }
  .el-input, .el-textarea, .el-file {
    width: 100%; padding: 0.6rem 0.85rem; border: 1.5px solid #d4ddd6; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46; background: #fff; outline: none;
    transition: border-color 0.18s, box-shadow 0.18s; box-sizing: border-box;
  }
  .el-input:focus, .el-textarea:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }
  .el-textarea { min-height: 78px; resize: vertical; }
  .el-file { padding: 0; background: #fafbfa; overflow: hidden; }
  .el-file::file-selector-button { padding: 0.6rem 0.85rem; margin-right: 0.7rem; border: none;
    background: linear-gradient(135deg, #f0f5f2, #eaf2ec); color: #354f52; font-family: 'DM Sans', sans-serif;
    font-size: 0.78rem; font-weight: 600; cursor: pointer; border-right: 1.5px solid #d4ddd6; }
  .el-hint { font-size: 0.66rem; color: #8fa99a; margin-top: 0.4rem; }
  .el-file-note { margin-top: 0.55rem; padding: 0.5rem 0.75rem; border-radius: 9px; background: rgba(132,169,140,0.1);
    border: 1px solid rgba(132,169,140,0.22); font-size: 0.72rem; color: #354f52; }
  .el-file-note strong { font-weight: 600; color: #2f3e46; }

  /* Completions list (rows) */
  .el-comp-summary { display: flex; align-items: center; justify-content: space-between; gap: 0.7rem; margin-bottom: 0.85rem; flex-wrap: wrap; }
  .el-comp-summary-text { font-size: 0.76rem; color: #52796f; font-weight: 500; }
  .el-comp-summary-text strong { color: #2f3e46; font-weight: 700; }
  .el-comp-export { padding: 0.45rem 0.75rem; border-radius: 9px; border: none; background: linear-gradient(135deg, #52796f, #6b8e7f); color: #fff;
    font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.3rem;
    cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .el-comp-export:disabled { opacity: 0.5; cursor: not-allowed; }
  .el-comp-rows { display: flex; flex-direction: column; gap: 0.45rem; }
  .el-comp-row { display: flex; align-items: center; gap: 0.65rem; padding: 0.6rem 0.7rem; border-radius: 11px; border: 1px solid #eaefeb; background: #fff; }
  .el-comp-avatar { width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0; background: rgba(82,121,111,0.14); color: #354f52;
    display: flex; align-items: center; justify-content: center; font-size: 0.74rem; font-weight: 700; }
  .el-comp-main { min-width: 0; flex: 1; }
  .el-comp-name { font-size: 0.82rem; font-weight: 600; color: #2f3e46; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .el-comp-sub { font-size: 0.66rem; color: #8fa99a; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .el-comp-status { flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.62rem; font-weight: 700;
    padding: 3px 8px; border-radius: 999px; }
  .el-comp-status.is-done { background: rgba(82,121,111,0.14); color: #2f4a32; border: 1px solid rgba(82,121,111,0.25); }
  .el-comp-status.is-pending { background: #f1f4f0; color: #7a8e84; border: 1px solid #e0e6e1; }
  .el-comp-center { padding: 2.5rem 1rem; text-align: center; color: #7a8e84; }
  .el-comp-spin { width: 30px; height: 30px; margin: 0 auto 0.7rem; border: 3px solid rgba(82,121,111,0.2); border-top-color: #52796f; border-radius: 50%; animation: el-spin 0.8s linear infinite; }

  /* ── Viewer overlay ── */
  .el-viewer { position: fixed; inset: 0; z-index: 80; background: #2f3e46; display: flex; flex-direction: column; animation: el-fadein 0.2s ease both; }
  .el-viewer-bar { flex-shrink: 0; display: flex; align-items: center; gap: 0.6rem;
    padding: calc(0.6rem + env(safe-area-inset-top, 0px)) 0.85rem 0.6rem;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #f0f5f2; }
  .el-viewer-title { flex: 1; min-width: 0; font-size: 0.88rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .el-viewer-btn { background: rgba(255,255,255,0.15); border: none; color: #f0f5f2; width: 32px; height: 32px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent; flex-shrink: 0; }
  .el-viewer-btn:active { transform: scale(0.94); }
  .el-viewer-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .el-viewer-body { flex: 1; min-height: 0; position: relative; background: #525659; }
  .el-viewer-frame { width: 100%; height: 100%; border: none; }
  .el-viewer-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.8rem; color: #cad2c5; padding: 1.5rem; text-align: center; }
  .el-viewer-spin { width: 34px; height: 34px; border: 3px solid rgba(202,210,197,0.25); border-top-color: #cad2c5; border-radius: 50%; animation: el-spin 0.8s linear infinite; }
  .el-viewer-fallback-btn { margin-top: 0.5rem; padding: 0.6rem 1.1rem; border-radius: 999px; border: none; background: #cad2c5; color: #2f3e46; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
  .el-viewer-fallback-btn:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const MIME_EXT = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
};

function getFileType(mimeType) {
  if (!mimeType) return 'FILE';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('presentation')) return 'PPTX';
  if (mimeType.includes('powerpoint')) return 'PPT';
  if (mimeType.includes('wordprocessingml')) return 'DOCX';
  if (mimeType.includes('msword')) return 'DOC';
  return 'FILE';
}

function buildFileName(material) {
  const base = (material?.name || material?.title || 'material').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'material';
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
  const ext = MIME_EXT[material?.mimeType] || '';
  return ext ? `${base}.${ext}` : base;
}

function formatFileSize(bytes) {
  if (!bytes) return null;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function BookIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 6.25v13M12 6.25C10.83 5.48 9.25 5 7.5 5S4.17 5.48 3 6.25v13C4.17 18.48 5.75 18 7.5 18s3.33.48 4.5 1.25M12 6.25C13.17 5.48 14.75 5 16.5 5S19.83 5.48 21 6.25v13C19.83 18.48 18.25 18 16.5 18s-3.33.48-4.5 1.25" />
    </svg>
  );
}

function DownloadIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

function TrashIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

export default function ELearning() {
  const [group, setGroup] = useState(null); // 'admin' | 'manager' | 'employee'
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [banner, setBanner] = useState(null);
  const [query, setQuery] = useState('');

  const [viewer, setViewer] = useState(null); // { material, url, loading, failed }
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Upload modal (admin)
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ file: null, title: '', description: '' });
  const [uploading, setUploading] = useState(false);

  // Completions modal
  const [compMaterial, setCompMaterial] = useState(null);
  const [completions, setCompletions] = useState([]);
  const [completionsLoading, setCompletionsLoading] = useState(false);
  const [compQuery, setCompQuery] = useState('');

  const isAdmin = group === USER_GROUPS.ADMIN;
  const isManager = group === USER_GROUPS.MANAGER;

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 2800);
  }

  useEffect(() => {
    (async () => {
      const user = await getUser();
      setGroup(getUserGroup(user));
    })();
  }, []);

  async function fetchMaterials() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/elearning');
      setMaterials(data?.data || (Array.isArray(data) ? data : []));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchMaterials(); }, []);

  // Revoke any object URL when the viewer closes / unmounts.
  useEffect(() => () => { if (viewer?.url) URL.revokeObjectURL(viewer.url); }, [viewer?.url]);

  const stats = useMemo(() => {
    let totalCompleted = 0;
    let totalPossible = 0;
    for (const m of materials) {
      totalCompleted += Number(m.completedCount || 0);
      totalPossible += Number(m.totalEmployees || 0);
    }
    return {
      courses: materials.length,
      avgCompletion: totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0,
      completions: totalCompleted,
    };
  }, [materials]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((m) => {
      const hay = [m.name, m.title, m.description].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [materials, query]);

  // ── Viewer ──
  async function openViewer(material) {
    setViewer({ material, url: null, loading: true, failed: false });
    try {
      const res = await api.get(`/elearning/view/${material._id}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: material.mimeType || 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setViewer({ material, url, loading: false, failed: false });
    } catch {
      setViewer({ material, url: null, loading: false, failed: true });
    }
  }

  function closeViewer() {
    if (viewer?.url) URL.revokeObjectURL(viewer.url);
    setViewer(null);
  }

  async function downloadMaterial(material, existingUrl) {
    setDownloadingId(material._id);
    let url = existingUrl;
    let createdHere = false;
    try {
      if (!url) {
        const res = await api.get(`/elearning/view/${material._id}`, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: material.mimeType || 'application/octet-stream' });
        url = URL.createObjectURL(blob);
        createdHere = true;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = buildFileName(material);
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      if (createdHere && url) setTimeout(() => URL.revokeObjectURL(url), 1500);
      setDownloadingId(null);
    }
  }

  // ── Delete (admin) ──
  async function handleDelete(material) {
    if (!window.confirm(`Delete “${material.name || material.title || 'this material'}”? This can’t be undone.`)) return;
    setDeletingId(material._id);
    try {
      await api.delete(`/elearning/${material._id}`);
      setMaterials((prev) => prev.filter((m) => m._id !== material._id));
      flash('success', 'Material deleted');
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  // ── Upload (admin) ──
  function closeUpload() {
    setShowUpload(false);
    setUploadForm({ file: null, title: '', description: '' });
  }

  async function handleUpload() {
    if (!uploadForm.file || !uploadForm.title.trim()) {
      flash('error', 'Please provide a title and select a file');
      return;
    }
    if (uploadForm.file.size > 15 * 1024 * 1024) {
      flash('error', 'File is too large. Max size is 15MB.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadForm.file);
      fd.append('title', uploadForm.title.trim());
      if (uploadForm.description.trim()) fd.append('description', uploadForm.description.trim());
      await api.post('/elearning/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      closeUpload();
      flash('success', 'Material uploaded');
      fetchMaterials();
    } catch (err) {
      flash('error', getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  // ── Completions ──
  async function openCompletions(material) {
    setCompMaterial(material);
    setCompletions([]);
    setCompQuery('');
    setCompletionsLoading(true);
    try {
      const path = isManager
        ? `/elearning/team-completions/${material._id}`
        : `/elearning/completions/${material._id}`;
      const { data } = await api.get(path);
      const rows = data?.data || [];
      // Admin endpoint returns only completed rows; normalise a completed flag.
      setCompletions(isManager ? rows : rows.map((r) => ({ ...r, completed: true })));
    } catch (err) {
      flash('error', getErrorMessage(err));
      setCompMaterial(null);
    } finally {
      setCompletionsLoading(false);
    }
  }

  function closeCompletions() {
    setCompMaterial(null);
    setCompletions([]);
    setCompQuery('');
  }

  const filteredCompletions = useMemo(() => {
    const q = compQuery.trim().toLowerCase();
    if (!q) return completions;
    return completions.filter((c) =>
      String(c.employeeName || '').toLowerCase().includes(q) ||
      String(c.employeeId || '').toLowerCase().includes(q)
    );
  }, [completions, compQuery]);

  function exportCompletionsCSV() {
    if (!completions.length) return;
    const headers = ['Employee ID', 'Name', 'Department', 'Status', 'Completed Date'];
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = completions.map((c) => [
      c.employeeId || 'N/A',
      c.employeeName || 'Unknown',
      c.department || 'N/A',
      c.completed ? 'Completed' : 'Not completed',
      c.completedDate ? new Date(c.completedDate).toLocaleDateString('en-GB') : '-',
    ].map(escape).join(','));
    const csv = [headers.map(escape).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(compMaterial?.name || 'material').replace(/[\\/:*?"<>|]+/g, '_')}-completions.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return (
    <>
      <style>{styles}</style>
      <div className="el-wrap">
        <header className="el-header el-anim">
          <div className="el-header-icon"><BookIcon /></div>
          <div className="el-header-text">
            <p className="el-header-eyebrow">{isManager ? 'Team' : 'Manage'}</p>
            <h1 className="el-header-title">
              E-Learning
              {!loading && !error && <span className="el-count"> · {filtered.length}</span>}
            </h1>
          </div>
          <button
            type="button"
            className={`el-refresh-btn${loading ? ' is-spinning' : ''}`}
            onClick={fetchMaterials}
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
          <div className={`el-banner ${banner.kind === 'success' ? 'is-success' : 'is-error'} el-anim`}>
            {banner.text}
          </div>
        )}

        {isAdmin && (
          <button type="button" className="el-upload-cta el-anim" onClick={() => setShowUpload(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Upload Material
          </button>
        )}

        {isAdmin && !loading && !error && materials.length > 0 && (
          <div className="el-stats el-anim">
            <div className="el-stat">
              <div className="el-stat-val">{stats.courses}</div>
              <div className="el-stat-lab">Materials</div>
            </div>
            <div className="el-stat is-accent">
              <div className="el-stat-val">{stats.avgCompletion}%</div>
              <div className="el-stat-lab">Avg complete</div>
            </div>
            <div className="el-stat">
              <div className="el-stat-val">{stats.completions}</div>
              <div className="el-stat-lab">Completions</div>
            </div>
          </div>
        )}

        <div className="el-search-wrap el-anim">
          <span className="el-search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            className="el-search-input"
            placeholder="Search materials…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>

        {loading ? (
          <div>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="el-skel" />)}</div>
        ) : error ? (
          <div className="el-error el-anim">
            <p className="el-error-title">Couldn't load materials</p>
            <p className="el-error-sub">{error}</p>
            <button className="el-retry" onClick={fetchMaterials}>Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="el-empty el-anim">
            <div className="el-empty-glyph"><BookIcon size={24} /></div>
            <p className="el-empty-title">{query ? 'No matches' : 'No materials yet'}</p>
            <p className="el-empty-sub">
              {query
                ? 'Try a different search term.'
                : isAdmin
                  ? 'Upload your first training material to get started.'
                  : 'Training materials will appear here once published.'}
            </p>
          </div>
        ) : (
          <div className="el-list">
            {filtered.map((m) => {
              const size = formatFileSize(m.fileSize);
              const date = formatDate(m.createdAt);
              const total = Number(m.totalEmployees || 0);
              const done = Number(m.completedCount || 0);
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const isDeleting = deletingId === m._id;
              const isDownloading = downloadingId === m._id;
              return (
                <div key={m._id} className="el-card el-anim">
                  <div className="el-card-head">
                    <div className="el-tile"><BookIcon size={22} /></div>
                    <div className="el-head-right">
                      <span className="el-type-pill">{getFileType(m.mimeType)}</span>
                    </div>
                  </div>

                  <h3 className="el-card-title">{m.name || m.title || 'Untitled material'}</h3>
                  {m.description && <p className="el-card-desc">{m.description}</p>}

                  {(size || date) && (
                    <div className="el-meta">
                      {size && <span>{size}</span>}
                      {size && date && <span className="el-meta-dot">·</span>}
                      {date && <span>{date}</span>}
                    </div>
                  )}
                  {m.uploadedBy && (m.uploadedBy.firstName || m.uploadedBy.lastName) && (
                    <p className="el-uploader">
                      Uploaded by <strong>{[m.uploadedBy.firstName, m.uploadedBy.lastName].filter(Boolean).join(' ')}</strong>
                    </p>
                  )}

                  {(isAdmin || isManager) && (
                    <div className="el-completion">
                      <div className="el-completion-top">
                        <span className="el-completion-text">
                          {isAdmin
                            ? `${done} of ${total} employees completed`
                            : 'View completion status for your team'}
                        </span>
                        {isAdmin && total > 0 && <span className="el-completion-pct">{pct}%</span>}
                      </div>
                      {isAdmin && (
                        <div className="el-completion-bar">
                          <div className="el-completion-fill" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      <button type="button" className="el-completion-btn" onClick={() => openCompletions(m)}>
                        {isAdmin ? 'View Completions' : 'View Team Status'}
                      </button>
                    </div>
                  )}

                  <div className="el-actions">
                    <button type="button" className="el-btn view" onClick={() => openViewer(m)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      View
                    </button>
                    <button
                      type="button"
                      className="el-btn icon download"
                      onClick={() => downloadMaterial(m)}
                      disabled={isDownloading}
                      aria-label="Download material"
                    >
                      {isDownloading ? <span className="el-mini-spin" /> : <DownloadIcon />}
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        className="el-btn icon danger"
                        onClick={() => handleDelete(m)}
                        disabled={isDeleting}
                        aria-label="Delete material"
                      >
                        {isDeleting ? <span className="el-mini-spin" /> : <TrashIcon />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Upload modal (admin) ── */}
      {showUpload && (
        <div className="el-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !uploading) closeUpload(); }}>
          <div className="el-modal">
            <div className="el-modal-head">
              <div className="el-modal-head-text">
                <p className="el-modal-eyebrow">Add Resource</p>
                <h2 className="el-modal-title">Upload Material</h2>
              </div>
              <button type="button" className="el-modal-close" onClick={closeUpload} disabled={uploading} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="el-modal-body">
              <div className="el-field">
                <label className="el-label">Title <span className="el-req">*</span></label>
                <input
                  type="text"
                  className="el-input"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Enter material title"
                />
              </div>
              <div className="el-field">
                <label className="el-label">Description</label>
                <textarea
                  className="el-textarea"
                  rows={3}
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description…"
                />
              </div>
              <div className="el-field">
                <label className="el-label">File <span className="el-req">*</span></label>
                <input
                  type="file"
                  className="el-file"
                  accept=".pdf,.ppt,.pptx,.doc,.docx"
                  onChange={(e) => setUploadForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
                />
                <p className="el-hint">PDF, PPT, PPTX, DOC or DOCX · Max 15 MB</p>
                {uploadForm.file && (
                  <div className="el-file-note">
                    <strong>{uploadForm.file.name}</strong>
                    {formatFileSize(uploadForm.file.size) ? ` · ${formatFileSize(uploadForm.file.size)}` : ''}
                  </div>
                )}
              </div>
            </div>
            <div className="el-modal-foot">
              <button type="button" className="el-btn secondary" onClick={closeUpload} disabled={uploading}>Cancel</button>
              <button
                type="button"
                className="el-btn primary"
                onClick={handleUpload}
                disabled={uploading || !uploadForm.file || !uploadForm.title.trim()}
              >
                {uploading ? <><span className="el-mini-spin" /> Uploading…</> : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Completions modal ── */}
      {compMaterial && (
        <div className="el-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeCompletions(); }}>
          <div className="el-modal">
            <div className="el-modal-head">
              <div className="el-modal-head-text">
                <p className="el-modal-eyebrow">{isManager ? 'Team Status' : 'Completion Records'}</p>
                <h2 className="el-modal-title">Completions</h2>
                <p className="el-modal-sub">{compMaterial.name || compMaterial.title}</p>
              </div>
              <button type="button" className="el-modal-close" onClick={closeCompletions} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="el-modal-body">
              <div className="el-comp-summary">
                <span className="el-comp-summary-text">
                  {isManager ? (
                    <><strong>{completions.filter((c) => c.completed).length}</strong> of <strong>{completions.length}</strong> team members completed</>
                  ) : (
                    <><strong>{completions.length}</strong> completion{completions.length !== 1 ? 's' : ''} recorded</>
                  )}
                </span>
                <button type="button" className="el-comp-export" onClick={exportCompletionsCSV} disabled={completions.length === 0}>
                  <DownloadIcon size={12} /> Export CSV
                </button>
              </div>

              {completions.length > 0 && (
                <div className="el-search-wrap">
                  <span className="el-search-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M21 21l-4.3-4.3" />
                    </svg>
                  </span>
                  <input
                    type="search"
                    className="el-search-input"
                    placeholder="Search by name or ID…"
                    value={compQuery}
                    onChange={(e) => setCompQuery(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
              )}

              {completionsLoading ? (
                <div className="el-comp-center">
                  <div className="el-comp-spin" />
                  <span>Loading completions…</span>
                </div>
              ) : filteredCompletions.length === 0 ? (
                <div className="el-comp-center">
                  {compQuery
                    ? 'No matching records.'
                    : isManager
                      ? 'No team members found for this material.'
                      : 'No employees have completed this material yet.'}
                </div>
              ) : (
                <div className="el-comp-rows">
                  {filteredCompletions.map((c, idx) => {
                    const done = Boolean(c.completed);
                    return (
                      <div key={c._id || idx} className="el-comp-row">
                        <div className="el-comp-avatar">{initials(c.employeeName)}</div>
                        <div className="el-comp-main">
                          <div className="el-comp-name">{c.employeeName || 'Unknown'}</div>
                          <div className="el-comp-sub">
                            {[c.employeeId, c.department].filter((v) => v && v !== 'N/A').join(' · ') ||
                              (done && c.completedDate ? new Date(c.completedDate).toLocaleDateString('en-GB') : '')}
                          </div>
                        </div>
                        <span className={`el-comp-status ${done ? 'is-done' : 'is-pending'}`}>
                          {done ? 'Completed' : 'Pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Viewer overlay ── */}
      {viewer && (
        <div className="el-viewer">
          <div className="el-viewer-bar">
            <span className="el-viewer-title">{viewer.material?.name || viewer.material?.title || 'Material'}</span>
            <button
              type="button"
              className="el-viewer-btn"
              onClick={() => downloadMaterial(viewer.material, viewer.url)}
              disabled={downloadingId === viewer.material?._id}
              aria-label="Download material"
            >
              {downloadingId === viewer.material?._id ? <span className="el-mini-spin" /> : <DownloadIcon size={18} />}
            </button>
            <button type="button" className="el-viewer-btn" onClick={closeViewer} aria-label="Close viewer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="el-viewer-body">
            {viewer.loading ? (
              <div className="el-viewer-center">
                <div className="el-viewer-spin" />
                <span>Opening material…</span>
              </div>
            ) : viewer.failed ? (
              <div className="el-viewer-center">
                <span>Couldn’t preview this material on your device.</span>
                <button
                  type="button"
                  className="el-viewer-fallback-btn"
                  onClick={() => downloadMaterial(viewer.material)}
                  disabled={downloadingId === viewer.material?._id}
                >
                  {downloadingId === viewer.material?._id ? 'Downloading…' : 'Download to open'}
                </button>
                <button type="button" className="el-viewer-fallback-btn" onClick={() => openViewer(viewer.material)}>
                  Try again
                </button>
              </div>
            ) : (
              <iframe className="el-viewer-frame" src={viewer.url} title={viewer.material?.name || 'Material'} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
