/**
 * Runtime configuration.
 *
 * Values come from `window.__SHARQIA_ENV__`, which is generated at build time
 * from your `.env` file by `scripts/build-web.js` into `www/env.js`
 * (git-ignored). Nothing sensitive is hardcoded here.
 *
 * This module has NO side effects and never contacts a network.
 */

function readEnv() {
  var e = (typeof window !== 'undefined' && window.__SHARQIA_ENV__) || {};
  return {
    // "mock" | "odoo"
    DATA_SOURCE: (e.SHARQIA_DATA_SOURCE || 'mock').toLowerCase(),
    ODOO_URL: e.ODOO_URL || '',
    ODOO_DATABASE: e.ODOO_DATABASE || '',
    ODOO_API_URL: e.ODOO_API_URL || '',
    // "gateway" | "session" | "apikey"
    ODOO_AUTH_MODE: (e.ODOO_AUTH_MODE || 'session').toLowerCase(),
    // Gateway mode: path of the Sharqia portal's MES gateway (same origin).
    MES_GATEWAY: e.MES_GATEWAY || '/api/mes',
    HTTP_TIMEOUT_MS: parseInt(e.HTTP_TIMEOUT_MS, 10) || 15000,
    HTTP_RETRIES: parseInt(e.HTTP_RETRIES, 10) || 2,
    LOG_LEVEL: (e.LOG_LEVEL || 'info').toLowerCase()
  };
}

export const CONFIG = readEnv();

/** True while running on local mock data (no Odoo required). */
export function useMock() {
  return CONFIG.DATA_SOURCE !== 'odoo';
}

/** True when Odoo is reached through the portal gateway (no Odoo user per worker). */
export function useGateway() {
  return CONFIG.ODOO_AUTH_MODE === 'gateway';
}

/** The effective JSON-RPC endpoint (ODOO_API_URL overrides ODOO_URL). */
export function odooEndpoint() {
  if (useGateway()) return CONFIG.MES_GATEWAY.replace(/\/+$/, '');
  var base = (CONFIG.ODOO_API_URL || CONFIG.ODOO_URL || '').replace(/\/+$/, '');
  return base;
}

/** Guard used before any real Odoo call — fails fast with a clear message. */
export function assertOdooConfigured() {
  if (useMock()) return;
  if (!odooEndpoint()) {
    throw new Error(
      'Odoo is selected as the data source but ODOO_URL/ODOO_API_URL is empty. ' +
      'Set it in .env and rebuild (npm run prepare:web).'
    );
  }
}
