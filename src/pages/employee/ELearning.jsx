import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getUser } from '../../utils/auth';
import { getErrorMessage } from '../../utils/errorHandler';

// Mirrors web ELearning.js (employee slice only — no upload / admin tables):
//   GET  /elearning                 -> { data: [ { _id, name, description,
//                                         mimeType, fileSize, createdAt,
//                                         uploadedBy, completed } ] }
//   POST /elearning/complete        -> { materialId, employeeId, completedDate }
//   GET  /elearning/view/:id        -> PDF blob (auth via api interceptor)

const styles = `
  @keyframes elr-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes elr-skel   { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes elr-spin   { to { transform: rotate(360deg); } }
  @keyframes elr-fadein { from { opacity: 0; } to { opacity: 1; } }
  @keyframes elr-slide  { from { transform: translateY(100%); } to { transform: translateY(0); } }

  .elr-wrap { padding: 0.85rem 1rem 6rem; }
  .elr-anim { animation: elr-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header ── */
  .elr-header { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.25rem 0.85rem; }
  .elr-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18); flex-shrink: 0;
  }
  .elr-header-text { min-width: 0; flex: 1; }
  .elr-header-eyebrow { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .elr-header-title {
    font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1;
    font-weight: 400; color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0;
  }
  .elr-refresh {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
    border: 1.5px solid #d4ddd6; background: #fff; color: #52796f;
    display: flex; align-items: center; justify-content: center;
    -webkit-tap-highlight-color: transparent; cursor: pointer; transition: background 0.15s;
  }
  .elr-refresh:active { transform: scale(0.95); background: #f1f4f0; }
  .elr-refresh.is-loading svg { animation: elr-spin 0.9s linear infinite; }

  /* ── Progress summary ── */
  .elr-progress {
    background: #fff; border: 1px solid rgba(212,221,214,0.7); border-radius: 16px;
    padding: 0.85rem 1rem; margin-bottom: 0.85rem; box-shadow: 0 1px 2px rgba(47,62,70,0.04);
  }
  .elr-progress-top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 0.55rem; }
  .elr-progress-label { font-size: 0.78rem; font-weight: 600; color: #2f3e46; }
  .elr-progress-count { font-size: 0.74rem; font-weight: 600; color: #52796f; font-variant-numeric: tabular-nums; }
  .elr-bar { height: 8px; border-radius: 999px; background: #eef2ef; overflow: hidden; }
  .elr-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #52796f, #84a98c);
    transition: width 0.5s cubic-bezier(0.22,1,0.36,1); }

  /* ── Material card ── */
  .elr-card {
    background: #fff; border: 1px solid rgba(212,221,214,0.7); border-radius: 16px;
    padding: 0.9rem 0.95rem; margin-bottom: 0.55rem; box-shadow: 0 1px 2px rgba(47,62,70,0.04);
  }
  .elr-card-head { display: flex; align-items: flex-start; gap: 0.7rem; margin-bottom: 0.65rem; }
  .elr-tile {
    width: 44px; height: 44px; border-radius: 11px; flex-shrink: 0;
    background: linear-gradient(135deg, rgba(82,121,111,0.1), rgba(132,169,140,0.18));
    border: 1px solid rgba(82,121,111,0.18); color: #354f52;
    display: flex; align-items: center; justify-content: center;
  }
  .elr-head-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .elr-type-pill {
    font-size: 0.58rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 2px 8px; border-radius: 999px;
    background: rgba(82,121,111,0.12); color: #354f52; border: 1px solid rgba(82,121,111,0.22);
  }
  .elr-done-tag {
    display: inline-flex; align-items: center; gap: 0.25rem;
    font-size: 0.58rem; font-weight: 700; letter-spacing: 0.05em;
    padding: 2px 8px; border-radius: 999px;
    background: rgba(76,140,82,0.16); color: #2f6e34; border: 1px solid rgba(76,140,82,0.28);
  }
  .elr-title { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 1.15rem;
    color: #2f3e46; letter-spacing: -0.01em; line-height: 1.3; margin: 0 0 0.3rem;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .elr-desc { font-size: 0.78rem; color: #52796f; line-height: 1.5; margin: 0 0 0.55rem;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .elr-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; font-size: 0.68rem; color: #7a8e84; margin-bottom: 0.3rem; }
  .elr-meta-dot { color: #b6c0b9; }
  .elr-uploader { font-size: 0.66rem; color: #8fa99a; margin: 0 0 0.75rem; }
  .elr-uploader strong { color: #52796f; font-weight: 500; }

  .elr-actions { display: flex; align-items: center; gap: 0.4rem; }
  .elr-btn {
    padding: 0.55rem 0.8rem; border-radius: 10px; font-size: 0.78rem; font-weight: 600;
    border: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
    display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; transition: transform 0.12s;
  }
  .elr-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .elr-btn:not(:disabled):active { transform: scale(0.97); }
  .elr-btn.view { flex: 1; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; box-shadow: 0 3px 10px rgba(53,79,82,0.2); }
  .elr-btn.complete { flex-shrink: 0; background: linear-gradient(135deg, #4c8c52, #6b8e7f); color: #fff; }
  .elr-btn.done { flex-shrink: 0; background: #f1f4f0; color: #7a8e84; }

  .elr-mini-spin { width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent;
    border-radius: 50%; animation: elr-spin 0.7s linear infinite; }

  /* ── States ── */
  .elr-skel { height: 150px; border-radius: 16px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: elr-skel 1.2s ease-in-out infinite; margin-bottom: 0.55rem; }
  .elr-empty, .elr-error {
    padding: 2.5rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .elr-error { border-color: rgba(192, 117, 106, 0.4); color: #7a3028;
    background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55); }
  .elr-empty-glyph { width: 48px; height: 48px; margin: 0 auto 0.7rem; border-radius: 14px; background: rgba(132, 169, 140, 0.14);
    display: flex; align-items: center; justify-content: center; color: #52796f; }
  .elr-empty-title, .elr-error-title { font-size: 0.9rem; font-weight: 600; margin: 0; }
  .elr-empty-sub, .elr-error-sub { font-size: 0.76rem; margin: 0.3rem 0 0; opacity: 0.85; }
  .elr-retry { margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .elr-retry:active { transform: scale(0.97); }

  .elr-banner { margin-bottom: 0.85rem; padding: 0.6rem 0.85rem; border-radius: 12px; font-size: 0.78rem; font-weight: 500; }
  .elr-banner.is-success { background: linear-gradient(135deg, #f0f5f2, #eaf2ec); border-left: 3px solid #52796f; color: #2f3e46; }
  .elr-banner.is-error { background: linear-gradient(135deg, #fdf3f2, #fdecea); border-left: 3px solid #c0756a; color: #7a3028; }

  /* ── PDF viewer overlay ── */
  .elr-viewer { position: fixed; inset: 0; z-index: 60; background: #2f3e46;
    display: flex; flex-direction: column; animation: elr-fadein 0.2s ease both; }
  .elr-viewer-bar {
    flex-shrink: 0; display: flex; align-items: center; gap: 0.6rem;
    padding: calc(0.6rem + env(safe-area-inset-top, 0px)) 0.85rem 0.6rem;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #f0f5f2;
  }
  .elr-viewer-title { flex: 1; min-width: 0; font-size: 0.88rem; font-weight: 600;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .elr-viewer-close { background: rgba(255,255,255,0.15); border: none; color: #f0f5f2;
    width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center;
    cursor: pointer; -webkit-tap-highlight-color: transparent; flex-shrink: 0; }
  .elr-viewer-close:active { transform: scale(0.94); }
  .elr-viewer-body { flex: 1; min-height: 0; position: relative; background: #525659; }
  .elr-viewer-frame { width: 100%; height: 100%; border: none; }
  .elr-viewer-center { position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 0.8rem; color: #cad2c5; padding: 1.5rem; text-align: center; }
  .elr-viewer-spin { width: 34px; height: 34px; border: 3px solid rgba(202,210,197,0.25);
    border-top-color: #cad2c5; border-radius: 50%; animation: elr-spin 0.8s linear infinite; }
  .elr-viewer-fallback-btn { margin-top: 0.5rem; padding: 0.6rem 1.1rem; border-radius: 999px; border: none;
    background: #cad2c5; color: #2f3e46; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
`;

