// Cloudflare Access identity for the admin panel (ADR 0010).
//
// Workers with Static Assets do not receive Access's identity, so the Worker
// verifies the `Cf-Access-Jwt-Assertion` header itself. `authorizeAdminRequest`
// holds the whole decision and has no side effects: the middleware
// (admin-gate.ts) and the Actions helper (require-admin.ts) wrap it, and the
// tests drive it with a local JWKS instead of the network.
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose";

/** The header where Access sends the application token to the origin. */
export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

/** The fixed identity of local development. No deployed environment accepts it. */
export const LOCAL_ADMIN_EMAIL = "admin@enmirumbo.test";

export const ENVIRONMENTS = ["local", "dev", "stage", "prod"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** The Worker vars that configure Access, exactly as they arrive. */
export interface AccessConfig {
  environment: string | undefined;
  teamDomain: string | undefined;
  aud: string | undefined;
}

export type AccessVariable = "ENVIRONMENT" | "ACCESS_TEAM_DOMAIN" | "ACCESS_AUD";

export interface AdminIdentity {
  /** The email claim of the token: the actor of the audit log. */
  email: string;
  /** `local` only for the fixed identity of local development. */
  source: "access" | "local";
}

/** Why a request was refused. For the server log only, never for the response. */
export type AccessDenial =
  | { reason: "misconfigured"; variables: AccessVariable[] }
  | { reason: "local-identity-off-loopback" }
  | { reason: "missing-token" }
  | { reason: "invalid-token"; code: string }
  | { reason: "missing-email" };

export type AccessDecision =
  | { allowed: true; identity: AdminIdentity }
  | { allowed: false; denial: AccessDenial };

/** Returns the key set that verifies tokens of the given team domain. */
export type AccessKeys = (teamDomain: string) => JWTVerifyGetKey;

export function readAccessConfig(vars: {
  ENVIRONMENT?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}): AccessConfig {
  return {
    environment: vars.ENVIRONMENT,
    teamDomain: vars.ACCESS_TEAM_DOMAIN,
    aud: vars.ACCESS_AUD,
  };
}

/**
 * Decides whether a request may reach the admin panel.
 *
 * Fails closed: an unknown or missing `ENVIRONMENT`, or a non-local
 * environment without a valid team domain or AUD tag, refuses every request.
 * The fixed local identity needs `ENVIRONMENT` to be exactly `local` and the
 * request to arrive on a loopback host, so a Worker deployed by mistake with
 * the local vars still refuses it.
 */
export async function authorizeAdminRequest(
  request: Request,
  config: AccessConfig,
  keys: AccessKeys,
): Promise<AccessDecision> {
  const environment = parseEnvironment(config.environment);
  if (environment === undefined) {
    return deny({ reason: "misconfigured", variables: ["ENVIRONMENT"] });
  }

  if (environment === "local") {
    if (!isLoopbackHost(new URL(request.url).hostname)) {
      return deny({ reason: "local-identity-off-loopback" });
    }
    return { allowed: true, identity: { email: LOCAL_ADMIN_EMAIL, source: "local" } };
  }

  const teamDomain = parseTeamDomain(config.teamDomain);
  const aud = config.aud?.trim() ?? "";
  const missing: AccessVariable[] = [];
  if (teamDomain === undefined) missing.push("ACCESS_TEAM_DOMAIN");
  if (aud === "") missing.push("ACCESS_AUD");
  if (teamDomain === undefined || missing.length > 0) {
    return deny({ reason: "misconfigured", variables: missing });
  }

  const token = request.headers.get(ACCESS_JWT_HEADER)?.trim() ?? "";
  if (token === "") return deny({ reason: "missing-token" });

  let payload;
  try {
    ({ payload } = await jwtVerify(token, keys(teamDomain), {
      issuer: `https://${teamDomain}`,
      audience: aud,
      // Access signs with RS256; refusing anything else rules out algorithm
      // confusion. jose only checks `exp` when it is present, so require it.
      algorithms: ["RS256"],
      requiredClaims: ["exp"],
    }));
  } catch (error) {
    return deny({ reason: "invalid-token", code: errorCode(error) });
  }

  const email = payload["email"];
  if (typeof email !== "string" || !email.includes("@")) {
    return deny({ reason: "missing-email" });
  }
  return { allowed: true, identity: { email, source: "access" } };
}

/** Writes why a request was refused to the server log, never the token or the email. */
export function logDenial(denial: AccessDenial): void {
  if (denial.reason === "misconfigured") {
    console.error(
      `admin access: not configured (${denial.variables.join(", ")} missing or invalid); every /admin request gets 403`,
    );
  } else if (denial.reason === "local-identity-off-loopback") {
    console.error("admin access: ENVIRONMENT is local on a non-loopback host; refusing");
  } else if (denial.reason === "invalid-token") {
    console.warn(`admin access: refused (invalid-token ${denial.code})`);
  } else {
    console.warn(`admin access: refused (${denial.reason})`);
  }
}

// One remote key set per team domain, kept for the life of the isolate so the
// JWKS is fetched once and then cached by jose (10 minutes, refetched when a
// token names an unknown key).
const remoteKeySets = new Map<string, JWTVerifyGetKey>();

/** The team's JWKS at `https://<team domain>/cdn-cgi/access/certs`. */
export const remoteAccessKeys: AccessKeys = (teamDomain) => {
  let keySet = remoteKeySets.get(teamDomain);
  if (keySet === undefined) {
    keySet = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    remoteKeySets.set(teamDomain, keySet);
  }
  return keySet;
};

function deny(denial: AccessDenial): AccessDecision {
  return { allowed: false, denial };
}

function parseEnvironment(value: string | undefined): Environment | undefined {
  return ENVIRONMENTS.find((environment) => environment === value);
}

// A team domain is `<team>.cloudflareaccess.com`. The `https://` prefix of
// Cloudflare's examples is accepted; anything else is a misconfiguration, so
// the JWKS can never be fetched from another host.
const TEAM_DOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/;

function parseTeamDomain(value: string | undefined): string | undefined {
  const domain = value
    ?.trim()
    .toLowerCase()
    .replace(/^https:\/\//, "")
    .replace(/\/$/, "");
  return domain !== undefined && TEAM_DOMAIN.test(domain) ? domain : undefined;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}

function errorCode(error: unknown): string {
  return error instanceof errors.JOSEError ? error.code : "ERR_UNKNOWN";
}
