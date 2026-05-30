import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { soon } from '../../components/DashboardShell';

// Mirrors web ArchiveEmployees.jsx:698 — GET /employees/archived returns
// { success, data: [employees] }. We render the same card pattern as the
// regular Employees list but with archive date instead of the role pill,
// and a slightly muted avatar to signal "no longer active".

const styles = `
  @keyframes ar-fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ar-skel {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.85; }
  }

  .ar-wrap { padding: 0.85rem 1rem 6rem; }
  .ar-anim { animation: ar-fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header strip ── */
  .ar-header {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.25rem 0.85rem;
  }
  .ar-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #525b5e 0%, #7a8e84 100%);
    color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(82,91,94,0.18);
    flex-shrink: 0;
  }
  .ar-header-text { min-width: 0; flex: 1; }
  .ar-header-eyebrow {
    font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c;
    margin: 0;
  }
  .ar-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
  }
  .ar-count { font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem; }

  /* ── Search ── */
  .ar-search-wrap {
    position: relative;
    margin-bottom: 0.85rem;
  }
  .ar-search-icon {
    position: absolute; left: 12px; top: 50%;
    transform: translateY(-50%);
    color: #84a98c; pointer-events: none;
  }
  .ar-search-input {
    width: 100%;
    padding: 0.8rem 1rem 0.8rem 2.5rem;
    border: 1.5px solid #d4ddd6; border-radius: 12px;
    font-family: 'DM Sans', sans-serif; font-size: 16px;
    color: #2f3e46; background: #fff; outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
    box-shadow: 0 1px 3px rgba(47, 62, 70, 0.04);
    -webkit-appearance: none; appearance: none;
    box-sizing: border-box;
  }
  .ar-search-input:focus {
    border-color: #52796f;
    box-shadow: 0 0 0 3px rgba(82,121,111,0.12);
  }
  .ar-search-clear {
    position: absolute; right: 8px; top: 50%;
    transform: translateY(-50%);
    border: none; background: none;
    color: #84a98c;
    min-width: 36px; min-height: 36px;
    display: flex; align-items: center; justify-content: center;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
  }

  /* ── List ── */
  .ar-list {
    display: flex; flex-direction: column;
    gap: 0.5rem;
  }
  .ar-card {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.7rem 0.85rem;
    border-radius: 14px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    text-decoration: none; color: inherit;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .ar-card:active {
    transform: scale(0.985);
    background: #f7f8f6;
  }
  .ar-avatar {
    width: 42px; height: 42px; border-radius: 50%;
    /* Muted greyscale so archived cards visually differ from active employees */
    background: linear-gradient(135deg, rgba(132, 132, 132, 0.22), rgba(82, 82, 82, 0.16));
    color: #525b5e;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.85rem; font-weight: 600;
    letter-spacing: 0.02em;
    flex-shrink: 0;
    position: relative;
  }
  /* Tiny archive box badge bottom-right of avatar */
  .ar-avatar::after {
    content: '';
    position: absolute;
    right: -2px; bottom: -2px;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: #b85c50;
    border: 2px solid #fff;
  }
  .ar-meta { min-width: 0; flex: 1; }
  .ar-name {
    font-size: 0.92rem; font-weight: 600;
    color: #2f3e46; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ar-sub {
    margin-top: 2px;
    font-size: 0.75rem; color: #7a8e84;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ar-archived-pill {
    display: inline-flex; align-items: center; gap: 0.25rem;
    margin-top: 4px;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(192, 117, 106, 0.12);
    color: #b85c50;
    font-size: 0.62rem; font-weight: 600;
    letter-spacing: 0.04em;
  }
  .ar-chev {
    color: #b8c4bc; flex-shrink: 0;
  }

  /* ── States ── */
  .ar-skel {
    height: 64px; border-radius: 14px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: ar-skel 1.2s ease-in-out infinite;
  }
  .ar-empty, .ar-error {
    padding: 2rem 1rem;
    border-radius: 16px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center;
    color: #52796f;
  }
  .ar-error {
    border-color: rgba(192, 117, 106, 0.4);
    color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .ar-empty-title, .ar-error-title {
    font-size: 0.85rem; font-weight: 600;
    margin: 0;
  }
  .ar-empty-sub, .ar-error-sub {
    font-size: 0.75rem;
    margin: 0.25rem 0 0;
    opacity: 0.85;
  }
  .ar-retry {
    margin-top: 0.85rem;
    padding: 0.55rem 1.1rem;
    border-radius: 999px;
    border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .ar-retry:active { transform: scale(0.97); }
`;

