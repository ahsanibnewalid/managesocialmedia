# Full Production Readiness Audit

**Repository:** `ahsanibnewalid/managesocialmedia`  
**Base branch:** `main`  
**Audit branch:** `audit/full-production-readiness`  
**Baseline commit inspected:** `1cc03e4665452a2d0e105b4cdd74b6ea24a1328b`  
**Status:** In progress; not production-approved.

This report records evidence gathered during source review and distinguishes code changes from checks that have not been executed. It is not a penetration-test certificate.

## Baseline inventory

- Next.js App Router and TypeScript web app.
- PostgreSQL schema bootstrap through `npm run db:migrate`; the current script applies `db/schema.sql` as one SQL batch and is not a versioned migration framework.
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

- GitHub Actions run #27 (`39378480296`) passed dependency installation, dependency audit, TypeScript typecheck, automated tests, and production build on the branch's Next.js/PostCSS remediation. Node.js checks run #140 (`39378480553`) passed dependency installation, typecheck, `db:migrate`, tests, production build, and syntax/import checks for the Express API, publishing queue/adapters/worker, and API bridge. These checks passed before the latest documentation-only update.
- A repository `package-lock.json` was not found through the repository file endpoint, and CI currently uses `npm install`, not `npm ci`. Confirm lockfile state and add/commit a lockfile before relying on reproducible `npm ci` installs.
- A local clone could not be made in the execution environment because DNS resolution for `github.com` failed. The checks above were executed by GitHub Actions, not locally in this environment. The first dependency audit found one moderate Next.js advisory and one high PostCSS advisory. After raising Next.js to `^15.5.28` and overriding PostCSS to `^8.5.23`, the current CI audit reported **zero vulnerabilities** in both the full and production dependency trees. The generated lockfile was exported as a short-lived CI artifact for inspection but is not yet committed; CI still uses `npm install`, so deterministic `npm ci` remains outstanding. Android build has not been verified here.
- CI's `db:migrate` step passed, but no disposable PostgreSQL/Redis integration environment, migration rollback, restore drill, or production-data migration was independently verified.
- No real or sandbox SSLCOMMERZ payment was attempted. International payments are not verified or enabled. No real social accounts or live posts were used.

### Medium — Social-token encryption accepted non-canonical base64 and insufficiently validated envelopes

**Affected paths:** `lib/social-token-vault.ts` and `lib/services/socialPublisher.ts`.

**Evidence:** Both code paths decoded `SOCIAL_TOKEN_ENCRYPTION_KEY` using Node's permissive base64 decoder and checked only the decoded byte count. The publishing adapter also accepted loosely parsed envelope components and did not require exactly four ciphertext fields.

**Change on audit branch:** Both code paths now require canonical base64 encoding of an exact 32-byte key, validate the AES-GCM IV/tag/ciphertext encodings and lengths, require exactly four envelope fields, and validate decrypted token bundle shapes. Added regression tests for non-canonical keys and malformed token envelopes.

**Verification:** After correcting the test fixture, the current CI runs passed the complete automated test suite and production build (run #27) plus the database-migration, integration-enabled test, build and server syntax/import checks (run #140).

## Official SSLCOMMERZ documentation review

The current official SSLCOMMERZ developer documentation describes a hosted checkout session-creation step, an IPN listener, and server-to-server Order Validation API verification. It instructs merchants to match the provider transaction ID, expected amount, and currency before updating local order state; the documentation also says transactions flagged with `risk_level = 1` should be held for customer verification. The validation endpoint differs between sandbox and live environments.

Official references:
- [SSLCOMMERZ API v4 integration guide](https://developer.sslcommerz.com/doc/v4/index.html)
- [SSLCOMMERZ developer integration overview](https://developer.sslcommerz.com/)

This audit did not implement or execute a payment lifecycle. Dashboard credential storage is not checkout, and no sandbox transaction was run. A future implementation must use the official sandbox, validate callbacks server-to-server, compare transaction ID/amount/currency/status, handle risk flags, and make callbacks idempotent before granting entitlements.

## Remaining audit gates

1. Verify lockfile state and reproducible installation; CI typecheck, tests, build, and server syntax/import checks pass on the current branch head, but dependency audits and `npm ci` remain outstanding.
2. Run the schema bootstrap and integration tests only against a disposable PostgreSQL database; assess repeatability and failure recovery.
3. Audit every API route/server action and worker for tenant-scoped authorization, role checks, session behavior, CSRF, rate limiting, upload safety, and privileged owner access.
4. Add automated cross-tenant and insufficient-role regression tests.
5. Complete payment checkout only after consulting current official SSLCOMMERZ docs; use sandbox only and validate server-to-server before granting entitlements.
6. Implement server-side subscription/usage enforcement before accepting subscription payments.
7. Verify each social provider using authorized test accounts; do not claim LinkedIn analytics or exactly-once publishing.
8. Build the Android debug APK in CI and verify artifact upload; do not claim full integration while documented scaffold limitations remain.
9. Verify backup restoration, real dependency health checks, worker recovery, and production deployment settings.
10. Inspect actual GitHub Actions run results for the audit branch. Keep the PR unmerged if mandatory checks fail.

## Current status

**Not ready for production.** The audit branch contains targeted billing security hardening and regression tests, but the overall application, payment lifecycle, multi-tenant isolation, and deployment checks remain unverified. Reassess this status only after the remaining gates have recorded evidence.