function getFileType(mimeType) {
  if (!mimeType) return 'FILE';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('presentation')) return 'PPTX';
  if (mimeType.includes('powerpoint')) return 'PPT';
  if (mimeType.includes('wordprocessingml')) return 'DOCX';
  if (mimeType.includes('msword')) return 'DOC';
  return 'FILE';
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

function CheckIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function ELearning() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [banner, setBanner] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [viewer, setViewer] = useState(null); // { material, url, loading, failed }

  function flash(kind, text) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 2800);
  }

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

  const { done, total, pct } = useMemo(() => {
    const t = materials.length;
    const d = materials.filter((m) => m.completed).length;
    return { done: d, total: t, pct: t > 0 ? Math.round((d / t) * 100) : 0 };
  }, [materials]);

  async function markComplete(material) {
    if (!window.confirm('Mark this course as completed? This can’t be undone.')) return;
    setCompletingId(material._id);
    try {
      const user = await getUser();
      const employeeId = user?.employeeHubId || user?._id || user?.id;
      await api.post('/elearning/complete', {
        materialId: material._id,
        employeeId,
        completedDate: new Date().toISOString(),
      });
      setMaterials((prev) => prev.map((m) => (m._id === material._id ? { ...m, completed: true } : m)));
      flash('success', 'Course marked complete');
    } catch (err) {
      if (err?.response?.status === 409) {
        setMaterials((prev) => prev.map((m) => (m._id === material._id ? { ...m, completed: true } : m)));
        flash('success', 'Already completed');
      } else {
        flash('error', getErrorMessage(err));
      }
    } finally {
      setCompletingId(null);
    }
  }

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

  return (
    <>
      <style>{styles}</style>
      <div className="elr-wrap">
        <header className="elr-header elr-anim">
          <div className="elr-header-icon"><BookIcon /></div>
          <div className="elr-header-text">
            <p className="elr-header-eyebrow">Learn &amp; Develop</p>
            <h1 className="elr-header-title">E-Learning</h1>
          </div>
          <button
            type="button"
            className={`elr-refresh${loading ? ' is-loading' : ''}`}
            onClick={fetchMaterials}
            disabled={loading}
            aria-label="Refresh materials"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 2v6h-6M3 22v-6h6" />
              <path d="M3.5 9a9 9 0 0 1 14.85-3.36L21 8M20.5 15a9 9 0 0 1-14.85 3.36L3 16" />
            </svg>
          </button>
        </header>

        {banner && (
          <div className={`elr-banner ${banner.kind === 'success' ? 'is-success' : 'is-error'} elr-anim`}>
            {banner.text}
          </div>
        )}

        {!loading && !error && total > 0 && (
          <div className="elr-progress elr-anim">
            <div className="elr-progress-top">
              <span className="elr-progress-label">Your progress</span>
              <span className="elr-progress-count">{done} / {total} completed</span>
            </div>
            <div className="elr-bar"><div className="elr-bar-fill" style={{ width: `${pct}%` }} /></div>
          </div>
        )}

        {loading ? (
          <div>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="elr-skel" />)}</div>
        ) : error ? (
          <div className="elr-error elr-anim">
            <p className="elr-error-title">Couldn't load materials</p>
            <p className="elr-error-sub">{error}</p>
            <button className="elr-retry" onClick={fetchMaterials}>Try again</button>
          </div>
        ) : materials.length === 0 ? (
          <div className="elr-empty elr-anim">
            <div className="elr-empty-glyph"><BookIcon size={24} /></div>
            <p className="elr-empty-title">No materials yet</p>
            <p className="elr-empty-sub">Check back later for new training resources.</p>
          </div>
        ) : (
          materials.map((m) => {
            const size = formatFileSize(m.fileSize);
            const date = formatDate(m.createdAt);
            const isCompleting = completingId === m._id;
            return (
              <div key={m._id} className="elr-card elr-anim">
                <div className="elr-card-head">
                  <div className="elr-tile"><BookIcon size={22} /></div>
                  <div className="elr-head-right">
                    <span className="elr-type-pill">{getFileType(m.mimeType)}</span>
                    {m.completed && (
                      <span className="elr-done-tag"><CheckIcon size={10} /> Done</span>
                    )}
                  </div>
                </div>

                <h3 className="elr-title">{m.name || m.title || 'Untitled material'}</h3>
                {m.description && <p className="elr-desc">{m.description}</p>}

                {(size || date) && (
                  <div className="elr-meta">
                    {size && <span>{size}</span>}
                    {size && date && <span className="elr-meta-dot">·</span>}
                    {date && <span>{date}</span>}
                  </div>
                )}
                {m.uploadedBy && (m.uploadedBy.firstName || m.uploadedBy.lastName) && (
                  <p className="elr-uploader">
                    Uploaded by <strong>{[m.uploadedBy.firstName, m.uploadedBy.lastName].filter(Boolean).join(' ')}</strong>
                  </p>
                )}

                <div className="elr-actions">
                  <button type="button" className="elr-btn view" onClick={() => openViewer(m)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    View
                  </button>
                  {m.completed ? (
                    <button type="button" className="elr-btn done" disabled>
                      <CheckIcon /> Done
                    </button>
                  ) : (
                    <button type="button" className="elr-btn complete" onClick={() => markComplete(m)} disabled={isCompleting}>
                      {isCompleting ? <span className="elr-mini-spin" /> : <CheckIcon />}
                      Complete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {viewer && (
        <div className="elr-viewer">
          <div className="elr-viewer-bar">
            <span className="elr-viewer-title">{viewer.material?.name || viewer.material?.title || 'Material'}</span>
            <button type="button" className="elr-viewer-close" onClick={closeViewer} aria-label="Close viewer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="elr-viewer-body">
            {viewer.loading ? (
              <div className="elr-viewer-center">
                <div className="elr-viewer-spin" />
                <span>Opening material…</span>
              </div>
            ) : viewer.failed ? (
              <div className="elr-viewer-center">
                <span>Couldn’t open this material.</span>
                <button type="button" className="elr-viewer-fallback-btn" onClick={() => openViewer(viewer.material)}>
                  Try again
                </button>
              </div>
            ) : (
              <iframe className="elr-viewer-frame" src={viewer.url} title={viewer.material?.name || 'Material'} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
