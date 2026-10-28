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


## Monitoring snapshot — 2026-10-25

This snapshot reflects the current-main source review performed on 2026-10-25; it is not a release certification.

### Candidate and CI evidence

- Audit branch source head before this documentation update: `81e23dcf10b4fb87e4f1c40c3e183051f9f57504`; current `main`: `4f0705d6379a196afb053e35806f257d71607543`.
- GitHub compare reports the audit branch 8 commits ahead and 16 behind `main`. PR #11 is already closed/merged at `5ae9a221d24de01cde4517196020d8dda086ba1f`; do not merge it again.
- PR #15 head `5cf8b81a765469fddf75844c2ce7561db42ce302` has green available runs: Production readiness #73 (`39394723743`) and Node.js checks #186 (`39394723755`). Node.js checks passed 18 tests with PostgreSQL/Redis configured; the separate production-readiness job skipped four DB/Redis-dependent tests.
- No accessible PR-triggered workflow/status result was returned for the exact audit-branch head or current main. Push-triggered CI results for the latest audit-branch commit are **unverified**. Do not treat older PR checks as certification of current main or the exact release candidate.

### Newly verified source blockers on current main

- [ ] Stripe checkout must use a server-side allowlist of approved Price IDs and reject missing or cross-origin browser mutation Origin headers.
- [ ] Stripe webhook must verify authoritative payment/session/subscription data, customer/workspace association, approved price, amount and currency before granting an active entitlement. The current `requireActiveSubscription` trusts a row's `status='active'`.
- [ ] `npm run db:migrate` invokes `scripts/migrate.ts`, which does not acquire an advisory lock and creates/checks the migration-history table before applying migrations. The separate JavaScript runner's lock does not protect the configured TypeScript command.
- [ ] Duplicate baseline migration files have identical content; baseline down files are absent. Define a safe irreversible-baseline/forward-recovery policy and test backup restoration rather than adding destructive rollback.
- [ ] Reconcile scheduled posts persisted in PostgreSQL when BullMQ enqueue fails. Move `publish_attempts` DDL out of worker startup and into a versioned migration.
- [ ] Change Render's build install to deterministic lockfile-based installation after validating the build environment, and add separate dependency-aware readiness/monitoring for PostgreSQL, Redis and the worker.

### Existing gates still open

- [ ] Exact-head typecheck, tests, production build, full and production dependency audits, DB/Redis integration tests and concurrent migration test.
- [ ] Full tenant/role negative tests across Next.js routes/actions and worker operations; session expiry/logout, cookie and trusted-proxy/rate-limit verification.
- [ ] SSLCOMMERZ sandbox checkout, IPN, server-side Order Validation, idempotency, risk review and entitlement lifecycle.
- [ ] Authorized social OAuth refresh/revocation and publishing/retry tests for every enabled platform.
- [ ] Android APK built and retained from the exact candidate; live login, cross-device drafts, workspace data, scheduling, publishing and analytics remain incomplete.
- [ ] Backup/restore, migration recovery, worker restart/reconciliation, monitoring/alerts and deployment rollback drills.

**Decision on 2026-10-25: NEITHER staging release approval nor production approval.** Use isolated engineering tests with synthetic data and provider test mode only. Do not deploy, charge real customers, or publish live social posts until the relevant gates are verified.


## Monitoring snapshot — 2026-10-26

### Exact refs and CI evidence

- Audit branch head before this documentation update: `6ba2fa7cba03064de13b0b7cc39751ffd07bb2b3`; inspected `main`: `4f0705d6379a196afb053e35806f257d71607543`.
- GitHub compare reports the audit branch 10 commits ahead and 16 behind `main`. Do not use results from this diverged branch to certify current `main`.
- PR #11 is recorded as closed/merged at `5ae9a221d24de01cde4517196020d8dda086ba1f`; no merge was performed in this run.
- PR #15 head `5cf8b81a765469fddf75844c2ce7561db42ce302`: latest accessible runs remain Production readiness #73 (`39394723743`) and Node.js checks #186 (`39394723755`), both successful on 2026-10-20. Node.js job logs show 18 tests passed, 0 failed, 0 skipped with PostgreSQL/Redis configured; production-readiness logs show 18 tests with 4 skipped for unavailable DB/Redis integration services. Dependency audit output reported 0 vulnerabilities; production build completed.
- The run lookup returned no PR-triggered workflow run or combined status context for the exact audit branch head. Push-triggered CI for that exact commit is **unverified**.

