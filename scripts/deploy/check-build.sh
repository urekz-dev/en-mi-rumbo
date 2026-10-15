#!/usr/bin/env bash
# Checks the Worker configuration a build produced for one environment before
# anything changes (ADR 0008): the deploy workflows run it right after
# `CLOUDFLARE_ENV=<env> vp run build`, before they touch a database or
# Cloudflare. It reads the file `wrangler deploy` will deploy, not
# wrangler.jsonc, and reports every problem at once:
#   - the build targets <env>, with that environment's Worker name and vars;
#   - workers.dev on and Version/Preview URLs off;
#   - the hourly Cron Trigger on stage and prod, none on dev (ADR 0013);
#   - HYPERDRIVE and HYPERDRIVE_FRESH set to two different real Hyperdrive ids,
#     so a placeholder id never reaches Cloudflare;
#   - SITE_URL is an https origin;
#   - the _headers file of the static assets gives every one of them
#     X-Robots-Tag: noindex, because Cloudflare serves them (the prerendered
#     legal pages, the CSS) without the Worker that adds it to the rest
#     (src/integrations/static-noindex.ts).
# An empty ACCESS_AUD is only a warning: the panel stays closed (403) until the
# Access application exists.
#
# Usage: scripts/deploy/check-build.sh <dev|stage|prod> [config]
#   config defaults to dist/server/wrangler.json (written by the Astro build).
# In GitHub Actions it also writes `site-url=<SITE_URL>` to $GITHUB_OUTPUT.
set -euo pipefail

usage() {
  echo "::error::check-build: $*" >&2
  exit 1
}

[ "$#" -ge 1 ] && [ "$#" -le 2 ] || usage "usage: check-build.sh <dev|stage|prod> [config]"
env_name="$1"
config="${2:-dist/server/wrangler.json}"

case "${env_name}" in
dev)
  worker="dev-enmirumbo"
  crons='[]'
  ;;
stage)
  worker="stage-enmirumbo"
  crons='["0 * * * *"]'
  ;;
prod)
  worker="enmirumbo"
  crons='["0 * * * *"]'
  ;;
*) usage "environment must be dev, stage or prod (got '${env_name}')" ;;
esac

command -v jq >/dev/null || usage "jq is not on PATH"
[ -f "${config}" ] ||
  usage "${config} not found; build first with CLOUDFLARE_ENV=${env_name} vp run build"
jq -e 'type == "object"' "${config}" >/dev/null 2>&1 || usage "${config} is not a JSON object"

errors=0
error() {
  echo "::error::check-build (${env_name}): $*" >&2
  errors=$((errors + 1))
}

# Prints a value of the config as compact JSON (null when missing).
value() {
  jq -c "$1" "${config}"
}

[ "$(value '.targetEnvironment')" = "\"${env_name}\"" ] ||
  error "the build targets $(value '.targetEnvironment'), not \"${env_name}\"; build with CLOUDFLARE_ENV=${env_name}"
[ "$(value '.name')" = "\"${worker}\"" ] ||
  error "the Worker name is $(value '.name'), expected \"${worker}\""
[ "$(value '.vars.ENVIRONMENT')" = "\"${env_name}\"" ] ||
  error "ENVIRONMENT is $(value '.vars.ENVIRONMENT'), expected \"${env_name}\""
[ "$(value '.workers_dev')" = "true" ] ||
  error "workers_dev is $(value '.workers_dev'), expected true"
[ "$(value '.preview_urls')" = "false" ] ||
  error "preview_urls is $(value '.preview_urls'), expected false: Version URLs would bypass Access"
[ "$(value '.triggers.crons')" = "${crons}" ] ||
  error "the Cron Triggers are $(value '.triggers.crons'), expected ${crons}"

ids=()
for binding in HYPERDRIVE HYPERDRIVE_FRESH; do
  matches="$(jq --arg b "${binding}" '[.hyperdrive // [] | .[] | select(.binding == $b)] | length' "${config}")"
  if [ "${matches}" != "1" ]; then
    error "expected one ${binding} binding, found ${matches}"
    continue
  fi
  id="$(jq -r --arg b "${binding}" '.hyperdrive[] | select(.binding == $b) | .id' "${config}")"
  if [[ ! "${id}" =~ ^[0-9a-f]{32}$ ]] || [[ "${id}" =~ ^0+$ ]]; then
    error "${binding} still has the placeholder id '${id}'. Create the Hyperdrive config and put its id in env.${env_name}.hyperdrive of wrangler.jsonc"
    continue
  fi
  ids+=("${id}")
done
if [ "${#ids[@]}" -eq 2 ] && [ "${ids[0]}" = "${ids[1]}" ]; then
  error "HYPERDRIVE and HYPERDRIVE_FRESH share the id ${ids[0]}; HYPERDRIVE_FRESH needs its own config with caching disabled"
fi

site_url="$(jq -r '.vars.SITE_URL // ""' "${config}")"
[[ "${site_url}" =~ ^https://[a-z0-9.-]+$ ]] ||
  error "SITE_URL is '${site_url}', expected an https origin without a path or trailing slash"

[ -n "$(jq -r '.vars.ACCESS_TEAM_DOMAIN // ""' "${config}")" ] || error "ACCESS_TEAM_DOMAIN is empty"

# Whether a _headers file has a rule for /* that sets X-Robots-Tag: noindex.
has_noindex_rule() {
  awk '
    /^[[:space:]]*(#|$)/ { next }
    /^[^[:space:]]/ { every = ($1 == "/*"); next }
    every && tolower($0) ~ /^[[:space:]]+x-robots-tag:[[:space:]]*noindex[[:space:]]*$/ { found = 1 }
    END { exit !found }
  ' "$1"
}

assets="$(jq -r '.assets.directory // ""' "${config}")"
if [ -z "${assets}" ]; then
  error "the build declares no static assets directory (assets.directory)"
else
  headers="$(dirname "${config}")/${assets}/_headers"
  if [ ! -f "${headers}" ] || ! has_noindex_rule "${headers}"; then
    error "${headers} does not give every static asset X-Robots-Tag: noindex, so the prerendered pages would be indexable (src/integrations/static-noindex.ts)"
  fi
fi
if [ -z "$(jq -r '.vars.ACCESS_AUD // ""' "${config}")" ]; then
  echo "::warning::check-build (${env_name}): ACCESS_AUD is empty, so /admin answers 403 to everyone until it is set"
fi

if [ "${errors}" -gt 0 ]; then
  echo "check-build: ${errors} problem(s) in the ${env_name} build; nothing was deployed" >&2
  exit 1
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "site-url=${site_url}" >>"${GITHUB_OUTPUT}"
fi
echo "check-build: the ${env_name} build of ${worker} is ready to deploy to ${site_url}"
