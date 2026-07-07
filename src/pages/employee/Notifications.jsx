import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Mirrors web NotificationContext + Notifications.js:
//   GET  /notifications              -> { notifications: [...] }
//   PUT  /notifications/:id/read     -> mark one read
//   PUT  /notifications/mark-all-read
// Unlike web (which auto-marks everything read on open), mobile marks a
// notification read when the user taps it, plus a manual "Mark all read".

const styles = `
  @keyframes nt-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes nt-skel {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.85; }
  }
  @keyframes nt-sheet-in {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes nt-fade-in { from { opacity: 0; } to { opacity: 1; } }

  .nt-wrap { padding: 0.85rem 1rem 6rem; }
  .nt-anim { animation: nt-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header ── */
  .nt-header {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.65rem 0.25rem 0.85rem;
  }
  .nt-header-icon {
    position: relative;
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18);
    flex-shrink: 0;
  }
  .nt-header-badge {
    position: absolute; top: -5px; right: -5px;
    min-width: 17px; height: 17px; padding: 0 4px;
    border-radius: 999px;
    background: #c0756a; color: #fff;
    font-size: 0.6rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #f7f8f6;
  }
  .nt-header-text { min-width: 0; flex: 1; }
  .nt-header-eyebrow {
    font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #84a98c; margin: 0;
  }
  .nt-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem; line-height: 1.1; font-weight: 400;
    color: #2f3e46; letter-spacing: -0.01em;
    margin: 0.1rem 0 0;
  }
  .nt-refresh {
    flex-shrink: 0;
    width: 36px; height: 36px; border-radius: 10px;
    border: 1.5px solid #d4ddd6; background: #fff;
    color: #52796f;
    display: flex; align-items: center; justify-content: center;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .nt-refresh:active { transform: scale(0.95); background: #f1f4f0; }
  .nt-refresh.is-loading svg { animation: nt-spin 0.9s linear infinite; }
  @keyframes nt-spin { to { transform: rotate(360deg); } }

  /* ── Tabs + mark all ── */
  .nt-toolbar {
    display: flex; align-items: center; gap: 0.5rem;
    margin-bottom: 0.85rem;
  }
  .nt-tabs { display: flex; gap: 0.4rem; flex: 1; }
  .nt-tab {
    padding: 0.45rem 0.85rem;
    border-radius: 999px;
    font-size: 0.74rem; font-weight: 600;
    letter-spacing: 0.02em;
    border: 1px solid rgba(132, 169, 140, 0.4);
    background: rgba(255, 255, 255, 0.6);
    color: #52796f;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .nt-tab.is-active {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    border-color: transparent;
  }
  .nt-tab:active { transform: scale(0.97); }
  .nt-markall {
    flex-shrink: 0;
    border: none; background: none;
    color: #52796f;
    font-size: 0.72rem; font-weight: 600;
    letter-spacing: 0.02em;
    padding: 0.3rem 0.2rem;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    display: inline-flex; align-items: center; gap: 0.25rem;
  }
  .nt-markall:disabled { opacity: 0.4; cursor: default; }
  .nt-markall:active:not(:disabled) { transform: scale(0.97); }

  /* ── Notification card ── */
  .nt-card {
    position: relative;
    display: flex; align-items: flex-start; gap: 0.65rem;
    padding: 0.75rem 0.8rem;
    border-radius: 14px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.45rem;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    text-align: left; width: 100%;
    transition: background 0.15s, transform 0.12s;
  }
  .nt-card:active { transform: scale(0.985); background: #f9faf8; }
  .nt-card.is-unread { background: #f4f8f4; border-color: rgba(82, 121, 111, 0.3); }
  .nt-card.is-unread::before {
    content: '';
    position: absolute; left: 0; top: 12px; bottom: 12px;
    width: 3px; border-radius: 0 3px 3px 0;
    background: linear-gradient(180deg, #52796f, #84a98c);
  }
  .nt-icon {
    flex-shrink: 0;
    width: 36px; height: 36px; border-radius: 11px;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.2), rgba(82, 121, 111, 0.14));
    color: #354f52;
  }
  .nt-icon.is-warn { background: rgba(196,156,74,0.16); color: #7a5a16; }
  .nt-icon.is-danger { background: rgba(192,117,106,0.14); color: #8a352b; }
  .nt-icon.is-success { background: rgba(76,140,82,0.14); color: #2f6e34; }

  .nt-body { min-width: 0; flex: 1; }
  .nt-body-top {
    display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem;
  }
  .nt-title {
    font-size: 0.86rem; line-height: 1.25;
    color: #2f3e46; font-weight: 500;
    overflow: hidden; text-overflow: ellipsis;
    display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;
  }
  .nt-card.is-unread .nt-title { font-weight: 700; }
  .nt-time {
    flex-shrink: 0;
    font-size: 0.66rem; color: #9aa89f;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .nt-msg {
    margin-top: 2px;
    font-size: 0.76rem; color: #6b7a71; line-height: 1.35;
    overflow: hidden; text-overflow: ellipsis;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }
  .nt-tags { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .nt-tag {
    font-size: 0.6rem; font-weight: 600;
    color: #52796f; background: #eef2ef;
    border-radius: 999px; padding: 1px 8px;
    letter-spacing: 0.03em; text-transform: capitalize;
  }
  .nt-tag.is-priority { color: #8a352b; background: rgba(192,117,106,0.12); }
  .nt-dot {
    flex-shrink: 0; align-self: center;
    width: 8px; height: 8px; border-radius: 50%;
    background: #52796f;
  }

  /* ── States ── */
  .nt-skel {
    height: 72px; border-radius: 14px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: nt-skel 1.2s ease-in-out infinite;
    margin-bottom: 0.45rem;
  }
  .nt-empty, .nt-error {
    padding: 2.25rem 1rem; border-radius: 16px;
    background:
      repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    text-align: center; color: #52796f;
  }
  .nt-empty-glyph {
    width: 44px; height: 44px; margin: 0 auto 0.65rem;
    border-radius: 13px;
    background: rgba(132, 169, 140, 0.14);
    display: flex; align-items: center; justify-content: center;
    color: #52796f;
  }
  .nt-error {
    border-color: rgba(192, 117, 106, 0.4);
    color: #7a3028;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
  }
  .nt-empty-title, .nt-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .nt-empty-sub, .nt-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .nt-retry {
    margin-top: 0.85rem;
    padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .nt-retry:active { transform: scale(0.97); }

  /* ── Detail sheet ── */
  .nt-overlay {
    position: fixed; inset: 0; z-index: 50;
    background: rgba(31, 41, 38, 0.45);
    display: flex; align-items: flex-end; justify-content: center;
    animation: nt-fade-in 0.2s ease both;
    -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);
  }
  .nt-sheet {
    width: 100%; max-width: 520px;
    background: #fff;
    border-radius: 22px 22px 0 0;
    padding: 0.75rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 -8px 30px rgba(47, 62, 70, 0.22);
    animation: nt-sheet-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
    max-height: 80vh; overflow-y: auto;
  }
  .nt-sheet-grip {
    width: 38px; height: 4px; border-radius: 999px;
    background: #d4ddd6; margin: 0.25rem auto 1rem;
  }
  .nt-sheet-head {
    display: flex; align-items: flex-start; gap: 0.65rem;
    margin-bottom: 0.9rem;
  }
  .nt-sheet-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.4rem; line-height: 1.15; font-weight: 500;
    color: #2f3e46; margin: 0; flex: 1;
  }
  .nt-sheet-meta {
    display: flex; flex-wrap: wrap; gap: 0.4rem;
    margin-bottom: 1rem;
  }
  .nt-sheet-msg {
    font-size: 0.9rem; line-height: 1.55; color: #44544c;
    white-space: pre-wrap;
  }
  .nt-sheet-btn {
    margin-top: 1.5rem; width: 100%;
    padding: 0.8rem; border-radius: 14px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #f0f5f2; font-size: 0.9rem; font-weight: 600;
    letter-spacing: 0.02em; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .nt-sheet-btn:active { transform: scale(0.98); }
`;

