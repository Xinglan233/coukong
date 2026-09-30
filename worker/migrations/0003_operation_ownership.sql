ALTER TABLE operations ADD COLUMN group_id TEXT REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE operations ADD COLUMN member_id TEXT REFERENCES members(id) ON DELETE CASCADE;
CREATE INDEX operations_group ON operations(group_id);
CREATE INDEX operations_member ON operations(member_id);
UPDATE operations SET member_id=(SELECT id FROM members WHERE id=json_extract(operations.result_json,'$.member.id'));
UPDATE operations SET group_id=COALESCE((SELECT group_id FROM members WHERE id=operations.member_id),(SELECT id FROM groups WHERE id=json_extract(operations.result_json,'$.id')));
DELETE FROM operations WHERE group_id IS NULL;
