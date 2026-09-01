#!/usr/bin/env bash
set -euo pipefail

dump="${1:-}"
if [[ -z "$dump" || ! -f "$dump" ]]; then
  echo "Usage: RESTORE_DATABASE_URL=... $0 /path/to/backup.dump --isolated" >&2
  exit 1
fi
if [[ "${2:-}" != "--isolated" || -z "${RESTORE_DATABASE_URL:-}" ]]; then
  echo "RESTORE_DATABASE_URL and the explicit --isolated flag are required." >&2
  exit 1
fi
if [[ "${RESTORE_DATABASE_RESOURCE_ENV:-}" != "restore" ]]; then
  echo "RESTORE_DATABASE_RESOURCE_ENV=restore is required for an isolated restore target." >&2
  exit 1
fi
if [[ -z "${RESTORE_DATABASE_RESOURCE_ID:-}" || -z "${PRODUCTION_DATABASE_RESOURCE_ID:-}" ]]; then
  echo "RESTORE_DATABASE_RESOURCE_ID and PRODUCTION_DATABASE_RESOURCE_ID are required to prove resource separation." >&2
  exit 1
fi
if [[ "$RESTORE_DATABASE_RESOURCE_ID" == "$PRODUCTION_DATABASE_RESOURCE_ID" ]]; then
  echo "Restore resource must not be the Production database resource." >&2
  exit 1
fi
if [[ -n "${DATABASE_URL:-}" && "$RESTORE_DATABASE_URL" == "$DATABASE_URL" ]]; then
  echo "Restore target must not equal DATABASE_URL." >&2
  exit 1
fi
for command in pg_restore psql; do
  command -v "$command" >/dev/null 2>&1 || { echo "$command is required." >&2; exit 1; }
done

manifest="$dump.manifest"
if [[ ! -f "$manifest" ]]; then
  echo "Backup manifest is missing: $manifest" >&2
  exit 1
fi
expected="$(awk -F= '$1 == "sha256" { print $2 }' "$manifest")"
actual="$(shasum -a 256 "$dump" | awk '{print $1}')"
[[ -n "$expected" && "$expected" == "$actual" ]] || { echo "Backup checksum mismatch." >&2; exit 1; }

pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" "$dump"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT count(*) AS migrations FROM drizzle.__drizzle_migrations;
SELECT count(*) AS publications FROM public.publication;
SELECT count(*) AS evidence FROM public.evidence;
SELECT count(*) AS briefing_runs FROM public.briefing_run;
SELECT count(*) AS october7_tables_touched
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'october7%';
SQL

echo "Restore completed and core briefing tables are queryable in the isolated target."
