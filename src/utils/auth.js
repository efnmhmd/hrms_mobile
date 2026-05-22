import { Preferences } from '@capacitor/preferences';

const TOKEN_KEY = 'hrms.token';
const USER_KEY = 'hrms.user';

// Mirrors the role → group mapping used by the web frontend's Login.js.
// Backend roles get collapsed into three groups the mobile app cares about.
export const USER_GROUPS = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
};

export function getUserGroup(user) {
  const role = (user?.role || user?.userType || '').toLowerCase();
  if (role === 'admin' || role === 'super-admin') return USER_GROUPS.ADMIN;
  if (role === 'manager' || role === 'senior-manager' || role === 'hr') return USER_GROUPS.MANAGER;
  return USER_GROUPS.EMPLOYEE;
}

export async function getToken() {
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  return value || null;
}

export async function setToken(token) {
  await Preferences.set({ key: TOKEN_KEY, value: token });
}

export async function getUser() {
  const { value } = await Preferences.get({ key: USER_KEY });
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function setUser(user) {
  await Preferences.set({ key: USER_KEY, value: JSON.stringify(user) });
}

export async function clearSession() {
  await Preferences.remove({ key: TOKEN_KEY });
  await Preferences.remove({ key: USER_KEY });
}

// Back-compat alias
export const clearToken = clearSession;
