# Tidepost agency SaaS business model and implementation roadmap

## Product direction

Tidepost should be owned and operated by the platform owner as a subscription SaaS. Paying agencies and social-media service providers use Tidepost to manage their own client businesses. Their clients are not the platform owner's direct customers by default.

**Commercial relationship**

1. **Tidepost platform owner:** owns the software, sets subscription prices and limits, operates billing/support, and protects platform-wide security.
2. **Agency subscriber:** pays Tidepost, creates an agency workspace, invites its staff, and manages its own client workspaces.
3. **Agency client:** sees only the content, approvals, connected accounts, and reports explicitly shared with that client.

Agency subscribers set their own service fees and contracts with their clients. Tidepost charges the agency its software subscription fee; the agency's client-service revenue belongs to the agency.

## Important release caveat

This document is a product and business roadmap, not a claim that the current code already supports all these capabilities. The repository currently documents provider live-testing gaps and an Android scaffold that is not yet connected to live workspace data. Do not sell a capability until its implementation and production behavior are verified.

## Product requirements

### 1. Platform owner control plane

Build a separate, strongly protected platform-owner area for:

- Subscription plan definitions, quotas, trials, grace periods, and account status.
- Agency tenant overview: plan, subscription state, workspace/client counts, usage, and last activity.
- Billing events, payment reconciliation, refunds/cancellations where supported, and invoice records.
- Support and operational audit trails.
- Service health, publishing queue health, provider failure rates, and background worker status.
- Abuse handling and account suspension with reason and audit record.
- Controlled support access that is time-limited, logged, and never silently bypasses tenant privacy.

Platform-owner authority must not mean routine access to every client's social tokens, passwords, or private content. Prefer metadata and audited support workflows; never expose provider tokens in the admin UI.

### 2. Agency tenant workspace

Each agency needs:

- Its own organization/tenant boundary and subscription.
- Team members with roles such as owner, administrator, manager, creator, approver, and read-only analyst.
- A client directory and a separate workspace for each client.
- Client-specific brand details, content calendars, social accounts, drafts, approvals, publishing history, and reports.
- Invite, remove, and role-change flows.
- Usage meters for seats, client workspaces, connected channels, scheduled posts, storage, and any paid add-ons.

Every tenant-owned record and every API operation must be authorized server-side. Never trust a client-supplied workspace ID alone. Add automated cross-tenant isolation tests before onboarding paying agencies.

### 3. Client collaboration

Allow an agency to invite a client contact into a restricted client portal, if enabled. The client should only be able to see its own brand's content and permitted reports, and optionally approve or request changes. Client access must not reveal the agency's other clients, internal notes, billing, or team administration.

### 4. Subscription and billing

Before charging customers through the product, implement and test:

- Server-side subscription state and entitlement checks.
- Checkout, payment confirmation using verified provider callbacks/webhooks, and idempotent event processing.
- Plan upgrades/downgrades, cancellation, failed-payment grace periods, invoices/receipts, and refund records as applicable.
- Enforcement of quotas on the server, not just disabled buttons in the UI.
- A clear account export/deletion process and retention rules.
- A manual invoicing/payment fallback during a small private pilot, if needed and legally appropriate.

Do not store raw card data. Choose a payment provider after confirming merchant eligibility, settlement, fees, refund support, and recurring-payment support for the target market.

### 5. Security and reliability release gates

- Verify tenant isolation for posts, accounts, analytics, media, jobs, audit events, invites, and billing.
- Use least-privilege roles and deny-by-default authorization.
- Protect platform-owner access with strong authentication and MFA where available.
- Keep OAuth tokens encrypted; redact secrets from logs and admin pages.
- Verify backups and restore procedures, rate limits, abuse controls, monitoring, and incident response.
- Test real authorized provider accounts and scheduled publishing failures/retries.
- Make the web app and worker report actual health; do not present placeholder counts as real metrics.
- Publish a privacy policy, terms, acceptable-use policy, data-processing disclosures, and clear cancellation/refund terms before public launch.

## Suggested implementation sequence

### Stage 0 — Validate the business (now)

- Interview 5–10 agency owners or freelancers.
- Ask how many clients and staff they manage, which platforms they use, what work they repeat, and what they currently pay for.
- Offer a small paid pilot using only verified Tidepost features plus manual processes where needed.
- Track the features they request repeatedly; avoid building based on assumptions alone.

### Stage 1 — Make the existing core safe and reliable

- Run typecheck, automated tests, and production build on the exact commit.
- Review authentication, session lifecycle, workspace membership checks, and authorization on every data route.
- Verify OAuth connect/disconnect/refresh and publish flows using approved test accounts.
- Fix high-severity security/reliability issues and document unsupported platform features.
- Keep the Android app explicitly in test/scaffold status until it authenticates and loads real server data.

### Stage 2 — Complete agency and client workspace model

- Define organization, membership, client workspace, role, invitation, and audit-event schema.
- Add server-side tenant-scoped access helpers and negative tests.
- Build agency client directory, staff roles, client-specific branding, approvals, and safe reporting.
- Add export and deletion flows.
- Do not proceed to paid multi-tenant launch until cross-tenant tests pass.

### Stage 3 — Add paid plans and owner console

- Implement plan/entitlement model, usage accounting, subscription lifecycle, and payment webhook verification.
- Build platform-owner views for plans, agency subscriptions, usage, health, and audit logs.
- Require strong authentication and log sensitive administrative actions.
- Test duplicate/out-of-order payment webhooks, cancellations, failed renewals, and quota enforcement.

### Stage 4 — Private beta, then public SaaS

- Invite 3–5 agencies with written pilot expectations.
- Monitor publishing success, support burden, retention, and actual infrastructure cost.
- Fix issues before increasing tenant count.
- Add public pricing and self-service onboarding only after the beta proves the main workflow and support model.

## Pricing hypotheses (not market research)

These are starting points for interviews, not validated market prices:

| Plan idea | Possible monthly price | Example limits to test |
|---|---:|---|
| Solo | ৳499 | 1 user, 3 client workspaces |
| Agency | ৳1,499 | 3 users, 10 client workspaces |
| Agency Pro | ৳3,999 | 10 users, 30 client workspaces |
| Custom | Discussed individually | Higher limits, custom support or onboarding |

Set limits based on actual provider/API costs, storage, job volume, support time, and customer interviews. Avoid promising unlimited channels or publishing if providers impose quotas or approval restrictions.

## Metrics to review monthly

- Paying agencies and recurring revenue.
- Trial-to-paid conversion and cancellation/churn.
- Active client workspaces per agency.
- Publishing success rate and failure recovery time.
- Median time to onboard an agency.
- Support requests per agency.
- Gross margin after hosting, queues, storage, payment fees, and support.
- Number of confirmed tenant-isolation and billing regression tests.

## Definition of ready to charge broadly

- [ ] Exact release commit passes typecheck, tests, production build, and reviewed dependency audit.
- [ ] Tenant isolation is tested for all sensitive resources and background jobs.
- [ ] Platform-owner routes are separated from agency roles and audited.
- [ ] Real provider flows have documented results for every advertised platform.
- [ ] Subscription webhooks and server-side plan enforcement are tested.
- [ ] Backup restore, monitoring, alerting, incident response, and account deletion are verified.
- [ ] Privacy, terms, pricing, billing, and cancellation pages are available.
- [ ] A private beta has demonstrated that agencies can onboard, serve clients, and renew successfully.

**North star:** Tidepost sells dependable agency workflow software. Agencies pay for the tools; agencies manage and charge their own clients. The platform owner earns recurring subscription revenue by delivering secure, useful, reliable software.
