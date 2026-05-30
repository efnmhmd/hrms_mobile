import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../utils/api';
import { getErrorMessage } from '../utils/errorHandler';

// Mirrors web's EmployeeProfile.js fetch (line 109):
//   GET /employee-profile/:id  →  employee object (not wrapped)
// Backend field names drift; the helpers below try a few common spellings
// (address1 vs addressLine1, phone vs phoneNumber, etc.) so the detail page
// works regardless of which one the server returns.

const styles = `
  @keyframes ed-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ed-skel {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.9; }
  }

  .ed-wrap { padding: 0.85rem 1rem 6rem; }
  .ed-anim { animation: ed-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Header card ── */
  .ed-hero {
    position: relative;
    overflow: hidden;
    border-radius: 22px;
    background:
      radial-gradient(ellipse at 0% 0%, rgba(132, 169, 140, 0.32) 0%, transparent 55%),
      radial-gradient(ellipse at 100% 100%, rgba(53, 79, 82, 0.55) 0%, transparent 60%),
      linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    padding: 1.1rem 1.1rem 1.15rem;
    box-shadow: 0 12px 30px rgba(47, 62, 70, 0.18);
  }
  .ed-hero-row {
    position: relative; z-index: 1;
    display: flex; align-items: center; gap: 0.85rem;
  }
  .ed-avatar {
    width: 64px; height: 64px;
    border-radius: 50%;
    background: rgba(202, 210, 197, 0.18);
    border: 1px solid rgba(202, 210, 197, 0.30);
    color: #f0f5f2;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.4rem; font-weight: 600;
    letter-spacing: 0.02em;
    flex-shrink: 0;
    backdrop-filter: blur(8px);
  }
  .ed-hero-meta { min-width: 0; flex: 1; }
  .ed-hero-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.65rem; line-height: 1.1; font-weight: 400;
    color: #f0f5f2; letter-spacing: -0.01em;
    margin: 0;
  }
  .ed-hero-job {
    margin-top: 4px;
    font-size: 0.82rem; color: rgba(202, 210, 197, 0.82);
    font-weight: 300;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ed-hero-pills {
    margin-top: 0.6rem;
    display: flex; flex-wrap: wrap; gap: 0.35rem;
  }
  .ed-hero-pill {
    font-size: 0.62rem; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
    background: rgba(202, 210, 197, 0.16);
    border: 1px solid rgba(202, 210, 197, 0.22);
    color: #cad2c5;
    padding: 2px 8px;
    border-radius: 999px;
  }

  /* ── Quick-action row (call / email) ── */
  .ed-actions {
    margin-top: 0.8rem;
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  .ed-action {
    display: flex; align-items: center; justify-content: center; gap: 0.4rem;
    padding: 0.7rem 0.7rem;
    border-radius: 12px;
    background: #fff;
    border: 1px solid rgba(212, 221, 214, 0.7);
    color: #354f52;
    font-size: 0.82rem; font-weight: 600;
    letter-spacing: 0.02em;
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    transition: transform 0.12s, background 0.12s;
  }
  .ed-action:active { transform: scale(0.97); background: #f7f8f6; }
  .ed-action.is-disabled {
    color: #b8c4bc;
    pointer-events: none;
    box-shadow: none;
  }

  /* ── Section card ── */
  .ed-section-title {
    display: inline-flex; align-items: center; gap: 0.55rem;
    padding: 0 0.25rem;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: #52796f;
    margin: 1.2rem 0 0.5rem;
  }
  .ed-section-title::before {
    content: '';
    width: 14px; height: 1.5px;
    background: linear-gradient(90deg, #84a98c, rgba(132, 169, 140, 0));
    border-radius: 1px;
  }
  .ed-card {
    background: #fff;
    border-radius: 16px;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    padding: 0.4rem 0.95rem;
  }
  .ed-row {
    display: flex; align-items: flex-start; gap: 0.85rem;
    padding: 0.65rem 0;
    border-bottom: 1px solid rgba(212, 221, 214, 0.5);
  }
  .ed-row:last-child { border-bottom: none; }
  .ed-row-label {
    flex: 0 0 38%;
    min-width: 0;
    font-size: 0.7rem; font-weight: 600;
    letter-spacing: 0.04em;
    color: #84a98c;
    text-transform: uppercase;
  }
  .ed-row-value {
    flex: 1; min-width: 0;
    font-size: 0.82rem;
    color: #2f3e46;
    word-break: break-word;
  }
  .ed-row-value.is-muted { color: #b8c4bc; }
  .ed-row-link {
    color: #354f52;
    text-decoration: none;
    border-bottom: 1px dashed rgba(53, 79, 82, 0.35);
  }
  .ed-row-link:active { color: #52796f; }

  /* ── States ── */
  .ed-skel-hero {
    height: 130px; border-radius: 22px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: ed-skel 1.2s ease-in-out infinite;
    margin-bottom: 1rem;
  }
  .ed-skel-card {
    height: 90px; border-radius: 16px;
    background: linear-gradient(90deg, #eef2ef 0%, #f6f8f4 50%, #eef2ef 100%);
    animation: ed-skel 1.2s ease-in-out infinite;
    margin-top: 1rem;
  }
  .ed-error {
    margin-top: 1rem;
    padding: 1.75rem 1rem;
    border-radius: 16px;
    background:
      repeating-linear-gradient(135deg, rgba(192, 117, 106, 0.06) 0 6px, transparent 6px 16px),
      rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(192, 117, 106, 0.4);
    text-align: center;
    color: #7a3028;
  }
  .ed-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .ed-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .ed-retry {
    margin-top: 0.85rem;
    padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .ed-retry:active { transform: scale(0.97); }
`;

