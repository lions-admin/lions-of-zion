#!/usr/bin/env bash
set -euo pipefail

target="${1:-}"
if [[ "$target" != "preview" && "$target" != "production" ]]; then
  echo "Usage: $0 preview|production" >&2
  exit 2
fi

if [[ -z "${DATABASE_URL:-}" || "$DATABASE_URL" == "[SENSITIVE]" ]]; then
  echo "DATABASE_URL must be a real PostgreSQL URL; refusing a redacted value." >&2
  exit 2
fi
if [[ "${DATABASE_RESOURCE_ENV:-}" != "$target" ]]; then
  echo "DATABASE_RESOURCE_ENV must equal $target before migration." >&2
  exit 2
fi

if [[ "$target" == "production" ]]; then
  snapshot="${BRIEFING_MIGRATION_SNAPSHOT:-}"
  if [[ -z "$snapshot" || ! -f "$snapshot" ]]; then
    echo "Production migration requires BRIEFING_MIGRATION_SNAPSHOT pointing to a pre-migration backup manifest." >&2
    exit 2
  fi
fi

echo "Running migration integrity checks for $target..."
pnpm exec vitest run tests/migrations.test.ts
echo "Applying journaled migrations to the explicitly labelled $target database..."
pnpm db:migrate
echo "Migration preflight completed for $target."
