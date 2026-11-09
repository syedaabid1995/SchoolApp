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

const serverActivityCategories = {
  all: 'All server activity',
  ssh_auth: 'SSH authentication',
  privileged_command: 'Privileged commands',
  log_read: 'Server log access',
  log_change: 'Server log changes',
  security_config: 'Security and access configuration',
  persistence_config: 'Services, scheduled tasks, and SSH keys',
};
const auditKeysByCategory = {
  privileged_command: ['saapt_privileged_command'],
  log_read: ['saapt_log_read'],
  log_change: ['saapt_log_change'],
  security_config: ['saapt_ssh_config', 'saapt_sudo_config', 'saapt_identity_config', 'saapt_pam_config', 'saapt_audit_config'],
  persistence_config: ['saapt_service_config', 'saapt_cron_config', 'saapt_shell_config', 'saapt_authorized_keys'],
};

function queryServerActivity(category, range, page) {
  if (!Object.hasOwn(serverActivityCategories, category) || !['today', 'last-7-days'].includes(range)
    || !Number.isInteger(page) || page < 1 || page > 10000) {
    return { status: 400, body: { message: 'Choose a supported activity category and time range.' } };
  }
  const events = [];
  const run = (binary, args, label, parser) => {
    try {
      const output = execFileSync(binary, args, { encoding: 'utf8', timeout: 10000, maxBuffer: 2 * 1024 * 1024 });
      for (const line of output.split(/\r?\n/).filter(Boolean)) {
        const event = parser(line);
        if (event && events.length < 10000) events.push({ ...event, category: label });
      }
    } catch (error) {
      if (error.stdout) {
        for (const line of String(error.stdout).split(/\r?\n/).filter(Boolean)) {
          const event = parser(line);
          if (event && events.length < 10000) events.push({ ...event, category: label });
        }
      } else if (error.code !== 'ENOENT' && error.status !== 1) {
        throw error;
      }
    }
  };
  const categories = category === 'all' ? Object.keys(auditKeysByCategory) : (auditKeysByCategory[category] ? [category] : []);
  const auditStart = range === 'today'
    ? ['today']
    : (() => {
      const date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const localDate = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
      return [localDate, '00:00:00'];
    })();
  for (const key of categories.flatMap((name) => auditKeysByCategory[name])) {
    const label = category === 'all'
      ? serverActivityCategories[Object.keys(auditKeysByCategory).find((name) => auditKeysByCategory[name].includes(key))]
      : serverActivityCategories[category];
    run('/usr/sbin/ausearch', ['--input', '/var/log/audit/audit.log', '--key', key, '--format', 'text', '--start', ...auditStart], label, (line) => {
      const match = line.match(/^At (.+?) (\d{2}:\d{2}:\d{2}) (\d{2}\/\d{2}\/\d{4}) (.+)$/);
      if (!match) return null;
      const [month, day, year] = match[3].split('/');
      return { timestamp: `${year}-${month}-${day} ${match[2]}`, details: `${match[1]} ${match[4]}`.slice(0, 1200) };
    });
  }
  if (category === 'all' || category === 'ssh_auth') {
    const since = range === 'today' ? 'today' : '7 days ago';
    run('/usr/bin/journalctl', ['--unit=ssh.service', `--since=${since}`, '--no-pager', '--output=short-iso', '--lines=500'], serverActivityCategories.ssh_auth, (line) => {
      const match = line.match(/^(\S+)\s+\S+\s+\S+\s+(.+)$/);
      if (!match || !/(sshd|ssh\[|Accepted |Failed |Invalid user|authentication failure)/i.test(match[2])) return null;
      return { timestamp: match[1], details: match[2].slice(0, 1200) };
    });
  }
  events.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  const pageSize = 25;
  const total = events.length;
  const offset = (page - 1) * pageSize;
  return { status: 200, body: {
    events: events.slice(offset, offset + pageSize), category, range, page, pageSize, total,
    truncated: total === 10000, categories: serverActivityCategories,
  } };
}

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
  if (req.method === 'GET' && req.url === '/allowed-ips') {
    const allowedIps = db.prepare(`SELECT trusted.source_ip AS ip, trusted.created_at,
      COALESCE(block.enabled, 0) AS blocked
      FROM ssh_trusted_sources AS trusted
      LEFT JOIN ssh_ip_blocks AS block ON block.ip = trusted.source_ip
      WHERE trusted.username = '*' ORDER BY trusted.source_ip`).all()
      .map((row) => ({ ...row, blocked: Boolean(row.blocked) }));
    return json(res, 200, { allowedIps });
  }
  if (req.method === 'GET' && req.url === '/counts') {
    const sessions = activeSessions().length;
    const requests = db.prepare(`SELECT COUNT(*) AS count FROM ssh_access_requests
      WHERE approved_at IS NULL AND used_at IS NULL AND expires_at > ?`).get(Date.now()).count;
    const blocks = db.prepare('SELECT COUNT(*) AS count FROM ssh_ip_blocks').get().count;
    const allowedIps = db.prepare("SELECT COUNT(*) AS count FROM ssh_trusted_sources WHERE username = '*'").get().count;
    return json(res, 200, { sessions, requests, blocks, allowedIps });
  }
  if (req.method === 'GET' && req.url === '/access-requests') {
    const requests = db.prepare(`SELECT token_hash AS id, username, source_ip, issued_at, expires_at
      FROM ssh_access_requests WHERE approved_at IS NULL AND used_at IS NULL AND expires_at > ? ORDER BY issued_at DESC`).all(Date.now());
    return json(res, 200, { requests });
  }
  if (req.method === 'GET' && req.url.startsWith('/audit')) {
    const url = new URL(req.url, 'http://localhost');
    const page = Number(url.searchParams.get('page') || 1);
    if (!Number.isInteger(page) || page < 1 || page > 10000) return json(res, 400, { message: 'Choose a valid audit log page.' });
    const rows = db.prepare('SELECT id, actor, action, target, source_ip, result, details, previous_hash, event_hash, created_at FROM ssh_security_audit ORDER BY id').all();
    let previous = '';
    let chainValid = true;
    for (const event of rows) {
      const fields = { actor: event.actor, action: event.action, target: event.target, source_ip: event.source_ip, result: event.result, details: event.details, created_at: event.created_at };
      const expected = crypto.createHash('sha256').update(`${previous}\n${JSON.stringify(fields)}`).digest('hex');
      if (event.previous_hash !== previous || event.event_hash !== expected) chainValid = false;
      previous = event.event_hash;
    }
    const newestFirst = rows.slice().reverse();
    const pageSize = 25;
    const offset = (page - 1) * pageSize;
    return json(res, 200, { events: newestFirst.slice(offset, offset + pageSize), total: rows.length, page, pageSize, chainValid });
  }
  if (req.method === 'GET' && req.url.startsWith('/server-activity')) {
    const url = new URL(req.url, 'http://localhost');
    const result = queryServerActivity(url.searchParams.get('category') || 'all', url.searchParams.get('range') || 'today', Number(url.searchParams.get('page') || 1));
    return json(res, result.status, result.body);
  }
  if (req.method === 'POST' && req.url === '/auth-event') {
    if (!['panel-login', 'panel-login-failed', 'panel-logout', 'password-reset-request', 'password-reset-failed', 'password-reset-success', 'panel-password-change'].includes(input.action)) return json(res, 400, { message: 'Unsupported authentication event.' });
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
  if (req.method === 'POST' && req.url === '/allow-ip') {
    const ip = String(input.ip || '');
    if (!net.isIP(ip)) return json(res, 400, { message: 'Enter a valid IPv4 or IPv6 address.' });
    const now = Date.now();
    db.prepare(`INSERT INTO ssh_trusted_sources (username, source_ip, created_at) VALUES ('*', ?, ?)
      ON CONFLICT(username, source_ip) DO NOTHING`).run(ip, now);
    const blocked = db.prepare('SELECT 1 FROM ssh_ip_blocks WHERE ip = ? AND enabled = 1').get(ip);
    audit(input.actor || 'unknown', 'allow-ip', ip, input.sourceIp || '', 'success', String(input.reason || ''));
    return json(res, 200, { message: blocked
      ? `${ip} is on the allowlist, but its active block still prevents SSH access.`
      : `${ip} is allowed to connect to SSH without an approval email.` });
  }
  if (req.method === 'POST' && req.url === '/remove-allowed-ip') {
    const ip = String(input.ip || '');
    if (!net.isIP(ip)) return json(res, 400, { message: 'Enter a valid IPv4 or IPv6 address.' });
    const removed = db.prepare("DELETE FROM ssh_trusted_sources WHERE username = '*' AND source_ip = ?").run(ip);
    if (!removed.changes) return json(res, 404, { message: 'That address is not on the allowlist.' });
    audit(input.actor || 'unknown', 'remove-allowed-ip', ip, input.sourceIp || '', 'success', String(input.reason || ''));
    return json(res, 200, { message: `${ip} was removed from the allowlist. Future SSH logins from it will require approval unless it is explicitly blocked.` });
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
