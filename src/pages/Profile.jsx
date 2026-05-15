import { useEffect, useState } from 'react';
import { getUser } from '../utils/auth';

export default function Profile({ onLogout }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="bg-brand px-4 pb-6 pt-4 text-white">
        <h1 className="text-xl font-semibold">Profile</h1>
      </header>

      <div className="-mt-4 flex-1 px-4 pb-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-xl font-semibold text-white">
              {initials(user)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-lg font-semibold text-gray-900">
                {user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '—'}
              </div>
              <div className="truncate text-sm text-gray-500">{user?.email ?? ''}</div>
            </div>
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            <Row label="Role" value={user?.role} />
            <Row label="Employee ID" value={user?.employeeId} />
            <Row label="Department" value={user?.department} />
            <Row label="Job title" value={user?.jobTitle} />
            <Row label="Team" value={user?.team} />
          </dl>
        </div>

        <button
          onClick={onLogout}
          className="mt-6 w-full rounded-xl bg-white py-3 text-base font-medium text-red-600 shadow-sm active:bg-gray-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value || '—'}</dd>
    </div>
  );
}

function initials(user) {
  if (!user) return '?';
  const f = (user.firstName || '').trim();
  const l = (user.lastName || '').trim();
  return ((f[0] || '') + (l[0] || '')).toUpperCase() || (user.email?.[0]?.toUpperCase() ?? '?');
}
