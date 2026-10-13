// Scenarios of docs/specs/deployment.md, requirement "Each environment is
// built and deployed by its own workflow (v2)": the scripts in scripts/deploy/
// that the deploy workflows run. Each script runs in bash with a clean
// environment (never the GitHub Actions variables of the CI run itself) and,
// where it calls the network, with test/scripts/fake-curl.sh as curl.
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const script = (name: string) => join(ROOT, "scripts/deploy", name);

let work: string;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "enmirumbo-deploy-"));
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function run(name: string, args: string[], env: Record<string, string> = {}): Run {
  // A clean environment. `wrangler types` declares the Worker vars as required
  // on ProcessEnv, which a child process does not need, hence Object.assign.
  const childEnv: NodeJS.ProcessEnv = Object.assign(Object.create(null) as NodeJS.ProcessEnv, {
    PATH: process.env["PATH"] ?? "/usr/bin:/bin",
    HOME: work,
    ...env,
  });
  const result = spawnSync("bash", [script(name), ...args], {
    cwd: work,
    encoding: "utf8",
    env: childEnv,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// ---------------------------------------------------------------------------
// The fake network.

type Answer = { status: number; headers?: Record<string, string>; body?: unknown };

interface FakeCall {
  argv: string[];
  method: string;
  url: string;
  data: string;
  headerFiles: string[];
}

function fakeNetwork(routes: Record<string, Answer[]>) {
  const bin = join(work, "bin");
  mkdirSync(bin, { recursive: true });
  copyFileSync(join(ROOT, "test/scripts/fake-curl.sh"), join(bin, "curl"));
  chmodSync(join(bin, "curl"), 0o755);
  const routesFile = join(work, "routes.json");
  const logFile = join(work, "calls.log");
  writeFileSync(routesFile, JSON.stringify(routes));
  writeFileSync(logFile, "");
  return {
    env: {
      PATH: `${bin}:${process.env["PATH"] ?? "/usr/bin:/bin"}`,
      FAKE_CURL_ROUTES: routesFile,
      FAKE_CURL_LOG: logFile,
    },
    calls: (): FakeCall[] =>
      readFileSync(logFile, "utf8")
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as FakeCall),
  };
}

// ---------------------------------------------------------------------------
// check-ref.sh

const BRANCH = (name: string) => ({
  GITHUB_REF: `refs/heads/${name}`,
  GITHUB_REF_TYPE: "branch",
  GITHUB_REF_NAME: name,
});
const TAG = (name: string) => ({
  GITHUB_REF: `refs/tags/${name}`,
  GITHUB_REF_TYPE: "tag",
  GITHUB_REF_NAME: name,
});

describe("Each environment is built and deployed by its own workflow (v2): the ref", () => {
  it.for([
    ["dev", BRANCH("EMR-15-environments-deploys")],
    ["dev", BRANCH("main")],
    ["stage", BRANCH("main")],
    ["prod", TAG("v0.1.0")],
    ["prod", TAG("v1.20.300")],
  ] as const)("accepted: %s from %j", ([environment, ref]) => {
    expect(run("check-ref.sh", [environment], ref).status).toBe(0);
  });

  it.for([
    ["dev", TAG("v0.1.0")],
    ["stage", BRANCH("EMR-15-environments-deploys")],
    ["stage", TAG("v0.1.0")],
    ["prod", BRANCH("main")],
    ["prod", TAG("v1.2.3-rc1")],
    ["prod", TAG("vfoo.bar.baz")],
    ["prod", TAG("v01.2.3")],
    ["prod", TAG("1.2.3")],
    ["prod", { ...TAG("v1.2.3"), GITHUB_REF: "refs/heads/v1.2.3" }],
  ] as const)("the wrong ref: %s from %j is refused", ([environment, ref]) => {
    const result = run("check-ref.sh", [environment], ref);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/^::error::check-ref: /);
  });

  it("refused outside GitHub Actions and for an unknown environment", () => {
    expect(run("check-ref.sh", ["dev"]).status).toBe(1);
    expect(run("check-ref.sh", ["production"], TAG("v1.0.0")).stderr).toContain(
      "must be dev, stage or prod",
    );
  });
});

// ---------------------------------------------------------------------------
// check-build.sh

const WORKERS = { dev: "dev-enmirumbo", stage: "stage-enmirumbo", prod: "enmirumbo" } as const;
type Environment = keyof typeof WORKERS;

// What `CLOUDFLARE_ENV=<env> vp run build` writes to dist/server/wrangler.json,
// with real-looking Hyperdrive ids.
function build(environment: Environment, overrides: Record<string, unknown> = {}) {
  return {
    name: WORKERS[environment],
    targetEnvironment: environment,
    topLevelName: "enmirumbo-local",
    workers_dev: true,
    preview_urls: false,
    triggers: { crons: environment === "dev" ? [] : ["0 * * * *"] },
    hyperdrive: [
      { binding: "HYPERDRIVE", id: "0123456789abcdef0123456789abcdef" },
      { binding: "HYPERDRIVE_FRESH", id: "fedcba9876543210fedcba9876543210" },
    ],
    vars: {
      ENVIRONMENT: environment,
      ACCESS_TEAM_DOMAIN: "urekz.cloudflareaccess.com",
      ACCESS_AUD: "a1".repeat(32),
      SITE_URL: `https://${WORKERS[environment]}.urekz.workers.dev`,
    },
    ...overrides,
  };
}

function checkBuild(environment: string, config: unknown, env: Record<string, string> = {}) {
  const file = join(work, "wrangler.json");
  writeFileSync(file, JSON.stringify(config));
  return run("check-build.sh", [environment, file], env);
}

const errors = (result: Run) =>
  result.stderr.split("\n").filter((line) => line.startsWith("::error::"));

describe("Each environment is built and deployed by its own workflow (v2): the build", () => {
  it.for(["dev", "stage", "prod"] as const)(
    "a complete build for %s passes and gives the site URL to the workflow",
    (environment) => {
      const output = join(work, "github-output");
      writeFileSync(output, "");
      const result = checkBuild(environment, build(environment), { GITHUB_OUTPUT: output });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(readFileSync(output, "utf8")).toBe(
        `site-url=https://${WORKERS[environment]}.urekz.workers.dev\n`,
      );
    },
  );

  it("a placeholder Hyperdrive id: refused, naming each binding and the environment", () => {
    const result = checkBuild(
      "stage",
      build("stage", {
        hyperdrive: [
          { binding: "HYPERDRIVE", id: "placeholder-enmirumbo-stage" },
          { binding: "HYPERDRIVE_FRESH", id: "00000000000000000000000000000000" },
        ],
      }),
    );
    expect(result.status).toBe(1);
    expect(errors(result)).toEqual([
      expect.stringMatching(
        /HYPERDRIVE still has the placeholder id 'placeholder-enmirumbo-stage'.*env\.stage\.hyperdrive/,
      ),
      expect.stringMatching(/HYPERDRIVE_FRESH still has the placeholder id '0{32}'/),
    ]);
    expect(result.stderr).toContain("nothing was deployed");
  });

  it("the placeholders committed in wrangler.jsonc are refused", () => {
    for (const environment of ["dev", "stage", "prod"] as const) {
      const config = build(environment, {
        hyperdrive: [
          { binding: "HYPERDRIVE", id: `placeholder-enmirumbo-${environment}` },
          { binding: "HYPERDRIVE_FRESH", id: `placeholder-enmirumbo-${environment}-fresh` },
        ],
      });
      expect(checkBuild(environment, config).status).toBe(1);
    }
  });

  it("a missing, duplicated or shared Hyperdrive binding is refused", () => {
    const missing = build("prod", { hyperdrive: [build("prod").hyperdrive[0]] });
    expect(errors(checkBuild("prod", missing))).toEqual([
      expect.stringContaining("expected one HYPERDRIVE_FRESH binding, found 0"),
    ]);
    const shared = build("prod", {
      hyperdrive: [
        { binding: "HYPERDRIVE", id: "0123456789abcdef0123456789abcdef" },
        { binding: "HYPERDRIVE_FRESH", id: "0123456789abcdef0123456789abcdef" },
      ],
    });
    expect(errors(checkBuild("prod", shared))).toEqual([expect.stringContaining("share the id")]);
  });

  it("a build for another environment is refused", () => {
    const result = checkBuild("stage", build("dev"));
    expect(result.status).toBe(1);
    const problems = errors(result).join("\n");
    expect(problems).toContain('the build targets "dev", not "stage"');
    expect(problems).toContain('the Worker name is "dev-enmirumbo", expected "stage-enmirumbo"');
    expect(problems).toContain('ENVIRONMENT is "dev", expected "stage"');
    expect(problems).toContain('the Cron Triggers are [], expected ["0 * * * *"]');
  });

  it("Version URLs on, workers.dev off, a cron on dev or a bad SITE_URL are refused", () => {
    expect(errors(checkBuild("prod", build("prod", { preview_urls: true })))).toEqual([
      expect.stringContaining("preview_urls is true"),
    ]);
    expect(errors(checkBuild("prod", build("prod", { workers_dev: false })))).toEqual([
      expect.stringContaining("workers_dev is false"),
    ]);
    expect(errors(checkBuild("prod", build("prod", { preview_urls: undefined })))).toEqual([
      expect.stringContaining("preview_urls is null"),
    ]);
    expect(errors(checkBuild("dev", build("dev", { triggers: { crons: ["0 * * * *"] } })))).toEqual(
      [expect.stringContaining("the Cron Triggers are")],
    );
    for (const url of [
      "http://enmirumbo.urekz.workers.dev",
      "https://enmirumbo.urekz.workers.dev/",
      "",
    ]) {
      const config = build("prod");
      const result = checkBuild("prod", { ...config, vars: { ...config.vars, SITE_URL: url } });
      expect(errors(result)).toEqual([expect.stringContaining("SITE_URL is")]);
    }
  });

  it("an empty ACCESS_AUD is only a warning: the panel stays closed", () => {
    const config = build("prod");
    const result = checkBuild("prod", { ...config, vars: { ...config.vars, ACCESS_AUD: "" } });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("::warning::check-build (prod): ACCESS_AUD is empty");
  });

  it("no build: refused with how to build", () => {
    const result = run("check-build.sh", ["dev", join(work, "missing.json")]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("CLOUDFLARE_ENV=dev vp run build");
  });
});

// ---------------------------------------------------------------------------
// reset-neon-dev.sh

const API = "https://console.neon.tech/api/v2/projects/proj-test-123";
const NEON = { NEON_API_KEY: "napi_test_key_not_real", NEON_PROJECT_ID: "proj-test-123" };
const BRANCHES = [
  { id: "br-prod-1", name: "prod", default: true },
  { id: "br-stage-2", name: "stage", parent_id: "br-prod-1", default: false },
  { id: "br-dev-3", name: "dev", parent_id: "br-stage-2", default: false },
];

function neonRoutes(branches: unknown[], extra: Record<string, Answer[]> = {}) {
  return {
    [`GET ${API}/branches`]: [{ status: 200, body: { branches } }],
    [`POST ${API}/branches/br-dev-3/restore`]: [
      {
        status: 200,
        body: { branch: { id: "br-dev-3" }, operations: [{ id: "op-1" }, { id: "op-2" }] },
      },
    ],
    [`GET ${API}/operations/op-1`]: [
      { status: 200, body: { operation: { status: "running" } } },
      { status: 200, body: { operation: { status: "finished" } } },
    ],
    [`GET ${API}/operations/op-2`]: [{ status: 200, body: { operation: { status: "finished" } } }],
    ...extra,
  };
}

function resetDev(routes: Record<string, Answer[]>, env: Record<string, string> = NEON) {
  const network = fakeNetwork(routes);
  const result = run("reset-neon-dev.sh", [], {
    ...network.env,
    NEON_POLL_INTERVAL: "0",
    ...env,
  });
  return { ...result, calls: network.calls() };
}

const writes = (calls: FakeCall[]) => calls.filter((call) => call.method !== "GET");

describe("Each environment is built and deployed by its own workflow (v2): resetting dev", () => {
  it("resets the branch named dev from stage and waits for Neon", () => {
    const result = resetDev(neonRoutes(BRANCHES));

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(writes(result.calls)).toEqual([
      expect.objectContaining({
        url: `${API}/branches/br-dev-3/restore`,
        data: '{"source_branch_id":"br-stage-2"}',
      }),
    ]);
    // Polled op-1 until it finished, then op-2.
    expect(result.calls.map((call) => `${call.method} ${call.url.replace(API, "")}`)).toEqual([
      "GET /branches",
      "POST /branches/br-dev-3/restore",
      "GET /operations/op-1",
      "GET /operations/op-1",
      "GET /operations/op-2",
    ]);
  });

  it("the API key travels in a header file, never in the arguments", () => {
    const result = resetDev(neonRoutes(BRANCHES));
    for (const call of result.calls) {
      expect(call.headerFiles).toEqual([`Authorization: Bearer ${NEON.NEON_API_KEY}`]);
      expect(call.argv.join(" ")).not.toContain(NEON.NEON_API_KEY);
    }
    expect(result.stdout + result.stderr).not.toContain(NEON.NEON_API_KEY);
  });

  it.for([
    [
      "dev's parent is not stage",
      BRANCHES.map((b) => (b.name === "dev" ? { ...b, parent_id: "br-prod-1" } : b)),
      "parent of 'dev' is not 'stage'",
    ],
    [
      "dev is the default branch",
      BRANCHES.map((b) => (b.name === "dev" ? { ...b, default: true } : b)),
      "default branch",
    ],
    [
      "dev has a child",
      [...BRANCHES, { id: "br-x-4", name: "x", parent_id: "br-dev-3" }],
      "child branch",
    ],
    [
      "two branches named dev",
      [...BRANCHES, { id: "br-dev-5", name: "dev", parent_id: "br-stage-2" }],
      "exactly one branch named 'dev'",
    ],
    [
      "no branch named dev",
      BRANCHES.filter((b) => b.name !== "dev"),
      "exactly one branch named 'dev'",
    ],
    [
      "no branch named stage",
      BRANCHES.filter((b) => b.name !== "stage"),
      "exactly one branch named 'stage'",
    ],
  ] as const)("refused without writing: %s", ([, branches, message]) => {
    const result = resetDev(neonRoutes([...branches]));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(writes(result.calls)).toEqual([]);
  });

  it("Neon refuses the reset: the run fails with Neon's message", () => {
    const result = resetDev(
      neonRoutes(BRANCHES, {
        [`POST ${API}/branches/br-dev-3/restore`]: [
          { status: 423, body: { message: "project already has running operations" } },
        ],
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Neon refused the reset: project already has running operations",
    );
  });

  it("an operation that fails or never finishes fails the run", () => {
    const failed = resetDev(
      neonRoutes(BRANCHES, {
        [`GET ${API}/operations/op-1`]: [
          { status: 200, body: { operation: { status: "failed" } } },
        ],
      }),
    );
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("operation op-1 failed");

    const stuck = resetDev(
      neonRoutes(BRANCHES, {
        [`GET ${API}/operations/op-1`]: [
          { status: 200, body: { operation: { status: "running" } } },
        ],
      }),
      { ...NEON, NEON_RESET_TIMEOUT: "0" },
    );
    expect(stuck.status).toBe(1);
    expect(stuck.stderr).toContain("still running after 0 seconds");
  });

  it("refused without credentials, before any call", () => {
    for (const env of [
      { NEON_PROJECT_ID: "proj-test-123" },
      { NEON_API_KEY: "k" },
      { ...NEON, NEON_PROJECT_ID: "../evil" },
    ]) {
      const result = resetDev(neonRoutes(BRANCHES), env);
      expect(result.status).toBe(1);
      expect(result.calls).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// smoke-test.sh

const ORIGIN = "https://enmirumbo.urekz.workers.dev";
const HOME_OK: Answer = {
  status: 200,
  headers: { "content-type": "text/html", "x-robots-tag": "noindex" },
  body: "<!doctype html>",
};
const ROBOTS_OK: Answer = { status: 200, body: "User-agent: *\nDisallow: /" };

function smoke(routes: Record<string, Answer[]>) {
  const network = fakeNetwork(routes);
  return run("smoke-test.sh", [ORIGIN], { ...network.env, SMOKE_ATTEMPTS: "3", SMOKE_DELAY: "0" });
}

describe("Each environment is built and deployed by its own workflow (v2): the smoke test", () => {
  it("passes when the home answers 200 with noindex and robots.txt is closed", () => {
    const result = smoke({
      [`GET ${ORIGIN}/`]: [HOME_OK],
      [`GET ${ORIGIN}/robots.txt`]: [ROBOTS_OK],
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("retries while the new version is not answering yet", () => {
    const result = smoke({
      [`GET ${ORIGIN}/`]: [{ status: 0 }, { status: 404, body: "" }, HOME_OK],
      [`GET ${ORIGIN}/robots.txt`]: [ROBOTS_OK],
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("retrying");
  });

  it.for([
    ["the home does not answer 200", { ...HOME_OK, status: 500 }, ROBOTS_OK, "answered 500"],
    [
      "the home has no noindex header",
      { ...HOME_OK, headers: {} },
      ROBOTS_OK,
      "no X-Robots-Tag: noindex",
    ],
    [
      "robots.txt is open",
      HOME_OK,
      { status: 200, body: "User-agent: *\nDisallow: /admin" },
      "does not close the site",
    ],
  ] as const)("fails when %s", ([, home, robots, message]) => {
    const result = smoke({ [`GET ${ORIGIN}/`]: [home], [`GET ${ORIGIN}/robots.txt`]: [robots] });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(result.stderr).toContain("after 3 attempts");
  });

  it("refuses anything but an https origin", () => {
    for (const origin of [
      "http://enmirumbo.urekz.workers.dev",
      `${ORIGIN}/`,
      "enmirumbo.urekz.workers.dev",
    ]) {
      expect(run("smoke-test.sh", [origin]).status).toBe(1);
    }
  });
});
