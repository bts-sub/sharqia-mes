/**
 * OdooDataSource — implements the DataSource contract against Odoo 19 SaaS.
 *
 * ⚠️ This talks to whatever ODOO_URL/ODOO_DATABASE you configure. It ships with
 * NO endpoint. Until you confirm the custom module's model/field names
 * (odooModels.js), keep SHARQIA_DATA_SOURCE=mock — every method here will throw a
 * clear "not configured" error rather than hitting anything.
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

  async getEmployees() { return (await odooClient.searchRead(MODELS.EMPLOYEE, [['active', '=', true]], FIELDS.EMPLOYEE)).map(map.mapEmployee); }
  async getStations() { return (await odooClient.searchRead(MODELS.STATION, [], FIELDS.STATION)).map(map.mapStation); }
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
  async getManufacturingOrders() { return (await odooClient.searchRead(MODELS.MO, [], FIELDS.MO)).map(map.mapMO); }
  async getWorkOrders(orderId) {
    const domain = orderId ? [['production_id', '=', orderId]] : [];
    return odooClient.searchRead(MODELS.WORKORDER, domain, FIELDS.WORKORDER);
  }
  async getAnnouncements() { return (await odooClient.searchRead(MODELS.ANNOUNCEMENT, [], FIELDS.ANNOUNCEMENT)).map(map.mapAnnouncement); }
  async getDefects() { return odooClient.searchRead(MODELS.DEFECT, [], FIELDS.DEFECT); }
  async getQcItems() { return odooClient.searchRead(MODELS.QC_CHECK, [], FIELDS.QC_CHECK); }

  async createOrder(payload) { return odooClient.create(MODELS.MO, payload); }
  async updateOrder(id, changes) { return odooClient.write(MODELS.MO, [id], changes); }

  async updateWorkOrderStatus(id, status) {
    const method = status === 'start' ? WO_METHODS.START : status === 'pause' ? WO_METHODS.PAUSE : WO_METHODS.FINISH;
    return odooClient.callMethod(MODELS.WORKORDER, method, [id]);
  }
  async recordProduction(workOrderId, qty) {
    // CONFIRM: standard mrp uses a wizard; a custom method is usually cleaner.
    return odooClient.write(MODELS.WORKORDER, [workOrderId], map.toOdooWorkorderProgress({ qtyProduced: qty }));
  }
  async updateTaskProgress(taskId, changes) { return odooClient.write(MODELS.WORKORDER, [taskId], map.toOdooWorkorderProgress(changes)); }
  async createDefect(payload) { return odooClient.create(MODELS.DEFECT, map.toOdooDefect(payload)); }
  async createAnnouncement(payload) { return odooClient.create(MODELS.ANNOUNCEMENT, map.toOdooAnnouncement(payload)); }

  async loadAll() {
    log.info('Loading all domains from Odoo…');
    const [employees, stations, prodRoutes, buffers, prodTemplates, techpack, runOrders, announcements] =
      await Promise.all([
        this.getEmployees(), this.getStations(), this.getRoutes(), this.getBuffers(),
        this.getTemplates(), this.getProducts(), this.getManufacturingOrders(), this.getAnnouncements()
      ]);
    return { employees, stations, prodRoutes, buffers, prodTemplates, techpack, runOrders, announcements };
  }
}
