import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Employee's own documents (payslips, contracts, policies shared with them).
// No confirmed mobile endpoint, so we probe a few candidate routes scoped to
// the signed-in user and degrade to a friendly empty state. Read-only: tapping
// a document opens it; uploads stay on the web app.

const DOC_ENDPOINTS = ['/documents/my', '/documents?scope=me', '/employee-documents', '/documents'];

const styles = `
  @keyframes ed-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ed-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes ed-spin { to { transform: rotate(360deg); } }

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
  .ed-header-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1; font-weight: 400; color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0; }
  .ed-count { font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem; }
  .ed-refresh {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .ed-refresh:disabled { opacity: 0.55; }
  .ed-refresh:not(:disabled):active { transform: scale(0.94); }
  .ed-refresh.is-busy svg { animation: ed-spin 0.8s linear infinite; }

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

  .ed-chips { display: flex; gap: 0.4rem; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 0.85rem; padding-bottom: 4px; }
  .ed-chips::-webkit-scrollbar { display: none; }
  .ed-chip {
    flex-shrink: 0; padding: 0.42rem 0.8rem; border-radius: 999px; font-size: 0.74rem; font-weight: 600; letter-spacing: 0.04em;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    -webkit-tap-highlight-color: transparent; cursor: pointer; text-transform: capitalize;
  }
  .ed-chip.is-active { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; border-color: transparent; }

  .ed-list { display: flex; flex-direction: column; gap: 0.45rem; }
  .ed-card {
    display: flex; align-items: center; gap: 0.7rem; width: 100%; text-align: left;
    padding: 0.65rem 0.75rem; border-radius: 13px; background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    font-family: 'DM Sans', sans-serif; cursor: pointer; -webkit-tap-highlight-color: transparent;
    transition: transform 0.12s, background 0.15s; text-decoration: none;
  }
  .ed-card:active { transform: scale(0.99); background: #f7f8f6; }
  .ed-file {
    width: 40px; height: 46px; border-radius: 7px; flex-shrink: 0; position: relative;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.2), rgba(82, 121, 111, 0.14));
    color: #354f52; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px;
  }
  .ed-file-ext { font-size: 0.5rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
  .ed-file.is-pdf { background: linear-gradient(135deg, rgba(192,117,106,0.22), rgba(192,117,106,0.12)); color: #b85c50; }
  .ed-file.is-img { background: linear-gradient(135deg, rgba(109,136,194,0.2), rgba(109,136,194,0.12)); color: #5470a8; }
  .ed-file.is-sheet { background: linear-gradient(135deg, rgba(132,169,140,0.26), rgba(132,169,140,0.14)); color: #3f6b4a; }
  .ed-meta { min-width: 0; flex: 1; }
  .ed-name { font-size: 0.85rem; font-weight: 600; color: #2f3e46; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ed-sub { margin-top: 2px; font-size: 0.68rem; color: #7a8e84; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ed-chev { color: #b8c4bc; flex-shrink: 0; }

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
`;

function docName(d) {
  return d?.name || d?.title || d?.fileName || d?.filename || d?.originalName || 'Untitled document';
}
function docUrl(d) {
  return d?.url || d?.fileUrl || d?.downloadUrl || d?.link || d?.path || null;
}
function docExt(d) {
  const src = d?.fileType || d?.type || d?.mimeType || docName(d) || '';
  const fromName = String(docName(d)).split('.').pop();
  const raw = (src.includes('/') ? src.split('/').pop() : src) || fromName || '';
  return String(raw).replace(/[^a-z0-9]/gi, '').slice(0, 4).toLowerCase() || 'file';
}
function extKind(ext) {
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg'].includes(ext)) return 'img';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  return 'doc';
}
function docCategory(d) {
  return d?.category || d?.type || d?.folder || 'Other';
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

export default function EmployeeDocuments() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  async function fetchDocs() {
    setLoading(true);
    setError(null);
    let lastErr = null;
    for (const ep of DOC_ENDPOINTS) {
      try {
        const { data } = await api.get(ep);
        const list = data?.documents || data?.data || data?.files || (Array.isArray(data) ? data : null);
        if (Array.isArray(list)) {
          setDocs(list);
          setLoading(false);
          return;
        }
      } catch (err) {
        lastErr = err;
        if (err?.response?.status && err.response.status !== 404) break;
      }
    }
    if (lastErr && lastErr?.response?.status && lastErr.response.status !== 404) {
      setError(getErrorMessage(lastErr));
    } else {
      setDocs([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchDocs();
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    for (const d of docs) set.add(docCategory(d));
    return ['all', ...[...set].sort((a, b) => String(a).localeCompare(String(b)))];
  }, [docs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (category !== 'all' && docCategory(d) !== category) return false;
      if (!q) return true;
      return [docName(d), docCategory(d)].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [docs, query, category]);

  return (
    <>
      <style>{styles}</style>
      <div className="ed-wrap">
        <header className="ed-header ed-anim">
          <div className="ed-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
            </svg>
          </div>
          <div className="ed-header-text">
            <p className="ed-header-eyebrow">My Requests</p>
            <h1 className="ed-header-title">
              Documents
              {!loading && !error && <span className="ed-count"> · {filtered.length}</span>}
            </h1>
          </div>
          <button
            type="button"
            className={`ed-refresh${loading ? ' is-busy' : ''}`}
            onClick={fetchDocs}
            disabled={loading}
            aria-label="Refresh"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </header>

        <div className="ed-search ed-anim">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>

        {categories.length > 1 && (
          <div className="ed-chips ed-anim">
            {categories.map((c) => (
              <button key={c} type="button" className={`ed-chip ${category === c ? 'is-active' : ''}`} onClick={() => setCategory(c)}>
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div>{Array.from({ length: 6 }).map((_, i) => <div key={i} className="ed-skel" />)}</div>
        ) : error ? (
          <div className="ed-error ed-anim">
            <p className="ed-error-title">Couldn't load documents</p>
            <p className="ed-error-sub">{error}</p>
            <button className="ed-retry" onClick={fetchDocs}>Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ed-empty ed-anim">
            <div className="ed-empty-glyph">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
              </svg>
            </div>
            <p className="ed-empty-title">{query || category !== 'all' ? 'No matches' : 'No documents yet'}</p>
            <p className="ed-empty-sub">
              {query || category !== 'all'
                ? 'Try a different search term or category.'
                : 'Documents shared with you — payslips, contracts, policies — will appear here.'}
            </p>
          </div>
        ) : (
          <div className="ed-list">
            {filtered.map((d, i) => {
              const ext = docExt(d);
              const kind = extKind(ext);
              const url = docUrl(d);
              const date = formatDate(d.uploadedAt || d.createdAt || d.date);
              const size = formatSize(d.size || d.fileSize);
              const sub = [docCategory(d), date, size].filter((x) => x && x !== 'Other').join(' · ') || docCategory(d);
              const Tag = url ? 'a' : 'div';
              const linkProps = url ? { href: url, target: '_blank', rel: 'noreferrer' } : {};
              return (
                <Tag key={d._id || d.id || i} className="ed-card ed-anim" style={{ animationDelay: `${Math.min(i, 6) * 25}ms` }} {...linkProps}>
                  <span className={`ed-file is-${kind}`}><span className="ed-file-ext">{ext}</span></span>
                  <span className="ed-meta">
                    <span className="ed-name">{docName(d)}</span>
                    {sub && <span className="ed-sub">{sub}</span>}
                  </span>
                  {url && (
                    <span className="ed-chev" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 17L17 7M17 7H8M17 7v9" />
                      </svg>
                    </span>
                  )}
                </Tag>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
