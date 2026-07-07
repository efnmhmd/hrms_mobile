import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import { getErrorMessage } from '../utils/errorHandler';
import { getUser, getUserGroup, USER_GROUPS } from '../utils/auth';

// Mirrors web's EmployeeProfile.js fetch (line 109):
//   GET /employee-profile/:id  →  employee object (not wrapped)
// Backend field names drift; the helpers below try a few common spellings
// (address1 vs addressLine1, phone vs phoneNumber, etc.) so the detail page
// works regardless of which one the server returns.
//
// Admins and managers can also EDIT the record from here. Writes go to
//   PUT /employees/:id   (the EmployeeHub _id — same id used to reach this page)
// and the backend (employeeHubController.updateEmployee) enforces scope: admins
// edit anyone, managers only their team (else 403). We deliberately expose only
// non-restricted fields — role/status/manager changes stay on the web app, so a
// manager never trips the "Managers cannot modify …" guard. jobTitle/department/
// firstName/lastName/email are required by the schema, so blank values are
// skipped rather than written (an empty required field 400s on save).

const RELATIONSHIP_OPTIONS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Partner', 'Other'];

// Field spec per section. `edit` marks admin/manager-editable fields; `required`
// fields are skipped from the PUT when blank (they can't be cleared). `read`
// lists fallback spellings the server may return; `save` lists the backend
// key(s) a value writes to.
const SECTIONS = [
  {
    id: 'basic',
    title: 'Basic Details',
    fields: [
      { key: 'title', label: 'Title', edit: true, read: ['title'], save: ['title'] },
      { key: 'firstName', label: 'First name', edit: true, required: true, read: ['firstName'], save: ['firstName'] },
      { key: 'middleName', label: 'Middle name', edit: true, read: ['middleName'], save: ['middleName'] },
      { key: 'lastName', label: 'Last name', edit: true, required: true, read: ['lastName'], save: ['lastName'] },
      { key: 'gender', label: 'Gender', read: ['gender'] },
      { key: 'dateOfBirth', label: 'Date of birth', type: 'date', read: ['dateOfBirth'] },
    ],
  },
  {
    id: 'job',
    title: 'Job',
    fields: [
      { key: 'jobTitle', label: 'Job title', edit: true, required: true, read: ['jobRole', 'jobTitle', 'position'], save: ['jobTitle'] },
      { key: 'department', label: 'Department', edit: true, required: true, read: ['department'], save: ['department'] },
      { key: 'team', label: 'Team', read: ['team'] },
      { key: 'organisation', label: 'Organisation', get: organisationName },
      { key: 'manager', label: 'Manager', get: managerName },
      { key: 'startDate', label: 'Start date', type: 'date', read: ['startDate', 'hireDate'] },
      { key: 'role', label: 'Role', type: 'role', read: ['role'] },
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    fields: [
      { key: 'email', label: 'Email', type: 'email', edit: true, required: true, read: ['email', 'emailAddress'], save: ['email'] },
      { key: 'phone', label: 'Phone', type: 'tel', edit: true, read: ['phone', 'mobileNumber', 'phoneNumber', 'workPhone'], save: ['phone', 'workPhone'] },
    ],
  },
  {
    id: 'address',
    title: 'Address',
    optional: true,
    fields: [
      { key: 'address1', label: 'Address line 1', edit: true, read: ['address1', 'addressLine1', 'address'], save: ['address1'] },
      { key: 'address2', label: 'Address line 2', edit: true, read: ['address2', 'addressLine2'], save: ['address2'] },
      { key: 'address3', label: 'Address line 3', edit: true, read: ['address3', 'addressLine3'], save: ['address3'] },
      { key: 'townCity', label: 'Town / City', edit: true, read: ['townCity', 'city'], save: ['townCity'] },
      { key: 'county', label: 'County', edit: true, read: ['county'], save: ['county'] },
      { key: 'postcode', label: 'Postcode', edit: true, read: ['postcode', 'postalCode'], save: ['postcode'] },
    ],
  },
  {
    id: 'emergency',
    title: 'Emergency Contact',
    optional: true,
    fields: [
      { key: 'emergencyContactName', label: 'Name', edit: true, read: ['emergencyContactName', 'emergencyContact'], save: ['emergencyContactName'] },
      { key: 'emergencyContactRelation', label: 'Relationship', type: 'select', options: RELATIONSHIP_OPTIONS, edit: true, read: ['emergencyContactRelation', 'emergencyRelationship'], save: ['emergencyContactRelation'] },
      { key: 'emergencyContactPhone', label: 'Phone', type: 'tel', edit: true, read: ['emergencyContactPhone', 'emergencyPhone', 'emergencyMobile'], save: ['emergencyContactPhone'] },
      { key: 'emergencyContactEmail', label: 'Email', type: 'email', edit: true, read: ['emergencyContactEmail', 'emergencyEmail'], save: ['emergencyContactEmail'] },
    ],
  },
];

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

  /* ── Section header (title + edit affordance) ── */
  .ed-section-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.5rem; margin: 1.2rem 0.25rem 0.5rem;
  }
  .ed-section-title {
    display: inline-flex; align-items: center; gap: 0.55rem;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: #52796f;
    margin: 0;
  }
  .ed-section-title::before {
    content: '';
    width: 14px; height: 1.5px;
    background: linear-gradient(90deg, #84a98c, rgba(132, 169, 140, 0));
    border-radius: 1px;
  }
  .ed-edit-btn {
    -webkit-tap-highlight-color: transparent;
    display: inline-flex; align-items: center; gap: 0.3rem;
    background: none; border: none; cursor: pointer;
    font-size: 0.72rem; font-weight: 600; letter-spacing: 0.02em; color: #52796f;
    padding: 4px 8px; border-radius: 8px;
  }
  .ed-edit-btn:active { background: rgba(132,169,140,0.14); }
  .ed-edit-actions { display: flex; align-items: center; gap: 0.4rem; }
  .ed-btn {
    -webkit-tap-highlight-color: transparent;
    font-size: 0.74rem; font-weight: 600; letter-spacing: 0.02em;
    padding: 0.42rem 0.85rem; border-radius: 999px; border: none; cursor: pointer;
  }
  .ed-btn:disabled { opacity: 0.55; }
  .ed-btn-save { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; }
  .ed-btn-save:active { transform: scale(0.97); }
  .ed-btn-cancel { background: #eef2ef; color: #52796f; }

  .ed-card {
    background: #fff;
    border-radius: 16px;
    border: 1px solid rgba(212, 221, 214, 0.7);
    box-shadow: 0 1px 2px rgba(47, 62, 70, 0.04);
    padding: 0.4rem 0.95rem;
  }
  .ed-card.is-editing { border-color: rgba(82,121,111,0.55); box-shadow: 0 0 0 3px rgba(82,121,111,0.10); }
  .ed-row {
    display: flex; align-items: flex-start; gap: 0.85rem;
    padding: 0.65rem 0;
    border-bottom: 1px solid rgba(212, 221, 214, 0.5);
  }
  .ed-row.is-edit { flex-direction: column; gap: 0.4rem; }
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

  .ed-input, .ed-select {
    width: 100%; box-sizing: border-box;
    padding: 0.62rem 0.7rem; border: 1.5px solid #d4ddd6; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46; background: #fff;
    outline: none; -webkit-appearance: none; appearance: none;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .ed-input:focus, .ed-select:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }

  .ed-save-error {
    margin-top: 0.6rem; font-size: 0.75rem; color: #b85c50; font-weight: 500;
    display: flex; align-items: center; gap: 0.35rem;
  }
  .ed-empty-note { padding: 0.5rem 0; font-size: 0.78rem; color: #b8c4bc; }

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

export default function EmployeeDetail() {
  const { id } = useParams();
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canManage, setCanManage] = useState(false);

  const [editingSection, setEditingSection] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  async function fetchEmployee() {
    setLoading(true);
    setError(null);
    setEditingSection(null);
    try {
      const { data } = await api.get(`/employee-profile/${id}`);
      // This endpoint returns the object directly (no { data } wrapper).
      setEmp(unwrap(data) || null);
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

  // Only admins and managers get edit affordances. The backend still has the
  // final say (a manager editing outside their team gets a 403 we surface).
  useEffect(() => {
    (async () => {
      const group = getUserGroup(await getUser());
      setCanManage(group === USER_GROUPS.ADMIN || group === USER_GROUPS.MANAGER);
    })();
  }, []);

  function startEdit(section) {
    const d = {};
    section.fields.forEach((f) => {
      if (f.edit) d[f.key] = readRaw(emp, f);
    });
    setEditData(d);
    setSaveError(null);
    setEditingSection(section.id);
  }

  function cancelEdit() {
    setEditingSection(null);
    setEditData({});
    setSaveError(null);
  }

  async function saveSection(section) {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {};
      section.fields.forEach((f) => {
        if (!f.edit) return;
        const val = (editData[f.key] ?? '').toString().trim();
        // Required schema fields can't be cleared — skip when blank so the
        // save doesn't 400 on a missing required value.
        if (!val && f.required) return;
        (f.save || [f.key]).forEach((k) => { payload[k] = val; });
      });

      if (Object.keys(payload).length === 0) {
        cancelEdit();
        return;
      }

      const { data } = await api.put(`/employees/${id}`, payload);
      const updated = unwrap(data);
      setEmp((prev) => (isRecord(updated) ? { ...prev, ...updated } : { ...prev, ...payload }));
      setEditingSection(null);
      setEditData({});
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

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
  const job   = jobTitle(emp);

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

        {SECTIONS.map((section) => {
          const isEditing = editingSection === section.id;
          const sectionEditable = canManage && section.fields.some((f) => f.edit);
          const populated = section.fields.some((f) => readRaw(emp, f) !== '');

          // Optional sections (address / emergency) stay hidden for plain
          // viewers when empty, but managers/admins always see them so missing
          // details can be filled in.
          if (section.optional && !populated && !isEditing && !sectionEditable) {
            return null;
          }

          return (
            <div key={section.id}>
              <div className="ed-section-head">
                <span className="ed-section-title">{section.title}</span>
                {sectionEditable && (
                  isEditing ? (
                    <div className="ed-edit-actions">
                      <button className="ed-btn ed-btn-cancel" onClick={cancelEdit} disabled={saving}>
                        Cancel
                      </button>
                      <button className="ed-btn ed-btn-save" onClick={() => saveSection(section)} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  ) : (
                    editingSection === null && (
                      <button className="ed-edit-btn" onClick={() => startEdit(section)}>
                        <PencilIcon /> Edit
                      </button>
                    )
                  )
                )}
              </div>

              <div className={`ed-card ed-anim ${isEditing ? 'is-editing' : ''}`}>
                {section.optional && !populated && !isEditing ? (
                  <div className="ed-empty-note">No information on record.</div>
                ) : (
                  section.fields.map((field) => (
                    <DetailRow
                      key={field.key}
                      field={field}
                      src={emp}
                      isEditing={isEditing && field.edit}
                      value={editData[field.key]}
                      onChange={(v) => setEditData((p) => ({ ...p, [field.key]: v }))}
                    />
                  ))
                )}
                {isEditing && saveError && (
                  <div className="ed-save-error">
                    <AlertIcon />
                    {saveError}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DetailRow({ field, src, isEditing, value, onChange }) {
  if (isEditing) {
    return (
      <div className="ed-row is-edit">
        <span className="ed-row-label">{field.label}</span>
        {field.type === 'select' ? (
          <select className="ed-select" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select {field.label.toLowerCase()}</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            className="ed-input"
            type={inputType(field.type)}
            inputMode={inputMode(field.type)}
            autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
            autoCorrect="off"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        )}
      </div>
    );
  }

  const raw = readRaw(src, field);
  const isEmpty = raw === '';
  let display = fmt(raw, field);
  if (!isEmpty && field.type === 'email') display = <a className="ed-row-link" href={`mailto:${raw}`}>{raw}</a>;
  else if (!isEmpty && field.type === 'tel') display = <a className="ed-row-link" href={`tel:${raw}`}>{raw}</a>;

  return (
    <div className="ed-row">
      <span className="ed-row-label">{field.label}</span>
      <span className={`ed-row-value ${isEmpty ? 'is-muted' : ''}`}>{isEmpty ? '—' : display}</span>
    </div>
  );
}

/* ── helpers ── */

function isRecord(o) {
  return !!o && typeof o === 'object' && (o._id || o.id || o.email || o.firstName);
}

function unwrap(payload) {
  if (payload && typeof payload === 'object' && payload.success && payload.data) return payload.data;
  return payload;
}

function readRaw(src, field) {
  if (!src) return '';
  if (field.get) return field.get(src) || '';
  const keys = field.read || [field.key];
  for (const k of keys) {
    const v = src?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function fmt(raw, field) {
  if (raw === '' || raw == null) return '';
  if (field.type === 'date') return formatDate(raw) || '';
  if (field.type === 'role') return String(raw).replace(/-/g, ' ');
  return String(raw);
}

function inputType(type) {
  if (type === 'email') return 'email';
  if (type === 'tel') return 'tel';
  return 'text';
}

function inputMode(type) {
  if (type === 'email') return 'email';
  if (type === 'tel') return 'tel';
  return 'text';
}

function initials(emp) {
  if (emp?.initials) return emp.initials;
  const f = (emp?.firstName || '').charAt(0);
  const l = (emp?.lastName || '').charAt(0);
  return (f + l).toUpperCase() || '?';
}

function fullName(emp) {
  return emp?.name ||
    [emp?.firstName, emp?.middleName, emp?.lastName].filter(Boolean).join(' ').trim() ||
    emp?.email ||
    'Employee';
}

function jobTitle(emp) {
  return emp?.jobRole || emp?.jobTitle || emp?.position || null;
}

function emailOf(emp)  { return emp?.email || emp?.emailAddress || null; }
function phoneOf(emp)  { return emp?.phone || emp?.phoneNumber || emp?.mobileNumber || emp?.workPhone || null; }

function managerName(emp) {
  if (!emp) return '';
  if (emp.managerName) return emp.managerName;
  // /employee-profile returns the line manager as `manager`; other feeds
  // populate the ref as `managerId`. Accept either shape.
  const m = emp.manager || emp.managerId;
  if (m && typeof m === 'object') {
    return [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
  }
  // A plain string is a name; a bare ObjectId is an unpopulated ref — skip it.
  if (typeof m === 'string' && !/^[a-f0-9]{24}$/i.test(m)) return m;
  return '';
}

function organisationName(emp) {
  return emp?.organisationName || emp?.OrganisationName || emp?.office || '';
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

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
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
