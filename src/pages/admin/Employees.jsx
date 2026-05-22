import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { soon } from '../../components/DashboardShell';

const styles = `
  @keyframes emp-fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes emp-spin { to { transform: rotate(360deg); } }
  @keyframes emp-skel {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.85; }
  }

  .emp-wrap {
    padding: 0.85rem 1rem 6rem;
  }
  .emp-anim { animation: emp-fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header strip ── */
  .emp-header {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.25rem 0.85rem;
  }
  .emp-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18);
    flex-shrink: 0;
  }
  .emp-header-text { min-width: 0; flex: 1; }
  .emp-header-eyebrow {
    font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c;
    margin: 0;
  }
  .emp-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
  }
  .emp-count {
    font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem;
  }

  /* ── Search ── */
  .emp-search-row {
    display: flex; gap: 0.5rem; align-items: stretch;
    margin-bottom: 0.6rem;
  }
  .emp-search-wrap {
    position: relative;
    flex: 1; min-width: 0;
  }
  .emp-search-icon {
    position: absolute; left: 12px; top: 50%;
    transform: translateY(-50%);
    color: #84a98c; pointer-events: none;
  }
  .emp-search-input {
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
  .emp-search-input:focus {
    border-color: #52796f;
    box-shadow: 0 0 0 3px rgba(82,121,111,0.12);
  }
  .emp-search-clear {
    position: absolute; right: 8px; top: 50%;
    transform: translateY(-50%);
    border: none; background: none;
    color: #84a98c;
    min-width: 36px; min-height: 36px;
    display: flex; align-items: center; justify-content: center;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
  }

  /* ── Filter button + panel ── */
  .emp-filter-btn {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    gap: 0.3rem;
    min-width: 46px; padding: 0 0.75rem;
    border: 1.5px solid #d4ddd6; border-radius: 12px;
    background: #fff; color: #354f52;
    font-family: 'DM Sans', sans-serif; font-size: 0.8rem; font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: border-color 0.18s, background 0.18s, color 0.18s;
  }
  .emp-filter-btn:active { transform: scale(0.97); }
  .emp-filter-btn.is-open,
  .emp-filter-btn.is-active {
    border-color: #52796f;
    background: rgba(82,121,111,0.08);
    color: #354f52;
  }
  .emp-filter-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 18px; padding: 0 5px;
    border-radius: 999px;
    background: #52796f; color: #fff;
    font-size: 0.65rem; font-weight: 700;
  }

  .emp-filter-panel {
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    border-radius: 14px;
    padding: 0.75rem 0.85rem;
    margin-bottom: 0.85rem;
    box-shadow: 0 2px 8px rgba(47, 62, 70, 0.05);
  }
  .emp-filter-group + .emp-filter-group {
    margin-top: 0.7rem;
    padding-top: 0.7rem;
    border-top: 1px dashed rgba(132, 169, 140, 0.25);
  }
  .emp-filter-label {
    font-size: 0.62rem; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #7a8e84;
    margin: 0 0 0.45rem;
  }
  .emp-chip-row {
    display: flex; flex-wrap: wrap; gap: 0.35rem;
  }
  .emp-chip {
    border: 1px solid #d4ddd6;
    background: #fff;
    color: #354f52;
    border-radius: 999px;
    padding: 0.32rem 0.7rem;
    font-size: 0.74rem; font-weight: 500;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    text-transform: capitalize;
  }
  .emp-chip:active { transform: scale(0.97); }
  .emp-chip.is-on {
    background: #52796f;
    border-color: #52796f;
    color: #fff;
  }
  .emp-filter-clear {
    margin-top: 0.7rem;
    border: none; background: none;
    color: #7a3028;
    font-size: 0.72rem; font-weight: 600;
    padding: 0.2rem 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .emp-filter-clear:disabled { opacity: 0.4; cursor: default; }
  .emp-section-wrap { margin-bottom: 0.85rem; }

  /* ── List ── */
  .emp-list {
    display: flex; flex-direction: column;
    gap: 0.5rem;
  }
  .emp-card {
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
  .emp-card:active {
    transform: scale(0.985);
    background: #f7f8f6;
  }
  .emp-avatar {
    width: 42px; height: 42px; border-radius: 50%;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.28), rgba(82, 121, 111, 0.22));
    color: #354f52;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.85rem; font-weight: 600;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }
  .emp-meta { min-width: 0; flex: 1; }
  .emp-name {
    font-size: 0.92rem; font-weight: 600;
    color: #2f3e46; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .emp-sub {
    margin-top: 2px;
    font-size: 0.75rem; color: #7a8e84;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .emp-chev {
    color: #b8c4bc; flex-shrink: 0;
  }
  .emp-role-pill {
    display: inline-block;
    margin-top: 4px;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(132, 169, 140, 0.14);
    color: #52796f;
    font-size: 0.62rem; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
  }

  /* ── States ── */
  .emp-skel {
    height: 64px; border-radius: 14px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: emp-skel 1.2s ease-in-out infinite;
  }
  .emp-empty, .emp-error {
    padding: 2rem 1rem;
    border-radius: 16px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center;
    color: #52796f;
  }
  .emp-error {
    border-color: rgba(192, 117, 106, 0.4);
    color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .emp-empty-title, .emp-error-title {
    font-size: 0.85rem; font-weight: 600;
    margin: 0;
  }
  .emp-empty-sub, .emp-error-sub {
    font-size: 0.75rem;
    margin: 0.25rem 0 0;
    opacity: 0.85;
  }
  .emp-retry {
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
  .emp-retry:active { transform: scale(0.97); }
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

function roleLabel(role) {
  if (!role) return null;
  return role.replace(/-/g, ' ');
}

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [roleFilters, setRoleFilters] = useState([]);
  const [deptFilters, setDeptFilters] = useState([]);
  const [teamFilters, setTeamFilters] = useState([]);
  const navigate = useNavigate();

  async function fetchEmployees() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/employees?includeAdmins=true');
      const list = data?.data || data?.employees || (Array.isArray(data) ? data : []);
      setEmployees(list);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEmployees();
  }, []);

  const { roleOptions, deptOptions, teamOptions } = useMemo(() => {
    const roles = new Set();
    const depts = new Set();
    const teams = new Set();
    for (const e of employees) {
      if (e?.role) roles.add(e.role);
      if (e?.department) depts.add(e.department);
      if (e?.team) teams.add(e.team);
    }
    const sortAlpha = (a, b) => a.localeCompare(b);
    return {
      roleOptions: [...roles].sort(sortAlpha),
      deptOptions: [...depts].sort(sortAlpha),
      teamOptions: [...teams].sort(sortAlpha),
    };
  }, [employees]);

  const activeFilterCount = roleFilters.length + deptFilters.length + teamFilters.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (roleFilters.length && !roleFilters.includes(e.role)) return false;
      if (deptFilters.length && !deptFilters.includes(e.department)) return false;
      if (teamFilters.length && !teamFilters.includes(e.team)) return false;
      if (!q) return true;
      const haystack = [
        e.firstName, e.lastName, e.email,
        e.jobTitle, e.department, e.team,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [employees, query, roleFilters, deptFilters, teamFilters]);

  function toggleFilter(setter, value) {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function clearAllFilters() {
    setRoleFilters([]);
    setDeptFilters([]);
    setTeamFilters([]);
  }

  return (
    <>
      <style>{styles}</style>
      <div className="emp-wrap">
        <header className="emp-header emp-anim">
          <div className="emp-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
              <circle cx="10" cy="7" r="4" />
              <path d="M21 21v-2a4 4 0 0 0-3-3.87M17 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="emp-header-text">
            <p className="emp-header-eyebrow">People Directory</p>
            <h1 className="emp-header-title">
              Employees
              {!loading && !error && (
                <span className="emp-count"> · {filtered.length}</span>
              )}
            </h1>
          </div>
        </header>

        <div className="emp-section-wrap emp-anim">
          <div className="emp-search-row">
            <div className="emp-search-wrap">
              <span className="emp-search-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </span>
              <input
                type="search"
                className="emp-search-input"
                placeholder="Search by name, role, team…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
              />
              {query && (
                <button
                  type="button"
                  className="emp-search-clear"
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
            <button
              type="button"
              className={`emp-filter-btn${filtersOpen ? ' is-open' : ''}${activeFilterCount > 0 ? ' is-active' : ''}`}
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-label="Toggle filters"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 5h18M6 12h12M10 19h4" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="emp-filter-badge">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {filtersOpen && (
            <div className="emp-filter-panel">
              {roleOptions.length > 0 && (
                <div className="emp-filter-group">
                  <p className="emp-filter-label">Role</p>
                  <div className="emp-chip-row">
                    {roleOptions.map((r) => {
                      const on = roleFilters.includes(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          className={`emp-chip${on ? ' is-on' : ''}`}
                          onClick={() => toggleFilter(setRoleFilters, r)}
                        >
                          {roleLabel(r)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {deptOptions.length > 0 && (
                <div className="emp-filter-group">
                  <p className="emp-filter-label">Department</p>
                  <div className="emp-chip-row">
                    {deptOptions.map((d) => {
                      const on = deptFilters.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          className={`emp-chip${on ? ' is-on' : ''}`}
                          onClick={() => toggleFilter(setDeptFilters, d)}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {teamOptions.length > 0 && (
                <div className="emp-filter-group">
                  <p className="emp-filter-label">Team</p>
                  <div className="emp-chip-row">
                    {teamOptions.map((t) => {
                      const on = teamFilters.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`emp-chip${on ? ' is-on' : ''}`}
                          onClick={() => toggleFilter(setTeamFilters, t)}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {roleOptions.length === 0 && deptOptions.length === 0 && teamOptions.length === 0 && (
                <p className="emp-filter-label" style={{ margin: 0 }}>No filter options available</p>
              )}
              <button
                type="button"
                className="emp-filter-clear"
                onClick={clearAllFilters}
                disabled={activeFilterCount === 0}
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="emp-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="emp-skel" />
            ))}
          </div>
        ) : error ? (
          <div className="emp-error emp-anim">
            <p className="emp-error-title">Couldn't load employees</p>
            <p className="emp-error-sub">{error}</p>
            <button className="emp-retry" onClick={fetchEmployees}>Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="emp-empty emp-anim">
            <p className="emp-empty-title">
              {query || activeFilterCount > 0 ? 'No matches' : 'No employees yet'}
            </p>
            <p className="emp-empty-sub">
              {query || activeFilterCount > 0
                ? 'Try a different search term or adjust filters.'
                : 'Add your first employee on the web app.'}
            </p>
          </div>
        ) : (
          <div className="emp-list">
            {filtered.map((emp, i) => (
              <button
                key={emp._id || emp.id || i}
                type="button"
                className="emp-card emp-anim"
                style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}
                onClick={() => navigate(soon(fullName(emp)))}
              >
                <span className="emp-avatar">{initials(emp)}</span>
                <span className="emp-meta">
                  <div className="emp-name">{fullName(emp)}</div>
                  <div className="emp-sub">{subtitle(emp)}</div>
                  {emp.role && <span className="emp-role-pill">{roleLabel(emp.role)}</span>}
                </span>
                <span className="emp-chev">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
