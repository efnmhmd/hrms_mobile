# iOS IPA build via GitHub Actions

This repo builds a signed iOS `.ipa` automatically when you **push to the `prod` branch**
(workflow: [.github/workflows/ios-build.yml](../.github/workflows/ios-build.yml)).
You can also run it manually from the **Actions** tab and override the export method.

The finished `.ipa` is uploaded as a build **artifact** — download it from the workflow
run page (bottom, "Artifacts" → `hrms-ios-ipa`).

> **Where does this run?** GitHub Actions runs on the GitHub remote
> (`github.com/efnmhmd/hrms_mobile`, the `build` remote). Push the `prod` branch **there** to
> trigger it — pushing only to the GitLab `origin` will not start a build.

---

## What you need from Apple (one-time)

You need an **Apple Developer Program** membership ($99/yr). From it you'll collect a few
things and store them as **GitHub repository Secrets**. None of these are ever committed to the repo.

The build uses **manual code signing**: you create a provisioning profile once and upload it as
a secret. The build signs offline and never contacts Apple — so there are no App Store Connect
API keys and no `401` authentication failures.

| GitHub Secret name             | What it is                                              |
| ------------------------------ | ------------------------------------------------------- |
| `IOS_TEAM_ID`                  | Your 10-character Apple Developer **Team ID**           |
| `IOS_DIST_CERT_P12_BASE64`     | Your **Apple Distribution certificate** (.p12) → base64 |
| `IOS_DIST_CERT_PASSWORD`       | The password you set when exporting the .p12            |
| `IOS_PROVISION_PROFILE_BASE64` | Your **provisioning profile** (.mobileprovision) → base64 |
| `IOS_KEYCHAIN_PASSWORD`        | Any random string you make up (temp keychain password)  |

> The workflow auto-detects the export method (`app-store` / `ad-hoc` / `development` /
> `enterprise`) from the profile you upload, so the kind of profile you create decides the
> output. You can override it on a manual run.

> ⚠️ **Never paste the `.p12`, its base64, or a `.mobileprovision` into chat, email, or
> tickets** — they contain or wrap your private key. If you ever do, revoke the certificate at
> <https://developer.apple.com/account/resources/certificates/list> and issue a new one.

---

## Step 1 — Team ID → `IOS_TEAM_ID`

1. Go to <https://developer.apple.com/account>.
2. Scroll to **Membership details**.
3. Copy the **Team ID** (10 chars, e.g. `A1B2C3D4E5`).

## Step 2 — Distribution certificate → `IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD`

You need an **Apple Distribution** certificate exported as a `.p12` (certificate + private key).

**Easiest path (on a Mac with Xcode):**
1. Open **Xcode → Settings → Accounts**, select your team → **Manage Certificates…**
2. Click **+** → **Apple Distribution**. (If one already exists you can reuse it.)
3. Open the **Keychain Access** app → **My Certificates**.
4. Find the **Apple Distribution: …** entry, right-click → **Export**.
5. Save as `.p12`, set a password → this password is the secret `IOS_DIST_CERT_PASSWORD`.

**Don't have a Mac?** Create the certificate from the website:
1. Create a CSR (Certificate Signing Request). On Windows use OpenSSL via Git Bash. Note the
   leading `/` in `-subj` gets mangled by Git Bash — prefix with `MSYS_NO_PATHCONV=1`:
   ```bash
   openssl genrsa -out ios_dist.key 2048
   MSYS_NO_PATHCONV=1 openssl req -new -key ios_dist.key -out ios_dist.csr \
     -subj "/emailAddress=you@example.com/CN=HRMS Distribution/C=GB"
   ```
2. Go to <https://developer.apple.com/account/resources/certificates/list> → **+** →
   **Apple Distribution** → upload `ios_dist.csr` → download `distribution.cer`.
3. Convert to `.p12`. **Use `-legacy`** — OpenSSL 3 (shipped with Git for Windows) otherwise
   produces a `.p12` Apple's `security` tool can't import (you'd get *"MAC verification failed"*
   even with the right password):
   ```bash
   openssl x509 -in distribution.cer -inform DER -out ios_dist.pem -outform PEM
   openssl pkcs12 -export -legacy -inkey ios_dist.key -in ios_dist.pem -out dist_cert.p12
   ```
   The password you type here is `IOS_DIST_CERT_PASSWORD`.

### Convert the .p12 to base64 → `IOS_DIST_CERT_P12_BASE64`

