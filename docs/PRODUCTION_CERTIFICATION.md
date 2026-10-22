# Production Certification

This document is the release gate for Tidepost Console. A green TypeScript build is not sufficient for production approval.

## Required gates

- [ ] Route/server-action authorization review completed
- [ ] Cross-tenant and insufficient-role regression tests pass
- [ ] CSRF/origin checks verified on cookie-authenticated mutations
- [ ] Authentication and privileged endpoint rate limits verified
- [ ] Database migration rehearsal, failure recovery, and backup restore verified
- [ ] Redis/BullMQ worker restart and recovery verified
- [ ] Payment sandbox lifecycle verified end-to-end
- [ ] Subscription entitlement/usage enforcement verified
- [ ] OAuth/connect/refresh/revoke/publish smoke tests completed for every enabled provider
- [ ] Provider-specific limitations documented; no unsupported exactly-once claims
- [ ] Android build and documented integration status verified
- [ ] Production deployment, health checks, monitoring, alerts, and rollback verified
- [ ] Secrets, TLS, cookie, security-header, and logging configuration reviewed
- [ ] Final production commit and CI evidence recorded

## Approval rule

Production approval is allowed only when every applicable gate above has evidence attached to the release/PR. Provider credentials, payment credentials, and production data must never be committed to this repository.