### Release blockers re-confirmed on current main

- [ ] Stripe checkout must reject unapproved client-supplied Price IDs and fail closed on missing or mismatched Origin.
- [ ] Stripe webhook must verify authoritative payment/session/subscription, customer/workspace association, approved price, amount, currency and lifecycle before granting an entitlement.
- [ ] Fix the configured `scripts/migrate.ts` runner so migration-table initialization and migration application are serialized by the same advisory lock.
- [ ] Define a safe irreversible-baseline/forward-recovery policy for duplicate initial migration files and missing baseline down migrations; verify backup restoration.
- [ ] Reconcile scheduled database posts whose BullMQ enqueue failed; move `publish_attempts` DDL into a versioned migration.
- [ ] Add dependency-aware health/readiness checks for PostgreSQL, Redis and the worker; validate deterministic lockfile-based deployment installation.
- [ ] Align README billing claims with the fact that Stripe endpoints exist but payment verification/entitlements are not production-certified.
- [ ] Complete tenant/role negative tests across Next.js routes, server actions and workers; session/cookie/proxy/rate-limit verification.
- [ ] Complete SSLCOMMERZ sandbox checkout, IPN, server-side Order Validation, idempotency, risk review and entitlements.
- [ ] Verify authorized OAuth refresh/revocation and publishing/retry behavior for each enabled provider.
- [ ] Build and retain an Android APK from the exact release candidate; live login/workspace/scheduling/publishing/analytics integration remains incomplete.
- [ ] Complete backup/restore, migration recovery, worker restart/reconciliation, alerting/monitoring and deployment rollback drills.

**Decision on 2026-10-26: NEITHER staging release approval nor production approval.** Use isolated engineering tests with synthetic data and provider test mode only. Do not deploy, charge real customers, or publish live social posts until the relevant gates are verified.


## Monitoring snapshot — 2026-10-27

### Exact refs and CI evidence

- Audit branch code head reviewed before these documentation-only commits: `952d7a10685921a705f1cc12294b229ada764883`; current `main`: `4f0705d6379a196afb053e35806f257d71607543`. GitHub compare reports the audit branch 12 commits ahead and 16 behind `main`.
- PR #11 is already closed/merged at `5ae9a221d24de01cde4517196020d8dda086ba1f`; no merge was performed. Open PR #15 head is `5cf8b81a765469fddf75844c2ce7561db42ce302`, 10 commits ahead and 8 behind `main`.
- Latest accessible PR #15 checks remain [Production readiness #73](https://github.com/ahsanibnewalid/managesocialmedia/actions/runs/39394723743) and [Node.js checks #186](https://github.com/ahsanibnewalid/managesocialmedia/actions/runs/39394723755), both successful on 2026-10-20. Run #73 reported zero dependency vulnerabilities but skipped four DB/Redis-dependent tests. Run #186 passed `npm ci`, typecheck, concurrent migration startup, migration repeatability, PostgreSQL/Redis tests (18 passed, 0 failed, 0 skipped), build, and server/publishing syntax/import checks.
- The build log contains a non-fatal missing optional BullMQ `@valkey/valkey-glide` module warning. CI also warns about Node.js 20 deprecation in checkout/setup actions and Redis memory overcommit.
- The available workflow-run/status tools return no PR-triggered result for the exact audit head or current `main`; push-triggered CI is **unverified**, not green or failed. Require fresh results on the exact candidate.

### Release gates confirmed open

