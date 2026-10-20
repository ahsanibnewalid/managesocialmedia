CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspaces (
 id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspace_members (
 workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','editor','viewer')),
 PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS posts (
 id BIGSERIAL PRIMARY KEY, workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL, media_url TEXT,
 platforms TEXT[] NOT NULL DEFAULT '{}',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','publishing','published','failed')),
 scheduled_at TIMESTAMPTZ, published_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE posts ADD CONSTRAINT posts_status_check CHECK(status IN ('draft','scheduled','publishing','published','failed'));
CREATE TABLE IF NOT EXISTS social_accounts (
 id BIGSERIAL PRIMARY KEY, workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 platform TEXT NOT NULL, account_name TEXT NOT NULL, external_id TEXT,
 status TEXT NOT NULL DEFAULT 'disconnected' CHECK(status IN ('connected','disconnected','error')),
 token_ciphertext TEXT, token_expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inbox_threads (
 id BIGSERIAL PRIMARY KEY, workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 platform TEXT NOT NULL, external_thread_id TEXT, contact_name TEXT NOT NULL,
 kind TEXT NOT NULL DEFAULT 'comment', body TEXT NOT NULL, sentiment TEXT NOT NULL DEFAULT 'neutral',
 unread BOOLEAN NOT NULL DEFAULT true, assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inbox_replies (
 id BIGSERIAL PRIMARY KEY, thread_id BIGINT NOT NULL REFERENCES inbox_threads(id) ON DELETE CASCADE,
 author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_log (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
 workspace_id BIGINT REFERENCES workspaces(id) ON DELETE CASCADE, action TEXT NOT NULL,
 metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS publish_attempts (
 id BIGSERIAL PRIMARY KEY, post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 platform TEXT NOT NULL, attempt_number INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('processing','succeeded','failed')),
 error TEXT, external_post_id TEXT, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS posts_workspace_schedule_idx ON posts(workspace_id, scheduled_at);
CREATE INDEX IF NOT EXISTS inbox_workspace_unread_idx ON inbox_threads(workspace_id, unread, created_at DESC);
CREATE INDEX IF NOT EXISTS publish_attempts_post_idx ON publish_attempts(post_id, started_at DESC);

-- OAuth state is short-lived, hashed at rest, and consumed once by the callback.
CREATE TABLE IF NOT EXISTS oauth_states (
 state_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 platform TEXT NOT NULL CHECK(platform IN ('facebook','instagram','linkedin','x','tiktok')),
 code_verifier TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_states_expiry_idx ON oauth_states(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS social_accounts_workspace_platform_external_uidx
 ON social_accounts(workspace_id,platform,external_id) WHERE external_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS post_analytics (
 id BIGSERIAL PRIMARY KEY, post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 platform TEXT NOT NULL, external_post_id TEXT NOT NULL,
 reach BIGINT, impressions BIGINT, likes BIGINT, comments BIGINT, shares BIGINT, clicks BIGINT,
 synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(post_id,platform)
);
CREATE INDEX IF NOT EXISTS post_analytics_post_idx ON post_analytics(post_id);

ALTER TABLE publish_attempts ADD COLUMN IF NOT EXISTS social_account_id BIGINT REFERENCES social_accounts(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS publish_attempts_success_once_idx
 ON publish_attempts(post_id,platform) WHERE status='succeeded';


-- Tidepost SaaS billing foundation. Additive and safe to re-run.
CREATE TABLE IF NOT EXISTS billing_plans (
 id BIGSERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 currency CHAR(3) NOT NULL CHECK (currency IN ('BDT','USD','EUR','GBP')),
 interval TEXT NOT NULL CHECK (interval IN ('month','year')),
 amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
 limits JSONB NOT NULL DEFAULT '{}'::jsonb, features JSONB NOT NULL DEFAULT '{}'::jsonb,
 active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saas_organizations (
 id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('agency','individual','creator','celebrity','business')),
 owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','past_due','suspended','cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saas_organizations_owner_idx ON saas_organizations(owner_user_id);
CREATE TABLE IF NOT EXISTS saas_organization_members (
 organization_id BIGINT NOT NULL REFERENCES saas_organizations(id) ON DELETE CASCADE,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK (role IN ('owner','admin','manager','editor','analyst','billing','client_viewer')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (organization_id,user_id)
);
CREATE TABLE IF NOT EXISTS saas_subscriptions (
 id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL REFERENCES saas_organizations(id) ON DELETE RESTRICT,
 plan_id BIGINT NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('incomplete','trialing','active','past_due','paused','cancelled','expired')),
 provider TEXT NOT NULL CHECK (provider IN ('sslcommerz','international_manual')),
 provider_customer_id TEXT, provider_subscription_id TEXT,
 currency CHAR(3) NOT NULL CHECK (currency IN ('BDT','USD','EUR','GBP')),
 amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
 interval TEXT NOT NULL CHECK (interval IN ('month','year')),
 current_period_start TIMESTAMPTZ, current_period_end TIMESTAMPTZ,
 cancel_at_period_end BOOLEAN NOT NULL DEFAULT false, cancelled_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saas_subscriptions_org_status_idx ON saas_subscriptions(organization_id,status);
CREATE INDEX IF NOT EXISTS saas_subscriptions_period_idx ON saas_subscriptions(status,current_period_end);
CREATE TABLE IF NOT EXISTS billing_transactions (
 id BIGSERIAL PRIMARY KEY, subscription_id BIGINT REFERENCES saas_subscriptions(id) ON DELETE RESTRICT,
 organization_id BIGINT NOT NULL REFERENCES saas_organizations(id) ON DELETE RESTRICT,
 provider TEXT NOT NULL CHECK (provider IN ('sslcommerz','international_manual')),
 provider_transaction_id TEXT NOT NULL, provider_validation_id TEXT,
 status TEXT NOT NULL CHECK (status IN ('created','pending','paid','failed','cancelled','refunded','review')),
 currency CHAR(3) NOT NULL CHECK (currency IN ('BDT','USD','EUR','GBP')),
 amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0), raw_status TEXT, validated_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(provider,provider_transaction_id)
);
CREATE INDEX IF NOT EXISTS billing_transactions_org_created_idx ON billing_transactions(organization_id,created_at DESC);
CREATE TABLE IF NOT EXISTS billing_webhook_events (
 id BIGSERIAL PRIMARY KEY, provider TEXT NOT NULL, event_key TEXT NOT NULL, event_type TEXT NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT now(), processed_at TIMESTAMPTZ, processing_error TEXT,
 UNIQUE(provider,event_key)
);
CREATE TABLE IF NOT EXISTS platform_audit_log (
 id BIGSERIAL PRIMARY KEY, actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
 organization_id BIGINT REFERENCES saas_organizations(id) ON DELETE SET NULL,
 action TEXT NOT NULL, target_type TEXT, target_id TEXT,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_audit_log_created_idx ON platform_audit_log(created_at DESC);
