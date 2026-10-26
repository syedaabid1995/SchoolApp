# SAAPT SSH Operations Panel

The operations panel is served at `https://200.97.165.51:4174`. It is separate from the school admin application and uses individual server-operator email/password accounts. Email links only select/highlight an alert session; they do not authorize access or server actions.

## Components

- `ssh-login-alert.js` follows the SSH journal, records every opened session, and sends at most one successful-login email per source IP in a rolling five-minute window. Suppressed logins remain in the session inventory. SSH alert emails expire after 60 seconds in the outbox so stale alerts are discarded instead of replayed after a provider delay.
- `ssh-panel-server.js` serves the panel on `127.0.0.1:4173`, authenticates operators, applies idle/absolute session expiry, rate-limits login attempts, checks CSRF/origin, and proxies only typed operations.
- `ssh-ops-helper.js` is the root-owned privileged helper. It listens on a restricted Unix socket and supports only session listing/revocation, IP block and allowlist management, alert-link resolution, and audit listing. It accepts no shell command. Its `CAP_SYS_PTRACE` capability is limited to identifying and verifying the exact `sshd` process that owns a session socket; the helper's typed API remains the only exposed interface.
- `ssh-firewall.js` keeps active IPv4/IPv6 SSH blocks in nftables and restores them from the SQLite state at boot.
- `create-operator.js` provisions, resets, or disables individual panel accounts. Passwords are scrypt-hashed; routine password changes happen in the panel, and forgotten passwords are reset with a short-lived emailed OTP.

The helper verifies an exact `sshd` PID and process start time, account, peer IP, client port, and local port before offering/revoking a session. Sessions that cannot be matched are visible as not safely controllable. Blocking an address prevents future SSH connections; it does not terminate already-open sessions. Blocking the IP currently using the panel is refused.

The SSH allowlist is global by source IP and bypasses the email approval gate for any Linux account. Explicit enabled IP blocks are evaluated first and always override an allowlist entry. Removing an allowlist entry restores email approval for that address unless it remains blocked. The existing email-based SSH access approval remains available through the panel: an approval link is a locator only, operators must sign in with their email and password, and approval grants a 15-minute retry window while normal SSH key/password authentication remains required.

## Deployment checklist

Do not expose the panel until IP TLS, SMTP reset delivery, and the loopback-only service binding are verified.

1. Confirm the server's public IPv4 address is static and reachable on port 80 for ACME HTTP validation.
2. Install Certbot 5.4 or newer in an isolated environment. Request an IP certificate using the `shortlived` profile and HTTP webroot validation. IP certificates are valid for about six days and must be renewed automatically; install `ssh-ip-cert-renew.service` and its timer and verify the Nginx reload hook.
3. Expose HTTPS on port 4174, keep Node port 4173 loopback-only, and do not expose the Node service directly. Nginx must overwrite `Host`, `X-Real-IP`, and `X-Forwarded-For`; the panel trusts `X-Real-IP` only from its loopback reverse proxy.
4. Configure the panel mail settings in `/etc/saapt-ssh-panel/smtp.env`, owned by `root:sshops` with mode `0640`. It must contain `OPS_SMTP_HOST`, `OPS_SMTP_PORT`, `OPS_SMTP_FROM_EMAIL`, `OPS_SMTP_FROM_NAME`, `OPS_SMTP_USERNAME`, and `OPS_SMTP_PASSWORD`. Use the approved platform SMTP account; never commit these values.
5. Inspect the current firewall manager and nftables rules before enabling the SSH block sync unit. The sync installs a dedicated nftables table/rules for TCP port 22; keep a provider-console recovery path available.
6. Deploy the `ops/ssh-alert` directory to `/opt/saapt-ssh-alert`, preserving the existing `/var/lib/saapt-ssh-alert/actions.sqlite` and its queued email rows.
7. Create the non-login service identity and state directory:

   ```sh
   getent group sshops >/dev/null || groupadd --system sshops
   id -u sshops >/dev/null 2>&1 || useradd --system --gid sshops --home-dir /var/lib/saapt-ssh-panel --shell /usr/sbin/nologin sshops
   install -d -o sshops -g sshops -m 0700 /var/lib/saapt-ssh-panel
   ```

