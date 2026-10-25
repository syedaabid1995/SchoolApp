'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const directory = process.env.SSH_ALERT_DATA_DIR || '/var/lib/saapt-ssh-alert';

function openStore() {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const db = new DatabaseSync(`${directory}/actions.sqlite`);
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ssh_actions (
      token_hash TEXT PRIMARY KEY,
      sshd_pid INTEGER NOT NULL,
      username TEXT NOT NULL,
      source_ip TEXT NOT NULL,
      source_port INTEGER NOT NULL,
      local_port INTEGER NOT NULL,
      auth_method TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS ssh_access_requests (
      token_hash TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      source_ip TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      approved_at INTEGER,
      used_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS ssh_trusted_sources (
      username TEXT NOT NULL,
      source_ip TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (username, source_ip)
    );
    CREATE TABLE IF NOT EXISTS ssh_ip_blocks (
      ip TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ssh_mail_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      text_body TEXT NOT NULL,
      html_body TEXT,
      created_at INTEGER NOT NULL,
      next_attempt_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS ssh_mail_schedule (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      next_send_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ssh_sessions (
      id TEXT PRIMARY KEY,
      sshd_pid INTEGER,
      sshd_start_ticks TEXT,
      username TEXT NOT NULL,
      source_ip TEXT NOT NULL,
      source_port INTEGER NOT NULL,
      local_port INTEGER,
      auth_method TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      control_available INTEGER NOT NULL DEFAULT 0 CHECK (control_available IN (0, 1)),
      revoked_at INTEGER,
      revoked_by TEXT
    );
    CREATE TABLE IF NOT EXISTS ssh_panel_links (
      token_hash TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ssh_sessions_active_idx ON ssh_sessions(ended_at, started_at DESC);
    CREATE TABLE IF NOT EXISTS ssh_login_alert_windows (
      source_ip TEXT PRIMARY KEY,
      last_alert_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ssh_security_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      source_ip TEXT NOT NULL,
      result TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      previous_hash TEXT NOT NULL DEFAULT '',
      event_hash TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
  `);
  const sessionColumns = new Set(db.prepare('PRAGMA table_info(ssh_sessions)').all().map((column) => column.name));
  if (!sessionColumns.has('sshd_start_ticks')) db.exec("ALTER TABLE ssh_sessions ADD COLUMN sshd_start_ticks TEXT");
  const auditColumns = new Set(db.prepare('PRAGMA table_info(ssh_security_audit)').all().map((column) => column.name));
  for (const [name, definition] of [
    ['details', "TEXT NOT NULL DEFAULT ''"],
    ['previous_hash', "TEXT NOT NULL DEFAULT ''"],
    ['event_hash', "TEXT NOT NULL DEFAULT ''"],
  ]) if (!auditColumns.has(name)) db.exec(`ALTER TABLE ssh_security_audit ADD COLUMN ${name} ${definition}`);
  const legacyAudit = db.prepare('SELECT id, actor, action, target, source_ip, result, details, previous_hash, event_hash, created_at FROM ssh_security_audit WHERE event_hash = ? ORDER BY id').all('');
  if (legacyAudit.length) {
    let previous = db.prepare('SELECT event_hash FROM ssh_security_audit WHERE id < ? ORDER BY id DESC LIMIT 1').get(legacyAudit[0].id)?.event_hash || '';
    const updateAudit = db.prepare('UPDATE ssh_security_audit SET previous_hash = ?, event_hash = ? WHERE id = ?');
    for (const event of legacyAudit) {
      const fields = { actor: event.actor, action: event.action, target: event.target, source_ip: event.source_ip, result: event.result, details: event.details, created_at: event.created_at };
      const eventHash = crypto.createHash('sha256').update(`${previous}\n${JSON.stringify(fields)}`).digest('hex');
      updateAudit.run(previous, eventHash, event.id);
      previous = eventHash;
    }
  }
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS ssh_security_audit_no_update BEFORE UPDATE ON ssh_security_audit
    BEGIN SELECT RAISE(ABORT, 'security audit records are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS ssh_security_audit_no_delete BEFORE DELETE ON ssh_security_audit
    BEGIN SELECT RAISE(ABORT, 'security audit records are append-only'); END;
  `);
  fs.chmodSync(`${directory}/actions.sqlite`, 0o600);
  return db;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function issueAction(db, session) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('DELETE FROM ssh_actions WHERE expires_at < ? OR issued_at < ?').run(now, now - 7 * 86400000);
  db.prepare(`
    INSERT INTO ssh_actions
      (token_hash, sshd_pid, username, source_ip, source_port, local_port, auth_method, issued_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(hashToken(token), session.pid, session.username, session.ip, session.sourcePort, session.localPort, session.method, now, now + 60 * 60 * 1000);
  return token;
}

function recordSession(db, session) {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO ssh_sessions
      (id, sshd_pid, sshd_start_ticks, username, source_ip, source_port, local_port, auth_method, started_at, control_available)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, session?.pid ?? null, session?.pidStartTicks || null, session?.username || 'unknown', session?.ip || '',
    session?.sourcePort || 0, session?.localPort ?? null, session?.method || 'unknown', now,
    session?.pid && session?.pidStartTicks ? 1 : 0);
  return id;
}

function issuePanelLink(db, sessionId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('DELETE FROM ssh_panel_links WHERE expires_at < ? OR issued_at < ?').run(now, now - 7 * 86400000);
  db.prepare('INSERT INTO ssh_panel_links (token_hash, session_id, issued_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), sessionId, now, now + 60 * 60 * 1000);
  return token;
}

function shouldSendLoginAlert(db, ip, cooldownMs = 5 * 60 * 1000) {
  const now = Date.now();
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare('SELECT last_alert_at FROM ssh_login_alert_windows WHERE source_ip = ?').get(ip);
    if (row && now - row.last_alert_at < cooldownMs) {
      db.exec('COMMIT');
      return false;
    }
    db.prepare(`
      INSERT INTO ssh_login_alert_windows (source_ip, last_alert_at) VALUES (?, ?)
      ON CONFLICT(source_ip) DO UPDATE SET last_alert_at = excluded.last_alert_at
    `).run(ip, now);
    db.exec('COMMIT');
    return true;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

function issueAccessRequest(db, username, ip) {
  const now = Date.now();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM ssh_access_requests WHERE expires_at < ? OR issued_at < ?').run(now, now - 7 * 86400000);
    const pending = db.prepare(`
      SELECT 1 FROM ssh_access_requests
      WHERE username = ? AND source_ip = ? AND approved_at IS NULL AND used_at IS NULL AND expires_at > ?
      LIMIT 1
    `).get(username, ip, now);
    if (pending) {
      db.exec('COMMIT');
      return null;
    }
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare(`
      INSERT INTO ssh_access_requests (token_hash, username, source_ip, issued_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(hashToken(token), username, ip, now, now + 15 * 60 * 1000);
    db.exec('COMMIT');
    return token;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

module.exports = { hashToken, issueAction, issueAccessRequest, issuePanelLink, openStore, recordSession, shouldSendLoginAlert };
