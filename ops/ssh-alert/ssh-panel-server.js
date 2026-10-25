'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { DatabaseSync } = require('node:sqlite');

const root = __dirname;
const dataDir = process.env.OPS_PANEL_DATA || '/var/lib/saapt-ssh-panel';
const helperSocket = process.env.OPS_HELPER_SOCKET || '/run/saapt-ssh-alert/ops-helper.sock';
const expectedHost = String(process.env.OPS_HOST || 'ops.saapttech.com').toLowerCase();
const port = Number(process.env.OPS_PANEL_PORT || 4173);
const cookieName = '__Host-ops_session';
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
fs.chmodSync(dataDir, 0o700);
const db = new DatabaseSync(path.join(dataDir, 'panel.sqlite'));
db.exec(`
  PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS operators (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    totp_nonce TEXT NOT NULL,
    totp_tag TEXT NOT NULL,
    totp_ciphertext TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
    created_at INTEGER NOT NULL,
    last_login_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS web_sessions (
    token_hash TEXT PRIMARY KEY,
    operator_id TEXT NOT NULL REFERENCES operators(id),
    csrf_token TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    source_ip TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS login_limits (
    source_ip TEXT PRIMARY KEY,
    window_started_at INTEGER NOT NULL,
    failures INTEGER NOT NULL,
    locked_until INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS recovery_codes (
    operator_id TEXT NOT NULL REFERENCES operators(id),
    code_hash TEXT NOT NULL,
    used_at INTEGER,
    PRIMARY KEY(operator_id, code_hash)
  );
`);
fs.chmodSync(path.join(dataDir, 'panel.sqlite'), 0o600);

const keyPath = path.join(dataDir, 'mfa.key');
let mfaKey;
if (fs.existsSync(keyPath)) {
  mfaKey = fs.readFileSync(keyPath);
  if (mfaKey.length !== 32) throw new Error('Invalid MFA encryption key length');
} else {
  mfaKey = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, mfaKey, { mode: 0o600, flag: 'wx' });
}

const headers = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function reply(res, status, type, body, extra = {}) {
  res.writeHead(status, { ...headers, 'Content-Type': type, ...extra });
  res.end(body);
}

function json(res, status, body, extra = {}) {
  reply(res, status, 'application/json; charset=utf-8', JSON.stringify(body), extra);
}

function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requestIp(req) {
  const remote = req.socket.remoteAddress || '';
  if (remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1') {
    const forwarded = String(req.headers['x-real-ip'] || '').trim();
    if (net.isIP(forwarded)) return forwarded;
  }
  return net.isIP(remote) ? remote : 'unknown';
}

function hostOk(req) {
  return String(req.headers.host || '').split(':')[0].toLowerCase() === expectedHost;
}

function originOk(req) {
  return req.headers.origin === `https://${expectedHost}`;
}

function cookie(req) {
  const entry = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return entry?.slice(cookieName.length + 1) || '';
}

function auth(req, update = true) {
  const raw = cookie(req);
  if (!raw) return null;
  const session = db.prepare(`SELECT s.*, o.username, o.enabled FROM web_sessions s
    JOIN operators o ON o.id=s.operator_id WHERE s.token_hash=?`).get(hash(raw));
  const now = Date.now();
  if (!session || !session.enabled || session.expires_at <= now || now - session.last_seen_at > 30 * 60 * 1000) {
    if (session) db.prepare('DELETE FROM web_sessions WHERE token_hash=?').run(session.token_hash);
    return null;
  }
  if (update) db.prepare('UPDATE web_sessions SET last_seen_at=? WHERE token_hash=?').run(now, session.token_hash);
  return session;
}

