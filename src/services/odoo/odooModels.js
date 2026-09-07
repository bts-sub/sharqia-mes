/**
 * ============================================================================
 *  ODOO MODEL & FIELD MAP  —  ✅ CONFIRMED against module `sharqia_mes`
 * ============================================================================
 * The manufacturing data lives in the custom Odoo module `sharqia_mes`
 * (repo tech-shark-net/bait-abaya). The technical names below are the REAL
 * names from that module — verified on the live Odoo 19 database.
 *
 * Design: reuse standard Odoo where it fits (hr.employee, mrp.workcenter,
 * mrp.production, mrp.workorder, product.product) with `mes_*` custom fields,
 * and custom `sharqia.mes.*` models for what standard Odoo does not provide
 * (routes, points, buffers, templates, hangers, defects, qc, announcements).
 *
 * The mappers (mappers.js) read ONLY these constants — never inline strings —
 * so if a name ever changes, this file + mappers.js are the only edits.
 */

export const MODELS = {
  // app concept            // real Odoo model
  EMPLOYEE:        'hr.employee',
  STATION:         'mrp.workcenter',
  ROUTE:           'sharqia.mes.route',
  ROUTE_POINT:     'sharqia.mes.route.point',
  BUFFER:          'sharqia.mes.buffer',
  TEMPLATE:        'sharqia.mes.template',
  PRODUCT:         'product.product',
  MO:              'mrp.production',
  WORKORDER:       'mrp.workorder',
  HANGER:          'sharqia.mes.hanger',
  DEFECT:          'sharqia.mes.defect',
  QC_CHECK:        'sharqia.mes.qc.check',
  ANNOUNCEMENT:    'sharqia.mes.announcement',
  ROLE_GROUP:      'res.groups'
};

/**
 * Field lists per model. Kept in sync with the `sharqia_mes` module.
 */
export const FIELDS = {
  EMPLOYEE:    ['id', 'name', 'active', 'mes_station', 'mes_skill', 'mes_shift', 'mes_efficiency', 'mes_attendance'],
  STATION:     ['id', 'name', 'mes_type', 'mes_department', 'mes_capacity', 'mes_std_time'],
  ROUTE:       ['id', 'name', 'code', 'product_id', 'production_id', 'capacity', 'active', 'point_ids', 'sequence'],
  ROUTE_POINT: ['id', 'name', 'route_id', 'station', 'sequence', 'target', 'qty', 'status', 'employee_ids', 'std_time', 'qc_required'],
  BUFFER:      ['id', 'name', 'capacity', 'used', 'after_route_id', 'next_route_id', 'max_wait'],
  TEMPLATE:    ['id', 'name', 'is_default', 'route_ids', 'wh_mode'],
  PRODUCT:     ['id', 'name', 'default_code', 'barcode', 'product_template_attribute_value_ids'],
  MO:          ['id', 'name', 'product_id', 'product_qty', 'qty_produced', 'state', 'date_start', 'date_finished', 'mes_priority', 'mes_route_ids'],
  WORKORDER:   ['id', 'name', 'production_id', 'workcenter_id', 'state', 'qty_produced', 'qty_producing', 'duration', 'mes_route_id', 'mes_status'],
  HANGER:      ['id', 'name', 'production_id', 'route_id', 'station_id', 'next_station_id', 'qty', 'status', 'entered_at'],
  DEFECT:      ['id', 'name', 'piece_no', 'production_id', 'station', 'type', 'severity', 'status', 'image', 'created_at'],
  QC_CHECK:    ['id', 'name', 'production_id', 'model', 'station', 'qty', 'status', 'defect', 'reject_qty'],
  ANNOUNCEMENT:['id', 'title', 'body', 'type', 'level', 'audience', 'start', 'expires', 'route_id', 'station', 'production_id']
};

/**
 * Work-order lifecycle methods. Standard mrp.workorder exposes
 * button_start / button_pause / button_finish (used by Odoo's tablet view).
 * Produced quantity is written directly to qty_produced (see mappers).
 */
export const WO_METHODS = {
  START:  'button_start',
  PAUSE:  'button_pause',
  FINISH: 'button_finish',
  RECORD_QTY: 'record_production'
};
