/* Hash-only, event-scoped single-use creation capability. Keep consumed rows after
group deletion so deleting a group never makes its creation capability reusable. */
CREATE TABLE creation_invites (
 id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash)=64),
 event_id TEXT NOT NULL,
 event_title TEXT NOT NULL,
 admin_hash TEXT NOT NULL,
 create_op TEXT NOT NULL,
 create_digest TEXT NOT NULL,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 used_group_id TEXT UNIQUE,
 used_at TEXT,
 revoked_at TEXT,
 revoke_op TEXT,
 revoke_digest TEXT,
 revision INTEGER NOT NULL DEFAULT 0,
 UNIQUE(admin_hash,create_op),
 CHECK((used_group_id IS NULL)=(used_at IS NULL)),
 CHECK(used_group_id IS NULL OR revoked_at IS NULL)
);
CREATE INDEX creation_invites_created ON creation_invites(created_at DESC,id);
CREATE INDEX creation_invites_available ON creation_invites(expires_at) WHERE used_group_id IS NULL AND revoked_at IS NULL;
CREATE TRIGGER creation_invite_budget BEFORE INSERT ON creation_invites BEGIN
 SELECT RAISE(ABORT,'CREATION_INVITE_LIMIT') WHERE (SELECT count(*) FROM creation_invites)>=10000;
 SELECT RAISE(ABORT,'CREATION_INVITE_LIMIT') WHERE (SELECT count(*) FROM creation_invites WHERE used_group_id IS NULL AND revoked_at IS NULL AND expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))>=100;
END;
ALTER TABLE groups ADD COLUMN creation_invite_id TEXT REFERENCES creation_invites(id);
/* A trigger makes the claim part of the INSERT statement. A failed claim is an
SQL exception, not a zero-row CAS followed by a JavaScript error after commit. */
CREATE TRIGGER creation_invite_group_check BEFORE INSERT ON groups WHEN NEW.creation_invite_id IS NOT NULL BEGIN
 SELECT RAISE(ABORT,'CREATION_INVITE_UNAVAILABLE') WHERE NOT EXISTS(SELECT 1 FROM creation_invites WHERE id=NEW.creation_invite_id AND event_id=NEW.source_event_id AND used_group_id IS NULL AND revoked_at IS NULL AND expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER creation_invite_group_consume AFTER INSERT ON groups WHEN NEW.creation_invite_id IS NOT NULL BEGIN
 UPDATE creation_invites SET used_group_id=NEW.id,used_at=NEW.created_at,revision=revision+1 WHERE id=NEW.creation_invite_id AND used_group_id IS NULL AND revoked_at IS NULL;
 SELECT RAISE(ABORT,'CREATION_INVITE_UNAVAILABLE') WHERE changes()<>1;
END;
