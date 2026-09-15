/**
 * Bootstrap — publishes the service layer and, in ODOO mode, connects the app.
 *
 * MOCK mode: nothing else happens; the UI self-seeds and works offline.
 * ODOO mode: once the app has finished loading (its own localStorage restore
 * included), the Odoo bridge takes over sign-in, loads Odoo data into Store
 * and saves supported actions back — see src/ui/odooBridge.js.
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

  log.info('Data source = ODOO (' + CONFIG.ODOO_AUTH_MODE + ').');
  const { installOdooBridge } = await import('./ui/odooBridge.js');
  const start = function () {
    installOdooBridge()
      .catch(function (e) { log.error('Odoo bridge failed:', e); })
      .finally(function () { window.__SHARQIA_READY__ = true; });
  };
  if (document.readyState === 'complete') setTimeout(start, 0);
  else window.addEventListener('load', function () { setTimeout(start, 0); });
}

boot();
