# iOS IPA build via GitHub Actions

This repo builds a signed iOS `.ipa` automatically when you **push to the `prod` branch**
(workflow: [.github/workflows/ios-build.yml](../.github/workflows/ios-build.yml)).
You can also run it manually from the **Actions** tab and pick a different export method.

The finished `.ipa` is uploaded as a build **artifact** — download it from the workflow
run page (bottom, "Artifacts" → `hrms-ios-ipa`).

---

## What you need from Apple (one-time)

You need an **Apple Developer Program** membership ($99/yr). From it you'll collect 5 things
and store them as **GitHub repository Secrets**. None of these are ever committed to the repo.

The build uses **manual code signing** (deterministic, the correct choice for CI). You supply
the distribution certificate **and** a matching provisioning profile explicitly.

| GitHub Secret name                 | Required? | What it is                                            |
| ---------------------------------- | --------- | ----------------------------------------------------- |
| `IOS_DIST_CERT_P12_BASE64`         | **Yes**   | Your **Apple Distribution certificate** (.p12) → base64 |
| `IOS_DIST_CERT_PASSWORD`           | **Yes**   | The password you set when exporting the .p12          |
| `IOS_PROVISIONING_PROFILE_BASE64`  | **Yes**   | Your **distribution provisioning profile** (.mobileprovision) → base64 |
| `IOS_TEAM_ID`                      | **Yes**   | Your 10-character Apple Developer **Team ID**         |
| `IOS_KEYCHAIN_PASSWORD`            | **Yes**   | Any random string you make up (temp keychain password)|
| `APPSTORE_API_KEY_ID`              | Optional  | App Store Connect API **Key ID**                      |
| `APPSTORE_API_ISSUER_ID`          | Optional  | App Store Connect API **Issuer ID**                   |
| `APPSTORE_API_PRIVATE_KEY_BASE64`  | Optional  | App Store Connect API key `.p8` file → base64          |

> **Manual signing:** the workflow installs the profile from `IOS_PROVISIONING_PROFILE_BASE64`
> and reads its name automatically — nothing is hardcoded. The provisioning profile **must
> match the export method**: an *App Store* profile for the default `app-store` method, an
> *Ad Hoc* profile for `ad-hoc`, etc. The `APPSTORE_API_*` secrets are **no longer used for
> signing** — keep them only if you later add an App Store / TestFlight upload step.

---

## Step 1 — Team ID  → `IOS_TEAM_ID`

1. Go to <https://developer.apple.com/account>.
2. Scroll to **Membership details**.
3. Copy the **Team ID** (10 chars, e.g. `A1B2C3D4E5`).

## Step 2 — App Store Connect API key → `APPSTORE_API_KEY_ID`, `APPSTORE_API_ISSUER_ID`, `APPSTORE_API_PRIVATE_KEY`

This is the modern "Apple console information" you asked about — it lets CI talk to Apple
without your Apple ID/password or 2FA.

1. Go to <https://appstoreconnect.apple.com/access/integrations/api> (Users and Access → **Integrations** → App Store Connect API).
2. Click **+** to generate a new key.
   - Name: e.g. `github-ci`
   - Access role: **App Manager** (enough to build/sign/upload).
3. After creating it you'll see:
   - **Issuer ID** (a UUID at the top) → secret `APPSTORE_API_ISSUER_ID`
   - **Key ID** (in the table) → secret `APPSTORE_API_KEY_ID`
   - A **Download** button for `AuthKey_XXXXXXXXXX.p8` → **download it now** (you can only download once).
4. Convert the downloaded `.p8` to **base64** and store it as `APPSTORE_API_PRIVATE_KEY_BASE64`
   (base64 avoids the newline-corruption that causes `401` auth failures):
   - **macOS / Linux / Git Bash:** `base64 -w0 AuthKey_XXXXXXXXXX.p8`
   - **PowerShell:** `[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXXXXXXXX.p8")) | Set-Clipboard`

## Step 3 — Distribution certificate → `IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD`

You need an **Apple Distribution** certificate exported as a `.p12` (certificate + private key).

**Easiest path (on a Mac with Xcode):**
1. Open **Xcode → Settings → Accounts**, select your team → **Manage Certificates…**
2. Click **+** → **Apple Distribution**. (If one already exists you can reuse it.)
3. Open the **Keychain Access** app → **My Certificates**.
4. Find the **Apple Distribution: …** entry, right-click → **Export**.
5. Save as `.p12`, set a password → this password is the secret `IOS_DIST_CERT_PASSWORD`.

**Don't have a Mac?** You can create the certificate from the website:
1. Create a CSR (Certificate Signing Request). On Windows you can use OpenSSL:
   ```bash
   openssl genrsa -out ios_dist.key 2048
   openssl req -new -key ios_dist.key -out ios_dist.csr -subj "/emailAddress=you@example.com/CN=HRMS Distribution/C=GB"
   ```
2. Go to <https://developer.apple.com/account/resources/certificates/list> → **+** →
   **Apple Distribution** → upload `ios_dist.csr` → download `distribution.cer`.
3. Convert to `.p12`:
   ```bash
   openssl x509 -in distribution.cer -inform DER -out ios_dist.pem -outform PEM
   openssl pkcs12 -export -inkey ios_dist.key -in ios_dist.pem -out dist_cert.p12
   ```
   The password you type here is `IOS_DIST_CERT_PASSWORD`.

