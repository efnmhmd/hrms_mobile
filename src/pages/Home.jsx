import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUser } from '../utils/auth';

export default function Home() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const firstName = user?.firstName || 'there';

  return (
    <div className="flex h-full flex-col">
      <header className="bg-brand px-4 pb-8 pt-4 text-white">
        <p className="text-sm opacity-80">{greeting()}</p>
        <h1 className="text-2xl font-semibold">{firstName}</h1>
      </header>

      <div className="-mt-5 flex-1 px-4 pb-4">
        <Link
          to="/clock"
          className="block rounded-2xl bg-white p-5 shadow-sm active:bg-gray-50"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Quick action</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">Clock in / out</p>
              <p className="mt-0.5 text-sm text-gray-500">Track your shift in one tap</p>
            </div>
            <span className="text-brand">→</span>
          </div>
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <Card title="Welcome to HRMS Mobile">
            More features land here as we wire them up — leave requests, payslips, certificates, and notifications.
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{children}</p>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}
