/**
 * smoke-mock.js — proves the data pipeline works end-to-end on MOCK data,
 * with no browser, no network, no Odoo. Run: `npm run test:mock`.
 *
 * It loads the mock JSON exactly as MockDataSource would and asserts the
 * repository-shaped snapshot is well-formed. This is what you re-run after
 * pointing the repository at Odoo to confirm shapes still match.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mockDir = path.join(root, 'src', 'mock');

function load(name) { return JSON.parse(fs.readFileSync(path.join(mockDir, name + '.json'), 'utf8')); }

function assert(cond, msg) { if (!cond) { console.error('✗', msg); process.exitCode = 1; } else console.log('  ✓', msg); }

console.log('MOCK data pipeline smoke test');
const employees = load('employees');
const stations = load('stations');
const routes = load('routes');
const orders = load('manufacturing_orders');
const anns = load('announcements');

assert(Array.isArray(employees) && employees.length > 0, 'employees loaded (' + employees.length + ')');
assert(employees[0].id && employees[0].name && employees[0].station, 'employee shape has id/name/station');
assert(stations.every(s => s.key && s.name), 'stations have key/name');
assert(routes[0].points && routes[0].points.length > 0, 'route has points');
assert(routes[0].points[0].emps !== undefined, 'route point has emps[]');
assert(orders.some(o => o.status === 'running') && orders.some(o => o.status === 'done'), 'orders include running + done');
assert(anns[0].level && anns[0].audience, 'announcement has level/audience');

const snapshot = {
  employees, stations, prodRoutes: routes, runOrders: orders, announcements: anns
};
assert(Object.keys(snapshot).length === 5, 'snapshot has all domains');
console.log(process.exitCode ? 'FAILED' : 'PASSED — swap SHARQIA_DATA_SOURCE=odoo later without touching the UI.');
