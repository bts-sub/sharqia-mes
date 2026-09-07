/**
 * MockDataSource — local, offline data for development.
 *
 * Reads representative JSON from ../../mock/*.json. This is the ONLY data used
 * while SHARQIA_DATA_SOURCE=mock. No network, no server, no external DB.
 *
 * The richer, fully-interactive dataset still lives inside the web UI's own
 * built-in seed (www/app/sharqia_mes.html). In mock mode the app self-seeds,
 * so screens stay 100% functional; this class exists so that (a) the repository
 * API is identical in both modes and (b) the data pipeline is testable in Node.
 */
import { DataSource } from './dataSource.js';

// Static JSON imports (bundled locally). In Node, use the smoke-test loader.
async function load(name) {
  const mod = await import('../../mock/' + name + '.json', { assert: { type: 'json' } })
    .catch(() => import('../../mock/' + name + '.json')); // fallback for older runtimes
  return (mod && (mod.default || mod)) || [];
}

export class MockDataSource extends DataSource {
  async login(login, password) {
    const users = await load('users');
    const u = users.find(function (x) { return x.login === login; }) || users[0];
    if (!u) throw new Error('No mock users');
    this._user = u;
    return u;
  }
  async logout() { this._user = null; }
  async currentUser() { return this._user || null; }

  async getEmployees() { return load('employees'); }
  async getStations() { return load('stations'); }
  async getRoutes() { return load('routes'); }
  async getBuffers() { return load('buffers'); }
  async getTemplates() { return load('templates'); }
  async getProducts() { return load('products'); }
  async getManufacturingOrders() { return load('manufacturing_orders'); }
  async getWorkOrders() { return load('work_orders'); }
  async getAnnouncements() { return load('announcements'); }
  async getDefects() { return load('defects'); }
  async getQcItems() { return load('qc_items'); }

  // Writes are local no-ops that echo the payload (persisted only in memory).
  async createOrder(p) { return Object.assign({ id: 'RUN-MOCK', _mock: true }, p); }
  async updateOrder(id, c) { return Object.assign({ id: id, _mock: true }, c); }
  async updateWorkOrderStatus(id, status) { return { id: id, status: status, _mock: true }; }
  async recordProduction(id, qty) { return { id: id, qty: qty, _mock: true }; }
  async updateTaskProgress(id, c) { return Object.assign({ id: id, _mock: true }, c); }
  async createDefect(p) { return Object.assign({ id: 'DEF-MOCK', _mock: true }, p); }
  async createAnnouncement(p) { return Object.assign({ id: Date.now ? 0 : 0, _mock: true }, p); }

  async loadAll() {
    const [employees, stations, prodRoutes, buffers, prodTemplates, techpack, runOrders, announcements, defects, qcItems] =
      await Promise.all([
        this.getEmployees(), this.getStations(), this.getRoutes(), this.getBuffers(),
        this.getTemplates(), this.getProducts(), this.getManufacturingOrders(),
        this.getAnnouncements(), this.getDefects(), this.getQcItems()
      ]);
    return { employees, stations, prodRoutes, buffers, prodTemplates, techpack, runOrders, announcements, defects, qcItems };
  }
}
