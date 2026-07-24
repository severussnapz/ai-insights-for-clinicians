#!/usr/bin/env sh
set -eu

BASE_URL="${1:-http://localhost:8000}"

pass() {
  echo "PASS: $1"
}

fail() {
  echo "FAIL: $1"
  exit 1
}

request() {
  method="$1"
  url="$2"
  body="${3:-}"
  out_file="/tmp/ai-insights-smoke-body.$$"

  if [ -n "$body" ]; then
    status=$(curl -sS -o "$out_file" -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -d "$body")
  else
    status=$(curl -sS -o "$out_file" -w "%{http_code}" -X "$method" "$url")
  fi

  body_text=$(cat "$out_file")
  rm -f "$out_file"

  printf "%s\n%s\n" "$status" "$body_text"
}

echo "Running backend smoke tests against: $BASE_URL"

echo "1) Health endpoint"
health_result=$(request GET "$BASE_URL/health")
health_status=$(printf "%s" "$health_result" | sed -n '1p')
health_body=$(printf "%s" "$health_result" | sed -n '2,$p')

[ "$health_status" = "200" ] || fail "/health returned $health_status"
printf "%s" "$health_body" | grep -q '"ok"' || fail "/health missing ok field"
pass "/health returned 200 with JSON"

echo "2) Generate validation (missing prompt)"
generate_result=$(request POST "$BASE_URL/api/generate" '{}')
generate_status=$(printf "%s" "$generate_result" | sed -n '1p')
generate_body=$(printf "%s" "$generate_result" | sed -n '2,$p')

[ "$generate_status" = "400" ] || fail "/api/generate returned $generate_status for empty prompt"
printf "%s" "$generate_body" | grep -q '"errorCode":"PROMPT_REQUIRED"' || fail "Missing PROMPT_REQUIRED errorCode"
pass "/api/generate validation contract is correct"

echo "3) Invalid JSON validation"
invalid_json_status=$(curl -sS -o /tmp/ai-insights-invalid-json-body.$$ -w "%{http_code}" \
  -X POST "$BASE_URL/api/generate" \
  -H "Content-Type: application/json" \
  -d 'not-json')
invalid_json_body=$(cat /tmp/ai-insights-invalid-json-body.$$)
rm -f /tmp/ai-insights-invalid-json-body.$$

[ "$invalid_json_status" = "400" ] || fail "Invalid JSON returned $invalid_json_status"
printf "%s" "$invalid_json_body" | grep -q '"errorCode":"INVALID_JSON"' || fail "Missing INVALID_JSON errorCode"
pass "Invalid JSON handling contract is correct"

echo "Smoke tests completed successfully."
