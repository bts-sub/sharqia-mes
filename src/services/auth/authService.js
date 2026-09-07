/**
 * Authentication service.
 *
 * - Delegates the actual login to the active DataSource (mock or Odoo).
 * - Persists only a session marker/token via secure storage (never a password).
 * - Maps the authenticated user's Odoo groups -> the app's role/capabilities
 *   vocabulary so existing permission checks keep working unchanged.
 *
 * In Odoo mode, permissions must come from Odoo Users & Groups (res.groups),
 * NOT from hardcoded client rules. The GROUP_TO_ROLE map below is the single
 * place to align your Odoo security groups with the app roles — CONFIRM these
 * external IDs against your Odoo module before go-live.
 */
import { repository } from '../data/repository.js';
import { storage } from '../storage.js';
import { AuthError } from '../../core/errors.js';
import { log } from '../../core/logger.js';
import { useMock } from '../../config/env.js';

const SESSION_KEY = 'sharqia.session';

/** Odoo group external-id  ->  app role. CONFIRM external IDs with your module. */
export const GROUP_TO_ROLE = {
  'sharqia_mes.group_production_manager': 'pm',      // CONFIRM
  'sharqia_mes.group_plant_manager': 'plant',        // CONFIRM
  'sharqia_mes.group_station_worker': 'station',     // CONFIRM
  'sharqia_mes.group_quality': 'qc',                 // CONFIRM
  'sharqia_mes.group_store': 'store',                // CONFIRM
  'base.group_system': 'admin'                        // standard admin
};

function rolesFromGroups(groupExternalIds) {
  var roles = (groupExternalIds || []).map(function (g) { return GROUP_TO_ROLE[g]; }).filter(Boolean);
  return roles[0] || 'station'; // least-privilege default
}

export const authService = {
  async login(login, password) {
    if (!login) throw new AuthError('Login is required');
    var user = await repository.login(login, password);
    var role = useMock() ? (user && user.role) || 'pm' : rolesFromGroups(user && user.groups);
    var session = {
      uid: (user && user.uid) || (user && user.id) || null,
      login: login,
      name: (user && (user.name && user.name.ar)) || (user && user.name) || login,
      role: role,
      at: '' // stamp on device; avoid Date in shared code paths
    };
    await storage.setJSON(SESSION_KEY, session);
    log.info('Logged in as', login, 'role=', role);
    return session;
  },

  async logout() { await repository.logout(); await storage.remove(SESSION_KEY); },

  async restore() { return storage.getJSON(SESSION_KEY); },

  async isAuthenticated() { return !!(await this.restore()); }
};
