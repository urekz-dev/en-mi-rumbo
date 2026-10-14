#!/usr/bin/env bash
# Stand-ins for pg_dump, pg_restore and aws in the tests of
# scripts/backup/dump-to-r2.sh (operations-scripts.test.ts). The test copies
# this file under each of those names; it acts on the name it is called by.
#
# FAKE_TOOLS_LOG: each call is appended as one JSON line
#   {"tool", "argv": [...], "env": {PGPASSWORD, AWS_ACCESS_KEY_ID, ...}}.
# FAKE_STORE: the directory that stands for the bucket.
# FAKE_PG_DUMP_VERSION: what `pg_dump --version` prints.
# FAKE_PG_DUMP_FAIL, FAKE_PG_RESTORE_FAIL, FAKE_AWS_PUT_FAIL: fail that step.
# FAKE_PG_RESTORE_LIST: what `pg_restore --list` prints.
# FAKE_AWS_HEAD_SIZE: the ContentLength head-object reports.
set -euo pipefail

tool="$(basename "$0")"
jq -cn --arg tool "${tool}" \
  --arg PGPASSWORD "${PGPASSWORD-}" --arg AWS_ACCESS_KEY_ID "${AWS_ACCESS_KEY_ID-}" \
  --arg AWS_SECRET_ACCESS_KEY "${AWS_SECRET_ACCESS_KEY-}" --arg AWS_DEFAULT_REGION "${AWS_DEFAULT_REGION-}" \
  --arg AWS_REQUEST_CHECKSUM_CALCULATION "${AWS_REQUEST_CHECKSUM_CALCULATION-}" \
  '{$tool, argv: $ARGS.positional, env: {$PGPASSWORD, $AWS_ACCESS_KEY_ID, $AWS_SECRET_ACCESS_KEY, $AWS_DEFAULT_REGION, $AWS_REQUEST_CHECKSUM_CALCULATION}}' \
  --args -- "$@" >>"${FAKE_TOOLS_LOG}"

# option <name> <args...>: prints the value that follows --name.
option() {
  local name="$1"
  shift
  while [ "$#" -gt 0 ]; do
    if [ "$1" = "${name}" ]; then
      echo "$2"
      return 0
    fi
    shift
  done
  return 1
}

case "${tool}" in
pg_dump)
  if [ "${1-}" = "--version" ]; then
    echo "${FAKE_PG_DUMP_VERSION:-pg_dump (PostgreSQL) 18.6 (Ubuntu 18.6-1.pgdg24.04+1)}"
    exit 0
  fi
  if [ -n "${FAKE_PG_DUMP_FAIL-}" ]; then
    echo "pg_dump: error: connection to server failed" >&2
    exit 1
  fi
  printf 'PGDMP fake dump\n' >"$(option --file "$@")"
  ;;
pg_restore)
  [ -z "${FAKE_PG_RESTORE_FAIL-}" ] || exit 1
  printf '%s\n' "${FAKE_PG_RESTORE_LIST-;
; Archive created at 2026-10-14 03:23:00 UTC
3345; 0 16391 TABLE DATA drizzle __drizzle_migrations enmirumbodb_owner}"
  ;;
aws)
  key="$(option --key "$@")"
  case "$1 $2" in
  "s3api put-object")
    [ -z "${FAKE_AWS_PUT_FAIL-}" ] || {
      echo "An error occurred (BadDigest) when calling the PutObject operation" >&2
      exit 254
    }
    body="$(option --body "$@")"
    # R2 checks Content-MD5 against the body.
    expected="$(openssl dgst -md5 -binary "${body}" | openssl base64)"
    if [ "$(option --content-md5 "$@")" != "${expected}" ]; then
      echo "An error occurred (BadDigest) when calling the PutObject operation" >&2
      exit 254
    fi
    mkdir -p "$(dirname "${FAKE_STORE}/${key}")"
    cp "${body}" "${FAKE_STORE}/${key}"
    echo '{"ETag": "\"fake\""}'
    ;;
  "s3api head-object")
    [ -f "${FAKE_STORE}/${key}" ] || exit 254
    echo "${FAKE_AWS_HEAD_SIZE:-$(wc -c <"${FAKE_STORE}/${key}" | tr -d ' ')}"
    ;;
  *) exit 2 ;;
  esac
  ;;
*) exit 2 ;;
esac
