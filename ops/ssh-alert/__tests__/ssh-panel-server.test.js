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
const mailFile = path.join(testDir, 'sent-mail.jsonl');
const fakeMailerPath = path.join(testDir, 'fake-nodemailer.js');
fs.writeFileSync(fakeMailerPath, `
const fs = require('node:fs');
module.exports = { createTransport: () => ({
  sendMail: async (message) => fs.appendFileSync(process.env.OPS_TEST_MAIL_FILE, JSON.stringify(message) + '\\n'),
  close() {},
})};
`);
const password = 'correct horse battery staple 2026';
const passwordSalt = crypto.randomBytes(16);
const db = new DatabaseSync(dbPath);
db.exec(`CREATE TABLE operators (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL, totp_nonce TEXT NOT NULL, totp_tag TEXT NOT NULL, totp_ciphertext TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, last_login_at INTEGER
);`);
db.prepare(`INSERT INTO operators (id, username, password_hash, password_salt, totp_nonce, totp_tag, totp_ciphertext, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
  .run('test-operator', 'test.operator@example.com', crypto.scryptSync(password, passwordSalt, 64).toString('base64'),
    passwordSalt.toString('base64'), '', '', '', Date.now());
db.close();
fs.chmodSync(dbPath, 0o600);

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
      headers: { Host: 'localhost:4174', Origin: 'http://localhost:4174', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
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

test('supports password login, password changes, and single-use email OTP recovery', async (t) => {
  const port = await freePort();
  const socketPath = path.join(testDir, 'ops-helper.sock');
  const helperChild = spawn(process.execPath, [helperPath], {
    env: { ...process.env, SSH_ALERT_DATA_DIR: testDir, OPS_HELPER_SOCKET: socketPath },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let attempt = 0; attempt < 50 && !fs.existsSync(socketPath); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(fs.existsSync(socketPath), true);
  const child = spawn(process.execPath, [appPath], {
    env: {
      ...process.env, OPS_PANEL_DATA: testDir, OPS_PANEL_PORT: String(port), OPS_HOSTS: 'localhost,localhost-alt',
      OPS_ORIGINS: 'http://localhost:4174,http://localhost-alt:4174', OPS_HELPER_SOCKET: socketPath, SSH_ALERT_DATA_DIR: testDir,
      OPS_NODEMAILER_PATH: fakeMailerPath, OPS_TEST_MAIL_FILE: mailFile, OPS_SMTP_HOST: 'smtp.test',
      OPS_SMTP_FROM_EMAIL: 'ops@example.com', OPS_SMTP_USERNAME: 'ops@example.com', OPS_SMTP_PASSWORD: 'test-secret',
    },
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

  const aliasHealth = await request(port, '/healthz', {
    headers: { Host: 'localhost-alt:4174', Origin: 'http://localhost-alt:4174' },
  });
  assert.equal(aliasHealth.status, 200);

  const badLogin = await request(port, '/api/login', {
    method: 'POST', body: JSON.stringify({ username: 'test.operator@example.com', password: 'incorrect password' }),
  });
  assert.equal(badLogin.status, 401);

  const rejectedOrigin = await request(port, '/api/login', {
    method: 'POST', body: JSON.stringify({ username: 'test.operator@example.com', password }),
    headers: { Origin: 'http://localhost:4173' },
  });
  assert.equal(rejectedOrigin.status, 403);

  const login = await request(port, '/api/login', {
    method: 'POST', body: JSON.stringify({ username: 'test.operator@example.com', password }),
  });
  assert.equal(login.status, 200, JSON.stringify(login.json()));
  const loginData = login.json();
  const setCookie = login.headers['set-cookie'][0];
  assert.match(setCookie, /HttpOnly; Secure; SameSite=Strict/);
  const cookie = setCookie.split(';')[0];

  const me = await request(port, '/api/me', { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.equal(me.json().username, 'test.operator@example.com');
  const audit = await request(port, '/api/audit', { headers: { Cookie: cookie } });
  assert.equal(audit.status, 200);
  assert.equal(audit.json().chainValid, true);
  assert.deepEqual(audit.json().events.map((event) => event.action), ['panel-login', 'panel-login-failed']);
  assert.equal(audit.json().pageSize, 25);
  const emptyAuditPage = await request(port, '/api/audit?page=2', { headers: { Cookie: cookie } });
  assert.equal(emptyAuditPage.status, 200);
  assert.deepEqual(emptyAuditPage.json().events, []);
  const countsWithoutSession = await request(port, '/api/counts');
  assert.equal(countsWithoutSession.status, 401);
  const counts = await request(port, '/api/counts', { headers: { Cookie: cookie } });
  assert.equal(counts.status, 200);
  assert.deepEqual(counts.json(), { sessions: 0, requests: 0, blocks: 0, allowedIps: 0 });
  const activityWithoutSession = await request(port, '/api/server-activity');
  assert.equal(activityWithoutSession.status, 401);
  const serverActivity = await request(port, '/api/server-activity?category=all&range=today', { headers: { Cookie: cookie } });
  assert.equal(serverActivity.status, 200, JSON.stringify(serverActivity.json()));
  assert.ok(Array.isArray(serverActivity.json().events));
  assert.equal(serverActivity.json().pageSize, 25);
  assert.equal(serverActivity.json().page, 1);
  const invalidActivityFilter = await request(port, '/api/server-activity?category=arbitrary&range=today', { headers: { Cookie: cookie } });
  assert.equal(invalidActivityFilter.status, 400);
  const invalidAuditPage = await request(port, '/api/audit?page=0', { headers: { Cookie: cookie } });
  assert.equal(invalidAuditPage.status, 400);

  const passwordChange = await request(port, '/api/account/password', {
    method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginData.csrf },
    body: JSON.stringify({ currentPassword: password, newPassword: 'new password phrase 2026 with length' }),
  });
  assert.equal(passwordChange.status, 200, JSON.stringify(passwordChange.json()));
  const meAfterChange = await request(port, '/api/me', { headers: { Cookie: cookie } });
  assert.equal(meAfterChange.status, 200);

  const resetRequest = await request(port, '/api/password-reset/request', {
    method: 'POST', body: JSON.stringify({ email: 'test.operator@example.com' }),
  });
  assert.equal(resetRequest.status, 200);
  assert.match(resetRequest.json().message, /If that email is registered/);
  const email = JSON.parse(fs.readFileSync(mailFile, 'utf8').trim().split('\n').at(-1));
  const code = email.text.match(/code is (\d{6})/)[1];
  const finalPassword = 'final replacement password phrase 2026';
  const resetComplete = await request(port, '/api/password-reset/complete', {
    method: 'POST', body: JSON.stringify({ email: 'test.operator@example.com', code, password: finalPassword }),
  });
  assert.equal(resetComplete.status, 200, JSON.stringify(resetComplete.json()));
  const revokedSession = await request(port, '/api/me', { headers: { Cookie: cookie } });
  assert.equal(revokedSession.status, 401);

  const reusedCode = await request(port, '/api/password-reset/complete', {
    method: 'POST', body: JSON.stringify({ email: 'test.operator@example.com', code, password: 'another new password phrase 2026' }),
  });
  assert.equal(reusedCode.status, 400);

  const newLogin = await request(port, '/api/login', {
    method: 'POST', body: JSON.stringify({ username: 'test.operator@example.com', password: finalPassword }),
  });
  assert.equal(newLogin.status, 200, JSON.stringify(newLogin.json()));

  const newCookie = newLogin.headers['set-cookie'][0].split(';')[0];
  const newLoginData = newLogin.json();
  const noCsrf = await request(port, '/api/logout', { method: 'POST', headers: { Cookie: newCookie } });
  assert.equal(noCsrf.status, 401);
  const logout = await request(port, '/api/logout', { method: 'POST', headers: { Cookie: newCookie, 'X-CSRF-Token': newLoginData.csrf } });
  assert.equal(logout.status, 200);
  const afterLogout = await request(port, '/api/me', { headers: { Cookie: newCookie } });
  assert.equal(afterLogout.status, 401);
});

test('auth forms and account controls respect hidden state despite layout styles', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
  const css = fs.readFileSync(path.resolve(__dirname, '../public/app.css'), 'utf8');
  assert.match(html, /id="account" class="account" hidden/);
  assert.match(html, /id="reset-request-form" class="login-form" hidden/);
  assert.match(html, /id="reset-complete-form" class="login-form" hidden/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
});
