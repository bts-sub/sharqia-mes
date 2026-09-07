/**
 * DataSource contract.
 *
 * Both MockDataSource and OdooDataSource implement this exact interface, so the
 * rest of the app depends on the CONTRACT, not on Odoo. Swapping data sources is
 * a one-line config change (SHARQIA_DATA_SOURCE=mock|odoo) — no UI edits.
 *
 * Every method returns a Promise. Read methods resolve to plain data;
 * write methods resolve to the created/updated record (or its id).
 */
export class DataSource {
  // ---- Auth ----
  async login(login, password) { throw notImpl('login'); }
  async logout() { throw notImpl('logout'); }
  async currentUser() { throw notImpl('currentUser'); }

  // ---- Reads (manufacturing domain) ----
  async getEmployees() { throw notImpl('getEmployees'); }
  async getStations() { throw notImpl('getStations'); }
  async getWorkCenters() { return this.getStations(); }
  async getRoutes() { throw notImpl('getRoutes'); }
  async getBuffers() { throw notImpl('getBuffers'); }
  async getTemplates() { throw notImpl('getTemplates'); }
  async getProducts() { throw notImpl('getProducts'); }
  async getManufacturingOrders() { throw notImpl('getManufacturingOrders'); }
  async getWorkOrders(orderId) { throw notImpl('getWorkOrders'); }
  async getAnnouncements(user) { throw notImpl('getAnnouncements'); }
  async getDefects() { throw notImpl('getDefects'); }
  async getQcItems() { throw notImpl('getQcItems'); }

  // ---- Writes ----
  async createOrder(payload) { throw notImpl('createOrder'); }
  async updateOrder(id, changes) { throw notImpl('updateOrder'); }
  async updateWorkOrderStatus(id, status) { throw notImpl('updateWorkOrderStatus'); } // start|pause|finish
  async recordProduction(workOrderId, qty) { throw notImpl('recordProduction'); }
  async updateTaskProgress(taskId, changes) { throw notImpl('updateTaskProgress'); }
  async createDefect(payload) { throw notImpl('createDefect'); }
  async createAnnouncement(payload) { throw notImpl('createAnnouncement'); }

  /**
   * Bulk snapshot used by bootstrap to hydrate the UI's Store before first paint.
   * Returns an object keyed by Store domain names, e.g.
   *   { employees, stations, prodRoutes, prodTemplates, techpack, runOrders, announcements, ... }
   */
  async loadAll() { throw notImpl('loadAll'); }
}

function notImpl(name) { return new Error('DataSource.' + name + ' not implemented'); }
