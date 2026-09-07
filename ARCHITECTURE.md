# Architecture

## 1. Analysis of the current project (before conversion)

The delivered project was a **single self-contained HTML file** (`sharqia_mes_v6.5.html`, ~1.6 MB):

- **Tech:** plain HTML + CSS + one large ES5 `<script>`. No framework, no build step.
- **Pages/screens:** a client-side router (`Router` / `Screens.*`) renders ~90 screens into one `#view` container (home, factory map, routes, stations, orders wizard, QC, warehouses, announcements, admin, …). RTL + Light/Dark + 4 languages.
- **Components:** function-generated HTML strings (cards, rails, drawers, modals).
- **Data:** **all in-memory** JS objects under a global `Store.*` (`prodRoutes`, `employees`, `runOrders`, `prodTemplates`, `hangers`, `defects`, `qcItems`, `announcements`, …), seeded by `cleanSeed()`. **No real API.**
- **Persistence:** `localStorage` for a few user preferences/drafts (templates, sizes, announcements read-state, theme, language). No server.
- **Auth:** `Auth.enter(account)` selects an account from `Store.accounts`; permissions via `Store.roleCaps` (role → capabilities → screens). Demo quick-login; **no real credential check, no backend session.**
- **Odoo:** referenced only descriptively (variant/BOM labels). **No network calls at all** (`grep` for `fetch/xhr/jsonrpc` = 0).

**Conclusion:** the app is a high-quality offline UI with a demo data core. To make it a real, Odoo-backed mobile app we (a) wrap it natively with **Capacitor** (keeps the UI 100%), and (b) insert a **data/service layer** so the demo `Store` seed can be replaced by live Odoo data through one config switch.

## 2. Target architecture

```
┌──────────────────────────── Capacitor native shell (Android / iOS) ───────────────────────────┐
│                                                                                                │
│   www/index.html  = pristine MES UI  +  env.js  +  bootstrap (module)  +  data hook            │
│        │  (UI reads window.Store.* exactly as before — unchanged)                              │
│        ▼                                                                                        │
│   bootstrap.js ──► repository ──► DataSource (interface)                                        │
│                        │              ├── MockDataSource   (src/mock/*.json)   [dev default]    │
│                        │              └── OdooDataSource ──► odooClient (JSON-RPC)              │
│                        │                                     odooModels (names, CONFIRM)        │
│                        │                                     mappers (Odoo ⇄ Store shapes)      │
│                        └── cache, error handling, Result/uiState                                │
│   authService ──► repository.login ──► (session cookie | API key)  +  secure storage           │
│   config/env.js ◄── window.__SHARQIA_ENV__ ◄── www/env.js ◄── .env                             │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
                                   (No server/DB shipped. Odoo endpoint supplied at runtime.)
```

### Data flow
- **Mock mode (default):** `bootstrap` does nothing to the data; the UI self-seeds from its bundled local data → every screen fully works offline. The `repository` still exposes the identical domain API (used by any new live actions and by tests).
- **Odoo mode:** `bootstrap` restores the session, calls `repository.loadAll()` → `OdooDataSource` fetches each domain via JSON-RPC and maps records into **Store shapes**, exposes them as `window.__SHARQIA_DATA__`; the **data hook** (added only to the generated `index.html`, not to the pristine app) copies them into `Store.*` and re-renders. On network/auth/server error it surfaces the error state and **never falls back to demo data**.

### Why the UI is untouched
The UI depends on `Store.*` shapes, not on Odoo. The mappers convert Odoo records into those exact shapes, so swapping the data source is invisible to every screen. The only addition to the shipped HTML is a **guarded hook** that is a complete no-op unless a live snapshot is present.

## 3. Production-readiness features
- **Environment variables** for all endpoints/secrets (`.env` → generated `www/env.js`, git-ignored). Nothing sensitive in code.
- **API service** cleanly layered (`http` → `odooClient` → `DataSource` → `repository`).
- **Error handling:** typed errors (`Network/Auth/Odoo/Validation`) + `Result`/`uiState` → screens can show *loading / empty / error / ready*.
- **Loading & empty states:** `uiState()` helper.
- **Network handling:** offline detection (Capacitor Network) + timeout + retry with backoff on 5xx/timeouts.
- **Secure auth:** session or API-key; token stored via Capacitor Preferences (Keychain/Keystore-backed); no passwords persisted.
- **Validation:** pre-write validators.
- **Logging:** leveled logger controlled by `LOG_LEVEL`.

## 4. Folder structure
```
sharqia-mes-mobile/
├─ capacitor.config.ts      # app id/name, webDir=www, no server.url
├─ .env.example             # ODOO_URL / DB / API_URL / auth (blank)
├─ package.json             # cap scripts + plugins
├─ scripts/
│  ├─ build-web.js          # env.js + copy src → www/src + generate index.html + data hook
│  ├─ check.js              # node --check every JS file
│  └─ smoke-mock.js         # data-pipeline test on mock
├─ src/
│  ├─ config/env.js
│  ├─ core/{logger,errors,result,validation}.js
│  ├─ services/
│  │  ├─ http.js  storage.js
│  │  ├─ auth/authService.js
│  │  ├─ odoo/{odooClient,odooModels,mappers}.js
│  │  └─ data/{dataSource,mockDataSource,odooDataSource,repository}.js
│  ├─ bootstrap.js
│  └─ mock/*.json
└─ www/
   ├─ app/sharqia_mes.html  # pristine UI (source of truth)
   └─ index.html            # generated (app + hooks)  ← Capacitor entry
```
