CREATE TABLE IF NOT EXISTS rate_limit_bucket (
 key TEXT PRIMARY KEY,
 window_start TIMESTAMPTZ NOT NULL,
 count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limit_bucket_window_idx ON rate_limit_bucket(window_start);
