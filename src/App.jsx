import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Home from './pages/Home';
import Clock from './pages/Clock';
import Profile from './pages/Profile';
import TabLayout from './components/TabLayout';
import { getToken, clearSession } from './utils/auth';

export default function App() {
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    getToken().then((t) => setAuthed(Boolean(t)));
  }, []);

  async function handleLogout() {
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
