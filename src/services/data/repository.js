/**
 * Repository — the single entry point the app uses for data.
 *
 * It picks the concrete DataSource by config (mock|odoo), adds a light in-memory
 * cache, and re-exposes the domain methods. UI/business code imports ONLY this;
 * it never imports Odoo or Mock classes directly.
 */
import { useMock } from '../../config/env.js';
import { MockDataSource } from './mockDataSource.js';
import { OdooDataSource } from './odooDataSource.js';
import { attempt } from '../../core/result.js';
import { log } from '../../core/logger.js';

function makeSource() {
  return useMock() ? new MockDataSource() : new OdooDataSource();
}

const source = makeSource();
const cache = {};

export const repository = {
  source() { return source; },
  mode() { return useMock() ? 'mock' : 'odoo'; },

  // Auth passthrough
  login(login, password) { return source.login(login, password); },
  logout() { cacheClear(); return source.logout(); },
  currentUser() { return source.currentUser(); },

  // Cached reads (invalidate on writes)
  employees(force) { return cached('employees', force, function () { return source.getEmployees(); }); },
  stations(force) { return cached('stations', force, function () { return source.getStations(); }); },
  routes(force) { return cached('routes', force, function () { return source.getRoutes(); }); },
  buffers(force) { return cached('buffers', force, function () { return source.getBuffers(); }); },
  templates(force) { return cached('templates', force, function () { return source.getTemplates(); }); },
  products(force) { return cached('products', force, function () { return source.getProducts(); }); },
  orders(force) { return cached('orders', force, function () { return source.getManufacturingOrders(); }); },
  workOrders(orderId) { return source.getWorkOrders(orderId); },
  announcements(user, force) { return cached('announcements', force, function () { return source.getAnnouncements(user); }); },
  defects(force) { return cached('defects', force, function () { return source.getDefects(); }); },
  qcItems(force) { return cached('qcItems', force, function () { return source.getQcItems(); }); },

  // Writes (invalidate relevant cache)
  async createOrder(p) { const r = await source.createOrder(p); invalidate('orders'); return r; },
  async updateOrder(id, c) { const r = await source.updateOrder(id, c); invalidate('orders'); return r; },
  async updateWorkOrderStatus(id, s) { const r = await source.updateWorkOrderStatus(id, s); invalidate('orders'); return r; },
  async recordProduction(id, q) { const r = await source.recordProduction(id, q); invalidate('orders'); return r; },
  async updateTaskProgress(id, c) { return source.updateTaskProgress(id, c); },
  async createDefect(p) { const r = await source.createDefect(p); invalidate('defects'); return r; },
  async createAnnouncement(p) { const r = await source.createAnnouncement(p); invalidate('announcements'); return r; },

  /** Snapshot for bootstrap. Returns a Result (never throws). */
  loadAll() { return attempt(function () { return source.loadAll(); }); }
};

function cached(key, force, fn) {
  if (!force && cache[key]) return Promise.resolve(cache[key]);
  return Promise.resolve(fn()).then(function (v) { cache[key] = v; return v; });
}
function invalidate(key) { delete cache[key]; log.debug('cache invalidated:', key); }
function cacheClear() { Object.keys(cache).forEach(function (k) { delete cache[k]; }); }
