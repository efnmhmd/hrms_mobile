import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';

const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/clock', label: 'Clock', Icon: ClockIcon },
  { to: '/profile', label: 'Profile', Icon: UserIcon },
];

// Pretty titles for non-tab routes. Pages registered in App.jsx should
// have an entry here so the top bar shows a meaningful name. Anything
// missing falls back to a humanised version of the path segment.
const ROUTE_TITLES = {
  '/admin/employees':     'Employees',
  '/admin/org-chart':     'Org Chart',
  '/admin/time-history':  'Time History',
  '/admin/archived':      'Archived',
  '/admin/calendar':      'Calendar',
  '/admin/teams':         'Manage Teams',
  '/admin/leave-balances': 'Leave Balances',
  '/admin/shifts':        'Shift Management',
  '/manager/employees':   'Employees',
  '/manager/org-chart':   'Org Chart',
  '/manager/approvals':   'Approvals',
  '/manager/objectives':  'Objectives',
  '/manager/team':        'My Team',
  '/manager/calendar':    'Calendar',
  '/soon':                'Coming soon',
};

// Pattern-based titles for routes that include params (so a static map can't
// match the full path). First matching regex wins.
const ROUTE_TITLE_PATTERNS = [
  { test: /^\/employees\/[^/]+$/, title: 'Employee' },
];

function humanisePath(path) {
  const last = (path.split('/').filter(Boolean).pop() || 'Back');
  return last.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function titleForPath(pathname) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  for (const p of ROUTE_TITLE_PATTERNS) {
    if (p.test.test(pathname)) return p.title;
  }
  return humanisePath(pathname);
}

const styles = `
  /* ── Top bar with right-aligned brand logo ── */
  .tg-topbar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    background: rgba(247, 248, 246, 0.86);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
    border-bottom: 0.5px solid rgba(60, 60, 67, 0.12);
    z-index: 5;
  }
  .tg-topbar-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.35rem;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: #2f3e46;
    line-height: 1;
  }
  .tg-topbar-logo {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    object-fit: contain;
    flex-shrink: 0;
    background: #2f3e46;
    padding: 2px;
  }
  /* Left cluster: back chevron + page title */
  .tg-topbar-left {
    display: flex; align-items: center; gap: 6px;
    min-width: 0; flex: 1;
  }
  .tg-back-btn {
    -webkit-tap-highlight-color: transparent;
    background: none; border: none;
    color: #354f52;
    width: 36px; height: 36px;
    margin-left: -8px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, transform 0.12s;
  }
  .tg-back-btn:active {
    background: rgba(132, 169, 140, 0.18);
    transform: scale(0.94);
  }
  .tg-topbar-title-text {
    min-width: 0; flex: 1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* ── Floating Telegram-iOS-style bottom tab bar ── */
  .tg-tabbar-wrap {
    padding: 0 14px;
    padding-bottom: calc(env(safe-area-inset-bottom) + 12px);
    pointer-events: none;
  }
  .tg-tabbar {
    pointer-events: auto;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background: rgba(247, 248, 246, 0.82);
    -webkit-backdrop-filter: saturate(180%) blur(22px);
    backdrop-filter: saturate(180%) blur(22px);
    border: 1px solid rgba(60, 60, 67, 0.10);
    border-radius: 22px;
    box-shadow:
      0 8px 24px rgba(47, 62, 70, 0.10),
      0 2px 6px rgba(47, 62, 70, 0.06);
    padding: 6px 4px;
  }
  .tg-tab {
    -webkit-tap-highlight-color: transparent;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 3px;
    padding: 6px 4px;
    border-radius: 16px;
    color: #8e8e93;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.01em;
    transition: color 0.15s ease, transform 0.15s ease, background 0.15s ease;
    cursor: pointer;
    background: none; border: none;
    text-decoration: none;
  }
  .tg-tab:active { transform: scale(0.92); }
  .tg-tab.is-active { color: #52796f; font-weight: 600; }
  .tg-tab-icon { display: flex; align-items: center; justify-content: center; height: 28px; }

  /* ── Swipe-back: subtle drag follow + fade ── */
  .tg-stage {
    position: relative;
    flex: 1;
    overflow: hidden;
  }
  .tg-stage-inner {
    height: 100%;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    transform: translate3d(0,0,0);
    transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }
  .tg-stage-inner.tg-dragging {
    transition: none;
  }
  .tg-stage-shade {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.18);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .tg-stage-shade.tg-dragging { transition: none; }
`;

