# Full Production Readiness Audit

**Repository:** `ahsanibnewalid/managesocialmedia`  
**Base branch:** `main`  
**Audit branch:** `audit/full-production-readiness`  
**Baseline commit inspected:** `1cc03e4665452a2d0e105b4cdd74b6ea24a1328b`  
**Status:** In progress; not production-approved.

This report records evidence gathered during source review and distinguishes code changes from checks that have not been executed. It is not a penetration-test certificate.

## Baseline inventory

- Next.js App Router and TypeScript web app.
- At baseline, `npm run db:migrate` applied `db/schema.sql` as one unversioned batch. The audit branch now adds numbered SQL migrations with checksums, per-migration transactions, a PostgreSQL advisory lock, and repeatability checks.
- Redis/BullMQ scheduled publishing worker.
- Legacy Express API entry point.
- Provider adapters for Facebook Pages, Instagram image posts, LinkedIn text posts, X text posts, and TikTok video posts, subject to provider permissions and account eligibility.
- Android Kotlin/Jetpack Compose companion. The README says drafts remain local and live login, workspace data, scheduling, publishing, and analytics are incomplete.
- SaaS organization, plan, subscription, transaction, webhook-event, audit, and billing-credential schema foundations.
- Checkout, payment verification, subscription entitlement enforcement, and international payment processing are not represented as complete in the baseline documentation.

## Confirmed findings

### Medium — Cookie-authenticated billing settings mutations lacked explicit origin validation

**Affected paths**
- `app/api/owner/billing/providers/route.ts` — `PUT`
- `app/api/organization/billing/providers/route.ts` — `PUT`

**Evidence:** The inspected handlers authenticated users and applied owner/organization role checks, but did not validate the request `Origin` before updating credentials. SameSite cookies are useful defense in depth, but explicit same-origin validation reduces CSRF exposure for these sensitive state-changing endpoints.

**Change on audit branch:** Added `lib/trusted-origin.ts` and `lib/request-origin.ts`; both PUT handlers now reject requests unless their Origin matches the configured canonical `APP_URL` origin. The helper fails closed when Origin or APP_URL is absent or malformed. Added unit regression cases in `tests/trusted-origin.test.ts`.

**Verification:** The regression test is committed on the audit branch. GitHub Actions run #15 (`39377201098`) on the current audit-branch head passed dependency installation, TypeScript typecheck, automated tests, and production build. This is CI evidence, not a live security test.

### Medium — Billing credential encryption-key parsing accepted non-canonical base64 input

**Affected path:** `lib/billing-credentials.ts`

**Evidence:** The prior implementation relied on `Buffer.from(value, "base64")` and checked only decoded length. Node's base64 decoder can tolerate malformed input, so length alone is not a strict encoding validation.

**Change on audit branch:** Require canonical base64 for exactly 32 bytes, validate AES-GCM IV and authentication-tag lengths, validate ciphertext encoding, and validate the decrypted credential object shape. Decryption still fails closed if authentication fails or the key is wrong.

**Verification:** The current-head GitHub Actions run #15 completed the repository's automated test suite and production build successfully. This does not by itself prove all cryptographic edge cases or runtime behavior.

### Medium — Billing credential payload accepted arbitrary field names

**Affected paths:** Owner and organization billing provider PUT handlers.

**Evidence:** The request schema accepted arbitrary string keys in the credentials object. The handlers now allow only the SSLCOMMERZ fields `storeId` and `storePassword`; unsupported fields are rejected. International checkout remains disabled.

**Verification:** Current-head automated tests and production build passed in GitHub Actions run #15. Dedicated route-level tests and live provider integration remain unverified.

### High — Release evidence is incomplete

