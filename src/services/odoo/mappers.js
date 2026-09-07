/**
 * Mappers: Odoo records  <->  app "Store" shapes.
 *
 * This is the ONLY place that knows both worlds. Field names below are the
 * REAL technical names from the `sharqia_mes` Odoo module — the UI never sees
 * them, so if a name changes, this file + odooModels.js are the only edits.
 *
 * Odoo returns many2one fields as [id, "Display Name"]; helper m2o() handles that.
 * All reads are defensive (fall back gracefully) so a missing field does not
 * crash the app — it degrades to a sane default.
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
    station: pick(rec, 'mes_station', ''),
    att: pick(rec, 'mes_attendance', 'present'),   // present/late/absent
    active: pick(rec, 'active', true),
    exp: pick(rec, 'mes_skill', 'mid'),            // junior/mid/senior
    eff: pick(rec, 'mes_efficiency', 85)
  };
}

export function mapStation(rec) {
  return {
    key: pick(rec, 'mes_type', 'sew'),             // cut/sew/emb/iron/qc/pack
    name: bilingual(pick(rec, 'name', '')),
    dept: pick(rec, 'mes_department', 'sew'),
    capacity: pick(rec, 'mes_capacity', 0)
  };
}

export function mapRoutePoint(rec) {
  return {
    id: 'WP-' + rec.id,
    name: bilingual(pick(rec, 'name', '')),
    station: pick(rec, 'station', 'sew'),
    emps: (pick(rec, 'employee_ids', []) || []).map(function (id) { return 'E-' + m2oId(id); }),
    qty: pick(rec, 'qty', 0),
    target: pick(rec, 'target', 0),
    std: pick(rec, 'std_time', ''),
    qcReq: !!pick(rec, 'qc_required', false),
    status: pick(rec, 'status', 'not_started')
  };
}

export function mapRoute(rec, pointsById) {
  var pointIds = (pick(rec, 'point_ids', []) || []).map(m2oId);
  var points = pointIds.map(function (id) { return pointsById['WP-' + id]; }).filter(Boolean);
  return {
    id: 'PR-' + rec.id,
    name: bilingual(pick(rec, 'name', '')),
    product: m2oName(pick(rec, 'product_id', '')),
    mo: m2oName(pick(rec, 'production_id', '')),
    capacity: pick(rec, 'capacity', 0),
    active: !!pick(rec, 'active', true),
    points: points
  };
}

export function mapBuffer(rec) {
  return {
    id: 'HW-' + rec.id,
    name: bilingual(pick(rec, 'name', '')),
    cap: pick(rec, 'capacity', 500),
    used: pick(rec, 'used', 0),
    maxWait: pick(rec, 'max_wait', 90)
  };
}

export function mapProduct(rec) {
  return {
    model: pick(rec, 'default_code', '') || pick(rec, 'name', ''),
    code: pick(rec, 'default_code', ''),
    barcode: pick(rec, 'barcode', ''),
    // Variants (color/size) come from product template attribute values.
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
    priority: pick(rec, 'mes_priority', 'normal'),
    start: pick(rec, 'date_start', ''),
    due: pick(rec, 'date_finished', ''),
    assignments: []
  };
}

/** Odoo mrp.production.state -> app status vocabulary. */
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
    title: bilingual(pick(rec, 'title', '')),
    body: bilingual(pick(rec, 'body', '')),
    type: pick(rec, 'type', 'general'),
    level: pick(rec, 'level', 'normal'),
    audience: pick(rec, 'audience', 'all'),
    start: pick(rec, 'start', ''),
    expires: pick(rec, 'expires', ''),
    station: pick(rec, 'station', ''),
    routeId: m2oId(pick(rec, 'route_id', null)),
    order: m2oName(pick(rec, 'production_id', ''))
  };
}

/* ---------------- Store -> Odoo (create/update) ---------------- */

/** Build the write payload for a work-order status/qty update. */
export function toOdooWorkorderProgress(update) {
  var out = {};
  if (update.qtyProduced != null) out.qty_produced = update.qtyProduced;
  if (update.status != null) out.mes_status = update.status;
  return out;
}

/** Build the create payload for a new defect record. */
export function toOdooDefect(defect) {
  return {
    production_id: defect.moId || false,
    station: defect.station || '',
    type: defect.type || '',
    severity: defect.severity || 'med',
    status: defect.status || 'hold',
    image: defect.image || false        // base64
  };
}

/** Build the create payload for a new announcement. */
export function toOdooAnnouncement(a) {
  return {
    title: (a.title && a.title.ar) || a.title || '',
    body: (a.body && a.body.ar) || a.body || '',
    type: a.type || 'general',
    level: a.level || 'normal',
    audience: a.audience || 'all',
    start: a.start || false,
    expires: a.expires || false
  };
}
