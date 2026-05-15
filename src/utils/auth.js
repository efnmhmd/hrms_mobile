import { Preferences } from '@capacitor/preferences';

const TOKEN_KEY = 'hrms.token';

export async function getToken() {
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  return value || null;
}

export async function setToken(token) {
  await Preferences.set({ key: TOKEN_KEY, value: token });
}

export async function clearToken() {
  await Preferences.remove({ key: TOKEN_KEY });
}
