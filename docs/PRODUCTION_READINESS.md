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

## Monitoring snapshot — 2026-10-23

This snapshot records observed repository state; it does not certify a release.

### Commit and check evidence

- PR #11 is closed/merged at `5ae9a221d24de01cde4517196020d8dda086ba1f`. Do not treat its historical checks as current-main verification.
- Latest inspected `main` commit: `4f0705d6379a196afb053e35806f257d71607543` (2026-10-21). No PR-triggered run was returned for this commit during this check.
- Open PR #15 head: `5cf8b81a765469fddf75844c2ce7561db42ce302`; compare against current `main` reports 10 commits ahead and 8 behind.
- On PR #15, [Production readiness run #73](https://github.com/ahsanibnewalid/managesocialmedia/actions/runs/39394723743) passed with 0 npm audit vulnerabilities; its test job skipped 4 DB/Redis-dependent tests because those services were not configured there.
- On PR #15, [Node.js checks run #186](https://github.com/ahsanibnewalid/managesocialmedia/actions/runs/39394723755) passed `npm ci`, typecheck, concurrent migration startup, repeatability, PostgreSQL/Redis integration tests (18 passed, 0 failed, 0 skipped), build, and legacy server/publishing syntax/import checks.
- The audit branch received CI-only commit `3aa49668a4c4809af8e31181e0e5f45368cdecf5` to trigger the Node.js workflow on this branch and run migrations concurrently on a clean CI database. That commit and this documentation update still require their own completed CI run. The production-readiness workflow trigger update was not applied.

### Outstanding gates — do not mark complete yet

- [ ] Run all required checks on the exact current audit-branch commit and the exact release candidate; separately verify current `main`.
- [ ] Restrict Stripe checkout to a server-side allowlist of Price IDs and fail closed for missing/cross-origin browser mutation Origin.
- [ ] Verify webhook events against authoritative Stripe session/subscription data, including payment status, workspace/customer association, approved price, amount, currency, and entitlement lifecycle. No real payments.
- [ ] Fix the migration runner ordering in the current follow-up candidate so migration-history-table creation is protected by the same advisory lock; test simultaneous fresh startup repeatedly.
- [ ] Resolve the duplicate baseline migration policy without editing/deleting migrations that may have been applied; test backup restore and forward recovery.
- [ ] Implement database-to-queue reconciliation for scheduled posts whose enqueue operation failed; remove runtime DDL from worker startup via a new migration.
- [ ] Implement and sandbox-test SSLCOMMERZ hosted checkout, IPN and server-side Order Validation, transaction idempotency, risk review, and server-side entitlement enforcement.
- [ ] Complete tenant/role negative tests for all Next.js routes/actions and worker paths; verify reverse-proxy trust and rate-limit behavior.
- [ ] Verify OAuth refresh/revocation and publishing with authorized test accounts for each enabled platform.
- [ ] Build the Android debug APK on the current candidate and retain the artifact; live login, cross-device draft sync, workspace data, scheduling, publishing, and analytics remain incomplete.
- [ ] Perform backup/restore, worker recovery, alerting/monitoring, health-check, deployment rollback, and migration-recovery drills in an isolated staging environment.

### Release decision

**Neither staging release approval nor production approval is supported by the evidence yet.** Use only an isolated engineering environment with synthetic data, checkout disabled or restricted to provider test mode, and no live social posts until the security and recovery gates above are verified.


## Monitoring snapshot — 2026-10-24

This snapshot reflects the source and workflow review performed before the documentation-only commits made to record it.

- Reviewed audit-branch/workflow commit: `f0bbebfbad587131f505dba1e741717cd5d4f407`; at review time the branch was 6 commits ahead and 16 behind current `main` (`4f0705d6379a196afb053e35806f257d71607543`). The documentation commits that follow this snapshot advance the branch again; check the current ref before using an exact-head status.
- PR #11 is closed; merge commit `5ae9a221d24de01cde4517196020d8dda086ba1f` was verified. Do not merge PR #11 again.
- PR #15 remains open at `5cf8b81a765469fddf75844c2ce7561db42ce302`, 10 commits ahead and 8 behind `main`.
- PR #15's latest available runs remain green: Production readiness #73 and Node.js checks #186. They do not certify current `main` or the audit branch.
- No PR-triggered workflow result was available for the audit branch head. The run lookup does not expose push-triggered runs, so the audit branch's latest CI result is **unverified**, not green.
- CI configuration was updated in this run so Production readiness runs on audit-branch pushes and provisions PostgreSQL/Redis for integration tests. The Node.js workflow already triggers on audit-branch pushes and tests concurrent migration startup. Verify the results on the final candidate commit before using them as release evidence.

## Release gates still open

- [ ] Restrict Stripe checkout to approved server-side Price IDs and reject missing/cross-origin browser mutation Origin.
- [ ] Verify authoritative Stripe payment/session/subscription, customer/workspace association, approved price, amount, currency, and entitlement lifecycle. No real payments.
- [ ] Resolve migration initialization locking in the PR #15 runner; define a safe irreversible-baseline/forward-recovery policy and test it on a disposable database.
- [ ] Implement DB-to-queue reconciliation for scheduled posts whose BullMQ enqueue failed; move worker runtime DDL into a versioned migration.
- [ ] Complete tenant/role negative tests across Next.js routes, server actions, and worker operations; verify trusted proxy/rate-limit behavior.
- [ ] Implement and sandbox-test SSLCOMMERZ hosted checkout, IPN, server-side Order Validation, idempotency, risk review, and entitlements.
- [ ] Verify authorized OAuth refresh/revocation and publishing for each enabled provider.
- [ ] Build and retain an Android APK from the final candidate; live login, cross-device drafts, workspace data, scheduling, publishing, and analytics remain incomplete.
- [ ] Complete backup/restore, worker recovery, alerting/monitoring, health-check, deployment rollback, and migration-recovery drills.

**Decision on 2026-10-24: NEITHER staging release approval nor production approval.** Use isolated engineering tests with synthetic data and checkout disabled or provider test-mode only. Do not deploy or charge real customers.
