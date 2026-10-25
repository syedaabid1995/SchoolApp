'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { openStore } = require('./ssh-action-store');

const nft = '/usr/sbin/nft';
const table = 'saapt_ssh_security';

function exists(args) {
  try { execFileSync(nft, args, { stdio: 'ignore' }); return true; } catch { return false; }
}

function ensureFirewall() {
  if (!exists(['list', 'table', 'inet', table])) execFileSync(nft, ['add', 'table', 'inet', table]);
  if (!exists(['list', 'set', 'inet', table, 'blocked_v4'])) {
    execFileSync(nft, ['add', 'set', 'inet', table, 'blocked_v4', '{', 'type', 'ipv4_addr', ';', '}']);
  }
  if (!exists(['list', 'set', 'inet', table, 'blocked_v6'])) {
    execFileSync(nft, ['add', 'set', 'inet', table, 'blocked_v6', '{', 'type', 'ipv6_addr', ';', '}']);
  }
  if (!exists(['list', 'chain', 'inet', table, 'input'])) {
    execFileSync(nft, ['add', 'chain', 'inet', table, 'input', '{', 'type', 'filter', 'hook', 'input', 'priority', '-10', ';', 'policy', 'accept', ';', '}']);
  }
  const chain = (() => {
    try { return execFileSync(nft, ['-a', 'list', 'chain', 'inet', table, 'input'], { encoding: 'utf8' }); } catch { return ''; }
  })();
  if (!chain.includes('saapt-ssh-block-v4')) {
    execFileSync(nft, ['add', 'rule', 'inet', table, 'input', 'tcp', 'dport', '22', 'ip', 'saddr', '@blocked_v4', 'drop', 'comment', 'saapt-ssh-block-v4']);
  }
  if (!chain.includes('saapt-ssh-block-v6')) {
    execFileSync(nft, ['add', 'rule', 'inet', table, 'input', 'tcp', 'dport', '22', 'ip6', 'saddr', '@blocked_v6', 'drop', 'comment', 'saapt-ssh-block-v6']);
  }
}

function syncFirewall(db) {
  ensureFirewall();
  const rows = db.prepare('SELECT ip FROM ssh_ip_blocks WHERE enabled = 1 ORDER BY ip').all();
  const v4 = rows.map(({ ip }) => ip).filter((ip) => ip.includes('.') && !ip.includes(':'));
  const v6 = rows.map(({ ip }) => ip).filter((ip) => ip.includes(':'));
  const commands = [
    `flush set inet ${table} blocked_v4`,
    `flush set inet ${table} blocked_v6`,
  ];
  if (v4.length) commands.push(`add element inet ${table} blocked_v4 { ${v4.join(', ')} }`);
  if (v6.length) commands.push(`add element inet ${table} blocked_v6 { ${v6.join(', ')} }`);
  const configPath = path.join('/var/lib/saapt-ssh-alert', `nft-sync-${process.pid}-${Date.now()}.conf`);
  try {
    fs.writeFileSync(configPath, `${commands.join('\n')}\n`, { flag: 'wx', mode: 0o600 });
    execFileSync(nft, ['-f', configPath]);
  } finally {
    try { fs.unlinkSync(configPath); } catch {}
  }
}

function syncFromStore() {
  const db = openStore();
  try { syncFirewall(db); } finally { db.close(); }
}

module.exports = { syncFirewall, syncFromStore };
