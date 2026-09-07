/** Typed application errors so the UI can react appropriately. */

export class AppError extends Error {
  constructor(message, code, cause) {
    super(message);
    this.name = 'AppError';
    this.code = code || 'app_error';
    this.cause = cause || null;
  }
}

/** Network is unreachable / timed out (show "لا يوجد اتصال" state). */
export class NetworkError extends AppError {
  constructor(message, cause) { super(message || 'Network error', 'network_error', cause); this.name = 'NetworkError'; }
}

/** Authentication / session problem (force re-login). */
export class AuthError extends AppError {
  constructor(message, cause) { super(message || 'Authentication error', 'auth_error', cause); this.name = 'AuthError'; }
}

/** Odoo returned a business/validation error. */
export class OdooError extends AppError {
  constructor(message, data) { super(message || 'Odoo error', 'odoo_error', data); this.name = 'OdooError'; this.data = data || null; }
}

/** Local validation failure before a call is made. */
export class ValidationError extends AppError {
  constructor(message, fields) { super(message || 'Validation error', 'validation_error'); this.name = 'ValidationError'; this.fields = fields || {}; }
}

/** Normalize any thrown value into an AppError. */
export function toAppError(err) {
  if (err instanceof AppError) return err;
  var msg = (err && err.message) ? err.message : String(err);
  return new AppError(msg, 'unknown_error', err);
}
