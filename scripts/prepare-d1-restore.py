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
    return '\n'.join(['PRAGMA defer_foreign_keys=ON;', *buckets['table'], *buckets['data'], *buckets['index'], *buckets['trigger']]) + '\n'

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
