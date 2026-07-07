import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import { getUser, setUser } from '../utils/auth';
import { getErrorMessage } from '../utils/errorHandler';

// The cached login blob only carries a handful of fields (name, role, employeeId,
// department, jobTitle, team). The real record lives on the EmployeeHub and is
// fetched the same way the web MyProfile does it: by email first (so a missing
// user→employee link doesn't 404), falling back to the user id. That response
// also hands back the EmployeeHub _id, which is what PUT /employees/:id needs —
// the cached user._id is the *User* id and does NOT match the employee id.

const RELATIONSHIP_OPTIONS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Partner', 'Other'];

// Field spec per section. `edit` marks employee-editable fields (mirrors the
// web EMPLOYEE_EDITABLE_FIELDS set); `read` lists fallback spellings the server
// may use; `save` lists the backend key(s) a value writes to on PUT.
const SECTIONS = [
  {
    id: 'personal',
    title: 'Basic Details',
    fields: [
      { key: 'title', label: 'Title', read: ['title'] },
      { key: 'firstName', label: 'First name', edit: true, save: ['firstName'] },
      { key: 'middleName', label: 'Middle name', edit: true, save: ['middleName'] },
      { key: 'lastName', label: 'Last name', edit: true, save: ['lastName'] },
      { key: 'gender', label: 'Gender', read: ['gender'] },
      { key: 'ethnicity', label: 'Ethnicity', read: ['ethnicity'] },
      { key: 'dateOfBirth', label: 'Date of birth', type: 'date', read: ['dateOfBirth'] },
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    fields: [
      { key: 'email', label: 'Email', type: 'email', edit: true, read: ['email', 'emailAddress'], save: ['email'] },
      { key: 'phone', label: 'Phone', type: 'tel', edit: true, read: ['phone', 'phoneNumber', 'workPhone', 'mobileNumber'], save: ['phone', 'workPhone'] },
    ],
  },
  {
    id: 'address',
    title: 'Address',
    fields: [
      { key: 'addressLine1', label: 'Address line 1', edit: true, read: ['address1', 'addressLine1'], save: ['address1'] },
      { key: 'addressLine2', label: 'Address line 2', edit: true, read: ['address2', 'addressLine2'], save: ['address2'] },
      { key: 'addressLine3', label: 'Address line 3', edit: true, read: ['address3', 'addressLine3'], save: ['address3'] },
      { key: 'city', label: 'Town / City', edit: true, read: ['townCity', 'city'], save: ['townCity'] },
      { key: 'county', label: 'County', edit: true, read: ['county'], save: ['county'] },
      { key: 'postcode', label: 'Postcode', edit: true, read: ['postcode', 'postalCode'], save: ['postcode'] },
    ],
  },
  {
    id: 'emergency',
    title: 'Emergency Contact',
    fields: [
      { key: 'emergencyContactName', label: 'Name', edit: true, read: ['emergencyContactName', 'emergencyContact'], save: ['emergencyContactName'] },
      { key: 'emergencyContactRelation', label: 'Relationship', type: 'select', options: RELATIONSHIP_OPTIONS, edit: true, read: ['emergencyContactRelation', 'emergencyRelationship'], save: ['emergencyContactRelation'] },
      { key: 'emergencyContactPhone', label: 'Phone', type: 'tel', edit: true, read: ['emergencyContactPhone', 'emergencyPhone', 'emergencyMobile'], save: ['emergencyContactPhone'] },
      { key: 'emergencyContactEmail', label: 'Email', type: 'email', edit: true, read: ['emergencyContactEmail', 'emergencyEmail'], save: ['emergencyContactEmail'] },
    ],
  },
  {
    id: 'job',
    title: 'Job',
    fields: [
      { key: 'jobTitle', label: 'Job title', read: ['jobRole', 'jobTitle', 'position'] },
      { key: 'department', label: 'Department', read: ['department'] },
      { key: 'team', label: 'Team', read: ['team'] },
      { key: 'manager', label: 'Manager', get: managerName },
      { key: 'organisation', label: 'Organisation', read: ['organisationName', 'OrganisationName', 'office'] },
      { key: 'startDate', label: 'Start date', type: 'date', read: ['startDate', 'hireDate'] },
      { key: 'role', label: 'Role', type: 'role', read: ['role'] },
      { key: 'employeeId', label: 'Employee ID', read: ['employeeId', 'staffId'] },
    ],
  },
  {
    id: 'pay',
    title: 'Account & Pay',
    collapseEmpty: true,
    fields: [
      { key: 'salary', label: 'Salary', read: ['salary'] },
      { key: 'rate', label: 'Rate', read: ['rate'] },
      { key: 'paymentFrequency', label: 'Payment frequency', read: ['paymentFrequency'] },
      { key: 'payrollNumber', label: 'Payroll number', read: ['payrollNumber'] },
      { key: 'accountName', label: 'Account name', read: ['accountName'] },
      { key: 'bankName', label: 'Bank name', read: ['bankName'] },
      { key: 'bankBranch', label: 'Bank branch', read: ['bankBranch'] },
      { key: 'accountNumber', label: 'Account number', read: ['accountNumber'] },
      { key: 'sortCode', label: 'Sort code', read: ['sortCode'] },
    ],
  },
  {
    id: 'sensitive',
    title: 'Sensitive',
    collapseEmpty: true,
    fields: [
      { key: 'taxCode', label: 'Tax code', read: ['taxCode'] },
      { key: 'niNumber', label: 'NI number', read: ['niNumber', 'nationalInsuranceNumber'] },
      { key: 'passportNumber', label: 'Passport number', read: ['passportNumber'] },
      { key: 'passportCountry', label: 'Passport country', read: ['passportCountry'] },
      { key: 'passportExpiryDate', label: 'Passport expiry', type: 'date', read: ['passportExpiryDate'] },
      { key: 'licenceNumber', label: 'Licence number', read: ['licenceNumber'] },
      { key: 'licenceCountry', label: 'Licence country', read: ['licenceCountry'] },
      { key: 'licenceClass', label: 'Licence class', read: ['licenceClass'] },
      { key: 'licenceExpiryDate', label: 'Licence expiry', type: 'date', read: ['licenceExpiryDate'] },
      { key: 'visaNumber', label: 'Visa number', read: ['visaNumber'] },
      { key: 'visaExpiryDate', label: 'Visa expiry', type: 'date', read: ['visaExpiryDate'] },
    ],
  },
];

// Fields that count toward the completeness meter — all things the employee can
// actually fill in from this screen, so the prompt to "complete your profile"
// stays actionable.
const COMPLETE_FIELDS = [
  ['firstName'], ['lastName'], ['email', 'emailAddress'],
  ['phone', 'phoneNumber', 'workPhone'], ['dateOfBirth'], ['gender'],
  ['address1', 'addressLine1'], ['townCity', 'city'], ['postcode', 'postalCode'],
  ['emergencyContactName'], ['emergencyContactPhone'], ['emergencyContactRelation'],
];

const styles = `
  @keyframes pf-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pf-skel { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.9; } }

  .pf-wrap { padding: 0.85rem 1rem 6rem; }
  .pf-anim { animation: pf-fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Hero ── */
  .pf-hero {
    position: relative; overflow: hidden; border-radius: 22px;
    background:
      radial-gradient(ellipse at 0% 0%, rgba(132,169,140,0.32) 0%, transparent 55%),
      radial-gradient(ellipse at 100% 100%, rgba(53,79,82,0.55) 0%, transparent 60%),
      linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5; padding: 1.1rem 1.1rem 1.15rem;
    box-shadow: 0 12px 30px rgba(47,62,70,0.18);
  }
  .pf-hero-row { position: relative; z-index: 1; display: flex; align-items: center; gap: 0.85rem; }
  .pf-avatar {
    width: 64px; height: 64px; border-radius: 50%;
    background: rgba(202,210,197,0.18); border: 1px solid rgba(202,210,197,0.30);
    color: #f0f5f2; display: flex; align-items: center; justify-content: center;
    font-size: 1.4rem; font-weight: 600; flex-shrink: 0; backdrop-filter: blur(8px);
  }
  .pf-hero-meta { min-width: 0; flex: 1; }
  .pf-hero-name {
    font-family: 'Cormorant Garamond', serif; font-size: 1.65rem; line-height: 1.1;
    font-weight: 400; color: #f0f5f2; letter-spacing: -0.01em; margin: 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pf-hero-job {
    margin-top: 4px; font-size: 0.82rem; color: rgba(202,210,197,0.82); font-weight: 300;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pf-hero-pills { margin-top: 0.6rem; display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .pf-hero-pill {
    font-size: 0.62rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
    background: rgba(202,210,197,0.16); border: 1px solid rgba(202,210,197,0.22);
    color: #cad2c5; padding: 2px 8px; border-radius: 999px;
  }

  /* ── Completeness meter ── */
  .pf-meter { position: relative; z-index: 1; margin-top: 0.95rem; }
  .pf-meter-top {
    display: flex; align-items: baseline; justify-content: space-between;
    margin-bottom: 0.35rem;
  }
  .pf-meter-label { font-size: 0.66rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(202,210,197,0.85); }
  .pf-meter-pct { font-size: 0.8rem; font-weight: 700; color: #f0f5f2; }
  .pf-meter-track { height: 6px; border-radius: 999px; background: rgba(240,245,242,0.20); overflow: hidden; }
  .pf-meter-fill {
    height: 100%; border-radius: 999px;
    background: linear-gradient(90deg, #cad2c5, #84a98c);
    transition: width 0.5s cubic-bezier(0.22,1,0.36,1);
  }
  .pf-meter-hint { margin: 0.45rem 0 0; font-size: 0.7rem; color: rgba(202,210,197,0.8); font-weight: 300; }

  /* ── Sections ── */
  .pf-section-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.5rem; margin: 1.2rem 0.25rem 0.5rem;
  }
  .pf-section-title {
    display: inline-flex; align-items: center; gap: 0.55rem;
    font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #52796f;
  }
  .pf-section-title::before {
    content: ''; width: 14px; height: 1.5px;
    background: linear-gradient(90deg, #84a98c, rgba(132,169,140,0)); border-radius: 1px;
  }
  .pf-edit-btn {
    -webkit-tap-highlight-color: transparent;
    display: inline-flex; align-items: center; gap: 0.3rem;
    background: none; border: none; cursor: pointer;
    font-size: 0.72rem; font-weight: 600; letter-spacing: 0.02em; color: #52796f;
    padding: 4px 8px; border-radius: 8px;
  }
  .pf-edit-btn:active { background: rgba(132,169,140,0.14); }
  .pf-edit-actions { display: flex; align-items: center; gap: 0.4rem; }
  .pf-btn {
    -webkit-tap-highlight-color: transparent;
    font-size: 0.74rem; font-weight: 600; letter-spacing: 0.02em;
    padding: 0.42rem 0.85rem; border-radius: 999px; border: none; cursor: pointer;
  }
  .pf-btn:disabled { opacity: 0.55; }
  .pf-btn-save { background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5; }
  .pf-btn-save:active { transform: scale(0.97); }
  .pf-btn-cancel { background: #eef2ef; color: #52796f; }

  .pf-card {
    background: #fff; border-radius: 16px; border: 1px solid rgba(212,221,214,0.7);
    box-shadow: 0 1px 2px rgba(47,62,70,0.04); padding: 0.4rem 0.95rem;
  }
  .pf-card.is-editing { border-color: rgba(82,121,111,0.55); box-shadow: 0 0 0 3px rgba(82,121,111,0.10); }
  .pf-row {
    display: flex; align-items: flex-start; gap: 0.85rem;
    padding: 0.65rem 0; border-bottom: 1px solid rgba(212,221,214,0.5);
  }
  .pf-row.is-edit { flex-direction: column; gap: 0.4rem; }
  .pf-row:last-child { border-bottom: none; }
  .pf-row-label {
    flex: 0 0 38%; min-width: 0; font-size: 0.7rem; font-weight: 600;
    letter-spacing: 0.04em; color: #84a98c; text-transform: uppercase;
  }
  .pf-row-value { flex: 1; min-width: 0; font-size: 0.82rem; color: #2f3e46; word-break: break-word; }
  .pf-row-value.is-muted { color: #b8c4bc; }
  .pf-empty-note { padding: 0.5rem 0; font-size: 0.78rem; color: #b8c4bc; }

  .pf-input, .pf-select {
    width: 100%; box-sizing: border-box;
    padding: 0.62rem 0.7rem; border: 1.5px solid #d4ddd6; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 16px; color: #2f3e46; background: #fff;
    outline: none; -webkit-appearance: none; appearance: none;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .pf-input:focus, .pf-select:focus { border-color: #52796f; box-shadow: 0 0 0 3px rgba(82,121,111,0.12); }

  .pf-save-error {
    margin-top: 0.6rem; font-size: 0.75rem; color: #b85c50; font-weight: 500;
    display: flex; align-items: center; gap: 0.35rem;
  }
  .pf-banner {
    margin-top: 0.9rem; padding: 0.7rem 0.85rem; border-radius: 12px;
    background: rgba(132,169,140,0.10); border: 1px solid rgba(132,169,140,0.25);
    font-size: 0.76rem; color: #52796f;
  }

  /* ── Sign out ── */
  .pf-signout {
    margin-top: 1.6rem; width: 100%;
    background: #fff; border: 1px solid rgba(192,117,106,0.35); border-radius: 14px;
    padding: 0.85rem; font-size: 0.9rem; font-weight: 600; color: #c0392b;
    box-shadow: 0 1px 2px rgba(47,62,70,0.04);
    -webkit-tap-highlight-color: transparent; cursor: pointer;
  }
  .pf-signout:active { background: #fdf3f2; }

  /* ── States ── */
  .pf-skel-hero { height: 150px; border-radius: 22px; background: linear-gradient(90deg,#eef2ef,#f6f8f4,#eef2ef); animation: pf-skel 1.2s ease-in-out infinite; }
  .pf-skel-card { height: 90px; border-radius: 16px; background: linear-gradient(90deg,#eef2ef,#f6f8f4,#eef2ef); animation: pf-skel 1.2s ease-in-out infinite; margin-top: 1rem; }
  .pf-error {
    margin-top: 1rem; padding: 1.75rem 1rem; border-radius: 16px;
    background: repeating-linear-gradient(135deg, rgba(192,117,106,0.06) 0 6px, transparent 6px 16px), rgba(255,255,255,0.55);
    border: 1px dashed rgba(192,117,106,0.4); text-align: center; color: #7a3028;
  }
  .pf-error-title { font-size: 0.85rem; font-weight: 600; margin: 0; }
  .pf-error-sub { font-size: 0.75rem; margin: 0.25rem 0 0; opacity: 0.85; }
  .pf-retry {
    margin-top: 0.85rem; padding: 0.55rem 1.1rem; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%); color: #cad2c5;
    font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer;
  }
`;

export default function Profile({ onLogout }) {
  const [cachedUser, setCachedUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingSection, setEditingSection] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEditingSection(null);
    const cu = await getUser();
    setCachedUser(cu);

    const email = cu?.email;
    const uid = cu?._id || cu?.id;
    if (!email && !uid) {
      setError('Could not determine your account.');
      setLoading(false);
      return;
    }

    let emp = null;
    let lastErr = null;
    if (email) {
      try {
        const { data } = await api.get(`/employees/by-email/${encodeURIComponent(email)}`);
        emp = unwrap(data);
      } catch (err) {
        lastErr = err;
      }
    }
    if (!isRecord(emp) && uid) {
      try {
        const { data } = await api.get(`/employees/by-user-id/${uid}`);
        emp = unwrap(data);
      } catch (err) {
        lastErr = err;
      }
    }

    if (isRecord(emp)) {
      setEmployee(emp);
    } else if (cu) {
      // Couldn't resolve the full record — fall back to the cached login fields
      // so the page still shows something (read-only).
      setEmployee(null);
    } else {
      setError(lastErr ? getErrorMessage(lastErr) : 'Profile not found.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const src = employee || cachedUser || {};
  const empId = employee?._id || employee?.id || null;
  const canEdit = !!empId;

  const meter = useMemo(() => completeness(employee), [employee]);

  function startEdit(section) {
    const d = {};
    section.fields.forEach((f) => {
      if (f.edit) d[f.key] = readRaw(employee, f);
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
    if (!empId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {};
      section.fields.forEach((f) => {
        if (!f.edit) return;
        const val = (editData[f.key] ?? '').toString().trim();
        (f.save || [f.key]).forEach((k) => { payload[k] = val; });
      });

      const { data } = await api.put(`/employees/${empId}`, payload);
      const updated = unwrap(data);
      const nextEmp = isRecord(updated) ? { ...employee, ...updated } : { ...employee, ...payload };
      setEmployee(nextEmp);

      // Keep the cached login blob's identity fields in sync so the rest of the
      // app (headers, avatars, greetings) reflects an edited name/email.
      const cu = await getUser();
      if (cu) {
        const synced = {
          ...cu,
          firstName: nextEmp.firstName ?? cu.firstName,
          lastName: nextEmp.lastName ?? cu.lastName,
          email: nextEmp.email ?? cu.email,
        };
        await setUser(synced);
        setCachedUser(synced);
      }

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
        <div className="pf-wrap">
          <div className="pf-skel-hero" />
          <div className="pf-skel-card" />
          <div className="pf-skel-card" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <style>{styles}</style>
        <div className="pf-wrap">
          <div className="pf-error pf-anim">
            <p className="pf-error-title">Couldn't load your profile</p>
            <p className="pf-error-sub">{error}</p>
            <button className="pf-retry" onClick={fetchProfile}>Try again</button>
          </div>
          <button className="pf-signout" onClick={onLogout}>Sign out</button>
        </div>
      </>
    );
  }

  const job = readRaw(src, { read: ['jobRole', 'jobTitle', 'position'] });
  const role = readRaw(src, { read: ['role'] });
  const dept = readRaw(src, { read: ['department'] });
  const team = readRaw(src, { read: ['team'] });

  return (
    <>
      <style>{styles}</style>
      <div className="pf-wrap">
        {/* Hero */}
        <div className="pf-hero pf-anim">
          <div className="pf-hero-row">
            <div className="pf-avatar">{initials(src)}</div>
            <div className="pf-hero-meta">
              <h1 className="pf-hero-name">{fullName(src)}</h1>
              {job && <div className="pf-hero-job">{job}</div>}
              <div className="pf-hero-pills">
                {role && <span className="pf-hero-pill">{String(role).replace(/-/g, ' ')}</span>}
                {dept && <span className="pf-hero-pill">{dept}</span>}
                {team && <span className="pf-hero-pill">{team}</span>}
              </div>
            </div>
          </div>

          {employee && meter.total > 0 && (
            <div className="pf-meter">
              <div className="pf-meter-top">
                <span className="pf-meter-label">Profile completeness</span>
                <span className="pf-meter-pct">{meter.percent}%</span>
              </div>
              <div className="pf-meter-track">
                <div className="pf-meter-fill" style={{ width: `${meter.percent}%` }} />
              </div>
              {meter.percent < 100 && canEdit && (
                <p className="pf-meter-hint">
                  Add your {meter.missing.slice(0, 2).join(' and ')} to complete your profile.
                </p>
              )}
            </div>
          )}
        </div>

        {!employee && cachedUser && (
          <div className="pf-banner pf-anim">
            Showing limited details from your account. We couldn't reach your full employee
            record, so editing is unavailable right now.
          </div>
        )}

        {/* Sections */}
        {SECTIONS.map((section) => {
          const isEditing = editingSection === section.id;
          const sectionEditable = canEdit && section.fields.some((f) => f.edit);

          // For collapse-empty read-only sections, hide when there's nothing on record.
          const populated = section.fields.filter((f) => readRaw(src, f) !== '');
          if (section.collapseEmpty && !isEditing) {
            // still render the header + a muted note so the section is discoverable
          }
          const rowsToShow =
            section.collapseEmpty && !isEditing && populated.length > 0
              ? populated
              : section.fields;

          return (
            <div key={section.id}>
              <div className="pf-section-head">
                <span className="pf-section-title">{section.title}</span>
                {sectionEditable && (
                  isEditing ? (
                    <div className="pf-edit-actions">
                      <button
                        className="pf-btn pf-btn-cancel"
                        onClick={cancelEdit}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        className="pf-btn pf-btn-save"
                        onClick={() => saveSection(section)}
                        disabled={saving}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  ) : (
                    editingSection === null && (
                      <button className="pf-edit-btn" onClick={() => startEdit(section)}>
                        <PencilIcon /> Edit
                      </button>
                    )
                  )
                )}
              </div>

              <div className={`pf-card pf-anim ${isEditing ? 'is-editing' : ''}`}>
                {section.collapseEmpty && !isEditing && populated.length === 0 ? (
                  <div className="pf-empty-note">No information on record.</div>
                ) : (
                  rowsToShow.map((field) => (
                    <ProfileRow
                      key={field.key}
                      field={field}
                      src={src}
                      isEditing={isEditing && field.edit}
                      value={editData[field.key]}
                      onChange={(v) => setEditData((p) => ({ ...p, [field.key]: v }))}
                    />
                  ))
                )}
                {isEditing && saveError && (
                  <div className="pf-save-error">
                    <AlertIcon />
                    {saveError}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <button className="pf-signout" onClick={onLogout}>Sign out</button>
      </div>
    </>
  );
}

function ProfileRow({ field, src, isEditing, value, onChange }) {
  if (isEditing) {
    return (
      <div className="pf-row is-edit">
        <span className="pf-row-label">{field.label}</span>
        {field.type === 'select' ? (
          <select
            className="pf-select"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Select {field.label.toLowerCase()}</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            className="pf-input"
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

  const display = fmt(readRaw(src, field), field);
  const empty = display === '';
  return (
    <div className="pf-row">
      <span className="pf-row-label">{field.label}</span>
      <span className={`pf-row-value ${empty ? 'is-muted' : ''}`}>{empty ? '—' : display}</span>
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

function managerName(emp) {
  if (!emp) return '';
  if (emp.managerName) return emp.managerName;
  // This page's feeds (by-email / by-user-id) populate the ref as `managerId`;
  // /employee-profile returns it as `manager`. Accept either shape.
  const m = emp.manager || emp.managerId;
  if (m && typeof m === 'object') {
    return [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
  }
  // A plain string is a name; a bare ObjectId is an unpopulated ref — skip it.
  if (typeof m === 'string' && !/^[a-f0-9]{24}$/i.test(m)) return m;
  return '';
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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

function fullName(u) {
  return (
    [u?.firstName, u?.middleName, u?.lastName].filter(Boolean).join(' ').trim() ||
    u?.name ||
    u?.email ||
    '—'
  );
}

function initials(u) {
  if (!u) return '?';
  const f = (u.firstName || '').trim();
  const l = (u.lastName || '').trim();
  return ((f[0] || '') + (l[0] || '')).toUpperCase() || (u.email?.[0]?.toUpperCase() ?? '?');
}

const MISSING_LABELS = {
  phone: 'phone number',
  dateOfBirth: 'date of birth',
  gender: 'gender',
  address1: 'address',
  townCity: 'town/city',
  postcode: 'postcode',
  emergencyContactName: 'emergency contact',
  emergencyContactPhone: 'emergency phone',
  emergencyContactRelation: 'emergency contact relationship',
  firstName: 'first name',
  lastName: 'last name',
  email: 'email',
};

function completeness(emp) {
  if (!emp) return { percent: 0, filled: 0, total: 0, missing: [] };
  let filled = 0;
  const missing = [];
  COMPLETE_FIELDS.forEach((keys) => {
    const has = keys.some((k) => {
      const v = emp[k];
      return v !== undefined && v !== null && String(v).trim() !== '';
    });
    if (has) filled += 1;
    else {
      const label = MISSING_LABELS[keys[0]];
      if (label && !missing.includes(label)) missing.push(label);
    }
  });
  const total = COMPLETE_FIELDS.length;
  return { percent: Math.round((filled / total) * 100), filled, total, missing };
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
