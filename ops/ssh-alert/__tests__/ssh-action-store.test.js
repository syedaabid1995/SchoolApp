'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saapt-ssh-store-'));
process.env.SSH_ALERT_DATA_DIR = testDir;
const { expireStaleMail, isTrustedSource, openStore, issuePanelLink, recordSession, shouldSendLoginAlert } = require('../ssh-action-store');

test('records login sessions independently from whether an alert is sent', () => {
  const db = openStore();
  const id = recordSession(db, { pid: 41, pidStartTicks: '9988', username: 'ops', ip: '203.0.113.2', sourcePort: 5000, localPort: 22, method: 'publickey' });
  const row = db.prepare('SELECT * FROM ssh_sessions WHERE id=?').get(id);
  assert.equal(row.username, 'ops');
  assert.equal(row.source_ip, '203.0.113.2');
  assert.equal(row.control_available, 1);
  assert.equal(row.sshd_start_ticks, '9988');
  db.close();
});

test('throttles email per source IP for five minutes while allowing another IP', () => {
  const db = openStore();
  assert.equal(shouldSendLoginAlert(db, '203.0.113.10'), true);
  assert.equal(shouldSendLoginAlert(db, '203.0.113.10'), false);
  assert.equal(shouldSendLoginAlert(db, '203.0.113.11'), true);
  db.prepare('UPDATE ssh_login_alert_windows SET last_alert_at=? WHERE source_ip=?').run(Date.now() - 5 * 60 * 1000 - 1, '203.0.113.10');
  assert.equal(shouldSendLoginAlert(db, '203.0.113.10'), true);
  db.close();
});

test('expires only SSH alert emails older than the freshness window', () => {
  const db = openStore();
  const now = Date.now();
  const insert = db.prepare(`
    INSERT INTO ssh_mail_outbox (subject, text_body, created_at, next_attempt_at)
    VALUES (?, ?, ?, ?)
  `);
  insert.run('stale', 'stale body', now - 60_001, now - 60_001);
  insert.run('fresh', 'fresh body', now - 59_999, now - 59_999);

  assert.equal(expireStaleMail(db, now), 1);
  assert.deepEqual(db.prepare('SELECT subject FROM ssh_mail_outbox').all().map((row) => row.subject), ['fresh']);
  db.close();
});

test('creates expiring opaque panel links and stores only token hashes', () => {
  const db = openStore();
  const sessionId = recordSession(db, { username: 'ops', ip: '203.0.113.12', sourcePort: 6000, method: 'publickey' });
  const token = issuePanelLink(db, sessionId);
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/);
  const row = db.prepare('SELECT * FROM ssh_panel_links').get();
  assert.notEqual(row.token_hash, token);
  assert.equal(row.session_id, sessionId);
  assert.ok(row.expires_at - row.issued_at <= 60 * 60 * 1000);
  db.close();
});

test('global allowlist entries trust any SSH account while account-scoped entries remain supported', () => {
  const db = openStore();
  db.prepare('INSERT INTO ssh_trusted_sources (username, source_ip, created_at) VALUES (?, ?, ?)')
    .run('*', '203.0.113.20', Date.now());
  db.prepare('INSERT INTO ssh_trusted_sources (username, source_ip, created_at) VALUES (?, ?, ?)')
    .run('deploy', '203.0.113.21', Date.now());
  assert.equal(isTrustedSource(db, 'root', '203.0.113.20'), true);
  assert.equal(isTrustedSource(db, 'deploy', '203.0.113.21'), true);
  assert.equal(isTrustedSource(db, 'root', '203.0.113.21'), false);
  db.close();
});

test('audit table rejects updates and deletes', () => {
  const db = openStore();
  db.prepare(`INSERT INTO ssh_security_audit (actor, action, target, source_ip, result, created_at)
    VALUES ('tester', 'test', '-', '127.0.0.1', 'success', ?)`).run(Date.now());
  assert.throws(() => db.prepare('UPDATE ssh_security_audit SET result=?').run('changed'), /append-only/);
  assert.throws(() => db.prepare('DELETE FROM ssh_security_audit').run(), /append-only/);
  db.close();
  fs.rmSync(testDir, { recursive: true, force: true });
});
