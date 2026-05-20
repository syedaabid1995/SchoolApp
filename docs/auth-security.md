# Auth Security

This document describes the current login, remember-me, token, forgot-password, reset-password, rate-limit, audit-log, and session-management behavior.

## 1. Login Flow

Login is handled by the backend auth API:

- `POST /api/v1/auth/login`
- Backward-compatible route: `POST /api/auth/login`

The request is validated with Zod. The login request accepts:

- `email` or `username`
- `password`
- `schoolCode` or `schoolId` where tenant login is required
- optional `rememberMe`
- optional `loginType`

The backend checks:

- The school exists when a school identifier is provided.
- The user belongs to the selected school.
- The user is active.
- The school is active or only payment-restricted.
- The password matches the stored bcrypt hash.
- The selected login type matches the user's role.
- Teacher and parent accounts pass their profile activity checks.

All login failures return the same public error:

```json
{
  "error": {
    "message": "Invalid login details. Please try again."
  }
}
```

Internal logs may keep the detailed rejection reason. The API response does not reveal whether the user, password, school, role, or status caused the failure.

## 2. Remember Me Behavior

Remember Me is a client-side convenience option. It may store only safe identifiers:

- email or username
- school code or school id
- `rememberMe: true`

It must never store the password.

When Remember Me is enabled, the backend issues a longer-lived refresh token session. When it is disabled, the refresh session uses the normal shorter refresh lifetime.

## 3. Why Password Is Never Stored In localStorage

Passwords are long-term credentials. Browser storage such as `localStorage`, `sessionStorage`, IndexedDB, and non-httpOnly cookies can be read by JavaScript. If an XSS bug exists, an attacker could steal anything stored there.

For that reason:

- Passwords are submitted only during login, change password, or reset password.
- Passwords are never persisted in browser storage.
- Remember Me stores only non-secret identifiers.
- Tokens are handled separately from saved form fields.

## 4. Token Storage Approach

The backend issues:

- an access token
- a refresh token

The refresh token is set in an httpOnly cookie by the backend. The frontend must not store the refresh token in `localStorage`.

Current login responses still include token values for compatibility with existing clients. The browser cookie path is the preferred secure path for refresh handling.

## 5. Access Token Expiry

Access tokens are short-lived.

Current expiry:

```text
15 minutes
```

The backend also sets an `access_token` httpOnly cookie during refresh.

## 6. Refresh Token Session Storage

Refresh tokens are database-backed through the `RefreshSession` model.

Stored session fields include:

- user id
- optional school id
- SHA-256 hash of the refresh token
- user agent
- IP address
- device name when detected
- expiry time
- revoked time
- created time
- last used time

Only the token hash is stored. The raw refresh token is never stored in the database.

## 7. Logout Revocation

Logout is handled by:

- `POST /api/v1/auth/logout`

Logout reads the refresh token from the httpOnly cookie, hashes it, finds the matching `RefreshSession`, and sets `revokedAt`.

Logout also clears auth cookies:

- `access_token`
- `refresh_token`
- `accessToken`
- `refreshToken`

The API returns success even if the token is missing or already revoked.

## 8. Forgot-Password Flow

Forgot password is handled by:

- `POST /api/v1/auth/forgot-password`

The request is validated with Zod and accepts:

- `email`
- optional `schoolCode`
- optional `schoolId`
- optional `loginType`

The public response is always the same:

```json
{
  "message": "If an account exists, password reset instructions have been sent."
}
```

This prevents account enumeration. If a valid active user exists and belongs to the selected school, the backend creates a reset token record and sends or logs the reset link depending on environment support.

If no email service is configured:

- Development may log the reset link for local testing.
- Production must not expose the raw reset token in the API response.

## 9. Reset-Token Expiry And Single-Use Rule

Reset password is handled by:

- `POST /api/v1/auth/reset-password`

The reset token is cryptographically random. The database stores only its SHA-256 hash in `PasswordResetToken`.

