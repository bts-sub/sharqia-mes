/**
 * Odoo client (Odoo 19 compatible).
 *
 * Three auth modes (see .env ODOO_AUTH_MODE):
 *   - "gateway": the Sharqia portal's MES gateway (/api/mes, same origin).
 *                Workers sign in with their portal account; the portal checks
 *                their app role (hr.employee.mes_role) and runs the ORM call
 *                with its service account, limited to MES models. Default for
 *                the deployed app — factory workers have no Odoo users.
 *   - "session": POST /web/session/authenticate with {db,login,password};
 *                subsequent calls reuse the session cookie (credentials:'include').
 *   - "apikey" : send an Odoo API key; call the ORM through /jsonrpc "call_kw".
 *
 * This client does NOT contain any URL, database, or credentials. Everything
 * comes from config (src/config/env.js) at runtime. If not configured, calls
 * throw a clear error instead of contacting anything.
 */
import { CONFIG, odooEndpoint, assertOdooConfigured, useGateway } from '../../config/env.js';
import { postJson } from '../http.js';
import { OdooError, AuthError, NetworkError } from '../../core/errors.js';
import { log } from '../../core/logger.js';

let _session = { uid: null, apiKey: null, login: null, account: null };

function rpc(method, params) {
  return { jsonrpc: '2.0', method: method || 'call', params: params || {}, id: Math.floor(Math.random ? 0 : 0) };
}

function unwrap(resp) {
  if (resp && resp.error) {
    var d = resp.error.data || {};
    throw new OdooError(d.message || resp.error.message || 'Odoo RPC error', d);
  }
  return resp ? resp.result : null;
}

/**
 * Gateway request. The portal answers {result} or {error: "<Arabic message>"}
 * with an HTTP status, so the message is surfaced as-is (401 → AuthError).
 */
async function gateway(path, body) {
  var res;
  try {
    res = await fetch(odooEndpoint() + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (e) {
    throw new NetworkError('تعذّر الاتصال بالخادم', e);
  }
  var data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON */ }
  if (!res.ok) {
    var msg = (data && data.error) || ('HTTP ' + res.status);
    if (res.status === 401 || res.status === 403) throw new AuthError(msg);
    throw new OdooError(msg, data);
  }
  return data;
}

export const odooClient = {
  session() { return _session; },

  /** Web-session (or gateway) login. Returns {uid, name, ...} on success. */
  async authenticateSession(login, password) {
    assertOdooConfigured();
    if (useGateway()) {
      var r = await gateway('/login', { login: login, password: password });
      _session = { uid: r.account.employeeId, apiKey: null, login: login, account: r.account };
      log.info('MES gateway session for', login, 'role=', r.account.role);
      return r.account;
    }
    var url = odooEndpoint() + '/web/session/authenticate';
    var body = rpc('call', { db: CONFIG.ODOO_DATABASE, login: login, password: password });
    var result = unwrap(await postJson(url, body, { credentials: 'include' }));
    if (!result || !result.uid) throw new AuthError('Invalid credentials or database');
    _session = { uid: result.uid, apiKey: null, login: login, account: null };
    log.info('Odoo session established for uid', result.uid);
    return result;
  },

  /** Gateway only: the account of a still-valid session cookie, or null. */
  async currentAccount() {
    if (!useGateway()) return null;
    try {
      var r = await gateway('/me');
      _session = { uid: r.account.employeeId, apiKey: null, login: r.account.u, account: r.account };
      return r.account;
    } catch (e) {
      if (e instanceof AuthError) return null;
      throw e;
    }
  },

  /** API-key auth (no cookie). The key is attached per call via /jsonrpc. */
  setApiKey(login, apiKey) { _session = { uid: null, apiKey: apiKey, login: login, account: null }; },

  async logout() {
    _session = { uid: null, apiKey: null, login: null, account: null };
    if (useGateway()) {
      try { await gateway('/logout', {}); } catch (e) {}
    } else if (CONFIG.ODOO_AUTH_MODE === 'session') {
      try { await postJson(odooEndpoint() + '/web/session/destroy', rpc('call', {}), { credentials: 'include' }); } catch (e) {}
    }
  },

  /**
   * Generic ORM call. Mirrors Odoo's call_kw(model, method, args, kwargs).
   */
  async callKw(model, method, args, kwargs) {
    assertOdooConfigured();
    if (useGateway()) {
      return (await gateway('/call', { model: model, method: method, args: args || [], kwargs: kwargs || {} })).result;
    }
    var url = odooEndpoint() + '/jsonrpc';
    var params;
    if (CONFIG.ODOO_AUTH_MODE === 'apikey') {
      // execute_kw(db, uid, api_key, model, method, args, kwargs)
      params = {
        service: 'object', method: 'execute_kw',
        args: [CONFIG.ODOO_DATABASE, _session.login, _session.apiKey, model, method, args || [], kwargs || {}]
      };
    } else {
      // Session-mode: dataset/call_kw through the web controller.
      url = odooEndpoint() + '/web/dataset/call_kw';
      params = { model: model, method: method, args: args || [], kwargs: kwargs || {} };
    }
    return unwrap(await postJson(url, rpc('call', params), { credentials: 'include' }));
  },

  /** Convenience: search_read. */
  searchRead(model, domain, fields, opts) {
    opts = opts || {};
    return this.callKw(model, 'search_read', [domain || []], {
      fields: fields || [], limit: opts.limit || 0, offset: opts.offset || 0, order: opts.order || ''
    });
  },

  create(model, values) { return this.callKw(model, 'create', [values]); },
  write(model, ids, values) { return this.callKw(model, 'write', [ids, values]); },
  callMethod(model, method, ids, kwargs) { return this.callKw(model, method, [ids], kwargs || {}); }
};
