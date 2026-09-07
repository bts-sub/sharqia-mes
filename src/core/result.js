/**
 * Result + UI-state helpers.
 *
 * The UI layer can render four canonical states from any async data call:
 *  - loading  : request in flight
 *  - error    : failed (network / auth / server / validation)
 *  - empty    : succeeded but no rows
 *  - ready    : succeeded with data
 *
 * These helpers keep that logic in one place so screens stay declarative.
 */
import { toAppError } from './errors.js';

export function ok(data) { return { ok: true, data: data, error: null }; }
export function fail(error) { return { ok: false, data: null, error: toAppError(error) }; }

/** Wrap an async function so it never throws; returns a Result. */
export async function attempt(fn) {
  try { return ok(await fn()); }
  catch (e) { return fail(e); }
}

/** Derive a UI state string from a Result + optional isLoading flag. */
export function uiState(result, isLoading) {
  if (isLoading) return 'loading';
  if (!result) return 'loading';
  if (!result.ok) return 'error';
  var d = result.data;
  var isEmpty = d == null || (Array.isArray(d) && d.length === 0) ||
    (typeof d === 'object' && !Array.isArray(d) && Object.keys(d).length === 0);
  return isEmpty ? 'empty' : 'ready';
}
