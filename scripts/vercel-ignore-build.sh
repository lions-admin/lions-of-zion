#!/usr/bin/env bash
# Vercel's Ignored Build Step. Exit 0 = skip the build, exit 1 = build.
#
# Until 2026-09-08 every push to every branch built. Two days of agent work
# produced 100 deployments — 73 of them previews of working branches nobody
# opened — and 337 build-minutes. Owner ruling: no previews at all, and no
# build for a commit that cannot change what a reader sees.
#
# The fail-safe direction is always *build*. Every uncertainty below — no
# branch name, no previous commit, a shallow clone, a git failure — exits 1.
# Skipping a build that was needed strands Production on old code; building
# one that was not needed costs three minutes.
set -u

build()  { echo "BUILD: $1";  exit 1; }
skip()   { echo "SKIP: $1";   exit 0; }

branch="${VERCEL_GIT_COMMIT_REF:-}"
[ -z "$branch" ] && build "no VERCEL_GIT_COMMIT_REF; cannot tell which branch this is"

# Production is the only branch that deploys. A preview URL for a feature
# branch is not worth a build here; open a PR and read the CI run instead.
[ "$branch" != "main" ] && skip "branch '$branch' is not main"

# `main` still skips a commit that touches nothing the deployed site is built
# from. Documentation, tests, agent instructions and CI config are all
# verified by GitHub Actions and none of them reach the bundle.
changed=$(git diff --name-only HEAD^ HEAD 2>/dev/null) \
  || build "no HEAD^ to compare against (shallow clone or first commit)"
[ -z "$changed" ] && build "empty diff; treating as unknown"

while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    docs/*|*.md|tests/*|.github/*|.claude/*|.ai/*|.codex/*|.agents/*) ;;
    *) build "$file affects the deployed application" ;;
  esac
done <<< "$changed"

skip "only documentation, tests or agent/CI configuration changed"
