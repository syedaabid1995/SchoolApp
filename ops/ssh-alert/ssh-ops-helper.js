'use strict';

const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { openStore, hashToken } = require('./ssh-action-store');
const { syncFirewall } = require('./ssh-firewall');

const socketPath = process.env.OPS_HELPER_SOCKET || '/run/saapt-ssh-alert/ops-helper.sock';
const db = openStore();

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 4096) reject(new Error('body too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

function exactConnection(session) {
  if (!session.sshd_pid || !session.sshd_start_ticks || !session.local_port || !net.isIP(session.source_ip)) return false;
  try {
    const stat = fs.readFileSync(`/proc/${session.sshd_pid}/stat`, 'utf8');
    const startTicks = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19];
    if (startTicks !== session.sshd_start_ticks) return false;
    const output = execFileSync('/usr/bin/ss', [
      '-Htnpe', 'state', 'established', 'dst', session.source_ip,
      'dport', '=', `:${session.source_port}`, 'sport', '=', `:${session.local_port}`,
    ], { encoding: 'utf8', timeout: 3000 });
    for (const line of output.split('\n')) {
      if (!line) continue;
      const fields = line.trim().split(/\s+/);
      const peer = fields[3] || '';
      const peerPort = Number(peer.slice(peer.lastIndexOf(':') + 1));
      const inode = Number(line.match(/\bino:(\d+)/)?.[1]);
      if (peerPort !== session.source_port || !inode || sshdProcessForSocket(inode, session.username)?.pid !== session.sshd_pid) continue;
      const command = fs.readFileSync(`/proc/${session.sshd_pid}/cmdline`, 'utf8').replaceAll('\0', ' ').trim();
      if (command.startsWith(`sshd: ${session.username}@`) || command.startsWith(`sshd: ${session.username} [`)) return true;
    }
  } catch { return false; }
  return false;
}

function sshdProcessForSocket(inode, expectedUsername) {
  for (const entry of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    let command;
    try { command = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ').trim(); }
    catch { continue; }
    const username = command.match(/^sshd: ([^@\s]+)@/)?.[1];
    if (!username || (expectedUsername && username !== expectedUsername)) continue;
    let descriptors;
    try { descriptors = fs.readdirSync(`/proc/${pid}/fd`); }
    catch { continue; }
    for (const descriptor of descriptors) {
      try {
        if (fs.readlinkSync(`/proc/${pid}/fd/${descriptor}`) === `socket:[${inode}]`) return { pid, username };
      } catch {}
    }
  }
  return null;
}

function processStartTicks(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19] || null;
  } catch { return null; }
}

function parseEndpoint(value) {
  const endpoint = String(value || '');
  const bracketEnd = endpoint.startsWith('[') ? endpoint.indexOf(']') : -1;
  const host = bracketEnd >= 0 ? endpoint.slice(1, bracketEnd) : endpoint.slice(0, endpoint.lastIndexOf(':'));
  const port = Number(endpoint.slice((bracketEnd >= 0 ? bracketEnd : endpoint.lastIndexOf(':')) + 1).replace(/^:/, ''));
  return net.isIP(host) && Number.isInteger(port) ? { host, port } : null;
}

function discoverActiveSessions() {
  let output;
  try {
    output = execFileSync('/usr/bin/ss', ['-Htnpe', 'state', 'established'], { encoding: 'utf8', timeout: 3000 });
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(`SSH session discovery failed: ${error.message}`);
    return;
  }

  for (const line of output.split('\n')) {
    if (!line) continue;
    const fields = line.trim().split(/\s+/);
    const local = parseEndpoint(fields[2]);
    const peer = parseEndpoint(fields[3]);
    if (!local || local.port !== 22 || !peer) continue;
    const inode = Number(line.match(/\bino:(\d+)/)?.[1]);
    if (!inode) continue;
    const owner = sshdProcessForSocket(inode);
    if (owner) {
      const { pid, username } = owner;
      const startTicks = processStartTicks(pid);
      if (!startTicks) continue;

      const existing = db.prepare(`SELECT * FROM ssh_sessions
        WHERE username=? AND source_ip=? AND source_port=? AND local_port=? AND ended_at IS NULL
        ORDER BY started_at DESC LIMIT 1`).get(username, peer.host, peer.port, local.port);
      if (existing?.sshd_pid === pid && existing.sshd_start_ticks === startTicks) break;
      if (existing && existing.sshd_pid == null) {
        db.prepare(`UPDATE ssh_sessions SET sshd_pid=?, sshd_start_ticks=?, local_port=?, control_available=1
          WHERE id=? AND ended_at IS NULL`).run(pid, startTicks, local.port, existing.id);
      } else {
        if (existing) db.prepare('UPDATE ssh_sessions SET ended_at=? WHERE id=? AND ended_at IS NULL').run(Date.now(), existing.id);
        let startedAt = Date.now();
        try {
          const processStart = execFileSync('/usr/bin/ps', ['-p', String(pid), '-o', 'lstart='], { encoding: 'utf8', timeout: 1000 }).trim();
          startedAt = Date.parse(processStart) || startedAt;
        } catch {}
        db.prepare(`INSERT INTO ssh_sessions
          (id, sshd_pid, sshd_start_ticks, username, source_ip, source_port, local_port, auth_method, started_at, control_available)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'discovered', ?, 1)`)
          .run(crypto.randomUUID(), pid, startTicks, username, peer.host, peer.port, local.port, startedAt);
      }
      break;
    }
  }
}

