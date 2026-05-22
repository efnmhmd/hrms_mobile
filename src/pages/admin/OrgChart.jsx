import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { soon } from '../../components/DashboardShell';

const styles = `
  @keyframes org-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes org-skel {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.85; }
  }

  .org-wrap { padding: 0.85rem 1rem 6rem; }
  .org-anim { animation: org-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header (mirrors admin/Employees header) ── */
  .org-header {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.25rem 0.85rem;
  }
  .org-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18);
    flex-shrink: 0;
  }
  .org-header-text { min-width: 0; flex: 1; }
  .org-header-eyebrow {
    font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c; margin: 0;
  }
  .org-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
  }
  .org-count { font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem; }

  /* ── Toolbar ── */
  .org-tools {
    display: flex; justify-content: flex-end; gap: 0.4rem;
    margin-bottom: 0.7rem;
  }
  .org-tool-btn {
    border: 1px solid rgba(132, 169, 140, 0.4);
    background: rgba(132, 169, 140, 0.08);
    color: #52796f;
    font-size: 0.7rem; font-weight: 600;
    letter-spacing: 0.04em;
    padding: 0.4rem 0.7rem;
    border-radius: 999px;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
  }
  .org-tool-btn:active { transform: scale(0.97); }

  /* ── Tree ── */
  .org-tree {
    display: flex; flex-direction: column;
    gap: 0.4rem;
  }
  .org-node {
    --indent: 0;
    padding-left: calc(var(--indent) * 18px);
    position: relative;
  }
  /* Vertical guide line per indent step */
  .org-node::before {
    content: '';
    position: absolute;
    top: 0; bottom: 0;
    left: calc(var(--indent) * 18px - 9px);
    width: 1px;
    background: rgba(132, 169, 140, 0.28);
    display: var(--guide, none);
  }
  .org-row {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.6rem 0.7rem 0.6rem 0.55rem;
    border-radius: 14px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    -webkit-tap-highlight-color: transparent;
  }
  .org-row.is-root {
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.10), rgba(255, 255, 255, 0.85));
    border-color: rgba(132, 169, 140, 0.55);
  }
  .org-toggle {
    width: 24px; height: 24px; border-radius: 6px;
    border: none;
    background: rgba(132, 169, 140, 0.14);
    color: #354f52;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    transition: transform 0.18s;
  }
  .org-toggle.is-open { transform: rotate(90deg); }
  .org-toggle:disabled {
    opacity: 0;
    pointer-events: none;
  }
  .org-avatar {
    width: 38px; height: 38px; border-radius: 50%;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.28), rgba(82, 121, 111, 0.22));
    color: #354f52;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.8rem; font-weight: 600;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }
  .org-body {
    min-width: 0; flex: 1;
    text-align: left;
    background: none; border: none; padding: 0;
    color: inherit;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
  }
  .org-name {
    font-size: 0.88rem; font-weight: 600;
    color: #2f3e46; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .org-sub {
    margin-top: 2px;
    font-size: 0.72rem; color: #7a8e84;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .org-reports-pill {
    font-size: 0.65rem; font-weight: 600;
    color: #52796f;
    background: rgba(132, 169, 140, 0.14);
    border-radius: 999px;
    padding: 2px 8px;
    flex-shrink: 0;
    letter-spacing: 0.02em;
  }

  /* ── States ── */
  .org-skel {
    height: 54px; border-radius: 14px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: org-skel 1.2s ease-in-out infinite;
  }
  .org-empty, .org-error {
    padding: 2rem 1rem; border-radius: 16px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center; color: #52796f;
  }
  .org-error {
    border-color: rgba(192, 117, 106, 0.4);
    color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .org-empty-title, .org-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .org-empty-sub, .org-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .org-retry {
    margin-top: 0.85rem;
    padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .org-retry:active { transform: scale(0.97); }
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
  return emp?.jobTitle || emp?.department || emp?.team || '—';
}

// Resolve a stable id whatever the backend returns (web normaliser uses _id.toString()).
function nodeId(emp) {
  return emp?._id?.toString?.() || emp?._id || emp?.id || null;
}

// Walk the tree once to collect all ids — used by the Expand/Collapse all controls.
function collectIds(nodes, acc = []) {
  for (const n of nodes || []) {
    const id = nodeId(n);
    if (id) acc.push(id);
    if (n.directReports?.length) collectIds(n.directReports, acc);
  }
  return acc;
}

export default function AdminOrgChart() {
  const [roots, setRoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Default: roots expanded, deeper levels collapsed. Stored as a Set of ids.
  const [expanded, setExpanded] = useState(() => new Set());
  const navigate = useNavigate();

  async function fetchOrgChart() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/employees/org-chart');
      const list = data?.data || (Array.isArray(data) ? data : []);
      setRoots(list);
      // Pre-expand top level so users see something useful immediately.
      setExpanded(new Set(list.map(nodeId).filter(Boolean)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrgChart();
  }, []);

  const allIds = useMemo(() => collectIds(roots), [roots]);
  const totalCount = allIds.length;

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(allIds));
  }
  function collapseAll() {
    setExpanded(new Set(roots.map(nodeId).filter(Boolean)));
  }

  return (
    <>
      <style>{styles}</style>
      <div className="org-wrap">
        <header className="org-header org-anim">
          <div className="org-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="5" r="2.5" />
              <circle cx="5" cy="19" r="2.5" />
              <circle cx="19" cy="19" r="2.5" />
              <path d="M12 7.5v4M5 16.5l5-4M19 16.5l-5-4" />
            </svg>
          </div>
          <div className="org-header-text">
            <p className="org-header-eyebrow">Reporting Lines</p>
            <h1 className="org-header-title">
              Org Chart
              {!loading && !error && (
                <span className="org-count"> · {totalCount}</span>
              )}
            </h1>
          </div>
        </header>

        {!loading && !error && roots.length > 0 && (
          <div className="org-tools org-anim">
            <button className="org-tool-btn" onClick={expandAll}>Expand all</button>
            <button className="org-tool-btn" onClick={collapseAll}>Collapse</button>
          </div>
        )}

        {loading ? (
          <div className="org-tree">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="org-skel" />
            ))}
          </div>
        ) : error ? (
          <div className="org-error org-anim">
            <p className="org-error-title">Couldn't load org chart</p>
            <p className="org-error-sub">{error}</p>
            <button className="org-retry" onClick={fetchOrgChart}>Try again</button>
          </div>
        ) : roots.length === 0 ? (
          <div className="org-empty org-anim">
            <p className="org-empty-title">No reporting lines set up yet</p>
            <p className="org-empty-sub">Build the chart on the web admin panel first.</p>
          </div>
        ) : (
          <div className="org-tree">
            {roots.map((node, i) => (
              <TreeNode
                key={nodeId(node) || i}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                onOpenDetail={(emp) => navigate(soon(fullName(emp)))}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function TreeNode({ node, depth, expanded, onToggle, onOpenDetail }) {
  const id = nodeId(node);
  const reports = node.directReports || [];
  const hasChildren = reports.length > 0;
  const isOpen = id ? expanded.has(id) : false;

  return (
    <div
      className="org-node org-anim"
      style={{
        '--indent': depth,
        '--guide': depth > 0 ? 'block' : 'none',
        animationDelay: `${Math.min(depth, 6) * 30}ms`,
      }}
    >
      <div className={`org-row ${depth === 0 ? 'is-root' : ''}`}>
        <button
          type="button"
          className={`org-toggle ${isOpen ? 'is-open' : ''}`}
          onClick={() => id && onToggle(id)}
          disabled={!hasChildren}
          aria-label={hasChildren ? (isOpen ? 'Collapse' : 'Expand') : 'No reports'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>

        <span className="org-avatar">{initials(node)}</span>

        <button
          type="button"
          className="org-body"
          onClick={() => onOpenDetail(node)}
        >
          <div className="org-name">{fullName(node)}</div>
          <div className="org-sub">{subtitle(node)}</div>
        </button>

        {hasChildren && (
          <span className="org-reports-pill">{reports.length}</span>
        )}
      </div>

      {isOpen && hasChildren && (
        <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {reports.map((child, i) => (
            <TreeNode
              key={nodeId(child) || i}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      )}
    </div>
  );
}
