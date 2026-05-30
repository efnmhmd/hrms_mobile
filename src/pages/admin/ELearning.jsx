import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Admin / manager e-learning overview. No confirmed mobile endpoint yet, so we
// probe a few candidate routes and degrade to an empty state. Read-only: shows
// the course catalogue with org-wide completion progress.

const COURSE_ENDPOINTS = [
  '/elearning/courses',
  '/elearning',
  '/learning/courses',
  '/courses',
];

const styles = `
  @keyframes el-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes el-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes el-spin { to { transform: rotate(360deg); } }

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

  .el-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .el-card {
    padding: 0.8rem 0.85rem; border-radius: 15px; background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
  }
  .el-card-top { display: flex; align-items: flex-start; gap: 0.6rem; }
  .el-card-glyph { width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(132, 169, 140, 0.22), rgba(82, 121, 111, 0.14)); color: #354f52; }
  .el-card-main { min-width: 0; flex: 1; }
  .el-card-title { font-size: 0.88rem; font-weight: 600; color: #2f3e46; line-height: 1.25; }
  .el-card-cat { font-size: 0.66rem; color: #84a98c; letter-spacing: 0.04em; margin-top: 2px; text-transform: capitalize; }
  .el-pill { flex-shrink: 0; font-size: 0.55rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 7px; border-radius: 999px; background: rgba(82, 121, 111, 0.16); color: #354f52; }
  .el-pill.is-done { background: rgba(82, 121, 111, 0.2); color: #2f3e46; }
  .el-pill.is-mandatory { background: rgba(216, 166, 76, 0.2); color: #7a591f; }
  .el-card-desc { margin: 0.55rem 0 0; font-size: 0.76rem; color: #56655d; line-height: 1.45; }
  .el-progress { margin-top: 0.7rem; }
  .el-progress-bar { height: 7px; border-radius: 999px; background: #eef2ef; overflow: hidden; }
  .el-progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #52796f, #84a98c); transition: width 0.4s; }
  .el-progress-meta { margin-top: 0.4rem; display: flex; justify-content: space-between; font-size: 0.66rem; color: #7a8e84; }
  .el-progress-meta strong { color: #52796f; font-weight: 700; }

  .el-skel { height: 110px; border-radius: 15px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%); animation: el-skel 1.2s ease-in-out infinite; margin-bottom: 0.5rem; }
  .el-empty, .el-error {
    padding: 2rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .el-error { border-color: rgba(192, 117, 106, 0.4); color: #7a3028; background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55); }
  .el-empty-glyph { width: 38px; height: 38px; margin: 0 auto 0.6rem; border-radius: 11px; background: rgba(132, 169, 140, 0.14); display: flex; align-items: center; justify-content: center; color: #52796f; }
  .el-empty-title, .el-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .el-empty-sub, .el-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .el-retry { margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .el-retry:active { transform: scale(0.97); }
`;

function courseTitle(c) {
  return c?.title || c?.name || c?.courseName || 'Untitled course';
}

function courseProgress(c) {
  const raw =
    c?.completionRate ?? c?.progress ?? c?.percentComplete ?? c?.completion ?? null;
  if (raw == null) {
    // Derive from enrolled/completed counts when an explicit rate isn't given.
    const enrolled = Number(c?.enrolledCount ?? c?.enrolled ?? c?.totalEnrolled ?? 0);
    const completed = Number(c?.completedCount ?? c?.completed ?? 0);
    if (enrolled > 0) return Math.round((completed / enrolled) * 100);
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n <= 1 ? n * 100 : n)));
}