- **Windows (PowerShell):**
  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("dist_cert.p12")) | Set-Clipboard
  ```
- **macOS / Linux / Git Bash:**
  ```bash
  base64 -w0 dist_cert.p12 > cert.b64.txt   # (use -i on macOS: base64 -i dist_cert.p12)
  ```
Paste the resulting single line as the secret value.

## Step 3 — Provisioning profile → `IOS_PROVISION_PROFILE_BASE64`

This is the piece that replaces the App Store Connect API key. The build signs against this
profile offline, so there's nothing to authenticate at build time.

1. Make sure the App ID **`com.talentshield.hrms`** exists →
   <https://developer.apple.com/account/resources/identifiers/list> (create it if missing).
2. Go to <https://developer.apple.com/account/resources/profiles/list> → **+**.
3. Choose the profile type that matches what you want the IPA for:
   - **App Store Connect** → for TestFlight / App Store. Needs **no** registered devices.
   - **Ad Hoc** → an IPA installable on devices whose UDIDs are registered. Needs devices.
   - **iOS App Development** → for registered development devices. Needs devices.
4. Select App ID **`com.talentshield.hrms`**.
5. Select your **Apple Distribution** certificate (the same one your `.p12` was made from —
   they must match or signing fails).
6. Name it (e.g. `HRMS Distribution`), click **Generate**, then **Download** the
   `.mobileprovision` file.
7. Base64-encode it and store as `IOS_PROVISION_PROFILE_BASE64`:
   - **Windows (PowerShell):**
     ```powershell
     [Convert]::ToBase64String([IO.File]::ReadAllBytes("HRMS_Distribution.mobileprovision")) | Set-Clipboard
     ```
   - **macOS / Linux / Git Bash:**
     ```bash
     base64 -w0 HRMS_Distribution.mobileprovision
     ```

> The workflow reads the profile's name and type for you — you don't need to enter the profile
> name anywhere. The export method is auto-detected from this profile.

> 💡 **"Your team has no devices…" error?** That comes from Ad Hoc / Development profiles, which
> require at least one registered device. Either register a device UDID at
> <https://developer.apple.com/account/resources/devices/list>, or use an **App Store Connect**
> profile (no devices needed).

## Step 4 — Keychain password → `IOS_KEYCHAIN_PASSWORD`

Just invent any random string (e.g. from a password manager). It's only used to lock the
temporary keychain created during the build.

---

## Step 5 — Add all secrets to GitHub

1. On the **GitHub** repo (`github.com/efnmhmd/hrms_mobile`) → **Settings → Secrets and
   variables → Actions → New repository secret**.
2. Add each of the 5 secrets from the table above.

## Step 6 — Push the `prod` branch to GitHub

```bash
# 'build' is the GitHub remote that runs Actions
git push build prod
```
Every push to `prod` on GitHub from now on triggers the build. Watch it under the **Actions** tab.

---

## Which export method gives an installable IPA?

The workflow auto-detects the method from the provisioning profile you uploaded. So an App Store
profile → `app-store` IPA, an Ad Hoc profile → `ad-hoc` IPA, etc. (You can still override it on a
manual run → "Run workflow" → `export_method`.)

| Method        | Can you install the .ipa directly on a phone?                         |
| ------------- | --------------------------------------------------------------------- |
| `app-store`   | **No** — it's for uploading to App Store / TestFlight.                |
| `ad-hoc`      | **Yes**, but only on devices whose UDID is registered in your account.|
| `development` | **Yes**, on registered development devices.                           |
| `enterprise`  | **Yes**, anywhere — only if you have the Apple Enterprise Program.    |

To install an ad-hoc IPA: register your device UDIDs at
<https://developer.apple.com/account/resources/devices/list> first, build with an Ad Hoc
profile, then install via Apple Configurator, a service like Diawi, or the Xcode Devices window.

> **Tip:** For testers, the smoothest route is an App Store profile + upload to **TestFlight**.
> The workflow can be extended with a final step that uploads the build straight to TestFlight if
> you want.

---

## Troubleshooting

- **`xcodebuild: error: The workspace ... does not contain a scheme named "App"`**
  The `App` scheme isn't shared. The repo includes a shared scheme at
  `ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`; if it's missing, on a Mac do
  Xcode → Product → Scheme → **Manage Schemes…** → tick **Shared** and commit it.
- **`MAC verification failed (wrong password?)` during cert import**
  The `.p12` was made with OpenSSL 3 without `-legacy`. Re-export it with
  `openssl pkcs12 -export -legacy ...` and refresh `IOS_DIST_CERT_P12_BASE64`.
- **`No signing certificate "Apple Distribution" found`**
  The `.p12` is wrong/empty, or it's a *Development* cert. Re-export an **Apple Distribution** cert.
- **`No profiles for 'com.talentshield.hrms' were found` / `doesn't match the provisioning profile`**
  The uploaded profile doesn't cover this App ID, or it was built for a different certificate.
  Regenerate the profile for App ID `com.talentshield.hrms` using the **same** Apple Distribution
  certificate your `.p12` came from, then refresh `IOS_PROVISION_PROFILE_BASE64`.
- **`Your team has no devices from which to generate a provisioning profile`**
  You used an Ad Hoc / Development profile but have no registered devices. Register a device, or
  use an App Store Connect profile. (This error means automatic signing — make sure you're on the
  latest workflow, which uses manual signing and won't trigger it.)
- **`Provisioning profile ... has expired`**
  Profiles expire (typically after a year). Generate a fresh one and update the secret.
