PRAGMA foreign_keys=ON;
CREATE TABLE groups(id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', revision INTEGER NOT NULL DEFAULT 0, schedule_revision INTEGER NOT NULL DEFAULT 0, event_json TEXT NOT NULL, manager_hash TEXT NOT NULL UNIQUE, invite_hash TEXT NOT NULL UNIQUE, create_op TEXT NOT NULL, create_digest TEXT NOT NULL, last_op TEXT, last_digest TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE members(id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, revision INTEGER NOT NULL DEFAULT 0, schedule_revision INTEGER, response_json TEXT, availability_json TEXT, join_op TEXT NOT NULL, join_digest TEXT NOT NULL, last_op TEXT, last_digest TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, submitted_at TEXT);
CREATE INDEX members_group ON members(group_id);
CREATE TABLE operations(scope TEXT NOT NULL, op TEXT NOT NULL, digest TEXT NOT NULL, result_json TEXT NOT NULL, PRIMARY KEY(scope,op));
CREATE TABLE templates(id TEXT NOT NULL, revision INTEGER NOT NULL, published INTEGER NOT NULL DEFAULT 0, event_json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(id,revision));
CREATE TABLE admin_sessions(hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE rate_limits(key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TRIGGER member_limit BEFORE INSERT ON members WHEN (SELECT count(*) FROM members WHERE group_id=NEW.group_id)>=50 BEGIN SELECT RAISE(ABORT,'MEMBER_LIMIT'); END;
