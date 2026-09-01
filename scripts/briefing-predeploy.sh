#!/usr/bin/env bash
set -euo pipefail

target="${1:-}"
if [[ "$target" != "preview" && "$target" != "production" ]]; then
  echo "Usage: $0 preview|production" >&2
  exit 2
fi

echo "Running briefing contract and simulation checks before $target promotion..."
pnpm exec vitest run \
  tests/migrations.test.ts \
  tests/briefing-jobs.test.ts \
  tests/automatic-publication-gate.test.ts \
  tests/public-mutation-guard.test.ts \
  tests/public-read-cache.test.ts \
  tests/last-good-read.test.ts
pnpm typecheck

echo "Checks passed; handing off to the environment-labelled migration preflight."
exec pnpm briefing:migrate:preflight "$target"