8. Install `ssh-action-server.service` as `/etc/systemd/system/saapt-ssh-action.service`, and `ssh-panel.service` as `/etc/systemd/system/saapt-ssh-panel.service`. Install the SMTP environment file before starting the panel. Set `OPS_PUBLIC_URL=https://200.97.165.51:4174` for SSH alert links. Confirm the deployed Node runtime supports `node:sqlite` (Node 22.5+; use the same supported Node 24 runtime as the existing service).
9. Install the Nginx operations configuration from `nginx-ops-panel.conf.example`, test with `nginx -t`, and reload Nginx. Remove the old public `/ssh-security` proxy route from `api.saapttech.com`. To keep already-sent links usable during migration, redirect only the old page paths to the new authenticated panel (the browser carries the original URL fragment):

   ```nginx
   location = /ssh-security/confirm { return 302 https://200.97.165.51:4174/sessions; }
   location = /ssh-security/access { return 302 https://200.97.165.51:4174/access; }
   ```

   Never keep proxying the old bearer-token action endpoint after cutover.
10. Enable and start the helper, panel, IP-certificate renewal timer, and existing login-alert services. Check `systemctl status`, `journalctl`, `/healthz`, and that port 4173 is bound only to loopback. The helper must have a Unix socket at `/run/saapt-ssh-alert/ops-helper.sock` owned by `root:sshops` with mode `0660`; it must not listen on a TCP port.
11. Provision the initial operator from an interactive SSH terminal. The command prompts without echoing the password and does not print any authenticator or recovery codes:

   ```sh
   sudo -u sshops env OPS_PANEL_DATA=/var/lib/saapt-ssh-panel \
     /home/deploy/.nvm/versions/node/v24.18.0/bin/node \
     /opt/saapt-ssh-alert/create-operator.js add operator@example.com
   ```

   Add a separate account per operator. Password changes and password recovery are self-service in the website. To disable an operator and revoke all their panel sessions, run the same command with `disable operator@example.com`.
12. Sign in from a non-server network using the operator email and password; verify the session list, block/unblock using a test source IP, revoke one test SSH connection, and confirm that another connection from the same IP remains open. Check the audit log for each action.
13. Verify forgotten-password OTP delivery, 10-minute expiry, one-time use, request throttling, and session revocation. Send one test SSH login and verify the mail link opens the IP URL, expires after one hour, and requires operator login. Make another connection from the same IP within five minutes and verify no second email is queued while the session still appears in the panel. Verify a login after five minutes can send a new alert.
14. Back up both state directories securely: `/var/lib/saapt-ssh-alert` and `/var/lib/saapt-ssh-panel`. Protect `password-reset.key` as a secret; losing it invalidates outstanding reset codes. Keep a documented operator recovery and server-console access procedure.

## Security assumptions and operational limits

- Hostinger's SMTP quota can still throttle other application mail or alerts from other IPs; per-IP suppression reduces SSH alert volume but is not a provider-quota guarantee. Keep the durable mail outbox and monitor its oldest queued message and `last_error`.
- The one-hour alert token is a session locator only. The panel authenticates the operator before it resolves the token or exposes any session data.
- The panel is publicly reachable and uses password-only login by request. This is single-factor authentication; HTTPS does not replace MFA. It uses scrypt password hashes, secure/HTTP-only/SameSite cookies, a 30-minute idle timeout, an 8-hour absolute timeout, eight failed logins per source IP per 15 minutes, and CSRF checks for state changes. Password reset codes are random, hashed at rest, single-use, expire after 10 minutes, and are rate-limited.
- Current session visibility is based on the event monitor's recorded SSH logins and exact live socket checks. If a login predates the monitor or cannot be reliably mapped, it is not presented as safely revocable.
- `ssh-firewall.js` applies blocks to new SSH traffic only. Do not promise that blocking an IP ends existing sessions; use the separate exact-session revoke action.
