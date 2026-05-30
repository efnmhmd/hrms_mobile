import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Manager view of annual-leave balances across the reporting team.
//   GET /manager/team/members?includeIndirect=true → { data: [...] }
//   GET /leave/balances/current/:userId            → { data: { entitlementDays, carryOverDays, usedDays, pendingDays?, year? } }
// Remaining = entitlement + carry-over − used (mirrors the employee LeaveBalance
// screen and web LeaveBalanceCards). Balances are fetched per member in
// parallel; a 404 (or any failure) for one member degrades to "not set up"
// without breaking the roster.

const styles = `
  @keyframes tlb-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes tlb-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes tlb-spin { to { transform: rotate(360deg); } }

  .tlb-wrap { padding: 0.85rem 1rem 6rem; }
  .tlb-anim { animation: tlb-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  .tlb-header { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.25rem 0.85rem; }
  .tlb-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18); flex-shrink: 0;
  }
  .tlb-header-text { min-width: 0; flex: 1; }
  .tlb-header-eyebrow { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .tlb-header-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1; font-weight: 400; color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0; }
  .tlb-count { font-size: 0.7rem; color: #7a8e84; margin-left: 0.25rem; }
  .tlb-refresh {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .tlb-refresh:disabled { opacity: 0.55; }
  .tlb-refresh:not(:disabled):active { transform: scale(0.94); }
  .tlb-refresh.is-busy svg { animation: tlb-spin 0.8s linear infinite; }

  /* ── Team summary hero ── */
  .tlb-hero {
    position: relative; overflow: hidden; border-radius: 20px;
    background:
      radial-gradient(ellipse at 0% 0%, rgba(132, 169, 140, 0.32) 0%, transparent 55%),
      radial-gradient(ellipse at 100% 100%, rgba(53, 79, 82, 0.6) 0%, transparent 60%),
      linear-gradient(135deg, #354f52 0%, #52796f 100%);
    padding: 1.05rem 1.15rem; margin-bottom: 0.85rem;
    box-shadow: 0 10px 26px rgba(47, 62, 70, 0.16); color: #cad2c5;
  }
  .tlb-hero-eyebrow { font-size: 0.58rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #9ec0a6; margin: 0 0 0.7rem; }
  .tlb-hero-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
  .tlb-hero-cell { text-align: center; }
  .tlb-hero-num { font-family: 'Cormorant Garamond', serif; font-size: 1.7rem; line-height: 1; font-weight: 500; color: #f0f5f2; font-variant-numeric: tabular-nums; }
  .tlb-hero-lab { margin-top: 4px; font-size: 0.55rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(202, 210, 197, 0.75); }
  .tlb-hero-skel { height: 26px; border-radius: 7px; background: rgba(202, 210, 197, 0.18); animation: tlb-skel 1.2s ease-in-out infinite; }

  /* ── Search + sort ── */
  .tlb-search { position: relative; margin-bottom: 0.6rem; }
  .tlb-search svg { position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%); color: #84a98c; pointer-events: none; }
  .tlb-search input {
    width: 100%; padding: 0.65rem 0.75rem 0.65rem 2.2rem; border-radius: 12px;
    border: 1.5px solid #d4ddd6; background: #fff; font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46;
    -webkit-appearance: none; appearance: none; box-sizing: border-box; -webkit-tap-highlight-color: transparent;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .tlb-search input::placeholder { color: #a7b6ac; }
  .tlb-search input:focus { outline: none; border-color: #52796f; box-shadow: 0 0 0 3px rgba(82, 121, 111, 0.12); }

  .tlb-chips { display: flex; gap: 0.4rem; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 0.85rem; padding-bottom: 4px; }
  .tlb-chips::-webkit-scrollbar { display: none; }
  .tlb-chip {
    flex-shrink: 0; padding: 0.42rem 0.8rem; border-radius: 999px; font-size: 0.74rem; font-weight: 600; letter-spacing: 0.04em;
    border: 1px solid rgba(132, 169, 140, 0.4); background: rgba(255, 255, 255, 0.6); color: #52796f;
    -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .tlb-chip.is-active { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; border-color: transparent; }

  /* ── Member card ── */
  .tlb-card {
    display: flex; align-items: center; gap: 0.7rem; width: 100%; text-align: left;
    padding: 0.7rem 0.8rem; border-radius: 15px; background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    margin-bottom: 0.5rem; font-family: 'DM Sans', sans-serif; cursor: pointer;
    -webkit-tap-highlight-color: transparent; transition: transform 0.12s, background 0.15s;
    border-left: 3px solid transparent;
  }
  .tlb-card:active { transform: scale(0.985); background: #f7f8f6; }
  .tlb-card.is-low { border-left-color: #c0756a; }
  .tlb-card.is-mid { border-left-color: #d8a64c; }
  .tlb-avatar {
    width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 700;
    background: linear-gradient(135deg, rgba(132, 169, 140, 0.28), rgba(82, 121, 111, 0.18)); color: #354f52;
  }
  .tlb-body { min-width: 0; flex: 1; }
  .tlb-name { font-size: 0.88rem; font-weight: 600; color: #2f3e46; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tlb-sub { margin-top: 1px; font-size: 0.7rem; color: #7a8e84; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tlb-bar { margin-top: 0.5rem; height: 6px; border-radius: 999px; background: #eef2ef; overflow: hidden; }
  .tlb-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #52796f, #84a98c); }
  .tlb-bar-fill.is-low { background: linear-gradient(90deg, #c0756a, #d89a8f); }
  .tlb-bar-fill.is-mid { background: linear-gradient(90deg, #c49c4a, #e0c074); }
  .tlb-barmeta { margin-top: 0.35rem; font-size: 0.65rem; color: #7a8e84; display: flex; gap: 0.5rem; }
  .tlb-barmeta strong { color: #52796f; font-weight: 700; }
  .tlb-notset { font-size: 0.68rem; color: #b08a5a; margin-top: 0.4rem; font-style: italic; }

  .tlb-right { flex-shrink: 0; text-align: right; }
  .tlb-rem-num { font-family: 'Cormorant Garamond', serif; font-size: 1.55rem; line-height: 1; font-weight: 500; color: #2f3e46; font-variant-numeric: tabular-nums; }
  .tlb-rem-lab { font-size: 0.52rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #84a98c; margin-top: 2px; }
  .tlb-rem-num.is-low { color: #b85c50; }
  .tlb-rem-dash { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; color: #b8c4bc; }

  /* ── States ── */
  .tlb-skel { height: 84px; border-radius: 15px; background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%); animation: tlb-skel 1.2s ease-in-out infinite; margin-bottom: 0.5rem; }
  .tlb-empty, .tlb-error {
    padding: 2rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(132, 169, 140, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(132, 169, 140, 0.4); text-align: center; color: #52796f;
  }
  .tlb-error { border-color: rgba(192, 117, 106, 0.4); color: #7a3028; background: repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px), rgba(255, 255, 255, 0.55); }
  .tlb-empty-title, .tlb-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .tlb-empty-sub, .tlb-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .tlb-retry { margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none; background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .tlb-retry:active { transform: scale(0.97); }
`;