function readJson(req, max = 8192) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > max) reject(new Error('too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of input.replace(/=+$/g, '').toUpperCase()) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error('invalid base32');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret, at = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const digest = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(number).padStart(6, '0');
}

function decryptTotp(row) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', mfaKey, Buffer.from(row.totp_nonce, 'base64'));
  decipher.setAuthTag(Buffer.from(row.totp_tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(row.totp_ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

function verifyTotp(secret, code) {
  if (!/^\d{6}$/.test(String(code))) return false;
  for (const drift of [-30000, 0, 30000]) if (safeEqual(totp(secret, Date.now() + drift), code)) return true;
  return false;
}

function limited(ip) {
  const now = Date.now();
  const row = db.prepare('SELECT * FROM login_limits WHERE source_ip=?').get(ip);
  if (row?.locked_until > now) return true;
  if (!row || now - row.window_started_at > 15 * 60 * 1000) {
    db.prepare(`INSERT INTO login_limits (source_ip, window_started_at, failures, locked_until) VALUES (?, ?, 0, 0)
      ON CONFLICT(source_ip) DO UPDATE SET window_started_at=excluded.window_started_at, failures=0, locked_until=0`).run(ip, now);
  }
  return false;
}

function failedLogin(ip) {
  const now = Date.now();
  db.prepare(`UPDATE login_limits SET failures=failures+1,
    locked_until=CASE WHEN failures+1>=8 THEN ? ELSE locked_until END WHERE source_ip=?`)
    .run(now + 15 * 60 * 1000, ip);
}

function helper(method, route, data) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: helperSocket, path: route, method, headers: { 'content-type': 'application/json' } }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let payload;
        try { payload = JSON.parse(raw); } catch { return reject(new Error('SSH helper returned invalid data.')); }
        if (res.statusCode >= 400) return reject(Object.assign(new Error(payload.message || 'SSH helper request failed.'), { status: res.statusCode }));
        resolve(payload);
      });
    });
    req.setTimeout(5000, () => req.destroy(new Error('SSH helper timed out.')));
    req.on('error', reject);
    if (data) req.end(JSON.stringify(data)); else req.end();
  });
}

