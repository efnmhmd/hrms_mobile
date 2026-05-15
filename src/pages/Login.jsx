import { useState } from 'react';
import { api } from '../utils/api';
import { setToken, setUser } from '../utils/auth';
import { getErrorMessage } from '../utils/errorHandler';

export default function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Match web payload exactly: identifier + rememberMe
      const { data } = await api.post('/auth/login', {
        identifier,
        password,
        rememberMe: true,
      });

      // Backend shape: { success, message, data: { user, token, userType } }
      // Web frontend also accepts a flat shape as fallback.
      const payload = data?.data || data;
      const token = payload?.token;
      const userType = payload?.userType;
      const userData = payload?.user;

      if (!token || !userData) {
        throw new Error('Invalid response from server');
      }

      await setToken(token);
      await setUser({ ...userData, userType: userType || userData.userType });
      onLogin();
    } catch (err) {
      setError(getErrorMessage(err));
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

          <label className="mb-1 block text-xs font-medium text-gray-600">Email or username</label>
          <input
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
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
