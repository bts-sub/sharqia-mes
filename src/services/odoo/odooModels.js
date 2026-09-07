/**
 * ============================================================================
 *  ODOO MODEL & FIELD MAP  —  ⚠️ CONFIRM BEFORE ENABLING ODOO ⚠️
 * ============================================================================
 * You confirmed the manufacturing data lives in a CUSTOM Odoo module, so the
 * technical model/field names below are a PROPOSAL, not verified names.
 *
 * DO NOT trust these until you replace each value with the real technical name
 * from YOUR Odoo module (Settings ▸ Technical ▸ Models / Fields, or the module
 * source). Every entry is marked with the app-side concept it maps to.
 *
 * Standard Odoo models (hr.employee, product.product, mrp.production, …) are
 * suggested where they naturally fit; if your custom module replaces them,
 * change the model string here — the rest of the app does not need edits.
 *
 * See ODOO_INTEGRATION.md for the full mapping table and the required
 * custom models/fields checklist.
 */

export const MODELS = {
  // app concept            // Odoo model (CONFIRM)          // standard candidate
  EMPLOYEE:        'hr.employee',            // Store.employees        (standard hr.employee)
  STATION:         'x_sharqia_station',      // Store.stations         (or mrp.workcenter)
  ROUTE:           'x_sharqia_route',        // Store.prodRoutes        (custom routing)
  ROUTE_POINT:     'x_sharqia_route_point',  // route.points[]          (custom)
  BUFFER:          'x_sharqia_buffer',       // Store.hs.warehouses     (custom intermediate buffer)
  TEMPLATE:        'x_sharqia_template',     // Store.prodTemplates     (custom map template)
  PRODUCT:         'product.product',        // Store.techpack          (standard, w/ variants)
  MO:              'mrp.production',         // Store.runOrders         (standard MO — CONFIRM if custom)
  WORKORDER:       'mrp.workorder',          // per-route work order    (standard — CONFIRM if custom)
  HANGER:          'x_sharqia_hanger',       // Store.hangers           (NOT standard — must be custom)
  DEFECT:          'x_sharqia_defect',       // Store.defects           (or quality.check on Enterprise)
  QC_CHECK:        'x_sharqia_qc_check',     // Store.qcItems           (or quality.check)
  ANNOUNCEMENT:    'x_sharqia_announcement', // Store.announcements     (custom, or mail.message)
  ROLE_GROUP:      'res.groups'              // permissions             (standard groups)
};

/**
 * Field lists per model. Keep these in sync with your module.
 * The mappers (mappers.js) read ONLY these constants — never inline strings.
 */
export const FIELDS = {
  EMPLOYEE:    ['id', 'name', 'active', /*CONFIRM*/ 'x_station', 'x_skill', 'x_shift', 'x_efficiency'],
  STATION:     ['id', 'name', /*CONFIRM*/ 'x_type', 'x_department', 'x_capacity', 'x_std_time'],
  ROUTE:       ['id', 'name', /*CONFIRM*/ 'x_code', 'x_product_id', 'x_mo_id', 'x_capacity', 'x_active', 'x_point_ids'],
  ROUTE_POINT: ['id', 'name', /*CONFIRM*/ 'x_route_id', 'x_station', 'x_sequence', 'x_target', 'x_qty', 'x_status', 'x_employee_ids', 'x_std_time', 'x_qc_required'],
  BUFFER:      ['id', 'name', /*CONFIRM*/ 'x_capacity', 'x_used', 'x_after_route_id', 'x_next_route_id', 'x_max_wait'],
  TEMPLATE:    ['id', 'name', /*CONFIRM*/ 'x_is_default', 'x_route_ids', 'x_wh_mode'],
  PRODUCT:     ['id', 'name', 'default_code', 'barcode', /*CONFIRM*/ 'product_template_attribute_value_ids'],
  MO:          ['id', 'name', 'product_id', 'product_qty', 'qty_produced', 'state', 'date_start', 'date_finished', /*CONFIRM*/ 'priority', 'x_route_ids'],
  WORKORDER:   ['id', 'name', 'production_id', 'workcenter_id', 'state', 'qty_produced', 'qty_producing', 'duration', /*CONFIRM*/ 'x_route_id'],
  HANGER:      ['id', 'name', /*CONFIRM*/ 'x_mo_id', 'x_route_id', 'x_station_id', 'x_qty', 'x_status', 'x_entered_at'],
  DEFECT:      ['id', /*CONFIRM*/ 'x_piece_no', 'x_mo_id', 'x_station', 'x_type', 'x_severity', 'x_status', 'x_image', 'x_created_at'],
  QC_CHECK:    ['id', /*CONFIRM*/ 'x_mo_id', 'x_model', 'x_station', 'x_qty', 'x_status', 'x_defect', 'x_reject_qty'],
  ANNOUNCEMENT:['id', /*CONFIRM*/ 'x_title', 'x_body', 'x_type', 'x_level', 'x_audience', 'x_start', 'x_expires', 'x_route_id', 'x_station', 'x_mo_id']
};

/**
 * Work-order lifecycle method names on your model (start/pause/finish).
 * Standard mrp.workorder exposes button_start / button_pause / button_finish.
 * CONFIRM these exist (or provide your custom method names).
 */
export const WO_METHODS = {
  START:  'button_start',   // CONFIRM
  PAUSE:  'button_pause',   // CONFIRM
  FINISH: 'button_finish',  // CONFIRM
  RECORD_QTY: 'record_production' // CONFIRM (record produced quantity)
};
