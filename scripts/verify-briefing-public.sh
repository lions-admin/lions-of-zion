#!/usr/bin/env bash
set -euo pipefail

# Read-only production smoke check. It deliberately accepts an empty public
# feed: an empty feed is an honest state, while a draft or an authentication
# challenge on a public route is a failure.
BASE_URL="${1:-https://lionsofzion.io}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

check_status() {
  local name="$1" url="$2" expected="$3"
  local status
  status="$(curl -fsSL --max-time 20 -o "$TMP_DIR/$name" -w '%{http_code}' "$url")"
  if [[ "$status" != "$expected" ]]; then
    echo "FAIL $name: expected HTTP $expected, got $status" >&2
    return 1
  fi
  echo "OK   $name: HTTP $status"
}

check_status "feed.json" "$BASE_URL/api/v1/published-publications" 200
python3 - "$TMP_DIR/feed.json" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
if not isinstance(data, dict) or not isinstance(data.get("publications"), list):
    raise SystemExit("FAIL feed.json: invalid public projection")
for item in data["publications"]:
    if item.get("status") not in (None, "published"):
        raise SystemExit("FAIL feed.json: non-public status leaked")
print(f"OK   feed.json: {len(data['publications'])} public publications")
PY

check_status "brief.html" "$BASE_URL/geopolitical-brief" 200
grep -q "The Daily Brief" "$TMP_DIR/brief.html"
echo "OK   brief.html: Daily Brief marker present"

curl -fsSL --max-time 20 -D "$TMP_DIR/brief.headers" -o /dev/null "$BASE_URL/geopolitical-brief"
for header in \
  "content-security-policy:" \
  "referrer-policy: strict-origin-when-cross-origin" \
  "strict-transport-security:" \
  "x-content-type-options: nosniff" \
  "x-frame-options: deny"; do
  if ! grep -Eiq "^${header}" "$TMP_DIR/brief.headers"; then
    echo "FAIL brief.html: missing security header ${header}" >&2
    exit 1
  fi
done
echo "OK   brief.html: security headers present"

check_status "sitemap.xml" "$BASE_URL/sitemap.xml" 200
grep -q "${BASE_URL}/geopolitical-brief" "$TMP_DIR/sitemap.xml"
echo "OK   sitemap.xml: briefing route present"

status="$(curl -sS --max-time 20 -o "$TMP_DIR/missing.json" -w '%{http_code}' "$BASE_URL/api/v1/published-publications/__smoke_missing__")"
if [[ "$status" != "404" ]]; then
  echo "FAIL missing publication: expected HTTP 404, got $status" >&2
  exit 1
fi
echo "OK   missing publication: HTTP 404"
