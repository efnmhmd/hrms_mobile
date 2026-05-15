import { Preferences } from '@capacitor/preferences';

const TOKEN_KEY = 'hrms.token';
const USER_KEY = 'hrms.user';

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
