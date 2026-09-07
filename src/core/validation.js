/** Minimal, dependency-free validators used before create/update calls. */
import { ValidationError } from './errors.js';

export function required(value, field) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
    throw new ValidationError('Field "' + field + '" is required', { [field]: 'required' });
  }
  return value;
}

export function isPositiveInt(value, field) {
  var n = Number(value);
  if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
    throw new ValidationError('Field "' + field + '" must be a non-negative integer', { [field]: 'int' });
  }
  return n;
}

export function oneOf(value, allowed, field) {
  if (allowed.indexOf(value) < 0) {
    throw new ValidationError('Field "' + field + '" must be one of: ' + allowed.join(', '), { [field]: 'enum' });
  }
  return value;
}

/** Validate a record against a small schema map: { field: 'required'|'int'|['a','b'] }. */
export function validate(record, schema) {
  record = record || {};
  Object.keys(schema).forEach(function (field) {
    var rule = schema[field];
    if (rule === 'required') required(record[field], field);
    else if (rule === 'int') isPositiveInt(record[field], field);
    else if (Array.isArray(rule)) oneOf(record[field], rule, field);
  });
  return record;
}
