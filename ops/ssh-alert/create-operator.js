'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = process.env.OPS_PANEL_DATA || '/var/lib/saapt-ssh-panel';
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const dbPath = path.join(dataDir, 'panel.sqlite');
const keyPath = path.join(dataDir, 'mfa.key');

function base32(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let result = '';
  for (let i = 0; i < bits.length; i += 5) result += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return result;
}

function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function secret(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error('Run this command from an interactive terminal.'));
    process.stdout.write(prompt);
    let value = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const done = (error) => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdout.write('\n');
      error ? reject(error) : resolve(value);
    };
    const onData = (chunk) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003') return done(new Error('Cancelled.'));
        if (char === '\r' || char === '\n') return done();
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    process.stdin.on('data', onData);
  });
}

function encryptTotp(key, secretValue) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(secretValue, 'utf8'), cipher.final()]);
  return {
    nonce: nonce.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

async function main() {
  const [command, usernameArg] = process.argv.slice(2);
  if (!['add', 'reset', 'disable'].includes(command) || !usernameArg || !/^[a-zA-Z0-9._@-]{3,120}$/.test(usernameArg)) {
    throw new Error('Usage: node create-operator.js <add|reset|disable> <username-or-email>');
  }
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS operators (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
      totp_nonce TEXT NOT NULL, totp_tag TEXT NOT NULL, totp_ciphertext TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)), created_at INTEGER NOT NULL, last_login_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS web_sessions (
      token_hash TEXT PRIMARY KEY, operator_id TEXT NOT NULL, csrf_token TEXT NOT NULL,
      created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, source_ip TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recovery_codes (
      operator_id TEXT NOT NULL, code_hash TEXT NOT NULL, used_at INTEGER, PRIMARY KEY(operator_id, code_hash)
    );
  `);
  fs.chmodSync(dbPath, 0o600);

  if (command === 'disable') {
    const user = db.prepare('SELECT id FROM operators WHERE username=? COLLATE NOCASE').get(usernameArg);
    if (!user) throw new Error('No such operator.');
    db.prepare('UPDATE operators SET enabled=0 WHERE id=?').run(user.id);
    db.prepare('DELETE FROM web_sessions WHERE operator_id=?').run(user.id);
    console.log(`Disabled ${usernameArg} and revoked all panel sessions.`);
    db.close();
    return;
  }

  const existing = db.prepare('SELECT id FROM operators WHERE username=? COLLATE NOCASE').get(usernameArg);
  if (command === 'add' && existing) throw new Error('Operator already exists.');
  if (command === 'reset' && !existing) throw new Error('No such operator.');
  const password = await secret('Password (minimum 14 characters): ');
  const confirmation = await secret('Repeat password: ');
  if (password.length < 14 || password !== confirmation) throw new Error('Passwords must match and be at least 14 characters.');
  const salt = crypto.randomBytes(16);
  const passwordHash = crypto.scryptSync(password, salt, 64);
  const key = fs.existsSync(keyPath) ? fs.readFileSync(keyPath) : crypto.randomBytes(32);
  if (!fs.existsSync(keyPath)) fs.writeFileSync(keyPath, key, { mode: 0o600, flag: 'wx' });
  fs.chmodSync(keyPath, 0o600);
  const totpSecret = base32(crypto.randomBytes(20));
  const encrypted = encryptTotp(key, totpSecret);
  const id = existing?.id || crypto.randomUUID();
  const now = Date.now();
  const recovery = Array.from({ length: 10 }, () => crypto.randomBytes(8).toString('hex').toUpperCase());
  db.exec('BEGIN IMMEDIATE');
  try {
    if (command === 'reset') {
      db.prepare(`UPDATE operators SET password_hash=?, password_salt=?, totp_nonce=?, totp_tag=?, totp_ciphertext=?, enabled=1
        WHERE id=?`)
        .run(passwordHash.toString('base64'), salt.toString('base64'), encrypted.nonce, encrypted.tag, encrypted.ciphertext, id);
      db.prepare('DELETE FROM web_sessions WHERE operator_id=?').run(id);
      db.prepare('DELETE FROM recovery_codes WHERE operator_id=?').run(id);
    } else {
      db.prepare(`INSERT INTO operators
        (id, username, password_hash, password_salt, totp_nonce, totp_tag, totp_ciphertext, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, usernameArg, passwordHash.toString('base64'), salt.toString('base64'), encrypted.nonce, encrypted.tag, encrypted.ciphertext, now);
    }
    const insertCode = db.prepare('INSERT INTO recovery_codes (operator_id, code_hash) VALUES (?, ?)');
    for (const code of recovery) insertCode.run(id, hash(code));
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  } finally { db.close(); }

  const issuer = 'SAAPT Server Operations';
  const uri = `otpauth://totp/${encodeURIComponent(`${issuer}:${usernameArg}`)}?secret=${totpSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  console.log(`${command === 'reset' ? 'Reset' : 'Created'} operator ${usernameArg}. Configure an authenticator using this URI:\n${uri}`);
  console.log('\nStore these single-use recovery codes securely. They are shown only once:');
  console.log(recovery.join('\n'));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
