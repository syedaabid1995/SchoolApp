'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');
const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');

const appPath = path.resolve(__dirname, '../ssh-panel-server.js');
const helperPath = path.resolve(__dirname, '../ssh-ops-helper.js');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saapt-ssh-panel-'));
const dbPath = path.join(testDir, 'panel.sqlite');
const mfaKey = crypto.randomBytes(32);
fs.writeFileSync(path.join(testDir, 'mfa.key'), mfaKey, { mode: 0o600 });
const password = 'correct horse battery staple 2026';
const passwordSalt = crypto.randomBytes(16);
const mfaSecret = 'JBSWY3DPEHPK3PXP';
const nonce = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', mfaKey, nonce);
const ciphertext = Buffer.concat([cipher.update(mfaSecret, 'utf8'), cipher.final()]);
const db = new DatabaseSync(dbPath);
db.exec(`CREATE TABLE operators (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL, totp_nonce TEXT NOT NULL, totp_tag TEXT NOT NULL, totp_ciphertext TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, last_login_at INTEGER
);`);
db.prepare(`INSERT INTO operators (id, username, password_hash, password_salt, totp_nonce, totp_tag, totp_ciphertext, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
  .run('test-operator', 'test.operator', crypto.scryptSync(password, passwordSalt, 64).toString('base64'),
    passwordSalt.toString('base64'), nonce.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64'), Date.now());
db.close();
fs.chmodSync(dbPath, 0o600);

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of input) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function currentTotp(secret) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}

async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

function request(port, route, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body || '';
    const req = http.request({
      hostname: '127.0.0.1', port, path: route, method: options.method || 'GET',
      headers: { Host: 'ops.saapttech.com', Origin: 'https://ops.saapttech.com', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, json: () => JSON.parse(raw) }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('requires password and TOTP, issues secure session, enforces CSRF, and logs out', async (t) => {
  const port = await freePort();
  const socketPath = path.join(testDir, 'ops-helper.sock');
  const helperChild = spawn(process.execPath, [helperPath], {
    env: { ...process.env, SSH_ALERT_DATA_DIR: testDir, OPS_HELPER_SOCKET: socketPath },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let attempt = 0; attempt < 50 && !fs.existsSync(socketPath); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(fs.existsSync(socketPath), true);
  const child = spawn(process.execPath, [appPath], {
    env: { ...process.env, OPS_PANEL_DATA: testDir, OPS_PANEL_PORT: String(port), OPS_HOST: 'ops.saapttech.com', OPS_HELPER_SOCKET: socketPath, SSH_ALERT_DATA_DIR: testDir },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  t.after(async () => {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    helperChild.kill('SIGTERM');
    await new Promise((resolve) => helperChild.once('exit', resolve));
    fs.rmSync(testDir, { recursive: true, force: true });
  });
  let ready = false;
  let healthStatus = 0;
  for (let attempt = 0; attempt < 50 && !ready; attempt += 1) {
    try { const response = await request(port, '/healthz'); healthStatus = response.status; ready = response.status === 200; } catch {}
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(ready, true, `health endpoint status ${healthStatus}`);

  const badLogin = await request(port, '/api/login', {
    method: 'POST', body: JSON.stringify({ username: 'test.operator', password, code: '000000' }),
  });
  assert.equal(badLogin.status, 401);

  const login = await request(port, '/api/login', {
    method: 'POST', body: JSON.stringify({ username: 'test.operator', password, code: currentTotp(mfaSecret) }),
  });
  assert.equal(login.status, 200, JSON.stringify(login.json()));
  const loginData = login.json();
  const setCookie = login.headers['set-cookie'][0];
  assert.match(setCookie, /HttpOnly; Secure; SameSite=Strict/);
  const cookie = setCookie.split(';')[0];

  const me = await request(port, '/api/me', { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.equal(me.json().username, 'test.operator');
  const audit = await request(port, '/api/audit', { headers: { Cookie: cookie } });
  assert.equal(audit.status, 200);
  assert.equal(audit.json().chainValid, true);
  assert.deepEqual(audit.json().events.map((event) => event.action), ['panel-login', 'panel-login-failed']);

  const noCsrf = await request(port, '/api/logout', { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(noCsrf.status, 401);
  const logout = await request(port, '/api/logout', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginData.csrf } });
  assert.equal(logout.status, 200);
  const afterLogout = await request(port, '/api/me', { headers: { Cookie: cookie } });
  assert.equal(afterLogout.status, 401);
});
