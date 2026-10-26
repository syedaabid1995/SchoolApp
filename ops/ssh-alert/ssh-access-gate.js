'use strict';

const net = require('node:net');
const { execFileSync } = require('node:child_process');
const backendRoot = '/var/www/academify/backend';
require(`${backendRoot}/node_modules/dotenv`).config({ path: `${backendRoot}/.env`, quiet: true });
const nodemailer = require(`${backendRoot}/node_modules/nodemailer`);
const { hashToken, issueAccessRequest, openStore } = require('./ssh-action-store');

const recipient = 'syedaabid1995@gmail.com';
const username = process.env.PAM_USER || '';
const ip = process.env.PAM_RHOST || '';
const db = openStore();

function audit(message) {
  try { execFileSync('/usr/bin/logger', ['-t', 'saapt-ssh-approval', '--', message]); } catch {}
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

async function main() {
  if (process.env.PAM_SERVICE !== 'sshd' || process.env.PAM_TYPE !== 'account') return 1;
  if (!/^[a-z_][a-z0-9_.-]{0,62}\$?$/.test(username) || !net.isIP(ip)) {
    audit('Rejected SSH approval check with invalid account or source address');
    return 1;
  }

  const now = Date.now();
  if (db.prepare('SELECT 1 FROM ssh_ip_blocks WHERE ip = ? AND enabled = 1').get(ip)) {
    audit(`Rejected SSH login from blocked IP account=${username} ip=${ip}`);
    return 1;
  }
  if (db.prepare('SELECT 1 FROM ssh_trusted_sources WHERE username = ? AND source_ip = ?').get(username, ip)) return 0;
  if (db.prepare(`
    SELECT 1 FROM ssh_access_requests
    WHERE username = ? AND source_ip = ? AND approved_at IS NOT NULL AND expires_at > ?
    LIMIT 1
  `).get(username, ip, now)) return 0;

  const token = issueAccessRequest(db, username, ip);
  if (!token) {
    audit(`SSH login held for approval account=${username} ip=${ip} email=already-pending`);
    return 1;
  }

  const host = process.env.PLATFORM_SMTP_HOST;
  const port = Number(process.env.PLATFORM_SMTP_PORT || 587);
  const fromAddress = process.env.PLATFORM_SMTP_FROM_EMAIL;
  const fromName = process.env.PLATFORM_SMTP_FROM_NAME || 'SAAPT Server Security';
  if (!host || !fromAddress || !process.env.PLATFORM_SMTP_USERNAME || !process.env.PLATFORM_SMTP_PASSWORD) {
    db.prepare('DELETE FROM ssh_access_requests WHERE token_hash = ?').run(hashToken(token));
    audit(`SSH login held for approval account=${username} ip=${ip} email=not-configured`);
    return 1;
  }

  const safeUser = escapeHtml(username);
  const safeIp = escapeHtml(ip);
  const panelUrl = String(process.env.OPS_PUBLIC_URL || 'https://200.97.165.51:4174').replace(/\/$/, '');
  const url = `${panelUrl}/access#${token}`;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 9000,
    auth: { user: process.env.PLATFORM_SMTP_USERNAME, pass: process.env.PLATFORM_SMTP_PASSWORD },
  });

  try {
    await transporter.sendMail({
      from: { name: fromName, address: fromAddress },
      to: recipient,
      subject: `SAAPT SSH access approval: ${username} from ${ip}`,
      text: `A login attempt with valid SSH credentials is waiting for your approval.\n\nServer: ${require('node:os').hostname()}\nLinux account: ${username}\nSource IP: ${ip}\n\nReview and approve this account/IP for 15 minutes:\n${url}\n\nThe attempt was not granted a shell. After approval, the person must retry and authenticate normally.`,
      html: `<p>A login attempt with valid SSH credentials is waiting for your approval. The attempt has not been granted a shell.</p><p>Server: ${require('node:os').hostname()}<br>Linux account: ${safeUser}<br>Source IP: ${safeIp}</p><p><a href="${url}">Review this SSH access request</a></p><p>Approval grants this account/IP 15 minutes to retry. SSH key or password authentication is still required.</p>`,
    });
    audit(`SSH login held for approval account=${username} ip=${ip} email=sent`);
    return 1;
  } catch (error) {
    db.prepare('DELETE FROM ssh_access_requests WHERE token_hash = ?').run(hashToken(token));
    audit(`SSH login held for approval account=${username} ip=${ip} email=failed code=${error.code || 'unknown'}`);
    return 1;
  } finally {
    transporter.close();
    db.close();
  }
}

main().then((status) => { process.exitCode = status; }).catch((error) => {
  audit(`SSH approval gate error account=${username} ip=${net.isIP(ip) ? ip : 'invalid'} code=${error.code || 'unknown'}`);
  try { db.close(); } catch {}
  process.exitCode = 1;
});
