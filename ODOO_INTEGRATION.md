# Odoo 19 SaaS Integration Plan

> **STATUS (2026-09): CONNECTED.** The custom module `sharqia_mes` is built and
> installed on the live Odoo 19 (repo tech-shark-net/bait-abaya). All model and
> field names in `src/services/odoo/odooModels.js` + `mappers.js` are now the
> **REAL, verified** technical names — every FIELDS list was validated against the
> live database. To go live, set `SHARQIA_DATA_SOURCE=odoo` in `.env`, fill the
> Odoo URL/DB, rebuild (`npm run prepare:web`), and redeploy. Rows below with
> "PROPOSAL" wording are historical; the code is the source of truth.
>
> Design chosen: reuse standard Odoo (hr.employee, mrp.workcenter, mrp.production,
> mrp.workorder, product.product) with `mes_*` fields, plus custom `sharqia.mes.*`
> models for routes/points/buffers/templates/hangers/defects/qc/announcements, and
> 5 security groups (station worker, store, quality, production manager, plant
> manager) mapped to the app roles in `authService.GROUP_TO_ROLE`.

## 0. Golden rules honored by this scaffold
- No Odoo URL, database, or credentials anywhere in the code.
- No demo/Firebase/Supabase/external DB. Development uses **local mock only**.
- Odoo is the single source of truth in production; **no separate app database**.
- Auth uses the user's Odoo account; permissions come from Odoo **Users & Groups**.

## 1. Connection & authentication (Odoo 19 SaaS)
Two supported modes (set `ODOO_AUTH_MODE` in `.env`):

- **`session`** — `POST {ODOO_URL}/web/session/authenticate` with `{db, login, password}`, then reuse the session cookie for `/web/dataset/call_kw`. Simplest; needs CORS or native HTTP (we enable `CapacitorHttp`).
- **`apikey`** — user creates an **API key** in Odoo (Preferences ▸ Account Security). The app calls `/jsonrpc` `execute_kw(db, login, api_key, …)`. Recommended for SaaS + mobile (no cookie/CORS issues).

Endpoints used (standard Odoo web/RPC — safe to rely on):
`/web/session/authenticate`, `/web/session/destroy`, `/web/dataset/call_kw`, `/jsonrpc`.

**To confirm on your side:** whether your SaaS allows external JSON-RPC / API keys, and CORS/allowed-origins for the mobile origin.

## 2. Domain → Odoo model map (CONFIRM every row)

| App concept (`Store.*`) | Proposed Odoo model | Standard candidate | Notes |
|---|---|---|---|
| `employees` | `hr.employee` (+ custom fields) | ✅ standard | add station/skill/shift/efficiency fields |
| `stations` / work centers | `x_sharqia_station` | `mrp.workcenter` | keep custom if you track hanging-line stations |
| `prodRoutes` (routes) | `x_sharqia_route` | — | custom routing per your factory map |
| route `points[]` | `x_sharqia_route_point` | `mrp.routing.workcenter` | ordered stations inside a route |
| `hs.warehouses` (buffers) | `x_sharqia_buffer` | — | intermediate buffers between routes (custom) |
| `prodTemplates` (default map) | `x_sharqia_template` | — | reusable factory-map template |
| `techpack` (models) | `product.product` / `product.template` | ✅ standard | colors/sizes via variant attributes |
| `runOrders` (orders) | `mrp.production` **or** `x_sharqia_order` | mrp.production | confirm if you use MRP or a custom order |
| per-route work orders | `mrp.workorder` **or** custom | mrp.workorder | Start/Pause/Finish live here |
| `hangers` | `x_sharqia_hanger` | ❌ none | **not standard — must be custom** |
| `defects` | `x_sharqia_defect` | `quality.check` (Enterprise) | |
| `qcItems` (QC queue) | `x_sharqia_qc_check` | `quality.check` | |
| `announcements` | `x_sharqia_announcement` | `mail.message` | targeting by role/route/station/order |
| roles/permissions | `res.groups` | ✅ standard | map groups → app roles in `authService.js` |

## 3. Required APIs (what the app calls)
All go through `repository` → `OdooDataSource`:

