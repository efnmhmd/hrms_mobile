import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { getToken } from './utils/auth';

export default function App() {
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    getToken().then((t) => setAuthed(Boolean(t)));
  }, []);

  if (authed === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={authed ? <Navigate to="/" replace /> : <Login onLogin={() => setAuthed(true)} />}
      />
      <Route
        path="/"
        element={authed ? <Dashboard onLogout={() => setAuthed(false)} /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
