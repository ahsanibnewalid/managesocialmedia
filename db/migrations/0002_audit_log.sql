CREATE TABLE IF NOT EXISTS audit_log (
 id BIGSERIAL PRIMARY KEY,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
 actor_ip INET,
 workspace_id BIGINT REFERENCES workspaces(id) ON DELETE CASCADE,
 action TEXT NOT NULL,
 target_type TEXT,
 target_id TEXT,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_user_id BIGINT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_ip INET;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS target_id TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE audit_log
SET occurred_at = COALESCE(occurred_at, created_at, now()),
    actor_user_id = COALESCE(actor_user_id, user_id),
    created_at = COALESCE(created_at, occurred_at, now()),
    metadata = COALESCE(metadata, '{}'::jsonb);

ALTER TABLE audit_log ALTER COLUMN occurred_at SET DEFAULT now();
ALTER TABLE audit_log ALTER COLUMN occurred_at SET NOT NULL;
ALTER TABLE audit_log ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE audit_log ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE audit_log ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE audit_log ALTER COLUMN metadata SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_log_actor_user_id_fkey') THEN
    ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS audit_log_occurred_at_idx ON audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_workspace_occurred_idx ON audit_log(workspace_id, occurred_at DESC);
