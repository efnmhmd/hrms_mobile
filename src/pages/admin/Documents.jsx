import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Admin / manager document library. The mobile build doesn't yet have a
// confirmed documents endpoint, so we try a few candidate routes in order and
// fall back to a friendly empty state if none respond. Read-only listing.

const DOC_ENDPOINTS = [
  '/documents?limit=500',
  '/documents/all',
  '/employee-documents',
  '/documents',
];

const styles = `
  @keyframes dc-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes dc-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes dc-spin { to { transform: rotate(360deg); } }

  .dc-wrap { padding: 0.85rem 1rem 6rem; }
  .dc-anim { animation: dc-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  .dc-header { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.25rem 0.85rem; }
  .dc-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18); flex-shrink: 0;
  }
  .dc-header-text { min-width: 0; flex: 1; }
  .dc-header-eyebrow { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .dc-header-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1; font-weight: 400; color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0; }
  .dc-count { font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem; }
  .dc-refresh-btn {
    flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 10px;
    border: 1px solid rgba(212, 221, 214, 0.7); background: #fff; color: #354f52;
    cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 0.15s, transform 0.12s;
  }
  .dc-refresh-btn:active { background: #f1f4f0; transform: scale(0.95); }
  .dc-refresh-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .dc-refresh-btn.is-spinning svg { animation: dc-spin 0.9s linear infinite; }

  .dc-search-wrap { position: relative; margin-bottom: 0.6rem; }
  .dc-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #84a98c; pointer-events: none; }
  .dc-search-input {
    width: 100%; padding: 0.7rem 1rem 0.7rem 2.5rem;
    border: 1.5px solid #d4ddd6; border-radius: 12px;
    font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46; background: #fff; outline: none;
    transition: border-color 0.18s, box-shadow 0.18s; box-shadow: 0 1px 3px rgba(47, 62, 70, 0.04);
    -webkit-appearance: none; appearance: none; box-sizing: border-box;
  }
  .dc-search-input:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }

  .dc-chips { display: flex; gap: 0.4rem; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 0.85rem; padding-bottom: 4px; }
  .dc-chips::-webkit-scrollbar { display: none; }
  .dc-chip {
    flex-shrink: 0; padding: 0.42rem 0.8rem; border-radius: 999px;
    font-size: 0.74rem; font-weight: 600; letter-spacing: 0.04em;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    -webkit-tap-highlight-color: transparent; cursor: pointer; text-transform: capitalize;
  }
  .dc-chip.is-active { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; border-color: transparent; }

  .dc-list { display: flex; flex-direction: column; gap: 0.45rem; }
  .dc-card {
    display: flex; align-items: center; gap: 0.7rem; width: 100%; text-align: left;
    padding: 0.65rem 0.75rem; border-radius: 13px; background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    font-family: 'DM Sans', sans-serif; cursor: pointer; -webkit-tap-highlight-color: transparent;
    transition: transform 0.12s, background 0.15s; text-decoration: none;
  }
  .dc-card:active { transform: scale(0.99); background: #f7f8f6; }
  .dc-file {
    width: 40px; height: 46px; border-radius: 7px; flex-shrink: 0; position: relative;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.2), rgba(82, 121, 111, 0.14));
    color: #354f52; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px;
  }
  .dc-file-ext { font-size: 0.5rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
  .dc-file.is-pdf { background: linear-gradient(135deg, rgba(192,117,106,0.22), rgba(192,117,106,0.12)); color: #b85c50; }
  .dc-file.is-img { background: linear-gradient(135deg, rgba(109,136,194,0.2), rgba(109,136,194,0.12)); color: #5470a8; }
  .dc-file.is-doc { background: linear-gradient(135deg, rgba(82,121,111,0.2), rgba(82,121,111,0.12)); color: #354f52; }
  .dc-file.is-sheet { background: linear-gradient(135deg, rgba(132,169,140,0.26), rgba(132,169,140,0.14)); color: #3f6b4a; }
  .dc-meta { min-width: 0; flex: 1; }
  .dc-name { font-size: 0.85rem; font-weight: 600; color: #2f3e46; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dc-sub { margin-top: 2px; font-size: 0.68rem; color: #7a8e84; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dc-chev { color: #b8c4bc; flex-shrink: 0; }

  .dc-skel { height: 64px; border-radius: 13px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%); animation: dc-skel 1.2s ease-in-out infinite; margin-bottom: 0.45rem; }
  .dc-empty, .dc-error {
    padding: 2rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .dc-error { border-color: rgba(192, 117, 106, 0.4); color: #7a3028; background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55); }
  .dc-empty-glyph { width: 38px; height: 38px; margin: 0 auto 0.6rem; border-radius: 11px; background: rgba(132, 169, 140, 0.14); display: flex; align-items: center; justify-content: center; color: #52796f; }
  .dc-empty-title, .dc-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .dc-empty-sub, .dc-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .dc-retry { margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .dc-retry:active { transform: scale(0.97); }
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
  const ext = String(raw).replace(/[^a-z0-9]/gi, '').slice(0, 4).toLowerCase();
  return ext || 'file';
}

function extKind(ext) {
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg'].includes(ext)) return 'img';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  if (['doc', 'docx', 'txt', 'rtf', 'pages'].includes(ext)) return 'doc';
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

export default function Documents() {
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
        const list =
          data?.documents || data?.data || data?.files ||
          (Array.isArray(data) ? data : null);
        if (Array.isArray(list)) {
          setDocs(list);
          setLoading(false);
          return;
        }
      } catch (err) {
        lastErr = err;
        // 404 → route doesn't exist on this backend; try the next candidate.
        if (err?.response?.status && err.response.status !== 404) break;
      }
    }
    // No endpoint produced a list: treat a hard error as an error, otherwise
    // show the empty state (the feature may simply have no documents/route).
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
      const hay = [docName(d), docCategory(d), d.owner, d.employeeName, d.uploadedBy]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [docs, query, category]);

  return (
    <>
      <style>{styles}</style>
      <div className="dc-wrap">
        <header className="dc-header dc-anim">
          <div className="dc-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
            </svg>
          </div>
          <div className="dc-header-text">
            <p className="dc-header-eyebrow">Reporting</p>
            <h1 className="dc-header-title">
              Documents
              {!loading && !error && <span className="dc-count"> · {filtered.length}</span>}
            </h1>
          </div>
          <button
            type="button"
            className={`dc-refresh-btn${loading ? ' is-spinning' : ''}`}
            onClick={fetchDocs}
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

        <div className="dc-search-wrap dc-anim">
          <span className="dc-search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            className="dc-search-input"
            placeholder="Search documents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>

        {categories.length > 1 && (
          <div className="dc-chips dc-anim">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`dc-chip ${category === c ? 'is-active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="dc-skel" />)}
          </div>
        ) : error ? (
          <div className="dc-error dc-anim">
            <p className="dc-error-title">Couldn't load documents</p>
            <p className="dc-error-sub">{error}</p>
            <button className="dc-retry" onClick={fetchDocs}>Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="dc-empty dc-anim">
            <div className="dc-empty-glyph">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
              </svg>
            </div>
            <p className="dc-empty-title">{query || category !== 'all' ? 'No matches' : 'No documents yet'}</p>
            <p className="dc-empty-sub">
              {query || category !== 'all'
                ? 'Try a different search term or category.'
                : 'Shared documents will appear here once uploaded on the web app.'}
            </p>
          </div>
        ) : (
          <div className="dc-list">
            {filtered.map((d, i) => {
              const ext = docExt(d);
              const kind = extKind(ext);
              const url = docUrl(d);
              const owner = d.owner || d.employeeName || d.uploadedBy;
              const date = formatDate(d.uploadedAt || d.createdAt || d.date);
              const size = formatSize(d.size || d.fileSize);
              const sub = [owner, date, size].filter(Boolean).join(' · ');
              const Tag = url ? 'a' : 'div';
              const linkProps = url ? { href: url, target: '_blank', rel: 'noreferrer' } : {};
              return (
                <Tag key={d._id || d.id || i} className="dc-card dc-anim" style={{ animationDelay: `${Math.min(i, 6) * 25}ms` }} {...linkProps}>
                  <span className={`dc-file is-${kind}`}>
                    <span className="dc-file-ext">{ext}</span>
                  </span>
                  <span className="dc-meta">
                    <span className="dc-name">{docName(d)}</span>
                    {sub && <span className="dc-sub">{sub}</span>}
                  </span>
                  {url && (
                    <span className="dc-chev" aria-hidden="true">
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