Rules:

- Reset tokens expire after 15 minutes.
- Reset tokens are single-use.
- Used tokens are rejected.
- Expired tokens are rejected.
- Missing or invalid tokens return the same public error:

```json
{
  "error": {
    "message": "Invalid or expired reset token."
  }
}
```

On successful reset:

- The user password hash is updated with bcrypt.
- The reset token is marked used.
- Older unused reset tokens for the same user are invalidated.
- Active refresh sessions for the user are revoked.
- Auth cookies are cleared if present.

## 10. Rate Limiting Rules

Login rate limits:

- 5 failed attempts per email and school scope per 15 minutes
- 20 attempts per IP per 15 minutes

Forgot-password rate limits:

- 3 requests per email and school scope per hour
- 10 requests per IP per hour

Redis is used for rate limiting when available. In local development, the implementation can fall back to in-memory counters if Redis is unavailable.

The public rate-limit response is:

```json
{
  "error": {
    "message": "Too many attempts. Please try again later."
  }
}
```

Accounts are not permanently locked by these limits.

## 11. Audit Log Events

Auth actions are connected to the existing audit log module when a user actor is known.

Current audit events:

- `LOGIN_SUCCESS`
- `LOGIN_FAILED`
- `LOGOUT`
- `LOGOUT_ALL`
- `FORGOT_PASSWORD_REQUEST`
- `PASSWORD_RESET_SUCCESS`
- `PASSWORD_RESET_FAILED`
- `PASSWORD_CHANGE_SUCCESS`
- `REFRESH_TOKEN_USED`
- `REFRESH_TOKEN_REVOKED`
- `RATE_LIMIT_TRIGGERED`

Audit metadata may include:

- user id
- school id
- event type
- IP address
- user agent
- timestamp
- safe action metadata

Audit metadata must never include:

- password
- raw refresh token
- raw reset token
- token hash
- authorization header
- cookie value
- secret

For unknown-user login or forgot-password attempts, the current `AuditLog` model cannot create a database row because `actorId` is required. Those cases are logged safely through the application logger with masked identifiers.

## 12. Session Management

Session management endpoints:

- `GET /api/v1/auth/sessions`
- `DELETE /api/v1/auth/sessions/:sessionId`
- `POST /api/v1/auth/logout-all`

All session management routes require authentication.

Users can view their active refresh sessions, revoke one session, or log out from all devices. Users cannot revoke another user's sessions.

Session responses expose safe device information only:

- session id
- device name
- masked IP address
- user agent
- created time
- last used time
- current session flag when detectable

## 13. Test Cases

Automated auth security tests are in:

```text
backend/src/controllers/__tests__/auth.security.test.ts
```

Run them with:

```bash
cd backend
npm run test:auth
```

Covered cases:

- Login success works.
- Wrong password returns a generic error.
- Non-existing user returns a generic error.
- Disabled user returns a generic error.
- User from school A cannot login to school B.
- Remember Me does not store password in `localStorage`.
- Logout revokes the refresh session.
- Revoked refresh token cannot be used.
- Forgot password always returns the generic message.
- Forgot password creates a token only for a valid user.
- Reset password works with a valid token.
- Reset password rejects expired tokens.
- Reset password rejects used tokens.
- Reset password revokes existing sessions.
- Old password no longer works after reset.
- New password works after reset.
- Rate limit blocks repeated login attempts.

The tests mock Prisma and Redis in memory. No email mock is required because the current implementation does not have a production email adapter and logs reset links only in development.

## 14. Future Improvement

Add MFA for high-privilege roles:

- `SUPER_ADMIN`
- `SCHOOL_ADMIN`

Recommended MFA approach:

- Require MFA after password verification and before issuing refresh sessions.
- Store MFA challenge state server-side with short expiry.
- Support TOTP or WebAuthn for admin accounts.
- Add backup code support.
- Audit MFA success, failure, setup, disable, and recovery-code use.
