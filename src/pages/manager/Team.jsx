import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Mobile twin of web ManagerTeam.js. Same data layer:
//   GET /manager/team/members?includeIndirect=true → { data: [...] }
//   GET /manager/team/summary                      → { data: {...} }
// Tapping a member opens the shared EmployeeDetail route (/employees/:id).

const styles = `
  @keyframes tm-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes tm-skel {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.85; }
  }
  @keyframes tm-spin { to { transform: rotate(360deg); } }

  .tm-wrap { padding: 0.85rem 1rem 6rem; }
  .tm-anim { animation: tm-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header ── */
  .tm-header {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.25rem 0.85rem;
  }
  .tm-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18);
    flex-shrink: 0;
  }
  .tm-header-text { min-width: 0; flex: 1; }
  .tm-header-eyebrow {
    font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c; margin: 0;
  }
  .tm-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
  }
  .tm-refresh {
    flex-shrink: 0;
    width: 36px; height: 36px; border-radius: 10px;
    border: 1px solid rgba(132, 169, 140, 0.4);
    background: rgba(255, 255, 255, 0.6);
    color: #52796f;
    display: flex; align-items: center; justify-content: center;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
  }
  .tm-refresh:disabled { opacity: 0.55; }
  .tm-refresh:not(:disabled):active { transform: scale(0.94); }
  .tm-refresh.is-busy svg { animation: tm-spin 0.8s linear infinite; }

  /* ── Stat strip ── */
  .tm-stats {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.55rem;
    margin-bottom: 0.85rem;
  }
  .tm-stat {
    border-radius: 14px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    padding: 0.7rem 0.6rem;
    text-align: center;
  }
  .tm-stat-value {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.55rem; line-height: 1; font-weight: 500;
    color: #2f3e46;
  }
  .tm-stat-label {
    margin-top: 0.25rem;
    font-size: 0.6rem; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    color: #84a98c;
  }

  /* ── Search ── */
  .tm-search {
    position: relative;
    margin-bottom: 0.85rem;
  }
  .tm-search svg {
    position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%);
    color: #84a98c; pointer-events: none;
  }
  .tm-search input {
    width: 100%;
    padding: 0.6rem 0.75rem 0.6rem 2.2rem;
    border-radius: 12px;
    border: 1px solid rgba(212, 221, 214, 0.9);
    background: #fff;
    font-size: 0.84rem; color: #2f3e46;
    -webkit-tap-highlight-color: transparent;
  }
  .tm-search input::placeholder { color: #a7b6ac; }
  .tm-search input:focus {
    outline: none;
    border-color: #84a98c;
    box-shadow: 0 0 0 3px rgba(132, 169, 140, 0.18);
  }

  /* ── Member card ── */
  .tm-card {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.7rem 0.8rem;
    border-radius: 16px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.55rem;
    width: 100%; text-align: left;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    transition: transform 0.12s;
  }
  .tm-card:active { transform: scale(0.985); background: #f7f8f6; }
  .tm-avatar {
    width: 42px; height: 42px; border-radius: 50%;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.82rem; font-weight: 700; letter-spacing: 0.02em;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.28), rgba(82, 121, 111, 0.18));
    color: #354f52;
    position: relative;
  }
  .tm-avatar.is-inactive { opacity: 0.55; }
  .tm-dot {
    position: absolute; right: -1px; bottom: -1px;
    width: 11px; height: 11px; border-radius: 50%;
    border: 2px solid #fff;
  }
  .tm-dot.is-active   { background: #52796f; }
  .tm-dot.is-inactive { background: #c0756a; }

  .tm-body { min-width: 0; flex: 1; }
  .tm-name {
    font-size: 0.9rem; font-weight: 600; color: #2f3e46;
    line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .tm-sub {
    margin-top: 1px;
    font-size: 0.72rem; color: #7a8e84;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .tm-meta {
    margin-top: 0.35rem;
    display: flex; flex-wrap: wrap; gap: 0.3rem;
  }
  .tm-tag {
    display: inline-flex; align-items: center; gap: 0.25rem;
    font-size: 0.64rem; font-weight: 600;
    padding: 2px 7px; border-radius: 999px;
    background: #f1f4f0; color: #52796f;
    max-width: 100%;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .tm-tag.is-role { background: rgba(132, 169, 140, 0.22); color: #354f52; }
  .tm-chevron { flex-shrink: 0; color: #c2cdc5; }

  /* ── States ── */
  .tm-skel {
    height: 66px; border-radius: 16px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: tm-skel 1.2s ease-in-out infinite;
    margin-bottom: 0.55rem;
  }
  .tm-empty, .tm-error {
    padding: 2rem 1rem; border-radius: 16px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center; color: #52796f;
  }
  .tm-error {
    border-color: rgba(192, 117, 106, 0.4);
    color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .tm-empty-title, .tm-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .tm-empty-sub, .tm-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .tm-retry {
    margin-top: 0.85rem;
    padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .tm-retry:active { transform: scale(0.97); }
`;

