# Dashboard-managed payment credentials

## Two distinct uses of payment gateways

1. **Tidepost subscription billing:** the platform owner configures the merchant account that receives subscription payments from Tidepost customers. This is configured in the private platform-owner dashboard.
2. **Agency/organization billing:** an agency may configure its own gateway to collect payments from its own clients only if Tidepost later implements a separate client-billing product for that organization. Those funds belong to the agency, not Tidepost. These credentials must never be used to pay Tidepost subscription invoices.

The API foundation in this branch stores gateway credentials separately by scope:
- `scope_type='platform', scope_id=0`: platform owner gateway.
- `scope_type='organization', scope_id=<organization ID>`: agency/organization gateway.

## Dashboard entry and storage

- Owner settings endpoint: `GET/PUT /api/owner/billing/providers`.
- Organization settings endpoint: `GET/PUT /api/organization/billing/providers?organizationId=<id>`.
- Owner access is limited by `TIDEPOST_OWNER_EMAILS`, a comma-separated deployment-controlled allowlist. Never accept an owner role from public signup or request JSON.
- Organization settings require the caller to be a member with owner, admin or billing role.
- Credentials are encrypted with AES-256-GCM using `BILLING_CREDENTIALS_ENCRYPTION_KEY`, a dedicated base64-encoded 32-byte deployment secret. Generate with `openssl rand -base64 32`. It must be configured before saving any credentials.
- API responses return only whether credentials are configured, not their plaintext values.
- Do not log request bodies or credential values. Rotate credentials through an explicit replacement form; blank fields must not erase working credentials accidentally.
- The database records which credential field names changed in the audit event, not their values.

## Important limitations

This branch adds credential storage APIs, not checkout or merchant settlement. It does not yet implement the owner UI, agency UI, SSLCOMMERZ checkout/IPN/Order Validation API, international provider adapter, refunds, recurring billing, or customer subscription enforcement. Organization-level gateway settings are groundwork for a distinct future agency client-billing feature; they must not be presented as working agency checkout until that feature exists.

For Tidepost subscription payments, the gateway credentials configured by the platform owner are the credentials used for the Tidepost checkout integration. Organization-level credentials are never allowed to override them.
