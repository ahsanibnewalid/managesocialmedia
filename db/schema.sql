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
