import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUser, getUserGroup, USER_GROUPS } from '../utils/auth';

const GROUP_LABEL = {
  [USER_GROUPS.ADMIN]: 'Administrator',
  [USER_GROUPS.MANAGER]: 'Manager',
  [USER_GROUPS.EMPLOYEE]: 'Employee',
};

// Single-path SVG icons keyed by name. Each menu item references one of these.
// Paths come from the same Feather-style set used by web UserSidebar / Heroicons.
const ICON_PATHS = {
  home:          'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  profile:       'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  clock:         'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM12 6v6l4 2',
  elearning:     'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M20 22V6a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 6.5v13z',
  shifts:        'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  documents:     'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  performance:   'M12 20V10M18 20V4M6 20v-4',
  calendar:      'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z',
  expenses:      'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
  notifications: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  users:         'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  approvals:     'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  archive:       'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
  orgChart:      'M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 8v4M6 18l6-6 6 6',
  team:          'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M17 3.13a4 4 0 0 1 0 7.75',
  leave:         'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18',
  reports:       'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 17v-2m3 2v-4m3 4v-6',
  history:       'M3 12a9 9 0 1 0 9-9 9.74 9.74 0 0 0-7 3L3 8M3 3v5h5M12 7v5l4 2',
};

function Glyph({ name }) {
  const d = ICON_PATHS[name] || ICON_PATHS.home;
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// Convenience for menu items whose target screen hasn't been built yet.
// Renders the ComingSoon page (registered in App.jsx) with the feature label.
export const soon = (feature) => `/soon?feature=${encodeURIComponent(feature)}`;

const styles = `
  @keyframes home-fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes home-pulse {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50%      { opacity: 0.8; transform: scale(1.08); }
  }
  .home-anim { animation: home-fadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .home-d1 { animation-delay: 0.05s; }
  .home-d2 { animation-delay: 0.12s; }
  .home-d3 { animation-delay: 0.19s; }
  .home-d4 { animation-delay: 0.26s; }
  .home-d5 { animation-delay: 0.33s; }
  .home-d6 { animation-delay: 0.40s; }

  /* ── Hero greeting card (mirrors Login left-panel mood) ── */
  .home-hero {
    position: relative;
    overflow: hidden;
    border-radius: 24px;
    background:
      radial-gradient(ellipse at 0% 0%, rgba(132, 169, 140, 0.35) 0%, transparent 55%),
      radial-gradient(ellipse at 100% 100%, rgba(53, 79, 82, 0.65) 0%, transparent 60%),
      linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    padding: 1.25rem 1.25rem 1.35rem;
    box-shadow: 0 12px 30px rgba(47, 62, 70, 0.18);
  }
  .home-hero::before {
    content: '';
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(202, 210, 197, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(202, 210, 197, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
  }
  .home-hero-orb {
    position: absolute;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: #84a98c;
    filter: blur(60px);
    opacity: 0.30;
    top: -70px; right: -50px;
    pointer-events: none;
    animation: home-pulse 7s ease-in-out infinite;
  }
  .home-hero-orb-2 {
    position: absolute;
    width: 140px; height: 140px;
    border-radius: 50%;
    background: #cad2c5;
    filter: blur(50px);
    opacity: 0.12;
    bottom: -50px; left: -30px;
    pointer-events: none;
  }
  .home-hero-inner { position: relative; z-index: 1; }
  .home-eyebrow {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.65rem; font-weight: 500;
    letter-spacing: 0.22em; text-transform: uppercase;
    color: #84a98c;
  }
  .home-hero-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: 2rem; line-height: 1.05;
    font-weight: 400; letter-spacing: -0.01em;
    color: #f0f5f2; margin: 0.35rem 0 0;
  }
  .home-hero-date {
    margin-top: 0.85rem;
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-size: 0.72rem; font-weight: 400;
    color: rgba(202, 210, 197, 0.85);
    background: rgba(202, 210, 197, 0.08);
    border: 1px solid rgba(202, 210, 197, 0.15);
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    backdrop-filter: blur(8px);
  }
  .home-hero-date-dot {
    width: 5px; height: 5px; border-radius: 50%; background: #84a98c;
    animation: home-pulse 2.5s ease-in-out infinite;
  }

  /* ── Section header with hair-line accent ── */
  .home-section-title {
    display: inline-flex; align-items: center; gap: 0.55rem;
    padding: 0 0.25rem;
    font-family: 'DM Sans', sans-serif;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: #52796f;
  }
  .home-section-title::before {
    content: '';
    width: 14px; height: 1.5px;
    background: linear-gradient(90deg, #84a98c, rgba(132, 169, 140, 0));
    border-radius: 1px;
  }

  /* ── Menu item card ── */
  .home-menu-item {
    position: relative;
    display: flex; flex-direction: column;
    align-items: center; justify-content: flex-start;
    gap: 0.55rem;
    padding: 0.85rem 0.4rem 0.7rem;
    border-radius: 18px;
    background: #ffffff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04), 0 4px 12px rgba(47, 62, 70, 0.05);
    transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1),
                box-shadow 0.18s ease,
                background 0.18s ease;
    -webkit-tap-highlight-color: transparent;
    text-decoration: none;
  }
  .home-menu-item:active {
    transform: scale(0.95);
    background: #f7f8f6;
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
  }
  .home-menu-glyph {
    display: flex; align-items: center; justify-content: center;
    width: 42px; height: 42px;
    border-radius: 13px;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.18), rgba(82, 121, 111, 0.12));
    color: #354f52;
  }
  .home-menu-label {
    text-align: center;
    font-size: 11px; font-weight: 500;
    line-height: 1.25; color: #2f3e46;
  }

  /* ── Empty placeholder ── */
  .home-empty {
    position: relative;
    border-radius: 18px;
    background:
      repeating-linear-gradient(
        135deg,
        rgba(132, 169, 140, 0.06) 0 6px,
        transparent 6px 16px
      ),
      rgba(255, 255, 255, 0.5);
    border: 1px dashed rgba(132, 169, 140, 0.4);
    padding: 1.1rem 1rem;
    text-align: center;
  }
  .home-empty-glyph {
    width: 30px; height: 30px;
    margin: 0 auto 0.45rem;
    border-radius: 10px;
    background: rgba(132, 169, 140, 0.14);
    display: flex; align-items: center; justify-content: center;
    color: #52796f;
  }
  .home-empty-text {
    font-size: 0.72rem; font-weight: 500;
    color: #52796f; letter-spacing: 0.04em;
  }
  .home-empty-sub {
    margin-top: 2px;
    font-size: 0.65rem; color: #84a98c;
    font-weight: 400; letter-spacing: 0.02em;
  }
`;

export default function DashboardShell({ sections, topSlot = null }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const firstName = user?.firstName || 'there';
  const group = user ? getUserGroup(user) : null;
  const groupLabel = group ? GROUP_LABEL[group] : null;

  return (
    <>
      <style>{styles}</style>
      <div className="px-4 pt-4 pb-28">
        <div className="home-hero home-anim home-d1">
          <div className="home-hero-orb" />
          <div className="home-hero-orb-2" />
          <div className="home-hero-inner">
            <p className="home-eyebrow">{greeting()}</p>
            <h2 className="home-hero-name">{firstName}</h2>
            <div className="home-hero-date">
              <span className="home-hero-date-dot" />
              {groupLabel ? `${groupLabel} · ${formatToday()}` : formatToday()}
            </div>
          </div>
        </div>

        {topSlot && <div className="mt-5">{topSlot}</div>}

        <div className="mt-6 flex flex-col gap-6">
          {sections.map((section, i) => (
            <div key={section.title} className={`home-anim home-d${i + 2}`}>
              <Section title={section.title} items={section.items} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Section({ title, items }) {
  return (
    <section>
      <h3 className="home-section-title mb-2.5">{title}</h3>

      {items.length === 0 ? (
        <div className="home-empty">
          <div className="home-empty-glyph">
            <SparkleIcon />
          </div>
          <div className="home-empty-text">Coming soon</div>
          <div className="home-empty-sub">Items will appear here</div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => (
            <MenuItem key={item.key} {...item} />
          ))}
        </div>
      )}
    </section>
  );
}

function MenuItem({ label, icon, to }) {
  return (
    <Link to={to} className="home-menu-item">
      <span className="home-menu-glyph"><Glyph name={icon} /></span>
      <span className="home-menu-label">{label}</span>
    </Link>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