function activeSessions() {
  discoverActiveSessions();
  const sessions = db.prepare('SELECT * FROM ssh_sessions WHERE ended_at IS NULL ORDER BY started_at DESC').all();
  const result = [];
  for (const session of sessions) {
    const active = exactConnection(session);
    if (!active) {
      db.prepare('UPDATE ssh_sessions SET ended_at = ? WHERE id = ? AND ended_at IS NULL').run(Date.now(), session.id);
      continue;
    }
    result.push({
      id: session.id,
      username: session.username,
      ip: session.source_ip,
      sourcePort: session.source_port,
      authMethod: session.auth_method,
      startedAt: session.started_at,
      controllable: Boolean(session.control_available),
    });
  }
  return result;
}

function audit(actor, action, target, sourceIp, result, details = '') {
  const fields = {
    actor: actor.slice(0, 160), action, target: target.slice(0, 255),
    source_ip: net.isIP(sourceIp) ? sourceIp : 'unknown', result, details: String(details).slice(0, 500), created_at: Date.now(),
  };
  db.exec('BEGIN IMMEDIATE');
  try {
    const previous = db.prepare('SELECT event_hash FROM ssh_security_audit ORDER BY id DESC LIMIT 1').get()?.event_hash || '';
    const eventHash = crypto.createHash('sha256').update(`${previous}\n${JSON.stringify(fields)}`).digest('hex');
    db.prepare(`INSERT INTO ssh_security_audit
      (actor, action, target, source_ip, result, details, previous_hash, event_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(fields.actor, fields.action, fields.target, fields.source_ip, fields.result, fields.details, previous, eventHash, fields.created_at);
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

async function handle(req, res) {
  let input = {};
  try { input = await body(req); } catch { return json(res, 400, { message: 'Invalid request.' }); }

  if (req.method === 'GET' && req.url === '/sessions') return json(res, 200, { sessions: activeSessions() });
  if (req.method === 'GET' && req.url === '/blocks') {
    const blocks = db.prepare('SELECT ip, enabled, created_at, updated_at FROM ssh_ip_blocks ORDER BY ip').all()
      .map((row) => ({ ...row, enabled: Boolean(row.enabled) }));
    return json(res, 200, { blocks });
  }
  if (req.method === 'GET' && req.url === '/access-requests') {
    const requests = db.prepare(`SELECT token_hash AS id, username, source_ip, issued_at, expires_at
      FROM ssh_access_requests WHERE approved_at IS NULL AND used_at IS NULL AND expires_at > ? ORDER BY issued_at DESC`).all(Date.now());
    return json(res, 200, { requests });
  }
  if (req.method === 'GET' && req.url === '/audit') {
    const rows = db.prepare('SELECT id, actor, action, target, source_ip, result, details, previous_hash, event_hash, created_at FROM ssh_security_audit ORDER BY id').all();
    let previous = '';
    let chainValid = true;
    for (const event of rows) {
      const fields = { actor: event.actor, action: event.action, target: event.target, source_ip: event.source_ip, result: event.result, details: event.details, created_at: event.created_at };
      const expected = crypto.createHash('sha256').update(`${previous}\n${JSON.stringify(fields)}`).digest('hex');
      if (event.previous_hash !== previous || event.event_hash !== expected) chainValid = false;
      previous = event.event_hash;
    }
    return json(res, 200, { events: rows.slice(-200).reverse(), chainValid });
  }
  if (req.method === 'POST' && req.url === '/auth-event') {
    if (!['panel-login', 'panel-login-failed', 'panel-logout'].includes(input.action)) return json(res, 400, { message: 'Unsupported authentication event.' });
    audit(input.actor || 'unknown', input.action, String(input.target || '-'), input.sourceIp || '', String(input.result || 'unknown'), String(input.details || ''));
    return json(res, 200, { ok: true });
  }
  if (req.method === 'POST' && req.url === '/resolve-alert') {
    if (typeof input.token !== 'string' || input.token.length > 128) return json(res, 400, { message: 'Invalid alert link.' });
    const tokenHash = hashToken(input.token);
    const link = db.prepare('SELECT session_id, expires_at FROM ssh_panel_links WHERE token_hash = ?').get(tokenHash);
    if (link) {
      if (link.expires_at <= Date.now()) return json(res, 410, { message: 'This review link expired. The active session list is still available after sign-in.' });
      const session = db.prepare('SELECT id FROM ssh_sessions WHERE id = ? AND ended_at IS NULL').get(link.session_id);
      return json(res, 200, { sessionId: session?.id || null, expiresAt: link.expires_at });
    }
    const legacy = db.prepare('SELECT * FROM ssh_actions WHERE token_hash=? AND expires_at>?').get(tokenHash, Date.now());
    if (!legacy) return json(res, 410, { message: 'This review link expired. The active session list is still available after sign-in.' });
    let session = db.prepare(`SELECT id FROM ssh_sessions WHERE sshd_pid=? AND username=? AND source_ip=? AND source_port=? AND local_port=? AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1`).get(legacy.sshd_pid, legacy.username, legacy.source_ip, legacy.source_port, legacy.local_port);
    if (!session) {
      const candidate = {
        sshd_pid: legacy.sshd_pid, sshd_start_ticks: processStartTicks(legacy.sshd_pid), username: legacy.username,
        source_ip: legacy.source_ip, source_port: legacy.source_port, local_port: legacy.local_port,
      };
      if (candidate.sshd_start_ticks && exactConnection(candidate)) {
        const id = crypto.randomUUID();
        db.prepare(`INSERT INTO ssh_sessions
          (id, sshd_pid, sshd_start_ticks, username, source_ip, source_port, local_port, auth_method, started_at, control_available)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
          .run(id, candidate.sshd_pid, candidate.sshd_start_ticks, candidate.username, candidate.source_ip,
            candidate.source_port, candidate.local_port, legacy.auth_method, legacy.issued_at);
        session = { id };
      }
    }
    return json(res, 200, { sessionId: session?.id || null, expiresAt: legacy.expires_at });
  }
  if (req.method === 'POST' && req.url === '/resolve-access') {
    if (typeof input.token !== 'string' || input.token.length > 128) return json(res, 400, { message: 'Invalid access request link.' });
    const request = db.prepare(`SELECT token_hash, username, source_ip, issued_at, expires_at FROM ssh_access_requests
      WHERE token_hash=? AND approved_at IS NULL AND used_at IS NULL AND expires_at > ?`).get(hashToken(input.token), Date.now());
    if (!request) return json(res, 410, { message: 'This access request expired or was already reviewed.' });
    return json(res, 200, { request: { id: request.token_hash, username: request.username, ip: request.source_ip, issuedAt: request.issued_at, expiresAt: request.expires_at } });
  }
  if (req.method === 'POST' && req.url === '/approve-access') {
    if (typeof input.id !== 'string' || !/^[a-f0-9]{64}$/.test(input.id)) return json(res, 400, { message: 'Invalid access request.' });
    const now = Date.now();
    const request = db.prepare(`SELECT username, source_ip FROM ssh_access_requests
      WHERE token_hash=? AND approved_at IS NULL AND used_at IS NULL AND expires_at > ?`).get(input.id, now);
    if (!request) return json(res, 410, { message: 'This access request expired or was already reviewed.' });
    const updated = db.prepare(`UPDATE ssh_access_requests SET approved_at=?, used_at=?, expires_at=?
      WHERE token_hash=? AND approved_at IS NULL AND used_at IS NULL AND expires_at > ?`)
      .run(now, now, now + 15 * 60 * 1000, input.id, now);
    if (updated.changes !== 1) return json(res, 410, { message: 'This access request expired or was already reviewed.' });
    audit(input.actor || 'unknown', 'approve-ssh-access', `${request.username}@${request.source_ip}`, input.sourceIp || '', 'success');
    return json(res, 200, { message: `Approved ${request.username} from ${request.source_ip} for a 15-minute retry window. They must still authenticate with SSH.` });
  }
  if (req.method === 'POST' && req.url === '/revoke') {
    const session = db.prepare('SELECT * FROM ssh_sessions WHERE id = ? AND ended_at IS NULL').get(input.id);
    if (!session || !session.control_available || !exactConnection(session)) {
      audit(input.actor || 'unknown', 'revoke-session', String(input.id || ''), input.sourceIp || '', 'not-active-or-not-controllable');
      return json(res, 409, { message: 'This exact session is no longer active or cannot be safely controlled.' });
    }
    try {
      process.kill(session.sshd_pid, 'SIGTERM');
      const now = Date.now();
      db.prepare('UPDATE ssh_sessions SET ended_at = ?, revoked_at = ?, revoked_by = ? WHERE id = ? AND ended_at IS NULL')
        .run(now, now, String(input.actor || 'unknown').slice(0, 160), session.id);
      audit(input.actor || 'unknown', 'revoke-session', session.id, input.sourceIp || '', 'success');
      return json(res, 200, { message: 'The selected SSH session was terminated.' });
    } catch (error) {
      audit(input.actor || 'unknown', 'revoke-session', session.id, input.sourceIp || '', `failed:${error.code || 'error'}`);
      return json(res, 500, { message: 'Could not terminate this SSH session.' });
    }
  }
  if (req.method === 'POST' && ['/block', '/unblock', '/enable'].includes(req.url)) {
    const ip = String(input.ip || '');
    if (!net.isIP(ip)) return json(res, 400, { message: 'Enter a valid IPv4 or IPv6 address.' });
    if (req.url === '/block' && !net.isIP(String(input.sourceIp || ''))) {
      audit(input.actor || 'unknown', 'block-ip', ip, input.sourceIp || '', 'refused-unidentified-management-ip');
      return json(res, 409, { message: 'The panel could not identify your management IP, so no block was applied.' });
    }
    if (req.url === '/block' && input.sourceIp === ip) {
      audit(input.actor || 'unknown', 'block-ip', ip, input.sourceIp, 'refused-current-operator-ip');
      return json(res, 409, { message: 'You cannot block the IP address currently using the panel. Connect from a separate management address first.' });
    }
    const now = Date.now();
    try {
      db.exec('BEGIN IMMEDIATE');
      if (req.url === '/block') {
        db.prepare(`INSERT INTO ssh_ip_blocks (ip, enabled, created_at, updated_at) VALUES (?, 1, ?, ?)
          ON CONFLICT(ip) DO UPDATE SET enabled = 1, updated_at = excluded.updated_at`).run(ip, now, now);
      } else {
        const enabled = req.url === '/enable' ? 1 : 0;
        const updated = db.prepare('UPDATE ssh_ip_blocks SET enabled = ?, updated_at = ? WHERE ip = ?').run(enabled, now, ip);
        if (!updated.changes) {
          db.exec('ROLLBACK');
          return json(res, 404, { message: 'That address is not in the block list.' });
        }
      }
      syncFirewall(db);
      db.exec('COMMIT');
      const action = req.url === '/block' ? 'block-ip' : req.url === '/enable' ? 'enable-ip-block' : 'unblock-ip';
      audit(input.actor || 'unknown', action, ip, input.sourceIp || '', 'success', String(input.reason || ''));
      return json(res, 200, { message: req.url === '/block'
        ? `${ip} is blocked from future SSH connections. Existing sessions remain open.`
        : req.url === '/enable' ? `${ip} is blocked from new SSH connections again.` : `${ip} can connect to SSH again.` });
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      audit(input.actor || 'unknown', req.url.slice(1), ip, input.sourceIp || '', `failed:${error.code || 'error'}`);
      return json(res, 500, { message: 'The firewall update failed. Check the audit log and server firewall state.' });
    }
  }
  return json(res, 404, { message: 'Not found.' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error('SSH operations helper error:', error.message);
    json(res, 500, { message: 'The requested server operation failed.' });
  });
});

try { fs.unlinkSync(socketPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
server.listen(socketPath, () => {
  fs.chmodSync(socketPath, 0o660);
  console.log(`SSH operations privileged helper listening on ${socketPath}`);
});
