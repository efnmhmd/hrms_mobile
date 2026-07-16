// Canonical leave types, mirroring the LeaveRequest.leaveType enum in the
// backend (backend/models/LeaveRequest.js) and the web app's request forms
// (Calendar.js / TimeOffRequestDrawer.jsx). Order matches both.
//
// The server rejects anything outside this list, so keep it in sync with the
// enum rather than adding app-only categories here.
export const LEAVE_TYPES = [
  'Annual Leave',
  'Bank Holiday',
  'Maternity Leave',
  'Paternity Leave',
  'Adoption Leave',
  'Shared Parental Leave',
  'Parental Leave',
  "Carer's Leave",
  'Parental Bereavement Leave',
  'Neonatal Care Leave',
  'Time Off for Dependants',
  'Sick Leave',
  'Jury Service',
  'Trade Union Duties',
  'Public Duty Leave',
  'Study / Training Leave',
  'Medical / Dental Appointment',
];

export const DEFAULT_LEAVE_TYPE = 'Annual Leave';
