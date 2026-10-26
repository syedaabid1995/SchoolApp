'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { spawn } = require('node:child_process');
const test = require('node:test');

const helperPath = path.resolve(__dirname, '../ssh-ops-helper.js');

function call(socketPath, route, method = 'GET', data) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath, path: route, method, headers: data ? { 'Content-Type': 'application/json' } : {} }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on('error', reject);
    req.end(data ? JSON.stringify(data) : undefined);
  });
}

test('privileged helper exposes typed Unix-socket operations and a verifiable audit chain', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'saapt-ssh-helper-'));
  const socketPath = path.join(directory, 'helper.sock');
  const child = spawn(process.execPath, [helperPath], {
    env: { ...process.env, SSH_ALERT_DATA_DIR: directory, OPS_HELPER_SOCKET: socketPath },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  t.after(async () => {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  for (let attempt = 0; attempt < 50 && !fs.existsSync(socketPath); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(fs.existsSync(socketPath), true);
  assert.equal(fs.statSync(socketPath).mode & 0o777, 0o660);

  const sessions = await call(socketPath, '/sessions');
  assert.equal(sessions.status, 200);
  assert.deepEqual(sessions.body.sessions, []);

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const db = new DatabaseSync(path.join(directory, 'actions.sqlite'));
  db.prepare(`INSERT INTO ssh_access_requests (token_hash, username, source_ip, issued_at, expires_at)
    VALUES (?, ?, ?, ?, ?)`)
    .run(tokenHash, 'deploy', '203.0.113.25', Date.now(), Date.now() + 15 * 60 * 1000);
  db.close();
  const resolved = await call(socketPath, '/resolve-access', 'POST', { token: rawToken });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.request.username, 'deploy');
  const approved = await call(socketPath, '/approve-access', 'POST', {
    id: resolved.body.request.id, actor: 'test.operator', sourceIp: '127.0.0.1',
  });
  assert.equal(approved.status, 200);
  assert.match(approved.body.message, /15-minute retry window/);

  const refused = await call(socketPath, '/revoke', 'POST', { id: 'missing', actor: 'test.operator', sourceIp: '127.0.0.1' });
  assert.equal(refused.status, 409);
  const audit = await call(socketPath, '/audit');
  assert.equal(audit.status, 200);
  assert.equal(audit.body.chainValid, true);
  assert.deepEqual(audit.body.events.map((event) => event.action), ['revoke-session', 'approve-ssh-access']);
  assert.equal(audit.body.events[1].result, 'success');
  assert.equal(audit.body.events[0].result, 'not-active-or-not-controllable');

  const addedAllow = await call(socketPath, '/allow-ip', 'POST', {
    ip: '203.0.113.45', actor: 'test.operator', sourceIp: '127.0.0.1', reason: 'Test allowlist entry',
  });
  assert.equal(addedAllow.status, 200);
  assert.match(addedAllow.body.message, /allowed to connect.*without an approval email/);
  const allowlist = await call(socketPath, '/allowed-ips');
  assert.deepEqual(allowlist.body.allowedIps.map((item) => ({ ip: item.ip, blocked: item.blocked })), [
    { ip: '203.0.113.45', blocked: false },
  ]);
  const removeAllow = await call(socketPath, '/remove-allowed-ip', 'POST', {
    ip: '203.0.113.45', actor: 'test.operator', sourceIp: '127.0.0.1',
  });
  assert.equal(removeAllow.status, 200);
  assert.deepEqual((await call(socketPath, '/allowed-ips')).body.allowedIps, []);
  const finalAudit = await call(socketPath, '/audit');
  assert.equal(finalAudit.body.chainValid, true);
  assert.deepEqual(finalAudit.body.events.slice(0, 2).map((event) => event.action), ['remove-allowed-ip', 'allow-ip']);
});