- [ ] Stripe checkout: server-side allowlist of approved Price IDs; reject missing/cross-origin browser mutation Origin.
- [ ] Stripe webhook/entitlements: validate authoritative payment/session/subscription, customer/workspace association, approved price, amount, currency, and lifecycle before activating access. No real payments.
- [ ] Migration locking: current `main`'s configured `scripts/migrate.ts` has no advisory lock; PR #15 locks migration application but initializes `schema_migrations` before taking the lock. Serialize initialization and migration work in the actual release candidate and repeatedly test simultaneous fresh-database startup.
- [ ] Baseline recovery: duplicate initial migration files have identical content and baseline down files are absent. Adopt an irreversible-baseline/forward-recovery policy and test backup restoration; do not add destructive rollback.
- [ ] Publishing: reconcile scheduled database rows whose BullMQ enqueue failed; move `publish_attempts` schema creation out of worker startup and into a migration.
- [ ] Health/deployment: current `/api/health` is process-only, not dependency readiness; validate database/Redis/worker health and use deterministic lockfile-based deployment installation.
- [ ] Authentication/session and tenant isolation: expand negative tests to every Next.js route, server action, and worker; verify logout/expiry/cookies, role enforcement, trusted-proxy behavior, and rate limits.
- [ ] SSLCOMMERZ: sandbox checkout, IPN, server-side Order Validation, idempotency, risk review, and server-side entitlements.
- [ ] Social providers: authorized OAuth refresh/revocation and publishing/retry tests for each enabled provider.
- [ ] Android: build and retain an APK from the exact release candidate; live login, workspace data, cross-device drafts, scheduling, publishing, and analytics remain incomplete.
- [ ] Operations: backup/restore, migration recovery, worker restart/reconciliation, alerts/monitoring, and deployment rollback drills.

**Decision on 2026-10-27: NEITHER staging release approval nor production approval.** Use isolated engineering tests with synthetic data, checkout disabled or provider test mode only, and no live social posts until the relevant gates are verified.


## Monitoring snapshot — 2026-10-28

### Verified repository/check state

- PR #11 is closed and merged at `5ae9a221d24de01cde4517196020d8dda086ba1f`; this monitoring run did not merge or deploy.
- GitHub compare reports the audit branch **14 ahead / 16 behind** current `main` at `4f0705d6379a196afb053e35806f257d71607543`. The last exact audit-branch SHA recorded before this documentation update was `f2b57a2111f94819671cf7fcc889888465ff5321`; the available branch-search interface did not expose a fresh ref SHA.
- PR #15 remains open and unmerged. Latest accessible runs: [Production readiness #73](https://github.com/ahsanibnewalid/managesocialmedia/actions/runs/39394723743) and [Node.js checks #186](https://github.com/ahsanibnewalid/managesocialmedia/actions/runs/39394723755), both passed on 2026-10-20.
- Job logs verify **18/18 passing tests** in the PostgreSQL/Redis Node.js job and **14 passed / 4 skipped / 0 failed** in the separate production-readiness job. The latter skipped DB/Redis-dependent cases. The install log reported zero vulnerabilities and the dependency-audit step passed.
- No status contexts or PR-triggered runs were returned for the last recorded audit SHA or current `main`. Push-triggered CI for the exact latest refs remains **unverified**.

### Release gates — still open

- [ ] Stripe checkout: server-controlled allowlist of approved Price IDs; reject missing and cross-origin browser mutation Origin.
- [ ] Stripe webhook/entitlements: verify authoritative payment/session/subscription, customer/workspace association, approved price, amount, currency, and lifecycle before activating access; add regression tests for unpaid sessions and mismatched associations.
- [ ] Migration runner: serialize initialization and migration application in the configured `scripts/migrate.ts`; repeatedly test simultaneous fresh startup.
- [ ] Baseline recovery: document the duplicate initial migration files and missing baseline down files; use a safe irreversible-baseline/forward-recovery policy and verify backup restoration.
- [ ] Publishing: reconcile scheduled database rows whose BullMQ enqueue failed; move `publish_attempts` DDL into a versioned migration; test Redis outage and worker restart recovery.
- [ ] Auth/tenant isolation: test session expiry/logout/cookies, trusted-proxy and rate-limit behavior, and negative tenant/RBAC access across every Next.js route, server action, and worker path.
- [ ] SSLCOMMERZ: sandbox checkout, IPN, server-side Order Validation, idempotency, risk review, and subscription entitlements.
- [ ] Social providers: authorized OAuth refresh/revocation, publishing/retry and uncertain-outcome recovery tests for each enabled provider.
- [ ] Android: produce and retain an APK from the exact candidate; verify live login, workspace data, scheduling, publishing, and analytics integration.
- [ ] Operations: dependency-aware health/readiness, deterministic lockfile-based deployment install, backup/restore, worker recovery, monitoring/alerts, and rollback drills.

**Decision on 2026-10-28: NEITHER staging release approval nor production approval.** Use isolated engineering tests with synthetic data, checkout disabled or provider test mode only, and no live social posts until these gates are verified.
