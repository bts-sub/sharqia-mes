/** Tiny leveled logger. Dev-friendly, no-ops in production when LOG_LEVEL=silent. */
import { CONFIG } from '../config/env.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };
const threshold = LEVELS[CONFIG.LOG_LEVEL] || LEVELS.info;

function emit(level, args) {
  if (LEVELS[level] < threshold) return;
  var fn = (level === 'error') ? console.error : (level === 'warn') ? console.warn : console.log;
  try { fn.apply(console, ['[sharqia:' + level + ']'].concat(args)); } catch (e) {}
}

export const log = {
  debug: function () { emit('debug', Array.prototype.slice.call(arguments)); },
  info: function () { emit('info', Array.prototype.slice.call(arguments)); },
  warn: function () { emit('warn', Array.prototype.slice.call(arguments)); },
  error: function () { emit('error', Array.prototype.slice.call(arguments)); }
};