**Reads** (`search_read`): employees, stations, routes(+points), buffers, templates, products, manufacturing orders, work orders, announcements, defects, qc.
**Writes**:
- `createOrder` → `create` on the order model
- `updateOrder` → `write`
- `updateWorkOrderStatus(start|pause|finish)` → method call (`button_start`/`button_pause`/`button_finish` on standard `mrp.workorder`, **or** your custom methods)
- `recordProduction(qty)` → `write`/wizard/custom method (CONFIRM)
- `updateTaskProgress` → `write`
- `createDefect`, `createAnnouncement` → `create`

## 4. Custom models & fields you likely need to add in Odoo
The following are **not** provided by standard Odoo and (per your custom-module choice) must exist in your module. Names are proposals — align them with `odooModels.js`.

### `x_sharqia_station` (or extend `mrp.workcenter`)
`name`, `x_type` (cut/sew/emb/iron/qc/pack…), `x_department`, `x_capacity`, `x_std_time`.

### `x_sharqia_route`
`name`, `x_code`, `x_product_id (m2o product)`, `x_mo_id (m2o order)`, `x_capacity`, `x_active`, `x_point_ids (o2m route_point)`.

### `x_sharqia_route_point`
`name`, `x_route_id (m2o)`, `x_station`, `x_sequence`, `x_target`, `x_qty`, `x_status` (not_started/running/busy/stopped/wait_qc/done), `x_employee_ids (m2m hr.employee)`, `x_std_time`, `x_qc_required`.

### `x_sharqia_buffer`
`name`, `x_capacity`, `x_used`, `x_after_route_id`, `x_next_route_id`, `x_max_wait`.

### `x_sharqia_template`
`name`, `x_is_default`, `x_route_ids`, `x_wh_mode`, plus default staffing per station (`x_default_employee_ids` on the point).

### `x_sharqia_hanger`  ← **definitely custom**
`name/qr`, `x_mo_id`, `x_route_id`, `x_station_id`, `x_qty`, `x_status`, `x_entered_at`, `x_next_station_id`.

### `x_sharqia_defect` (or use `quality.check`)
`x_piece_no`, `x_mo_id`, `x_station`, `x_type`, `x_severity`, `x_status` (hold/rework/reject/approved), `x_image (binary/attachment)`, `x_created_at`.

### `x_sharqia_announcement`
`x_title`, `x_body`, `x_type`, `x_level`, `x_audience`, `x_start`, `x_expires`, `x_route_id`, `x_station`, `x_mo_id`.

### Fields to ADD on standard models
- `hr.employee`: `x_station`, `x_skill`, `x_shift`, `x_efficiency`, `x_attendance` (or reuse HR attendance).
- `mrp.production` (if used): `priority`, link to `x_sharqia_route_ids`.
- `mrp.workorder` (if used): `x_route_id`, `x_status` mapping, produced-qty method.

### Security groups (for permission mapping)
Create groups and confirm their **external IDs** (used in `authService.GROUP_TO_ROLE`):
`group_production_manager`, `group_plant_manager`, `group_station_worker`, `group_quality`, `group_store` (admin = `base.group_system`).

## 5. What needs changing/added inside Odoo (summary checklist)
- [ ] Create/confirm the custom module + the models above (or map to standard MRP).
- [ ] Add the custom fields on `hr.employee` / `mrp.*` as needed.
- [ ] Create the 5 security groups + record rules per role.
- [ ] Enable external JSON-RPC / allow API keys for the mobile origin; set CORS/allowed origins.
- [ ] Provide the **real technical names** for every ⚠️CONFIRM entry in `odooModels.js` and the Start/Pause/Finish + record-quantity methods.
- [ ] (Optional) a thin server action/controller if you prefer a single custom endpoint over per-model RPC (`ODOO_API_URL`).

## 6. Open items I need you to confirm (do NOT guess)
1. Order model: **standard `mrp.production`** or a **custom order** model? (technical name)
2. Work-order lifecycle: standard `mrp.workorder` buttons, or custom Start/Pause/Finish methods? (names)
3. Exact technical names + external IDs for every custom model/field/group above.
4. Auth mode allowed on your SaaS (`session` vs `apikey`) and CORS/allowed origins.
5. How color/size variants are modeled on the product (attribute external IDs).
6. Are hangers/buffers tracked in Odoo, or should they stay app-side only? (affects sync scope)

Once these are confirmed, the only edits are in `odooModels.js` + `mappers.js`; set `.env` to `odoo`, rebuild, done.
