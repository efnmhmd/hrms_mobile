import axios from 'axios';
import { getToken, clearSession } from './auth';

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
  console.warn('VITE_API_BASE_URL is not set — check .env');
}

export const api = axios.create({
  baseURL,
  timeout: 15000,
  // Match web frontend: send/accept cookies so cookie-session routes work.
  // Required for endpoints that rely on req.session (e.g. /api/auth/logout
  // and any session-only routes). Backend must allow credentials + origin.
  withCredentials: true,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || '';
    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/signup') ||
      url.includes('/auth/validate-session');

    // Mirror web behavior: 401 on a non-auth route → drop the session.
    // The app shell will route the user back to Login on next render.
    if (status === 401 && !isAuthRoute) {
      await clearSession();
    }
    return Promise.reject(err);
  }
);