function setCookie(raw, maxAge) {
  return `${cookieName}=${raw}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function clearCookie() { return `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`; }

async function recordAuthEvent(action, username, ip, result) {
  try { await helper('POST', '/auth-event', { action, actor: username || 'unknown', target: username || '-', sourceIp: ip, result }); }
  catch (error) { console.error(`Could not write ${action} to SSH audit log:`, error.message); }
}

function staticFile(res, file, type) {
  try { reply(res, 200, type, fs.readFileSync(path.join(root, 'public', file))); }
  catch { reply(res, 404, 'text/plain; charset=utf-8', 'Not found'); }
}

const server = http.createServer(async (req, res) => {
  if (!hostOk(req)) return reply(res, 404, 'text/plain; charset=utf-8', 'Not found');
  const url = new URL(req.url, `https://${expectedHost}`);
  if (req.method === 'GET' && ['/', '/sessions', '/access', '/blocks', '/audit'].includes(url.pathname)) return staticFile(res, 'index.html', 'text/html; charset=utf-8');
  if (req.method === 'GET' && url.pathname === '/app.js') return staticFile(res, 'app.js', 'application/javascript; charset=utf-8');
  if (req.method === 'GET' && url.pathname === '/app.css') return staticFile(res, 'app.css', 'text/css; charset=utf-8');
  if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { status: 'ok' });

  if (req.method === 'POST' && url.pathname === '/api/login') {
    if (!originOk(req)) return json(res, 403, { message: 'Request origin was rejected.' });
    let data;
    try { data = await readJson(req); } catch { return json(res, 400, { message: 'Enter valid login details.' }); }
    const ip = requestIp(req);
    if (limited(ip)) return json(res, 429, { message: 'Too many sign-in attempts. Try again in 15 minutes.' });
    const username = String(data.username || '').trim().slice(0, 120);
    const row = db.prepare('SELECT * FROM operators WHERE username=? COLLATE NOCASE AND enabled=1').get(username);
    const passwordInput = typeof data.password === 'string' && data.password.length <= 1024 ? data.password : '';
    const candidate = crypto.scryptSync(passwordInput, row ? Buffer.from(row.password_salt, 'base64') : Buffer.alloc(16), 64);
    let valid = false;
    if (row) {
      const expected = Buffer.from(row.password_hash, 'base64');
      let totpSecret = '';
      try { totpSecret = decryptTotp(row); } catch {}
      const passwordOk = candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
      let factorOk = verifyTotp(totpSecret, data.code);
      const recoveryHash = hash(String(data.code || '').replaceAll('-', '').toUpperCase());
      if (!factorOk && row && String(data.code || '').length >= 12) {
        const recovery = db.prepare('SELECT code_hash FROM recovery_codes WHERE operator_id=? AND code_hash=? AND used_at IS NULL')
          .get(row.id, recoveryHash);
        if (recovery) {
          const used = db.prepare('UPDATE recovery_codes SET used_at=? WHERE operator_id=? AND code_hash=? AND used_at IS NULL')
            .run(Date.now(), row.id, recoveryHash);
          factorOk = used.changes === 1;
        }
      }
      valid = passwordOk && factorOk;
    }
    if (!valid) {
      failedLogin(ip);
      await recordAuthEvent('panel-login-failed', username || 'unknown', ip, 'denied');
      return json(res, 401, { message: 'Username, password, or authenticator code is incorrect.' });
    }
    db.prepare('DELETE FROM login_limits WHERE source_ip=?').run(ip);
    const token = crypto.randomBytes(32).toString('base64url');
    const csrf = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    db.prepare(`INSERT INTO web_sessions (token_hash, operator_id, csrf_token, created_at, last_seen_at, expires_at, source_ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(hash(token), row.id, csrf, now, now, now + 8 * 60 * 60 * 1000, ip);
    db.prepare('UPDATE operators SET last_login_at=? WHERE id=?').run(now, row.id);
    await recordAuthEvent('panel-login', row.username, ip, 'success');
    return json(res, 200, { username: row.username, csrf }, { 'Set-Cookie': setCookie(token, 8 * 60 * 60) });
  }

  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const session = auth(req, false);
    if (!session || !originOk(req) || !safeEqual(req.headers['x-csrf-token'] || '', session.csrf_token)) return json(res, 401, { message: 'Sign in again to continue.' }, { 'Set-Cookie': clearCookie() });
    await recordAuthEvent('panel-logout', session.username, requestIp(req), 'success');
    db.prepare('DELETE FROM web_sessions WHERE token_hash=?').run(session.token_hash);
    return json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
  }

  const session = auth(req);
  if (!session) return json(res, 401, { message: 'Sign in to the server operations panel.' });
  if (req.method === 'GET' && url.pathname === '/api/me') return json(res, 200, { username: session.username, csrf: session.csrf_token });
  if (req.method !== 'GET' && (!originOk(req) || !safeEqual(req.headers['x-csrf-token'] || '', session.csrf_token))) {
    return json(res, 403, { message: 'The request could not be verified. Refresh and try again.' });
  }

  try {
    if (req.method === 'GET' && url.pathname === '/api/sessions') return json(res, 200, await helper('GET', '/sessions'));
    if (req.method === 'GET' && url.pathname === '/api/access-requests') return json(res, 200, await helper('GET', '/access-requests'));
    if (req.method === 'GET' && url.pathname === '/api/blocks') return json(res, 200, await helper('GET', '/blocks'));
    if (req.method === 'GET' && url.pathname === '/api/audit') return json(res, 200, await helper('GET', '/audit'));
    if (req.method === 'POST' && url.pathname === '/api/alerts/resolve') {
      const data = await readJson(req);
      if (typeof data.token !== 'string') return json(res, 400, { message: 'Invalid review link.' });
      return json(res, 200, await helper('POST', '/resolve-alert', { token: data.token }));
    }
    if (req.method === 'POST' && url.pathname === '/api/access/resolve') {
      const data = await readJson(req);
      if (typeof data.token !== 'string') return json(res, 400, { message: 'Invalid access request link.' });
      return json(res, 200, await helper('POST', '/resolve-access', { token: data.token }));
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/access/') && url.pathname.endsWith('/approve')) {
      const id = decodeURIComponent(url.pathname.slice('/api/access/'.length, -'/approve'.length));
      return json(res, 200, await helper('POST', '/approve-access', { id, actor: session.username, sourceIp: requestIp(req) }));
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/sessions/') && url.pathname.endsWith('/revoke')) {
      const id = decodeURIComponent(url.pathname.slice('/api/sessions/'.length, -'/revoke'.length));
      return json(res, 200, await helper('POST', '/revoke', { id, actor: session.username, sourceIp: requestIp(req) }));
    }
    if (req.method === 'POST' && url.pathname === '/api/blocks') {
      const data = await readJson(req);
      return json(res, 200, await helper('POST', '/block', { ip: data.ip, actor: session.username, sourceIp: requestIp(req) }));
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/blocks/') && /\/(unblock|enable)$/.test(url.pathname)) {
      const action = url.pathname.endsWith('/enable') ? 'enable' : 'unblock';
      const ip = decodeURIComponent(url.pathname.slice('/api/blocks/'.length, -(action.length + 1)));
      return json(res, 200, await helper('POST', `/${action}`, { ip, actor: session.username, sourceIp: requestIp(req) }));
    }
    return json(res, 404, { message: 'Not found.' });
  } catch (error) {
    return json(res, error.status || 503, { message: error.message || 'Server operations are temporarily unavailable.' });
  }
});

server.listen(port, '127.0.0.1', () => console.log(`SSH operations panel listening on 127.0.0.1:${port} for ${expectedHost}`));
