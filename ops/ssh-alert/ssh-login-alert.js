'use strict';

const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const backendRoot = '/var/www/academify/backend';
require(`${backendRoot}/node_modules/dotenv`).config({ path: `${backendRoot}/.env`, quiet: true });
const nodemailer = require(`${backendRoot}/node_modules/nodemailer`);
const { issuePanelLink, openStore, recordSession, shouldSendLoginAlert } = require('./ssh-action-store');

const recipient = 'syedaabid1995@gmail.com';
const host = process.env.PLATFORM_SMTP_HOST;
const port = Number(process.env.PLATFORM_SMTP_PORT || 587);
const fromAddress = process.env.PLATFORM_SMTP_FROM_EMAIL;
const fromName = process.env.PLATFORM_SMTP_FROM_NAME || 'SAAPT Server Security';

if (!host || !fromAddress || !process.env.PLATFORM_SMTP_USERNAME || !process.env.PLATFORM_SMTP_PASSWORD) {
  throw new Error('Platform SMTP is not fully configured');
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  requireTLS: port === 587,
  auth: { user: process.env.PLATFORM_SMTP_USERNAME, pass: process.env.PLATFORM_SMTP_PASSWORD },
});
const hostname = os.hostname();
const panelUrl = String(process.env.OPS_PUBLIC_URL || 'https://ops.saapttech.com').replace(/\/$/, '');
const isTest = process.argv.includes('--test');
const db = isTest ? null : openStore();

const sendImmediately = async (subject, text, html) => {
  const message = {
    from: { name: fromName, address: fromAddress },
    to: recipient,
    subject,
    text,
  };
  if (html) message.html = html;
  return transporter.sendMail(message);
};

