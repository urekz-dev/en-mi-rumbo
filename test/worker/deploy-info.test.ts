// Scenarios of docs/specs/deployment.md, requirement "The dev footer names the
// branch and commit deployed (v2)". src/pages/index.astro renders the footer
// only when readDeployInfo returns something.
import { describe, expect, it } from "vite-plus/test";
import { readDeployInfo } from "../../src/lib/deploy-info.ts";

const COMMIT = "167a5a8e0c4f3b2a1d9e8f7a6b5c4d3e2f1a0b9c";

describe("The dev footer names the branch and commit deployed (v2)", () => {
  it("dev: the branch and the short commit", () => {
    expect(
      readDeployInfo({
        ENVIRONMENT: "dev",
        DEPLOY_BRANCH: "EMR-15-environments-deploys",
        DEPLOY_COMMIT: COMMIT,
      }),
    ).toEqual({ branch: "EMR-15-environments-deploys", commit: COMMIT, shortCommit: "167a5a8" });
  });

  it.for(["stage", "prod", "local", undefined])(
    "another environment (%s): nothing, even with both values",
    (environment) => {
      expect(
        readDeployInfo({
          ENVIRONMENT: environment,
          DEPLOY_BRANCH: "main",
          DEPLOY_COMMIT: COMMIT,
        }),
      ).toBeUndefined();
    },
  );

  it.for([
    { DEPLOY_BRANCH: "", DEPLOY_COMMIT: COMMIT },
    { DEPLOY_BRANCH: "  ", DEPLOY_COMMIT: COMMIT },
    { DEPLOY_COMMIT: COMMIT },
    { DEPLOY_BRANCH: "main", DEPLOY_COMMIT: "" },
    { DEPLOY_BRANCH: "main" },
    { DEPLOY_BRANCH: "main", DEPLOY_COMMIT: "<script>alert(1)</script>" },
    { DEPLOY_BRANCH: "main", DEPLOY_COMMIT: "abc" },
  ])("dev with a missing or invalid value (%j): nothing", (vars) => {
    expect(readDeployInfo({ ENVIRONMENT: "dev", ...vars })).toBeUndefined();
  });
});
