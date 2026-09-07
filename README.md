# Sharqia MES — Mobile App (Capacitor)

Real Android/iOS app that wraps the existing **Sharqia Hanging System** MES web UI
(`www/app/sharqia_mes.html`, v6.5.69) with **zero design changes**, plus a clean,
Odoo-ready **data/service layer**.

> **No backend, database, or demo server is bundled or assumed.** During
> development the app runs on **local mock data**. When you are ready, you point
> it at *your* Odoo 19 SaaS by editing `.env` only — the UI does not change.

---

## What's inside

| Layer | Where | Purpose |
|---|---|---|
| UI (unchanged) | `www/app/sharqia_mes.html` | The full MES interface, pristine. |
| Runtime config | `src/config/env.js` + `.env` | `SHARQIA_DATA_SOURCE`, `ODOO_URL`, … |
| Core utils | `src/core/*` | logger, typed errors, Result/UI-states, validation |
| HTTP / storage | `src/services/http.js`, `storage.js` | timeout+retry+offline; secure key/value |
| Auth | `src/services/auth/authService.js` | login/logout, Odoo groups → app roles |
| Odoo client | `src/services/odoo/*` | JSON-RPC client, **model/field map (CONFIRM)**, mappers |
| Data sources | `src/services/data/*` | `DataSource` contract, Mock + Odoo, `repository` |
| Bootstrap | `src/bootstrap.js` | hydrates the UI from Odoo before first paint |
| Mock data | `src/mock/*.json` | local, offline development data |

Full details: **`ARCHITECTURE.md`** and **`ODOO_INTEGRATION.md`**.

---

## Prerequisites
- Node.js ≥ 18
- Android Studio (for Android APK) and/or Xcode 15+ on macOS (for iOS)
- `npm i -g @capacitor/cli` (or use `npx`)

## Install & prepare
```bash
npm install
cp .env.example .env          # keep SHARQIA_DATA_SOURCE=mock for now
npm run prepare:web           # generates www/env.js, www/src, www/index.html
npm run check                 # syntax-check the service layer
npm run test:mock             # prove the data pipeline on mock data
```

## Run in a browser (quick check)
```bash
npx serve www                 # or: python3 -m http.server -d www 8080
# open http://localhost:8080
```

## Build the Android app (APK/AAB)
```bash
npm run android:add           # one-time: creates /android
npm run android:open          # opens Android Studio (Build ▸ Build APK/Bundle)
# CLI alternative:
cd android && ./gradlew assembleDebug        # debug APK
#            ./gradlew assembleRelease        # release (configure signing first)
```
APK output: `android/app/build/outputs/apk/…`

## Build the iOS app (macOS only)
```bash
npm run ios:add               # one-time: creates /ios
npm run ios:open              # opens Xcode → set Team/signing → Run/Archive
```

## Switch to Odoo (later — after confirming your module)
1. Fill `.env`: `SHARQIA_DATA_SOURCE=odoo`, `ODOO_URL`, `ODOO_DATABASE`, `ODOO_AUTH_MODE`.
2. Confirm the real model/field names in `src/services/odoo/odooModels.js` (see checklist in `ODOO_INTEGRATION.md`).
3. `npm run prepare:web && npx cap sync` → rebuild.
No screen/UI code changes are required.
