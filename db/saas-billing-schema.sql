-- Tidepost SaaS billing foundation. Additive and safe to re-run.
-- Provider callbacks must be validated server-to-server before changing subscription state.
CREATE TABLE IF NOT EXISTS billing_plans (
 id BIGSERIAL PRIMARY KEY,
 code TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 currency CHAR(3) NOT NULL CHECK (currency IN ('BDT','USD','EUR','GBP')),
 interval TEXT NOT NULL CHECK (interval IN ('month','year')),
 amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
 limits JSONB NOT NULL DEFAULT '{}'::jsonb,
 features JSONB NOT NULL DEFAULT '{}'::jsonb,
 active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saas_organizations (
 id BIGSERIAL PRIMARY KEY,
 name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('agency','individual','creator','celebrity','business')),
 owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','past_due','suspended','cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saas_organizations_owner_idx ON saas_organizations(owner_user_id);
CREATE TABLE IF NOT EXISTS saas_organization_members (
 organization_id BIGINT NOT NULL REFERENCES saas_organizations(id) ON DELETE CASCADE,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK (role IN ('owner','admin','manager','editor','analyst','billing','client_viewer')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY (organization_id,user_id)
);
CREATE TABLE IF NOT EXISTS saas_subscriptions (
 id BIGSERIAL PRIMARY KEY,
 organization_id BIGINT NOT NULL REFERENCES saas_organizations(id) ON DELETE RESTRICT,
 plan_id BIGINT NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('incomplete','trialing','active','past_due','paused','cancelled','expired')),
 provider TEXT NOT NULL CHECK (provider IN ('sslcommerz','international_manual')),
 provider_customer_id TEXT,
 provider_subscription_id TEXT,
 currency CHAR(3) NOT NULL CHECK (currency IN ('BDT','USD','EUR','GBP')),
 amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
 interval TEXT NOT NULL CHECK (interval IN ('month','year')),
 current_period_start TIMESTAMPTZ,
 current_period_end TIMESTAMPTZ,
 cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
 cancelled_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saas_subscriptions_org_status_idx ON saas_subscriptions(organization_id,status);
CREATE INDEX IF NOT EXISTS saas_subscriptions_period_idx ON saas_subscriptions(status,current_period_end);
CREATE TABLE IF NOT EXISTS billing_transactions (
 id BIGSERIAL PRIMARY KEY,
 subscription_id BIGINT REFERENCES saas_subscriptions(id) ON DELETE RESTRICT,
 organization_id BIGINT NOT NULL REFERENCES saas_organizations(id) ON DELETE RESTRICT,
 provider TEXT NOT NULL CHECK (provider IN ('sslcommerz','international_manual')),
 provider_transaction_id TEXT NOT NULL,
 provider_validation_id TEXT,
 status TEXT NOT NULL CHECK (status IN ('created','pending','paid','failed','cancelled','refunded','review')),
 currency CHAR(3) NOT NULL CHECK (currency IN ('BDT','USD','EUR','GBP')),
 amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
 raw_status TEXT,
 validated_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(provider,provider_transaction_id)
);
CREATE INDEX IF NOT EXISTS billing_transactions_org_created_idx ON billing_transactions(organization_id,created_at DESC);
CREATE TABLE IF NOT EXISTS billing_webhook_events (
 id BIGSERIAL PRIMARY KEY,
 provider TEXT NOT NULL,
 event_key TEXT NOT NULL,
 event_type TEXT NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 processed_at TIMESTAMPTZ,
 processing_error TEXT,
 UNIQUE(provider,event_key)
);
CREATE TABLE IF NOT EXISTS platform_audit_log (
 id BIGSERIAL PRIMARY KEY,
 actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
 organization_id BIGINT REFERENCES saas_organizations(id) ON DELETE SET NULL,
 action TEXT NOT NULL,
 target_type TEXT,
 target_id TEXT,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_audit_log_created_idx ON platform_audit_log(created_at DESC);
