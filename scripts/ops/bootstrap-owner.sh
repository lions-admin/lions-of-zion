#!/usr/bin/env bash
#
# Owner-run bootstrap for the operations task board. Three things an agent on
# this machine is not allowed to do (safety classifier: Production writes and
# secret-store writes), collected so the owner runs one line:
#
#   bash scripts/ops/bootstrap-owner.sh            # all three steps
#   bash scripts/ops/bootstrap-owner.sh --no-publish
#
# 1. Apply migration 0066 to the Production Neon branch (DDL + drizzle receipt).
#    Needs a Production connection string in PRODUCTION_DATABASE_URL — copy it
#    from the Neon Console (branch `main`, endpoint ep-late-fire-…); it is a
#    Vercel *sensitive* var and cannot be pulled with `vercel env pull`.
# 2. Create OPS_REPORT_SECRET once and store it in four places: Vercel
#    Production, Vercel Preview, the GitHub Actions secret (CI report job), and
#    ~/.config/ai-dev/ops-report.env (every local agent reads it from there).
# 3. Publish ai/claude → main (Production deploys in ~2 minutes).
#
# Re-runnable: an existing local secret is reused; an already-applied migration
# is skipped by the receipt check.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

publish=1
for arg in "$@"; do [ "$arg" = "--no-publish" ] && publish=0; done

echo "── 1. migration 0066 → Production"
if [ -z "${PRODUCTION_DATABASE_URL:-}" ]; then
  read -r -s -p "PRODUCTION_DATABASE_URL (Neon Console → branch main → connection string): " PRODUCTION_DATABASE_URL; echo
fi
DATABASE_URL="$PRODUCTION_DATABASE_URL" DATABASE_URL_UNPOOLED="$PRODUCTION_DATABASE_URL" \
  ALLOW_PRODUCTION_MIGRATION=1 node scripts/db/apply-migration-by-hand.mjs 0066
DATABASE_URL="$PRODUCTION_DATABASE_URL" DATABASE_RESOURCE_ENV=production \
  npx tsx scripts/check-deployment-schema.ts production

echo "── 2. OPS_REPORT_SECRET"
envfile="$HOME/.config/ai-dev/ops-report.env"
mkdir -p "$(dirname "$envfile")"
if [ -f "$envfile" ] && grep -q '^OPS_REPORT_SECRET=' "$envfile"; then
  secret="$(sed -n 's/^OPS_REPORT_SECRET=//p' "$envfile" | head -1)"
  echo "reusing the secret already in $envfile"
else
  secret="$(openssl rand -hex 32)"
  umask 077
  printf 'OPS_REPORT_SECRET=%s\nOPS_REPORT_BASE_URL=https://lionsofzion.io\n' "$secret" > "$envfile"
  echo "wrote $envfile"
fi
printf '%s' "$secret" | vercel env add OPS_REPORT_SECRET production --sensitive --force
printf '%s' "$secret" | vercel env add OPS_REPORT_SECRET preview --sensitive --force
gh secret set OPS_REPORT_SECRET --body "$secret"

if [ "$publish" = 1 ]; then
  echo "── 3. publish ai/claude → main"
  ALLOW_MAIN_PUSH=1 npm run main:update
  echo
  echo "Board: https://lionsofzion.io/admin?area=tasks"
  echo "Then, optionally, the one-time history import:  npm run ops:backfill -- --apply"
fi
