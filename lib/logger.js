/**
 * Lightweight structured logger for production debugging.
 * Set DEBUG=minearchive:* (or DEBUG=*) to enable verbose logs.
 * Never logs secrets (cookies, tokens, DATABASE_URL, SESSION_SECRET).
 */

const REDACT_KEYS = new Set([
  'password',
  'passwordHash',
  'authorization',
  'cookie',
  'token',
  'session',
  'secret',
  'DATABASE_URL',
  'SESSION_SECRET',
  'GOOGLE_CLIENT_SECRET',
]);

function shouldLogVerbose() {
  const debug = process.env.DEBUG || '';
  return (
    process.env.MINEARCHIVE_DEBUG === 'true' ||
    debug === '*' ||
    debug.split(',').some((ns) => ns.trim() === 'minearchive' || ns.trim() === 'minearchive:*')
  );
}

function redact(value, depth = 0) {
  if (depth > 4 || value == null) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (REDACT_KEYS.has(key) || /secret|password|token|cookie/i.test(key)) {
      out[key] = '[redacted]';
    } else {
      out[key] = redact(val, depth + 1);
    }
  }
  return out;
}

function write(level, message, meta) {
  const entry = {
    level,
    msg: message,
    time: new Date().toISOString(),
    ...(meta ? { meta: redact(meta) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info(message, meta) {
    write('info', message, meta);
  },
  warn(message, meta) {
    write('warn', message, meta);
  },
  error(message, meta) {
    write('error', message, meta);
  },
  debug(message, meta) {
    if (shouldLogVerbose()) write('debug', message, meta);
  },
};