const SORTS = [
  { key: 'least',  label: 'Least left' },
  { key: 'most',   label: 'Most left' },
  { key: 'name',   label: 'Name' },
  { key: 'used',   label: 'Most used' },
];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function initials(m) {
  const f = (m.firstName || '').trim();
  const l = (m.lastName || '').trim();
  return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || (m.email || '?').charAt(0).toUpperCase();
}

function fullName(m) {
  return `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email || 'Unnamed';
}

// Turn a raw balance payload into the derived figures the card needs.
function deriveBalance(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entitlement = num(raw.entitlementDays ?? raw.totalDays);
  const carryOver = num(raw.carryOverDays);
  const used = num(raw.usedDays ?? raw.daysUsed);
  const pending = num(raw.pendingDays);
  const total = entitlement + carryOver;
  const remaining = Math.max(0, total - used);
  return { entitlement, carryOver, used, pending, total, remaining };
}

export default function ManagerLeaveBalances() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('least');

  async function fetchData(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const membersRes = await api.get('/manager/team/members?includeIndirect=true');
      const members = Array.isArray(membersRes?.data?.data) ? membersRes.data.data : [];

      // Fetch every member's balance in parallel. Per-member catch keeps one
      // missing balance (404) from failing the whole roster.
      const withBalances = await Promise.all(
        members.map(async (m) => {
          const id = m._id || m.id || m.userId;
          if (!id) return { member: m, balance: null };
          try {
            const { data } = await api.get(`/leave/balances/current/${id}`);
            return { member: m, balance: deriveBalance(data?.data || data) };
          } catch {
            return { member: m, balance: null };
          }
        })
      );

      setRows(withBalances);
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

  const totals = useMemo(() => {
    let remaining = 0, used = 0, configured = 0;
    for (const r of rows) {
      if (r.balance) {
        remaining += r.balance.remaining;
        used += r.balance.used;
        configured += 1;
      }
    }
    return { remaining, used, members: rows.length, configured };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter(({ member: m }) => {
        const hay = [fullName(m), m.email, m.department, m.jobTitle, m.role].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    const sorted = [...list];
    const rem = (r) => (r.balance ? r.balance.remaining : Infinity); // unconfigured sink to the bottom for least/most
    sorted.sort((a, b) => {
      switch (sort) {
        case 'most': return (b.balance?.remaining ?? -1) - (a.balance?.remaining ?? -1);
        case 'used': return (b.balance?.used ?? -1) - (a.balance?.used ?? -1);
        case 'name': return fullName(a.member).localeCompare(fullName(b.member));
        case 'least':
        default: return rem(a) - rem(b);
      }
    });
    return sorted;
  }, [rows, search, sort]);

  return (
    <>
      <style>{styles}</style>
      <div className="tlb-wrap">
        <header className="tlb-header tlb-anim">
          <div className="tlb-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <div className="tlb-header-text">
            <p className="tlb-header-eyebrow">Annual Leave</p>
            <h1 className="tlb-header-title">
              Team Balances
              {!loading && !error && <span className="tlb-count"> · {filtered.length}</span>}
            </h1>
          </div>
          <button
            type="button"
            className={`tlb-refresh${refreshing ? ' is-busy' : ''}`}
            onClick={() => fetchData(true)}
            disabled={loading || refreshing}
            aria-label="Refresh balances"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </header>

        {!error && (
          <div className="tlb-hero tlb-anim">
            <p className="tlb-hero-eyebrow">Across your team</p>
            <div className="tlb-hero-grid">
              <div className="tlb-hero-cell">
                {loading ? <div className="tlb-hero-skel" /> : <div className="tlb-hero-num">{fmt(totals.remaining)}</div>}
                <div className="tlb-hero-lab">Days left</div>
              </div>
              <div className="tlb-hero-cell">
                {loading ? <div className="tlb-hero-skel" /> : <div className="tlb-hero-num">{fmt(totals.used)}</div>}
                <div className="tlb-hero-lab">Days used</div>
              </div>
              <div className="tlb-hero-cell">
                {loading ? <div className="tlb-hero-skel" /> : <div className="tlb-hero-num">{totals.members}</div>}
                <div className="tlb-hero-lab">Members</div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <div className="tlb-search tlb-anim">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, department…"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <div className="tlb-chips tlb-anim">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`tlb-chip ${sort === s.key ? 'is-active' : ''}`}
                  onClick={() => setSort(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}

        {loading ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="tlb-skel" />)}
          </div>
        ) : error ? (
          <div className="tlb-error tlb-anim">
            <p className="tlb-error-title">Couldn't load team balances</p>
            <p className="tlb-error-sub">{error}</p>
            <button className="tlb-retry" onClick={() => fetchData()}>Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="tlb-empty tlb-anim">
            <p className="tlb-empty-title">{rows.length === 0 ? 'No team members' : 'No matches'}</p>
            <p className="tlb-empty-sub">
              {rows.length === 0
                ? 'Nobody is currently reporting into you.'
                : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          filtered.map(({ member: m, balance }, i) => {
            const id = m._id || m.id || m.userId;
            const usedPct = balance && balance.total > 0
              ? Math.min(100, Math.round((balance.used / balance.total) * 100))
              : 0;
            // Low: <=25% of allowance left, Mid: <=50% left.
            const remPct = balance && balance.total > 0 ? (balance.remaining / balance.total) * 100 : 100;
            const tone = !balance ? '' : remPct <= 25 ? 'is-low' : remPct <= 50 ? 'is-mid' : '';
            return (
              <button
                key={id || m.email || i}
                type="button"
                className={`tlb-card tlb-anim ${tone}`}
                style={{ animationDelay: `${Math.min(i, 6) * 25}ms` }}
                onClick={() => id && navigate(`/employees/${id}`)}
              >
                <span className="tlb-avatar">{initials(m)}</span>
                <span className="tlb-body">
                  <span className="tlb-name">{fullName(m)}</span>
                  <span className="tlb-sub">
                    {[m.department, m.jobTitle].filter(Boolean).join(' · ') || m.email || ''}
                  </span>
                  {balance ? (
                    <>
                      <span className="tlb-bar">
                        <span className={`tlb-bar-fill ${tone}`} style={{ width: `${usedPct}%` }} />
                      </span>
                      <span className="tlb-barmeta">
                        <span><strong>{fmt(balance.used)}</strong> used</span>
                        <span>of {fmt(balance.total)} days</span>
                        {balance.pending > 0 && <span>· {fmt(balance.pending)} pending</span>}
                      </span>
                    </>
                  ) : (
                    <span className="tlb-notset">Balance not set up</span>
                  )}
                </span>
                <span className="tlb-right">
                  {balance ? (
                    <>
                      <div className={`tlb-rem-num ${tone === 'is-low' ? 'is-low' : ''}`}>{fmt(balance.remaining)}</div>
                      <div className="tlb-rem-lab">Days left</div>
                    </>
                  ) : (
                    <div className="tlb-rem-dash">—</div>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
