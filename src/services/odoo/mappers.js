/**
 * Mappers: Odoo records  <->  app "Store" shapes.
 *
 * This is the ONLY place that knows both worlds. When your custom module's
 * field names are confirmed (in odooModels.js), you adjust the reads here and
 * NOTHING in the UI changes — that is the whole point of this layer.
 *
 * Odoo returns many2one fields as [id, "Display Name"]; helper m2o() handles that.
 * All reads are defensive (fall back gracefully) so a missing custom field does
 * not crash the app — it degrades to a sane default and logs a warning upstream.
 */

function m2oId(v) { return Array.isArray(v) ? v[0] : (v || null); }
function m2oName(v) { return Array.isArray(v) ? v[1] : (v || ''); }
function pick(rec, key, dflt) { return (rec && rec[key] != null) ? rec[key] : dflt; }
function bilingual(s) { return { ar: s || '', en: s || '' }; } // Odoo strings are single-valued; UI expects {ar,en}

/* ---------------- Odoo -> Store ---------------- */

export function mapEmployee(rec) {
  return {
    id: 'E-' + rec.id,
    name: bilingual(pick(rec, 'name', '')),
    station: pick(rec, 'x_station', ''),      // CONFIRM
    att: pick(rec, 'x_attendance', 'present'), // CONFIRM (present/late/absent)
    active: pick(rec, 'active', true),
    exp: pick(rec, 'x_skill', 'mid'),          // CONFIRM
    eff: pick(rec, 'x_efficiency', 85)         // CONFIRM
  };
}

export function mapStation(rec) {
  return {
    key: pick(rec, 'x_type', 'sew'),           // CONFIRM
    name: bilingual(pick(rec, 'name', '')),
    dept: pick(rec, 'x_department', 'sew'),     // CONFIRM
    capacity: pick(rec, 'x_capacity', 0)
  };
}

export function mapRoutePoint(rec) {
  return {
    id: 'WP-' + rec.id,
    name: bilingual(pick(rec, 'name', '')),
    station: pick(rec, 'x_station', 'sew'),     // CONFIRM
    emps: (pick(rec, 'x_employee_ids', []) || []).map(function (id) { return 'E-' + m2oId(id); }),
    qty: pick(rec, 'x_qty', 0),
    target: pick(rec, 'x_target', 0),
    std: pick(rec, 'x_std_time', ''),
    qcReq: !!pick(rec, 'x_qc_required', false),
    status: pick(rec, 'x_status', 'not_started')
  };
}

export function mapRoute(rec, pointsById) {
  var pointIds = (pick(rec, 'x_point_ids', []) || []).map(m2oId);
  var points = pointIds.map(function (id) { return pointsById['WP-' + id]; }).filter(Boolean);
  return {
    id: 'PR-' + rec.id,
    name: bilingual(pick(rec, 'name', '')),
    product: m2oName(pick(rec, 'x_product_id', '')),
    mo: m2oName(pick(rec, 'x_mo_id', '')),
    capacity: pick(rec, 'x_capacity', 0),
    active: !!pick(rec, 'x_active', true),
    points: points
  };
}

export function mapBuffer(rec) {
  return {
    id: 'HW-' + rec.id,
    name: bilingual(pick(rec, 'name', '')),
    cap: pick(rec, 'x_capacity', 500),
    used: pick(rec, 'x_used', 0),
    maxWait: pick(rec, 'x_max_wait', 90)
  };
}

export function mapProduct(rec) {
  return {
    model: pick(rec, 'default_code', '') || pick(rec, 'name', ''),
    code: pick(rec, 'default_code', ''),
    barcode: pick(rec, 'barcode', ''),
    // Variants (color/size) come from product template attribute values — CONFIRM mapping.
    colors: [], sizes: []
  };
}

export function mapMO(rec) {
  return {
    id: pick(rec, 'name', 'RUN-' + rec.id),
    mo: pick(rec, 'name', 'MO-' + rec.id),
    product: m2oName(pick(rec, 'product_id', '')),
    qty: pick(rec, 'product_qty', 0),
    done: pick(rec, 'qty_produced', 0),
    status: mapMoState(pick(rec, 'state', 'draft')),
    priority: pick(rec, 'priority', 'normal'),
    start: pick(rec, 'date_start', ''),
    due: pick(rec, 'date_finished', ''),
    assignments: []
  };
}

/** Odoo mrp.production.state -> app status vocabulary. CONFIRM if custom states. */
export function mapMoState(state) {
  switch (state) {
    case 'draft':
    case 'confirmed': return 'not_started';
    case 'progress':
    case 'to_close': return 'running';
    case 'done': return 'done';
    case 'cancel': return 'stopped';
    default: return 'running';
  }
}

export function mapAnnouncement(rec) {
  return {
    id: rec.id,
    title: bilingual(pick(rec, 'x_title', '')),
    body: bilingual(pick(rec, 'x_body', '')),
    type: pick(rec, 'x_type', 'general'),
    level: pick(rec, 'x_level', 'normal'),
    audience: pick(rec, 'x_audience', 'all'),
    start: pick(rec, 'x_start', ''),
    expires: pick(rec, 'x_expires', ''),
    station: pick(rec, 'x_station', ''),
    routeId: m2oId(pick(rec, 'x_route_id', null)),
    order: m2oName(pick(rec, 'x_mo_id', ''))
  };
}

/* ---------------- Store -> Odoo (create/update) ---------------- */

/** Build the write payload for a work-order status/qty update. CONFIRM field names. */
export function toOdooWorkorderProgress(update) {
  var out = {};
  if (update.qtyProduced != null) out.qty_produced = update.qtyProduced; // CONFIRM
  if (update.status != null) out.x_status = update.status;               // CONFIRM
  return out;
}

/** Build the create payload for a new defect record. CONFIRM field names. */
export function toOdooDefect(defect) {
  return {
    x_mo_id: defect.moId || false,      // CONFIRM
    x_station: defect.station || '',    // CONFIRM
    x_type: defect.type || '',          // CONFIRM
    x_severity: defect.severity || 'med', // CONFIRM
    x_status: defect.status || 'hold',  // CONFIRM
    x_image: defect.image || false      // CONFIRM (base64 or attachment)
  };
}

/** Build the create payload for a new announcement. CONFIRM field names. */
export function toOdooAnnouncement(a) {
  return {
    x_title: (a.title && a.title.ar) || a.title || '',
    x_body: (a.body && a.body.ar) || a.body || '',
    x_type: a.type || 'general',
    x_level: a.level || 'normal',
    x_audience: a.audience || 'all',
    x_start: a.start || false,
    x_expires: a.expires || false
  };
}
