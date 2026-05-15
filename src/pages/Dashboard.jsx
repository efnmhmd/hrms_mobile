import { clearToken } from '../utils/auth';

export default function Dashboard({ onLogout }) {
  async function handleLogout() {
    await clearToken();
    onLogout();
  }

  return (
    <div className="flex h-full flex-col safe-top safe-bottom">
      <header className="flex items-center justify-between bg-brand px-4 py-3 text-white">
        <h1 className="text-lg font-semibold">HRMS</h1>
        <button
          onClick={handleLogout}
          className="rounded-md bg-white/15 px-3 py-1 text-sm active:bg-white/25"
        >
          Sign out
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Welcome back</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">You're signed in.</p>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Build features here — clock in, profile, requests, etc.
        </p>
      </main>
    </div>
  );
}
