ALTER TABLE templates ADD COLUMN operation_id TEXT;
ALTER TABLE templates ADD COLUMN operation_digest TEXT;
CREATE TABLE group_tombstones(id TEXT PRIMARY KEY, manager_hash TEXT NOT NULL, operation_id TEXT NOT NULL, digest TEXT NOT NULL, deleted_at TEXT NOT NULL);