function initials(emp) {
  if (emp?.initials) return emp.initials;
  const f = (emp?.firstName || '').charAt(0);
  const l = (emp?.lastName || '').charAt(0);
  return (f + l).toUpperCase() || '?';
}

function fullName(emp) {
  return [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim() || emp?.email || 'Unnamed';
}

function subtitle(emp) {
  return emp?.jobTitle || emp?.department || emp?.email || '—';
}

// Mirrors web's getArchivedDate — backend uses one of several field names.
function archivedDate(emp) {
  const v = emp?.deletedDate || emp?.deletedAt || emp?.exitDate ||
            emp?.terminatedDate || emp?.updatedAt || emp?.createdAt;
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatArchivedDate(d) {
  if (!d) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminArchived() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  async function fetchArchived() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/employees/archived');
      const list = data?.data || data?.employees || (Array.isArray(data) ? data : []);
      setEmployees(list);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchArchived();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const hay = [
        e.firstName, e.lastName, e.email,
        e.jobTitle, e.department, e.team,
        e.organisationName, e.OrganisationName, e.office,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [employees, query]);

  // Newest archive first — same default sort the web app implies.
  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const da = archivedDate(a)?.getTime() || 0;
      const db = archivedDate(b)?.getTime() || 0;
      return db - da;
    });
    return list;
  }, [filtered]);

  return (
    <>
      <style>{styles}</style>
      <div className="ar-wrap">
        <header className="ar-header ar-anim">
          <div className="ar-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
            </svg>
          </div>
          <div className="ar-header-text">
            <p className="ar-header-eyebrow">Former Employees</p>
            <h1 className="ar-header-title">
              Archived
              {!loading && !error && (
                <span className="ar-count"> · {sorted.length}</span>
              )}
            </h1>
          </div>
        </header>

        <div className="ar-search-wrap ar-anim">
          <span className="ar-search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            className="ar-search-input"
            placeholder="Search archived employees…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
          {query && (
            <button
              type="button"
              className="ar-search-clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {loading ? (
          <div className="ar-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ar-skel" />
            ))}
          </div>
        ) : error ? (
          <div className="ar-error ar-anim">
            <p className="ar-error-title">Couldn't load archived employees</p>
            <p className="ar-error-sub">{error}</p>
            <button className="ar-retry" onClick={fetchArchived}>Try again</button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="ar-empty ar-anim">
            <p className="ar-empty-title">
              {query ? 'No matches' : 'No archived employees'}
            </p>
            <p className="ar-empty-sub">
              {query ? 'Try a different search term.' : 'Archived employees will appear here.'}
            </p>
          </div>
        ) : (
          <div className="ar-list">
            {sorted.map((emp, i) => {
              const when = formatArchivedDate(archivedDate(emp));
              return (
                <button
                  key={emp._id || emp.id || i}
                  type="button"
                  className="ar-card ar-anim"
                  style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}
                  onClick={() => navigate(`/employees/${emp._id || emp.id}`)}
                >
                  <span className="ar-avatar">{initials(emp)}</span>
                  <span className="ar-meta">
                    <div className="ar-name">{fullName(emp)}</div>
                    <div className="ar-sub">{subtitle(emp)}</div>
                    {when && (
                      <span className="ar-archived-pill">
                        Archived {when}
                      </span>
                    )}
                  </span>
                  <span className="ar-chev">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
