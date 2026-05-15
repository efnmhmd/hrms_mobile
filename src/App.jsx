import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Home from './pages/Home';
import Clock from './pages/Clock';
import Profile from './pages/Profile';
import TabLayout from './components/TabLayout';
import { api } from './utils/api';
import { getToken, clearSession } from './utils/auth';

export default function App() {
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setAuthed(false);
        return;
      }

      // Mirror web AuthContext.checkExistingSession: confirm with backend that
      // the stored token is still valid. On 401/403/404 we drop the session;
      // on network error we trust local state (don't kick the user offline).
      try {
        await api.get('/auth/validate-session', { timeout: 5000 });
        setAuthed(true);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          await clearSession();
          setAuthed(false);
        } else {
          // Network / server error — assume still authed and retry later
          setAuthed(true);
        }
      }
    })();
  }, []);

  async function handleLogout() {
    // Hit /auth/logout so the server can destroy the session cookie.
    try {
      await api.post('/auth/logout');
    } catch {
      // Swallow — local sign-out should always succeed.
    }
    await clearSession();
    setAuthed(false);
  }

  if (authed === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <Routes>
        <Route path="*" element={<Login onLogin={() => setAuthed(true)} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/clock" element={<Clock />} />
        <Route path="/profile" element={<Profile onLogout={handleLogout} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
