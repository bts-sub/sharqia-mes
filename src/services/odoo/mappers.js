/**
 * Mappers: Odoo records  <->  app "Store" shapes.
 *
 * This is the ONLY place that knows both worlds. Field names below are the
 * REAL technical names from the `sharqia_mes` Odoo module — the UI never sees
 * them, so if a name changes, this file + odooModels.js are the only edits.
 *
 * The output shapes are the ones the screens actually read (the seed objects
 * in www/app/sharqia_mes.html), not a simplified model: a missing key there
 * renders as "undefined" or breaks a screen. Values Odoo does not hold (live
 * WIP counters, shift clock-in…) get the neutral value the app itself uses.
 *
 * Every record keeps `odooId`, so a later save knows which record to write.
 * Odoo returns many2one fields as [id, "Display Name"]; m2oId/m2oName handle that.
 */

function m2oId(v) { return Array.isArray(v) ? v[0] : (v || null); }
function m2oName(v) { return Array.isArray(v) ? v[1] : (v || ''); }
function pick(rec, key, dflt) { return (rec && rec[key] != null && rec[key] !== false) ? rec[key] : dflt; }
/** Odoo strings are single-valued; the UI expects one per language. */
function multi(s) { s = s || ''; return { ar: s, en: s, ur: s, fr: s }; }
/** "[A102] Plain abaya" -> "A102" (the model code the UI keys techpacks by). */
function productCode(v) { var n = m2oName(v); var m = /^\[([^\]]+)\]/.exec(n); return m ? m[1] : n; }
function day(v) { return v ? String(v).slice(0, 10) : ''; }

/* ---------------- Odoo -> Store ---------------- */

export function mapEmployee(rec) {
  var att = pick(rec, 'mes_attendance', 'present');
  var eff = pick(rec, 'mes_efficiency', 85);
  var shift = pick(rec, 'mes_shift', '');
  return {
    id: 'E-' + rec.id, odooId: rec.id,
    name: multi(pick(rec, 'name', '')),
    station: pick(rec, 'mes_station', null),
    role: pick(rec, 'mes_role', 'station'),
    att: att,                                        // present/late/absent
    state: att === 'absent' ? 'emp_absent' : att === 'late' ? 'emp_late' : 'emp_working',
    in: '—', assigned: 0, done: 0, avg: '—',
    cap: eff, quality: eff,
    exp: 'lvl_' + pick(rec, 'mes_skill', 'mid'),     // lvl_junior/lvl_mid/lvl_senior
    active: pick(rec, 'active', true),
    shift: /^shift_/.test(shift) ? shift : 'shift_morning',
    planIn: '07:00', planOut: '15:00'
  };
}

/** @param staffByStation {key: count} of employees assigned to each station key. */
export function mapStation(rec, staffByStation) {
  var key = pick(rec, 'mes_type', 'sew');
  var staff = (staffByStation && staffByStation[key]) || 0;
  var cap = pick(rec, 'mes_capacity', 0);
  return {
    key: key, odooId: rec.id,
    code: pick(rec, 'code', '') || ('ST-' + key.toUpperCase()),
    name: multi(pick(rec, 'name', '')),
    line: 'L1', wc: pick(rec, 'name', ''),
    dept: pick(rec, 'mes_department', key),
    status: staff ? 'st_active' : 'st_no_staff',
    staffCur: staff, staffNeed: staff,
    wip: 0, waiting: 0, doneP: 0, target: cap,
    mo: null, product: null,
    machineOk: true, help: false, qcIssue: false, downtime: 0, reason: null,
    capacity: cap, late: 0
  };
}

export function mapRoutePoint(rec) {
  return {
    id: 'WP-' + rec.id, odooId: rec.id,
    routeOdooId: m2oId(pick(rec, 'route_id', null)),
    sequence: pick(rec, 'sequence', 0),
    name: multi(pick(rec, 'name', '')),
    station: pick(rec, 'station', 'sew'),
    emps: (pick(rec, 'employee_ids', []) || []).map(function (id) { return 'E-' + m2oId(id); }),
    qty: pick(rec, 'qty', 0),
    target: pick(rec, 'target', 0),
    std: pick(rec, 'std_time', ''),
    wait: 0, updated: 0,
    qcReq: !!pick(rec, 'qc_required', false),
    status: pick(rec, 'status', 'not_started')
  };
}