- GitHub Actions Production readiness run #59 (`39380574235`) passed dependency installation, enforced full/production dependency audit, TypeScript typecheck, automated tests, and production build. Node.js checks run #172 (`39380574226`) passed `npm ci`, typecheck, `db:migrate` twice (repeatability), tests against configured PostgreSQL/Redis services, production build, and syntax/import checks for the Express API, publishing queue/adapters/worker, and API bridge. The HTTP tenant-isolation test passed as part of the Node.js test suite.
- A committed `package-lock.json` (lockfile v3) is now present. Both CI workflows use `npm ci`; the current Node.js checks passed `npm ci` on the committed lockfile.
- A local clone could not be made in the execution environment because DNS resolution for `github.com` failed. The checks above were executed by GitHub Actions, not locally in this environment. The first dependency audit found one moderate Next.js advisory and one high PostCSS advisory. After raising Next.js to `^15.5.28` and overriding PostCSS to `^8.5.23`, the current enforced CI audit reported **zero vulnerabilities** in both the full and production dependency trees. The resolved lockfile is committed and `npm ci` has passed. CI now tests actual cross-tenant HTTP reads and writes against a disposable PostgreSQL/Redis environment. Migration rollback/recovery, backup restore, and Android build have not been verified.
- CI's `db:migrate` step passed, but no disposable PostgreSQL/Redis integration environment, migration rollback, restore drill, or production-data migration was independently verified.
- No real or sandbox SSLCOMMERZ payment was attempted. International payments are not verified or enabled. No real social accounts or live posts were used.

### Medium — Social-token encryption accepted non-canonical base64 and insufficiently validated envelopes

**Affected paths:** `lib/social-token-vault.ts` and `lib/services/socialPublisher.ts`.

**Evidence:** Both code paths decoded `SOCIAL_TOKEN_ENCRYPTION_KEY` using Node's permissive base64 decoder and checked only the decoded byte count. The publishing adapter also accepted loosely parsed envelope components and did not require exactly four ciphertext fields.

**Change on audit branch:** Both code paths now require canonical base64 encoding of an exact 32-byte key, validate the AES-GCM IV/tag/ciphertext encodings and lengths, require exactly four envelope fields, and validate decrypted token bundle shapes. Added regression tests for non-canonical keys and malformed token envelopes.

