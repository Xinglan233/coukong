"""Prepare a trusted, private Wrangler D1 export for an empty isolated database.

Preserve every statement; create all tables before data and triggers after data.
This prevents forward foreign-key references and replay of audit/budget triggers.
Never accepts arbitrary uploaded SQL or runs against an existing database.
"""
import os
import re
import sqlite3
import sys
from pathlib import Path

MAX_BYTES = 128 * 1024 * 1024
MAX_STATEMENT_BYTES = 80 * 1024
CHUNK_BYTES = 32 * 1024
CHUNK_TABLE = '__tongye_restore_text_chunks'

def string_literals(statement: str):
    """Locate single-quoted SQL values, respecting escaped quotes and identifiers."""
    offset = 0
    while offset < len(statement):
        char = statement[offset]
        if char in ('"', '`', '['):
            close = ']' if char == '[' else char
            offset += 1
            while offset < len(statement):
                if statement[offset] == close:
                    offset += 1
                    if offset < len(statement) and statement[offset] == close:
                        offset += 1
                        continue
                    break
                offset += 1
        elif char == "'":
            start = offset
            offset += 1
            while offset < len(statement):
                if statement[offset] == "'":
                    offset += 1
                    if offset < len(statement) and statement[offset] == "'":
                        offset += 1
                        continue
                    yield start, offset
                    break
                offset += 1
            else:
                raise ValueError('Unterminated SQL string')
        else:
            offset += 1

def bounded_data(statements: list[str]) -> tuple[list[str], bool]:
    """Reassemble large text values before INSERT without oversized inline SQL.

    Scratch updates run before original triggers exist; original rows are inserted
    exactly once. No production schema or backup value is changed.
    """
    output = []
    sequence = 0
    for statement in statements:
        if len(statement.encode('utf-8')) <= MAX_STATEMENT_BYTES:
            output.append(statement)
            continue
        if not re.match(r'^\s*INSERT\s+INTO\b', statement, re.I):
            raise ValueError('Oversized non-INSERT statement')
        replacements = []
        temporary = []
        for start, end in string_literals(statement):
            literal = statement[start:end]
            if len(literal.encode('utf-8')) < 4096:
                continue
            if start and statement[start - 1] in ('x', 'X'):
                raise ValueError('Oversized BLOB literal is not supported by text restore preparation')
            sequence += 1
            temporary.append(sequence)
            value = literal[1:-1].replace("''", "'")
            chunks = []
            current = []
            size = 0
            for char in value:
                cost = len(char.encode('utf-8')) + (1 if char == "'" else 0)
                if size + cost > CHUNK_BYTES:
                    chunks.append(''.join(current))
                    current, size = [], 0
                current.append(char)
                size += cost
            chunks.append(''.join(current))
            for index, chunk in enumerate(chunks):
                quoted = "'" + chunk.replace("'", "''") + "'"
                if index == 0:
                    output.append(f'INSERT INTO "{CHUNK_TABLE}" VALUES({sequence},{quoted});')
                else:
                    output.append(f'UPDATE "{CHUNK_TABLE}" SET value=value||{quoted} WHERE id={sequence};')
            replacements.append((start, end, f'(SELECT value FROM "{CHUNK_TABLE}" WHERE id={sequence})'))
        for start, end, replacement in reversed(replacements):
            statement = statement[:start] + replacement + statement[end:]
        if len(statement.encode('utf-8')) > MAX_STATEMENT_BYTES:
            raise ValueError('Statement cannot be safely bounded; no truncation permitted')
        output.append(statement)
        if temporary:
            output.append(f'DELETE FROM "{CHUNK_TABLE}" WHERE id IN ({",".join(map(str, temporary))});')
    return output, bool(sequence)

def prepare(source: str) -> str:
    buckets = {key: [] for key in ('pragma', 'table', 'data', 'index', 'trigger')}
    buffer = ''
    for line in source.splitlines(keepends=True):
        buffer += line
        if not sqlite3.complete_statement(buffer):
            continue
        statement = buffer.strip()
        buffer = ''
        head = re.sub(r'^(?:\s*--[^\n]*(?:\n|$))*', '', statement).strip()
        if re.match(r'^PRAGMA\s+defer_foreign_keys\s*=\s*(?:TRUE|ON|1)\s*;', head, re.I):
            key = 'pragma'
        elif re.match(r'^CREATE\s+TABLE\b', head, re.I):
            key = 'table'
        elif re.match(r'^INSERT\s+INTO\b', head, re.I) or re.fullmatch(r'DELETE\s+FROM\s+sqlite_sequence\s*;', head, re.I):
            key = 'data'
        elif re.match(r'^CREATE\s+(?:UNIQUE\s+)?INDEX\b', head, re.I):
            key = 'index'
        elif re.match(r'^CREATE\s+TRIGGER\b', head, re.I):
            key = 'trigger'
        else:
            raise ValueError('Unsupported statement; only trusted Wrangler export statements are allowed')
        buckets[key].append(statement)
    if buffer.strip():
        raise ValueError('Incomplete SQL statement')
    if not buckets['table']:
        raise ValueError('No tables in export')
    if any(re.search(r'\b' + CHUNK_TABLE + r'\b', table, re.I) for table in buckets['table']):
        raise ValueError('Reserved restore scratch table already exists')
    data, scratch = bounded_data(buckets['data'])
    tables = [*buckets['table']]
    if scratch:
        tables.append(f'CREATE TABLE "{CHUNK_TABLE}"(id INTEGER PRIMARY KEY,value TEXT NOT NULL);')
        data.append(f'DROP TABLE "{CHUNK_TABLE}";')
    statements = ['PRAGMA defer_foreign_keys=ON;', *tables, *data, *buckets['index'], *buckets['trigger']]
    if any(len(s.encode('utf-8')) > MAX_STATEMENT_BYTES for s in statements):
        raise ValueError('SQL statement exceeds safe D1 restore limit')
    return '\n'.join(statements) + '\n'

def main():
    if len(sys.argv) != 3:
        raise ValueError('Use: python3 scripts/prepare-d1-restore.py <private-export.sql> <new-private-restore.sql>')
    source, target = map(Path, sys.argv[1:])
    if source.stat().st_mode & 0o077:
        raise ValueError('SQL input must have private 600 permissions')
    if source.stat().st_size > MAX_BYTES:
        raise ValueError('SQL export exceeds 128 MiB local validation limit')
    result = prepare(source.read_text(encoding='utf-8')).encode('utf-8')
    with os.fdopen(os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as output:
        output.write(result)
    print('Restore SQL prepared; original export preserved.')

if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Restore preparation failed; inspect private input permissions and supported SQL format.', file=sys.stderr)
        sys.exit(1)
