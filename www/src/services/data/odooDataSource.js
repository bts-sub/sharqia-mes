/**
 * OdooDataSource — implements the DataSource contract against Odoo 19.
 *
 * Deployed through the portal gateway (ODOO_AUTH_MODE=gateway); the direct
 * session/apikey modes still work for an Odoo user.
 *
 * All ORM specifics are isolated to odooClient + odooModels + mappers.
 */
import { DataSource } from './dataSource.js';
import { odooClient } from '../odoo/odooClient.js';
import { MODELS, FIELDS, WO_METHODS } from '../odoo/odooModels.js';
import * as map from '../odoo/mappers.js';
import { CONFIG } from '../../config/env.js';
import { log } from '../../core/logger.js';

export class OdooDataSource extends DataSource {
  async login(login, password) {
    if (CONFIG.ODOO_AUTH_MODE === 'apikey') { odooClient.setApiKey(login, password); return { login: login }; }
    return odooClient.authenticateSession(login, password);
  }
  async logout() { return odooClient.logout(); }
  async currentUser() { return odooClient.session(); }
  async currentAccount() { return odooClient.currentAccount(); }

  async getEmployees() { return (await odooClient.searchRead(MODELS.EMPLOYEE, [['active', '=', true]], FIELDS.EMPLOYEE)).map(map.mapEmployee); }
  async getStations(employees) {
    const staff = {};
    (employees || []).forEach(function (e) { if (e.station) staff[e.station] = (staff[e.station] || 0) + 1; });
    return (await odooClient.searchRead(MODELS.STATION, [], FIELDS.STATION)).map(function (r) { return map.mapStation(r, staff); });
  }
  async getBuffers() { return (await odooClient.searchRead(MODELS.BUFFER, [], FIELDS.BUFFER)).map(map.mapBuffer); }
  async getProducts() { return (await odooClient.searchRead(MODELS.PRODUCT, [], FIELDS.PRODUCT)).map(map.mapProduct); }

  async getRoutes() {
    const [routes, points] = await Promise.all([
      odooClient.searchRead(MODELS.ROUTE, [], FIELDS.ROUTE),
      odooClient.searchRead(MODELS.ROUTE_POINT, [], FIELDS.ROUTE_POINT)
    ]);
    const pointsById = {};
    points.map(map.mapRoutePoint).forEach(function (p) { pointsById[p.id] = p; });
    return routes.map(function (r) { return map.mapRoute(r, pointsById); });
  }

  async getTemplates() { return odooClient.searchRead(MODELS.TEMPLATE, [], FIELDS.TEMPLATE); }
  async getManufacturingOrders(routes) {
    // An order's stages are the stations of the routes linked to it, in order.
    const stagesByMo = {};
    (routes || []).forEach(function (r) {
      if (!r.mo) return;
      const list = stagesByMo[r.mo] = stagesByMo[r.mo] || [];
      r.points.forEach(function (p) { if (list.indexOf(p.station) < 0) list.push(p.station); });
    });
    return (await odooClient.searchRead(MODELS.MO, [], FIELDS.MO, { order: 'id desc', limit: 500 }))
      .map(function (r) { return map.mapMO(r, stagesByMo); });
  }
  async getWorkOrders(orderId) {
    const domain = orderId ? [['production_id', '=', orderId]] : [];
    return odooClient.searchRead(MODELS.WORKORDER, domain, FIELDS.WORKORDER);
  }
  async getAnnouncements() { return (await odooClient.searchRead(MODELS.ANNOUNCEMENT, [], FIELDS.ANNOUNCEMENT)).map(map.mapAnnouncement); }
  async getDefects() { return (await odooClient.searchRead(MODELS.DEFECT, [], FIELDS.DEFECT, { limit: 500 })).map(map.mapDefect); }
  async getQcItems() { return (await odooClient.searchRead(MODELS.QC_CHECK, [], FIELDS.QC_CHECK, { limit: 500 })).map(map.mapQcCheck); }

  async createOrder(payload) { return odooClient.create(MODELS.MO, payload); }
  async updateOrder(id, changes) { return odooClient.write(MODELS.MO, [id], changes); }

  async updateWorkOrderStatus(id, status) {
    const method = status === 'start' ? WO_METHODS.START : status === 'pause' ? WO_METHODS.PAUSE : WO_METHODS.FINISH;
    return odooClient.callMethod(MODELS.WORKORDER, method, [id]);
  }
  async recordProduction(workOrderId, qty) {
    return odooClient.write(MODELS.WORKORDER, [workOrderId], map.toOdooWorkorderProgress({ qtyProduced: qty }));
  }
  async updateTaskProgress(taskId, changes) { return odooClient.write(MODELS.WORKORDER, [taskId], map.toOdooWorkorderProgress(changes)); }
  async createDefect(payload) { return odooClient.create(MODELS.DEFECT, map.toOdooDefect(payload)); }
  async createAnnouncement(payload) { return odooClient.create(MODELS.ANNOUNCEMENT, map.toOdooAnnouncement(payload)); }
  async updateAnnouncement(id, payload) { return odooClient.write(MODELS.ANNOUNCEMENT, [id], map.toOdooAnnouncement(payload)); }

  async loadAll() {
    log.info('Loading all domains from Odoo…');
    const [employees, prodRoutes, buffers, prodTemplates, techpack, announcements, defects, qcItems] =
      await Promise.all([
        this.getEmployees(), this.getRoutes(), this.getBuffers(), this.getTemplates(),
        this.getProducts(), this.getAnnouncements(), this.getDefects(), this.getQcItems()
      ]);
    const [stations, runOrders] = await Promise.all([
      this.getStations(employees), this.getManufacturingOrders(prodRoutes)
    ]);
    return { employees, stations, prodRoutes, buffers, prodTemplates, techpack, runOrders, announcements, defects, qcItems };
  }
}