const sendAlert = (subject, text, html) => {
  if (isTest) return sendImmediately(subject, text, html);
  try {
    const now = Date.now();
    const result = db.prepare(`
      INSERT INTO ssh_mail_outbox (subject, text_body, html_body, created_at, next_attempt_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(subject, text, html || null, now, now);
    console.log(`Security email queued id=${result.lastInsertRowid} subject=${subject}`);
    scheduleMailDrain(0);
    return Promise.resolve(result.lastInsertRowid);
  } catch (error) {
    return Promise.reject(error);
  }
};

function processStartTicks(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
    return fields[19] || null;
  } catch { return null; }
}

const minimumSendIntervalMs = 30 * 1000;
let drainTimer;
let drainingMail = false;

function scheduleMailDrain(delayMs) {
  if (isTest || drainTimer) return;
  drainTimer = setTimeout(() => {
    drainTimer = null;
    drainMailQueue().catch((error) => console.error('SSH mail queue worker failed:', error.message));
  }, Math.max(0, delayMs));
}

async function drainMailQueue() {
  if (drainingMail) return;
  const message = db.prepare('SELECT * FROM ssh_mail_outbox ORDER BY id LIMIT 1').get();
  if (!message) return;
  const now = Date.now();
  const schedule = db.prepare('SELECT next_send_at FROM ssh_mail_schedule WHERE id = 1').get();
  const eligibleAt = Math.max(message.next_attempt_at, schedule?.next_send_at || 0);
  if (eligibleAt > now) {
    scheduleMailDrain(eligibleAt - now);
    return;
  }

  drainingMail = true;
  try {
    await sendImmediately(message.subject, message.text_body, message.html_body);
    db.prepare('DELETE FROM ssh_mail_outbox WHERE id = ?').run(message.id);
    db.prepare(`
      INSERT INTO ssh_mail_schedule (id, next_send_at) VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET next_send_at = excluded.next_send_at
    `).run(Date.now() + minimumSendIntervalMs);
    console.log(`Security email accepted by SMTP relay id=${message.id} queueAgeMs=${Date.now() - message.created_at}`);
    scheduleMailDrain(minimumSendIntervalMs);
  } catch (error) {
    const attempts = message.attempts + 1;
    const rateLimited = error.responseCode === 451 || /ratelimit/i.test(error.response || '');
    const delayMs = rateLimited
      ? Math.min(60 * 1000 * 2 ** Math.min(attempts - 1, 4), 15 * 60 * 1000)
      : Math.min(15 * 1000 * 2 ** Math.min(attempts - 1, 7), 30 * 60 * 1000);
    const detail = `${error.code || 'SMTP_ERROR'}${error.responseCode ? ` ${error.responseCode}` : ''}: ${String(error.response || error.message).slice(0, 400)}`;
    db.prepare('UPDATE ssh_mail_outbox SET attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?')
      .run(attempts, Date.now() + delayMs, detail, message.id);
    console.error(`Security email send deferred id=${message.id} retryInMs=${delayMs} reason=${detail}`);
    scheduleMailDrain(delayMs);
  } finally {
    drainingMail = false;
  }
}

function findSession(ip, sourcePort, username, method) {
  const deadline = Date.now() + 2500;
  let miss = 'no-socket-match';
  do {
    try {
      const output = execFileSync('/usr/bin/ss', [
        '-Htnp', 'state', 'established', 'dst', ip, 'dport', '=', `:${sourcePort}`,
      ], { encoding: 'utf8', timeout: 1000 });
      for (const line of output.split('\n')) {
        if (!line) continue;
        const fields = line.trim().split(/\s+/);
        const local = fields[2] || '';
        const peer = fields[3] || '';
        const peerPort = Number(peer.slice(peer.lastIndexOf(':') + 1));
        const localPort = Number(local.slice(local.lastIndexOf(':') + 1));
        const pids = [...line.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1]));
        if (peerPort !== sourcePort) { miss = `socket-port-mismatch:${peerPort}`; continue; }
        if (!pids.length) { miss = 'socket-has-no-pid'; continue; }
        const pid = pids[0];
        const command = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ').trim();
        if (!command.startsWith(`sshd: ${username}@`) && !command.startsWith(`sshd: ${username} [`)) { miss = 'pid-command-mismatch'; continue; }
        const pidStartTicks = processStartTicks(pid);
        if (!pidStartTicks) { miss = 'pid-start-time-unavailable'; continue; }
        return { pid, pidStartTicks, ip, sourcePort, localPort, username, method };
      }
    } catch {
      return null;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  } while (Date.now() < deadline);
  console.log(`SSH exact-session lookup miss account=${username} ip=${ip} clientPort=${sourcePort} reason=${miss}`);
  return null;
}

if (isTest) {
  sendAlert('SAAPT SSH alert delivery test', `Email alerts are configured for SSH activity on ${hostname}.`)
    .then(() => console.log('Alert delivery test sent'))
    .catch((error) => { console.error('Alert delivery test failed:', error.code || error.message); process.exitCode = 1; })
    .finally(() => transporter.close());
} else {
  scheduleMailDrain(0);
  const recentFailures = new Map();
  const failureWindowMs = 10 * 60 * 1000;
  const alertCooldownMs = 10 * 60 * 1000;
  const acceptedByPid = new Map();
  const sshJournal = spawn('/usr/bin/journalctl', [
    '--follow', '--lines=0', '--output=short', '--unit=ssh.service',
  ], { stdio: ['ignore', 'pipe', 'inherit'] });

  let buffer = '';
  sshJournal.stdout.setEncoding('utf8');
  sshJournal.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const success = line.match(/sshd\[(\d+)\]:\s*Accepted (password|publickey|keyboard-interactive\/pam) for (\S+) from ([0-9a-fA-F:.]+) port (\d+)/);
      if (success) {
        const [, pidText, method, username, ip, portText] = success;
        acceptedByPid.set(Number(pidText), { method, username, ip, sourcePort: Number(portText), recordedAt: Date.now() });
        continue;
      }

      const opened = line.match(/sshd\[(\d+)\]:\s*pam_unix\(sshd:session\): session opened for user ([^\s(]+)/);
      if (opened) {
        const [, pidText, openedUser] = opened;
        const login = acceptedByPid.get(Number(pidText));
        acceptedByPid.delete(Number(pidText));
        if (login && login.username === openedUser) {
          const session = findSession(login.ip, login.sourcePort, login.username, login.method);
          const sessionRecord = recordSession(db, session || {
            username: login.username, ip: login.ip, sourcePort: login.sourcePort, method: login.method,
          });
          const actionUrl = `${panelUrl}/sessions#${issuePanelLink(db, sessionRecord)}`;
          console.log(`Observed SSH session account=${login.username} ip=${login.ip} sessionControl=${session ? 'created' : 'unavailable'}`);
          if (shouldSendLoginAlert(db, login.ip)) {
            const actionText = `\n\nReview all currently active SSH sessions (link expires in 60 minutes):\n${actionUrl}\nSign in to the separate server-operations panel to view or manage sessions.`;
            sendAlert(
              `SAAPT SSH login: ${login.username} from ${login.ip}`,
              `A successful SSH session was opened.\n\nServer: ${hostname}\nLinux account: ${login.username}\nAuthentication: ${login.method}\nSource IP: ${login.ip}\nSource port: ${login.sourcePort}\nDetected: ${new Date().toISOString()}${actionText}`,
              `<p>A successful SSH session was opened.</p><p>Server: ${hostname}<br>Linux account: ${login.username}<br>Authentication: ${login.method}<br>Source IP: ${login.ip}<br>Source port: ${login.sourcePort}<br>Detected: ${new Date().toISOString()}</p><p><a href="${actionUrl}">Review all SSH sessions</a> (link expires in 60 minutes).</p><p>Sign in to the separate server-operations panel to review or manage sessions.</p>`,
            ).then(() => console.log(`Successful-login alert enqueued account=${login.username} ip=${login.ip} session=${sessionRecord}`))
              .catch((error) => console.error('Could not queue successful-login alert:', error.code || error.message));
          } else {
            console.log(`Successful-login alert suppressed by 5-minute IP cooldown ip=${login.ip} session=${sessionRecord}`);
          }
        }
        continue;
      }

      const closed = line.match(/sshd\[(\d+)\]:\s*pam_unix\(sshd:session\): session closed for user ([^\s(]+)/);
      if (closed) {
        db.prepare(`UPDATE ssh_sessions SET ended_at = ? WHERE sshd_pid = ? AND username = ? AND ended_at IS NULL`)
          .run(Date.now(), Number(closed[1]), closed[2]);
        continue;
      }

      const failure = line.match(/Failed (?:password|publickey) for (?:invalid user )?(\S+) from ([0-9a-fA-F:.]+)/);
      if (!failure) continue;
      const [, username, ip] = failure;
      const now = Date.now();
      const state = recentFailures.get(ip) || { timestamps: [], lastAlertAt: 0 };
      state.timestamps = state.timestamps.filter((timestamp) => now - timestamp < failureWindowMs);
      state.timestamps.push(now);
      if (state.timestamps.length >= 5 && now - state.lastAlertAt >= alertCooldownMs) {
        state.lastAlertAt = now;
        sendAlert(
          `SAAPT SSH failures: ${ip}`,
          `At least five SSH authentication failures from one IP were recorded within ten minutes.\n\nServer: ${hostname}\nSource IP: ${ip}\nLatest attempted account: ${username}\nDetected: ${new Date().toISOString()}`,
        ).catch((error) => console.error('Could not queue failed-login alert:', error.code || error.message));
      }
      recentFailures.set(ip, state);
    }
    const cutoff = Date.now() - 2 * 60 * 1000;
    for (const [pid, login] of acceptedByPid) if (login.recordedAt < cutoff) acceptedByPid.delete(pid);
  });

  sshJournal.on('error', (error) => { console.error('Could not monitor SSH journal:', error.message); process.exit(1); });
  sshJournal.on('exit', (code) => { console.error(`SSH journal monitor exited with code ${code}`); process.exit(code || 1); });
}
