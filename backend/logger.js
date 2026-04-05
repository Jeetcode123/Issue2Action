/**
 * Issue2Action — Production Logger
 * Structured logging with levels, timestamps, context, and color-coded console output.
 */

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  white: '\x1b[37m',
};

const LEVEL_STYLES = {
  DEBUG: { badge: `${COLORS.gray}DEBUG${COLORS.reset}`, color: COLORS.gray },
  INFO:  { badge: `${COLORS.green}INFO ${COLORS.reset}`, color: COLORS.green },
  WARN:  { badge: `${COLORS.yellow}WARN ${COLORS.reset}`, color: COLORS.yellow },
  ERROR: { badge: `${COLORS.red}ERROR${COLORS.reset}`, color: COLORS.red },
  FATAL: { badge: `${COLORS.bgRed}${COLORS.white}FATAL${COLORS.reset}`, color: COLORS.bgRed },
};

function formatTimestamp() {
  return new Date().toISOString();
}

function formatMessage(level, tag, message, meta) {
  const style = LEVEL_STYLES[level];
  const ts = `${COLORS.dim}${formatTimestamp()}${COLORS.reset}`;
  const tagStr = tag ? `${COLORS.cyan}[${tag}]${COLORS.reset} ` : '';
  const metaStr = meta && Object.keys(meta).length > 0
    ? `\n  ${COLORS.dim}${JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ')}${COLORS.reset}`
    : '';
  return `${ts} ${style.badge} ${tagStr}${message}${metaStr}`;
}

function log(level, tag, message, meta = {}) {
  if (LOG_LEVELS[level] < CURRENT_LEVEL) return;
  const formatted = formatMessage(level, tag, message, meta);
  if (level === 'ERROR' || level === 'FATAL') {
    console.error(formatted);
  } else if (level === 'WARN') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

// Structured log store for recent logs (ring buffer — keep last 200)
const LOG_BUFFER = [];
const MAX_BUFFER = 200;

function pushToBuffer(entry) {
  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_BUFFER) LOG_BUFFER.shift();
}

const logger = {
  debug: (tag, msg, meta) => { log('DEBUG', tag, msg, meta); pushToBuffer({ level: 'DEBUG', tag, msg, meta, ts: new Date().toISOString() }); },
  info:  (tag, msg, meta) => { log('INFO', tag, msg, meta);  pushToBuffer({ level: 'INFO',  tag, msg, meta, ts: new Date().toISOString() }); },
  warn:  (tag, msg, meta) => { log('WARN', tag, msg, meta);  pushToBuffer({ level: 'WARN',  tag, msg, meta, ts: new Date().toISOString() }); },
  error: (tag, msg, meta) => { log('ERROR', tag, msg, meta); pushToBuffer({ level: 'ERROR', tag, msg, meta, ts: new Date().toISOString() }); },
  fatal: (tag, msg, meta) => { log('FATAL', tag, msg, meta); pushToBuffer({ level: 'FATAL', tag, msg, meta, ts: new Date().toISOString() }); },
  getRecentLogs: (count = 50) => LOG_BUFFER.slice(-count),
};

/**
 * Express middleware: logs every request and response with timing.
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  // Log the incoming request
  logger.info('HTTP', `→ ${method} ${originalUrl}`, {
    ip: ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent']?.substring(0, 80),
    body: method !== 'GET' ? summarizeBody(req.body) : undefined,
  });

  // Capture response
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger[level]('HTTP', `← ${method} ${originalUrl} ${statusCode} (${duration}ms)`, {
      success: body?.success,
      error: body?.error || undefined,
    });

    return originalJson(body);
  };

  next();
}

function summarizeBody(body) {
  if (!body || typeof body !== 'object') return undefined;
  const summary = {};
  for (const [key, val] of Object.entries(body)) {
    if (typeof val === 'string' && val.length > 100) {
      summary[key] = val.substring(0, 100) + '…';
    } else if (Array.isArray(val)) {
      summary[key] = `[Array(${val.length})]`;
    } else {
      summary[key] = val;
    }
  }
  return summary;
}

module.exports = { logger, requestLogger };