**Verification:** After correcting the test fixture, the current CI runs passed the complete automated test suite and production build (run #27) plus the database-migration, integration-enabled test, build and server syntax/import checks (run #140).

### High — Database changes were applied as an unversioned schema batch

**Affected paths:** `scripts/migrate.js`, `db/schema.sql`, and database release procedure.

**Evidence:** The baseline migration script applied the entire schema in one batch, without migration history, checksums, or protection against concurrent migration processes. This made schema-change review and repeatability difficult to prove.

**Change on audit branch:** Added `db/migrations/001_initial_schema.sql` and a versioned migration runner that records filename/checksum/applied time, runs each migration in a transaction, uses a PostgreSQL advisory lock, skips previously applied migrations, and refuses to run if an applied migration's checksum changes. The legacy `db/schema.sql` is marked retired. CI now runs `npm run db:migrate` twice against disposable PostgreSQL to prove the second run skips the applied migration.

**Verification:** Node.js checks run #172 passed both migration runs, the integration test suite, and build. Production-readiness run #59 passed typecheck, tests, dependency audit and build. Production migration rehearsal, rollback testing, and backup restore are still outstanding.

### High — The legacy API applied schema DDL on every startup

**Affected path:** `server/index.js`.

**Evidence:** The legacy server embedded a second copy of the database schema and executed it during startup, including dropping and recreating the `posts` status constraint. That duplicated `db/schema.sql`, blurred the migration boundary, and could create unnecessary table locks or concurrent-startup races.

**Change on audit branch:** Removed the embedded DDL. The server now checks that required tables exist and tells operators to run `npm run db:migrate` before starting if the schema is missing. The schema migration is a controlled deployment step rather than an implicit startup side effect.

**Verification:** Current CI run #50 passed the production build and automated tests; Node.js checks run #163 passed the migration command, the HTTP tenant-isolation integration test (which starts the API after migration), build, and server syntax/import checks. A versioned migration framework and rollback/recovery testing remain outstanding.

### High — Legacy Express runtime dependencies were missing from the declared package manifest

**Affected path:** `package.json` and the legacy Express server entry point `server/index.js`.

**Evidence:** The HTTP tenant-isolation integration test initially failed on a clean CI install because `server/index.js` could not resolve `express`. The legacy server also imports `helmet` and `express-rate-limit`, which were not declared direct dependencies. Syntax checks alone did not detect the runtime startup failure.

**Change on audit branch:** Added `express`, `helmet`, and `express-rate-limit` as declared runtime dependencies and regenerated/committed `package-lock.json`. Both CI workflows use `npm ci` against the committed lockfile.

**Verification:** Node.js checks run #163 passed `npm ci`, schema migration, the end-to-end HTTP tenant-isolation test, production build, and server syntax/import checks. Production-readiness run #50 also passed typecheck, tests, build and the zero-vulnerability dependency audit.

### Medium — App Router login and registration actions lacked shared rate limiting

**Affected path:** `app/actions/auth.ts` (Next.js server actions).

**Evidence:** The legacy Express API has authentication rate limits, but the App Router login and registration server actions did not apply equivalent controls before database lookups and password hashing. Server actions can be invoked directly, so the UI alone is not a protective boundary.

**Change on audit branch:** Added atomic Redis-backed sliding-window counters keyed by a SHA-256 digest of the normalized email and, when supplied by the reverse proxy, the client IP. Login is limited to 10 attempts per 15 minutes and registration to 8 attempts per hour for each dimension. The limiter fails closed in production if Redis is unavailable and returns a safe user-facing message. The reverse proxy must overwrite `X-Forwarded-For`; the implementation uses the last forwarded hop to reduce spoofing risk. Added unit tests for counter increments, dimensions and invalid configuration.

**Verification:** Production-readiness run #50 and Node.js checks run #163 passed typecheck, automated tests, and production build after this change. The Node.js workflow also has configured Redis/PostgreSQL services. A live multi-instance/proxy deployment test remains outstanding.

## Official SSLCOMMERZ documentation review

The current official SSLCOMMERZ developer documentation describes a hosted checkout session-creation step, an IPN listener, and server-to-server Order Validation API verification. It instructs merchants to match the provider transaction ID, expected amount, and currency before updating local order state; the documentation also says transactions flagged with `risk_level = 1` should be held for customer verification. The validation endpoint differs between sandbox and live environments.

Official references:
- [SSLCOMMERZ API v4 integration guide](https://developer.sslcommerz.com/doc/v4/index.html)
- [SSLCOMMERZ developer integration overview](https://developer.sslcommerz.com/)

This audit did not implement or execute a payment lifecycle. Dashboard credential storage is not checkout, and no sandbox transaction was run. A future implementation must use the official sandbox, validate callbacks server-to-server, compare transaction ID/amount/currency/status, handle risk flags, and make callbacks idempotent before granting entitlements.

## Remaining audit gates

1. Current CI passes committed-lockfile `npm ci`, typecheck, tests, build, server syntax/import checks and dependency audits on the verified code commit. Test migration rollback/recovery and restore from backup before release.
2. Run the schema bootstrap and integration tests only against a disposable PostgreSQL database; assess repeatability and failure recovery.
3. Audit every API route/server action and worker for tenant-scoped authorization, role checks, session behavior, CSRF, rate limiting, upload safety, and privileged owner access.
4. Add automated cross-tenant and insufficient-role regression tests.
5. Complete payment checkout only after consulting current official SSLCOMMERZ docs; use sandbox only and validate server-to-server before granting entitlements.
6. Implement server-side subscription/usage enforcement before accepting subscription payments.
7. Verify each social provider using authorized test accounts; do not claim LinkedIn analytics or exactly-once publishing.
8. Build the Android debug APK in CI and verify artifact upload; do not claim full integration while documented scaffold limitations remain.
9. Verify backup restoration, real dependency health checks, worker recovery, and production deployment settings.
10. Inspect actual GitHub Actions run results for the audit branch. Keep the PR unmerged if mandatory checks fail.

## Monitoring update — 2026-10-23

### Repository and pull-request state

- PR #11 is **closed and merged** at `5ae9a221d24de01cde4517196020d8dda086ba1f`. This monitor did not merge it. The audit branch is no longer the head of an open PR.
- The most recent inspected `main` commit is `4f0705d6379a196afb053e35806f257d71607543` (2026-10-21).
- Open follow-up PR #15 is `production-certification-hardening`, head `5cf8b81a765469fddf75844c2ce7561db42ce302`. GitHub comparison reports the branch diverged from current `main`: 10 commits ahead and 8 behind, with merge base `89cc507a4eee6b0b3ccce99d5c4fa56f7467e9e2`.
- The audit branch received a CI-only commit `3aa49668a4c4809af8e31181e0e5f45368cdecf5` to enable a concurrent migration-startup check on pushes to this branch. The Node.js workflow is configured to run on the audit branch. The production-readiness workflow trigger change was blocked and was not applied.
- Existing PR #11 runs #62 and #175 passed on the old audit head `64d197be66c8ddb55a52ad7a3814be92c88ea988`; those runs do not verify the new CI-only commit. The latest inspected PR #15 runs are [Production readiness #73](https://github.com/ahsanibnewalid/managesocialmedia/actions/runs/39394723743) and [Node.js checks #186](https://github.com/ahsanibnewalid/managesocialmedia/actions/runs/39394723755), both successful on the PR #15 head on 2026-10-20. No current-main PR-triggered runs were returned for commit `4f0705d6379a196afb053e35806f257d71607543`; current-main CI is therefore not certified by this check.

### Verified CI evidence

- PR #15 run #186 passed `npm ci`, TypeScript typecheck, concurrent migration startup, migration repeatability, PostgreSQL/Redis integration tests, production build, and legacy server/publishing syntax/import checks. Its test summary was 18 passed, 0 failed, 0 skipped.
- PR #15 run #73 passed install, dependency audit, typecheck, tests, and production build. Both full and production npm audits reported zero vulnerabilities. That job ran 18 tests with 14 passing and 4 skipped because PostgreSQL/Redis services were not configured in that job; run #186 provides the configured integration evidence.
- Both build logs contain non-fatal warnings: unresolved optional BullMQ dependency `@valkey/valkey-glide`, Node's deprecated `punycode` module, and a GitHub Actions Node.js 20 deprecation warning for `actions/checkout@v4` and `actions/setup-node@v4`. The successful build does not make these warnings release blockers by themselves, but the optional dependency warning should be confirmed against the intended Redis deployment.
- The audit-branch CI-only commit is not yet verified by a completed run at the time of this report update.

### Confirmed blockers on the current follow-up candidate

1. **Stripe checkout price/origin validation:** `app/api/billing/checkout/route.ts` accepts a client-supplied `priceId` without a server-side plan/price allowlist. It rejects a mismatched Origin only when the header exists, so a missing Origin is accepted.
2. **Stripe entitlement grant:** `checkout.session.completed` can mark a workspace subscription active based on event fields without retrieving and verifying the authoritative checkout session/subscription and matching payment status, Stripe customer, workspace, approved price, amount, and currency. A valid webhook signature proves event authenticity, not that the expected payment entitles the workspace to the requested plan.
3. **Migration initialization race on PR #15:** `scripts/migrate.ts` calls `ensureMigrationsTable(pool)` before acquiring the advisory lock inside `applyUp`/`applyDown`. Concurrent fresh starts can race while creating `schema_migrations`. The PR #15 concurrency CI step passed once, but the ordering in source remains unsafe. The older audit-branch `scripts/migrate.js` acquires its lock before creating the history table; these are different implementations and must not be treated as equivalent.
4. **Duplicate baseline migrations:** `0001_initial.sql` and `001_initial_schema.sql` on the follow-up candidate have the same Git blob hash, and CI logs show both being applied. No matching down migration exists for either baseline file. Do not delete or rewrite migrations that may already be recorded in deployed databases; define an explicit irreversible-baseline/adoption policy and test restore/forward recovery instead.
5. **Publishing recovery:** the scheduled-post action commits the post before adding its BullMQ job. If enqueue fails, it returns a message that the database row remains scheduled and needs queue recovery. No automatic database-to-queue reconciliation loop was found in the inspected worker/queue path. The worker also creates `publish_attempts` schema objects at startup; move this responsibility into a versioned migration.
6. **Provider and billing completeness:** SSLCOMMERZ hosted checkout, IPN handling, server-to-server Order Validation, transaction idempotency, risk review, and server-side subscription/usage enforcement remain unverified/incomplete. No sandbox payment lifecycle was executed.
7. **Authentication and tenant isolation:** CI covers JWT validation/rate limiting and the legacy Express API's cross-workspace HTTP denial. Equivalent negative tests for every Next.js route/server action and worker operation, privileged-role boundaries, and real reverse-proxy IP-header behavior remain outstanding.
8. **OAuth and Android:** token vault tests pass, but authorized-account OAuth refresh/revocation/publish flows have not been verified. The Android guide confirms local-only drafts and incomplete live login, workspace data, scheduling, publishing, and analytics. No Android APK build was verified for the current PR #15 head.
9. **Operations:** encrypted backups, restore drills, production-like migration recovery, worker crash/restart recovery, monitoring/alerts, deployment rollback, and production health-check behavior still need environment-backed evidence.

## Current status

**Not ready for staging release or production.** An isolated engineering environment may be used with synthetic data, customer-facing checkout disabled or test-mode only, and no live social posts. PR #11 is already merged; do not treat its old checks as evidence for current `main` or the divergent PR #15 candidate. Do not deploy or charge real customers until the billing and migration blockers are corrected and the required checks pass on the exact release candidate.


## Monitoring snapshot — 2026-10-24

This snapshot reflects the source and workflow review performed before the documentation-only commits made to record it. It is not a release certification.

### Repository and PR state

- Reviewed audit-branch/workflow commit: `f0bbebfbad587131f505dba1e741717cd5d4f407`. At this point in the run, the branch was 6 commits ahead and 16 behind current `main` (`4f0705d6379a196afb053e35806f257d71607543`). The three monitoring updates in this run cover CI configuration and the two audit documents; documentation commits made after this snapshot will advance the branch again.
- PR #11 is closed (closed 2026-10-20 06:53:23 UTC). Commit `5ae9a221d24de01cde4517196020d8dda086ba1f` is confirmed as the merge commit for PR #11. Do not merge it again.
- PR #15 remains open. Its head `5cf8b81a765469fddf75844c2ce7561db42ce302` matches `production-certification-hardening`; that branch is 10 commits ahead and 8 behind current `main`.

### Checks and CI configuration

- Latest available PR-triggered Production readiness run #73 (`39394723743`) completed successfully.
- Latest available PR-triggered Node.js checks run #186 (`39394723755`) completed successfully.
- Both runs belong to PR #15's head, not the audit branch or current `main`.
- The commit-run lookup returned no PR-triggered runs for audit head `520aa29...`, and the combined-status endpoint returned no status contexts. The workflow-run connector only exposes PR-triggered runs, so the push-triggered audit-branch result could not be independently retrieved. Treat the latest audit-branch CI result as **unverified** until the run URL/result is available.
- In this run, `.github/workflows/production-readiness.yml` was updated to run on pushes to `audit/full-production-readiness` and to provision PostgreSQL 16 and Redis 7 for tests. This should prevent DB/Redis integration tests from being skipped in that workflow. `.github/workflows/node.yml` already triggers on audit-branch pushes and runs concurrent migration startup plus repeatability checks. The new push-triggered results still need to be verified.
- The latest available PR #15 Node.js evidence was 18 passing tests with PostgreSQL/Redis configured. Its separate production-readiness job had 14 passing tests and 4 skipped DB/Redis-dependent tests. The previous full and production dependency audits reported zero vulnerabilities.

### Findings and blockers

- Stripe checkout on PR #15 accepts a client-supplied price without a server-side approved-price allowlist and accepts a missing Origin header. The webhook can activate an entitlement without authoritative verification of payment status, subscription/customer/workspace association, approved price, amount, and currency.
- In PR #15's `scripts/migrate.ts`, creation of `schema_migrations` occurs before the advisory lock; concurrent first-run initialization can race. The audit branch's `scripts/migrate.js` does acquire its lock before creating the table, but it is not the same migration runner as PR #15's.
- Duplicate baseline migrations and missing baseline down files require an explicit irreversible-baseline/forward-recovery policy, not a destructive rollback.
- Scheduled posts can be persisted before BullMQ enqueue succeeds; automatic DB-to-queue reconciliation was not found. The worker also performs runtime DDL for `publish_attempts`.
- Full Next.js route/action and worker tenant/role negative tests, SSLCOMMERZ sandbox lifecycle, authorized social OAuth/publishing tests, current-candidate Android APK, backup/restore, worker recovery, alerts, deployment rollback, and production smoke tests remain unverified.

### Changes in this run

- Added an audit-branch push trigger and PostgreSQL/Redis services to the production-readiness workflow so its integration tests can execute instead of being skipped.
- Updated this report and `docs/PRODUCTION_READINESS.md` to record verified repository state and remaining release gates.
- No application source fix was applied: the concrete Stripe checkout/webhook and `scripts/migrate.ts` findings are on the divergent PR #15 candidate. Copying those changes into the stale audit branch would not safely fix the candidate that needs certification.

### Release decision

**Neither staging release approval nor production approval is supported.** Keep real checkout disabled or test-mode only, use synthetic data in isolated engineering tests, and do not publish live social posts until the relevant verification gates pass.


## Monitoring snapshot — 2026-10-25

This snapshot records source and CI evidence inspected on 2026-10-25. It is not a release certification.

### Repository and pull-request state

- Source head reviewed before this documentation update: `81e23dcf10b4fb87e4f1c40c3e183051f9f57504` on `audit/full-production-readiness`.
- Current `main` inspected: `4f0705d6379a196afb053e35806f257d71607543`.
- GitHub compare reports the audit branch as 8 commits ahead and 16 behind `main`; the merge base is `64d197be66c8ddb55a52ad7a3814be92c88ea988`.
- PR #11 is already closed/merged at `5ae9a221d24de01cde4517196020d8dda086ba1f`. It was not merged in this run and must not be merged again.
- PR #15 remains the open hardening follow-up at `5cf8b81a765469fddf75844c2ce7561db42ce302`, but its candidate is divergent from current `main`.

### Checks observed

- PR #15 Production readiness run #73 (`39394723743`) completed successfully. All job steps, including dependency audit, typecheck, tests and production build, reported success.
- PR #15 Node.js checks run #186 (`39394723755`) completed successfully. The job passed `npm ci`, typecheck, concurrent migration startup, migration repeatability, tests, production build and legacy API/publishing syntax/import checks.
- In the Node.js run, the test step reported 18 passing tests, no failures and no skips with PostgreSQL/Redis configured. The separate production-readiness job reported 14 passing tests and 4 DB/Redis-dependent skips because its job did not configure those services.
- The earlier PR #15 dependency-audit job reported zero vulnerabilities in the full and production dependency trees. This is not a new audit result for the current `main` or audit-branch head.
- The connector returned no PR-triggered workflow runs or status contexts for audit head `81e23dcf10b4fb87e4f1c40c3e183051f9f57504`, and no PR-triggered run/status for current `main` `4f0705d6379a196afb053e35806f257d71607543`. The available run lookup filters to PR-triggered runs, so push-triggered CI on the audit branch is **unverified**, not presumed absent or successful.
- The production-readiness workflow in the audit branch now triggers on audit-branch pushes and provisions PostgreSQL 16 and Redis 7; the Node.js workflow also triggers on that branch and runs concurrent migration checks. These workflow edits still need an accessible successful run on the exact post-update commit.

### Newly verified findings on current main

**High — Stripe checkout trusts a client-supplied price.** In `app/api/billing/checkout/route.ts` on current `main`, the request schema accepts any non-empty `priceId`; the handler forwards it to Stripe without an approved server-side price allowlist. The origin guard rejects a mismatched Origin only when the header is present, so a missing Origin is accepted. No real payment was attempted.

**High — Stripe webhook can grant an active entitlement without authoritative payment verification.** In `app/api/billing/webhook/route.ts`, a signed `checkout.session.completed` event can cause the workspace subscription row to be written with status `active` based on metadata/client reference. The handler does not retrieve the authoritative Stripe session/subscription or verify payment status, customer/workspace association, approved price, amount and currency before activation. `lib/requireSubscription.ts` grants access when a row's status is `active`, so this gap affects entitlement enforcement. Signature validation and retry-aware event deduplication exist, but they do not replace these checks.

**High — The migration command used by package scripts does not serialize migration startup.** Current `package.json` maps `npm run db:migrate` to `tsx scripts/migrate.ts`. That TypeScript runner calls `ensureMigrationsTable(pool)` before applying migrations and has no PostgreSQL advisory lock. A separate `scripts/migrate.js` contains a lock, but it is not the command configured by `db:migrate`. Do not treat the legacy JavaScript runner's lock as evidence that the configured migration command is serialized.

**Medium — Duplicate baseline migration content and rollback gaps.** On current `main`, `db/migrations/0001_initial.sql` and `db/migrations/001_initial_schema.sql` have the same Git blob SHA (`d29e6b64538cc810aa903e3a25b84c8277b11712`). The TypeScript runner's `--down` path expects a matching `.down.sql`; baseline down files are absent. Do not add a destructive baseline rollback. Define an explicit irreversible-baseline/forward-recovery policy and test recovery from a verified backup.

**Medium — Scheduled posts can be stranded when queue insertion fails.** `app/actions/createPost.ts` commits the scheduled post to PostgreSQL before calling BullMQ. If enqueue fails, it returns a message that the record remains scheduled and needs queue recovery. No automatic database-to-queue reconciliation was identified in the inspected path. `server/publishing-worker.js` also creates `publish_attempts` schema objects during startup; move that DDL into a versioned migration.

**Medium — Render build install is not strict-lockfile installation.** Current `render.yaml` uses `npm install` despite a committed lockfile. Prefer `npm ci` for deterministic deployment installs after confirming the Render build environment has the dependencies needed for typecheck/build. The health-check route was added to main via PR #18, but a process-only health response is not evidence that PostgreSQL, Redis or the worker are healthy.

### Other release gates still open

- Complete tenant/role negative tests for every Next.js route, server action and worker path; verify session/cookie settings and trusted reverse-proxy behavior.
- Implement and sandbox-test SSLCOMMERZ checkout, IPN and server-side Order Validation, transaction idempotency, risk review, subscription lifecycle and entitlements.
- Test OAuth state/PKCE, refresh, revocation and publishing with authorized test accounts for every enabled provider.
- Build and retain an Android APK from the exact candidate; live login, cross-device draft sync, workspace data, scheduling, publishing and analytics are still incomplete.
- Complete backup/restore, migration recovery, worker restart/reconciliation, monitoring/alerts, dependency-aware health checks and deployment rollback drills.
- Re-run dependency audit and all required checks on the exact release candidate. The available zero-vulnerability result is from PR #15's older candidate, not current main.

### Changes in this run

- Updated this report with current-main source findings and distinguished historical PR #15 CI success from unverified exact-head checks.
- No application code was changed. The audit branch is 16 commits behind current main and lacks the current-main Stripe checkout/webhook files, so transplanting a billing fix into this stale branch would not safely remediate the release candidate. PR #11 was not merged, and no deployment or real payment was attempted.

### Release decision — 2026-10-25

**Neither staging release approval nor production approval is supported.** Use isolated engineering tests with synthetic data; keep customer-facing checkout disabled or restricted to provider test mode; do not publish live social posts until the relevant verification gates pass.
