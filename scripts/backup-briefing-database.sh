#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required." >&2
  exit 1
fi

# The default output directory is OUTSIDE the repository, deliberately. It used
# to be "$PWD/backups/briefing", and on 2026-09-03 nine dumps produced there rode
# into a three-file UI commit on a `git add -A` — the repo is public, and only a
# broken database connection kept them empty. Pass a path explicitly, or set
# BRIEFING_BACKUP_DIR; do not point either back inside the working tree.
backup_dir="${1:-${BRIEFING_BACKUP_DIR:-$HOME/.lions-of-zion/backups/briefing}}"
mkdir -p "$backup_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$backup_dir/lions-of-zion-$stamp.dump"
manifest="$dump.manifest"

umask 077

# `pg_dump --file=` creates the target BEFORE it connects, so a failed connection
# leaves a 0-byte file behind that looks like a backup to everything downstream.
# That is how nine empty stubs accumulated on 2026-09-03 and rode into a commit.
#
# Both branches below are load-bearing. `pg_dump` is called inside `if !` rather
# than bare, because `set -e` would otherwise abort here — before any cleanup
# ran — and leave the stub behind, which is the original failure exactly.
if ! pg_dump --format=custom --no-owner --no-privileges --file="$dump" "$DATABASE_URL"; then
  rm -f "$dump"
  echo "pg_dump failed — no backup was written." >&2
  exit 1
fi
if [[ ! -s "$dump" ]]; then
  rm -f "$dump"
  echo "pg_dump produced an empty file — no backup was written." >&2
  exit 1
fi

checksum="$(shasum -a 256 "$dump" | awk '{print $1}')"
{
  printf 'created_at=%s\n' "$stamp"
  printf 'sha256=%s\n' "$checksum"
  printf 'format=postgres-custom\n'
  printf 'scope=full-database-before-briefing-change\n'
} > "$manifest"

echo "$dump"
