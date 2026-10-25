# SAAPT SSH Operations Panel

The operations panel is served at `https://ops.saapttech.com`. It is separate from the school admin application and uses individual server-operator accounts with password plus TOTP MFA. Email links only select/highlight an alert session; they do not authorize access or server actions.

## Components

- `ssh-login-alert.js` follows the SSH journal, records every opened session, and sends at most one successful-login email per source IP in a rolling five-minute window. Suppressed logins remain in the session inventory.
- `ssh-panel-server.js` serves the panel on `127.0.0.1:4173`, authenticates operators, applies idle/absolute session expiry, rate-limits login attempts, checks CSRF/origin, and proxies only typed operations.
- `ssh-ops-helper.js` is the root-owned privileged helper. It listens on a restricted Unix socket and supports only session listing/revocation, IP block management, alert-link resolution, and audit listing. It accepts no shell command.
- `ssh-firewall.js` keeps active IPv4/IPv6 SSH blocks in nftables and restores them from the SQLite state at boot.
- `create-operator.js` provisions or disables individual panel accounts. Passwords are scrypt-hashed, TOTP secrets are AES-GCM encrypted at rest, and single-use recovery codes are generated at setup.

The helper verifies an exact `sshd` PID and process start time, account, peer IP, client port, and local port before offering/revoking a session. Sessions that cannot be matched are visible as not safely controllable. Blocking an address prevents future SSH connections; it does not terminate already-open sessions. Blocking the IP currently using the panel is refused.

The existing email-based SSH access approval remains available through the panel: an approval link is a locator only, operators must sign in with MFA, and approval grants a 15-minute retry window while normal SSH key/password authentication remains required.

## Deployment checklist

Do not expose the panel until every restricted-access item below is configured.

1. Create an `A` record for `ops.saapttech.com` pointing to the SAAPT server. Obtain a valid TLS certificate for that hostname.
2. Choose a server-team VPN/management CIDR. Add the real CIDR to `nginx-ops-panel.conf.example` in place of `REPLACE_WITH_SERVER_TEAM_VPN_CIDR`; leave `deny all` enabled. Do not expose the panel to the public internet. If the server team has no VPN, establish one before enabling the virtual host.
3. Confirm Nginx is the TLS terminator and does not sit behind an untrusted proxy. It must overwrite `Host`, `X-Real-IP`, and `X-Forwarded-For`; the panel trusts `X-Real-IP` only from its loopback reverse proxy.
4. Inspect the current firewall manager and nftables rules before enabling the SSH block sync unit. The sync installs a dedicated nftables table/rules for TCP port 22; keep a provider-console recovery path available.
5. Deploy the `ops/ssh-alert` directory to `/opt/saapt-ssh-alert`, preserving the existing `/var/lib/saapt-ssh-alert/actions.sqlite` and its queued email rows.
6. Create the non-login service identity and state directory:

   ```sh
   getent group sshops >/dev/null || groupadd --system sshops
   id -u sshops >/dev/null 2>&1 || useradd --system --gid sshops --home-dir /var/lib/saapt-ssh-panel --shell /usr/sbin/nologin sshops
   install -d -o sshops -g sshops -m 0700 /var/lib/saapt-ssh-panel
   ```

7. Install `ssh-action-server.service` as `/etc/systemd/system/saapt-ssh-action.service`, and `ssh-panel.service` as `/etc/systemd/system/saapt-ssh-panel.service`. Install or update `ssh-login-alert.service` with `OPS_PUBLIC_URL=https://ops.saapttech.com`. Confirm the deployed Node runtime supports `node:sqlite` (Node 22.5+; use the same supported Node 24 runtime as the existing service).
8. Install the Nginx operations virtual host from `nginx-ops-panel.conf.example`, set certificate paths, replace the VPN CIDR, test with `nginx -t`, and reload Nginx. Remove the old public `/ssh-security` proxy route from `api.saapttech.com`. To keep already-sent links usable during migration, redirect only the old page paths to the new authenticated panel (the browser carries the original URL fragment):

   ```nginx
   location = /ssh-security/confirm { return 302 https://ops.saapttech.com/sessions; }
   location = /ssh-security/access { return 302 https://ops.saapttech.com/access; }
   ```

   Never keep proxying the old bearer-token action endpoint after cutover.
9. Enable and start the helper, panel, and existing login-alert services. Check `systemctl status`, `journalctl`, `/healthz`, and that port 4173 is bound only to loopback. The helper must have a Unix socket at `/run/saapt-ssh-alert/ops-helper.sock` owned by `root:sshops` with mode `0660`; it must not listen on a TCP port.
10. Provision the first named operator from an interactive SSH terminal. The command prompts without echoing the password and prints an authenticator URI plus recovery codes once:

   ```sh
   sudo -u sshops env OPS_PANEL_DATA=/var/lib/saapt-ssh-panel \
     /home/deploy/.nvm/versions/node/v24.18.0/bin/node \
     /opt/saapt-ssh-alert/create-operator.js add operator@example.com
   ```

   Add a separate account per operator. Keep recovery codes in the approved password vault. To disable an operator and revoke all their panel sessions, run the same command with `disable operator@example.com`. To rotate a locked-out operator's password, authenticator, and recovery codes, use `reset operator@example.com`; this also revokes that operator's current panel sessions.
11. Sign in from the VPN with password and TOTP; verify the session list, block/unblock using a test source IP, revoke one test SSH connection, and confirm that another connection from the same IP remains open. Check the audit log for each action.
12. Send one test SSH login and verify the mail link opens `ops.saapttech.com`, expires after one hour, and requires operator login/MFA. Make another connection from the same IP within five minutes and verify no second email is queued while the session still appears in the panel. Verify a login after five minutes can send a new alert.
13. Back up both state directories securely: `/var/lib/saapt-ssh-alert` and `/var/lib/saapt-ssh-panel`. Protect `mfa.key` as a secret; restoring the database without this key makes stored authenticator secrets unreadable. Keep a documented operator recovery and server-console access procedure.

## Security assumptions and operational limits

- Hostinger's SMTP quota can still throttle other application mail or alerts from other IPs; per-IP suppression reduces SSH alert volume but is not a provider-quota guarantee. Keep the durable mail outbox and monitor its oldest queued message and `last_error`.
- The one-hour alert token is a session locator only. The panel authenticates the operator before it resolves the token or exposes any session data.
- The panel uses a restrictive CSP, secure/HTTP-only/SameSite cookies, a 30-minute idle timeout, an 8-hour absolute timeout, eight failed logins per source IP per 15 minutes, and a CSRF token for state changes.
- Current session visibility is based on the event monitor's recorded SSH logins and exact live socket checks. If a login predates the monitor or cannot be reliably mapped, it is not presented as safely revocable.
- `ssh-firewall.js` applies blocks to new SSH traffic only. Do not promise that blocking an IP ends existing sessions; use the separate exact-session revoke action.
