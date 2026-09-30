CREATE TABLE audit(id INTEGER PRIMARY KEY, action TEXT NOT NULL, group_id TEXT, resource_id TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX audit_created ON audit(created_at);
CREATE TRIGGER audit_group_insert AFTER INSERT ON groups BEGIN INSERT INTO audit(action,group_id,resource_id,created_at) VALUES('group.created',NEW.id,NEW.id,NEW.created_at); END;
CREATE TRIGGER audit_group_update AFTER UPDATE ON groups BEGIN INSERT INTO audit(action,group_id,resource_id,created_at) VALUES('group.updated',NEW.id,NEW.id,NEW.updated_at); END;
CREATE TRIGGER audit_group_delete AFTER DELETE ON groups BEGIN INSERT INTO audit(action,group_id,resource_id,created_at) VALUES('group.deleted',OLD.id,OLD.id,strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
CREATE TRIGGER audit_member_insert AFTER INSERT ON members BEGIN INSERT INTO audit(action,group_id,resource_id,created_at) VALUES('member.joined',NEW.group_id,NEW.id,NEW.created_at); END;
CREATE TRIGGER audit_member_update AFTER UPDATE ON members BEGIN INSERT INTO audit(action,group_id,resource_id,created_at) VALUES('member.submitted',NEW.group_id,NEW.id,NEW.updated_at); END;
CREATE TRIGGER audit_member_delete AFTER DELETE ON members BEGIN INSERT INTO audit(action,group_id,resource_id,created_at) VALUES('member.removed',OLD.group_id,OLD.id,strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
