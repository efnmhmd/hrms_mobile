# HRMS Mobile

Capacitor + React + Vite mobile app for the HRMS backend.

## Stack

- **React 18** + **Vite 5** (plain JS, JSX in `.jsx`)
- **Tailwind CSS** for styling
- **Capacitor 6** for native shells (Android + iOS)
- **React Router 6** for in-app navigation
- **Axios** for API calls
- **@capacitor/preferences** for secure-ish token storage

## Setup

```bash
npm install
cp .env.example .env   # then edit VITE_API_BASE_URL
```

## Develop (web)

```bash
npm run dev
# http://localhost:5173
```

Web preview is fine for most UI work. Capacitor APIs (Preferences, Haptics, etc.)
fall back to web equivalents in the browser.

## Build

```bash
npm run build
# output → dist/
```

## Add native platforms (one-time, requires SDKs)

**Android** — requires JDK 17+ and Android Studio:
```bash
npm run cap:add:android
npm run cap:open:android   # opens Android Studio
```

**iOS** — requires Xcode (macOS only):
```bash
npm run cap:add:ios
npm run cap:open:ios
```

## Run on a device / emulator

```bash
npm run cap:run:android
# or
npm run cap:run:ios
```

`cap:run:*` first runs `vite build` and `cap sync`, then launches.

## After web-code changes

```bash
npm run cap:sync
```

This rebuilds `dist/` and copies it into the native projects.

## Project layout

```
src/
  main.jsx          # entry
  App.jsx           # router + auth gate
  index.css         # Tailwind directives + safe-area helpers
  pages/
    Login.jsx
    Dashboard.jsx
  utils/
    api.js          # axios instance with auth interceptor
    auth.js         # token storage via Capacitor Preferences
```

## Config

- `VITE_API_BASE_URL` — backend base URL (e.g. `http://10.0.2.2:5006/api` for Android emulator hitting host machine, or your prod URL)
- `capacitor.config.json` — appId, appName, splash screen

## Notes

- `android/` and `ios/` folders are git-ignored — they're regenerated from `dist/` via `cap sync`. Commit them if you customize native code.
- For login the API expects `POST /auth/login` → `{ token }` or `{ accessToken }`. Adjust [src/pages/Login.jsx](src/pages/Login.jsx) to match your backend.