const TABS = [
  { key: 'all',    label: 'All' },
  { key: 'unread', label: 'Unread' },
];

function notifId(n) {
  return n._id || n.id;
}

function notifTime(n) {
  return n.createdOn || n.createdAt || n.date || null;
}

function relativeTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function fullDateTime(value) {
  if (!value) return 'Unknown date';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Map notification type/priority to a visual tone for the icon tile.
function iconTone(n) {
  const p = String(n.priority || '').toLowerCase();
  if (p === 'high' || p === 'urgent') return 'is-danger';
  const t = String(n.type || '').toLowerCase();
  if (t.includes('approve') || t.includes('success') || t.includes('complete')) return 'is-success';
  if (t.includes('reject') || t.includes('error') || t.includes('alert')) return 'is-danger';
  if (t.includes('leave') || t.includes('reminder') || t.includes('warn')) return 'is-warn';
  return '';
}

function BellIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  async function fetchNotifications() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/notifications');
      const list = data?.notifications || data?.data || (Array.isArray(data) ? data : []);
      setItems(list);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifications();
  }, []);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const visible = useMemo(
    () => (tab === 'unread' ? items.filter((n) => !n.read) : items),
    [items, tab],
  );

  async function markRead(id) {
    // Optimistic — flip locally, then persist. Revert on failure.
    setItems((prev) => prev.map((n) => (notifId(n) === id ? { ...n, read: true } : n)));
    try {
      await api.put(`/notifications/${id}/read`);
    } catch {
      setItems((prev) => prev.map((n) => (notifId(n) === id ? { ...n, read: false } : n)));
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    const snapshot = items;
    setMarkingAll(true);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.put('/notifications/mark-all-read');
    } catch {
      setItems(snapshot); // revert
    } finally {
      setMarkingAll(false);
    }
  }

  function openNotification(n) {
    setSelected(n);
    if (!n.read) markRead(notifId(n));
  }

  return (
    <>
      <style>{styles}</style>
      <div className="nt-wrap">
        <header className="nt-header nt-anim">
          <div className="nt-header-icon">
            <BellIcon />
            {unreadCount > 0 && (
              <span className="nt-header-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </div>
          <div className="nt-header-text">
            <p className="nt-header-eyebrow">Inbox</p>
            <h1 className="nt-header-title">Notifications</h1>
          </div>
          <button
            type="button"
            className={`nt-refresh${loading ? ' is-loading' : ''}`}
            onClick={fetchNotifications}
            disabled={loading}
            aria-label="Refresh notifications"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 2v6h-6M3 22v-6h6" />
              <path d="M3.5 9a9 9 0 0 1 14.85-3.36L21 8M20.5 15a9 9 0 0 1-14.85 3.36L3 16" />
            </svg>
          </button>
        </header>

        <div className="nt-toolbar nt-anim">
          <div className="nt-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`nt-tab ${tab === t.key ? 'is-active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                {t.key === 'unread' && unreadCount > 0 ? ` · ${unreadCount}` : ''}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="nt-markall"
            onClick={markAllRead}
            disabled={unreadCount === 0 || markingAll}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 7 17l-5-5" />
              <path d="m22 10-7.5 7.5L13 16" />
            </svg>
            Mark all read
          </button>
        </div>

        {loading ? (
          <div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="nt-skel" />
            ))}
          </div>
        ) : error ? (
          <div className="nt-error nt-anim">
            <p className="nt-error-title">Couldn't load notifications</p>
            <p className="nt-error-sub">{error}</p>
            <button className="nt-retry" onClick={fetchNotifications}>Try again</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="nt-empty nt-anim">
            <div className="nt-empty-glyph"><BellIcon size={20} /></div>
            <p className="nt-empty-title">
              {tab === 'unread' ? 'No unread notifications' : 'You’re all caught up'}
            </p>
            <p className="nt-empty-sub">
              {tab === 'unread'
                ? 'Everything has been read.'
                : 'New notifications will show up here.'}
            </p>
          </div>
        ) : (
          visible.map((n, i) => (
            <button
              key={notifId(n) || i}
              type="button"
              className={`nt-card nt-anim${n.read ? '' : ' is-unread'}`}
              onClick={() => openNotification(n)}
            >
              <span className={`nt-icon ${iconTone(n)}`}><BellIcon size={17} /></span>
              <div className="nt-body">
                <div className="nt-body-top">
                  <span className="nt-title">{n.title || n.message || 'Notification'}</span>
                  <span className="nt-time">{relativeTime(notifTime(n))}</span>
                </div>
                {n.message && n.message !== n.title && (
                  <div className="nt-msg">{n.message}</div>
                )}
                {(n.type || (n.priority && String(n.priority).toLowerCase() !== 'normal')) && (
                  <div className="nt-tags">
                    {n.type && <span className="nt-tag">{String(n.type).replace(/[_-]/g, ' ')}</span>}
                    {n.priority && String(n.priority).toLowerCase() !== 'normal' && (
                      <span className="nt-tag is-priority">{n.priority}</span>
                    )}
                  </div>
                )}
              </div>
              {!n.read && <span className="nt-dot" />}
            </button>
          ))
        )}
      </div>

      {selected && createPortal(
        <div className="nt-overlay" onClick={() => setSelected(null)}>
          <div className="nt-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="nt-sheet-grip" />
            <div className="nt-sheet-head">
              <span className={`nt-icon ${iconTone(selected)}`}><BellIcon size={18} /></span>
              <h2 className="nt-sheet-title">{selected.title || selected.message || 'Notification'}</h2>
            </div>
            <div className="nt-sheet-meta">
              <span className="nt-tag">{fullDateTime(notifTime(selected))}</span>
              {selected.type && <span className="nt-tag">{String(selected.type).replace(/[_-]/g, ' ')}</span>}
              {selected.priority && String(selected.priority).toLowerCase() !== 'normal' && (
                <span className="nt-tag is-priority">{selected.priority}</span>
              )}
            </div>
            {selected.message && <p className="nt-sheet-msg">{selected.message}</p>}
            <button type="button" className="nt-sheet-btn" onClick={() => setSelected(null)}>
              Done
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
