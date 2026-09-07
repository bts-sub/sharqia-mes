/**
 * Bootstrap — runs before the web UI seeds itself.
 *
 * Responsibility: in ODOO mode, fetch the data snapshot and expose it as
 * `window.__SHARQIA_DATA__` so the UI hydrates from Odoo instead of its built-in
 * demo seed. In MOCK mode, it does nothing and the UI self-seeds (fully working).
 *
 * The UI reads `window.__SHARQIA_DATA__` at one guarded point (see the
 * `SHARQIA DATA HOOK` block added to www/app/sharqia_mes.html). If the snapshot
 * is absent, the UI behaves exactly as the original app — zero design changes.
 *
 * It also publishes the service layer on `window.Sharqia` so screens can call
 * repository/auth for live create/update once Odoo is wired.
 */
import { repository } from './services/data/repository.js';
import { authService } from './services/auth/authService.js';
import { CONFIG, useMock } from './config/env.js';
import { log } from './core/logger.js';

async function boot() {
  // Expose the service layer to the (non-module) app script.
  window.Sharqia = { repository: repository, auth: authService, config: CONFIG, mode: repository.mode() };

  if (useMock()) {
    log.info('Data source = MOCK. UI will self-seed from its bundled local data.');
    window.__SHARQIA_READY__ = true;
    return;
  }

  // ODOO mode: hydrate from server before the UI seeds.
  log.info('Data source = ODOO. Restoring session & loading snapshot…');
  try {
    var session = await authService.restore();
    if (!session) {
      // No session yet — the UI shows its login screen; leave data empty.
      window.__SHARQIA_NEEDS_LOGIN__ = true;
      window.__SHARQIA_READY__ = true;
      return;
    }
    var result = await repository.loadAll();
    if (result.ok) {
      window.__SHARQIA_DATA__ = result.data;   // <- UI hydration hook
      log.info('Loaded snapshot from Odoo:', Object.keys(result.data));
    } else {
      // Network/auth/server error -> surface to UI; do NOT fall back to demo data.
      window.__SHARQIA_ERROR__ = { code: result.error.code, message: result.error.message };
      log.error('Snapshot load failed:', result.error.message);
    }
  } catch (e) {
    window.__SHARQIA_ERROR__ = { code: 'boot_error', message: (e && e.message) || String(e) };
    log.error('Bootstrap error:', e);
  } finally {
    window.__SHARQIA_READY__ = true;
  }
}

boot();
