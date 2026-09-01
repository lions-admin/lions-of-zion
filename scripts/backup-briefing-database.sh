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

backup_dir="${1:-$PWD/backups/briefing}"
mkdir -p "$backup_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$backup_dir/lions-of-zion-$stamp.dump"
manifest="$dump.manifest"

umask 077
pg_dump --format=custom --no-owner --no-privileges --file="$dump" "$DATABASE_URL"
checksum="$(shasum -a 256 "$dump" | awk '{print $1}')"
{
  printf 'created_at=%s\n' "$stamp"
  printf 'sha256=%s\n' "$checksum"
  printf 'format=postgres-custom\n'
  printf 'scope=full-database-before-briefing-change\n'
} > "$manifest"

echo "$dump"
