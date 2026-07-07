import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

// A tap-to-open date picker that ALWAYS displays dd/mm/yyyy and shows a calendar
// popup on click — unlike a native <input type="date">, whose display format
// follows the browser locale (mm/dd/yyyy on US devices) and can't be forced.
//
// Drop-in for <input type="date">: `value` and `onChange` speak ISO yyyy-mm-dd,
// so existing form state / payloads keep working unchanged.
//
//   <DateField value={form.startDate} onChange={(iso) => set('startDate', iso)} />
//
// The popup is portaled to <body> because the swipe-back stage transform traps
// & clips position:fixed overlays (see memory: fixed-overlays-need-portal).

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const pad2 = (n) => String(n).padStart(2, '0');
const toIso = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`; // m is 0-based

function parseIso(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const p = iso.slice(0, 10).split('-');
  if (p.length !== 3) return null;
  const y = +p[0], m = +p[1], d = +p[2];
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d };
}

function isoToDisplay(iso) {
  const p = parseIso(iso);
  return p ? `${pad2(p.d)}/${pad2(p.m + 1)}/${p.y}` : '';
}

const CSS = `
.df-trigger {
  width: 100%; box-sizing: border-box;
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
  padding: 0.6rem 0.7rem;
  border: 1.5px solid #d4ddd6; border-radius: 10px;
  background: #fff; color: #2f3e46; font-size: 16px; font-family: inherit;
  text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.df-trigger:disabled { opacity: 0.6; cursor: default; }
.df-trigger.is-open, .df-trigger:focus-visible {
  outline: none; border-color: #84a98c; box-shadow: 0 0 0 3px rgba(132,169,140,0.18);
}
.df-val { color: #2f3e46; }
.df-ph { color: #9bb0a5; }
.df-ico { color: #52796f; flex-shrink: 0; }

.df-pop {
  position: fixed; z-index: 4000; box-sizing: border-box;
  background: #fff; border: 1px solid #e2e8e4; border-radius: 14px;
  box-shadow: 0 18px 40px rgba(47,62,70,0.22);
  padding: 0.6rem; font-family: inherit;
  animation: df-in 0.14s ease both;
}
@keyframes df-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.df-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; }
.df-title { font-size: 0.9rem; font-weight: 600; color: #2f3e46; }
.df-nav {
  width: 32px; height: 32px; border: none; background: #f0f4f1; color: #354f52;
  border-radius: 8px; font-size: 1.25rem; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  -webkit-tap-highlight-color: transparent;
}
.df-nav:active { background: #e0e8e2; }
.df-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.df-wd { margin-bottom: 2px; }
.df-wdc { text-align: center; font-size: 0.62rem; font-weight: 600; color: #84a98c; padding: 0.25rem 0; }
.df-cell {
  aspect-ratio: 1 / 1; border: none; background: transparent; color: #2f3e46;
  border-radius: 8px; font-size: 0.82rem; cursor: pointer; font-family: inherit;
  display: flex; align-items: center; justify-content: center;
  -webkit-tap-highlight-color: transparent; padding: 0;
}
.df-cell:hover:not(:disabled) { background: #eef3ef; }
.df-empty { pointer-events: none; }
.df-cell:disabled { color: #cbd5cd; cursor: default; }
.df-cell.is-today { box-shadow: inset 0 0 0 1.5px #b5c9bd; }
.df-cell.is-sel, .df-cell.is-sel:hover {
  background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #fff; font-weight: 600;
}
.df-foot {
  display: flex; justify-content: space-between; margin-top: 0.4rem;
  padding-top: 0.4rem; border-top: 1px solid #eef2ef;
}
.df-fbtn {
  border: none; background: transparent; color: #52796f; font-size: 0.78rem;
  font-weight: 600; cursor: pointer; padding: 0.3rem 0.5rem; border-radius: 6px;
  font-family: inherit; -webkit-tap-highlight-color: transparent;
}
.df-fbtn:active { background: #f0f4f1; }
.df-today { color: #354f52; }
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('df-styles')) return;
  const el = document.createElement('style');
  el.id = 'df-styles';
  el.textContent = CSS;
  document.head.appendChild(el);
}

export default function DateField({
  value,
  onChange,
  min,
  max,
  placeholder = 'dd/mm/yyyy',
  className = '',
  disabled = false,
  id,
}) {
  ensureStyles();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const p = parseIso(value);
    const now = new Date();
    return p ? { y: p.y, m: p.m } : { y: now.getFullYear(), m: now.getMonth() };
  });
  const [pos, setPos] = useState({ top: 0, left: 0, width: 304 });
  const triggerRef = useRef(null);
  const popRef = useRef(null);

  // On open, jump the calendar to the selected month (or today).
  useEffect(() => {
    if (!open) return;
    const p = parseIso(value);
    const now = new Date();
    setView(p ? { y: p.y, m: p.m } : { y: now.getFullYear(), m: now.getMonth() });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Position the (fixed) popup relative to the trigger; follow scroll/resize.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return undefined;
    const compute = () => {
      const r = triggerRef.current.getBoundingClientRect();
      const width = Math.min(304, window.innerWidth - 16);
      const popupH = 348;
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow >= popupH + 8 || spaceBelow >= r.top
        ? r.bottom + 6
        : Math.max(8, r.top - popupH - 6);
      let left = r.left;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - 8 - width;
      if (left < 8) left = 8;
      setPos({ top, left, width });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open]);

  // Close on outside tap / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const sel = parseIso(value);
  const now = new Date();
  const todayKey = toIso(now.getFullYear(), now.getMonth(), now.getDate());
  const minKey = min ? min.slice(0, 10) : null;
  const maxKey = max ? max.slice(0, 10) : null;

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const firstDow = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Monday-first
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const isDisabled = (iso) => (minKey && iso < minKey) || (maxKey && iso > maxKey);

  const pick = (d) => {
    const iso = toIso(view.y, view.m, d);
    if (isDisabled(iso)) return;
    onChange?.(iso);
    setOpen(false);
  };

  const shift = (delta) => {
    setView((v) => {
      const raw = v.m + delta;
      const y = v.y + Math.floor(raw / 12);
      const m = ((raw % 12) + 12) % 12;
      return { y, m };
    });
  };

  const display = isoToDisplay(value);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        id={id}
        className={`df-trigger${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className={display ? 'df-val' : 'df-ph'}>{display || placeholder}</span>
        <svg className="df-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3 9h18M8 2.5v4M16 2.5v4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      {open && createPortal(
        <div className="df-pop" ref={popRef} style={{ top: pos.top, left: pos.left, width: pos.width }}>
          <div className="df-head">
            <button type="button" className="df-nav" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
            <div className="df-title">{MONTHS[view.m]} {view.y}</div>
            <button type="button" className="df-nav" onClick={() => shift(1)} aria-label="Next month">›</button>
          </div>
          <div className="df-grid df-wd">
            {WEEKDAYS.map((w) => <div key={w} className="df-wdc">{w}</div>)}
          </div>
          <div className="df-grid">
            {cells.map((d, i) => {
              if (d == null) return <div key={`b${i}`} className="df-cell df-empty" />;
              const iso = toIso(view.y, view.m, d);
              const isSel = sel && sel.y === view.y && sel.m === view.m && sel.d === d;
              return (
                <button
                  key={iso}
                  type="button"
                  className={`df-cell${isSel ? ' is-sel' : ''}${iso === todayKey ? ' is-today' : ''}`}
                  disabled={isDisabled(iso)}
                  onClick={() => pick(d)}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="df-foot">
            <button type="button" className="df-fbtn" onClick={() => { onChange?.(''); setOpen(false); }}>Clear</button>
            <button
              type="button"
              className="df-fbtn df-today"
              onClick={() => { if (!isDisabled(todayKey)) { onChange?.(todayKey); setOpen(false); } }}
            >
              Today
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
