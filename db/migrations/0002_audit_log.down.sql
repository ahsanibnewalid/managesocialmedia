DROP INDEX IF EXISTS audit_log_workspace_occurred_idx;
DROP INDEX IF EXISTS audit_log_occurred_at_idx;
ALTER TABLE audit_log DROP COLUMN IF EXISTS target_id;
ALTER TABLE audit_log DROP COLUMN IF EXISTS target_type;
ALTER TABLE audit_log DROP COLUMN IF EXISTS actor_ip;
ALTER TABLE audit_log DROP COLUMN IF EXISTS actor_user_id;
ALTER TABLE audit_log DROP COLUMN IF EXISTS occurred_at;