export default function TabLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const stageRef = useRef(null);
  const shadeRef = useRef(null);

  // Is the current URL one of the bottom-tab roots? If so, show the tab name
  // and no back button. Otherwise show a back chevron + page title.
  const matchedTab = tabs.find((t) =>
    t.end ? location.pathname === t.to : location.pathname.startsWith(t.to)
  );
  const isTabRoot = !!matchedTab;
  const pageTitle = isTabRoot
    ? matchedTab.label
    : titleForPath(location.pathname);

  // Edge swipe-back gesture — Telegram-iOS style.
  // Touch must start within the left 24px edge. We follow the drag, then on
  // release commit (navigate back) if the drag passed ~30% of the viewport
  // or had enough velocity; otherwise spring back.
  useEffect(() => {
    const EDGE = 24;
    const VW = () => window.innerWidth || 360;

    const inner = stageRef.current;
    const shade = shadeRef.current;
    if (!inner || !shade) return;

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let dx = 0;
    let active = false;
    let decided = false;
    let axisLocked = null; // 'x' | 'y'

    function onStart(e) {
      const t = e.touches[0];
      if (!t) return;
      if (t.clientX > EDGE) return; // only left-edge starts
      startX = t.clientX;
      startY = t.clientY;
      startT = e.timeStamp;
      dx = 0;
      active = true;
      decided = false;
      axisLocked = null;
    }

    function onMove(e) {
      if (!active) return;
      const t = e.touches[0];
      if (!t) return;
      const moveX = t.clientX - startX;
      const moveY = t.clientY - startY;

      if (!decided) {
        if (Math.abs(moveX) < 6 && Math.abs(moveY) < 6) return;
        axisLocked = Math.abs(moveX) > Math.abs(moveY) ? 'x' : 'y';
        decided = true;
        if (axisLocked === 'x') {
          inner.classList.add('tg-dragging');
          shade.classList.add('tg-dragging');
        } else {
          active = false;
          return;
        }
      }

      if (axisLocked !== 'x') return;
      // Resist negative drag (toward the screen) and clamp
      dx = Math.max(0, moveX);
      const progress = Math.min(1, dx / VW());
      inner.style.transform = `translate3d(${dx}px, 0, 0)`;
      // Shade fades from 0.25 → 0 as we drag right (mimic stack reveal)
      shade.style.opacity = String(0.25 * (1 - progress));
      // Prevent vertical scroll once we've claimed horizontal axis
      if (e.cancelable) e.preventDefault();
    }

    function reset() {
      inner.classList.remove('tg-dragging');
      shade.classList.remove('tg-dragging');
      inner.style.transform = '';
      shade.style.opacity = '';
    }

    function onEnd(e) {
      if (!active) return;
      active = false;
      if (axisLocked !== 'x') {
        reset();
        return;
      }
      const dt = Math.max(1, e.timeStamp - startT);
      const velocity = dx / dt; // px/ms
      const commit = dx > VW() * 0.3 || velocity > 0.5;
      if (commit) {
        // Animate to off-screen then navigate back
        inner.classList.remove('tg-dragging');
        shade.classList.remove('tg-dragging');
        inner.style.transform = `translate3d(${VW()}px, 0, 0)`;
        shade.style.opacity = '0';
        const cleanup = () => {
          inner.removeEventListener('transitionend', cleanup);
          reset();
          navigate(-1);
        };
        inner.addEventListener('transitionend', cleanup);
        // Safety: if transitionend doesn't fire, force after 260ms
        setTimeout(cleanup, 260);
      } else {
        reset();
      }
    }

    inner.addEventListener('touchstart', onStart, { passive: true });
    inner.addEventListener('touchmove', onMove, { passive: false });
    inner.addEventListener('touchend', onEnd);
    inner.addEventListener('touchcancel', onEnd);

    return () => {
      inner.removeEventListener('touchstart', onStart);
      inner.removeEventListener('touchmove', onMove);
      inner.removeEventListener('touchend', onEnd);
      inner.removeEventListener('touchcancel', onEnd);
    };
  }, [navigate]);

  return (
    <div className="flex h-full flex-col">
      <style>{styles}</style>

      <header className="tg-topbar safe-top">
        <div className="tg-topbar-left">
          {!isTabRoot && (
            <button
              type="button"
              className="tg-back-btn"
              onClick={() => navigate(-1)}
              aria-label="Back"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <span className="tg-topbar-title tg-topbar-title-text">{pageTitle}</span>
        </div>
        <img className="tg-topbar-logo" src="/tslnew.png" alt="Talent Shield" />
      </header>

      <div className="tg-stage">
        <div ref={shadeRef} className="tg-stage-shade" />
        <main ref={stageRef} className="tg-stage-inner">
          <Outlet />
        </main>
      </div>

      <div className="tg-tabbar-wrap">
        <nav className="tg-tabbar">
          {tabs.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `tg-tab ${isActive ? 'is-active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  <span className="tg-tab-icon">
                    <Icon active={isActive} />
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

function HomeIcon({ active }) {
  return active ? (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.3 2.6a1 1 0 011.4 0l8.6 7.7c.4.4.1 1.1-.5 1.1H20v8.4A2.2 2.2 0 0117.8 22h-2.6a1 1 0 01-1-1v-4.6a2.2 2.2 0 00-4.4 0V21a1 1 0 01-1 1H6.2A2.2 2.2 0 014 19.8v-8.4H3.2c-.6 0-.9-.7-.5-1.1l8.6-7.7z" />
    </svg>
  ) : (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v10h4v-5a3 3 0 016 0v5h4V10" />
    </svg>
  );
}

function ClockIcon({ active }) {
  return active ? (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2a10 10 0 100 20 10 10 0 000-20zm.9 4.5a.9.9 0 10-1.8 0v5.7c0 .25.1.5.28.66l3.3 3a.9.9 0 101.2-1.33L12.9 11.8V6.5z" />
    </svg>
  ) : (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function UserIcon({ active }) {
  return active ? (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8" r="4.2" />
      <path d="M4 20.4C5.4 16.7 8.5 14.7 12 14.7s6.6 2 8 5.7c.2.5-.2 1.1-.7 1.1H4.7c-.5 0-.9-.6-.7-1.1z" />
    </svg>
  ) : (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}
