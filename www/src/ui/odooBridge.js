/**
 * Odoo bridge — connects the unchanged app screens to Odoo (ODOO mode only).
 *
 * The app (www/app/sharqia_mes.html) keeps all state in the global `Store`
 * and acts through the globals `Auth` and `Actions`. Its design stays
 * untouched; this bridge wraps a few of those entry points:
 *
 *   Auth.login / Auth.logout   → app users managed in Odoo (sharqia.mes.user)
 *   session on reload          → re-enters the signed-in account
 *   demo scenario              → wiped on start (wipeDemo), libraries kept
 *   Store domains              → replaced with Odoo records (see RECORDS)
 *   Actions.dfSubmit           → creates sharqia.mes.defect
 *   Actions.annSave            → creates / writes sharqia.mes.announcement
 *   Actions.annDelete          → ends the announcement in Odoo (expires = yesterday)
 *
 * Every other action still changes only the device's Store; `Sharqia.link`
 * reports what is linked, and what Odoo holds per domain.
 */
import { repository } from '../services/data/repository.js';
import { authService } from '../services/auth/authService.js';
import { log } from '../core/logger.js';

// Stations: from Odoo once work centers exist there; until then the app keeps
// its station list (wiped of demo figures), because its screens are laid out
// around the station keys.
const MASTER = ['stations'];
// Everything else: Odoo is the only truth, even when it has none yet.
const RECORDS = ['employees', 'prodRoutes', 'runOrders', 'announcements', 'defects', 'qcItems'];

// ─── Demo data ───
// The app ships a full demo scenario (accounts, staff, orders A102, hanger
// line, materials, QC queue…). With live data none of it may show. Reference
// libraries stay: seam types, operation names, station types, line templates,
// sizes, embroidery types — they are the vocabulary real records are built from.
const DEMO_LISTS = ['employees', 'runOrders', 'tasks', 'prodRoutes', 'qcItems', 'defects', 'notifications',
  'announcements', 'issueReqs', 'recvReqs', 'materials', 'hangers', 'pieces', 'alerts', 'issues', 'bnLog',
  'stLog', 'deptInstr', 'embDrafts', 'orderDrafts', 'whDrafts', 'accounts', 'demoAccounts',
  'defectStockMoves', 'reinspectTasks'];
// Transactional leftovers a device saved while it ran the demo.
const DEMO_STORAGE = ['sharqia_drafts', 'sharqia_emb_drafts', 'sharqia_model_routes', 'sharqia_recent_models',
  'sharqia_seam_img', 'sharqia_anns'];
const WIPED_FLAG = 'sharqia_demo_wiped_v1';

function wipeDemo() {
  DEMO_LISTS.forEach(function (k) { if (Array.isArray(Store[k])) Store[k] = []; });
  Store.userPw = {}; Store.userPwHash = {};
  Store.techpack = {};
  Store.hs = { configured: false, warehouses: [], routes: [], _log: [] };
  Store._hsSeq = { r: 0, p: 0, w: 0 };
  Store._tasksSeeded = true;
  if (Store.timer) Store.timer = { running: false, paused: false, startMs: 0, accumMs: 0, piece: null, std: Store.timer.std || 0 };
  // Station list stays (keys, codes, lines); every demo figure on it goes.
  (Store.stations || []).forEach(function (s) {
    Object.assign(s, { status: 'st_active', staffCur: 0, staffNeed: 0, wip: 0, waiting: 0, doneP: 0, target: 0,
      mo: null, product: null, machineOk: true, help: false, qcIssue: false, downtime: 0, reason: null, late: 0 });
  });
  try {
    if (!localStorage.getItem(WIPED_FLAG)) {
      DEMO_STORAGE.forEach(function (k) { localStorage.removeItem(k); });
      localStorage.setItem(WIPED_FLAG, new Date().toISOString());
    }
  } catch (e) { /* storage may be unavailable */ }
  try { if (typeof rebuildPerm === 'function') rebuildPerm(); } catch (e) {}
  Store.defectSeq = 1;
  // A station worker with no task assigned used to get a made-up one (A102 /
  // MO-0044); now they have none until production assigns it.
  W._demoWork = function () { return null; };
  dropUnknownStaff();
  // Station work instructions were demo text ("use the specified black thread"…).
  Store.workInstr = {};
  // The admin «Odoo» screen showed a made-up server and database.
  Store.server = 'https://test.sharqiaa-tech.net'; Store.db = '';
  // Daily charts are fixed demo figures (hours, quality, order statuses) with
  // no live source yet.
  if (typeof Screens !== 'undefined' && Screens.dailyCharts) {
    Screens.dailyCharts = function () {
      try { topbar(T('daily_prod'), true); } catch (e) {}
      $('view').innerHTML = noDataBox();
    };
    if (W.Router && Router.routes && Router.routes.dailyCharts) Router.routes.dailyCharts = Screens.dailyCharts;
  }
  guardScreens();
}

