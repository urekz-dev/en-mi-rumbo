#!/usr/bin/env bash
# Resets the Neon branch `dev` to the current state of its parent `stage`
# (ADR 0005), before every deploy to dev. Whatever was stored in dev is lost,
# by design. The branch keeps its id and connection string, so the dev
# Hyperdrive configs keep working.
#
# It only ever writes to the branch named `dev`, and refuses unless that branch
# is unique, not the default branch, a direct child of the branch named
# `stage`, and without children of its own. Then it waits until Neon finishes
# the restore, so the migrations that follow see the reset database.
#
# Usage: scripts/deploy/reset-neon-dev.sh
# Needs NEON_API_KEY and NEON_PROJECT_ID in the environment
# (deploy-dev.yml passes NEON_API_KEY and NEON_PROJECT_ID from the dev environment's secrets).
# Optional: NEON_RESET_TIMEOUT (seconds, default 300), NEON_POLL_INTERVAL
# (seconds, default 3).
set -euo pipefail

readonly API="https://console.neon.tech/api/v2"
readonly TARGET="dev"
readonly SOURCE="stage"
readonly TIMEOUT="${NEON_RESET_TIMEOUT:-300}"
readonly INTERVAL="${NEON_POLL_INTERVAL:-3}"

fail() {
  echo "::error::reset-neon-dev: $*" >&2
  exit 1
}

[ "$#" -eq 0 ] || fail "usage: reset-neon-dev.sh (no arguments)"
[ -n "${NEON_API_KEY:-}" ] || fail "NEON_API_KEY is not set"
[ -n "${NEON_PROJECT_ID:-}" ] || fail "NEON_PROJECT_ID is not set"
[[ "${NEON_PROJECT_ID}" =~ ^[a-z0-9-]+$ ]] || fail "NEON_PROJECT_ID is not a Neon project id"
[[ "${TIMEOUT}" =~ ^[0-9]+$ ]] && [[ "${INTERVAL}" =~ ^[0-9]+$ ]] ||
  fail "NEON_RESET_TIMEOUT and NEON_POLL_INTERVAL must be whole seconds"
command -v jq >/dev/null || fail "jq is not on PATH"
command -v curl >/dev/null || fail "curl is not on PATH"

project_path="/projects/${NEON_PROJECT_ID}"

# neon <GET|POST> <path> [json body]: prints the response body. The API key
# goes to curl through a file descriptor, never through the argument list.
neon() {
  local method="$1" path="$2" body="${3:-}"
  local args=(--silent --show-error --fail-with-body --max-time 30 --proto '=https'
    --request "${method}" --header "Accept: application/json")
  if [ -n "${body}" ]; then
    args+=(--header "Content-Type: application/json" --data "${body}")
  else
    # Only reads are retried; a restore is never sent twice.
    args+=(--retry 3 --retry-delay 2)
  fi
  curl "${args[@]}" --header @<(printf 'Authorization: Bearer %s\n' "${NEON_API_KEY}") "${API}${path}"
}

# Prints Neon's error message from a response body, if it has one.
neon_message() {
  jq -r '.message // empty' <<<"$1" 2>/dev/null || true
}

if ! branches="$(neon GET "${project_path}/branches")"; then
  fail "could not list the branches of the project: $(neon_message "${branches:-}")"
fi

# branch_field <name> <field>: the field of the only branch with that name.
branch_field() {
  jq -r --arg name "$1" --arg field "$2" \
    '[.branches // [] | .[] | select(.name == $name)] | if length == 1 then (.[0][$field] // "" | tostring) else error("not one") end' \
    <<<"${branches}" 2>/dev/null
}

target_id="$(branch_field "${TARGET}" id)" || fail "expected exactly one branch named '${TARGET}'"
source_id="$(branch_field "${SOURCE}" id)" || fail "expected exactly one branch named '${SOURCE}'"
[ -n "${target_id}" ] && [ -n "${source_id}" ] || fail "a branch has no id in Neon's answer"
[ "${target_id}" != "${source_id}" ] || fail "'${TARGET}' and '${SOURCE}' are the same branch"
[ "$(branch_field "${TARGET}" default)" != "true" ] ||
  fail "'${TARGET}' is the default branch of the project; refusing to reset it"
[ "$(branch_field "${TARGET}" parent_id)" = "${source_id}" ] ||
  fail "the parent of '${TARGET}' is not '${SOURCE}'; refusing to reset it"
children="$(jq -r --arg id "${target_id}" '[.branches[] | select(.parent_id == $id)] | length' <<<"${branches}")"
[ "${children}" = "0" ] ||
  fail "'${TARGET}' has ${children} child branch(es); Neon cannot reset a branch with children"

echo "reset-neon-dev: resetting '${TARGET}' (${target_id}) from '${SOURCE}' (${source_id})"
payload="$(jq -cn --arg source "${source_id}" '{source_branch_id: $source}')"
if ! restored="$(neon POST "${project_path}/branches/${target_id}/restore" "${payload}")"; then
  fail "Neon refused the reset: $(neon_message "${restored:-}")"
fi

# The restore is asynchronous: wait for every operation it started. Finished,
# skipped and cancelled are terminal (Neon's documentation); failed is an error.
operations="$(jq -r '.operations // [] | .[].id' <<<"${restored}")" ||
  fail "unexpected answer to the reset"
deadline=$((SECONDS + TIMEOUT))
count=0
while IFS= read -r operation; do
  [ -n "${operation}" ] || continue
  [[ "${operation}" =~ ^[A-Za-z0-9-]+$ ]] || fail "unexpected operation id in Neon's answer"
  count=$((count + 1))
  while :; do
    if ! answer="$(neon GET "${project_path}/operations/${operation}")"; then
      fail "could not read operation ${operation}: $(neon_message "${answer:-}")"
    fi
    status="$(jq -r '.operation.status // "unknown"' <<<"${answer}")"
    case "${status}" in
    finished | skipped | cancelled) break ;;
    failed) fail "operation ${operation} failed" ;;
    esac
    [ "${SECONDS}" -lt "${deadline}" ] ||
      fail "operation ${operation} is still ${status} after ${TIMEOUT} seconds"
    sleep "${INTERVAL}"
  done
done <<<"${operations}"

echo "reset-neon-dev: '${TARGET}' now matches '${SOURCE}' (${count} operation(s) done)"
