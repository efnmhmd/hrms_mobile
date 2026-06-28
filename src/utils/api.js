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
    console.log('[HRMS-API-ERROR]', {
      message: err?.message,
      code: err?.code,
      status: err?.response?.status,
      url: err?.config?.url,
      baseURL: err?.config?.baseURL,
      // Surface the server's actual error body — banners only show a summary,
      // and some endpoints return the reason on a non-`message` field.
      data: err?.response?.data,
    });
    const status = err?.response?.status;
    const url = err?.config?.url || '';
    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/signup') ||
      url.includes('/auth/validate-session');

    // Mirror web behavior: 401 on a non-auth route → drop the session and
    // notify the app shell so it can route the user back to Login. Without
    // this signal the shell keeps `authed` true and the user lingers on a
    // dead session, getting "Authentication required" on every action.
    if (status === 401 && !isAuthRoute) {
      await clearSession();
      window.dispatchEvent(new Event('hrms:session-expired'));
    }
    return Promise.reject(err);
  }
);