### Convert the .p12 to base64 → `IOS_DIST_CERT_P12_BASE64`

- **macOS / Linux:**
  ```bash
  base64 -i dist_cert.p12 | pbcopy        # macOS (copies to clipboard)
  base64 -w0 dist_cert.p12 > cert.b64.txt # Linux
  ```
- **Windows (PowerShell):**
  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("dist_cert.p12")) | Set-Clipboard
  ```
Paste the resulting text as the secret value.

## Step 3b — Provisioning profile → `IOS_PROVISIONING_PROFILE_BASE64`

Because we sign **manually**, you must supply the provisioning profile yourself. It must be tied
to the App ID `uk.co.talentshield.hrms`, your Distribution certificate (Step 3), and the export
method you build (default = **App Store**).

1. Make sure the App ID exists: <https://developer.apple.com/account/resources/identifiers/list>
   → **+** → **App IDs** → **App** → Bundle ID `uk.co.talentshield.hrms` (explicit).
2. Create the profile: <https://developer.apple.com/account/resources/profiles/list> → **+**
   - For the default build choose **App Store Connect** (distribution).
     (Choose **Ad Hoc** or **iOS App Development** instead if you build those export methods.)
   - App ID: `uk.co.talentshield.hrms`
   - Certificate: the **Apple Distribution** cert from Step 3.
   - Name it something memorable, then **Download** the `.mobileprovision`.
3. Convert it to base64 and store it as `IOS_PROVISIONING_PROFILE_BASE64`:
   - **macOS / Linux:** `base64 -w0 HRMS_AppStore.mobileprovision` (macOS: `base64 -i HRMS_AppStore.mobileprovision | pbcopy`)
   - **Windows (PowerShell):** `[Convert]::ToBase64String([IO.File]::ReadAllBytes("HRMS_AppStore.mobileprovision")) | Set-Clipboard`

> The workflow reads the profile's **name** from the file at build time, so you never need to
> paste the name anywhere. Just re-generate this secret whenever the profile is renewed/replaced.

## Step 4 — Keychain password → `IOS_KEYCHAIN_PASSWORD`

Just invent any random string (e.g. from a password manager). It's only used to lock the
temporary keychain created during the build.

---

## Step 5 — Add all secrets to GitHub

1. Repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Add each of the 7 secrets from the table above.

## Step 6 — Create the `prod` branch and push

```bash
git checkout -b prod
git push -u origin prod
```
Every push to `prod` from now on triggers the build. Watch it under the **Actions** tab.

---

## Which export method gives an installable IPA?

The workflow defaults to `app-store` on a `prod` push. Pick the method that matches your goal
(manual run → "Run workflow" → choose `export_method`):

| Method        | Can you install the .ipa directly on a phone?                         |
| ------------- | --------------------------------------------------------------------- |
| `app-store`   | **No** — it's for uploading to App Store / TestFlight.                |
| `ad-hoc`      | **Yes**, but only on devices whose UDID is registered in your account.|
| `development` | **Yes**, on registered development devices.                           |
| `enterprise`  | **Yes**, anywhere — only if you have the Apple Enterprise Program.    |

To install an ad-hoc IPA: register your device UDIDs at
<https://developer.apple.com/account/resources/devices/list> first, then run the workflow
with `export_method = ad-hoc`. Install via Apple Configurator, a service like Diawi, or Xcode
Devices window.

> **Tip:** For testers, the smoothest route is `app-store` + upload to **TestFlight**. If you
> want, the workflow can be extended with a final step that runs
> `xcrun altool`/`xcodebuild -exportArchive` upload to push the build straight to TestFlight.

---

## Troubleshooting

- **`xcodebuild: error: The workspace ... does not contain a scheme named "App"`**
  The `App` scheme isn't shared. On a Mac: Xcode → Product → Scheme → **Manage Schemes…** →
  tick **Shared** for `App`, then commit the new file under
  `ios/App/App.xcodeproj/xcshareddata/xcschemes/`.
- **`No signing certificate "iOS Distribution" found`**
  The `.p12` is wrong/empty, or it's a *Development* cert. Re-export an **Apple Distribution** cert.
- **`No profiles for 'uk.co.talentshield.hrms' were found`** /
  **`Revoke certificate: ... Apple Development signing certificate ...`**
  These come from **automatic** signing trying to manage certs/profiles on the CI machine.
  This workflow uses **manual** signing, so make sure `IOS_PROVISIONING_PROFILE_BASE64` is set
  to a valid distribution profile for `uk.co.talentshield.hrms` (Step 3b) that **matches the
  export method**, and that its certificate matches `IOS_DIST_CERT_P12_BASE64`.
- **`No signing certificate "Apple Distribution" found`**
  Your `.p12` is a legacy *iPhone Distribution* cert. Either re-export an **Apple Distribution**
  cert, or change `CODE_SIGN_IDENTITY` / `signingCertificate` in the workflow to
  `iPhone Distribution`.
- **`... doesn't match the provisioning profile ... (method mismatch)`**
  The installed profile type must match `export_method` — App Store profile for `app-store`,
  Ad Hoc profile for `ad-hoc`, Development profile for `development`.
