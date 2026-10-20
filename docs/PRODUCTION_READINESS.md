# Production Readiness Runbook

This runbook is an evidence checklist, not a claim that every item is already complete. A green build is necessary but does not prove provider approval, production security, or reliable publishing.

## Release gate

Do not label a release production-ready until each required item has evidence recorded in the release/incident log.

- [ ] CI passes on the exact commit to be deployed: typecheck, automated tests, production build.
- [ ] Confirm `APP_URL` is the canonical external origin and that cookie-authenticated billing mutations reject missing or cross-origin `Origin` headers.
- [x] A committed lockfile exists and `npm ci` passed in GitHub Actions on the current audit-branch code commit; rerun on the final release commit.
- [ ] Dependency audit reviewed and all critical/high issues fixed or explicitly risk-accepted: `npm audit --omit=dev` and full `npm audit`.
- [ ] Secrets are set in the hosting secret manager, never committed to Git, logs, browser code, or screenshots.
- [ ] `NODE_ENV=production`; `APP_URL` is HTTPS and exactly matches each provider's registered callback.
- [ ] Use a high-entropy `JWT_SECRET` (32+ characters minimum; prefer 32 random bytes), and a separately generated base64 32-byte `SOCIAL_TOKEN_ENCRYPTION_KEY`.
- [ ] PostgreSQL backups are enabled, encrypted, and restore-tested. Use TLS verification for managed database connections.
- [ ] Redis is private, authenticated, persistent as appropriate, and reachable only by the app/worker.
- [x] Versioned schema migrations run as a controlled release step with a PostgreSQL advisory lock; API startup only verifies required tables and does not apply DDL.
- [ ] Test a production-like migration rehearsal, rollback/recovery procedure, and restore from a verified backup before release.
- [ ] Deploy the web app and publishing worker as separate processes; verify worker restarts, graceful shutdown, queue retry/backoff, and alerts.
- [ ] Configure HTTPS, security headers, rate limits, request-size limits, secure cookies, trusted-proxy settings, and a restrictive CORS policy where applicable. The reverse proxy must overwrite `X-Forwarded-For` for the Redis-backed auth limiter; expand rate-limit coverage to other sensitive routes.
- [ ] Verify workspace isolation and role-based authorization on every post, account, analytics, and publishing-attempt operation.
- [ ] Verify OAuth state/PKCE, exact redirect URI matching, least-privilege scopes, revocation/refresh behavior, and token redaction in logs.
- [ ] Test account connection and publish/refresh/revoke flows with authorized test accounts for every enabled platform. Record provider API version, scopes, results, and date.
- [ ] Test retries, partial multi-platform failures, worker crashes, expired tokens, duplicate jobs, and provider timeouts. Exactly-once delivery cannot be guaranteed where a provider lacks idempotency support.
- [ ] Validate scheduled publishing around time zones/DST, media URL accessibility, platform content restrictions, and post status recovery.
- [ ] Test analytics freshness, pagination, API quota/rate limits, and empty/permission-denied responses. LinkedIn analytics is not implemented; do not display fabricated values.
- [ ] Add monitoring for HTTP errors, DB/Redis health, queue age/depth, publishing failures, token errors, and backup failures; configure alert recipients.
- [ ] Capture genuine screenshots from the running release. Keep mockups labeled as illustrative.
- [ ] Run a documented rollback and database restore drill before broad release.

## Deploy-time smoke checks

1. Confirm the health/readiness endpoints reflect real dependency state rather than always returning success.
2. Register and sign in with a test account; confirm session expiry and logout.
3. CI now verifies cross-workspace HTTP read/create/edit/delete denial for the legacy API. Repeat these negative tests against every Next.js API route and server action in staging.
4. Connect a provider test account, publish a harmless test post, and verify provider-side result plus local audit/attempt records.
5. Schedule a test post and observe it through queued, processing, and terminal status.
6. Confirm logs contain no access tokens, secrets, passwords, or full OAuth callback query strings.
7. Restore a backup into an isolated database and verify expected records.

## Known caveats to resolve or consciously accept

- Provider integrations have not been live-verified by this development workflow without authorized provider credentials and grants.
- LinkedIn analytics is not implemented.
- Provider-side exactly-once publishing is not guaranteed on platforms without idempotency keys.
- Illustrative README images are not product screenshots.
