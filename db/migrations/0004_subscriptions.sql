CREATE TABLE IF NOT EXISTS workspace_subscriptions (
 workspace_id BIGINT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 provider TEXT NOT NULL,
 provider_subscription_id TEXT UNIQUE,
 status TEXT NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_subscriptions_status_idx ON workspace_subscriptions(status, updated_at DESC);
