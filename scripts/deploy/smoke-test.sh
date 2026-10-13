#!/usr/bin/env bash
# Smoke test after a deploy: the home page answers 200 and asks not to be
# indexed, and /robots.txt closes the site (ADR 0008). A new Worker or version
# can take a few seconds to answer everywhere, so each check is retried.
#
# Usage: scripts/deploy/smoke-test.sh <https origin>
#   for example scripts/deploy/smoke-test.sh https://enmirumbo.urekz.workers.dev
# Optional: SMOKE_ATTEMPTS (default 10), SMOKE_DELAY (seconds, default 6).
set -euo pipefail

readonly ATTEMPTS="${SMOKE_ATTEMPTS:-10}"
readonly DELAY="${SMOKE_DELAY:-6}"

fail() {
  echo "::error::smoke-test: $*" >&2
  exit 1
}

[ "$#" -eq 1 ] || fail "usage: smoke-test.sh <https origin>"
origin="$1"
[[ "${origin}" =~ ^https://[a-z0-9.-]+$ ]] || fail "'${origin}' is not an https origin"
[[ "${ATTEMPTS}" =~ ^[1-9][0-9]*$ ]] && [[ "${DELAY}" =~ ^[0-9]+$ ]] ||
  fail "SMOKE_ATTEMPTS must be a positive whole number and SMOKE_DELAY whole seconds"
command -v curl >/dev/null || fail "curl is not on PATH"

work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT

# fetch <url>: writes the headers and the body to ${work}; prints the status.
fetch() {
  local status
  rm -f "${work}/headers" "${work}/body"
  status="$(curl --silent --show-error --max-time 15 --proto '=https' \
    --dump-header "${work}/headers" --output "${work}/body" \
    --write-out '%{http_code}' "$1")" || true
  touch "${work}/headers" "${work}/body"
  echo "${status:-000}"
}

# check_home and check_robots print why they failed, if they did.
check_home() {
  local status
  status="$(fetch "${origin}/")"
  if [ "${status}" != "200" ]; then
    echo "GET / answered ${status}, expected 200"
  elif ! grep -iqE '^x-robots-tag:.*noindex' "${work}/headers"; then
    echo "GET / has no X-Robots-Tag: noindex header"
  fi
}

check_robots() {
  local status
  status="$(fetch "${origin}/robots.txt")"
  if [ "${status}" != "200" ]; then
    echo "GET /robots.txt answered ${status}, expected 200"
  elif ! tr -d '\r' <"${work}/body" | grep -qxF 'Disallow: /'; then
    echo "GET /robots.txt does not close the site (no 'Disallow: /' line)"
  fi
}

for check in check_home check_robots; do
  attempt=1
  while :; do
    problem="$(${check})"
    [ -n "${problem}" ] || break
    if [ "${attempt}" -ge "${ATTEMPTS}" ]; then
      fail "${origin}: ${problem} (after ${ATTEMPTS} attempts)"
    fi
    echo "smoke-test: ${problem}; retrying in ${DELAY}s (attempt ${attempt} of ${ATTEMPTS})"
    attempt=$((attempt + 1))
    sleep "${DELAY}"
  done
done

echo "smoke-test: ${origin} answers 200, sends X-Robots-Tag: noindex and closes robots.txt"