export function mapRoute(rec, pointsById) {
  var pointIds = (pick(rec, 'point_ids', []) || []).map(m2oId);
  var points = pointIds.map(function (id) { return pointsById['WP-' + id]; }).filter(Boolean)
    .sort(function (a, b) { return a.sequence - b.sequence; });
  return {
    id: 'PR-' + rec.id, odooId: rec.id,
    name: multi(pick(rec, 'name', '')),
    product: productCode(pick(rec, 'product_id', '')),
    mo: m2oName(pick(rec, 'production_id', '')),
    capacity: pick(rec, 'capacity', 0),
    qty: 0, done: 0, priority: 'normal',
    active: !!pick(rec, 'active', true),
    autoFlow: true, start: '', end: '',
    points: points
  };
}

export function mapBuffer(rec) {
  return {
    id: 'HW-' + rec.id, odooId: rec.id,
    name: multi(pick(rec, 'name', '')),
    cap: pick(rec, 'capacity', 500),
    used: pick(rec, 'used', 0),
    maxWait: pick(rec, 'max_wait', 90),
    afterRoute: m2oId(pick(rec, 'after_route_id', null)) ? 'PR-' + m2oId(rec.after_route_id) : null,
    nextRoute: m2oId(pick(rec, 'next_route_id', null)) ? 'PR-' + m2oId(rec.next_route_id) : null
  };
}

export function mapProduct(rec) {
  return {
    odooId: rec.id,
    model: pick(rec, 'default_code', '') || pick(rec, 'name', ''),
    code: pick(rec, 'default_code', ''),
    barcode: pick(rec, 'barcode', ''),
    // Variants (color/size) come from product template attribute values.
    colors: [], sizes: []
  };
}

/** @param stagesByMo {moName: [stationKey…]} from the routes linked to each order. */
export function mapMO(rec, stagesByMo) {
  var name = pick(rec, 'name', 'MO-' + rec.id);
  var origin = pick(rec, 'origin', '');
  return {
    id: name, odooId: rec.id, mo: name,
    product: productCode(pick(rec, 'product_id', '')),
    hex: '#2a3550',
    customer: multi(origin || '—'),
    order: origin || name, lot: '-', color: 'black', size: 'M',
    qty: pick(rec, 'product_qty', 0),
    done: pick(rec, 'qty_produced', 0),
    status: mapMoState(pick(rec, 'state', 'draft')),
    priority: pick(rec, 'mes_priority', 'normal'),
    start: day(pick(rec, 'date_start', '')),
    due: day(pick(rec, 'date_deadline', '') || pick(rec, 'date_finished', '')),
    line: 'L1',
    stages: (stagesByMo && stagesByMo[name]) || ['cut', 'sew', 'qc', 'pack'],
    assignments: [], reserve: 0
  };
}

/** Odoo mrp.production.state -> app order status vocabulary. */
export function mapMoState(state) {
  switch (state) {
    case 'draft':
    case 'confirmed': return 'not_started';
    case 'progress':
    case 'to_close': return 'in_progress';
    case 'done': return 'done';
    case 'cancel': return 'stopped';
    default: return 'in_progress';
  }
}

export function mapAnnouncement(rec) {
  var start = pick(rec, 'start', '');
  return {
    id: rec.id, odooId: rec.id,
    type: pick(rec, 'type', 'general'),
    level: pick(rec, 'level', 'normal'),
    audience: pick(rec, 'audience', 'all'),
    requireAck: !!pick(rec, 'require_ack', false),
    blockIfUnread: false,
    pinned: !!pick(rec, 'pinned', false),
    title: multi(pick(rec, 'title', '')),
    body: multi(pick(rec, 'body', '')),
    by: pick(rec, 'created_by', ''),
    date: start, start: start,
    expires: pick(rec, 'expires', ''),
    station: pick(rec, 'station', undefined),
    order: pick(rec, 'order_ref', '') || m2oName(pick(rec, 'production_id', '')) || undefined
  };
}

