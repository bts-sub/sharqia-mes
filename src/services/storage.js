/**
 * Secure-ish key/value storage for session tokens & small state.
 * Uses Capacitor Preferences on device (Keychain/Keystore-backed on iOS/Android
 * when configured); falls back to localStorage in the browser during dev.
 *
 * NOTE: never store raw passwords. Store only session tokens / API keys, and
 * prefer OS-level secure storage in production (see ODOO_INTEGRATION.md).
 */
let _prefs = null;
async function prefs() {
  if (_prefs !== null) return _prefs;
  try {
    const mod = await import('@capacitor/preferences').catch(() => null);
    _prefs = (mod && mod.Preferences) ? mod.Preferences : false;
  } catch (e) { _prefs = false; }
  return _prefs;
}

export const storage = {
  async get(key) {
    const p = await prefs();
    if (p) { const r = await p.get({ key: key }); return r && r.value ? r.value : null; }
    try { return (typeof localStorage !== 'undefined') ? localStorage.getItem(key) : null; } catch (e) { return null; }
  },
  async set(key, value) {
    const p = await prefs();
    if (p) { await p.set({ key: key, value: String(value) }); return; }
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, String(value)); } catch (e) {}
  },
  async remove(key) {
    const p = await prefs();
    if (p) { await p.remove({ key: key }); return; }
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch (e) {}
  },
  async getJSON(key) { const v = await this.get(key); try { return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  async setJSON(key, obj) { await this.set(key, JSON.stringify(obj)); }
};
