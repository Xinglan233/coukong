ALTER TABLE events ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','private'));
ALTER TABLE events ADD COLUMN owner_hash TEXT;
ALTER TABLE events ADD COLUMN private_create_op TEXT;
ALTER TABLE events ADD COLUMN private_create_digest TEXT;
CREATE UNIQUE INDEX private_event_owner ON events(owner_hash) WHERE owner_hash IS NOT NULL;
CREATE INDEX public_event_visibility ON events(visibility,updated_at);
CREATE TRIGGER private_event_budget_insert BEFORE INSERT ON events WHEN NEW.visibility='private' BEGIN
 SELECT RAISE(ABORT,'PERSONAL_STORAGE_BUDGET') WHERE (SELECT used_bytes+2*length(CAST(NEW.event_json AS BLOB))+2048>max_bytes FROM visitor_storage_budget WHERE id=1);
 UPDATE visitor_storage_budget SET used_bytes=used_bytes+2*length(CAST(NEW.event_json AS BLOB))+2048 WHERE id=1;
END;
CREATE TRIGGER private_event_budget_update BEFORE UPDATE OF event_json ON events WHEN OLD.visibility='private' BEGIN
 SELECT RAISE(ABORT,'PERSONAL_STORAGE_BUDGET') WHERE (SELECT used_bytes+2*length(CAST(NEW.event_json AS BLOB))-2*length(CAST(OLD.event_json AS BLOB))>max_bytes FROM visitor_storage_budget WHERE id=1);
 UPDATE visitor_storage_budget SET used_bytes=used_bytes+2*length(CAST(NEW.event_json AS BLOB))-2*length(CAST(OLD.event_json AS BLOB)) WHERE id=1;
END;
CREATE TRIGGER private_event_budget_delete AFTER DELETE ON events WHEN OLD.visibility='private' BEGIN
 UPDATE visitor_storage_budget SET used_bytes=used_bytes-2*length(CAST(OLD.event_json AS BLOB))-2048 WHERE id=1;
END;
