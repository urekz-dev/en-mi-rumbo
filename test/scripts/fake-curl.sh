#!/usr/bin/env bash
# A stand-in for curl in the tests of scripts/deploy/ and scripts/monitor/
# (deploy-scripts.test.ts, operations-scripts.test.ts): it answers from a routes
# file instead of the network.
#
# FAKE_CURL_ROUTES: a JSON object from "<METHOD> <url>" to a list of answers
#   {"status": 200, "headers": {"name": "value"}, "body": "text" | {json}}.
#   Each call takes the first answer of its list; the last one repeats. A
#   status of 0 fails like a connection error.
# FAKE_CURL_LOG: each call is appended as one JSON line
#   {"argv": [...], "method", "url", "data", "headerFiles": [...]}, where
#   headerFiles holds the contents of every `--header @file`.
set -euo pipefail

argv=("$@")
method="GET"
url=""
data=""
dump=""
output=""
write_out=""
fail_with_body=false
header_files=()
while [ "$#" -gt 0 ]; do
  case "$1" in
  --request) method="$2" && shift 2 ;;
  --data) data="$2" && shift 2 ;;
  --header)
    if [[ "$2" == @* ]]; then header_files+=("$(cat "${2#@}")"); fi
    shift 2
    ;;
  --dump-header) dump="$2" && shift 2 ;;
  --output) output="$2" && shift 2 ;;
  --write-out) write_out="$2" && shift 2 ;;
  --max-time | --retry | --retry-delay | --proto | --proto-redir | --max-redirs) shift 2 ;;
  --fail-with-body) fail_with_body=true && shift ;;
  --*) shift ;;
  *) url="$1" && shift ;;
  esac
done

jq -cn --arg method "${method}" --arg url "${url}" --arg data "${data}" \
  --argjson headerFiles "$(jq -cn '$ARGS.positional' --args -- ${header_files[@]+"${header_files[@]}"})" \
  '{argv: $ARGS.positional, $method, $url, $data, $headerFiles}' \
  --args -- "${argv[@]}" >>"${FAKE_CURL_LOG}"

key="${method} ${url}"
answer="$(jq -c --arg key "${key}" '.[$key][0] // empty' "${FAKE_CURL_ROUTES}")"
if [ -z "${answer}" ]; then
  echo "fake curl: no route for ${key}" >&2
  exit 7
fi
next="$(jq --arg key "${key}" 'if (.[$key] | length) > 1 then .[$key] |= .[1:] else . end' "${FAKE_CURL_ROUTES}")"
printf '%s\n' "${next}" >"${FAKE_CURL_ROUTES}"

status="$(jq -r '.status' <<<"${answer}")"
if [ "${status}" = "0" ]; then
  [ -z "${write_out}" ] || printf '000'
  echo "curl: (7) Failed to connect" >&2
  exit 7
fi
body="$(jq -r 'if (.body | type) == "string" then .body else (.body | tojson) end' <<<"${answer}")"
if [ -n "${dump}" ]; then
  {
    echo "HTTP/2 ${status}"
    jq -r '.headers // {} | to_entries[] | "\(.key): \(.value)"' <<<"${answer}"
    echo
  } >"${dump}"
fi
if [ -n "${output}" ]; then printf '%s\n' "${body}" >"${output}"; else printf '%s\n' "${body}"; fi
[ -z "${write_out}" ] || printf '%s' "${status}"
if [ "${status}" -ge 400 ] && [ "${fail_with_body}" = true ]; then exit 22; fi
exit 0