function noDataBox() {
  var msg = LL('لا توجد بيانات بعد — تظهر هنا حين يبدأ الإنتاج الفعلي', 'No data yet — this fills in once real production starts', 'ابھی کوئی ڈیٹا نہیں', 'Pas encore de données');
  return typeof emptyBox === 'function' ? emptyBox(msg, '📭', false) : '<div class="empty">' + msg + '</div>';
}

// Screens written around the demo scenario assume an order, a task or a
// configured line exists and throw on an empty factory. Such a screen shows
// "no data yet" instead of an error page; the error still goes to the console.
// The router dispatches through its own map (Router.routes) and the tabs call
// Screens directly, so both are guarded.
function guardScreens() {
  function guard(name, fn) {
    if (typeof fn !== 'function' || fn.__guarded || name === 'login' || name === 'langPick') return fn;
    var g = function () {
      try { return fn.apply(this, arguments); } catch (e) {
        if (!(e instanceof TypeError)) throw e;
        log.warn('screen ' + name + ' has no data to show:', e.message);
        $('view').innerHTML = noDataBox();
      }
    };
    g.__guarded = true;
    return g;
  }
  if (typeof Screens !== 'undefined') Object.keys(Screens).forEach(function (n) { Screens[n] = guard(n, Screens[n]); });
  if (W.Router && Router.routes) Object.keys(Router.routes).forEach(function (n) { Router.routes[n] = guard(n, Router.routes[n]); });
}

const W = window;
const link = { mode: 'odoo', signedIn: false, loadedAt: null, domains: {}, synced: [], error: null };
// Shift hours from Odoo settings (الإعدادات ← تنفيذ التصنيع), sent with the account.
let settings = { shiftStart: '07:00', shiftEnd: '15:00' };
function useSettings(account) { if (account && account.settings) settings = Object.assign(settings, account.settings); }

function say(ar, en, kind) {
  try {
    var msg = typeof LL === 'function' ? LL(ar, en, en, en) : ar;
    if (typeof toast === 'function') toast(msg, kind || 'info');
  } catch (e) { /* toast is cosmetic */ }
}

function render() {
  // Re-rendering while someone types would wipe the field they are in.
  var el = document.activeElement;
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
  try { if (W.Router && Router.render) Router.render(); } catch (e) { log.error('render after sync failed', e); }
}

function stationLabel(key) {
  try {
    var n = Store.stationName && Store.stationName[key];
    return n ? (typeof tr === 'function' ? tr(n) : n.ar) : (key || '');
  } catch (e) { return key || ''; }
}

function today() { return new Date().toISOString().slice(0, 10); }

function hydrate(snap) {
  MASTER.concat(RECORDS).forEach(function (k) {
    var list = snap[k] || [];
    var fromOdoo = RECORDS.indexOf(k) >= 0 || list.length > 0;
    link.domains[k] = { odoo: list.length, source: fromOdoo ? 'odoo' : 'app' };
    if (!fromOdoo) return;
    if (k === 'defects') list.forEach(function (d) { d.stationName = stationLabel(d.stationKey); });
    if (k === 'employees') list.forEach(function (e) { e.planIn = settings.shiftStart; e.planOut = settings.shiftEnd; });
    if (k === 'announcements') {
      // An announcement «deleted» in the app is ended in Odoo, not removed.
      list = list.filter(function (a) { return !a.expires || a.expires >= today(); });
      var maxId = list.reduce(function (m, a) { return Math.max(m, a.id); }, 0);
      Store._annSeq = Math.max(Store._annSeq || 0, maxId + 1);
    }
    Store[k] = list;
  });
  dropUnknownStaff();
  try { if (typeof rebuildPerm === 'function') rebuildPerm(); } catch (e) {}
}