function initials(member) {
  const f = (member.firstName || '').trim();
  const l = (member.lastName || '').trim();
  const ini = `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
  return ini || (member.email || '?').charAt(0).toUpperCase();
}

export default function ManagerTeam() {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  async function fetchData(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [membersRes, summaryRes] = await Promise.all([
        api.get('/manager/team/members?includeIndirect=true'),
        api.get('/manager/team/summary'),
      ]);
      setMembers(Array.isArray(membersRes?.data?.data) ? membersRes.data.data : []);
      setSummary(summaryRes?.data?.data || null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const full = `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase();
      return (
        full.includes(q)
        || String(m.email || '').toLowerCase().includes(q)
        || String(m.department || '').toLowerCase().includes(q)
        || String(m.jobTitle || '').toLowerCase().includes(q)
        || String(m.role || '').toLowerCase().includes(q)
      );
    });
  }, [members, search]);

  const totalMembers = summary?.teamSize ?? members.length;
  const activeMembers = summary?.activeMembers
    ?? members.filter((m) => m.isActive !== false).length;
  const departments = useMemo(
    () => new Set(members.map((m) => m.department).filter(Boolean)).size,
    [members],
  );

  return (
    <>
      <style>{styles}</style>
      <div className="tm-wrap">
        <header className="tm-header tm-anim">
          <div className="tm-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M17 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="tm-header-text">
            <p className="tm-header-eyebrow">My Team</p>
            <h1 className="tm-header-title">Reporting Hierarchy</h1>
          </div>
          <button
            type="button"
            className={`tm-refresh ${refreshing ? 'is-busy' : ''}`}
            onClick={() => fetchData(true)}
            disabled={loading || refreshing}
            aria-label="Refresh team"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </header>

        {!error && (
          <div className="tm-stats tm-anim">
            <div className="tm-stat">
              <div className="tm-stat-value">{loading ? '–' : totalMembers}</div>
              <div className="tm-stat-label">Members</div>
            </div>
            <div className="tm-stat">
              <div className="tm-stat-value">{loading ? '–' : activeMembers}</div>
              <div className="tm-stat-label">Active</div>
            </div>
            <div className="tm-stat">
              <div className="tm-stat-value">{loading ? '–' : departments}</div>
              <div className="tm-stat-label">Depts</div>
            </div>
          </div>
        )}

        {!loading && !error && members.length > 0 && (
          <div className="tm-search tm-anim">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, department, role…"
            />
          </div>
        )}

        {loading ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="tm-skel" />
            ))}
          </div>
        ) : error ? (
          <div className="tm-error tm-anim">
            <p className="tm-error-title">Couldn't load your team</p>
            <p className="tm-error-sub">{error}</p>
            <button className="tm-retry" onClick={() => fetchData()}>Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="tm-empty tm-anim">
            <p className="tm-empty-title">
              {members.length === 0 ? 'No team members' : 'No matches'}
            </p>
            <p className="tm-empty-sub">
              {members.length === 0
                ? 'Nobody is currently reporting into you.'
                : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          filtered.map((m) => {
            const active = m.isActive !== false;
            const fullName = `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Unnamed';
            return (
              <button
                key={m._id}
                type="button"
                className="tm-card tm-anim"
                onClick={() => navigate(`/employees/${m._id}`)}
              >
                <span className={`tm-avatar ${active ? '' : 'is-inactive'}`}>
                  {initials(m)}
                  <span className={`tm-dot ${active ? 'is-active' : 'is-inactive'}`} />
                </span>
                <span className="tm-body">
                  <span className="tm-name">{fullName}</span>
                  <span className="tm-sub">{m.email || 'No email'}</span>
                  <span className="tm-meta">
                    {m.department && <span className="tm-tag">{m.department}</span>}
                    {m.jobTitle && <span className="tm-tag">{m.jobTitle}</span>}
                    <span className="tm-tag is-role">{m.role || 'employee'}</span>
                  </span>
                </span>
                <svg className="tm-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
