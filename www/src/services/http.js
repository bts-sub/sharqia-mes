/**
 * HTTP layer: fetch with timeout, retry, and network-awareness.
 * Uses Capacitor Network (when available) to fail fast when offline,
 * and Capacitor's native HTTP (when enabled) to avoid CORS with Odoo.
 *
 * This module never targets a hardcoded host — callers pass the full URL,
 * which is derived from config (src/config/env.js).
 */
import { CONFIG } from '../config/env.js';
import { NetworkError, AppError } from '../core/errors.js';
import { log } from '../core/logger.js';

async function isOnline() {
  try {
    // Optional dependency — present only inside the Capacitor runtime.
    const mod = await import('@capacitor/network').catch(() => null);
    if (mod && mod.Network) {
      const s = await mod.Network.getStatus();
      return !!s.connected;
    }
  } catch (e) { /* ignore */ }
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') return navigator.onLine;
  return true; // assume online if we cannot tell
}

function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new NetworkError('Request timed out after ' + ms + 'ms')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

/**
 * POST JSON and parse JSON back. Retries transient failures.
 * @returns parsed JSON body
 */
export async function postJson(url, body, opts) {
  opts = opts || {};
  if (!(await isOnline())) throw new NetworkError('Device is offline');

  const attempts = (opts.retries != null ? opts.retries : CONFIG.HTTP_RETRIES) + 1;
  const timeoutMs = opts.timeoutMs || CONFIG.HTTP_TIMEOUT_MS;
  let lastErr;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await withTimeout(fetch(url, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json', 'Accept': 'application/json' }, opts.headers || {}),
        credentials: opts.credentials || 'include', // Odoo session cookies
        body: JSON.stringify(body)
      }), timeoutMs);

      if (!res.ok) {
        // 5xx is retryable; 4xx is not.
        if (res.status >= 500 && i < attempts - 1) { lastErr = new AppError('HTTP ' + res.status, 'http_' + res.status); continue; }
        throw new AppError('HTTP ' + res.status + ' from ' + url, 'http_' + res.status);
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      const retryable = (e instanceof NetworkError) || (e && String(e.code || '').indexOf('http_5') === 0);
      log.warn('http attempt', i + 1, 'failed:', e && e.message);
      if (!retryable || i === attempts - 1) break;
    }
  }
  throw lastErr || new NetworkError('Request failed');
}