// Factory-map templates are the manager's layout and stay, but the demo map
// came with demo workers assigned to its stations. Only assignments to people
// who exist (Odoo employees) are kept.
function dropUnknownStaff() {
  var known = {};
  (Store.employees || []).forEach(function (e) { known[e.id] = true; });
  (Store.prodTemplates || []).forEach(function (t) {
    (t.routes || []).forEach(function (rt) {
      (rt.groups || []).concat(rt.points || []).forEach(function (g) {
        if (Array.isArray(g.emps)) g.emps = g.emps.filter(function (x) { return known[x && typeof x === 'object' ? x.id : x]; });
      });
    });
  });
}

async function refresh() {
  var res = await repository.loadAll();
  if (!res.ok) {
    link.error = res.error.message;
    say('تعذّر تحميل بيانات أودو: ' + res.error.message, 'Could not load Odoo data', 'err');
    return false;
  }
  hydrate(res.data);
  link.error = null;
  link.loadedAt = new Date().toISOString();
  log.info('Odoo snapshot applied', link.domains);
  return true;
}

function enterAs(account) {
  var a = Object.assign({ color: '#1F6E5A', odooLang: null }, account);
  // Screens look accounts up by username (names, colours, permissions).
  var list = Store.accounts || (Store.accounts = []);
  var i = list.findIndex(function (x) { return x.u === a.u; });
  if (i >= 0) list[i] = a; else list.push(a);
  link.signedIn = true;
  Auth.enter(a);
}

function wrapAuth() {
  var busy = false;
  Auth.login = function (u, p) {
    u = (u || '').trim();
    if (!u || !p) return say('أدخل اسم المستخدم وكلمة المرور', 'Enter username and password', 'err');
    if (busy) return;
    busy = true;
    say('جارٍ تسجيل الدخول…', 'Signing in…');
    authService.login(u, p)
      .then(async function (s) { useSettings(s.account); await refresh(); enterAs(s.account); })
      .catch(function (e) {
        // The server's reason (wrong password, no app role…) in every language.
        var why = (e && e.message) || 'تعذّر تسجيل الدخول';
        say(why, why, 'err');
      })
      .finally(function () { busy = false; });
  };
  var appLogout = Auth.logout.bind(Auth);
  Auth.logout = function () {
    link.signedIn = false;
    authService.logout().catch(function () {});
    return appLogout();
  };
}

function track(kind, ref, promise) {
  var entry = { kind: kind, ref: ref, at: new Date().toISOString(), ok: null };
  link.synced.unshift(entry);
  link.synced.length = Math.min(link.synced.length, 50);
  return promise.then(function (r) { entry.ok = true; return r; }, function (e) {
    entry.ok = false; entry.error = e && e.message;
    var why = 'لم يُحفظ في أودو: ' + ((e && e.message) || '');
    say(why, why, 'err');
    throw e;
  });
}