export default function ELearning() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  async function fetchCourses() {
    setLoading(true);
    setError(null);
    let lastErr = null;
    for (const ep of COURSE_ENDPOINTS) {
      try {
        const { data } = await api.get(ep);
        const list =
          data?.courses || data?.data ||
          (Array.isArray(data) ? data : null);
        if (Array.isArray(list)) {
          setCourses(list);
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
      setCourses([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchCourses();
  }, []);

  const stats = useMemo(() => {
    let totalProg = 0;
    let withProg = 0;
    let enrolled = 0;
    for (const c of courses) {
      const p = courseProgress(c);
      if (p != null) { totalProg += p; withProg += 1; }
      enrolled += Number(c?.enrolledCount ?? c?.enrolled ?? c?.totalEnrolled ?? 0);
    }
    return {
      courses: courses.length,
      avgProgress: withProg ? Math.round(totalProg / withProg) : 0,
      enrolled,
    };
  }, [courses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => {
      const hay = [courseTitle(c), c.category, c.description, c.level]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [courses, query]);

  return (
    <>
      <style>{styles}</style>
      <div className="el-wrap">
        <header className="el-header el-anim">
          <div className="el-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M20 22V6a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 6.5v13z" />
            </svg>
          </div>
          <div className="el-header-text">
            <p className="el-header-eyebrow">Reporting</p>
            <h1 className="el-header-title">
              E-Learning
              {!loading && !error && <span className="el-count"> · {filtered.length}</span>}
            </h1>
          </div>
          <button
            type="button"
            className={`el-refresh-btn${loading ? ' is-spinning' : ''}`}
            onClick={fetchCourses}
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

        {!loading && !error && courses.length > 0 && (
          <div className="el-stats el-anim">
            <div className="el-stat">
              <div className="el-stat-val">{stats.courses}</div>
              <div className="el-stat-lab">Courses</div>
            </div>
            <div className="el-stat is-accent">
              <div className="el-stat-val">{stats.avgProgress}%</div>
              <div className="el-stat-lab">Avg progress</div>
            </div>
            <div className="el-stat">
              <div className="el-stat-val">{stats.enrolled}</div>
              <div className="el-stat-lab">Enrolled</div>
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
            placeholder="Search courses…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>

        {loading ? (
          <div>
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="el-skel" />)}
          </div>
        ) : error ? (
          <div className="el-error el-anim">
            <p className="el-error-title">Couldn't load courses</p>
            <p className="el-error-sub">{error}</p>
            <button className="el-retry" onClick={fetchCourses}>Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="el-empty el-anim">
            <div className="el-empty-glyph">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M20 22V6a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 6.5v13z" />
              </svg>
            </div>
            <p className="el-empty-title">{query ? 'No matches' : 'No courses yet'}</p>
            <p className="el-empty-sub">
              {query
                ? 'Try a different search term.'
                : 'Training courses will appear here once published on the web app.'}
            </p>
          </div>
        ) : (
          <div className="el-list">
            {filtered.map((c, i) => {
              const progress = courseProgress(c);
              const mandatory = c.mandatory || c.required || /mandatory|required/i.test(c.category || '');
              const done = progress === 100;
              const enrolled = Number(c?.enrolledCount ?? c?.enrolled ?? c?.totalEnrolled ?? 0);
              return (
                <div key={c._id || c.id || i} className="el-card el-anim" style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}>
                  <div className="el-card-top">
                    <span className="el-card-glyph">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 10L12 5 2 10l10 5 10-5zM6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
                      </svg>
                    </span>
                    <div className="el-card-main">
                      <div className="el-card-title">{courseTitle(c)}</div>
                      {(c.category || c.level) && (
                        <div className="el-card-cat">{[c.category, c.level].filter(Boolean).join(' · ')}</div>
                      )}
                    </div>
                    {done ? (
                      <span className="el-pill is-done">Complete</span>
                    ) : mandatory ? (
                      <span className="el-pill is-mandatory">Required</span>
                    ) : null}
                  </div>
                  {c.description && <p className="el-card-desc">{c.description}</p>}
                  {progress != null && (
                    <div className="el-progress">
                      <div className="el-progress-bar">
                        <div className="el-progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="el-progress-meta">
                        <span><strong>{progress}%</strong> complete</span>
                        {enrolled > 0 && <span>{enrolled} enrolled</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
