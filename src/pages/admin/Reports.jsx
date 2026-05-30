import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../utils/api';
import { getErrorMessage } from '../../utils/errorHandler';

// Report Library. Pulls a live workforce snapshot (headcount / active / present)
// and presents a catalogue of reports. Most cards route to the relevant screen;
// the employee directory can be exported to CSV directly from the device.

const styles = `
  @keyframes rp-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes rp-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
  @keyframes rp-spin { to { transform: rotate(360deg); } }

  .rp-wrap { padding: 0.85rem 1rem 6rem; }
  .rp-anim { animation: rp-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  .rp-header { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.25rem 0.85rem; }
  .rp-header-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(53,79,82,0.18); flex-shrink: 0;
  }
  .rp-header-text { min-width: 0; flex: 1; }
  .rp-header-eyebrow { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0; }
  .rp-header-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; line-height: 1.1; font-weight: 400; color: #2f3e46; letter-spacing: -0.01em; margin: 0.1rem 0 0; }
  .rp-refresh-btn {
    flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 10px;
    border: 1px solid rgba(212, 221, 214, 0.7); background: #fff; color: #354f52;
    cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 0.15s, transform 0.12s;
  }
  .rp-refresh-btn:active { background: #f1f4f0; transform: scale(0.95); }
  .rp-refresh-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .rp-refresh-btn.is-spinning svg { animation: rp-spin 0.9s linear infinite; }

  /* ── Snapshot ── */
  .rp-snap {
    border-radius: 18px; padding: 1rem 1.1rem; margin-bottom: 1rem;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; box-shadow: 0 10px 26px rgba(47, 62, 70, 0.16);
    position: relative; overflow: hidden;
  }
  .rp-snap-eyebrow { font-size: 0.58rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #84a98c; margin: 0 0 0.7rem; }
  .rp-snap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
  .rp-snap-cell { text-align: center; }
  .rp-snap-num { font-family: 'Cormorant Garamond', serif; font-size: 1.75rem; line-height: 1; font-weight: 500; color: #f0f5f2; font-variant-numeric: tabular-nums; }
  .rp-snap-lab { margin-top: 4px; font-size: 0.56rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(202, 210, 197, 0.75); }
  .rp-snap-skel { height: 28px; border-radius: 7px; background: rgba(202, 210, 197, 0.18); animation: rp-skel 1.2s ease-in-out infinite; }

  .rp-section { display: inline-flex; align-items: center; gap: 0.55rem; padding: 0 0.25rem; font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #52796f; margin-bottom: 0.6rem; }
  .rp-section::before { content: ''; width: 14px; height: 1.5px; background: linear-gradient(90deg, #84a98c, rgba(132, 169, 140, 0)); border-radius: 1px; }

  .rp-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .rp-card {
    display: flex; align-items: center; gap: 0.75rem; width: 100%; text-align: left;
    padding: 0.8rem 0.85rem; border-radius: 14px; background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7); box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    font-family: 'DM Sans', sans-serif; cursor: pointer; -webkit-tap-highlight-color: transparent;
    transition: transform 0.12s, background 0.15s;
  }
  .rp-card:active { transform: scale(0.98); background: #f7f8f6; }
  .rp-card:disabled { opacity: 0.6; cursor: default; }
  .rp-card-glyph { width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(132, 169, 140, 0.22), rgba(82, 121, 111, 0.14)); color: #354f52; }
  .rp-card-main { min-width: 0; flex: 1; }
  .rp-card-title { font-size: 0.88rem; font-weight: 600; color: #2f3e46; line-height: 1.2; }
  .rp-card-sub { margin-top: 2px; font-size: 0.7rem; color: #7a8e84; line-height: 1.35; }
  .rp-card-action { flex-shrink: 0; color: #84a98c; display: flex; align-items: center; }
  .rp-card.is-export .rp-card-glyph { background: linear-gradient(135deg, rgba(82, 121, 111, 0.24), rgba(53, 79, 82, 0.16)); }
  .rp-mini-spin { width: 16px; height: 16px; border: 2px solid #84a98c; border-top-color: transparent; border-radius: 50%; animation: rp-spin 0.7s linear infinite; }

  .rp-toast { margin-bottom: 0.85rem; padding: 0.6rem 0.85rem; border-radius: 12px; font-size: 0.78rem; font-weight: 500; background: linear-gradient(135deg, #f0f5f2, #eaf2ec); border-left: 3px solid #52796f; color: #2f3e46; }
  .rp-toast.is-error { background: linear-gradient(135deg, #fdf3f2, #fdecea); border-left-color: #c0756a; color: #7a3028; }
`;

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Reports() {
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith('/manager') ? '/manager' : '/admin';

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  async function fetchSnapshot() {
    setLoading(true);
    try {
      const [empRes, attRes] = await Promise.all([
        api.get('/employees?includeAdmins=true').catch(() => null),
        api.get('/clock/attendance-status').catch(() => null),
      ]);
      const employees =
        empRes?.data?.data || empRes?.data?.employees ||
        (Array.isArray(empRes?.data) ? empRes.data : []);
      const active = employees.filter((m) => m.isActive !== false && m.status !== 'Terminated').length;
      const present = Number(attRes?.data?.data?.summary?.present ?? attRes?.data?.data?.summary?.clockedIn ?? 0);
      setSnapshot({ headcount: employees.length, active, present, employees });
    } catch {
      setSnapshot({ headcount: 0, active: 0, present: 0, employees: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSnapshot();
  }, []);

  function flash(text, kind = 'success') {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3000);
  }

  async function exportDirectory() {
    setExporting(true);
    try {
      let employees = snapshot?.employees;
      if (!employees || employees.length === 0) {
        const res = await api.get('/employees?includeAdmins=true');
        employees = res?.data?.data || res?.data?.employees || (Array.isArray(res?.data) ? res.data : []);
      }
      if (!employees || employees.length === 0) {
        flash('No employees to export.', 'error');
        return;
      }
      const header = ['First name', 'Last name', 'Email', 'Job title', 'Department', 'Status'];
      const rows = [header, ...employees.map((e) => [
        e.firstName, e.lastName, e.email, e.jobTitle || e.role, e.department || e.team,
        e.isActive === false || e.status === 'Terminated' ? 'Inactive' : 'Active',
      ])];
      downloadCsv('employee-directory.csv', rows);
      flash(`Exported ${employees.length} employees to CSV.`);
    } catch (err) {
      flash(getErrorMessage(err), 'error');
    } finally {
      setExporting(false);
    }
  }

  const reports = useMemo(() => [
    {
      key: 'attendance',
      title: 'Attendance & time',
      sub: 'Clock-in history and worked hours',
      glyph: 'clock',
      to: `${base}/time-history`,
    },
    {
      key: 'clock-status',
      title: 'Live workforce status',
      sub: "Who's in, on break, or out right now",
      glyph: 'pulse',
      to: `${base}/clock-ins`,
    },
    {
      key: 'expenses',
      title: 'Expense report',
      sub: 'Spend by status and category',
      glyph: 'receipt',
      to: `${base}/expenses`,
    },
    {
      key: 'performance',
      title: 'Performance summary',
      sub: 'Objective completion across the team',
      glyph: 'chart',
      to: `${base}/performance`,
    },
    {
      key: 'directory',
      title: 'Employee directory',
      sub: 'Export full directory as CSV',
      glyph: 'download',
      export: true,
    },
  ], [base]);

  return (
    <>
      <style>{styles}</style>
      <div className="rp-wrap">
        <header className="rp-header rp-anim">
          <div className="rp-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 17v-2m3 2v-4m3 4v-6" />
            </svg>
          </div>
          <div className="rp-header-text">
            <p className="rp-header-eyebrow">Reporting</p>
            <h1 className="rp-header-title">Report Library</h1>
          </div>
          <button
            type="button"
            className={`rp-refresh-btn${loading ? ' is-spinning' : ''}`}
            onClick={fetchSnapshot}
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

        {toast && <div className={`rp-toast rp-anim${toast.kind === 'error' ? ' is-error' : ''}`}>{toast.text}</div>}

        <div className="rp-snap rp-anim">
          <p className="rp-snap-eyebrow">Today's snapshot</p>
          <div className="rp-snap-grid">
            <div className="rp-snap-cell">
              {loading ? <div className="rp-snap-skel" /> : <div className="rp-snap-num">{snapshot?.headcount ?? 0}</div>}
              <div className="rp-snap-lab">Headcount</div>
            </div>
            <div className="rp-snap-cell">
              {loading ? <div className="rp-snap-skel" /> : <div className="rp-snap-num">{snapshot?.active ?? 0}</div>}
              <div className="rp-snap-lab">Active</div>
            </div>
            <div className="rp-snap-cell">
              {loading ? <div className="rp-snap-skel" /> : <div className="rp-snap-num">{snapshot?.present ?? 0}</div>}
              <div className="rp-snap-lab">Present</div>
            </div>
          </div>
        </div>

        <h3 className="rp-section rp-anim">Reports</h3>
        <div className="rp-list rp-anim">
          {reports.map((r, i) => (
            <button
              key={r.key}
              type="button"
              className={`rp-card${r.export ? ' is-export' : ''}`}
              style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}
              onClick={() => (r.export ? exportDirectory() : navigate(r.to))}
              disabled={r.export && exporting}
            >
              <span className="rp-card-glyph"><ReportGlyph name={r.glyph} /></span>
              <span className="rp-card-main">
                <span className="rp-card-title">{r.title}</span>
                <span className="rp-card-sub">{r.sub}</span>
              </span>
              <span className="rp-card-action">
                {r.export ? (
                  exporting ? <span className="rp-mini-spin" /> : <DownloadArrow />
                ) : (
                  <Chevron />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
function DownloadArrow() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}
function ReportGlyph({ name }) {
  const paths = {
    clock: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM12 6v6l4 2',
    pulse: 'M22 12h-4l-3 9L9 3l-3 9H2',
    receipt: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    chart: 'M12 20V10M18 20V4M6 20v-4',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  };
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] || paths.chart} />
    </svg>
  );
}