function wrapActions() {
  if (typeof Actions === 'undefined') return;

  if (Actions.dfSubmit) {
    var dfSubmit = Actions.dfSubmit;
    Actions.dfSubmit = function () {
      var before = Store.defects && Store.defects[0];
      var out = dfSubmit.apply(this, arguments);
      var t = Store.defects && Store.defects[0];
      if (t && t !== before && !t.odooId) {
        t.odoo = { synced: false, ref: null, at: '' };
        track('defect', t.id, repository.createDefect(t)).then(function (id) {
          t.odooId = id; t.odoo = { synced: true, ref: id, at: new Date().toTimeString().slice(0, 5) };
        }).catch(function () {});
      }
      return out;
    };
  }

  if (Actions.annSave) {
    var annSave = Actions.annSave;
    Actions.annSave = function () {
      var f = (typeof App !== 'undefined' && App._annF) || {};
      var list = Store.announcements || [];
      var prev = f.id ? list.find(function (x) { return x.id === f.id; }) : null;
      var odooId = prev && prev.odooId;
      var first = list[0];
      var out = annSave.apply(this, arguments);
      list = Store.announcements || [];
      var rec = f.id ? list.find(function (x) { return x.id === f.id; }) : (list[0] !== first ? list[0] : null);
      if (!rec) return out;                        // validation stopped the save
      if (odooId) {
        rec.odooId = odooId;
        track('announcement', odooId, repository.updateAnnouncement(odooId, rec)).catch(function () {});
      } else {
        track('announcement', rec.id, repository.createAnnouncement(rec)).then(function (id) { rec.odooId = id; }).catch(function () {});
      }
      return out;
    };
  }

  if (Actions.annDelete) {
    var annDelete = Actions.annDelete;
    Actions.annDelete = function (id) {
      var rec = (Store.announcements || []).find(function (x) { return x.id === id; });
      var out = annDelete.apply(this, arguments);
      if (rec && rec.odooId) {
        var y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        track('announcement-end', rec.odooId,
          repository.updateAnnouncement(rec.odooId, Object.assign({}, rec, { expires: y }))).catch(function () {});
      }
      return out;
    };
  }
}

// The phone's back button used to leave the app: the app navigates with its
// own stack (App.stack) and never touched browser history. One spare history
// entry is kept; each back press lands here and becomes an in-app back
// (inner screen → previous screen, other tab → home). From the home screen a
// second press within two seconds exits.
function installBackButton() {
  var lastBack = 0;
  function arm() { try { history.pushState({ sq: 'guard' }, ''); } catch (e) {} }
  function tip(msg) {
    try {
      if (typeof toast === 'function') return toast(msg, 'info');
    } catch (e) {}
  }
  try {
    if (!(history.state && history.state.sq)) { history.replaceState({ sq: 'root' }, ''); arm(); }
  } catch (e) { return; }
  window.addEventListener('popstate', function () {
    try {
      if (typeof closeModal === 'function' && document.querySelector('#modal .overlay')) { closeModal(); arm(); return; }
      if (W.App && App.me && App.stack && App.stack.length) { Router.back(); arm(); return; }
      if (W.App && App.me && App.tab) { App.tab = 0; Router.render(); arm(); return; }
    } catch (e) { log.warn('back navigation failed', e); }
    var now = Date.now();
    if (now - lastBack < 2000) { try { history.back(); } catch (e) {} return; }
    lastBack = now;
    arm();
    tip(LL('اضغط رجوع مرة أخرى للخروج', 'Press back again to exit', 'باہر نکلنے کے لیے دوبارہ دبائیں', 'Appuyez encore pour quitter'));
  });
}

export async function installOdooBridge() {
  W.Sharqia.link = link;
  W.Sharqia.refresh = function () { return refresh().then(function (ok) { if (ok) render(); return ok; }); };
  if (typeof Auth === 'undefined' || typeof Store === 'undefined') {
    link.error = 'app globals (Auth/Store) not found';
    log.error(link.error);
    return;
  }
  // Live accounts only: the login screen's demo picker (with its passwords)
  // and the demo "any password" rule belong to test mode.
  Store.demoMode = false;
  wipeDemo();
  wrapAuth();
  wrapActions();
  render();

  // A still-valid session: load Odoo data and enter without asking again.
  try {
    var s = await authService.restore();
    if (s && s.account) {
      useSettings(s.account);
      if (await refresh()) { if (!(W.App && App.me)) enterAs(s.account); else render(); }
    }
  } catch (e) {
    link.error = (e && e.message) || String(e);
    log.error('restore failed', e);
  }

  installBackButton();

  // Back to the app after a while → fresh data from Odoo.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || !link.signedIn) return;
    if (link.loadedAt && Date.now() - Date.parse(link.loadedAt) < 60000) return;
    refresh().then(function (ok) { if (ok) render(); });
  });
}
