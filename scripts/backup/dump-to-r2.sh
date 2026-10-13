#!/usr/bin/env bash
# Nightly backup of production (ADR 0016): pg_dump in the custom format, a
# check that the dump reads back and holds table data, and an upload through
# R2's S3 API to a private bucket. The bucket's lifecycle rule deletes each
# dump after 30 days and its bucket lock keeps it at least that long.
#
# Environment (the `backup` GitHub Environment holds the secrets):
#   DATABASE_URL           the direct connection string of production for the
#                          read-only role enmirumbo_backup, sslmode=verify-full
#   R2_ACCESS_KEY_ID       an R2 token with Object Read & Write on the bucket
#   R2_SECRET_ACCESS_KEY   only
#   CLOUDFLARE_ACCOUNT_ID  the account of the bucket
#   BACKUP_BUCKET          the bucket
#   BACKUP_PREFIX          optional, default "prod/"
#
# The password never reaches a command line or the log: it is split out of the
# connection string and given to pg_dump through PGPASSWORD. On GitHub Actions
# the database host is masked in the log as well.
set -euo pipefail

readonly PG_DUMP_MIN_MAJOR=18
# R2 takes up to 5 GiB minus 5 MiB in a single PutObject.
readonly MAX_BYTES=$((5 * 1024 * 1024 * 1024 - 5 * 1024 * 1024))

fail() {
  echo "::error::backup: $*" >&2
  exit 1
}

for name in DATABASE_URL R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY CLOUDFLARE_ACCOUNT_ID BACKUP_BUCKET; do
  [ -n "${!name:-}" ] || fail "${name} is not set"
done
prefix="${BACKUP_PREFIX-prod/}"
[[ "${CLOUDFLARE_ACCOUNT_ID}" =~ ^[0-9a-f]{32}$ ]] || fail "CLOUDFLARE_ACCOUNT_ID is not a Cloudflare account id"
[[ "${BACKUP_BUCKET}" =~ ^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$ ]] || fail "BACKUP_BUCKET is not an R2 bucket name"
[[ "${prefix}" =~ ^([a-z0-9-]+/)*$ ]] || fail "BACKUP_PREFIX must be empty or end with a slash"

# postgres[ql]://user:password@host[:port]/database?parameters
readonly URL_PATTERN='^(postgres|postgresql)://([^:@/?#]+):([^@/?#]+)@([^/?#]+)/([^/?#]+)\?(.+)$'
[[ "${DATABASE_URL}" =~ ${URL_PATTERN} ]] ||
  fail "DATABASE_URL must look like postgresql://user:password@host/database?sslmode=verify-full"
scheme="${BASH_REMATCH[1]}"
user="${BASH_REMATCH[2]}"
encoded_password="${BASH_REMATCH[3]}"
host="${BASH_REMATCH[4]}"
database="${BASH_REMATCH[5]}"
parameters="${BASH_REMATCH[6]}"
[[ "&${parameters}&" == *"&sslmode=verify-full&"* ]] || fail "DATABASE_URL must set sslmode=verify-full"
[[ "${host}" != *-pooler.* ]] || fail "DATABASE_URL must use the direct host, not the pooled one"
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then echo "::add-mask::${host%:*}"; fi
# libpq verifies the server against the system's certificate authorities.
[[ "&${parameters}" == *"&sslrootcert="* ]] || parameters="${parameters}&sslrootcert=system"
# The password is percent-encoded in the URL; PGPASSWORD takes it decoded.
password="$(printf '%b' "${encoded_password//%/\\x}")"
connection="${scheme}://${user}@${host}/${database}?${parameters}"

for tool in pg_dump pg_restore aws openssl; do
  command -v "${tool}" >/dev/null || fail "${tool} is not on PATH"
done
version="$(pg_dump --version)"
major="$(sed -nE 's/^pg_dump \(PostgreSQL\) ([0-9]+).*/\1/p' <<<"${version}")"
[ -n "${major}" ] && [ "${major}" -ge "${PG_DUMP_MIN_MAJOR}" ] ||
  fail "pg_dump ${PG_DUMP_MIN_MAJOR} or later is needed, found '${version}'"

work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
dump="${work}/backup.dump"
key="${prefix}enmirumbo-$(date -u +%Y%m%dT%H%M%SZ).dump"

echo "backup: dumping production with ${version}"
PGPASSWORD="${password}" PGCONNECT_TIMEOUT=30 \
  pg_dump --format=custom --no-password --file "${dump}" --dbname "${connection}" ||
  fail "pg_dump failed"

pg_restore --list "${dump}" >"${work}/list" || fail "the dump does not read back"
tables="$(grep -c ' TABLE DATA ' "${work}/list" || true)"
[ "${tables}" -gt 0 ] || fail "the dump holds no table data"

size="$(wc -c <"${dump}" | tr -d ' ')"
[ "${size}" -le "${MAX_BYTES}" ] || fail "the dump has ${size} bytes, more than one upload to R2 takes"
if command -v sha256sum >/dev/null; then
  sha256="$(sha256sum "${dump}" | cut -d ' ' -f 1)"
else
  sha256="$(shasum -a 256 "${dump}" | cut -d ' ' -f 1)"
fi
# R2 refuses the upload when the body does not match this checksum.
md5="$(openssl dgst -md5 -binary "${dump}" | openssl base64)"

endpoint="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="auto"
export AWS_EC2_METADATA_DISABLED="true"
export AWS_PAGER=""
# Only the checksums S3 requires, plus our Content-MD5: R2 does not take every
# checksum newer AWS CLIs add on their own.
export AWS_REQUEST_CHECKSUM_CALCULATION="when_required"
export AWS_RESPONSE_CHECKSUM_VALIDATION="when_required"

aws s3api put-object --endpoint-url "${endpoint}" --bucket "${BACKUP_BUCKET}" --key "${key}" \
  --body "${dump}" --content-md5 "${md5}" --content-type "application/octet-stream" \
  --metadata "sha256=${sha256}" >/dev/null || fail "the upload to R2 failed"
stored="$(aws s3api head-object --endpoint-url "${endpoint}" --bucket "${BACKUP_BUCKET}" \
  --key "${key}" --query ContentLength --output text)" || fail "the uploaded dump is not in R2"
[ "${stored}" = "${size}" ] || fail "R2 holds ${stored} bytes of ${key}, the dump has ${size}"

echo "backup: uploaded ${key} (${size} bytes, ${tables} tables with data, sha256 ${sha256})"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Backup of production"
    echo
    echo "| Object | Bytes | Tables with data | SHA-256 |"
    echo "| --- | --- | --- | --- |"
    echo "| \`${BACKUP_BUCKET}/${key}\` | ${size} | ${tables} | \`${sha256}\` |"
  } >>"${GITHUB_STEP_SUMMARY}"
fi