export function mapDefect(rec) {
  var at = pick(rec, 'created_at', '');           // "YYYY-MM-DD HH:MM:SS" UTC
  var ts = at ? Date.parse(at.replace(' ', 'T') + 'Z') : 0;
  var piece = pick(rec, 'piece_no', String(rec.id));
  return {
    id: 'DF-' + piece, odooId: rec.id,
    pieceNo: /^\d+$/.test(piece) ? Number(piece) : piece,
    orderId: pick(rec, 'order_ref', '') || m2oName(pick(rec, 'production_id', '')),
    model: pick(rec, 'model_ref', ''), modelName: pick(rec, 'model_ref', ''),
    routeId: null, routeName: pick(rec, 'route_ref', ''),
    stationKey: pick(rec, 'station', ''), stationName: '',   // filled from the UI dictionary
    empU: '', empName: pick(rec, 'reported_by', ''),
    reportedAt: ts ? new Date(ts).toTimeString().slice(0, 5) : '',
    reportedTs: ts,
    type: pick(rec, 'type', ''), severity: pick(rec, 'severity', 'med'),
    note: pick(rec, 'note', ''), img: null, imgThumb: null,
    status: pick(rec, 'status', 'hold'),
    decision: null, reworkTo: null, priority: 'normal',
    inBuffer: false, whId: null,
    odoo: { synced: true, ref: rec.id, at: '' },
    timeline: []
  };
}

var QC_STATUS = { pending: 'pending', pass: 'accepted', rework: 'rework', reject: 'rejected' };

export function mapQcCheck(rec) {
  var model = pick(rec, 'model', '');
  return {
    id: 'QC-' + rec.id, odooId: rec.id,
    mo: m2oName(pick(rec, 'production_id', '')),
    model: model, productKey: multi(model),
    station: pick(rec, 'station', 'sew'),
    qty: pick(rec, 'qty', 0),
    status: QC_STATUS[pick(rec, 'status', 'pending')] || 'pending',
    defect: pick(rec, 'defect', null),
    rejQty: pick(rec, 'reject_qty', 0),
    notes: '', meas: null, history: []
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

/** Base64 payload of a data: URL (Odoo binary fields take bare base64). */
function base64Of(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return false;
  var i = dataUrl.indexOf('base64,');
  return i >= 0 ? dataUrl.slice(i + 7) : false;
}

/** Build the create payload for a defect reported in the app (Store.defects item). */
export function toOdooDefect(d) {
  return {
    piece_no: d.pieceNo != null ? String(d.pieceNo) : false,
    station: d.stationKey || d.station || false,
    type: d.type || '',
    severity: d.severity || 'med',
    status: ['hold', 'rework', 'reject', 'approved'].indexOf(d.status) >= 0 ? d.status : 'hold',
    note: d.note || false,
    order_ref: d.orderId || false,
    model_ref: d.model || false,
    route_ref: d.routeName || false,
    image: base64Of(d.img)
  };
}

var ANN_STATIONS = ['cut', 'sew', 'emb', 'fin', 'iron', 'qc', 'pack'];

/** Build the create/write payload for an announcement (Store.announcements item). */
export function toOdooAnnouncement(a) {
  var txt = function (v) { return (v && typeof v === 'object') ? (v.ar || v.en || '') : (v || ''); };
  var date = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : false; };
  return {
    title: txt(a.title),
    body: txt(a.body) || false,
    type: a.type || 'general',
    level: a.level || 'normal',
    audience: a.audience || 'all',
    require_ack: !!a.requireAck,
    pinned: !!a.pinned,
    start: date(a.start),
    expires: date(a.expires),
    station: ANN_STATIONS.indexOf(a.station) >= 0 ? a.station : false,
    order_ref: a.order || false
  };
}