function initials(emp) {
  if (emp?.initials) return emp.initials;
  const f = (emp?.firstName || '').charAt(0);
  const l = (emp?.lastName || '').charAt(0);
  return (f + l).toUpperCase() || '?';
}

function fullName(emp) {
  return emp?.name ||
    [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim() ||
    emp?.email ||
    'Employee';
}

function jobTitle(emp) {
  return emp?.jobRole || emp?.jobTitle || emp?.position || null;
}

function emailOf(emp)  { return emp?.email || emp?.emailAddress || null; }
function phoneOf(emp)  { return emp?.phone || emp?.phoneNumber || emp?.mobileNumber || emp?.workPhone || null; }

function managerName(emp) {
  if (!emp) return null;
  if (emp.managerName) return emp.managerName;
  const m = emp.manager;
  if (m && typeof m === 'object') {
    return [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || null;
  }
  return null;
}

function organisationName(emp) {
  return emp?.organisationName || emp?.OrganisationName || emp?.office || null;
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function roleLabel(role) {
  if (!role) return null;
  return role.replace(/-/g, ' ');
}

function address(emp) {
  if (!emp) return {};
  return {
    line1: emp.address1 || emp.addressLine1 || emp.address || null,
    line2: emp.address2 || emp.addressLine2 || null,
    line3: emp.address3 || emp.addressLine3 || null,
    city:  emp.townCity || emp.city || null,
    county: emp.county || null,
    postcode: emp.postcode || emp.postalCode || null,
  };
}

function emergency(emp) {
  if (!emp) return {};
  return {
    name:     emp.emergencyContactName || emp.emergencyContact || null,
    relation: emp.emergencyContactRelation || emp.emergencyRelationship || null,
    phone:    emp.emergencyContactPhone || emp.emergencyPhone || emp.emergencyMobile || null,
    email:    emp.emergencyContactEmail || emp.emergencyEmail || null,
  };
}

function hasAny(obj) {
  return Object.values(obj).some((v) => v != null && v !== '');
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchEmployee() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/employee-profile/${id}`);
      // This endpoint returns the object directly (no { data } wrapper).
      setEmp(data || null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) fetchEmployee();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <>
        <style>{styles}</style>
        <div className="ed-wrap">
          <div className="ed-skel-hero" />
          <div className="ed-skel-card" />
          <div className="ed-skel-card" />
          <div className="ed-skel-card" />
        </div>
      </>
    );
  }

  if (error || !emp) {
    return (
      <>
        <style>{styles}</style>
        <div className="ed-wrap">
          <div className="ed-error ed-anim">
            <p className="ed-error-title">Couldn't load this employee</p>
            <p className="ed-error-sub">{error || 'No data returned for this profile.'}</p>
            <button className="ed-retry" onClick={fetchEmployee}>Try again</button>
          </div>
        </div>
      </>
    );
  }

  const email = emailOf(emp);
  const phone = phoneOf(emp);
  const role  = roleLabel(emp.role);
  const dept  = emp.department || null;
  const team  = emp.team || null;
  const org   = organisationName(emp);
  const mgr   = managerName(emp);
  const start = formatDate(emp.startDate || emp.hireDate);
  const dob   = formatDate(emp.dateOfBirth);
  const gender = emp.gender || null;
  const job   = jobTitle(emp);
  const addr  = address(emp);
  const ec    = emergency(emp);

  return (
    <>
      <style>{styles}</style>
      <div className="ed-wrap">
        <div className="ed-hero ed-anim">
          <div className="ed-hero-row">
            <div className="ed-avatar">{initials(emp)}</div>
            <div className="ed-hero-meta">
              <h1 className="ed-hero-name">{fullName(emp)}</h1>
              {job && <div className="ed-hero-job">{job}</div>}
              <div className="ed-hero-pills">
                {role && <span className="ed-hero-pill">{role}</span>}
                {dept && <span className="ed-hero-pill">{dept}</span>}
                {team && <span className="ed-hero-pill">{team}</span>}
              </div>
            </div>
          </div>
        </div>

        {(email || phone) && (
          <div className="ed-actions ed-anim">
            <a className={`ed-action ${email ? '' : 'is-disabled'}`} href={email ? `mailto:${email}` : undefined}>
              <MailIcon />
              Email
            </a>
            <a className={`ed-action ${phone ? '' : 'is-disabled'}`} href={phone ? `tel:${phone}` : undefined}>
              <PhoneIcon />
              Call
            </a>
          </div>
        )}

        {/* Job */}
        <h3 className="ed-section-title">Job</h3>
        <div className="ed-card ed-anim">
          <Row label="Title"        value={job} />
          <Row label="Department"   value={dept} />
          <Row label="Team"         value={team} />
          <Row label="Organisation" value={org} />
          <Row label="Manager"      value={mgr} />
          <Row label="Start date"   value={start} />
          <Row label="Role"         value={role} />
        </div>

        {/* Contact */}
        <h3 className="ed-section-title">Contact</h3>
        <div className="ed-card ed-anim">
          <Row
            label="Email"
            value={email ? <a className="ed-row-link" href={`mailto:${email}`}>{email}</a> : null}
          />
          <Row
            label="Phone"
            value={phone ? <a className="ed-row-link" href={`tel:${phone}`}>{phone}</a> : null}
          />
          <Row label="Gender"        value={gender} />
          <Row label="Date of birth" value={dob} />
        </div>

        {/* Address — only render the card if at least one field is populated */}
        {hasAny(addr) && (
          <>
            <h3 className="ed-section-title">Address</h3>
            <div className="ed-card ed-anim">
              <Row label="Line 1"   value={addr.line1} />
              <Row label="Line 2"   value={addr.line2} />
              <Row label="Line 3"   value={addr.line3} />
              <Row label="City"     value={addr.city} />
              <Row label="County"   value={addr.county} />
              <Row label="Postcode" value={addr.postcode} />
            </div>
          </>
        )}

        {/* Emergency contact */}
        {hasAny(ec) && (
          <>
            <h3 className="ed-section-title">Emergency Contact</h3>
            <div className="ed-card ed-anim">
              <Row label="Name"     value={ec.name} />
              <Row label="Relation" value={ec.relation} />
              <Row
                label="Phone"
                value={ec.phone ? <a className="ed-row-link" href={`tel:${ec.phone}`}>{ec.phone}</a> : null}
              />
              <Row
                label="Email"
                value={ec.email ? <a className="ed-row-link" href={`mailto:${ec.email}`}>{ec.email}</a> : null}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Row({ label, value }) {
  const isEmpty = value == null || value === '';
  return (
    <div className="ed-row">
      <span className="ed-row-label">{label}</span>
      <span className={`ed-row-value ${isEmpty ? 'is-muted' : ''}`}>
        {isEmpty ? '—' : value}
      </span>
    </div>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.25 6.75A2.25 2.25 0 014.5 4.5h15a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0119.5 19.5h-15a2.25 2.25 0 01-2.25-2.25V6.75z" />
      <path d="M2.7 7l8.4 6a1.5 1.5 0 001.8 0l8.4-6" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
