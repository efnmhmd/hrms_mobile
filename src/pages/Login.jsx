import { useState } from 'react';
import { api } from '../utils/api';
import { setToken, setUser } from '../utils/auth';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      // Backend shape: { success, message, data: { user, token, userType } }
      const token = data?.data?.token;
      const user = data?.data?.user;
      if (!token) throw new Error(data?.message || 'No token returned from server');
      await setToken(token);
      if (user) await setUser(user);
      onLogin();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Login failed — check the server URL and credentials.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col safe-top safe-bottom">
      <div className="flex flex-1 items-center justify-center px-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm"
        >
          <h1 className="mb-1 text-2xl font-bold text-brand">HRMS</h1>
          <p className="mb-6 text-sm text-gray-500">Sign in to continue</p>

          <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            required
          />

          <label className="mb-1 block text-xs font-medium text-gray-600">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            required
          />

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand py-3 font-semibold text-white transition active:bg-brand-dark disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
