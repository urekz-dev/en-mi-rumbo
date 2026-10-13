#!/usr/bin/env bash
# Refuses to deploy from a ref the environment does not accept (ADR 0008), so a
# workflow started by hand from the wrong branch or tag stops before it builds:
#   dev    any branch (not a tag)
#   stage  main only
#   prod   a tag vX.Y.Z only (the trigger's v*.*.* glob also matches v1.2.3-rc1
#          and vfoo.bar.baz; this does not)
#
# Usage: scripts/deploy/check-ref.sh <dev|stage|prod>
# Reads GITHUB_REF, GITHUB_REF_TYPE and GITHUB_REF_NAME, which Actions sets.
set -euo pipefail

fail() {
  echo "::error::check-ref: $*" >&2
  exit 1
}

[ "$#" -eq 1 ] || fail "usage: check-ref.sh <dev|stage|prod>"
env_name="$1"
ref="${GITHUB_REF:-}"
ref_type="${GITHUB_REF_TYPE:-}"
ref_name="${GITHUB_REF_NAME:-}"
[ -n "${ref}" ] && [ -n "${ref_type}" ] && [ -n "${ref_name}" ] ||
  fail "GITHUB_REF, GITHUB_REF_TYPE and GITHUB_REF_NAME must be set (run this inside GitHub Actions)"

case "${env_name}" in
dev)
  [ "${ref_type}" = "branch" ] || fail "dev deploys a branch; this run is on the ${ref_type} ${ref_name}"
  ;;
stage)
  [ "${ref}" = "refs/heads/main" ] || fail "stage deploys main only; this run is on ${ref}"
  ;;
prod)
  semver='^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
  [ "${ref_type}" = "tag" ] && [[ "${ref_name}" =~ ${semver} ]] && [ "${ref}" = "refs/tags/${ref_name}" ] ||
    fail "prod deploys a tag vX.Y.Z only; this run is on ${ref}"
  ;;
*)
  fail "environment must be dev, stage or prod (got '${env_name}')"
  ;;
esac

echo "check-ref: ${ref} may deploy to ${env_name}"
