# Tidepost SaaS ownership, billing and launch gates

## Business model

Tidepost is the platform vendor. Agencies, creators, celebrities, freelancers, individuals and businesses subscribe to Tidepost. An agency may separately bill its own clients; that revenue is not Tidepost revenue. Client users only receive explicitly granted access to a workspace, content, connected accounts and reports.

## What this branch adds

- Additive PostgreSQL tables for plan definitions, SaaS organizations and roles, subscriptions, billing transactions, webhook idempotency, and platform audit events.
- The tables are included in the initial versioned migration under `db/migrations/`; future schema changes must be added as new numbered migrations and applied with `npm run db:migrate`.
- Server-only SSLCOMMERZ environment variable placeholders in `.env.example`.
- No real payment is accepted by this schema-only foundation. It does not yet implement checkout/API routes, callback validation, recurring renewals, refunds, owner UI, or subscription enforcement. Do not launch or charge users based on this change alone.

## Organization and role model

- `saas_organizations.kind`: agency, individual, creator, celebrity, business.
- `saas_organization_members.role`: owner, admin, manager, editor, analyst, billing, client_viewer.
- `saas_organizations.status` is an operational state, not proof of payment. Access decisions must check the organization and a valid subscription/entitlement on the server.
- `billing_plans.limits` and `features` are JSON objects for product limits and feature entitlements. Validate their shape in application code; never accept a plan price or limit from the browser.
- Amounts use integer minor units to avoid floating-point money errors. BDT 499.00 is stored as 49900 minor units.

## Payment architecture and required safeguards

### SSLCOMMERZ (Bangladesh)

1. Create a pending billing transaction on the server from an active plan's stored price and the authenticated organization.
2. Generate a unique merchant transaction ID and create a hosted checkout session using server-only store credentials.
3. Store the expected amount, currency, organization, plan and provider transaction ID before redirecting.
4. Process both return URLs and IPN server-side. A browser redirect is not proof of payment.
5. Call the official Order Validation API from the server; verify transaction ID, valid status, amount, currency, and expected order. Hold risk-flagged transactions for review.
6. Process notifications idempotently, record the webhook event, and only activate/update entitlements in a database transaction after successful validation.
7. Never log store passwords, full payment payloads containing sensitive fields, or secrets. Use sandbox credentials first.

Official documentation: https://developer.sslcommerz.com/doc/v4/index.html

### International gateway

The code must not assume that a particular gateway can onboard a Bangladesh-established business. Before selecting one, confirm supported business country, KYC, settlement bank/currency, supported customer countries, recurring subscription support, webhook signature verification, refund/dispute handling and fees. Implement a provider adapter only after that choice is confirmed. Until then, international automatic checkout is intentionally disabled rather than simulated.

### Shared subscription rules

- Subscription state is updated only by trusted server-side payment validation or an audited owner action.
- Unique provider transaction IDs and webhook event IDs prevent duplicate callback processing.
- Reconcile pending payments and expired subscriptions with a scheduled server-side job.
- Use an explicit grace period for failed renewals, then restrict paid features without deleting customer content.
- Cancellation stops future renewal where the provider supports it; refunds are a separate audited action.
- Enforce plan limits at every relevant API and worker boundary, not just in UI.
- Do not store card numbers or CVV. Use hosted checkout.
- Never let ordinary support/admin tools reveal social tokens or customer passwords.

## Owner console requirements

Private owner-only routes should support:
- Summary: paying organizations, MRR/ARR estimates, failed/pending payments, churn and provider health.
- Plans: price, currency, billing interval, feature flags, limits, publish/deactivate with audit history.
- Organizations: kind, owner, plan, subscription state, usage, suspend/reactivate with a required reason.
- Transactions: provider reference, amount/currency, validated state, refunds/reconciliation state.
- Audit: immutable actor/action/time/target records; avoid sensitive payloads.
- System operations: job health, provider status, failed queue jobs, backup/restore status and incident notes.

The owner role must be provisioned securely by a one-time administrative process or trusted deployment configuration. Do not let a public signup field grant platform-owner privileges.

## Customer-facing product requirements

- Signup/login, email verification and account recovery.
- Choose an individual/creator/celebrity/business/agency account type.
- Plan comparison, checkout, billing history, invoices/receipts and cancellation.
- Agency teams, role-based access, client workspaces, client approval portal and branded reports.
- Creator/celebrity workflows for multiple brands, content calendar, drafts, approvals and supported social account connections.
- Usage meter and clear warnings before a plan limit is reached.
- Data export/deletion, privacy policy, terms, support contact and transparent renewal/cancellation terms.

## Rollout sequence

1. Apply schema in a disposable/test database and verify migrations are repeatable.
2. Implement and test authentication/authorization for organization and owner routes.
3. Implement SSLCOMMERZ sandbox checkout, IPN and Order Validation API; test duplicates, forged callbacks, mismatched amount/currency, risk flags, timeout and out-of-order callbacks.
4. Implement server-side entitlements, usage enforcement, renewal/reconciliation jobs and audit logging.
5. Build owner console and subscriber billing pages.
6. Choose and implement an eligible international provider; do not market it as available until sandbox and live merchant tests pass.
7. Complete tenant-isolation tests, dependency review, backups and restore drill, monitoring, privacy/legal review, and authorized live social-provider tests.
8. Invite a small private beta. Enable live payments only after every release gate has recorded evidence.

## Current release status

This is a schema/configuration foundation, not a finished payment implementation. It has not been demonstrated to pass the project build/tests or a real SSLCOMMERZ sandbox transaction in this branch. Keep the existing production-readiness checklist authoritative: `docs/PRODUCTION_READINESS.md`.
